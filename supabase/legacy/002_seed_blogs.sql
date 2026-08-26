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
