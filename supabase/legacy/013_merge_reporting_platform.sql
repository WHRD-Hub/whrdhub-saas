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
