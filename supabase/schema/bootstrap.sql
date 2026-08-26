-- --------------------------------------------------------------------------
--  WHRD Hub - complete schema bootstrap
--  GENERATED FILE - do not edit. Run `npm run db:bundle` to rebuild.
--  Source files, in order:
--    reporting/001_combined_schema.sql
--    reporting/002_fix_profiles_rls_recursion.sql
--    reporting/003_onboarding.sql
--    reporting/004_language_notifications.sql
--    reporting/005_online_listening.sql
--    001_hub_saas_schema.sql
--    004_fix_rls_recursion.sql
--    006_dashboard_features.sql
--    007_storage.sql
--    009_admin_hardening.sql
--    010_blog_gallery.sql
--    011_resources.sql
--    012_publications_bucket.sql
--    013_merge_reporting_platform.sql
--    014_community_lifecycle.sql
--
--  Paste this whole file into the SQL editor of a new Supabase project.
--  It creates every table, type, function, trigger, RLS policy and storage
--  bucket the app needs. Idempotent: re-running it is safe and is also how
--  you bring an existing project up to date.
-- --------------------------------------------------------------------------


-- --------------------------------------------------------------------------
-- BEGIN reporting/001_combined_schema.sql
-- --------------------------------------------------------------------------

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

-- END reporting/001_combined_schema.sql


-- --------------------------------------------------------------------------
-- BEGIN reporting/002_fix_profiles_rls_recursion.sql
-- --------------------------------------------------------------------------

-- Fix: infinite recursion in profiles RLS policies.
-- The admin policies were doing SELECT FROM profiles inside a policy ON profiles.
-- Solution: SECURITY DEFINER helper function that bypasses RLS.

CREATE OR REPLACE FUNCTION public.get_my_user_type()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT user_type::text FROM public.profiles WHERE id = auth.uid();
$$;

DROP POLICY IF EXISTS "admins_read_all_profiles"   ON public.profiles;
DROP POLICY IF EXISTS "admins_update_all_profiles"  ON public.profiles;

CREATE POLICY "admins_read_all_profiles" ON public.profiles
  FOR SELECT USING (
    public.get_my_user_type() IN ('defender', 'admin')
  );

CREATE POLICY "admins_update_all_profiles" ON public.profiles
  FOR UPDATE USING (
    public.get_my_user_type() = 'admin'
  );

-- END reporting/002_fix_profiles_rls_recursion.sql


-- --------------------------------------------------------------------------
-- BEGIN reporting/003_onboarding.sql
-- --------------------------------------------------------------------------

-- Migration 003: Onboarding fields
-- Tracks whether a staff member has completed the role-selection + T&C onboarding flow.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepted_terms_at    timestamptz;

-- Existing admin/defender users who were manually set up before this migration
-- are considered already onboarded so they aren't redirected to /onboarding.
UPDATE public.profiles
  SET onboarding_completed = true
  WHERE user_type IN ('admin', 'defender')
    AND onboarding_completed IS DISTINCT FROM true;

-- NOTE: anonymous reporters are intentionally NOT pre-marked as complete.
-- They must accept the Terms & Conditions before accessing their dashboard.

-- END reporting/003_onboarding.sql


-- --------------------------------------------------------------------------
-- BEGIN reporting/004_language_notifications.sql
-- --------------------------------------------------------------------------

-- ============================================================
-- WHRD Hub - Language preference, notifications, auto-assignment
-- Run once in Supabase SQL Editor
-- ============================================================

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  1. LANGUAGE PREFERENCE                                       ║
-- ╚══════════════════════════════════════════════════════════════╝

alter table public.profiles add column if not exists preferred_language text default 'en';


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  2. NOTIFICATIONS                                             ║
-- ╚══════════════════════════════════════════════════════════════╝

create table if not exists public.notifications (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users(id) on delete cascade not null,
  report_id    uuid references public.reports(id) on delete cascade,
  type         text not null default 'service_assigned',
  service_name text,
  is_read      boolean default false,
  created_at   timestamptz default now()
);

create index if not exists notifications_user_id_idx on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No insert policy for authenticated/anon roles: rows are only ever created by the
-- SECURITY DEFINER trigger functions below, which bypass RLS.


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  3. AUTO-ASSIGN SUPPORT SERVICES ON VERIFICATION              ║
-- ╚══════════════════════════════════════════════════════════════╝

create or replace function public.handle_report_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.verification_status = 'verified'
     and (OLD.verification_status is distinct from 'verified') then

    insert into public.report_services (report_id, service_id, assigned_by, note)
    select NEW.id, s.id, NEW.verified_by, 'Auto-assigned based on requested support'
    from public.services s
    where s.is_active = true
      and s.category::text = any(NEW.support_needed)
    on conflict (report_id, service_id) do nothing;

  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_report_verified on public.reports;
create trigger trg_report_verified
  after update on public.reports
  for each row
  execute function public.handle_report_verified();


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  4. NOTIFY REPORTER WHEN A SERVICE IS ASSIGNED (POST-VERIFY)   ║
-- ╚══════════════════════════════════════════════════════════════╝

create or replace function public.handle_service_assigned_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id           uuid;
  v_verification_status text;
  v_service_name       text;
begin
  select user_id, verification_status::text
    into v_user_id, v_verification_status
  from public.reports
  where id = NEW.report_id;

  if v_verification_status = 'verified' and v_user_id is not null then
    select name into v_service_name from public.services where id = NEW.service_id;

    insert into public.notifications (user_id, report_id, type, service_name)
    values (v_user_id, NEW.report_id, 'service_assigned', v_service_name);
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_service_assigned_notify on public.report_services;
create trigger trg_service_assigned_notify
  after insert on public.report_services
  for each row
  execute function public.handle_service_assigned_notify();

-- END reporting/004_language_notifications.sql


-- --------------------------------------------------------------------------
-- BEGIN reporting/005_online_listening.sql
-- --------------------------------------------------------------------------

-- Online listening: keywords the Hub watches for, and abuse signals captured
-- from connected Meta assets (Facebook Pages / Instagram) via the Graph API and
-- webhooks. Plain-ASCII only. Admin-only via RLS; the service-role webhook and
-- poller bypass RLS.

