-- Storage bucket for post/blog media (images, documents, videos).
-- Run in the Supabase SQL editor. Safe to run more than once.
--
-- Files are stored under a per-user folder: media/<auth.uid()>/<filename>.
-- Public read so the feed can display them; write/update/delete restricted to
-- the owner's own folder.

insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 52428800)  -- 50 MB per file
on conflict (id) do update set public = true, file_size_limit = 52428800;

-- Anyone can read media (needed to render images/videos publicly).
drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects
  for select using (bucket_id = 'media');

-- Authenticated users can upload into their own folder (first path segment = uid).
drop policy if exists "media owner insert" on storage.objects;
create policy "media owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owners can update/delete their own files.
drop policy if exists "media owner update" on storage.objects;
create policy "media owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "media owner delete" on storage.objects;
create policy "media owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
