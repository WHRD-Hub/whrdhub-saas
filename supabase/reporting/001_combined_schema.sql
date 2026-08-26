-- ============================================================
-- WHRD Hub - Combined Schema (single migration)
-- Run once in Supabase SQL Editor
-- ============================================================


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  0. ENUM TYPES                                              ║
-- ╚══════════════════════════════════════════════════════════════╝

do $$ begin create type public.user_type_enum as enum ('reporter','defender','admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.reporting_for_enum as enum ('self','someone_else','community_leader'); exception when duplicate_object then null; end $$;
do $$ begin create type public.perpetrator_type_enum as enum ('government','security_forces','intimate_partner','family_member','community_member','employer','online_troll','unknown','other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.attack_nature_enum as enum ('coordinated','bot_assisted','organic','unknown'); exception when duplicate_object then null; end $$;
do $$ begin create type public.urgency_enum as enum ('immediate','within_week','no_rush'); exception when duplicate_object then null; end $$;
do $$ begin create type public.reporter_type_enum as enum ('anonymous','authenticated'); exception when duplicate_object then null; end $$;
do $$ begin create type public.channel_enum as enum ('web','ussd','api','mobile'); exception when duplicate_object then null; end $$;
do $$ begin create type public.report_status_enum as enum ('submitted','under_review','referred','closed','flagged'); exception when duplicate_object then null; end $$;
do $$ begin create type public.verification_status_enum as enum ('pending','verified','unverified','needs_more_info'); exception when duplicate_object then null; end $$;
do $$ begin create type public.service_category_enum as enum ('legal','medical','psychosocial','shelter','digital_security','financial','referral','other'); exception when duplicate_object then null; end $$;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  1. PROFILES                                                ║
-- ╚══════════════════════════════════════════════════════════════╝

create table if not exists public.profiles (
  id           uuid references auth.users(id) on delete cascade primary key,
  username     text unique,
  display_name text,
  email        text,
  phone        text,
  avatar_url   text,
  is_anonymous boolean              default true,
  user_type    public.user_type_enum default 'reporter',
  created_at   timestamptz          default now()
);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  2. REPORTS                                                 ║
-- ╚══════════════════════════════════════════════════════════════╝

create table if not exists public.reports (
  id                   uuid default gen_random_uuid() primary key,
  user_id              uuid references auth.users(id) on delete set null,

  -- WHAT
  incident_types       text[]  not null default '{}',
  description          text,
  what_description     text,
  tfgbv_platform       text,
  tfgbv_link           text,
  tfgbv_screenshot_urls text[],
  tfgbv_content_text   text,

  -- WHO
  reporting_for        public.reporting_for_enum default 'self',
  perpetrator_type     public.perpetrator_type_enum,
  perpetrator_detail   text,

  -- WHERE
  county               text,
  location_description text,
  latitude             double precision,
  longitude            double precision,

  -- WHEN
  occurred_at          date,
  occurred_time        text,
  is_ongoing           boolean default false,

  -- HOW
  how_description      text,
  evidence_types       text[],

  -- TFGBV - online attack detail
  derogatory_words     text[],
  attack_nature        public.attack_nature_enum,

  -- WHY
  activism_context     text,

  -- SUPPORT
  support_needed       text[] default '{}',
  urgency              public.urgency_enum default 'within_week',
  consent_to_followup  boolean default false,
  contact_method       text,
  contact_value        text,

  -- METADATA
  reporter_type        public.reporter_type_enum default 'anonymous',
  channel              public.channel_enum       default 'web',
  status               public.report_status_enum default 'submitted',
  assigned_to          uuid references auth.users(id) on delete set null,
  defender_notes       text,

  -- FACT-CHECK / VERIFICATION
  verification_status  public.verification_status_enum default 'pending',
  verification_notes   text,
  verified_by          uuid references auth.users(id) on delete set null,
  verified_at          timestamptz,

  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  3. SERVICES                                                ║
-- ╚══════════════════════════════════════════════════════════════╝

create table if not exists public.services (
  id            uuid default gen_random_uuid() primary key,
  name          text not null,
  description   text,
  category      public.service_category_enum not null,
  organization  text,
  contact_phone text,
  contact_email text,
  contact_url   text,
  county        text,
  is_active     boolean default true,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz default now()
);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  4. REPORT ↔ SERVICE ASSIGNMENTS                            ║
-- ╚══════════════════════════════════════════════════════════════╝

create table if not exists public.report_services (
  id          uuid default gen_random_uuid() primary key,
  report_id   uuid references public.reports(id)  on delete cascade not null,
  service_id  uuid references public.services(id) on delete cascade not null,
  assigned_by uuid references auth.users(id)      on delete set null,
  assigned_at timestamptz default now(),
  note        text,
  unique(report_id, service_id)
);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  5. AUDIT LOG                                               ║
-- ╚══════════════════════════════════════════════════════════════╝

create table if not exists public.report_audit_log (
  id          uuid default gen_random_uuid() primary key,
  report_id   uuid references public.reports(id) on delete cascade,
  viewed_by   uuid references auth.users(id)     on delete set null,
  action      text not null,
  notes       text,
  created_at  timestamptz default now()
);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  6. USSD SESSIONS                                           ║
-- ╚══════════════════════════════════════════════════════════════╝

create table if not exists public.ussd_sessions (
  id           uuid default gen_random_uuid() primary key,
  session_id   text unique not null,
  phone_number text,
  text_input   text,
  current_step text    default 'start',
  session_data jsonb   default '{}',
  report_id    uuid    references public.reports(id) on delete set null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  7. FUNCTIONS & TRIGGERS                                    ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ── updated_at helper ──────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reports_updated_at      on public.reports;
drop trigger if exists ussd_sessions_updated_at on public.ussd_sessions;

create trigger reports_updated_at
  before update on public.reports
  for each row execute procedure public.handle_updated_at();

create trigger ussd_sessions_updated_at
  before update on public.ussd_sessions
  for each row execute procedure public.handle_updated_at();


-- ── Auto-create/sync profile on auth.users INSERT or UPDATE ────
-- Handles: email/password, Google OAuth, anonymous, USSD
-- Extracts Google avatar_url and display name automatically
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_username     text;
  v_is_anon      boolean;
  v_user_type    public.user_type_enum;
  v_display_name text;
  v_email        text;
  v_avatar_url   text;
  v_raw_type     text;
begin
  v_email := coalesce(new.email, new.raw_user_meta_data->>'email');

  v_is_anon := coalesce(
    (new.raw_user_meta_data->>'is_anonymous')::boolean,
    v_email like '%@anon.whrdhub.org' or v_email like '%@ussd.whrdhub.org',
    false
  );

  -- Cast user_type safely from metadata text to enum
  v_raw_type := coalesce(new.raw_user_meta_data->>'user_type', 'reporter');
  begin
    v_user_type := v_raw_type::public.user_type_enum;
  exception when invalid_text_representation then
    v_user_type := 'reporter';
  end;

  -- Extract display name (Google OAuth sends full_name, some providers send name)
  v_display_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'display_name'
  );

  -- Extract avatar URL from Google OAuth (avatar_url or picture)
  v_avatar_url := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture'
  );

  -- Generate username
  v_username := coalesce(
    new.raw_user_meta_data->>'username',
    case
      when v_email is not null
        and v_email not like '%@anon.whrdhub.org'
        and v_email not like '%@ussd.whrdhub.org'
      then regexp_replace(split_part(v_email, '@', 1), '[^a-zA-Z0-9_-]', '', 'g')
           || '-' || left(new.id::text, 4)
      else 'user-' || left(new.id::text, 8)
    end
  );

  insert into public.profiles (id, username, display_name, email, is_anonymous, user_type, avatar_url)
  values (new.id, v_username, v_display_name, v_email, v_is_anon, v_user_type, v_avatar_url)
  on conflict (id) do update set
    email        = coalesce(excluded.email, public.profiles.email),
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    avatar_url   = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    is_anonymous = excluded.is_anonymous;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_updated on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create trigger on_auth_user_updated
  after update of email, raw_user_meta_data on auth.users
  for each row execute procedure public.handle_new_user();


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  8. ROW LEVEL SECURITY                                      ║
-- ╚══════════════════════════════════════════════════════════════╝

alter table public.profiles          enable row level security;
alter table public.reports           enable row level security;
alter table public.services          enable row level security;
alter table public.report_services   enable row level security;
alter table public.report_audit_log  enable row level security;
alter table public.ussd_sessions     enable row level security;

-- Drop old policies to avoid conflicts on re-run
do $$ begin
  drop policy if exists "users_own_profile"          on public.profiles;
  drop policy if exists "admins_read_all_profiles"   on public.profiles;
  drop policy if exists "admins_update_all_profiles"  on public.profiles;
  drop policy if exists "reporters_own_reports"      on public.reports;
  drop policy if exists "reporters_insert_own"       on public.reports;
  drop policy if exists "defenders_see_all"          on public.reports;
  drop policy if exists "defenders_update_reports"   on public.reports;
  drop policy if exists "defenders_audit_log"        on public.report_audit_log;
  drop policy if exists "reporters_insert_audit"     on public.report_audit_log;
  drop policy if exists "reporters_read_own_audit"   on public.report_audit_log;
  drop policy if exists "public_read_services"       on public.services;
  drop policy if exists "defenders_manage_services"  on public.services;
  drop policy if exists "reporters_see_own_services" on public.report_services;
  drop policy if exists "defenders_manage_report_services" on public.report_services;
  drop policy if exists "admins_ussd"                on public.ussd_sessions;
exception when others then null;
end $$;

-- ── Profiles ───────────────────────────────────────────────────
-- Users can read/update their own profile
create policy "users_own_profile" on public.profiles
  for all using (auth.uid() = id);

-- Defenders/admins can read all profiles (admin panel)
create policy "admins_read_all_profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.user_type in ('defender','admin'))
  );

-- Admins can update any profile (e.g. promote to defender)
create policy "admins_update_all_profiles" on public.profiles
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.user_type = 'admin')
  );

