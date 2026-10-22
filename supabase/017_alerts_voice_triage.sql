-- Urgent-case alerts, voice notes and AI triage of online listening.
-- Idempotent. Run once in the Supabase SQL editor (also safe to re-run).

-- ── Web push subscriptions (one row per device) ───────────────────────────
create table if not exists public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamp with time zone DEFAULT now(),
  primary key (id),
  unique (endpoint)
);

do $$ begin
  alter table public.push_subscriptions add constraint push_subscriptions_user_id_fkey
    foreign key (user_id) references auth.users(id) ON DELETE CASCADE;
exception when duplicate_object then null; when others then null; end $$;

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists push_subs_own on public.push_subscriptions;
create policy push_subs_own on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Alert tracking on reports ─────────────────────────────────────────────
alter table public.reports
  add column if not exists alert_severity text,
  add column if not exists escalation_level integer DEFAULT 0,
  add column if not exists escalated_at timestamp with time zone,
  add column if not exists acknowledged_at timestamp with time zone,
  add column if not exists acknowledged_by uuid,
  add column if not exists voice_note_paths text[];

do $$ begin
  alter table public.reports add constraint reports_acknowledged_by_fkey
    foreign key (acknowledged_by) references auth.users(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

-- The cron job looks for critical, unacknowledged reports.
create index if not exists reports_unacked_critical_idx
  on public.reports (created_at)
  where alert_severity = 'critical' and acknowledged_at is null;

-- ── AI triage of online listening ─────────────────────────────────────────
alter table public.listening_results
  add column if not exists ai_class text,
  add column if not exists ai_confidence real;

-- ── "Referral" is not a service category people offer ─────────────────────
update public.services set category = 'other' where category::text = 'referral';
