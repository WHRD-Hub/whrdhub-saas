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