-- ── Reports ────────────────────────────────────────────────────
-- Reporters see only their own
create policy "reporters_own_reports" on public.reports
  for select using (auth.uid() = user_id);

create policy "reporters_insert_own" on public.reports
  for insert with check (auth.uid() = user_id);

-- Defenders & admins see all
create policy "defenders_see_all" on public.reports
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and user_type in ('defender','admin'))
  );

create policy "defenders_update_reports" on public.reports
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and user_type in ('defender','admin'))
  );

-- ── Audit log ──────────────────────────────────────────────────
-- Defenders/admins full access
create policy "defenders_audit_log" on public.report_audit_log
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and user_type in ('defender','admin'))
  );

-- Reporters can insert audit entries for their own reports
create policy "reporters_insert_audit" on public.report_audit_log
  for insert with check (
    exists (select 1 from public.reports r where r.id = report_id and r.user_id = auth.uid())
  );

-- Reporters can read audit entries for their own reports
create policy "reporters_read_own_audit" on public.report_audit_log
  for select using (
    exists (select 1 from public.reports r where r.id = report_id and r.user_id = auth.uid())
  );

-- ── Services ───────────────────────────────────────────────────
-- Anyone can read active services
create policy "public_read_services" on public.services
  for select using (is_active = true);

-- Defenders/admins manage services
create policy "defenders_manage_services" on public.services
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and user_type in ('admin','defender'))
  );