create table if not exists public.listening_keywords (
  id         uuid default gen_random_uuid() primary key,
  word       text not null,
  severity   text not null default 'medium',   -- low | medium | high
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists listening_keywords_word_uidx on public.listening_keywords (lower(word));

create table if not exists public.listening_results (
  id               uuid default gen_random_uuid() primary key,
  source           text not null default 'facebook', -- facebook | instagram | other
  source_id        text,                              -- platform object id (for dedupe)
  permalink        text,
  author           text,
  content          text not null,
  matched_keywords text[] not null default '{}',
  severity         text not null default 'medium',
  status           text not null default 'new',       -- new | reviewing | actioned | dismissed
  captured_at      timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create unique index if not exists listening_results_source_uidx
  on public.listening_results (source, source_id) where source_id is not null;
create index if not exists listening_results_status_idx on public.listening_results (status);
create index if not exists listening_results_captured_idx on public.listening_results (captured_at desc);

alter table public.listening_keywords enable row level security;
alter table public.listening_results  enable row level security;

drop policy if exists "admins_manage_keywords" on public.listening_keywords;
create policy "admins_manage_keywords" on public.listening_keywords for all
  using      (exists (select 1 from public.profiles where id = auth.uid() and user_type = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and user_type = 'admin'));

drop policy if exists "admins_manage_results" on public.listening_results;
create policy "admins_manage_results" on public.listening_results for all
  using      (exists (select 1 from public.profiles where id = auth.uid() and user_type = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and user_type = 'admin'));

-- Seed the basic abuse keywords. Safe to re-run.
insert into public.listening_keywords (word, severity) values
  ('rape','high'), ('defilement','high'), ('femicide','high'), ('assault','high'),
  ('gbv','high'), ('violence','high'), ('abuse','high'), ('harassment','medium'),
  ('threat','medium'), ('stalking','medium'), ('blackmail','medium'), ('doxxing','medium'),
  ('sextortion','high'), ('trafficking','high')
on conflict (lower(word)) do nothing;

-- END reporting/005_online_listening.sql


-- --------------------------------------------------------------------------
-- BEGIN 001_hub_saas_schema.sql
-- --------------------------------------------------------------------------

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  WHRD HUB  ·  SaaS platform schema                                     ║
-- ║  Run this in the SAME Supabase project as the reporting platform so    ║
-- ║  that accounts (auth.users + public.profiles) are shared.              ║
-- ║                                                                        ║
-- ║  Safe to run more than once: everything is guarded with IF NOT EXISTS  ║
-- ║  / drop-and-recreate for policies.                                     ║
-- ║                                                                        ║
-- ║  Hierarchy: Hub (national office)                                      ║
-- ║              -> County networks (Nairobi, Kitui, ...)                  ║
-- ║                  -> Organizations / CBOs                               ║
-- ║                      -> Members (WHRDs)                                ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ── Enums ────────────────────────────────────────────────────────────────
do $$ begin create type public.verification_state as enum ('pending','verified','rejected','needs_more_info'); exception when duplicate_object then null; end $$;
do $$ begin create type public.content_state      as enum ('draft','pending','approved','rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type public.membership_role    as enum ('member','org_admin'); exception when duplicate_object then null; end $$;

-- ── Profiles: add SaaS-only columns without touching the reporting app ────
-- The reporting platform owns this table; we only add nullable columns.
alter table public.profiles
  add column if not exists full_name          text,
  add column if not exists county_network_id  uuid,
  add column if not exists is_hub_admin        boolean default false,
  add column if not exists hub_onboarded       boolean default false,
  add column if not exists hub_terms_accepted_at timestamptz,   -- SAAS terms; independent of the reporting app
  add column if not exists bio                 text,
  add column if not exists title               text;   -- e.g. "Lawyer", "Advocate"

-- ── Helper: is the current user a Hub super-admin? ────────────────────────
create or replace function public.is_hub_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select is_hub_admin or user_type = 'admin' from public.profiles where id = uid),
    false
  );
$$;

-- ── 1. County networks ────────────────────────────────────────────────────
create table if not exists public.county_networks (
  id          uuid default gen_random_uuid() primary key,
  name        text not null unique,
  slug        text not null unique,
  is_active   boolean default false,          -- true = Hub currently operates here
  description text,
  created_at  timestamptz default now()
);

-- FK from profiles now that county_networks exists.
do $$ begin
  alter table public.profiles
    add constraint profiles_county_network_fk
    foreign key (county_network_id) references public.county_networks(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ── 2. Organizations (CBOs) ───────────────────────────────────────────────
create table if not exists public.organizations (
  id                  uuid default gen_random_uuid() primary key,
  name                text not null,
  slug                text unique,
  county_network_id   uuid references public.county_networks(id) on delete set null,
  description         text,
  contact_email       text,
  contact_phone       text,
  website             text,
  verification_status public.verification_state default 'pending',
  verification_notes  text,
  created_by          uuid references auth.users(id) on delete set null,
  verified_by         uuid references auth.users(id) on delete set null,
  verified_at         timestamptz,
  created_at          timestamptz default now()
);
create index if not exists organizations_county_idx on public.organizations(county_network_id);
create index if not exists organizations_status_idx on public.organizations(verification_status);

-- ── 3. Org memberships ────────────────────────────────────────────────────
create table if not exists public.org_memberships (
  id              uuid default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            public.membership_role default 'member',
  created_at      timestamptz default now(),
  unique (organization_id, user_id)
);
create index if not exists org_memberships_user_idx on public.org_memberships(user_id);
create index if not exists org_memberships_org_idx  on public.org_memberships(organization_id);

-- ── 4. Femtorship profiles (mentorship questionnaire) ─────────────────────
-- One row per user. Answers drive automatic mentor/mentee matching.
create table if not exists public.mentorship_profiles (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  -- questionnaire
  in_leadership_role  boolean,
  leadership_detail   text,
  has_guide           boolean,
  relationship_nature text,
  barriers            text,
  wants_mentor        boolean,               -- interested in having a femtor (mentee side)
  desired_qualities   text[] default '{}',   -- qualities sought in a femtor
  guidance_areas      text[] default '{}',   -- areas needing guidance (mentee needs)
  can_provide         boolean,               -- in a capacity to provide femtorship (mentor side)
  support_offered     text[] default '{}',   -- kinds of support offered (mentor capacity)
  support_detail      text,
  -- derived
  is_mentee           boolean generated always as (coalesce(wants_mentor,false)) stored,
  is_mentor           boolean generated always as (coalesce(can_provide,false)) stored,
  updated_at          timestamptz default now(),
  created_at          timestamptz default now()
);

-- ── 5. Femtorship matches ─────────────────────────────────────────────────
create table if not exists public.mentorship_matches (
  id          uuid default gen_random_uuid() primary key,
  mentor_id   uuid not null references auth.users(id) on delete cascade,
  mentee_id   uuid not null references auth.users(id) on delete cascade,
  score       numeric default 0,
  overlap     text[] default '{}',           -- matched focus areas
  status      text default 'suggested',      -- suggested | accepted | declined
  created_at  timestamptz default now(),
  unique (mentor_id, mentee_id)
);
create index if not exists matches_mentor_idx on public.mentorship_matches(mentor_id);
create index if not exists matches_mentee_idx on public.mentorship_matches(mentee_id);

-- ── 6. Posts (LinkedIn-style social updates) ──────────────────────────────
create table if not exists public.posts (
  id                uuid default gen_random_uuid() primary key,
  author_id         uuid references auth.users(id) on delete set null,
  organization_id   uuid references public.organizations(id) on delete set null,
  county_network_id uuid references public.county_networks(id) on delete set null,
  body              text not null,
  image_urls        text[] default '{}',
  is_hub            boolean default false,   -- posted by the Hub itself
  pinned            boolean default false,
  status            public.content_state default 'pending',
  review_notes      text,
  reviewed_by       uuid references auth.users(id) on delete set null,
  published_at      timestamptz,
  created_at        timestamptz default now()
);
create index if not exists posts_status_idx    on public.posts(status);
create index if not exists posts_published_idx  on public.posts(published_at desc);

-- ── 7. Blogs (long-form; also surfaced in the feed as a card) ─────────────
create table if not exists public.blogs (
  id                uuid default gen_random_uuid() primary key,
  author_id         uuid references auth.users(id) on delete set null,
  organization_id   uuid references public.organizations(id) on delete set null,
  county_network_id uuid references public.county_networks(id) on delete set null,
  title             text not null,
  slug              text unique,
  excerpt           text,
  body              text not null,
  cover_image_url   text,
  is_hub            boolean default false,
  pinned            boolean default false,
  status            public.content_state default 'pending',
  review_notes      text,
  reviewed_by       uuid references auth.users(id) on delete set null,
  published_at      timestamptz,
  created_at        timestamptz default now()
);
create index if not exists blogs_status_idx    on public.blogs(status);
create index if not exists blogs_published_idx  on public.blogs(published_at desc);

-- ── 8. Post reactions (lightweight social signal) ─────────────────────────
create table if not exists public.post_reactions (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text default 'support',   -- support | solidarity | celebrate
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

-- ── 9. Content audit log (verification trail, mirrors reporting app) ──────
create table if not exists public.content_audit_log (
  id           uuid default gen_random_uuid() primary key,
  content_type text not null,          -- 'post' | 'blog' | 'organization'
  content_id   uuid not null,
  action       text not null,          -- viewed | approved | rejected | edited | pinned | verified
  actor_id     uuid references auth.users(id) on delete set null,
  detail       text,
  created_at   timestamptz default now()
);
create index if not exists audit_content_idx on public.content_audit_log(content_type, content_id);

-- ── Auto-slug + publish-timestamp triggers ────────────────────────────────
create or replace function public.slugify(txt text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(txt,'')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.blogs_before_write()
returns trigger language plpgsql as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := public.slugify(new.title) || '-' || substr(new.id::text, 1, 6);
  end if;
  if new.status = 'approved' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_blogs_before_write on public.blogs;
create trigger trg_blogs_before_write before insert or update on public.blogs
  for each row execute function public.blogs_before_write();

create or replace function public.posts_before_write()
returns trigger language plpgsql as $$
begin
  if new.status = 'approved' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_posts_before_write on public.posts;
create trigger trg_posts_before_write before insert or update on public.posts
  for each row execute function public.posts_before_write();

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Row Level Security                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════╝
alter table public.county_networks     enable row level security;
alter table public.organizations       enable row level security;
alter table public.org_memberships     enable row level security;
alter table public.mentorship_profiles enable row level security;
alter table public.mentorship_matches  enable row level security;
alter table public.posts               enable row level security;
alter table public.blogs               enable row level security;
alter table public.post_reactions      enable row level security;
alter table public.content_audit_log   enable row level security;

-- County networks: world-readable, Hub writes.
drop policy if exists cn_read on public.county_networks;
create policy cn_read on public.county_networks for select using (true);
drop policy if exists cn_write on public.county_networks;
create policy cn_write on public.county_networks for all
  using (public.is_hub_admin(auth.uid())) with check (public.is_hub_admin(auth.uid()));

-- Organizations: everyone can read; any authed user can propose one; the
-- creator or Hub can update; Hub can do anything.
drop policy if exists org_read on public.organizations;
create policy org_read on public.organizations for select using (true);
drop policy if exists org_insert on public.organizations;
create policy org_insert on public.organizations for insert to authenticated
  with check (created_by = auth.uid());
drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations for update
  using (created_by = auth.uid() or public.is_hub_admin(auth.uid()))
  with check (created_by = auth.uid() or public.is_hub_admin(auth.uid()));

-- Memberships: read your own + fellow members of your orgs + Hub; join yourself.
drop policy if exists mem_read on public.org_memberships;
create policy mem_read on public.org_memberships for select using (
  user_id = auth.uid()
  or public.is_hub_admin(auth.uid())
  or organization_id in (select organization_id from public.org_memberships where user_id = auth.uid())
);
drop policy if exists mem_join on public.org_memberships;
create policy mem_join on public.org_memberships for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists mem_leave on public.org_memberships;
create policy mem_leave on public.org_memberships for delete
  using (user_id = auth.uid() or public.is_hub_admin(auth.uid()));

-- Mentorship profiles: owner + Hub.
drop policy if exists mp_rw on public.mentorship_profiles;
create policy mp_rw on public.mentorship_profiles for all
  using (user_id = auth.uid() or public.is_hub_admin(auth.uid()))
  with check (user_id = auth.uid() or public.is_hub_admin(auth.uid()));

-- Matches: participants read; Hub manages.
drop policy if exists match_read on public.mentorship_matches;
create policy match_read on public.mentorship_matches for select
  using (mentor_id = auth.uid() or mentee_id = auth.uid() or public.is_hub_admin(auth.uid()));
drop policy if exists match_write on public.mentorship_matches;
create policy match_write on public.mentorship_matches for all
  using (public.is_hub_admin(auth.uid())) with check (public.is_hub_admin(auth.uid()));

-- Posts: public sees approved; authors see + write their own as pending; Hub all.
drop policy if exists post_read on public.posts;
create policy post_read on public.posts for select
  using (status = 'approved' or author_id = auth.uid() or public.is_hub_admin(auth.uid()));
drop policy if exists post_insert on public.posts;
create policy post_insert on public.posts for insert to authenticated with check (
  author_id = auth.uid()
  and (public.is_hub_admin(auth.uid()) or status = 'pending')
);
drop policy if exists post_update on public.posts;
create policy post_update on public.posts for update using (
  (author_id = auth.uid() and status in ('draft','pending'))
  or public.is_hub_admin(auth.uid())
) with check (
  (author_id = auth.uid() and status in ('draft','pending'))
  or public.is_hub_admin(auth.uid())
);
drop policy if exists post_delete on public.posts;
create policy post_delete on public.posts for delete
  using (author_id = auth.uid() or public.is_hub_admin(auth.uid()));

-- Blogs: same shape as posts.
drop policy if exists blog_read on public.blogs;
create policy blog_read on public.blogs for select
  using (status = 'approved' or author_id = auth.uid() or public.is_hub_admin(auth.uid()));
drop policy if exists blog_insert on public.blogs;
create policy blog_insert on public.blogs for insert to authenticated with check (
  author_id = auth.uid()
  and (public.is_hub_admin(auth.uid()) or status = 'pending')
);
drop policy if exists blog_update on public.blogs;
create policy blog_update on public.blogs for update using (
  (author_id = auth.uid() and status in ('draft','pending'))
  or public.is_hub_admin(auth.uid())
) with check (
  (author_id = auth.uid() and status in ('draft','pending'))
  or public.is_hub_admin(auth.uid())
);
drop policy if exists blog_delete on public.blogs;
create policy blog_delete on public.blogs for delete
  using (author_id = auth.uid() or public.is_hub_admin(auth.uid()));

-- Reactions: read all; users manage their own.
drop policy if exists react_read on public.post_reactions;
create policy react_read on public.post_reactions for select using (true);
drop policy if exists react_write on public.post_reactions;
create policy react_write on public.post_reactions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Audit log: Hub reads + writes.
drop policy if exists audit_rw on public.content_audit_log;
create policy audit_rw on public.content_audit_log for all
  using (public.is_hub_admin(auth.uid())) with check (public.is_hub_admin(auth.uid()));

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Stats RPCs for the Hub dashboard                                      ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Submissions per day for the last N days (posts + blogs combined).
create or replace function public.hub_submissions_timeseries(days int default 30)
returns table(day date, posts bigint, blogs bigint)
language sql security definer set search_path = public as $$
  with span as (
    select generate_series((current_date - (days - 1)), current_date, interval '1 day')::date as day
  )
  select s.day,
         (select count(*) from public.posts p where p.created_at::date = s.day) as posts,
         (select count(*) from public.blogs b where b.created_at::date = s.day) as blogs
  from span s order by s.day;
$$;

-- Member joins per day for the last N days.
create or replace function public.hub_member_growth(days int default 30)
returns table(day date, joins bigint)
language sql security definer set search_path = public as $$
  with span as (
    select generate_series((current_date - (days - 1)), current_date, interval '1 day')::date as day
  )
  select s.day, (select count(*) from public.org_memberships m where m.created_at::date = s.day) as joins
  from span s order by s.day;
$$;

-- Headline counts.
create or replace function public.hub_overview()
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'members',        (select count(distinct user_id) from public.org_memberships),
    'organizations',  (select count(*) from public.organizations),
    'orgs_pending',   (select count(*) from public.organizations where verification_status = 'pending'),
    'posts_pending',  (select count(*) from public.posts where status = 'pending'),
    'blogs_pending',  (select count(*) from public.blogs where status = 'pending'),
    'posts_live',     (select count(*) from public.posts where status = 'approved'),
    'blogs_live',     (select count(*) from public.blogs where status = 'approved'),
    'counties_active',(select count(*) from public.county_networks where is_active)
  );
$$;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Seed: the eight county networks the Hub currently operates in         ║
-- ╚══════════════════════════════════════════════════════════════════════╝
insert into public.county_networks (name, slug, is_active) values
  ('Bomet','bomet',true),('Kisumu','kisumu',true),('Kitui','kitui',true),
  ('Marsabit','marsabit',true),('Meru','meru',true),('Mombasa','mombasa',true),
  ('Nairobi','nairobi',true),('Nakuru','nakuru',true)
on conflict (slug) do nothing;

-- Done. To make yourself a Hub super-admin, run (replacing the email):
--   update public.profiles set is_hub_admin = true
--   where id = (select id from auth.users where email = 'you@example.com');

-- END 001_hub_saas_schema.sql


-- --------------------------------------------------------------------------
-- BEGIN 004_fix_rls_recursion.sql
-- --------------------------------------------------------------------------

-- Fix: infinite recursion in the org_memberships SELECT policy.
-- Run this whole file in the Supabase SQL editor. Safe to run more than once.
--
-- The previous policy read org_memberships from inside a policy ON
-- org_memberships, which recurses. We move that lookup into a SECURITY DEFINER
-- function that bypasses RLS, so there is no recursion.

create or replace function public.my_org_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id from public.org_memberships where user_id = auth.uid();
$$;

drop policy if exists mem_read on public.org_memberships;

create policy mem_read on public.org_memberships
for select
using (
  user_id = auth.uid()
  or public.is_hub_admin(auth.uid())
  or organization_id in (select public.my_org_ids())
);

-- END 004_fix_rls_recursion.sql


-- --------------------------------------------------------------------------
-- BEGIN 006_dashboard_features.sql
-- --------------------------------------------------------------------------

-- Dashboard features: notifications, post media, blog format.
-- Run after 001. Safe to run more than once.

-- Posts can carry mixed media (images, documents, videos).
-- Shape: [{ "type": "image|video|document", "url": "...", "name": "..." }]
alter table public.posts
  add column if not exists media jsonb not null default '[]'::jsonb;

-- Blog body is rich HTML from the editor; excerpt is plain text for cards.
alter table public.blogs
  add column if not exists body_format text default 'html';

-- ââ Notifications ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
-- The reporting platform also creates this table, with `is_read` instead of
-- `read` and a report_id. Whichever migration runs first wins, so every column
-- is added defensively and 013 reconciles the two shapes. Without this the
-- whole file used to abort on a fresh project.
create table if not exists public.notifications (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null,            -- content_submitted | content_published | content_declined | membership
  title       text,
  body        text,
  link        text,
  content_type text,                    -- 'post' | 'blog' | 'organization'
  content_id  uuid,
  read        boolean default false,
  created_at  timestamptz default now()
);

alter table public.notifications
  add column if not exists title        text,
  add column if not exists body         text,
  add column if not exists link         text,
  add column if not exists content_type text,
  add column if not exists content_id   uuid,
  add column if not exists read         boolean default false;

create index if not exists notifications_user_idx on public.notifications(user_id, read);

alter table public.notifications enable row level security;

drop policy if exists notif_read on public.notifications;
create policy notif_read on public.notifications for select
  using (user_id = auth.uid());

drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Inserts are done server-side with the service role (bypasses RLS), so no
-- INSERT policy is needed for regular users.

-- ── Overview RPC extended (adds members list count already present) ─────────
create or replace function public.hub_overview()
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'members',        (select count(distinct user_id) from public.org_memberships),
    'onboarded',      (select count(*) from public.profiles where hub_onboarded),
    'organizations',  (select count(*) from public.organizations),
    'orgs_pending',   (select count(*) from public.organizations where verification_status = 'pending'),
    'posts_pending',  (select count(*) from public.posts where status = 'pending'),
    'blogs_pending',  (select count(*) from public.blogs where status = 'pending'),
    'posts_live',     (select count(*) from public.posts where status = 'approved'),
    'blogs_live',     (select count(*) from public.blogs where status = 'approved'),
    'posts_declined', (select count(*) from public.posts where status = 'rejected'),
    'blogs_declined', (select count(*) from public.blogs where status = 'rejected'),
    'counties_active',(select count(*) from public.county_networks where is_active),
    'reports_total',  (select count(*) from public.reports)
  );
$$;

-- END 006_dashboard_features.sql


-- --------------------------------------------------------------------------
-- BEGIN 007_storage.sql
-- --------------------------------------------------------------------------

-- Storage bucket for post/blog media (images, documents, videos).
-- Run in the Supabase SQL editor. Safe to run more than once.
--
-- Files are stored under a per-user folder: media/<auth.uid()>/<filename>.
-- Public read so the feed can display them; write/update/delete restricted to
-- the owner's own folder.

insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 52428800)  -- 50 MB per file
on conflict (id) do update set public = true, file_size_limit = 52428800;

-- Anyone can read media (needed to render images/videos publicly).
drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects
  for select using (bucket_id = 'media');

-- Authenticated users can upload into their own folder (first path segment = uid).
drop policy if exists "media owner insert" on storage.objects;
create policy "media owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owners can update/delete their own files.
drop policy if exists "media owner update" on storage.objects;
create policy "media owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "media owner delete" on storage.objects;
create policy "media owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- END 007_storage.sql


-- --------------------------------------------------------------------------
-- BEGIN 009_admin_hardening.sql
-- --------------------------------------------------------------------------

-- Admin hardening.
-- Plain ASCII only (no box-art) to avoid SQL editor parse errors.
--
-- Why: is_hub_admin() previously read profiles.user_type, a column that only
-- exists on the reporting platform's profile shape. Where it is missing, the
-- function errors, which in turn breaks any RLS policy that calls it (for
-- example an admin viewing pending or rejected posts and stories). The Hub owns
-- its own profiles.is_hub_admin boolean, so we rely on that alone.

create or replace function public.is_hub_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select is_hub_admin from public.profiles where id = uid),
    false
  );
