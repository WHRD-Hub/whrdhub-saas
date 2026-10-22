-- Reporting updates: risks, free-text support details, country, service scope.
-- Idempotent. Also appended to install.sql, so run whichever you prefer once.

alter table public.reports
  add column if not exists risks text[] DEFAULT '{}'::text[],
  add column if not exists support_other text,
  add column if not exists country text;

alter table public.services
  add column if not exists country text;

-- Backfill the country for reports already filed (every earlier report came
-- from a Kenyan county or was typed by hand).
update public.reports
   set country = 'Kenya'
 where country is null and county is not null
   and county not in ('Uganda','Tanzania','DRC','Guinea');
update public.reports
   set country = county
 where country is null and county in ('Uganda','Tanzania','DRC','Guinea');

-- Matching: a service can be offered in one county, across a whole country, or
-- everywhere. Local beats country-wide beats everywhere.
create or replace function public.match_report_services(target uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  r public.reports%rowtype;
  n integer := 0;
begin
  select * into r from public.reports where id = target;
  if not found or r.deleted_at is not null then return 0; end if;
  if coalesce(array_length(r.support_needed, 1), 0) = 0 then return 0; end if;

  with matched as (
    select s.id,
           (case
              when r.county is not null and s.county = r.county then 80
              when s.county is null and s.country is not null and s.country = r.country then 70
              when s.county is null and s.country is null then 60
              else 35
            end
            + case r.urgency::text when 'immediate' then 15 when 'within_week' then 5 else 0 end
           ) as score,
           case
             when r.county is not null and s.county = r.county
               then 'Matched: ' || s.category::text || ' support in ' || r.county
             when s.county is null and s.country is not null and s.country = r.country
               then 'Matched: ' || s.category::text || ' support across ' || r.country
             when s.county is null and s.country is null
               then 'Matched: national ' || s.category::text || ' support'
             else 'Matched: nearest available ' || s.category::text || ' support'
           end as note
    from public.services s
    where s.is_active
      and s.category::text = any(r.support_needed)
      and (
        (r.county is not null and s.county = r.county)
        or (s.county is null and (s.country is null or r.country is null or s.country = r.country))
        or not exists (
          select 1 from public.services s2
           where s2.is_active and s2.category = s.category
             and (s2.county = r.county
                  or (s2.county is null and (s2.country is null or s2.country = r.country)))
        )
      )
  )
  insert into public.report_services (report_id, service_id, assigned_by, note, match_status, match_score)
  select r.id, m.id, r.verified_by, m.note, 'proposed', m.score from matched m
  on conflict (report_id, service_id) do nothing;

  get diagnostics n = row_count;
  return n;
end $$;

-- All 47 counties as networks (eight are live; the rest are selectable when
-- someone registers).
insert into public.county_networks (name, slug, is_active) values
  ('Baringo','baringo',false),('Bomet','bomet',true),('Bungoma','bungoma',false),('Busia','busia',false),
  ('Elgeyo Marakwet','elgeyo-marakwet',false),('Embu','embu',false),('Garissa','garissa',false),
  ('Homa Bay','homa-bay',false),('Isiolo','isiolo',false),('Kajiado','kajiado',false),
  ('Kakamega','kakamega',false),('Kericho','kericho',false),('Kiambu','kiambu',false),
  ('Kilifi','kilifi',false),('Kirinyaga','kirinyaga',false),('Kisii','kisii',false),
  ('Kisumu','kisumu',true),('Kitui','kitui',true),('Kwale','kwale',false),('Laikipia','laikipia',false),
  ('Lamu','lamu',false),('Machakos','machakos',false),('Makueni','makueni',false),
  ('Mandera','mandera',false),('Marsabit','marsabit',true),('Meru','meru',true),
  ('Migori','migori',false),('Mombasa','mombasa',true),('Murang''a','muranga',false),
  ('Nairobi','nairobi',true),('Nakuru','nakuru',true),('Nandi','nandi',false),('Narok','narok',false),
  ('Nyamira','nyamira',false),('Nyandarua','nyandarua',false),('Nyeri','nyeri',false),
  ('Samburu','samburu',false),('Siaya','siaya',false),('Taita Taveta','taita-taveta',false),
  ('Tana River','tana-river',false),('Tharaka Nithi','tharaka-nithi',false),
  ('Trans Nzoia','trans-nzoia',false),('Turkana','turkana',false),('Uasin Gishu','uasin-gishu',false),
  ('Vihiga','vihiga',false),('Wajir','wajir',false),('West Pokot','west-pokot',false)
on conflict (slug) do nothing;
