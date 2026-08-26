-- ============================================================================
--  WHRD Hub - community lifecycle
--  Migration 014. Run after 013. Idempotent; run as many times as you like.
--
--  Adds the things the merged product needs and did not have:
--
--    1. Soft delete on every kind of content. A member deleting their own post
--       marks it deleted and it disappears from their view and the feed, but a
--       Hub admin can still read it in full. Hub admins alone can purge.
--    2. Comments on feed posts, with the same soft-delete rule.
--    3. Membership verification. Joining a CBO is now a request that the
--       organisation's own admins (or the Hub) approve or decline.
--    4. Account deletion. The account disappears for the person, their content
--       leaves the public surfaces, and the Hub can still see both.
--    5. Anonymous reporters claiming a full account.
--
--  Nothing is destructive. No column or row is dropped.
-- ============================================================================


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  1. Soft delete columns                                                 ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- deleted_at is the single source of truth. `status` keeps its original value
-- so a restored item goes back to exactly where it was in the review flow.

do $$
declare t text;
begin
  foreach t in array array['posts','blogs','reports','resources'] loop
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = t) then
      execute format($f$
        alter table public.%I
          add column if not exists deleted_at     timestamptz,
          add column if not exists deleted_by     uuid references auth.users(id) on delete set null,
          add column if not exists deleted_reason text
      $f$, t);
      execute format(
        'create index if not exists %I on public.%I (deleted_at) where deleted_at is not null',
        t || '_deleted_idx', t);
    end if;
  end loop;
end $$;


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  2. Comments on feed posts                                              ║
-- ╚════════════════════════════════════════════════════════════════════════╝

create table if not exists public.post_comments (
  id             uuid default gen_random_uuid() primary key,
  post_id        uuid not null references public.posts(id) on delete cascade,
  author_id      uuid references auth.users(id) on delete set null,
  parent_id      uuid references public.post_comments(id) on delete cascade,
  body           text not null,
  deleted_at     timestamptz,
  deleted_by     uuid references auth.users(id) on delete set null,
  deleted_reason text,
  created_at     timestamptz default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);
create index if not exists post_comments_author_idx on public.post_comments (author_id);

-- Seeded/demo comments have no account behind them, so they carry a display
-- name directly, the same way seeded posts do.
alter table public.post_comments
  add column if not exists guest_name  text,
  add column if not exists guest_title text;


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  3. Membership verification                                             ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- Anyone can ask to join a CBO — including someone whose account started life
-- on the reporting side. The organisation's admins decide.

do $$ begin
  create type public.membership_state as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

alter table public.org_memberships
  add column if not exists status         public.membership_state default 'approved',
  add column if not exists requested_at   timestamptz default now(),
  add column if not exists decided_at     timestamptz,
  add column if not exists decided_by     uuid references auth.users(id) on delete set null,
  add column if not exists decision_notes text,
  add column if not exists request_note   text;

-- Everyone who was already a member stays one.
update public.org_memberships set status = 'approved' where status is null;

create index if not exists org_memberships_status_idx
  on public.org_memberships (organization_id, status);

-- Is the caller an approved admin of this organisation? SECURITY DEFINER so it
-- can be used in a policy on org_memberships without recursing.
create or replace function public.is_org_admin(org uuid, uid uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.org_memberships m
     where m.organization_id = org
       and m.user_id = uid
       and m.role = 'org_admin'
       and m.status = 'approved'
  );
$$;

-- Organisations the caller administers, for policies that need a set.
create or replace function public.my_admin_org_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id from public.org_memberships
   where user_id = auth.uid() and role = 'org_admin' and status = 'approved';
$$;

grant execute on function public.is_org_admin(uuid, uuid) to authenticated, anon;
grant execute on function public.my_admin_org_ids()       to authenticated, anon;


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  4. Account deletion and anonymous-account claiming                     ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- The auth.users row is deliberately kept: the Hub must still be able to read
-- a deleted account and everything in it. `account_deleted_at` is what every
-- surface checks.

