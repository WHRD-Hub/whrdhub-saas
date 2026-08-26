\set ON_ERROR_STOP on
set client_min_messages = notice;

create or replace function pg_temp.names(rid uuid) returns text
language sql as $$
  select coalesce(string_agg(s.name, ', ' order by s.name), '(none)')
  from public.report_services rs join public.services s on s.id = rs.service_id
  where rs.report_id = rid;
$$;

create or replace function pg_temp.expect(label text, got text, want text) returns void
language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAIL % : got [%], want [%]', label, got, want;
  else raise notice 'pass  % -> %', label, got; end if;
end $$;

do $$
declare r1 uuid; r2 uuid; r3 uuid; r4 uuid;
begin
  raise notice '=== COUNTY-AWARE MATCHING ===';

  -- Kitui asks for legal: the Kitui desk AND the national body, but no other
  -- county's desk.
  insert into public.reports (incident_types, description, county, support_needed, urgency,
                              status, verification_status, reporter_type, channel)
  values (array['online_harassment'],'m1','Kitui', array['legal'],'no_rush','submitted','pending','anonymous','web')
  returning id into r1;
  update public.reports set verification_status = 'verified' where id = r1;
  perform pg_temp.expect('Kitui + legal gets the local desk and the national body',
    pg_temp.names(r1), 'FIDA Kenya legal aid, Kitui paralegal desk');

  -- Nairobi asks for legal: no Nairobi-specific desk, so the national body.
  insert into public.reports (incident_types, description, county, support_needed, urgency,
                              status, verification_status, reporter_type, channel)
  values (array['online_harassment'],'m2','Nairobi', array['legal'],'no_rush','submitted','pending','anonymous','web')
  returning id into r2;
  update public.reports set verification_status = 'verified' where id = r2;
  perform pg_temp.expect('Nairobi + legal falls back to national', pg_temp.names(r2), 'FIDA Kenya legal aid');

  -- Meru asks for medical: only Nairobi and Mombasa have one, and neither is
  -- national, so the reporter must still be given something.
  insert into public.reports (incident_types, description, county, support_needed, urgency,
                              status, verification_status, reporter_type, channel)
  values (array['physical_violence'],'m3','Meru', array['medical'],'immediate','submitted','pending','anonymous','web')
  returning id into r3;
  update public.reports set verification_status = 'verified' where id = r3;
  if pg_temp.names(r3) = '(none)' then
    raise exception 'FAIL a county with no local or national service got nothing';
  end if;
  raise notice 'pass  Meru + medical still gets a referral -> %', pg_temp.names(r3);

  -- Nakuru asks for shelter and digital security: local shelter, national clinic.
  insert into public.reports (incident_types, description, county, support_needed, urgency,
                              status, verification_status, reporter_type, channel)
  values (array['physical_violence'],'m4','Nakuru', array['shelter','digital_security'],'immediate','submitted','pending','anonymous','web')
  returning id into r4;
  update public.reports set verification_status = 'verified' where id = r4;
  perform pg_temp.expect('Nakuru gets its local shelter, the national safe house and the clinic',
    pg_temp.names(r4), 'Digital security clinic, Nakuru emergency shelter, Safe house placement');

  raise notice '=== COUNTY MATCHING PASSED ===';
end $$;
