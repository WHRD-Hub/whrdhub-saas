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
