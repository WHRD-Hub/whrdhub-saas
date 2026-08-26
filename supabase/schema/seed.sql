-- --------------------------------------------------------------------------
--  WHRD Hub - demo content seed
--  GENERATED FILE - do not edit. Run `npm run db:bundle` to rebuild.
--  Source files, in order:
--    002_seed_blogs.sql
--    003_seed_posts.sql
--    005_seed_organizations.sql
--    015_seed_demo_content.sql
--
--  Optional. Run AFTER bootstrap.sql to fill a new or staging project with
--  example organisations, stories, posts, comments and reports so every
--  screen has something in it. Safe to re-run; it will not duplicate rows.
-- --------------------------------------------------------------------------


-- --------------------------------------------------------------------------
-- BEGIN 002_seed_blogs.sql
-- --------------------------------------------------------------------------

-- Seed: blog stories imported from whrdhub.org (full article content).
-- Run AFTER 001_hub_saas_schema.sql. Safe to run more than once (upsert on slug).
-- Bodies are the complete articles (HTML), fetched from the live site; the short
-- "excerpt" is the preview text from the site. Plain-ASCII comments only.

-- Optional cleanup: if an earlier run seeded all 47 counties, drop the ones
-- that are not shared networks and are not referenced anywhere.
delete from public.county_networks
where slug not in ('bomet','kisumu','kitui','marsabit','meru','mombasa','nairobi','nakuru')
  and id not in (select county_network_id from public.profiles       where county_network_id is not null)
  and id not in (select county_network_id from public.organizations  where county_network_id is not null);

insert into public.blogs
  (title, slug, excerpt, body, cover_image_url, is_hub, status, published_at)
