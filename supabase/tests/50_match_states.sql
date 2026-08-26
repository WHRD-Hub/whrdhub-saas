-- The referral state machine.
--
-- A match is only useful if the console can tell a proposal nobody answered
-- from one both sides accepted, and if the survivor's answer is the one that
-- counts. These assert exactly that, and that a stranger cannot answer for her.
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
  member   uuid := '11111111-1111-1111-1111-111111111111';
  mt       text := '11111111-1111-1111-1111-111111111111';
  stranger text := '66666666-6666-6666-6666-666666666666';
  hubadmin text := '33333333-3333-3333-3333-333333333333';
  rep      uuid := 'dddddddd-0000-0000-0000-000000000002';  -- member's own report
  svc      uuid;
  ref1     uuid;
  ref2     uuid;
  ov       json;
  st       text;
  before_n int;
  after_n  int;
begin
  -- A service to refer to. Reuse whatever the seed left, else make one.
  select id into svc from public.services where is_active limit 1;
  if svc is null then
    insert into public.services (name, category, county, is_active)
      values ('Test Legal Desk', 'legal', 'Kitui', true) returning id into svc;
  end if;

  -- The account-deletion assertions in 20_* soft-delete this member's report on
  -- their way through. Bring it back so this file starts from a live case.
  update public.reports set deleted_at = null where id = rep;
  update public.profiles set account_deleted_at = null, banned_at = null where id = member;

  delete from public.report_services where report_id = rep;

  insert into public.report_services (report_id, service_id, match_status, match_score)
    values (rep, svc, 'proposed', 72) returning id into ref1;

  raise notice '=== MATCH STATES ===';

  perform pg_temp.check('a new referral starts as proposed',
    (select count(*) from public.report_services
      where id = ref1 and match_status = 'proposed'), 1);

  perform pg_temp.check('the survivor can see her own referral',
    pg_temp.as_user(mt, format('select count(*) from public.report_services where id = %L', ref1)), 1);

  perform pg_temp.check('a stranger cannot',
    pg_temp.as_user(stranger, format('select count(*) from public.report_services where id = %L', ref1)), 0);

  perform pg_temp.check_txt('a stranger cannot answer for her',
    pg_temp.do_as(stranger, format('select public.respond_to_match(%L, ''accept'')', ref1)), 'denied');

  -- The survivor accepts a proposal the service has not touched. Her yes is
  -- decisive: the referral goes straight to accepted, not to a half state.
  perform pg_temp.check_txt('the survivor accepts',
    pg_temp.do_as(mt, format('select public.respond_to_match(%L, ''accept'')', ref1)), 'ok');

  select match_status::text into st from public.report_services where id = ref1;
  if st <> 'accepted' then
    raise exception 'FAIL survivor accept : got %, want accepted', st;
  end if;
  raise notice 'pass  survivor accept lands on accepted';

  perform pg_temp.check('...and her response is timestamped',
    (select count(*) from public.report_services
      where id = ref1 and survivor_responded_at is not null), 1);

  -- A second referral, declined this time, with a reason.
  insert into public.report_services (report_id, service_id, match_status)
    select rep, id, 'proposed' from public.services
     where is_active and id <> svc limit 1
    returning id into ref2;

  if ref2 is not null then
    perform pg_temp.check_txt('the survivor declines the second referral',
      pg_temp.do_as(mt, format('select public.respond_to_match(%L, ''decline'', ''Too far to travel'')', ref2)), 'ok');

    perform pg_temp.check('the reason is kept',
      (select count(*) from public.report_services
        where id = ref2 and match_status = 'declined'
          and declined_reason = 'Too far to travel'), 1);
  end if;

  -- The overview the Hub console reads.
  ov := public.matching_overview();
  if (ov->>'accepted')::int < 1 then
    raise exception 'FAIL matching_overview : accepted should count the referral above, got %', ov->>'accepted';
  end if;
  raise notice 'pass  matching_overview reports the accepted referral (%)', ov->>'accepted';

  if (ov->>'referrals')::int < 1 then
    raise exception 'FAIL matching_overview : referrals is zero';
  end if;
  raise notice 'pass  matching_overview counts referrals (%)', ov->>'referrals';

  -- Deleted reports must not leak into the Hub's matching numbers. Build a
  -- throwaway case, count, soft-delete it, count again.
  insert into public.reports (id, user_id, incident_types, description, support_needed,
                              urgency, status, verification_status, reporter_type, county)
    values ('dddddddd-0000-0000-0000-0000000000ff', member, array['online_harassment'],
            'temp report for deletion check', '{legal}', 'no_rush', 'submitted',
            'pending', 'authenticated', 'Kitui')
    on conflict (id) do update set deleted_at = null;
  delete from public.report_services where report_id = 'dddddddd-0000-0000-0000-0000000000ff';
  insert into public.report_services (report_id, service_id, match_status)
    values ('dddddddd-0000-0000-0000-0000000000ff', svc, 'proposed');

  before_n := (public.matching_overview()->>'referrals')::int;
  update public.reports set deleted_at = now()
    where id = 'dddddddd-0000-0000-0000-0000000000ff';
  after_n := (public.matching_overview()->>'referrals')::int;

  if after_n <> before_n - 1 then
    raise exception 'FAIL deleted report still counted : % -> %', before_n, after_n;
  end if;
  raise notice 'pass  a deleted report drops out of the overview (% -> %)', before_n, after_n;

  delete from public.report_services where report_id = 'dddddddd-0000-0000-0000-0000000000ff';
  delete from public.reports where id = 'dddddddd-0000-0000-0000-0000000000ff';

  raise notice '=== MATCH STATES OK ===';
end $$;
