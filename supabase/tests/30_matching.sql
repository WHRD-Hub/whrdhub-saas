-- Verifying a report is what triggers referral matching and notifies the
-- reporter. County preference is asserted separately in 31_matching_county.sql;
-- this file covers the invariants that hold whatever the county is.
\set ON_ERROR_STOP on
set client_min_messages = notice;

create or replace function pg_temp.check(label text, got bigint, want bigint) returns void
language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAIL % : got %, want %', label, got, want;
  else raise notice 'pass  % = %', label, got; end if;
end $$;

do $$
declare
  rid uuid;
  uid uuid := '77777777-7777-7777-7777-777777777777';
  n bigint;
  assigned bigint;
begin
  insert into auth.users (id, email) values (uid, 'match@test.local') on conflict (id) do nothing;
  insert into public.profiles (id, email, username, user_type)
    values (uid, 'match@test.local', 'match-tester', 'reporter')
    on conflict (id) do nothing;

  delete from public.reports where description = 'MATCH TEST';

  insert into public.reports
    (user_id, incident_types, description, county, support_needed, urgency,
     status, verification_status, reporter_type, channel)
  values
    (uid, array['online_harassment'], 'MATCH TEST', 'Nairobi',
     array['legal','psychosocial'], 'immediate', 'submitted', 'pending', 'authenticated', 'web')
  returning id into rid;

  raise notice '=== MATCHING ===';

  select count(*) into n from public.report_services where report_id = rid;
  perform pg_temp.check('nothing is assigned before verification', n, 0);

  select count(*) into n from public.notifications where report_id = rid;
  perform pg_temp.check('no notification before verification', n, 0);

  -- Verifying the report is what triggers the match.
  update public.reports set verification_status = 'verified' where id = rid;

  select count(*) into assigned from public.report_services where report_id = rid;
  if assigned = 0 then
    raise exception 'FAIL verifying a report assigned no support at all';
  end if;
  raise notice 'pass  verification assigned support = %', assigned;

  -- Every category the reporter asked for is answered.
  select count(distinct s.category) into n
    from public.report_services rs join public.services s on s.id = rs.service_id
   where rs.report_id = rid;
  perform pg_temp.check('both requested categories are covered', n, 2);

  select count(*) into n
    from public.report_services rs join public.services s on s.id = rs.service_id
   where rs.report_id = rid and s.category::text not in ('legal','psychosocial');
  perform pg_temp.check('nothing matched outside what was asked for', n, 0);

  select count(*) into n
    from public.report_services rs join public.services s on s.id = rs.service_id
   where rs.report_id = rid and not s.is_active;
  perform pg_temp.check('no inactive service was assigned', n, 0);

  select count(*) into n from public.report_services where report_id = rid and note is null;
  perform pg_temp.check('every referral explains why it was matched', n, 0);

  select count(*) into n from public.notifications where report_id = rid;
  perform pg_temp.check('the reporter was notified once per assigned service', n, assigned);

  select count(*) into n from public.notifications
   where report_id = rid and read = false and is_read = false
     and title is not null and link is not null;
  perform pg_temp.check('notifications carry both read flags plus title and link', n, assigned);

  -- Re-saving a verified report must not pile up duplicate referrals.
  update public.reports set status = 'under_review' where id = rid;
  update public.reports set verification_status = 'verified' where id = rid;
  select count(*) into n from public.report_services where report_id = rid;
  perform pg_temp.check('re-saving a verified report does not duplicate referrals', n, assigned);

  raise notice '=== MATCHING ASSERTIONS PASSED ===';
end $$;
