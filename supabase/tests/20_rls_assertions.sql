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
  else raise notice 'pass  % (%)', label, left(got, 60); end if;
end $$;

do $$
declare
  member   text := '11111111-1111-1111-1111-111111111111';
  orgadmin text := '22222222-2222-2222-2222-222222222222';
  hubadmin text := '33333333-3333-3333-3333-333333333333';
  defender text := '44444444-4444-4444-4444-444444444444';
  anonrep  text := '55555555-5555-5555-5555-555555555555';
  stranger text := '66666666-6666-6666-6666-666666666666';
  P_APPROVED text := 'bbbbbbbb-0000-0000-0000-000000000001';
  P_PENDING  text := 'bbbbbbbb-0000-0000-0000-000000000002';
  R_ANON     text := 'dddddddd-0000-0000-0000-000000000001';
  ORG        text := 'aaaaaaaa-0000-0000-0000-000000000001';
  q_posts text := 'select count(*) from public.posts where body like ''TEST%''';
begin
  raise notice '=== REPORTS ===';
  perform pg_temp.check('anonymous reporter sees only their own report',
    pg_temp.as_user(anonrep, 'select count(*) from public.reports'), 1);
  perform pg_temp.check('member sees only their own report',
    pg_temp.as_user(member, 'select count(*) from public.reports'), 1);
  perform pg_temp.check('unrelated user sees no reports',
    pg_temp.as_user(stranger, 'select count(*) from public.reports'), 0);
  perform pg_temp.check('defender triages every report',
    pg_temp.as_user(defender, 'select count(*) from public.reports'), 2);
  perform pg_temp.check('hub admin sees every report',
    pg_temp.as_user(hubadmin, 'select count(*) from public.reports'), 2);
  perform pg_temp.check_txt('member cannot delete a report',
    pg_temp.do_as(member, format('delete from public.reports where id = %L', R_ANON)), 'ok');
  perform pg_temp.check('...and the report survives',
    pg_temp.as_user(hubadmin, 'select count(*) from public.reports'), 2);

  raise notice '=== CONTENT VISIBILITY ===';
  perform pg_temp.check('outsider sees only the approved post',
    pg_temp.as_user(stranger, q_posts), 1);
  perform pg_temp.check('author sees their approved and pending posts',
    pg_temp.as_user(member, q_posts), 2);
  perform pg_temp.check('hub admin sees both',
    pg_temp.as_user(hubadmin, q_posts), 2);

  raise notice '=== DELETING YOUR OWN CONTENT ===';
  perform pg_temp.check_txt('author deletes their own post',
    pg_temp.do_as(member, format('select public.delete_own_content(''post'', %L)', P_APPROVED)), 'ok');
  perform pg_temp.check('it leaves the public feed',
    pg_temp.as_user(stranger, q_posts), 0);
  perform pg_temp.check('it leaves the author''s own account too',
    pg_temp.as_user(member, q_posts), 1);
  perform pg_temp.check('the hub still sees it in full',
    pg_temp.as_user(hubadmin, q_posts), 2);
  perform pg_temp.check('deleted_by was recorded',
    pg_temp.as_user(hubadmin, format(
      'select count(*) from public.posts where id = %L and deleted_by = %L', P_APPROVED, member)), 1);
  perform pg_temp.check_txt('one member cannot delete another''s post',
    pg_temp.do_as(stranger, format('select public.delete_own_content(''post'', %L)', P_PENDING)), 'denied');
  perform pg_temp.check_txt('an author cannot purge a row',
    pg_temp.do_as(member, format('delete from public.posts where id = %L', P_APPROVED)), 'ok');
  perform pg_temp.check('...the post survives that attempt',
    pg_temp.as_user(hubadmin, q_posts), 2);
  perform pg_temp.check_txt('only the hub can restore',
    pg_temp.do_as(member, format('select public.restore_content(''post'', %L)', P_APPROVED)), 'denied');
  perform pg_temp.check_txt('hub admin restores it',
    pg_temp.do_as(hubadmin, format('select public.restore_content(''post'', %L)', P_APPROVED)), 'ok');
  perform pg_temp.check('restored post is public again',
    pg_temp.as_user(stranger, q_posts), 1);
  perform pg_temp.check_txt('hub admin purges permanently',
    pg_temp.do_as(hubadmin, format('delete from public.posts where id = %L', P_PENDING)), 'ok');
  perform pg_temp.check('...and it is gone',
    pg_temp.as_user(hubadmin, q_posts), 1);

  raise notice '=== DELETING YOUR OWN REPORT ===';
  perform pg_temp.check('the reporter can see their report',
    pg_temp.as_user(anonrep, 'select count(*) from public.reports'), 1);
  perform pg_temp.check_txt('the reporter deletes it',
    pg_temp.do_as(anonrep, format('select public.delete_own_content(''report'', %L)', R_ANON)), 'ok');
  perform pg_temp.check('it leaves their account',
    pg_temp.as_user(anonrep, 'select count(*) from public.reports'), 0);
  perform pg_temp.check('a triage defender no longer sees it either',
    pg_temp.as_user(defender, 'select count(*) from public.reports'), 1);
  perform pg_temp.check('the hub still sees it',
    pg_temp.as_user(hubadmin, 'select count(*) from public.reports'), 2);
  perform pg_temp.check_txt('hub admin restores the report',
    pg_temp.do_as(hubadmin, format('select public.restore_content(''report'', %L)', R_ANON)), 'ok');
  perform pg_temp.check('the reporter has it back',
    pg_temp.as_user(anonrep, 'select count(*) from public.reports'), 1);

  raise notice '=== COMMENTS ===';
  perform pg_temp.check_txt('member comments on an approved post',
    pg_temp.do_as(member, format(
      'insert into public.post_comments (post_id, author_id, body) values (%L, %L, ''TEST comment'')',
      P_APPROVED, member)), 'ok');
  perform pg_temp.check_txt('a user cannot comment as someone else',
    pg_temp.do_as(stranger, format(
      'insert into public.post_comments (post_id, author_id, body) values (%L, %L, ''forged'')',
      P_APPROVED, member)), 'denied');
  perform pg_temp.check('the comment is public',
    pg_temp.as_user(stranger, 'select count(*) from public.post_comments'), 1);
  perform pg_temp.check_txt('author deletes their comment',
    pg_temp.do_as(member,
      'select public.delete_own_content(''comment'', (select id from public.post_comments limit 1))'), 'ok');
  perform pg_temp.check('the deleted comment is gone for everyone',
    pg_temp.as_user(stranger, 'select count(*) from public.post_comments'), 0);
  perform pg_temp.check('...including its author',
    pg_temp.as_user(member, 'select count(*) from public.post_comments'), 0);
  perform pg_temp.check('the hub still reads it',
    pg_temp.as_user(hubadmin, 'select count(*) from public.post_comments'), 1);

  raise notice '=== WHO MAY POST ===';
  perform pg_temp.check_txt('a member of an organisation may post',
    pg_temp.do_as(orgadmin, format(
      'insert into public.posts (author_id, body, status) values (%L, ''TEST member post'', ''pending'')',
      orgadmin)), 'ok');
  perform pg_temp.check_txt('someone in no network cannot post',
    pg_temp.do_as(stranger, format(
      'insert into public.posts (author_id, body, status) values (%L, ''TEST outsider post'', ''pending'')',
      stranger)), 'denied');
  perform pg_temp.check_txt('a member cannot publish straight to the feed',
    pg_temp.do_as(orgadmin, format(
      'insert into public.posts (author_id, body, status) values (%L, ''TEST sneaky'', ''approved'')',
      orgadmin)), 'denied');
  perform pg_temp.check_txt('a hub admin publishes directly',
    pg_temp.do_as(hubadmin, format(
      'insert into public.posts (author_id, body, status) values (%L, ''TEST hub post'', ''approved'')',
      hubadmin)), 'ok');

  raise notice '=== MEMBERSHIP VERIFICATION ===';
  perform pg_temp.check_txt('reporter-origin account requests to join a CBO',
    pg_temp.do_as(anonrep, format(
      'insert into public.org_memberships (organization_id, user_id, role, status) values (%L, %L, ''member'', ''pending'')',
      ORG, anonrep)), 'ok');
  perform pg_temp.check_txt('nobody can self-approve on the way in',
    pg_temp.do_as(stranger, format(
      'insert into public.org_memberships (organization_id, user_id, role, status) values (%L, %L, ''member'', ''approved'')',
      ORG, stranger)), 'denied');
  perform pg_temp.check('org admin sees the pending request',
    pg_temp.as_user(orgadmin, format(
      'select count(*) from public.org_memberships where organization_id = %L and status = ''pending''', ORG)), 1);
  perform pg_temp.check_txt('an ordinary member cannot approve it',
    pg_temp.do_as(member, format(
      'update public.org_memberships set status = ''approved'' where user_id = %L', anonrep)), 'ok');
  perform pg_temp.check('...and it is still pending',
    pg_temp.as_user(orgadmin, format(
      'select count(*) from public.org_memberships where user_id = %L and status = ''pending''', anonrep)), 1);
  perform pg_temp.check_txt('the org admin approves it',
    pg_temp.do_as(orgadmin, format(
      'update public.org_memberships set status = ''approved'' where user_id = %L', anonrep)), 'ok');
  perform pg_temp.check('decision timestamp stamped by the trigger',
    pg_temp.as_user(orgadmin, format(
      'select count(*) from public.org_memberships where user_id = %L and status = ''approved'' and decided_at is not null and decided_by = %L',
      anonrep, orgadmin)), 1);

  raise notice '=== ACCOUNT DELETION ===';
  perform pg_temp.check_txt('a user cannot delete someone else''s account',
    pg_temp.do_as(stranger, format('select public.delete_account(%L)', member)), 'denied');
  perform pg_temp.check_txt('a user deletes their own account',
    pg_temp.do_as(member, format('select public.delete_account(%L, ''no longer needed'')', member)), 'ok');
  perform pg_temp.check('their content left the public surfaces',
    pg_temp.as_user(stranger, format(
      'select count(*) from public.posts where author_id = %L', member)), 0);
  perform pg_temp.check('the hub still sees the content',
    pg_temp.as_user(hubadmin, format(
      'select count(*) from public.posts where author_id = %L', member)), 1);
  perform pg_temp.check('their reports went too',
    pg_temp.as_user(member, 'select count(*) from public.reports'), 0);
  perform pg_temp.check('the deleted profile is hidden from other members',
    pg_temp.as_user(stranger, format('select count(*) from public.profiles where id = %L', member)), 0);
  perform pg_temp.check('the hub still sees the deleted account',
    pg_temp.as_user(hubadmin, format('select count(*) from public.profiles where id = %L', member)), 1);
  perform pg_temp.check_txt('hub admin restores the account',
    pg_temp.do_as(hubadmin, format('select public.restore_account(%L)', member)), 'ok');
  perform pg_temp.check('the profile is visible again',
    pg_temp.as_user(stranger, format('select count(*) from public.profiles where id = %L', member)), 1);

  raise notice '=== ALL ASSERTIONS PASSED ===';
end $$;
