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