$$;

-- Safe to run more than once.

-- END 009_admin_hardening.sql


-- --------------------------------------------------------------------------
-- BEGIN 010_blog_gallery.sql
-- --------------------------------------------------------------------------

-- Blog gallery: in-article images kept OUT of the story body.
-- Run AFTER 002_seed_blogs.sql. Safe to run more than once. Plain-ASCII only.
--
-- Why: image URLs should not live inside the story HTML. They are stored here as
-- a list and rendered on the blog after the text (see components/blog/blog-gallery).
-- The featured/cover image still lives on blogs.cover_image_url.

alter table public.blogs
  add column if not exists gallery jsonb not null default '[]'::jsonb;

-- Seed the extra in-article images captured from whrdhub.org.
-- Only International Women's Day 2025 has a photo beyond its cover.
update public.blogs
set gallery = '["https://whrdhub.org/wp-content/uploads/2025/03/IMG_0902-scaled.jpg"]'::jsonb
where slug = 'international-womens-day-2025';

-- END 010_blog_gallery.sql


-- --------------------------------------------------------------------------
-- BEGIN 011_resources.sql
-- --------------------------------------------------------------------------

-- Resources & newsletters: admin-managed documents for /resources and /newsletter.
-- Run in the Supabase SQL editor AFTER 001_hub_saas_schema.sql.
-- Plain ASCII only (no box-art) to avoid SQL editor parse errors.
-- Safe to run more than once.
--
-- Why: the Resources and Newsletter pages were hard-coded in lib/site-content.ts.
-- Hub admins can now add, edit, reorder, unpublish and delete items from
-- /hub/resources, exactly the way they manage stories. Tagging an item as a
-- newsletter moves it onto /newsletter; the featured one is the "latest edition".

