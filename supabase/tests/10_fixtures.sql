-- Behavioural RLS suite. Creates real users and asserts what each can see/do.
\set ON_ERROR_STOP on
set client_min_messages = warning;

-- Clean slate for test rows.
delete from public.post_comments;
delete from public.post_reactions;
delete from public.posts where body like 'TEST%';
delete from public.blogs where title like 'TEST%';
delete from public.reports;
delete from public.org_memberships;
delete from public.profiles where email like '%@test.local';
delete from auth.users where email like '%@test.local';

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111','member@test.local'),
  ('22222222-2222-2222-2222-222222222222','orgadmin@test.local'),
  ('33333333-3333-3333-3333-333333333333','hubadmin@test.local'),
  ('44444444-4444-4444-4444-444444444444','defender@test.local'),
  ('55555555-5555-5555-5555-555555555555','anon@test.local'),
  ('66666666-6666-6666-6666-666666666666','stranger@test.local');

insert into public.profiles (id, email, username, user_type, is_hub_admin, hub_onboarded, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111','member@test.local','member','reporter',false,true,false),
  ('22222222-2222-2222-2222-222222222222','orgadmin@test.local','orgadmin','reporter',false,true,false),
  ('33333333-3333-3333-3333-333333333333','hubadmin@test.local','hubadmin','reporter',true, true,false),
  ('44444444-4444-4444-4444-444444444444','defender@test.local','defender','defender',false,true,false),
  ('55555555-5555-5555-5555-555555555555','anon@test.local','brave-voice-ab12','reporter',false,false,true),
  ('66666666-6666-6666-6666-666666666666','stranger@test.local','stranger','reporter',false,true,false)
on conflict (id) do update set
  user_type = excluded.user_type, is_hub_admin = excluded.is_hub_admin,
  hub_onboarded = excluded.hub_onboarded, is_anonymous = excluded.is_anonymous;

insert into public.organizations (id, name, slug, created_by, verification_status)
values ('aaaaaaaa-0000-0000-0000-000000000001','Test CBO','test-cbo',
        '22222222-2222-2222-2222-222222222222','verified')
on conflict (id) do nothing;

insert into public.org_memberships (organization_id, user_id, role, status) values
  ('aaaaaaaa-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','org_admin','approved')
on conflict (organization_id, user_id) do update set role='org_admin', status='approved';

-- Content owned by `member`.
insert into public.posts (id, author_id, body, status) values
  ('bbbbbbbb-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','TEST approved post','approved'),
  ('bbbbbbbb-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','TEST pending post','pending');
insert into public.blogs (id, author_id, title, body, status) values
  ('cccccccc-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','TEST story','body text here','approved');

-- Reports: one from the anonymous reporter, one from the member.
insert into public.reports (id, user_id, incident_types, description, support_needed, urgency, status, verification_status, reporter_type, county)
values
  ('dddddddd-0000-0000-0000-000000000001','55555555-5555-5555-5555-555555555555',
   array['online_harassment'],'anon report','{legal}','immediate','submitted','pending','anonymous','Nairobi'),
  ('dddddddd-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',
   array['physical_violence'],'member report','{medical}','no_rush','submitted','pending','authenticated','Kitui');

-- Helper: run a count as a given user under RLS.
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

create or replace function pg_temp.check(label text, got bigint, want bigint) returns void
language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAIL % : got %, want %', label, got, want;
  else
    raise notice 'pass  % (%)', label, got;
  end if;
end $$;
