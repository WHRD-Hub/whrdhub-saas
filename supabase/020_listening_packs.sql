-- Preset listening packs (Usikimye and Political), and accounts whose posts are indexed automatically.
-- Idempotent. Run once in the Supabase SQL editor (also safe to re-run).

alter table public.listening_sources
  add column if not exists index_all boolean DEFAULT false,
  add column if not exists pack text;

alter table public.listening_keywords
  add column if not exists pack text;

-- Which packs are switched on. The app adds each pack's accounts and words the
-- first time it sees the pack, so a new deployment starts with both enabled.
create table if not exists public.listening_packs (
  id text NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  version integer DEFAULT 0 NOT NULL,
  applied_at timestamp with time zone,
  primary key (id)
);

alter table public.listening_packs enable row level security;
drop policy if exists listening_packs_admin on public.listening_packs;
create policy listening_packs_admin on public.listening_packs for all
  using (public.can_administer_reports()) with check (public.can_administer_reports());

insert into public.listening_packs (id, enabled) values ('usikimye', true), ('political', true)
on conflict (id) do nothing;

-- Captures were never being saved: the unique index on (source, source_id) was a partial one, and Postgres
-- cannot use a partial index as the target of an upsert. A plain unique index is equivalent (NULL source ids
-- are never equal to each other) and works.
drop index if exists public.listening_results_source_uidx;
create unique index if not exists listening_results_source_uidx on public.listening_results (source, source_id);
