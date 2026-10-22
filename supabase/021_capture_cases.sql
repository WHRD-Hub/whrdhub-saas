-- Taking on an online-listening capture turns it into a normal case. Link the two
-- ways, so the case can show the original post and the capture can open the case.
-- Idempotent. Run once in the Supabase SQL editor (also safe to re-run).

alter table public.listening_results add column if not exists report_id uuid;
alter table public.reports add column if not exists source_capture_id uuid;

do $$ begin
  alter table public.listening_results add constraint listening_results_report_id_fkey
    foreign key (report_id) references public.reports(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.reports add constraint reports_source_capture_id_fkey
    foreign key (source_capture_id) references public.listening_results(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

create index if not exists reports_source_capture_idx on public.reports (source_capture_id) where source_capture_id is not null;
