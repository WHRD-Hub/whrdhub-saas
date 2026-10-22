-- Mentor (femtor) verification: an optional ID and accreditation documents, reviewed by Hub admins.
-- Modelled on Sauti Salama: files in a private bucket, their metadata and review state in one row.
-- Idempotent. Run once in the Supabase SQL editor (also safe to re-run).

create table if not exists public.mentor_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- not_submitted | under_review | verified | rejected
  status text not null default 'not_submitted',
  -- [{ path, name, kind: 'id' | 'accreditation', size, uploaded_at, status: 'pending' | 'verified' | 'rejected', note }]
  documents jsonb not null default '[]'::jsonb,
  review_notes text,
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mentor_verifications_status_idx on public.mentor_verifications (status);

alter table public.mentor_verifications enable row level security;

-- A mentor can read their own row. Every write goes through the server (service role),
-- so status can only change through the review flow.
drop policy if exists mentor_verifications_own_read on public.mentor_verifications;
create policy mentor_verifications_own_read on public.mentor_verifications for select
  using (user_id = auth.uid());

-- Private bucket: files are only ever opened through short-lived signed links.
insert into storage.buckets (id, name, public, file_size_limit)
values ('mentor-documents', 'mentor-documents', false, 10485760)
on conflict (id) do nothing;