alter table public.profiles
  add column if not exists account_deleted_at     timestamptz,
  add column if not exists account_deleted_reason text,
  -- When an anonymous reporter upgraded to a real, addressable account.
  add column if not exists claimed_at             timestamptz;

create index if not exists profiles_deleted_idx
  on public.profiles (account_deleted_at) where account_deleted_at is not null;

/**
 * Delete an account. Runs as the owner or a Hub admin.
 *
 * Everything the person wrote is soft-deleted so it leaves the public surfaces
 * immediately, and the profile is marked deleted. Reports are deliberately NOT
 * touched: a case the response team is working belongs to the response, not to
 * the account, and the Hub decides its fate separately.
 */
create or replace function public.delete_account(target uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Not signed in';
  end if;
  if caller <> target and not public.is_hub_admin(caller) then
    raise exception 'You can only delete your own account';
  end if;

  update public.profiles
     set account_deleted_at = coalesce(account_deleted_at, now()),
         account_deleted_reason = coalesce(reason, account_deleted_reason)
   where id = target;

  update public.posts
     set deleted_at = coalesce(deleted_at, now()),
         deleted_by = caller,
         deleted_reason = coalesce(deleted_reason, 'Account deleted')
   where author_id = target and deleted_at is null;

  update public.blogs
     set deleted_at = coalesce(deleted_at, now()),
         deleted_by = caller,
         deleted_reason = coalesce(deleted_reason, 'Account deleted')
   where author_id = target and deleted_at is null;

  update public.post_comments
     set deleted_at = coalesce(deleted_at, now()),
         deleted_by = caller,
         deleted_reason = coalesce(deleted_reason, 'Account deleted')
   where author_id = target and deleted_at is null;

  -- Drop them out of their organisations so member lists stay clean.
  update public.org_memberships
     set status = 'rejected',
         decided_at = now(),
         decided_by = caller,
         decision_notes = 'Account deleted'
   where user_id = target and status <> 'rejected';
end;
$$;

/** Hub admins can bring an account back. */
create or replace function public.restore_account(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_hub_admin(auth.uid()) then
    raise exception 'Only the Hub can restore an account';
  end if;
  update public.profiles
     set account_deleted_at = null, account_deleted_reason = null
   where id = target;
end;
$$;

grant execute on function public.delete_account(uuid, text) to authenticated;
grant execute on function public.restore_account(uuid)      to authenticated;


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  5. Row Level Security                                                  ║
-- ╚════════════════════════════════════════════════════════════════════════╝

alter table public.post_comments enable row level security;

-- ── Posts ────────────────────────────────────────────────────────────────
-- Deleted posts leave the public feed but stay visible to their author, marked
-- as deleted, and to the Hub in full.
--
-- The author MUST keep read access to their own deleted rows. PostgreSQL
-- applies SELECT policies to the new row of an UPDATE, so a policy that hid
-- deleted rows from the author would make it impossible for the author to
-- delete anything: the write that sets deleted_at would move the row out of
-- their own visibility and be rejected.
drop policy if exists post_read   on public.posts;
drop policy if exists post_update on public.posts;
drop policy if exists post_delete on public.posts;

create policy post_read on public.posts for select using (
  public.is_hub_admin(auth.uid())
  or author_id = auth.uid()
  or (deleted_at is null and status = 'approved')
);

-- An author may edit a draft or pending post, and may soft-delete at any
-- status (the deleted_at write is an UPDATE, not a DELETE).
create policy post_update on public.posts for update using (
  author_id = auth.uid() or public.is_hub_admin(auth.uid())
) with check (
  author_id = auth.uid() or public.is_hub_admin(auth.uid())
);

-- Permanent removal is the Hub's alone.
create policy post_delete on public.posts for delete
  using (public.is_hub_admin(auth.uid()));

-- ── Blogs ────────────────────────────────────────────────────────────────
drop policy if exists blog_read   on public.blogs;
drop policy if exists blog_update on public.blogs;
drop policy if exists blog_delete on public.blogs;

create policy blog_read on public.blogs for select using (
  public.is_hub_admin(auth.uid())
  or author_id = auth.uid()
  or (deleted_at is null and status = 'approved')
);
create policy blog_update on public.blogs for update using (
  author_id = auth.uid() or public.is_hub_admin(auth.uid())
) with check (
  author_id = auth.uid() or public.is_hub_admin(auth.uid())
);
create policy blog_delete on public.blogs for delete
  using (public.is_hub_admin(auth.uid()));

-- ── Comments ─────────────────────────────────────────────────────────────
drop policy if exists comment_read   on public.post_comments;
drop policy if exists comment_insert on public.post_comments;
drop policy if exists comment_update on public.post_comments;
drop policy if exists comment_delete on public.post_comments;

create policy comment_read on public.post_comments for select using (
  public.is_hub_admin(auth.uid())
  or author_id = auth.uid()
  or (deleted_at is null and exists (
        select 1 from public.posts p
         where p.id = post_id and p.deleted_at is null and p.status = 'approved'))
);
create policy comment_insert on public.post_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.posts p
                 where p.id = post_id and p.deleted_at is null and p.status = 'approved')
  );