values
  (
    'Rasna Warah',
    'rasna-warah',
    'Remembering Rasna Warah, a bold Kenyan journalist, author, and human rights champion driven by a deep sense of justice.',
    '<p>Rasna Warah, who passed away on January 11, 2025, at the age of 63, was a bold and brilliant Kenyan journalist, author, and human rights champion. Her life''s work was driven by a deep sense of justice, and she never shied away from speaking uncomfortable truths no matter how powerful the people or institutions involved.</p><p>Rasna''s voice resonated through countless columns and articles in publications like the Daily Nation, The Standard, The Elephant, The Guardian, and The East African. She wrote fearlessly about corruption, bad governance, marginalization, and the damaging legacies of colonialism and Western intervention. Her pen was her weapon and she used it with precision and purpose.</p><p>Beyond journalism, Rasna authored several powerful books including Triple Heritage, Mogadishu Then and Now, War Crimes, UNsilenced, and Lords of Impunity. Through her writing, she exposed injustices, challenged global institutions like the UN, and gave voice to those who are too often ignored or silenced.</p><p>What set Rasna apart was not just her sharp intellect or courageous writing, it was her heart. She stood firmly with the marginalized, the vulnerable, and the silenced. She believed that truth mattered, and she dedicated her life to uncovering it, no matter the cost.</p><p>Losing Rasna is a deep blow to journalism, activism, and the broader struggle for human rights. But her legacy, her words, her courage, her stand for justice lives on. She has inspired a generation to write, to question, and most importantly, to never stop defending what''s right.</p><p>Rest in power, Rasna Warah. You will not be forgotten.</p>',
    'https://whrdhub.org/wp-content/uploads/2025/04/Rasna-Warah.jpg',
    true, 'approved', timestamptz '2025-04-07 09:00+03'
  ),
  (
    'International Women''s Day 2025',
    'international-womens-day-2025',
    'More than a celebration, a call to action. We shared stories of courage and launched Rooted in Courage.',
    '<p>International Women''s Day 2025 was more than a celebration, it was a call to action. As we shared stories of courage and launched Rooted in Courage, we reaffirmed our commitment to ending GBV and advancing gender equality.</p><p>But the work does not stop here. We must:</p><ol><li>Advocate for policies that protect women''s rights</li><li>Hold leaders accountable for gender equality commitments</li><li>Support survivors and amplify their voices</li><li>Challenge harmful norms and promote inclusive communities</li></ol><blockquote>As our chief guest during the event, Hon. Rehema Jaldesa stated, "The time to act is now! Beyond rhetoric, we need real, tangible actions to empower all women and girls."</blockquote><p>Let us keep pushing for change!</p>',
    'https://whrdhub.org/wp-content/uploads/2025/03/IMG_0764-scaled.jpg',
    true, 'approved', timestamptz '2025-03-17 09:00+03'
  ),
  (
    'The Hub''s First Donor Roundtable',
    'first-donor-roundtable',
    'Our first Donor Roundtable, with support from the Open Society Foundations, marked a new chapter of partnership for women human rights defenders.',
    '<p>On September 10th, 2024, we hosted our first Donor Roundtable, marking a key moment in our journey. With support from the Open Society Foundations, this event was an important step towards building partnerships that align with our mission of supporting women human rights defenders (WHRDs) in Kenya and beyond, as part of our 2024 to 2029 Strategic Plan.</p><p>The roundtable allowed us to share our story, focusing on both our achievements and future plans. It showed how we have been supporting WHRDs by improving safety, building stronger connections among women defenders, and offering training programs that enhance their skills and knowledge.</p><p>We shared examples of our impact, such as creating networks that help WHRDs support each other and overcome challenges like violence and harassment. This event was not just a discussion, but a chance to build stronger relationships with donors. As we move forward with our 2024 to 2029 plan, these partnerships will be vital in ensuring that WHRDs have the resources and support they need to continue their important work.</p>',
    'https://whrdhub.org/wp-content/uploads/2024/09/0I2A7208-scaled.jpg',
    true, 'approved', timestamptz '2024-09-26 09:00+03'
  ),
  (
    'Safety and Security Training Program',
    'safety-and-security-training-program',
    'A one-week safety and security training with practical exercises, empowering participants to assess risks and respond to emergencies.',
    '<p>A comprehensive one week safety and security training program with engaging sessions and practical exercises, empowering participants with vital knowledge and skills to assess risks, implement preventative measures, and respond effectively to emergencies.</p><p>As an organization, our commitment to safety and security extends beyond mere education and training; it encompasses a holistic approach that emphasizes collaboration, empowerment, and continuous improvement.</p>',
    'https://whrdhub.org/wp-content/uploads/2024/05/WhatsApp-Image-2024-05-28-at-12.39.20.jpeg',
    true, 'approved', timestamptz '2024-05-28 09:00+03'
  ),
  (
    'WHRDHUB Strategic Plan 2024-2028 Validation',
    'strategic-plan-2024-2028-validation',
    'A momentous validation workshop for our Strategic Plan, showcasing our dedication to the livelihoods, safety, mentorship, and wellbeing of WHRDs.',
    '<p>What a momentous day at the validation workshop for the Women Human Rights Defenders Hub SP 2024 to 28! With partners and key stakeholders in attendance, we proudly showcased our dedication to enhancing the livelihoods, safety, mentorship, and wellbeing of WHRDs. The day provided a valuable opportunity to reflect on our achievements and stress the significance of the Strategic Plan in shaping the future of WHRDs in Kenya and beyond. It was a platform for key stakeholders to reaffirm their commitment to turning our objectives into reality.</p>',
    'https://whrdhub.org/wp-content/uploads/2024/05/DSC_8300-scaled.jpg',
    true, 'approved', timestamptz '2024-05-28 10:00+03'
  ),
  (
    'Convening Protection Networks for Uganda, Kenya and Tanzania',
    'protection-networks-consortium-convening',
    'Gathering with the East Africa Women Human Rights Network to strengthen protection networks across the region.',
    '<p>In Uganda, East Africa, we gathered with a group of incredible individuals as part of the East Africa Women Human Rights Network.</p><p>The one week meeting began on the 23rd of April, a significant date symbolizing unity and cooperation. The primary goal of our gathering was to create a roadmap and develop strategies for the year 2024, which holds immense promise for Women Human Rights Defenders in the region.</p>',
    'https://whrdhub.org/wp-content/uploads/2024/05/WhatsApp-Image-2024-05-28-at-12.27.40-1.jpeg',
    true, 'approved', timestamptz '2024-05-28 11:00+03'
  ),
  (
    'Meeting with Delegates from the French Embassy',
    'meeting-with-delegates-french-embassy',
    'The Hub met with delegates from the French Embassy and strategic partners for deliberations on technology and its careful application.',
    '<p>The Hub, in the company of delegates from the French Embassy and other strategic partners, held a constructive deliberation on gene drives and technological remedies that could be adopted. The gathering came in appreciation of the great strides realized in genetic science and the urgency to handle these discoveries with care.</p><p>As an organization, our proposed vision of continuous evaluations and implementation of a robust, updated regulatory framework to manage similar technologies is driven by our institutional dedication towards sound scientific achievements that are also environmentally friendly.</p>',
    'https://whrdhub.org/wp-content/uploads/2024/05/WhatsApp-Image-2024-05-28-at-12.26.32.jpeg',
    true, 'approved', timestamptz '2024-05-28 12:00+03'
  ),
  (
    'Joannah Stutchbury',
    'joannah-stutchbury',
    'Honouring the memory of Joannah Stutchbury, who defended human rights and the environment in Kiambu County.',
    '<h2>A Tribute to a Woman Human Rights Defender and Environmentalist</h2><p>We honor the memory of Joannah Stutchbury, a courageous woman who defended human rights and the environment. Tragically, she was allegedly murdered for her stance against environmental injustice in Kiambu Forest, Kiambu County.</p><p>Her courage remains a call to every defender protecting land, forests, and the communities that depend on them.</p>',
    'https://whrdhub.org/wp-content/uploads/2024/05/WhatsApp-Image-2021-08-02-at-02.03.06.jpeg',
    true, 'approved', timestamptz '2024-05-24 09:00+03'
  ),
  (
    'Elizabeth Ekaru',
    'elizabeth-ekaru',
    'Remembering Elizabeth Ibrahim Ekaru, a champion of women''s rights and an environmental and land rights advocate.',
    '<h2>A Tribute to a Woman Human Rights Defender and Environmentalist</h2><p>Elizabeth Ibrahim Ekaru was an ardent champion of women''s rights and an environmental and land rights advocate, in addition to being a peacemaker. Elizabeth was previously acknowledged for her efforts when she was awarded the Head of State Commendation Award for bravery and leading in the fight for human rights in Kenya.</p><p>The widespread nature of violence against defenders of women''s human rights in Kenya is highlighted by the alleged murder of Elizabeth Ibrahim Ekaru. Her killing, which allegedly took place while defending land rights, is a true testimony of the risks, challenges and attacks that women human rights defenders continue to face in the line of their work. Her death exemplifies the high cost that women human rights defenders bear in their efforts to protect and advance the social, economic, cultural, and political rights enshrined in Kenya''s 2010 Constitution.</p><p>We pay tribute to her lasting impact.</p>',
    'https://whrdhub.org/wp-content/uploads/2024/05/download-3.jpg',
    true, 'approved', timestamptz '2024-05-24 10:00+03'
  ),
  (
    'IWHRD Celebrations 2023',
    'iwhrd-celebrations-2023',
    'Celebrating International Women Human Rights Defenders Day 2023 with our networks and partners.',
    '<p>The Hub marked International Women Human Rights Defenders Day 2023 with our networks and partners, celebrating the courage of defenders and recommitting to their protection and wellbeing. The day brought together women defenders from across our county networks to share, connect, and honour the work of protecting rights in their communities.</p>',
    'https://whrdhub.org/wp-content/uploads/2024/05/Capture.png',
    true, 'approved', timestamptz '2024-05-24 11:00+03'
  )