create table if not exists public.resources (
  id              uuid default gen_random_uuid() primary key,
  title           text not null,
  slug            text unique,
  description     text,
  kind            text not null default 'Report',   -- Report | Research | Guide | Policy brief | Toolkit | Photo book | Statement | Newsletter | Other
  is_newsletter   boolean not null default false,   -- tag: show on /newsletter
  cover_image_url text,
  file_url        text not null,                    -- PDF (uploaded to the `media` bucket, or an external link)
  edition_label   text,                             -- newsletters: "January - June 2026"
  published_on    date,
  featured        boolean not null default false,   -- newsletters: the latest edition shown large
  published       boolean not null default true,    -- unpublish to hide without deleting
  sort_order      integer not null default 0,       -- lower shows first
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists resources_newsletter_idx on public.resources(is_newsletter, published);
create index if not exists resources_order_idx      on public.resources(sort_order, published_on desc);

-- Auto-slug + updated_at.
create or replace function public.resources_before_write()
returns trigger language plpgsql as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := public.slugify(new.title) || '-' || substr(new.id::text, 1, 6);
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_resources_before_write on public.resources;
create trigger trg_resources_before_write before insert or update on public.resources
  for each row execute function public.resources_before_write();

-- Row Level Security: the world reads what is published; only Hub admins write.
alter table public.resources enable row level security;

drop policy if exists res_read on public.resources;
create policy res_read on public.resources for select
  using (published = true or public.is_hub_admin(auth.uid()));

drop policy if exists res_write on public.resources;
create policy res_write on public.resources for all
  using (public.is_hub_admin(auth.uid()))
  with check (public.is_hub_admin(auth.uid()));

-- Seed with the documents that were previously hard-coded, so the public pages
-- look the same the moment this runs. Editing happens in /hub/resources after.
insert into public.resources (title, slug, kind, cover_image_url, file_url, sort_order, published_on) values
  ('Annual Report 2024', 'annual-report-2024', 'Report',
   'https://whrdhub.org/wp-content/uploads/2025/03/Annual-Report-2024_page-0001-212x300.jpg',
   'https://whrdhub.org/wp-content/uploads/dlm_uploads/2025/03/Annual-Report-2024.pdf', 10, '2025-03-01'),
  ('Rooted in Courage and Resilience', 'rooted-in-courage-and-resilience', 'Report',
   'https://whrdhub.org/wp-content/uploads/2025/03/Rooted-in-Courage-211x300.jpg',
   'https://whrdhub.org/wp-content/uploads/dlm_uploads/2025/03/Rooted-in-Courage-and-Resilience.pdf', 20, '2025-03-01'),
  ('Pillars of Transformation: The State of WHRDs in Kenya', 'pillars-of-transformation', 'Research',
   'https://whrdhub.org/wp-content/uploads/2025/12/Pillars-of-Transformation-The-State-of-Women-Human-Rights-Defenders-in-Kenya_page-0001-211x300.jpg',
   'https://whrdhub.org/wp-content/uploads/2026/01/Research-Report-of-the-Legal-2.pdf', 30, '2025-12-01'),
  ('Building Communities of Action Towards Ending GBV', 'building-communities-of-action', 'Report',
   'https://whrdhub.org/wp-content/uploads/2026/01/Building-Communities-of-Action-Towards-Ending-GBV-Cover-Page_page-0001-1-213x300.jpg',
   'https://whrdhub.org/wp-content/uploads/2026/01/Building-Communities-of-Action-Towards-Ending-GBV.pdf', 40, '2026-01-01'),
  ('Turning Barriers into Bridges: Access to Services for GBV Survivors', 'turning-barriers-into-bridges', 'Report',
   'https://whrdhub.org/wp-content/uploads/2026/01/Turning-Barriers-To-Bridges-Cover_page-0001-232x300.jpg',
   'https://whrdhub.org/wp-content/uploads/2026/02/Turning-Barriers-into-Bridges_-Enhancing-Access-to-Service-Delivery-for-GBV-Survivors-7.pdf', 50, '2026-02-01'),
  ('Safety and Security Training Guide', 'safety-and-security-training-guide', 'Guide',
   'https://whrdhub.org/wp-content/uploads/2026/01/Safeguarding-Holistic-Protection-Cover_page-0001-212x300.jpg',
   'https://whrdhub.org/wp-content/uploads/2026/01/we-lead-safety-and-security-tr-2.pdf', 60, '2026-01-01'),
  ('Policy Brief', 'policy-brief', 'Policy brief',
   'https://whrdhub.org/wp-content/uploads/2024/05/Policy-Pic-221x300.png',
   'https://whrdhub.org/wp-content/uploads/dlm_uploads/2024/05/POLICY-BRIEF.pdf', 70, '2024-05-01'),
  ('Photo Book 2024 to 2025', 'photo-book-2024-2025', 'Photo book',
   'https://whrdhub.org/wp-content/uploads/2026/01/2024-2025-PhotoBook-300x155.jpg',
   'https://whrdhub.org/wp-content/uploads/2026/02/Photo-Book-2.pdf', 80, '2026-01-01')
on conflict (slug) do nothing;

insert into public.resources (title, slug, kind, is_newsletter, featured, description, edition_label, cover_image_url, file_url, sort_order, published_on) values
  ('Pulse of Progress', 'pulse-of-progress', 'Newsletter', true, true,
   'The Hub''s bi-annual newsletter: stories, milestones, and updates from across the county networks.',
   'Latest edition',
   'https://whrdhub.org/wp-content/uploads/2026/02/1-212x300.png',
   'https://whrdhub.org/wp-content/uploads/2026/02/Pulse-of-Progress-Bi-annual-Newsletter.pdf', 10, '2026-02-01')
on conflict (slug) do nothing;

-- END 011_resources.sql


-- --------------------------------------------------------------------------
-- BEGIN 012_publications_bucket.sql
-- --------------------------------------------------------------------------

-- Storage bucket for publications: the PDFs, reports, guides, photo books and
-- newsletters shown on /resources and /newsletter, plus their cover images.
-- Run in the Supabase SQL editor AFTER 011_resources.sql.
-- Plain ASCII only (no box-art) to avoid SQL editor parse errors.
-- Safe to run more than once.
--
-- Why a separate bucket from `media`: member post attachments and the Hub's
-- published documents have different lifecycles and different write rules. Only
-- Hub admins may put files here, and files are laid out by purpose
-- (documents/... and covers/...) rather than per-user, so a document survives
-- the admin who uploaded it leaving the team.

-- No allowed_mime_types restriction on purpose: browsers report an empty or
-- generic content type for some files (notably PDFs picked on Windows), and a
-- MIME allow-list rejects those uploads with an error that is hard to read.
-- The admin form restricts what can be chosen; storage stays permissive.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('publications', 'publications', true, 104857600, null)  -- 100 MB per file
on conflict (id) do update
  set public = true,
      file_size_limit = 104857600,
      allowed_mime_types = null;

-- Anyone can read: the Resources and Newsletter pages are public.
drop policy if exists "publications public read" on storage.objects;
create policy "publications public read" on storage.objects
  for select using (bucket_id = 'publications');

-- Only Hub admins may add, replace, or remove publications.
drop policy if exists "publications admin insert" on storage.objects;
create policy "publications admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'publications' and public.is_hub_admin(auth.uid()));

drop policy if exists "publications admin update" on storage.objects;
create policy "publications admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'publications' and public.is_hub_admin(auth.uid()))
  with check (bucket_id = 'publications' and public.is_hub_admin(auth.uid()));

drop policy if exists "publications admin delete" on storage.objects;
create policy "publications admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'publications' and public.is_hub_admin(auth.uid()));

-- Track where a file came from, so the backfill can tell a mirrored copy from
-- one that was uploaded directly, and so the original link is never lost.
alter table public.resources
  add column if not exists source_url text;

-- END 012_publications_bucket.sql


-- --------------------------------------------------------------------------
-- BEGIN 013_merge_reporting_platform.sql
-- --------------------------------------------------------------------------

-- ============================================================================
--  WHRD Hub - merge of the reporting platform into the SaaS platform
--  Migration 013. Run once in the Supabase SQL editor. Safe to re-run.
--
--  Both apps already shared this database, but each was written as though it
--  owned it. This migration reconciles the three places where that shows:
--
--    1. Roles      - two independent notions of "admin" (reporting
--                    profiles.user_type vs Hub profiles.is_hub_admin).
--    2. RLS        - reporting policies only recognised user_type, so a Hub
--                    admin could open the reporting console but see no rows.
--    3. notifications - both apps ran `create table if not exists
--                    public.notifications` with different columns. Whichever
--                    ran first won, so this file makes the table satisfy both
--                    shapes regardless of which that was.
--
--  Nothing here drops a column or deletes a row.
-- ============================================================================


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  0. Make sure both profile shapes exist on the one profiles table       ║
-- ╚════════════════════════════════════════════════════════════════════════╝

alter table public.profiles
  add column if not exists is_hub_admin         boolean default false,
  add column if not exists hub_onboarded        boolean default false,
  add column if not exists full_name            text,
  add column if not exists is_anonymous         boolean default false,
  add column if not exists onboarding_completed boolean default false,
  add column if not exists preferred_language   text default 'en';

-- user_type may be missing if the Hub schema was applied to a fresh project.
do $$
begin
  create type public.user_type_enum as enum ('reporter','defender','admin');
exception when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists user_type public.user_type_enum default 'reporter';


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  1. One definition of "may act on reports"                              ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- These mirror lib/reporting-access.ts exactly. SECURITY DEFINER so they can
-- be called from policies on profiles without recursing.

create or replace function public.is_hub_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_hub_admin or user_type::text = 'admin' from public.profiles where id = uid),
    false
  );
