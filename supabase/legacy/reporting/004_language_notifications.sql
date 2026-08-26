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