-- ── Report-service assignments ─────────────────────────────────
create policy "reporters_see_own_services" on public.report_services
  for select using (
    exists (select 1 from public.reports where id = report_id and user_id = auth.uid())
  );

create policy "defenders_manage_report_services" on public.report_services
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and user_type in ('admin','defender'))
  );

-- ── USSD sessions ──────────────────────────────────────────────
create policy "admins_ussd" on public.ussd_sessions
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and user_type = 'admin')
  );


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  9. STORAGE BUCKETS                                         ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Avatars bucket (public read, users manage their own)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Report-screenshots bucket (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-screenshots', 'report-screenshots', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  10. STORAGE RLS POLICIES                                   ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Drop existing storage policies to allow re-run
do $$ begin
  drop policy if exists "avatars_public_read"       on storage.objects;
  drop policy if exists "avatars_owner_insert"      on storage.objects;
  drop policy if exists "avatars_owner_update"      on storage.objects;
  drop policy if exists "avatars_owner_delete"      on storage.objects;
  drop policy if exists "screenshots_owner_insert"  on storage.objects;
  drop policy if exists "screenshots_owner_read"    on storage.objects;
  drop policy if exists "screenshots_defenders_read" on storage.objects;
exception when others then null;
end $$;

-- ── Avatars ────────────────────────────────────────────────────
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Report screenshots ────────────────────────────────────────
create policy "screenshots_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'report-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "screenshots_owner_read" on storage.objects
  for select using (
    bucket_id = 'report-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "screenshots_defenders_read" on storage.objects
  for select using (
    bucket_id = 'report-screenshots'
    and exists (select 1 from public.profiles where id = auth.uid() and user_type in ('defender','admin'))
  );


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  11. RPC FUNCTIONS                                          ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ── get_report_stats() - admin dashboard summary ───────────────
create or replace function public.get_report_stats()
returns json language plpgsql security definer as $$
declare
  v_total        bigint;
  v_this_month   bigint;
  v_this_week    bigint;
  v_immediate    bigint;
  v_by_status    json;
  v_by_urgency   json;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and user_type in ('defender','admin')) then
    raise exception 'Unauthorized';
  end if;

  select count(*) into v_total from public.reports;
  select count(*) into v_this_month from public.reports where created_at >= date_trunc('month', now());
  select count(*) into v_this_week  from public.reports where created_at >= date_trunc('week', now());
  select count(*) into v_immediate  from public.reports where urgency = 'immediate' and status = 'submitted';

  select coalesce(json_object_agg(s, c), '{}') into v_by_status
  from (select status::text as s, count(*) as c from public.reports group by status) sub;

  select coalesce(json_object_agg(u, c), '{}') into v_by_urgency
  from (select urgency::text as u, count(*) as c from public.reports group by urgency) sub;

  return json_build_object(
    'total',       v_total,
    'this_month',  v_this_month,
    'this_week',   v_this_week,
    'immediate',   v_immediate,
    'by_status',   v_by_status,
    'by_urgency',  v_by_urgency
  );
end;
$$;

-- ── assign_report() ────────────────────────────────────────────
create or replace function public.assign_report(
  p_report_id uuid,
  p_defender_id uuid
) returns void language plpgsql security definer as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and user_type in ('defender','admin')) then
    raise exception 'Unauthorized';
  end if;

  update public.reports
  set assigned_to = p_defender_id, status = 'under_review'
  where id = p_report_id;

  insert into public.report_audit_log (report_id, viewed_by, action, notes)
  values (p_report_id, auth.uid(), 'assigned', 'Assigned to defender ' || p_defender_id::text);