$$;

-- Full reporting administrator: verify, assign services, manage the directory.
create or replace function public.can_administer_reports(uid uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select coalesce(is_hub_admin, false) or user_type::text = 'admin'
       from public.profiles where id = uid),
    false
  );
$$;

-- Anyone who may open a case: administrators plus reporting defenders.
create or replace function public.can_triage_reports(uid uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select coalesce(is_hub_admin, false) or user_type::text in ('admin','defender')
       from public.profiles where id = uid),
    false
  );
$$;

-- Kept for the reporting platform's own older policies.
create or replace function public.get_my_user_type()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select user_type::text from public.profiles where id = auth.uid();
$$;

grant execute on function public.is_hub_admin(uuid)            to authenticated, anon;
grant execute on function public.can_administer_reports(uuid)  to authenticated, anon;
grant execute on function public.can_triage_reports(uuid)      to authenticated, anon;
grant execute on function public.get_my_user_type()            to authenticated, anon;


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  2. Reporting RLS, rewritten against the shared role functions          ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- Before this, a Hub admin whose user_type was still 'reporter' saw an empty
-- reporting console: the UI let them in, RLS returned nothing.

alter table public.reports          enable row level security;
alter table public.report_services  enable row level security;
alter table public.report_audit_log enable row level security;
alter table public.services         enable row level security;

-- Both the old names and the ones this file creates, so re-running is safe.
do $$ begin
  drop policy if exists "defenders_see_all"                on public.reports;
  drop policy if exists "defenders_update_reports"         on public.reports;
  drop policy if exists "responders_see_all_reports"       on public.reports;
  drop policy if exists "responders_update_reports"        on public.reports;
  drop policy if exists "defenders_audit_log"              on public.report_audit_log;
  drop policy if exists "responders_audit_log"             on public.report_audit_log;
  drop policy if exists "defenders_manage_services"        on public.services;
  drop policy if exists "admins_manage_services"           on public.services;
  drop policy if exists "defenders_manage_report_services" on public.report_services;
  drop policy if exists "responders_manage_report_services" on public.report_services;
  drop policy if exists "admins_read_all_profiles"         on public.profiles;
  drop policy if exists "responders_read_all_profiles"     on public.profiles;
  drop policy if exists "admins_update_all_profiles"       on public.profiles;
exception when others then null;
end $$;

-- Reports: the reporter sees their own (policy unchanged, from 001); the
-- response team sees everything.
create policy "responders_see_all_reports" on public.reports
  for select using (public.can_triage_reports());

create policy "responders_update_reports" on public.reports
  for update using (public.can_triage_reports());

-- Audit log
create policy "responders_audit_log" on public.report_audit_log
  for all using (public.can_triage_reports())
  with check (public.can_triage_reports());

-- Service directory: administrators only (defenders read the active rows via
-- the existing public_read_services policy).
create policy "admins_manage_services" on public.services
  for all using (public.can_administer_reports())
  with check (public.can_administer_reports());

-- Referrals
create policy "responders_manage_report_services" on public.report_services
  for all using (public.can_triage_reports())
  with check (public.can_triage_reports());

-- Profiles: the response team needs to resolve reporter names in the console.
create policy "responders_read_all_profiles" on public.profiles
  for select using (public.can_triage_reports());

create policy "admins_update_all_profiles" on public.profiles
  for update using (public.can_administer_reports());

