\set ON_ERROR_STOP on
set client_min_messages = notice;

-- Support types end to end, and services offered at county, country or every-
-- where level. Only this file's own services (prefix "T32") are listed, so the
-- fixtures from other files cannot change what is asserted.

create or replace function pg_temp.names(rid uuid) returns text
language sql as $$
  select coalesce(string_agg(s.name, ', ' order by s.name), '(none)')
  from public.report_services rs join public.services s on s.id = rs.service_id
  where rs.report_id = rid and s.name like 'T32 %';
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
  raise notice '=== SUPPORT TYPES AND COUNTRY SCOPE ===';

  insert into public.services (name, category, county, country, is_active) values
    ('T32 Kitui legal desk',   'legal',        'Kitui', 'Kenya',  true),
    ('T32 Uganda legal',       'legal',        null,    'Uganda', true),
    ('T32 Anywhere legal',     'legal',        null,    null,     true),
    ('T32 Kenya shelter',      'shelter',      null,    'Kenya',  true),
    ('T32 Anywhere security',  'digital_security', null, null,    true),
    ('T32 Anywhere other',     'other',        null,    null,     true);

  -- A Kitui report asking for legal help: the local desk and the all-countries body,
  -- but not Uganda's.
  insert into public.reports (incident_types, description, county, country, support_needed, urgency,
                              status, verification_status, reporter_type, channel)
  values (array['gbv'],'t32a','Kitui','Kenya', array['legal'],'no_rush','submitted','pending','anonymous','web')
  returning id into r1;
  perform pg_temp.expect('Kitui + legal: local desk and the all-countries body, not Uganda',
    pg_temp.names(r1), 'T32 Anywhere legal, T32 Kitui legal desk');

  -- A report from Uganda asking for legal help: the Uganda-wide service and the
  -- all-countries body, not a Kenyan county desk.
  insert into public.reports (incident_types, description, county, country, support_needed, urgency,
                              status, verification_status, reporter_type, channel)
  values (array['digital_threats'],'t32b','Uganda','Uganda', array['legal'],'no_rush','submitted','pending','anonymous','web')
  returning id into r2;
  perform pg_temp.expect('Uganda + legal: country-wide service and the all-countries body',
    pg_temp.names(r2), 'T32 Anywhere legal, T32 Uganda legal');

  -- Several support types at once, including free-text "other".
  insert into public.reports (incident_types, description, county, country, support_needed, support_other, urgency,
                              status, verification_status, reporter_type, channel)
  values (array['police_brutality'],'t32c','Kitui','Kenya', array['shelter','digital_security','other'],'a place to stay','within_week','submitted','pending','anonymous','web')
  returning id into r3;
  perform pg_temp.expect('Several types: each is matched to its own category',
    pg_temp.names(r3), 'T32 Anywhere other, T32 Anywhere security, T32 Kenya shelter');

  -- Nothing offered in the category asked for: no suggestions, and no error.
  insert into public.reports (incident_types, description, county, country, support_needed, urgency,
                              status, verification_status, reporter_type, channel)
  values (array['gbv'],'t32d','Kitui','Kenya', array['financial'],'no_rush','submitted','pending','anonymous','web')
  returning id into r4;
  perform pg_temp.expect('A category nobody offers matches nothing',
    pg_temp.names(r4), '(none)');

  -- Adding a support type later (the reporter's Risks form) matches again.
  update public.reports set support_needed = array['legal','shelter'] where id = r4;
  perform pg_temp.expect('Support added after filing is matched',
    pg_temp.names(r4), 'T32 Anywhere legal, T32 Kenya shelter, T32 Kitui legal desk');

  raise notice 'support types and country scope: all passed';
end $$;
