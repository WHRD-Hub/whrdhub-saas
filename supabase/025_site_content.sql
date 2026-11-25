-- Editable website content: the words and photographs on the public pages that a Hub
-- super administrator can change in place (edit mode). Idempotent; safe to run again.
--
-- One row per editable spot on a page, keyed by a stable id written in the page's code
-- ("home.hero.title", "about.hero.image"). A row only exists once someone has changed that
-- spot; until then the page shows the wording and photo written in the code.
--
--   draft      what editors see while editing; changes land here first
--   published  what everyone sees; copied from draft when an editor presses Publish
--   NULL in either means "use the wording or photo written in the page's code"
--
-- Nobody reads or writes this table directly from the browser. The server reads it with its
-- own account (published wording is cached and shared by every visitor) and writes it only
-- after checking that the person asking is a Hub super administrator (profiles.is_hub_admin).
create table if not exists public.site_content (
  key         text primary key check (key ~ '^[a-z0-9][a-z0-9._-]{0,119}$'),
  kind        text not null check (kind in ('text', 'image')),
  draft       text check (char_length(draft) <= 20000),
  published   text check (char_length(published) <= 20000),
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now(),
  published_at timestamptz
);

alter table public.site_content enable row level security;   -- no policies for people: server only
revoke all on public.site_content from anon, authenticated;

-- On Neon the server signs in as one dedicated account (supabase/neon/04_service_and_accounts.sql),
-- which needs the same pass-through policy every other table has.
do $do$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated_legacy')
     and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'legacy_auth' and p.proname = 'is_service') then
    execute 'drop policy if exists server_account_all on public.site_content';
    execute 'create policy server_account_all on public.site_content for all to authenticated_legacy '
         || 'using (legacy_auth.is_service()) with check (legacy_auth.is_service())';
    execute 'grant select, insert, update, delete on public.site_content to authenticated_legacy';
  end if;
end $do$;