-- Online listening follows the same rule.
do $$ begin
  drop policy if exists "admins_manage_keywords" on public.listening_keywords;
  drop policy if exists "admins_manage_results"  on public.listening_results;
exception when others then null;
end $$;

do $$ begin
  execute 'create policy "admins_manage_keywords" on public.listening_keywords for all
             using (public.can_administer_reports()) with check (public.can_administer_reports())';
  execute 'create policy "admins_manage_results" on public.listening_results for all
             using (public.can_administer_reports()) with check (public.can_administer_reports())';
exception when undefined_table then
  raise notice 'listening tables not present; skipping their policies';
end $$;

-- USSD sessions
do $$ begin
  drop policy if exists "admins_ussd" on public.ussd_sessions;
  execute 'create policy "admins_ussd" on public.ussd_sessions for all
             using (public.can_administer_reports()) with check (public.can_administer_reports())';
exception when undefined_table then
  raise notice 'ussd_sessions not present; skipping';
end $$;


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  3. notifications: one table that satisfies both apps                   ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- The Hub writes `read`, `title`, `body`, `link`, `content_type`, `content_id`.
-- The reporting triggers write `is_read`, `report_id`, `service_name`.
-- Add every column as nullable, then keep the two read flags in step so the
-- merged UI can settle on `read`.

create table if not exists public.notifications (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null default 'notice',
  created_at timestamptz default now()
);

alter table public.notifications
  add column if not exists title        text,
  add column if not exists body         text,
  add column if not exists link         text,
  add column if not exists content_type text,
  add column if not exists content_id   uuid,
  add column if not exists read         boolean default false,
  add column if not exists is_read      boolean default false,
  add column if not exists report_id    uuid,
  add column if not exists service_name text;

-- `title` was NOT NULL in the Hub schema, which would reject the reporting
-- triggers' inserts. Relax it and backfill instead.
do $$ begin
  alter table public.notifications alter column title drop not null;
exception when others then null;
end $$;

do $$ begin
  alter table public.notifications
    add constraint notifications_report_id_fkey
    foreign key (report_id) references public.reports(id) on delete cascade;
exception when duplicate_object then null;
     when others then null;
end $$;

-- Bring existing rows into line before the trigger starts enforcing it.
update public.notifications set read    = coalesce(read, is_read, false)    where read    is distinct from coalesce(read, is_read, false);
update public.notifications set is_read = coalesce(is_read, read, false)    where is_read is distinct from coalesce(is_read, read, false);

create or replace function public.sync_notification_read_flags()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    -- Whichever flag the writer set wins; the other follows.
    new.read    := coalesce(new.read, new.is_read, false);
    new.is_read := coalesce(new.is_read, new.read, false);
    if new.read <> new.is_read then
      new.is_read := new.read;
    end if;
  else
    if new.read is distinct from old.read then
      new.is_read := new.read;
    elsif new.is_read is distinct from old.is_read then
      new.read := new.is_read;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_notification_read on public.notifications;
create trigger trg_sync_notification_read
  before insert or update on public.notifications
  for each row execute function public.sync_notification_read_flags();

-- Give report notifications a title/link so they render in the Hub's
-- notifications view alongside community ones.
create or replace function public.fill_report_notification_copy()
returns trigger
language plpgsql
as $$
begin
  if new.report_id is not null then
    if new.title is null then
      new.title := coalesce(
        case when new.type = 'service_assigned'
             then 'Support assigned to your report' end,
        'Update on your report');
    end if;
    if new.body is null and new.service_name is not null then
      new.body := new.service_name || ' has been assigned to support you.';
    end if;
    if new.link is null then
      new.link := '/dashboard/reports/' || new.report_id::text;
    end if;
    if new.content_type is null then
      new.content_type := 'report';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fill_report_notification on public.notifications;
create trigger trg_fill_report_notification
  before insert on public.notifications
  for each row execute function public.fill_report_notification_copy();

-- Backfill copy for report notifications created before this migration.
update public.notifications
   set title = coalesce(title, 'Update on your report'),
       body  = coalesce(body, case when service_name is not null
                                   then service_name || ' has been assigned to support you.' end),
       link  = coalesce(link, '/dashboard/reports/' || report_id::text),
       content_type = coalesce(content_type, 'report')
 where report_id is not null;

alter table public.notifications enable row level security;

do $$ begin
  drop policy if exists notif_read on public.notifications;
  drop policy if exists notif_update on public.notifications;
  drop policy if exists "Users can view own notifications" on public.notifications;
  drop policy if exists "Users can update own notifications" on public.notifications;
exception when others then null;
end $$;

create policy notif_read on public.notifications
  for select using (user_id = auth.uid());

create policy notif_update on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists notifications_user_read_idx on public.notifications (user_id, read, created_at desc);


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  4. Hub overview counters extended with reporting figures               ║
-- ╚════════════════════════════════════════════════════════════════════════╝

create or replace function public.hub_overview()
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'members',         (select count(distinct user_id) from public.org_memberships),
    'onboarded',       (select count(*) from public.profiles where hub_onboarded),
    'organizations',   (select count(*) from public.organizations),
    'orgs_pending',    (select count(*) from public.organizations where verification_status = 'pending'),
    'posts_pending',   (select count(*) from public.posts where status = 'pending'),
    'blogs_pending',   (select count(*) from public.blogs where status = 'pending'),
    'posts_live',      (select count(*) from public.posts where status = 'approved'),
    'blogs_live',      (select count(*) from public.blogs where status = 'approved'),
    'posts_declined',  (select count(*) from public.posts where status = 'rejected'),
    'blogs_declined',  (select count(*) from public.blogs where status = 'rejected'),
    'counties_active', (select count(*) from public.county_networks where is_active),
    'reports_total',   (select count(*) from public.reports),
    'reports_pending', (select count(*) from public.reports where verification_status = 'pending'),
    'reports_urgent',  (select count(*) from public.reports
                         where urgency = 'immediate' and status in ('submitted','under_review')),
    'reports_verified',(select count(*) from public.reports where verification_status = 'verified')
  );
$$;


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  5. Existing Hub admins keep reporting access                           ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- Role stays expressed as is_hub_admin; the functions above already treat that
-- as reporting-admin. This only fixes the reverse case: reporting admins who
-- pre-date the Hub should be able to reach the Hub console too.

update public.profiles
   set is_hub_admin = true
 where user_type::text = 'admin'
   and coalesce(is_hub_admin, false) = false;

-- Staff accounts should not be sent through member onboarding.
update public.profiles
   set hub_onboarded = true
 where (coalesce(is_hub_admin, false) or user_type::text in ('admin','defender'))
   and coalesce(hub_onboarded, false) = false;

-- END 013_merge_reporting_platform.sql


-- --------------------------------------------------------------------------
-- BEGIN 014_community_lifecycle.sql
-- --------------------------------------------------------------------------

-- ============================================================================
--  WHRD Hub - community lifecycle
--  Migration 014. Run after 013. Idempotent; run as many times as you like.
--
--  Adds the things the merged product needs and did not have:
--
--    1. Soft delete on every kind of content. A member deleting their own post
--       marks it deleted and it disappears from their view and the feed, but a
--       Hub admin can still read it in full. Hub admins alone can purge.
--    2. Comments on feed posts, with the same soft-delete rule.
--    3. Membership verification. Joining a CBO is now a request that the
--       organisation's own admins (or the Hub) approve or decline.
--    4. Account deletion. The account disappears for the person, their content
--       leaves the public surfaces, and the Hub can still see both.
--    5. Anonymous reporters claiming a full account.
--
--  Nothing is destructive. No column or row is dropped.
-- ============================================================================


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  1. Soft delete columns                                                 ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- deleted_at is the single source of truth. `status` keeps its original value
-- so a restored item goes back to exactly where it was in the review flow.

do $$
declare t text;
begin
  foreach t in array array['posts','blogs','reports','resources'] loop
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = t) then
      execute format($f$
        alter table public.%I
          add column if not exists deleted_at     timestamptz,
          add column if not exists deleted_by     uuid references auth.users(id) on delete set null,
          add column if not exists deleted_reason text
      $f$, t);
      execute format(
        'create index if not exists %I on public.%I (deleted_at) where deleted_at is not null',
        t || '_deleted_idx', t);
    end if;
  end loop;
end $$;


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  2. Comments on feed posts                                              ║
-- ╚════════════════════════════════════════════════════════════════════════╝

create table if not exists public.post_comments (
  id             uuid default gen_random_uuid() primary key,
  post_id        uuid not null references public.posts(id) on delete cascade,
  author_id      uuid references auth.users(id) on delete set null,
  parent_id      uuid references public.post_comments(id) on delete cascade,
  body           text not null,
  deleted_at     timestamptz,
  deleted_by     uuid references auth.users(id) on delete set null,
  deleted_reason text,
  created_at     timestamptz default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);