end;
$$;

-- ── update_report_status() ─────────────────────────────────────
create or replace function public.update_report_status(
  p_report_id uuid,
  p_new_status public.report_status_enum,
  p_notes text default null
) returns void language plpgsql security definer as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and user_type in ('defender','admin')) then
    raise exception 'Unauthorized';
  end if;

  update public.reports set status = p_new_status where id = p_report_id;

  insert into public.report_audit_log (report_id, viewed_by, action, notes)
  values (p_report_id, auth.uid(), 'status_change', 'Status → ' || p_new_status::text || coalesce('. ' || p_notes, ''));
end;
$$;

-- ── get_user_report_count() ────────────────────────────────────
create or replace function public.get_user_report_count(p_user_id uuid)
returns integer language plpgsql security definer as $$
declare
  report_count integer;
begin
  if auth.uid() != p_user_id
    and not exists (select 1 from public.profiles where id = auth.uid() and user_type in ('defender','admin'))
  then
    raise exception 'Unauthorized';
  end if;

  select count(*) into report_count from public.reports where user_id = p_user_id;
  return report_count;
end;
$$;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  12. PROMOTE FIRST ADMIN                                    ║
-- ╚══════════════════════════════════════════════════════════════╝
-- After running this migration, execute in SQL Editor:
--   UPDATE public.profiles SET user_type = 'admin', is_anonymous = false
--   WHERE email = 'oliverwai9na@gmail.com';