-- Authors soft-delete their own; the Hub can act on any.
create policy comment_update on public.post_comments for update using (
  author_id = auth.uid() or public.is_hub_admin(auth.uid())
) with check (
  author_id = auth.uid() or public.is_hub_admin(auth.uid())
);
create policy comment_delete on public.post_comments for delete
  using (public.is_hub_admin(auth.uid()));

-- ── Reports ──────────────────────────────────────────────────────────────
-- Soft-deleted reports leave the reporter's view and the triage list, and stay
-- readable by Hub administrators.
drop policy if exists "reporters_own_reports"      on public.reports;
drop policy if exists "responders_see_all_reports" on public.reports;
drop policy if exists "responders_update_reports"  on public.reports;
drop policy if exists "reports_delete"             on public.reports;

create policy "reporters_own_reports" on public.reports for select
  using (auth.uid() = user_id and deleted_at is null);

create policy "responders_see_all_reports" on public.reports for select using (
  public.can_administer_reports()
  or (public.can_triage_reports() and deleted_at is null)
);

create policy "responders_update_reports" on public.reports for update
  using (public.can_triage_reports()) with check (public.can_triage_reports());

create policy "reports_delete" on public.reports for delete
  using (public.can_administer_reports());

-- ── Memberships ──────────────────────────────────────────────────────────
-- Read your own; org admins and fellow approved members read the org's;
-- the Hub reads everything.
drop policy if exists mem_read   on public.org_memberships;
drop policy if exists mem_join   on public.org_memberships;
drop policy if exists mem_leave  on public.org_memberships;
drop policy if exists mem_decide on public.org_memberships;

create policy mem_read on public.org_memberships for select using (
  user_id = auth.uid()
  or public.is_hub_admin(auth.uid())
  or organization_id in (select public.my_admin_org_ids())
  or (status = 'approved' and organization_id in (select public.my_org_ids()))
);

-- You may only ever request membership for yourself, and never self-approve.
create policy mem_join on public.org_memberships for insert to authenticated
  with check (
    user_id = auth.uid()
    and (status = 'pending' or public.is_hub_admin(auth.uid()))
  );

-- Decisions belong to the organisation's admins, or the Hub.
create policy mem_decide on public.org_memberships for update using (
  public.is_hub_admin(auth.uid())
  or organization_id in (select public.my_admin_org_ids())
) with check (
  public.is_hub_admin(auth.uid())
  or organization_id in (select public.my_admin_org_ids())
);

create policy mem_leave on public.org_memberships for delete using (
  user_id = auth.uid()
  or public.is_hub_admin(auth.uid())
  or organization_id in (select public.my_admin_org_ids())
);