create index if not exists post_comments_author_idx on public.post_comments (author_id);

-- Seeded/demo comments have no account behind them, so they carry a display
-- name directly, the same way seeded posts do.
alter table public.post_comments
  add column if not exists guest_name  text,
  add column if not exists guest_title text;


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  3. Membership verification                                             ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- Anyone can ask to join a CBO — including someone whose account started life
-- on the reporting side. The organisation's admins decide.

do $$ begin
  create type public.membership_state as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

alter table public.org_memberships
  add column if not exists status         public.membership_state default 'approved',
  add column if not exists requested_at   timestamptz default now(),
  add column if not exists decided_at     timestamptz,
  add column if not exists decided_by     uuid references auth.users(id) on delete set null,
  add column if not exists decision_notes text,
  add column if not exists request_note   text;

-- Everyone who was already a member stays one.
update public.org_memberships set status = 'approved' where status is null;

create index if not exists org_memberships_status_idx
  on public.org_memberships (organization_id, status);

-- Is the caller an approved admin of this organisation? SECURITY DEFINER so it
-- can be used in a policy on org_memberships without recursing.
create or replace function public.is_org_admin(org uuid, uid uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.org_memberships m
     where m.organization_id = org
       and m.user_id = uid
       and m.role = 'org_admin'
       and m.status = 'approved'
  );
$$;

-- Organisations the caller administers, for policies that need a set.
create or replace function public.my_admin_org_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id from public.org_memberships
   where user_id = auth.uid() and role = 'org_admin' and status = 'approved';
$$;

grant execute on function public.is_org_admin(uuid, uuid) to authenticated, anon;
grant execute on function public.my_admin_org_ids()       to authenticated, anon;


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  4. Account deletion and anonymous-account claiming                     ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- The auth.users row is deliberately kept: the Hub must still be able to read
-- a deleted account and everything in it. `account_deleted_at` is what every
-- surface checks.

alter table public.profiles
  add column if not exists account_deleted_at     timestamptz,
  add column if not exists account_deleted_reason text,
  -- When an anonymous reporter upgraded to a real, addressable account.
  add column if not exists claimed_at             timestamptz;

create index if not exists profiles_deleted_idx
  on public.profiles (account_deleted_at) where account_deleted_at is not null;

/**
 * Delete an account. Runs as the owner or a Hub admin.
 *
 * Everything the person wrote is soft-deleted so it leaves the public surfaces
 * immediately, and the profile is marked deleted. Reports are deliberately NOT
 * touched: a case the response team is working belongs to the response, not to
 * the account, and the Hub decides its fate separately.
 */
create or replace function public.delete_account(target uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Not signed in';
  end if;
  if caller <> target and not public.is_hub_admin(caller) then
    raise exception 'You can only delete your own account';
  end if;

  update public.profiles
     set account_deleted_at = coalesce(account_deleted_at, now()),
         account_deleted_reason = coalesce(reason, account_deleted_reason)
   where id = target;

  update public.posts
     set deleted_at = coalesce(deleted_at, now()),
         deleted_by = caller,
         deleted_reason = coalesce(deleted_reason, 'Account deleted')
   where author_id = target and deleted_at is null;

  update public.blogs
     set deleted_at = coalesce(deleted_at, now()),
         deleted_by = caller,
         deleted_reason = coalesce(deleted_reason, 'Account deleted')
   where author_id = target and deleted_at is null;

  update public.post_comments
     set deleted_at = coalesce(deleted_at, now()),
         deleted_by = caller,
         deleted_reason = coalesce(deleted_reason, 'Account deleted')
   where author_id = target and deleted_at is null;

  -- Drop them out of their organisations so member lists stay clean.
  update public.org_memberships
     set status = 'rejected',
         decided_at = now(),
         decided_by = caller,
         decision_notes = 'Account deleted'
   where user_id = target and status <> 'rejected';
end;
$$;

/** Hub admins can bring an account back. */
create or replace function public.restore_account(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_hub_admin(auth.uid()) then
    raise exception 'Only the Hub can restore an account';
  end if;
  update public.profiles
     set account_deleted_at = null, account_deleted_reason = null
   where id = target;
end;
$$;

grant execute on function public.delete_account(uuid, text) to authenticated;
grant execute on function public.restore_account(uuid)      to authenticated;


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  5. Row Level Security                                                  ║
-- ╚════════════════════════════════════════════════════════════════════════╝

alter table public.post_comments enable row level security;

-- ── Posts ────────────────────────────────────────────────────────────────
-- Deleted posts leave the public feed but stay visible to their author, marked
-- as deleted, and to the Hub in full.
--
-- The author MUST keep read access to their own deleted rows. PostgreSQL
-- applies SELECT policies to the new row of an UPDATE, so a policy that hid
-- deleted rows from the author would make it impossible for the author to
-- delete anything: the write that sets deleted_at would move the row out of
-- their own visibility and be rejected.
drop policy if exists post_read   on public.posts;
drop policy if exists post_update on public.posts;
drop policy if exists post_delete on public.posts;

create policy post_read on public.posts for select using (
  public.is_hub_admin(auth.uid())
  or author_id = auth.uid()
  or (deleted_at is null and status = 'approved')
);

-- An author may edit a draft or pending post, and may soft-delete at any
-- status (the deleted_at write is an UPDATE, not a DELETE).
create policy post_update on public.posts for update using (
  author_id = auth.uid() or public.is_hub_admin(auth.uid())
) with check (
  author_id = auth.uid() or public.is_hub_admin(auth.uid())
);

-- Permanent removal is the Hub's alone.
create policy post_delete on public.posts for delete
  using (public.is_hub_admin(auth.uid()));

-- ── Blogs ────────────────────────────────────────────────────────────────
drop policy if exists blog_read   on public.blogs;
drop policy if exists blog_update on public.blogs;
drop policy if exists blog_delete on public.blogs;

create policy blog_read on public.blogs for select using (
  public.is_hub_admin(auth.uid())
  or author_id = auth.uid()
  or (deleted_at is null and status = 'approved')
);
create policy blog_update on public.blogs for update using (
  author_id = auth.uid() or public.is_hub_admin(auth.uid())
) with check (
  author_id = auth.uid() or public.is_hub_admin(auth.uid())
);
create policy blog_delete on public.blogs for delete
  using (public.is_hub_admin(auth.uid()));

-- ── Comments ─────────────────────────────────────────────────────────────
drop policy if exists comment_read   on public.post_comments;
drop policy if exists comment_insert on public.post_comments;
drop policy if exists comment_update on public.post_comments;
drop policy if exists comment_delete on public.post_comments;

create policy comment_read on public.post_comments for select using (
  public.is_hub_admin(auth.uid())
  or author_id = auth.uid()
  or (deleted_at is null and exists (
        select 1 from public.posts p
         where p.id = post_id and p.deleted_at is null and p.status = 'approved'))
);
create policy comment_insert on public.post_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.posts p
                 where p.id = post_id and p.deleted_at is null and p.status = 'approved')
  );
-- Authors soft-delete their own; the Hub can act on any.
create policy comment_update on public.post_comments for update using (
  author_id = auth.uid() or public.is_hub_admin(auth.uid())
) with check (
  author_id = auth.uid() or public.is_hub_admin(auth.uid())
);
create policy comment_delete on public.post_comments for delete
  using (public.is_hub_admin(auth.uid()));

-- ── Reports ──────────────────────────────────────────────────────────────
-- Soft-deleted reports leave the reporter's view and the triage list, and stay
-- readable by Hub administrators.
drop policy if exists "reporters_own_reports"      on public.reports;
drop policy if exists "responders_see_all_reports" on public.reports;
drop policy if exists "responders_update_reports"  on public.reports;
drop policy if exists "reports_delete"             on public.reports;

create policy "reporters_own_reports" on public.reports for select
  using (auth.uid() = user_id and deleted_at is null);

create policy "responders_see_all_reports" on public.reports for select using (
  public.can_administer_reports()
  or (public.can_triage_reports() and deleted_at is null)
);

create policy "responders_update_reports" on public.reports for update
  using (public.can_triage_reports()) with check (public.can_triage_reports());

create policy "reports_delete" on public.reports for delete
  using (public.can_administer_reports());

-- ── Memberships ──────────────────────────────────────────────────────────
-- Read your own; org admins and fellow approved members read the org's;
-- the Hub reads everything.
drop policy if exists mem_read   on public.org_memberships;
drop policy if exists mem_join   on public.org_memberships;
drop policy if exists mem_leave  on public.org_memberships;
drop policy if exists mem_decide on public.org_memberships;

create policy mem_read on public.org_memberships for select using (
  user_id = auth.uid()
  or public.is_hub_admin(auth.uid())
  or organization_id in (select public.my_admin_org_ids())
  or (status = 'approved' and organization_id in (select public.my_org_ids()))
);