on conflict (slug) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  cover_image_url = excluded.cover_image_url,
  status = 'approved',
  is_hub = true,
  published_at = excluded.published_at;

-- END 002_seed_blogs.sql


-- --------------------------------------------------------------------------
-- BEGIN 003_seed_posts.sql
-- --------------------------------------------------------------------------

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

-- END 003_seed_posts.sql


-- --------------------------------------------------------------------------
-- BEGIN 005_seed_organizations.sql
-- --------------------------------------------------------------------------

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Seed: each county network's local host organisation, verified.        ║
-- ║  Run AFTER 001. Safe to run more than once (upsert on slug).           ║
-- ║  This gives every county page at least one real organisation to show.  ║
-- ╚══════════════════════════════════════════════════════════════════════╝

insert into public.organizations (name, slug, description, county_network_id, verification_status, verified_at)
select v.name, v.slug, v.description, cn.id, 'verified', now()
from (values
  ('Kisumu Women Defenders Network', 'kisumu-wdn', 'Formed in 2019 to promote human rights and gender equality across five sub-counties of Kisumu.', 'kisumu'),
  ('Kitui Women Peace and Security', 'kitui-wps', 'A non-partisan network of grassroots women ending violence against women and girls and building their role in peace and security.', 'kitui'),
  ('Pastoralists Peoples Initiative', 'ppi-marsabit', 'A non-profit umbrella organisation empowering women and youth across Marsabit.', 'marsabit'),
  ('Kiengu Women Challenged to Challenge', 'kwcc-meru', 'Advancing women''s rights and mobilising communities for justice in Meru.', 'meru'),
  ('Muslim Women Advancement of Rights and Protection', 'mwarp-mombasa', 'Building safety and solidarity for women defenders across the coast.', 'mombasa'),
  ('Women Beyond Borders', 'wbb-nairobi', 'Connecting defenders across Nairobi and the wider national network.', 'nairobi'),
  ('Women''s Rights League', 'wrl-nakuru', 'A feminist movement of defenders, women in politics, and women journalists in Nakuru.', 'nakuru')
) as v(name, slug, description, county_slug)
join public.county_networks cn on cn.slug = v.county_slug
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  county_network_id = excluded.county_network_id,
  verification_status = 'verified',
  verified_at = now();

