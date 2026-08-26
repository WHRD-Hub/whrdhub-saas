-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Sample community posts for the feed.                                   ║
-- ║  Run AFTER 001_hub_saas_schema.sql. Safe to run more than once.         ║
-- ║                                                                        ║
-- ║  Seeded/demo posts have no real author account, so we store a display   ║
-- ║  name and title directly on the row (guest_name / guest_title). The     ║
-- ║  feed prefers a real profile when author_id is set, then these fields.  ║
-- ╚══════════════════════════════════════════════════════════════════════╝

alter table public.posts
  add column if not exists guest_name  text,
  add column if not exists guest_title text;

-- Clear previous demo seeds so re-running does not pile up duplicates.
delete from public.posts where guest_name is not null;

insert into public.posts
  (body, county_network_id, is_hub, status, published_at, guest_name, guest_title)
values
  (
    'Wrapped up a three-day safety and security training in Kitui with 20 defenders. Watching each other grow more confident about staying safe online and offline is why we do this work.',
    (select id from public.county_networks where slug = 'kitui'),
    false, 'approved', now() - interval '2 hours',
    'Faith Mwikali', 'Community organiser, Kitui'
  ),
  (
    'You are not alone. If you are a defender facing threats online, reach out. Our digital security volunteers can help you lock down your accounts and document what is happening.',
    (select id from public.county_networks where slug = 'nairobi'),
    false, 'approved', now() - interval '6 hours',
    'Achieng Odhiambo', 'Digital safety advocate'
  ),
  (
    'Coastal defenders came together this weekend for a wellbeing circle in Mombasa. Rest is resistance. Protecting others starts with protecting ourselves.',
    (select id from public.county_networks where slug = 'mombasa'),
    false, 'approved', now() - interval '1 day',
    'Amina Said', 'WHRD, Mombasa'
  ),
  (
    'Land rights are women''s rights. Proud to stand with the women of Meru as they push for a fair hearing on land injustices affecting their families.',
    (select id from public.county_networks where slug = 'meru'),
    false, 'approved', now() - interval '1 day 4 hours',
    'Gakii Mutembei', 'Legal advocate'
  ),
  (
    'Femtorship changed my path. A year ago I was afraid to speak in public. Today I chaired our county network meeting. Grateful to the femtor who believed in me.',
    (select id from public.county_networks where slug = 'nakuru'),
    false, 'approved', now() - interval '2 days',
    'Wanjiru Kamau', 'Young defender, Nakuru'
  ),
  (
    'Reached three more villages in Marsabit this month. The distances are long but the welcome is warm. Every defender we reach makes the network stronger.',
    (select id from public.county_networks where slug = 'marsabit'),
    false, 'approved', now() - interval '3 days',
    'Halima Boru', 'Field coordinator'
  ),
  (
    'Our familiarisation meeting in Bomet was full of energy. New faces, shared stories, and a real hunger to organise. This is how movements grow.',
    (select id from public.county_networks where slug = 'bomet'),
    false, 'approved', now() - interval '4 days',
    'Chepngeno Rotich', 'Organiser, Bomet'
  ),
  (
    'We testified before the county assembly today on funding for gender-based violence services. Uncomfortable rooms are exactly where defenders need to be.',
    (select id from public.county_networks where slug = 'nairobi'),
    false, 'approved', now() - interval '5 days',
    'Njeri Kariuki', 'Policy advocate'
  ),
  (
    'Sixteen days, one movement. Kisumu defenders are marking the 16 Days of Activism with school visits, radio spots, and survivor support clinics. Come join us.',
    (select id from public.county_networks where slug = 'kisumu'),
    false, 'approved', now() - interval '6 days',
    'Sarah Atieno', 'WHRD, Kisumu'
  ),
  (
    'To every woman defender reading this: your courage is contagious. Keep going. We have each other, and together we are safer and stronger.',
    (select id from public.county_networks where slug = 'nairobi'),
    false, 'approved', now() - interval '8 days',
    'Beatrice Wafula', 'Human rights defender'
  );