-- You may only ever request membership for yourself, and never self-approve.
create policy mem_join on public.org_memberships for insert to authenticated
  with check (
    user_id = auth.uid()
    and (status = 'pending' or public.is_hub_admin(auth.uid()))
  );

-- Decisions belong to the organisation's admins, or the Hub.
create policy mem_decide on public.org_memberships for update using (
  public.is_hub_admin(auth.uid())
  or organization_id in (select public.my_admin_org_ids())
) with check (
  public.is_hub_admin(auth.uid())
  or organization_id in (select public.my_admin_org_ids())
);

create policy mem_leave on public.org_memberships for delete using (
  user_id = auth.uid()
  or public.is_hub_admin(auth.uid())
  or organization_id in (select public.my_admin_org_ids())
);

-- ── Profiles ─────────────────────────────────────────────────────────────
-- A deleted account is invisible to everyone but the Hub. `users_own_profile`
-- from the reporting schema still lets the owner read their own row, which is
-- what the sign-out-on-deleted check needs.
drop policy if exists "responders_read_all_profiles" on public.profiles;
create policy "responders_read_all_profiles" on public.profiles for select using (
  public.is_hub_admin(auth.uid())
  or (public.can_triage_reports() and account_deleted_at is null)
);

drop policy if exists profiles_public_read on public.profiles;
create policy profiles_public_read on public.profiles for select
  using (account_deleted_at is null);


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  6. Keep membership and profile state consistent                        ║
-- ╚════════════════════════════════════════════════════════════════════════╝

-- Stamp the decision time whenever a membership is approved or declined.
create or replace function public.membership_before_write()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'UPDATE' and new.status is distinct from old.status
     and new.status in ('approved','rejected') then
    new.decided_at := coalesce(new.decided_at, now());
    new.decided_by := coalesce(new.decided_by, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists trg_membership_before_write on public.org_memberships;
create trigger trg_membership_before_write
  before insert or update on public.org_memberships
  for each row execute function public.membership_before_write();

-- Stamp deleted_by when a row is soft-deleted and the caller did not set it.
create or replace function public.stamp_soft_delete()
returns trigger language plpgsql as $$
begin
  if new.deleted_at is not null and (old.deleted_at is null) then
    new.deleted_by := coalesce(new.deleted_by, auth.uid());
  end if;
  if new.deleted_at is null then
    new.deleted_by := null;
    new.deleted_reason := null;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['posts','blogs','reports','post_comments'] loop
    execute format('drop trigger if exists trg_stamp_soft_delete on public.%I', t);
    execute format(
      'create trigger trg_stamp_soft_delete before update on public.%I
         for each row execute function public.stamp_soft_delete()', t);
  end loop;
end $$;


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  7. Counters                                                            ║
-- ╚════════════════════════════════════════════════════════════════════════╝

create or replace function public.hub_overview()
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'members',          (select count(distinct user_id) from public.org_memberships where status = 'approved'),
    'members_pending',  (select count(*) from public.org_memberships where status = 'pending'),
    'onboarded',        (select count(*) from public.profiles where hub_onboarded and account_deleted_at is null),
    'accounts_deleted', (select count(*) from public.profiles where account_deleted_at is not null),
    'organizations',    (select count(*) from public.organizations),
    'orgs_pending',     (select count(*) from public.organizations where verification_status = 'pending'),
    'posts_pending',    (select count(*) from public.posts where status = 'pending' and deleted_at is null),
    'blogs_pending',    (select count(*) from public.blogs where status = 'pending' and deleted_at is null),
    'posts_live',       (select count(*) from public.posts where status = 'approved' and deleted_at is null),
    'blogs_live',       (select count(*) from public.blogs where status = 'approved' and deleted_at is null),
    'posts_declined',   (select count(*) from public.posts where status = 'rejected' and deleted_at is null),
    'blogs_declined',   (select count(*) from public.blogs where status = 'rejected' and deleted_at is null),
    'posts_deleted',    (select count(*) from public.posts where deleted_at is not null),
    'blogs_deleted',    (select count(*) from public.blogs where deleted_at is not null),
    'comments_deleted', (select count(*) from public.post_comments where deleted_at is not null),
    'counties_active',  (select count(*) from public.county_networks where is_active),
    'reports_total',    (select count(*) from public.reports where deleted_at is null),
    'reports_pending',  (select count(*) from public.reports where verification_status = 'pending' and deleted_at is null),
    'reports_urgent',   (select count(*) from public.reports
                          where urgency = 'immediate' and status in ('submitted','under_review')
                            and deleted_at is null),
    'reports_verified', (select count(*) from public.reports where verification_status = 'verified' and deleted_at is null),
    'reports_deleted',  (select count(*) from public.reports where deleted_at is not null)
  );
$$;

-- Submission and growth series should ignore deleted rows.
create or replace function public.hub_submissions_timeseries(days int default 30)
returns table(day date, posts bigint, blogs bigint)
language sql security definer set search_path = public as $$
  with span as (
    select generate_series((current_date - (days - 1)), current_date, interval '1 day')::date as day
  )
  select s.day,
         (select count(*) from public.posts p where p.created_at::date = s.day and p.deleted_at is null),
         (select count(*) from public.blogs b where b.created_at::date = s.day and b.deleted_at is null)
  from span s order by s.day;
$$;

create or replace function public.hub_member_growth(days int default 30)
returns table(day date, joins bigint)
language sql security definer set search_path = public as $$
  with span as (
    select generate_series((current_date - (days - 1)), current_date, interval '1 day')::date as day
  )
  select s.day, (select count(*) from public.org_memberships m
                  where m.created_at::date = s.day and m.status = 'approved')
  from span s order by s.day;
$$;


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  8. Grants                                                              ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- A hosted Supabase project grants these automatically through default
-- privileges, so this is a no-op there. It is stated explicitly so the schema
-- also stands up on a plain Postgres (local development, CI, self-hosting).

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;
grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  9. Storage: evidence follows the same role rule as the reports         ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- The report-screenshots policy still tested profiles.user_type directly, so a
-- Hub admin could open a case in the console and not be able to view its
-- evidence. Route it through the shared role function like everything else.

do $$ begin
  drop policy if exists "screenshots_defenders_read" on storage.objects;
  drop policy if exists "screenshots_responders_read" on storage.objects;
  execute $p$
    create policy "screenshots_responders_read" on storage.objects
      for select using (bucket_id = 'report-screenshots' and public.can_triage_reports())
  $p$;
exception when undefined_table then
  raise notice 'storage.objects not present; skipping';
end $$;


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  10. Referral matching                                                  ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- Verifying a report auto-assigns support services. The original rule matched
-- on category alone, so a reporter in Kitui asking for shelter could be handed
-- a shelter in Nakuru while a Kitui one sat unused.
--
-- The rule now is, for each kind of support the reporter asked for:
--
--   * every service in their own county, and every service that operates
--     nationally. Both are genuinely useful to a survivor - the local desk is
--     reachable, the national body has reach - so neither is withheld.
--   * services belonging to OTHER counties are excluded, unless that category
--     has no local and no national service at all, in which case the nearest
--     available one is assigned rather than answering the request with nothing.
--
-- Each referral carries a note saying which of those three it was, so the
-- response team can see at a glance why a service was suggested.

create or replace function public.handle_report_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.verification_status = 'verified'
     and (OLD.verification_status is distinct from 'verified') then

    insert into public.report_services (report_id, service_id, assigned_by, note)
    select NEW.id, m.id, NEW.verified_by, m.note
    from (
      select distinct on (s.category, s.id)
             s.id,
             s.category,
             case
               when NEW.county is not null and s.county = NEW.county
                 then 'Matched: ' || s.category::text || ' support in ' || NEW.county
               when s.county is null
                 then 'Matched: national ' || s.category::text || ' support'
               else 'Matched: nearest available ' || s.category::text || ' support'
             end as note,
             case
               when NEW.county is not null and s.county = NEW.county then 1
               when s.county is null then 2
               else 3
             end as rank
      from public.services s
      where s.is_active
        and s.category::text = any(coalesce(NEW.support_needed, '{}'))
        -- Only fall past the local and national tiers when neither exists for
        -- this category, rather than adding every county's service.
        and (
          (NEW.county is not null and s.county = NEW.county)
          or s.county is null
          or not exists (
            select 1 from public.services s2
             where s2.is_active
               and s2.category = s.category
               and (s2.county = NEW.county or s2.county is null)
          )
        )
      order by s.category, s.id, rank
    ) m
    on conflict (report_id, service_id) do nothing;

  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_report_verified on public.reports;
create trigger trg_report_verified
  after update on public.reports
  for each row
  execute function public.handle_report_verified();

-- END 014_community_lifecycle.sql