-- END 005_seed_organizations.sql


-- --------------------------------------------------------------------------
-- BEGIN 015_seed_demo_content.sql
-- --------------------------------------------------------------------------

-- ============================================================================
--  WHRD Hub - demo content seed
--  Run AFTER the schema bootstrap. Optional: this is what makes a fresh or
--  staging project look like a working product instead of an empty shell.
--  Safe to run more than once; every insert is keyed so nothing duplicates.
--
--  Deliberately creates NO auth users. Seeded posts, comments and reports carry
--  a display name on the row instead, so the seed cannot manufacture accounts
--  that could be signed into.
-- ============================================================================


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  1. Support services (the referral directory the matcher draws on)      ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- The category of each service is what a verified report is matched against,
-- so there is at least one active service for every support category a
-- reporter can ask for. Without these, verifying a report assigns nothing.

insert into public.services (name, description, category, organization, contact_phone, contact_email, county, is_active)
select v.name, v.description, v.category::public.service_category_enum, v.org, v.phone, v.email, v.county, true
from (values
  ('FIDA Kenya legal aid',            'Free legal advice and representation for women, including protection orders and GBV cases.', 'legal',            'FIDA Kenya',                    '+254722509760', 'info@fidakenya.org',        null),
  ('Kitui paralegal desk',            'Community paralegals supporting defenders through reporting, statements and court follow-up.', 'legal',           'Kitui Women Peace and Security','+254700000101', 'legal@kitui-wps.org',        'Kitui'),
  ('GBV Recovery Centre - Nairobi',   'Post-rape care, injury treatment, forensic documentation and referral. Open 24 hours.',        'medical',          'Kenyatta National Hospital',    '+254703000000', null,                         'Nairobi'),
  ('Coast GBV medical response',      'Medical care and evidence collection for survivors across Mombasa and the coast.',              'medical',          'Coast General Hospital',        '+254700000102', null,                         'Mombasa'),
  ('Healthcare Assistance Kenya',     'National toll-free counselling and GBV response line, available around the clock.',             'psychosocial',     'HAK',                           '1195',          'info@hakenya.org',           null),
  ('Peer counselling circle',         'Trauma-informed peer support groups run by and for women human rights defenders.',              'psychosocial',     'WHRD Hub',                      null,            'support@whrdhub.org',        null),
  ('Safe house placement',            'Emergency accommodation for defenders at immediate risk, with relocation support.',             'shelter',          'WHRD Hub',                      '+254700000103', 'safety@whrdhub.org',         null),
  ('Nakuru emergency shelter',        'Short-stay shelter for women and children leaving a violent situation.',                        'shelter',          'Women''s Rights League',        '+254700000104', null,                         'Nakuru'),
  ('Digital security clinic',         'Account lockdown, device hygiene, takedown requests and evidence preservation for TFGBV.',      'digital_security', 'WHRD Hub',                      null,            'digital@whrdhub.org',        null),
  ('Emergency defender fund',         'Small rapid grants covering transport, medical costs and relocation for defenders at risk.',    'financial',        'WHRD Hub',                      null,            'fund@whrdhub.org',           null),
  ('National referral desk',          'Triage and warm referral into the right service when the need does not fit a single category.', 'referral',         'WHRD Hub',                      null,            'referrals@whrdhub.org',      null),
  ('Police Gender Desk liaison',      'Accompaniment and liaison when a defender chooses to report to the police.',                    'other',            'WHRD Hub',                      '999',           null,                         null)
) as v(name, description, category, org, phone, email, county)
where not exists (select 1 from public.services s where s.name = v.name);


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  2. Comments on the seeded feed posts                                   ║
-- ╚════════════════════════════════════════════════════════════════════════╝

delete from public.post_comments where guest_name is not null;

