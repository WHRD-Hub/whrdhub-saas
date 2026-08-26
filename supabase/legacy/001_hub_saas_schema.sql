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
