-- Storage bucket for publications: the PDFs, reports, guides, photo books and
-- newsletters shown on /resources and /newsletter, plus their cover images.
-- Run in the Supabase SQL editor AFTER 011_resources.sql.
-- Plain ASCII only (no box-art) to avoid SQL editor parse errors.
-- Safe to run more than once.
--
-- Why a separate bucket from `media`: member post attachments and the Hub's
-- published documents have different lifecycles and different write rules. Only
-- Hub admins may put files here, and files are laid out by purpose
-- (documents/... and covers/...) rather than per-user, so a document survives
-- the admin who uploaded it leaving the team.

-- No allowed_mime_types restriction on purpose: browsers report an empty or
-- generic content type for some files (notably PDFs picked on Windows), and a
-- MIME allow-list rejects those uploads with an error that is hard to read.
-- The admin form restricts what can be chosen; storage stays permissive.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('publications', 'publications', true, 104857600, null)  -- 100 MB per file
on conflict (id) do update
  set public = true,
      file_size_limit = 104857600,
      allowed_mime_types = null;

-- Anyone can read: the Resources and Newsletter pages are public.
drop policy if exists "publications public read" on storage.objects;
create policy "publications public read" on storage.objects
  for select using (bucket_id = 'publications');

-- Only Hub admins may add, replace, or remove publications.
drop policy if exists "publications admin insert" on storage.objects;
create policy "publications admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'publications' and public.is_hub_admin(auth.uid()));

drop policy if exists "publications admin update" on storage.objects;
create policy "publications admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'publications' and public.is_hub_admin(auth.uid()))
  with check (bucket_id = 'publications' and public.is_hub_admin(auth.uid()));

drop policy if exists "publications admin delete" on storage.objects;
create policy "publications admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'publications' and public.is_hub_admin(auth.uid()));

-- Track where a file came from, so the backfill can tell a mirrored copy from
-- one that was uploaded directly, and so the original link is never lost.
alter table public.resources
  add column if not exists source_url text;
