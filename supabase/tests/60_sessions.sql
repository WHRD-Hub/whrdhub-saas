-- Signed-in devices, and ending them.
--
-- The property that matters is isolation: one account must never see or end
-- another's session. These assert that from both directions, and that the
-- current session is protected from being revoked out from under the person
-- using it.
\set ON_ERROR_STOP on
set client_min_messages = notice;

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
  else raise notice 'pass  % (%)', label, left(got, 72); end if;
end $$;

/**
 * Run as a given user, with a session_id claim.
 *
 * The real request.jwt.claims carries session_id; the functions read it to
 * mark and protect the current device, so the tests must supply it too.
 */
create or replace function pg_temp.as_session(uid text, sid text, q text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'session_id', sid)::text, true);
  perform set_config('role', 'authenticated', true);
  execute q into n;
  perform set_config('role', 'postgres', true);
  return n;
end $$;

create or replace function pg_temp.do_as_session(uid text, sid text, q text)
returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'session_id', sid)::text, true);
  perform set_config('role', 'authenticated', true);
  execute q;
  perform set_config('role', 'postgres', true);
  return 'ok';
exception when others then
  perform set_config('role', 'postgres', true);
  return 'DENIED: ' || SQLERRM;
end $$;

do $$
declare
  member   uuid := '11111111-1111-1111-1111-111111111111';
  mt       text := '11111111-1111-1111-1111-111111111111';
  stranger uuid := '66666666-6666-6666-6666-666666666666';
  st       text := '66666666-6666-6666-6666-666666666666';
  laptop   uuid;
  phone    uuid;
  theirs   uuid;
begin
  delete from auth.sessions where user_id in (member, stranger);

  insert into auth.sessions (user_id, user_agent, ip, refreshed_at)
    values (member, 'Mozilla/5.0 (Macintosh) Chrome/120', '41.90.0.1', now())
    returning id into laptop;
  insert into auth.sessions (user_id, user_agent, ip, refreshed_at)
    values (member, 'Mozilla/5.0 (Linux; Android 12) Chrome/119', '41.90.0.2', now() - interval '2 days')
    returning id into phone;
  insert into auth.sessions (user_id, user_agent, ip, refreshed_at)
    values (stranger, 'Mozilla/5.0 (Windows NT 10.0)', '196.201.0.9', now())
    returning id into theirs;

  raise notice '=== SIGNED-IN DEVICES ===';

  perform pg_temp.check('she sees both of her devices',
    pg_temp.as_session(mt, laptop::text, 'select count(*) from public.my_sessions()'), 2);

  perform pg_temp.check('...and never anybody else''s',
    pg_temp.as_session(mt, laptop::text,
      format('select count(*) from public.my_sessions() where id = %L', theirs)), 0);

  perform pg_temp.check('the device she is using is marked as current',
    pg_temp.as_session(mt, laptop::text,
      format('select count(*) from public.my_sessions() where is_current and id = %L', laptop)), 1);

  perform pg_temp.check('the user agent and IP come through',
    pg_temp.as_session(mt, laptop::text,
      'select count(*) from public.my_sessions() where user_agent is not null and ip is not null'), 2);

  raise notice '=== ENDING THEM ===';

  perform pg_temp.check_txt('she cannot end a session that is not hers',
    pg_temp.do_as_session(mt, laptop::text,
      format('select public.revoke_session(%L)', theirs)), 'denied');

  perform pg_temp.check('...and it is still there',
    (select count(*) from auth.sessions where id = theirs), 1);

  perform pg_temp.check_txt('she cannot revoke the device she is using',
    pg_temp.do_as_session(mt, laptop::text,
      format('select public.revoke_session(%L)', laptop)), 'denied');

  perform pg_temp.check_txt('she ends the other one',
    pg_temp.do_as_session(mt, laptop::text,
      format('select public.revoke_session(%L)', phone)), 'ok');

  perform pg_temp.check('the revoked session is gone',
    (select count(*) from auth.sessions where id = phone), 0);

  perform pg_temp.check('its refresh tokens went with it',
    (select count(*) from auth.refresh_tokens where session_id = phone), 0);

  perform pg_temp.check('hers is untouched',
    (select count(*) from auth.sessions where id = laptop), 1);

  raise notice '=== ENDING ALL THE OTHERS ===';

  insert into auth.sessions (user_id, user_agent, ip) values
    (member, 'Tablet', '41.90.0.3'), (member, 'Old phone', '41.90.0.4');

  perform pg_temp.check('sign out everywhere else removes exactly the others',
    pg_temp.as_session(mt, laptop::text, 'select public.revoke_other_sessions()'), 2);

  perform pg_temp.check('...leaving the one she is using',
    (select count(*) from auth.sessions where user_id = member), 1);

  perform pg_temp.check('and never touching another account',
    (select count(*) from auth.sessions where user_id = stranger), 1);

  perform pg_temp.check_txt('a stranger sees nothing of hers',
    pg_temp.do_as_session(st, theirs::text,
      format('select 1 from public.my_sessions() where id = %L', laptop)), 'ok');
  perform pg_temp.check('...literally nothing',
    pg_temp.as_session(st, theirs::text,
      format('select count(*) from public.my_sessions() where id = %L', laptop)), 0);

  delete from auth.sessions where user_id in (member, stranger);
  raise notice '=== SESSION ASSERTIONS PASSED ===';
end $$;