insert into public.post_comments (post_id, body, guest_name, guest_title, created_at)
select p.id, v.body, v.who, v.title, now() - v.age
from public.posts p
join (values
  ('Faith Mwikali', 'This is the work. Proud of every defender who showed up for those three days.', 'Naomi Wanjiru', 'Defender, Kitui',   interval '1 hour'),
  ('Faith Mwikali', 'Can we bring this training to Mwingi next quarter? There is real demand here.', 'Esther Kalondu', 'Paralegal, Kitui', interval '40 minutes'),
  ('Achieng Odhiambo', 'Shared this with our county group. The digital security clinic helped me last month.', 'Mercy Atieno', 'Defender, Kisumu', interval '3 hours')
) as v(author_match, body, who, title, age) on p.guest_name = v.author_match
where p.guest_name is not null;


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  3. Example reports, so the reporting console is not empty              ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- user_id is left null on purpose: these are illustrative cases, not real
-- people's reports, and no seeded account exists to attach them to. They are
-- visible to the response team and to nobody else.

delete from public.reports where description like '[DEMO]%';

insert into public.reports
  (user_id, incident_types, description, county, support_needed, urgency,
   status, verification_status, reporter_type, channel, is_ongoing, consent_to_followup, created_at)
values
  (null, array['online_harassment'],
   '[DEMO] Coordinated pile-on across two platforms after publishing a piece on land rights. Hundreds of accounts, many created the same week, using the same three insults.',
   'Nairobi', array['digital_security','psychosocial'], 'immediate',
   'submitted', 'pending', 'anonymous', 'web', true, true, now() - interval '4 hours'),
  (null, array['physical_violence','online_harassment'],
   '[DEMO] Threats at a community meeting followed by photographs of my home posted in a WhatsApp group.',
   'Kitui', array['legal','shelter'], 'immediate',
   'under_review', 'verified', 'authenticated', 'web', true, true, now() - interval '2 days'),
  (null, array['workplace_abuse'],
   '[DEMO] Ongoing intimidation from a supervisor after raising a safeguarding concern.',
   'Mombasa', array['legal','psychosocial'], 'within_week',
   'referred', 'verified', 'authenticated', 'web', false, true, now() - interval '9 days'),
  (null, array['online_harassment'],
   '[DEMO] Report filed over USSD from a feature phone. Impersonation account using my photograph.',
   'Marsabit', array['digital_security'], 'no_rush',
   'closed', 'verified', 'anonymous', 'ussd', false, false, now() - interval '21 days');


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  4. Publications for /resources and /newsletter                         ║
-- ╚════════════════════════════════════════════════════════════════════════╝

insert into public.resources (title, slug, description, kind, is_newsletter, file_url, edition_label, published_on, featured, published, sort_order)
select v.title, v.slug, v.description, v.kind, v.is_newsletter, v.file_url, v.edition, v.pub_on::date, v.featured, true, v.ord
from (values
  ('State of Women Human Rights Defenders in Kenya', 'state-of-whrds-kenya',
   'An annual review of the threats defenders face and the protection gaps that remain.',
   'Report', false, 'https://whrdhub.org/', null, '2026-03-08', false, 10),
  ('Digital Safety Toolkit for Defenders', 'digital-safety-toolkit',
   'Practical steps for locking down accounts, documenting abuse and preserving evidence.',
   'Toolkit', false, 'https://whrdhub.org/', null, '2026-01-20', false, 20),
  ('WHRD Hub Newsletter', 'newsletter-jan-jun-2026',
   'Six months of movement news, county network updates and defender stories.',
   'Newsletter', true, 'https://whrdhub.org/', 'January - June 2026', '2026-07-01', true, 1)
) as v(title, slug, description, kind, is_newsletter, file_url, edition, pub_on, featured, ord)
where not exists (select 1 from public.resources r where r.slug = v.slug);


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  5. Online-listening sample signals                                     ║
-- ╚════════════════════════════════════════════════════════════════════════╝

insert into public.listening_results (source, source_id, permalink, author, content, matched_keywords, severity, status)
select v.source, v.source_id, v.permalink, v.author, v.content, v.kw, v.severity, 'new'
from (values
  ('facebook', 'demo-1', 'https://facebook.com/', 'Public page comment',
   'Threatening language directed at a named defender following a county assembly hearing.',
   array['threat'], 'medium'),
  ('facebook', 'demo-2', 'https://facebook.com/', 'Public page comment',
   'Coordinated harassment thread naming several women organisers.',
   array['harassment'], 'high')
) as v(source, source_id, permalink, author, content, kw, severity)
-- The unique index on (source, source_id) is partial, so ON CONFLICT cannot
-- target it without restating the predicate. A guard is clearer.
where not exists (
  select 1 from public.listening_results lr
   where lr.source = v.source and lr.source_id = v.source_id
);

-- END 015_seed_demo_content.sql
