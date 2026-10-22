-- Account kinds, the profile privilege guard, watched listening sources and USSD follow-up.
-- Idempotent. Run once in the Supabase SQL editor (also safe to re-run).

-- ── 1. Three ways to join ─────────────────────────────────────────────────
--   anonymous  a generated username and password, no email
--   reporter   an email account that only reports
--   member     an email account that joins a chapter (goes through onboarding)
alter table public.profiles
  add column if not exists account_kind text;

do $$ begin
  alter table public.profiles add constraint profiles_account_kind_check
    check (account_kind is null or account_kind in ('anonymous','reporter','member'));
exception when duplicate_object then null; when others then null; end $$;

-- Existing rows: infer the kind from what they already are.
update public.profiles set account_kind = 'anonymous'
 where account_kind is null and is_anonymous is true;
update public.profiles set account_kind = 'member'
 where account_kind is null and (hub_onboarded is true or user_type::text = 'defender');
update public.profiles set account_kind = 'reporter'
 where account_kind is null and user_type::text = 'reporter';

-- ── 2. New accounts can no longer choose their own role ───────────────────
-- Sign-up metadata comes from the browser, so it must never decide
-- user_type. Staff roles are granted by an administrator only.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  anon boolean := coalesce((new.raw_user_meta_data->>'is_anonymous')::boolean, false);
  asked text := new.raw_user_meta_data->>'account_kind';
begin
  insert into public.profiles (id, email, username, is_anonymous, user_type, account_kind)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(coalesce(new.email,''), '@', 1)),
    anon,
    'reporter',
    case
      when anon then 'anonymous'
      when asked in ('reporter','member') then asked
      else 'member'
    end
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ── 3. Nobody can promote themselves ──────────────────────────────────────
-- profiles_own lets people update their own row, which included is_hub_admin
-- and user_type. This trigger stops anyone but an administrator (or the
-- service role, where auth.uid() is null) changing the privileged columns.
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_hub_admin() then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    NEW.is_hub_admin := false;
    NEW.user_type := 'reporter';
    NEW.banned_at := null;
    NEW.ban_reason := null;
    return NEW;
  end if;

  if NEW.is_hub_admin is distinct from OLD.is_hub_admin
     or NEW.user_type is distinct from OLD.user_type
     or NEW.banned_at is distinct from OLD.banned_at
     or NEW.ban_reason is distinct from OLD.ban_reason then
    raise exception 'Only an administrator can change roles or suspensions'
      using errcode = '42501';
  end if;
  return NEW;
end $$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard before insert or update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- Audit: who can open the reporting console right now? Run this and remove
-- anyone who should not be there (set user_type back to 'reporter').
--   select id, email, username, user_type, is_hub_admin, created_at
--     from public.profiles
--    where is_hub_admin or user_type::text in ('admin','defender')
--    order by created_at;

-- ── 4. Watched accounts and hashtags for online listening ─────────────────
create table if not exists public.listening_sources (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  platform text DEFAULT 'instagram' NOT NULL,
  kind text DEFAULT 'profile' NOT NULL,        -- profile | hashtag
  handle text NOT NULL,                        -- without @ or #
  note text,
  active boolean DEFAULT true NOT NULL,
  last_scanned_at timestamp with time zone,
  last_result text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  primary key (id)
);

create unique index if not exists listening_sources_uidx
  on public.listening_sources (platform, kind, lower(handle));

alter table public.listening_sources enable row level security;
drop policy if exists listening_src on public.listening_sources;
create policy listening_src on public.listening_sources for all
  using (public.can_administer_reports()) with check (public.can_administer_reports());

-- ── 5. USSD: check a report later with a PIN ──────────────────────────────
alter table public.reports
  add column if not exists ussd_pin_hash text,
  add column if not exists ussd_pin_attempts integer DEFAULT 0;
