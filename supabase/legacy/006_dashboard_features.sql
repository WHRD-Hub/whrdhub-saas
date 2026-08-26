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
