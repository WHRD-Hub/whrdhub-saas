-- Hashtags the team was asked about and said no to, so online listening does
-- not suggest them again. Idempotent. Run once in the Supabase SQL editor.

create table if not exists public.listening_tag_declines (
  tag text primary key,
  declined_by uuid,
  declined_at timestamptz not null default now()
);

alter table public.listening_tag_declines enable row level security;
drop policy if exists listening_tag_declines_admin on public.listening_tag_declines;
create policy listening_tag_declines_admin on public.listening_tag_declines for all
  using (public.can_administer_reports()) with check (public.can_administer_reports());
