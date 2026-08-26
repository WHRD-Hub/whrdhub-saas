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
