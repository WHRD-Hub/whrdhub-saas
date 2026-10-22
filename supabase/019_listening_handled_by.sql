-- Online listening is a shared inbox: every admin sees every capture. Record who
-- took on or closed each one, so two people do not work the same capture.
-- Idempotent. Run once in the Supabase SQL editor (also safe to re-run).

alter table public.listening_results
  add column if not exists handled_by uuid,
  add column if not exists handled_at timestamp with time zone;

do $$ begin
  alter table public.listening_results add constraint listening_results_handled_by_fkey
    foreign key (handled_by) references auth.users(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;
