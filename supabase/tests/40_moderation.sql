-- Suspension belongs to an organisation's admins; banning belongs to the Hub.
-- These assert both, and that neither can reach past its own level.
\set ON_ERROR_STOP on
set client_min_messages = notice;

create or replace function pg_temp.as_user(uid text, q text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  perform set_config('role', 'authenticated', true);
  execute q into n;
  perform set_config('role', 'postgres', true);
  return n;
end $$;

create or replace function pg_temp.do_as(uid text, q text) returns text
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  perform set_config('role', 'authenticated', true);
  execute q;
  perform set_config('role', 'postgres', true);
  return 'ok';
exception when others then
  perform set_config('role', 'postgres', true);
  return 'DENIED: ' || SQLERRM;
end $$;

create or replace function pg_temp.check(label text, got bigint, want bigint) returns void
language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAIL % : got %, want %', label, got, want;
  else raise notice 'pass  % = %', label, got; end if;
end $$;

create or replace function pg_temp.check_txt(label text, got text, want text) returns void
language plpgsql as $$
begin
  if (want = 'ok' and got <> 'ok') or (want = 'denied' and got = 'ok') then
    raise exception 'FAIL % : %', label, got;
  else raise notice 'pass  % (%)', label, left(got, 70); end if;
end $$;

do $$
declare
  orgadmin text := '22222222-2222-2222-2222-222222222222';
  hubadmin text := '33333333-3333-3333-3333-333333333333';
  ORG      uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  victim   uuid := '88888888-8888-8888-8888-888888888888';
  vt       text := '88888888-8888-8888-8888-888888888888';
  mship    uuid;
  n bigint;
begin
  -- A plain, approved member of the org that orgadmin administers.
  insert into auth.users (id, email) values (victim, 'suspendme@test.local') on conflict (id) do nothing;
  insert into public.profiles (id, email, username, user_type, hub_onboarded)
    values (victim, 'suspendme@test.local', 'suspendme', 'reporter', true)
    on conflict (id) do update set banned_at = null, account_deleted_at = null;
  delete from public.org_memberships where user_id = victim;
  insert into public.org_memberships (organization_id, user_id, role, status)
    values (ORG, victim, 'member', 'approved') returning id into mship;
  delete from public.notifications where user_id = victim;

  raise notice '=== SUSPENSION ===';
  perform pg_temp.check('an approved member may post',
    pg_temp.as_user(vt, format('select case when public.can_post_to_feed(%L) then 1 else 0 end', victim)), 1);

  perform pg_temp.check_txt('a plain member cannot suspend anyone',
    pg_temp.do_as('11111111-1111-1111-1111-111111111111',
      format('select public.suspend_member(%L, ''no'')', mship)), 'denied');

  perform pg_temp.check_txt('the network admin suspends them',
    pg_temp.do_as(orgadmin, format('select public.suspend_member(%L, ''Repeated abuse in comments'')', mship)), 'ok');

  perform pg_temp.check('a suspended member can no longer post',
    pg_temp.as_user(vt, format('select case when public.can_post_to_feed(%L) then 1 else 0 end', victim)), 0);

  perform pg_temp.check_txt('...and the database refuses the insert too',
    pg_temp.do_as(vt, format(
      'insert into public.posts (author_id, body, status) values (%L, ''TEST suspended post'', ''pending'')', victim)),
    'denied');

  perform pg_temp.check('they were told, with the reason',
    pg_temp.as_user(vt, format(
      'select count(*) from public.notifications where user_id = %L and body like ''%%Repeated abuse%%''', victim)), 1);

  select count(*) into n from public.notifications
   where type = 'moderation' and user_id = hubadmin::uuid;
  if n < 1 then raise exception 'FAIL the Hub was not informed of the suspension'; end if;
  raise notice 'pass  the Hub was informed = %', n;

  perform pg_temp.check('they can still see their own membership and why',
    pg_temp.as_user(vt, format(
      'select count(*) from public.org_memberships where user_id = %L and status = ''suspended''', victim)), 1);

  raise notice '=== ESCALATION TO A BAN ===';
  perform pg_temp.check_txt('a network admin cannot ban',
    pg_temp.do_as(orgadmin, format('select public.ban_account(%L, ''nope'')', victim)), 'denied');

  perform pg_temp.check_txt('the Hub bans the account',
    pg_temp.do_as(hubadmin, format('select public.ban_account(%L, ''Repeated harassment after suspension'')', victim)), 'ok');

  perform pg_temp.check('the account reads as banned',
    pg_temp.as_user(vt, format('select case when public.is_banned(%L) then 1 else 0 end', victim)), 1);

  perform pg_temp.check_txt('a banned account cannot comment',
    pg_temp.do_as(vt, format(
      'insert into public.post_comments (post_id, author_id, body) values ((select id from public.posts where status = ''approved'' and deleted_at is null limit 1), %L, ''hello'')',
      victim)), 'denied');

  perform pg_temp.check_txt('a banned account cannot support a post',
    pg_temp.do_as(vt, format(
      'insert into public.post_reactions (post_id, user_id) values ((select id from public.posts where status = ''approved'' and deleted_at is null limit 1), %L)',
      victim)), 'denied');

  perform pg_temp.check_txt('a banned account cannot file a report while signed in',
    pg_temp.do_as(vt, format(
      'insert into public.reports (user_id, incident_types, description, support_needed, urgency, status, verification_status, reporter_type, channel) values (%L, array[''other''], ''x'', ''{}'', ''no_rush'', ''submitted'', ''pending'', ''authenticated'', ''web'')',
      victim)), 'denied');

  perform pg_temp.check('banning did not delete their content',
    pg_temp.as_user(hubadmin, format('select count(*) from public.profiles where id = %L', victim)), 1);

  raise notice '=== LIFTING IT ===';
  perform pg_temp.check_txt('a network admin cannot unban',
    pg_temp.do_as(orgadmin, format('select public.unban_account(%L)', victim)), 'denied');
  perform pg_temp.check_txt('the Hub lifts the ban',
    pg_temp.do_as(hubadmin, format('select public.unban_account(%L)', victim)), 'ok');
  perform pg_temp.check('still suspended by their network, though',
    pg_temp.as_user(vt, format('select case when public.can_post_to_feed(%L) then 1 else 0 end', victim)), 0);
  perform pg_temp.check_txt('the network admin lifts the suspension',
    pg_temp.do_as(orgadmin, format('select public.unsuspend_member(%L)', mship)), 'ok');
  perform pg_temp.check('and they can post again',
    pg_temp.as_user(vt, format('select case when public.can_post_to_feed(%L) then 1 else 0 end', victim)), 1);

  raise notice '=== MODERATION ASSERTIONS PASSED ===';
end $$;