-- ── Profiles ─────────────────────────────────────────────────────────────
-- A deleted account is invisible to everyone but the Hub. `users_own_profile`
-- from the reporting schema still lets the owner read their own row, which is
-- what the sign-out-on-deleted check needs.
drop policy if exists "responders_read_all_profiles" on public.profiles;
create policy "responders_read_all_profiles" on public.profiles for select using (
  public.is_hub_admin(auth.uid())
  or (public.can_triage_reports() and account_deleted_at is null)
);

drop policy if exists profiles_public_read on public.profiles;
create policy profiles_public_read on public.profiles for select
  using (account_deleted_at is null);


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  6. Keep membership and profile state consistent                        ║
-- ╚════════════════════════════════════════════════════════════════════════╝

-- Stamp the decision time whenever a membership is approved or declined.
create or replace function public.membership_before_write()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'UPDATE' and new.status is distinct from old.status
     and new.status in ('approved','rejected') then
    new.decided_at := coalesce(new.decided_at, now());
    new.decided_by := coalesce(new.decided_by, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists trg_membership_before_write on public.org_memberships;
create trigger trg_membership_before_write
  before insert or update on public.org_memberships
  for each row execute function public.membership_before_write();

-- Stamp deleted_by when a row is soft-deleted and the caller did not set it.
create or replace function public.stamp_soft_delete()
returns trigger language plpgsql as $$
begin
  if new.deleted_at is not null and (old.deleted_at is null) then
    new.deleted_by := coalesce(new.deleted_by, auth.uid());
  end if;
  if new.deleted_at is null then
    new.deleted_by := null;
    new.deleted_reason := null;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['posts','blogs','reports','post_comments'] loop
    execute format('drop trigger if exists trg_stamp_soft_delete on public.%I', t);
    execute format(
      'create trigger trg_stamp_soft_delete before update on public.%I
         for each row execute function public.stamp_soft_delete()', t);
  end loop;
end $$;


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  7. Counters                                                            ║
-- ╚════════════════════════════════════════════════════════════════════════╝

create or replace function public.hub_overview()
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'members',          (select count(distinct user_id) from public.org_memberships where status = 'approved'),
    'members_pending',  (select count(*) from public.org_memberships where status = 'pending'),
    'onboarded',        (select count(*) from public.profiles where hub_onboarded and account_deleted_at is null),
    'accounts_deleted', (select count(*) from public.profiles where account_deleted_at is not null),
    'organizations',    (select count(*) from public.organizations),
    'orgs_pending',     (select count(*) from public.organizations where verification_status = 'pending'),
    'posts_pending',    (select count(*) from public.posts where status = 'pending' and deleted_at is null),
    'blogs_pending',    (select count(*) from public.blogs where status = 'pending' and deleted_at is null),
    'posts_live',       (select count(*) from public.posts where status = 'approved' and deleted_at is null),
    'blogs_live',       (select count(*) from public.blogs where status = 'approved' and deleted_at is null),
    'posts_declined',   (select count(*) from public.posts where status = 'rejected' and deleted_at is null),
    'blogs_declined',   (select count(*) from public.blogs where status = 'rejected' and deleted_at is null),
    'posts_deleted',    (select count(*) from public.posts where deleted_at is not null),
    'blogs_deleted',    (select count(*) from public.blogs where deleted_at is not null),
    'comments_deleted', (select count(*) from public.post_comments where deleted_at is not null),
    'counties_active',  (select count(*) from public.county_networks where is_active),
    'reports_total',    (select count(*) from public.reports where deleted_at is null),
    'reports_pending',  (select count(*) from public.reports where verification_status = 'pending' and deleted_at is null),
    'reports_urgent',   (select count(*) from public.reports
                          where urgency = 'immediate' and status in ('submitted','under_review')
                            and deleted_at is null),
    'reports_verified', (select count(*) from public.reports where verification_status = 'verified' and deleted_at is null),
    'reports_deleted',  (select count(*) from public.reports where deleted_at is not null)
  );
$$;

-- Submission and growth series should ignore deleted rows.
create or replace function public.hub_submissions_timeseries(days int default 30)
returns table(day date, posts bigint, blogs bigint)
language sql security definer set search_path = public as $$
  with span as (
    select generate_series((current_date - (days - 1)), current_date, interval '1 day')::date as day
  )
  select s.day,
         (select count(*) from public.posts p where p.created_at::date = s.day and p.deleted_at is null),
         (select count(*) from public.blogs b where b.created_at::date = s.day and b.deleted_at is null)
  from span s order by s.day;
$$;

create or replace function public.hub_member_growth(days int default 30)
returns table(day date, joins bigint)
language sql security definer set search_path = public as $$
  with span as (
    select generate_series((current_date - (days - 1)), current_date, interval '1 day')::date as day
  )
  select s.day, (select count(*) from public.org_memberships m
                  where m.created_at::date = s.day and m.status = 'approved')
  from span s order by s.day;
$$;


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  8. Grants                                                              ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- A hosted Supabase project grants these automatically through default
-- privileges, so this is a no-op there. It is stated explicitly so the schema
-- also stands up on a plain Postgres (local development, CI, self-hosting).

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;
grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  9. Storage: evidence follows the same role rule as the reports         ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- The report-screenshots policy still tested profiles.user_type directly, so a
-- Hub admin could open a case in the console and not be able to view its
-- evidence. Route it through the shared role function like everything else.

do $$ begin
  drop policy if exists "screenshots_defenders_read" on storage.objects;
  drop policy if exists "screenshots_responders_read" on storage.objects;
  execute $p$
    create policy "screenshots_responders_read" on storage.objects
      for select using (bucket_id = 'report-screenshots' and public.can_triage_reports())
  $p$;
exception when undefined_table then
  raise notice 'storage.objects not present; skipping';
end $$;


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  10. Referral matching                                                  ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- Verifying a report auto-assigns support services. The original rule matched
-- on category alone, so a reporter in Kitui asking for shelter could be handed
-- a shelter in Nakuru while a Kitui one sat unused.
--
-- The rule now is, for each kind of support the reporter asked for:
--
--   * every service in their own county, and every service that operates
--     nationally. Both are genuinely useful to a survivor - the local desk is
--     reachable, the national body has reach - so neither is withheld.
--   * services belonging to OTHER counties are excluded, unless that category
--     has no local and no national service at all, in which case the nearest
--     available one is assigned rather than answering the request with nothing.
--
-- Each referral carries a note saying which of those three it was, so the
-- response team can see at a glance why a service was suggested.

create or replace function public.handle_report_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.verification_status = 'verified'
     and (OLD.verification_status is distinct from 'verified') then

    insert into public.report_services (report_id, service_id, assigned_by, note)
    select NEW.id, m.id, NEW.verified_by, m.note
    from (
      select distinct on (s.category, s.id)
             s.id,
             s.category,
             case
               when NEW.county is not null and s.county = NEW.county
                 then 'Matched: ' || s.category::text || ' support in ' || NEW.county
               when s.county is null
                 then 'Matched: national ' || s.category::text || ' support'
               else 'Matched: nearest available ' || s.category::text || ' support'
             end as note,
             case
               when NEW.county is not null and s.county = NEW.county then 1
               when s.county is null then 2
               else 3
             end as rank
      from public.services s
      where s.is_active
        and s.category::text = any(coalesce(NEW.support_needed, '{}'))
        -- Only fall past the local and national tiers when neither exists for
        -- this category, rather than adding every county's service.
        and (
          (NEW.county is not null and s.county = NEW.county)
          or s.county is null
          or not exists (
            select 1 from public.services s2
             where s2.is_active
               and s2.category = s.category
               and (s2.county = NEW.county or s2.county is null)
          )
        )
      order by s.category, s.id, rank
    ) m
    on conflict (report_id, service_id) do nothing;

  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_report_verified on public.reports;
create trigger trg_report_verified
  after update on public.reports
  for each row
  execute function public.handle_report_verified();
