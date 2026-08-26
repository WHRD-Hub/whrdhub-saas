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
