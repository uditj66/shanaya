-- Lumière brand site content (Phase 2). Safe to re-run: every insert is idempotent.
-- Studio coordinates are approximate area centres (branch addresses are still placeholders).
-- Testimonials, press, offers, memberships and lookbook rows are SAMPLES (is_sample = true): written to show the
-- design, hidden on the live site until real ones are added in the dashboard.

insert into public.brands (slug, name, full_name, tagline, story, agent_name, site_url, instagram, email, faqs)
values (
  'lumiere', 'Lumière', 'Lumière Facial Studio & Spa', 'Skin, in its finest light.',
  'Lumière began with a simple belief: that great skin is built slowly, by people who listen. Every studio follows one standard, the same rituals, the same products, the same price, so the facial you love in Bandra is exactly the facial you will find in Park Street. Our therapists train for months before they touch a guest, our physicians lead every medical treatment, and every room is designed around daylight, quiet and time.',
  'Shanaya', null, null, null,
  '[
    {"q": "Are prices the same at every studio?", "a": "Yes. Every Lumière studio follows the same standard menu and pricing. Prices exclude GST."},
    {"q": "How early should I arrive?", "a": "Please arrive 10 minutes before your appointment so we can settle you in and talk through your skin."},
    {"q": "Can I cancel or reschedule?", "a": "Free cancellation or rescheduling up to 4 hours before your appointment."},
    {"q": "Can I book a medi-facial online?", "a": "Medi-facials such as the Vampire Facial (PRP), Microneedling and Carbon Laser are performed by our aesthetic physician after a consultation. Request a consultation and we will call you to plan it."},
    {"q": "What should I tell you before my treatment?", "a": "Let us know about pregnancy, allergies, active skin conditions, recent peels or retinoid use, so your therapist can adjust or advise."},
    {"q": "How do I pay?", "a": "At the studio, by UPI, card or cash. Gift cards are available at every studio."}
  ]'::jsonb
)
on conflict (slug) do nothing;

-- ── Studios ─────────────────────────────────────────────────────
with b as (select id from public.brands where slug = 'lumiere'),
geo (code, studio_slug, lat, lng, n) as (values
  ('MUM-BAN', 'bandra-west', 19.0596, 72.8295, 1), ('MUM-JUH', 'juhu', 19.1075, 72.8263, 2),
  ('MUM-LOP', 'lower-parel', 18.9977, 72.8302, 3), ('MUM-MAL', 'malad-west', 19.1874, 72.8484, 4),
  ('DEL-GK2', 'greater-kailash-ii', 28.5310, 77.2436, 5), ('DEL-KHN', 'khan-market', 28.6002, 77.2270, 6),
  ('DEL-VVR', 'vasant-vihar', 28.5603, 77.1590, 1), ('BLR-IND', 'indiranagar', 12.9784, 77.6408, 2),
  ('BLR-KOR', 'koramangala', 12.9352, 77.6245, 3), ('BLR-WHF', 'whitefield', 12.9698, 77.7500, 4),
  ('KOL-PRK', 'park-street', 22.5535, 88.3520, 5), ('KOL-BAL', 'ballygunge', 22.5276, 88.3650, 6),
  ('CHE-NUN', 'nungambakkam', 13.0604, 80.2425, 1), ('CHE-ANN', 'anna-nagar', 13.0850, 80.2101, 2),
  ('JAI-CSC', 'c-scheme', 26.9110, 75.8010, 3), ('IND-VJN', 'vijay-nagar', 22.7533, 75.8937, 4),
  ('AHM-SBR', 'sindhu-bhavan-road', 23.0425, 72.5070, 5), ('LKO-GMN', 'gomti-nagar', 26.8500, 81.0000, 6),
  ('CHD-S09', 'sector-9', 30.7410, 76.7900, 1), ('GOA-PNJ', 'panaji', 15.4989, 73.8278, 2),
  ('GOA-CAN', 'candolim', 15.5180, 73.7630, 3)
),
pics (n, hero) as (values (1, 'studios.reception'), (2, 'studios.treatment-suite'), (3, 'studios.lounge'),
                          (4, 'studios.detail-marble'), (5, 'studios.basin'), (6, 'studios.manicure-bar'))
update public.salons s
set brand_id = (select id from b),
    studio_slug = g.studio_slug,
    latitude = g.lat,
    longitude = g.lng,
    hero_image = p.hero,
    gallery = array['studios.reception', 'studios.treatment-suite', 'studios.lounge', 'studios.detail-marble', 'studios.basin', 'studios.manicure-bar'],
    is_flagship = (g.code = 'MUM-BAN')
from geo g join pics p on p.n = g.n
where s.branch_code = g.code and s.brand_id is null;

-- ── Specialists: public profile from their role ─────────────────
with roles (title, idx, spec, years, bio) as (values
  ('Senior Skin Therapist', 1, array['Korean glass skin', 'Bridal skin programmes', 'Pigmentation and dullness'], 9,
   'leads skin at the studio. She reads skin before she treats it, and is the person brides ask for months before the wedding.'),
  ('Skin Therapist', 2, array['Hydrating facials', 'Acne-prone skin', 'Vitamin C brightening'], 5,
   'is known for gentle, thorough facials and for explaining exactly what your skin needs at home between visits.'),
  ('Aesthetic Physician', 3, array['Medi-facials', 'Microneedling', 'PRP and laser'], 11,
   'is our aesthetic physician. She leads every medical treatment personally, after a consultation, and will always tell you when less is more.'),
  ('Spa Therapist', 4, array['Hot stone massage', 'Aromatherapy', 'Body polishing'], 6,
   'brings calm, unhurried hands to every massage and body ritual, with pressure tailored to how you feel that day.'),
  ('Hair Stylist', 6, array['Hair spa', 'Keratin and smoothing', 'Colour and balayage'], 7,
   'looks after hair health first: scalp rituals, smoothing and colour that keeps its shine.'),
  ('Nail & Beauty Technician', 7, array['Spa manicures and pedicures', 'Brow shaping', 'Waxing'], 5,
   'is meticulous about the small things: clean cuticles, perfect brows and the finish that lasts.')
),
ranked as (
  select st.id, st.name, st.title, sa.city, row_number() over (partition by st.salon_id, st.title order by st.sort_order) as rn
  from public.staff st join public.salons sa on sa.id = st.salon_id
  where sa.brand_id = (select id from public.brands where slug = 'lumiere')
)
update public.staff st
set slug = trim(both '-' from lower(regexp_replace(r.name, '[^a-zA-Z0-9]+', '-', 'g'))),
    bio = r.name || ' ' || ro.bio,
    specialties = ro.spec,
    years_experience = ro.years - (r.rn::int - 1) * 2,
    portrait = 'stylists.0' || (case when ro.title = 'Spa Therapist' and r.rn = 2 then 5 else ro.idx end),
    languages = array['English', 'Hindi'] || case r.city
      when 'Mumbai' then array['Marathi'] when 'Bengaluru' then array['Kannada'] when 'Kolkata' then array['Bengali']
      when 'Chennai' then array['Tamil'] when 'Ahmedabad' then array['Gujarati'] when 'Chandigarh' then array['Punjabi']
      when 'Goa' then array['Konkani'] when 'Lucknow' then array['Urdu'] else array[]::text[] end
from ranked r join roles ro on ro.title = r.title
where st.id = r.id and st.slug is null;

-- ── Service pages ───────────────────────────────────────────────
insert into public.service_content (brand_id, code, slug, headline, image, featured, sort_order, ritual, benefits)
select b.id, v.code, v.slug, v.headline, v.image, v.featured, v.sort, v.ritual, v.benefits
from public.brands b, (values
  ('FAC001', 'korean-glass-skin-facial', 'Seven steps to a dewy, glass-like finish.', 'services.glass-skin', true, 1,
    array['Double cleanse and skin reading', 'Gentle enzyme exfoliation', 'Layered essences and ampoules', 'Hydrogel mask under LED light', 'Glass-skin finish with SPF'],
    array['Deep, lasting hydration', 'Smoother texture', 'A luminous, camera-ready glow']),
  ('FAC002', 'celebrity-glow-facial', 'The red-carpet facial, before any big night.', 'services.facials', true, 3,
    array['Cleanse and steam', 'Brightening peel', 'Lymphatic sculpting massage', 'Gold-infused sheet mask', 'Glow serum finish'],
    array['Instant radiance', 'Lifted, sculpted look', 'Make-up sits beautifully']),
  ('FAC003', 'hydrafacial', 'Cleanse, extract and hydrate in one hour.', 'services.hydra', true, 2,
    array['Vortex cleanse and peel', 'Painless extraction', 'Antioxidant and peptide infusion', 'LED finish'],
    array['Visibly clearer pores', 'Plumper, hydrated skin', 'No downtime']),
  ('FAC004', '24k-gold-facial', 'A golden ritual for tired, dull skin.', 'services.facials', false, 10, '{}', '{}'),
  ('FAC005', 'vitamin-c-brightening-facial', 'A clean burst of brightness for uneven tone.', 'services.detan', false, 11, '{}', '{}'),
  ('FAC006', 'collagen-boost-facial', 'Firmness and bounce for skin that has lost its spring.', 'services.facials', false, 12, '{}', '{}'),
  ('FAC007', 'acne-clarifying-facial', 'Calm, clear skin without stripping it.', 'services.facials', false, 13, '{}', '{}'),
  ('MED001', 'vampire-facial-prp', 'Physician-led renewal with your own platelets.', 'services.medi-facials', false, 20, '{}', '{}'),
  ('MED002', 'microneedling-facial', 'Collagen induction for texture and scarring.', 'services.medi-facials', false, 21, '{}', '{}'),
  ('MED003', 'carbon-laser-facial', 'The laser glow facial for pores and oil.', 'services.medi-facials', false, 22, '{}', '{}'),
  ('MED004', 'oxygeneo-facial', 'Exfoliate, infuse and oxygenate in one pass.', 'services.medi-facials', false, 23, '{}', '{}'),
  ('MED005', 'medi-brightening-facial', 'Clinical-grade brightening for stubborn pigmentation.', 'services.medi-facials', false, 24, '{}', '{}'),
  ('DTN001', 'full-face-detan', 'Thirty minutes to lift a summer of sun.', 'services.detan', false, 30, '{}', '{}'),
  ('DTN002', 'full-body-detan', 'Even, bright skin from shoulders to feet.', 'services.detan', false, 31, '{}', '{}'),
  ('SPA001', 'swedish-body-massage', 'Long, flowing strokes to let the week go.', 'services.body-spa', false, 40, '{}', '{}'),
  ('SPA002', 'deep-tissue-body-massage', 'Focused pressure for knots and tension.', 'services.body-spa', false, 41, '{}', '{}'),
  ('SPA003', 'aromatherapy-massage', 'Essential oils chosen for how you feel today.', 'services.body-spa', false, 42, '{}', '{}'),
  ('SPA004', 'hot-stone-massage', 'Warm basalt stones, slow hands, deep rest.', 'rituals.massage', true, 4,
    array['Warm oil and breathing', 'Heated basalt stones along the spine', 'Slow, deep strokes with the stones', 'Scalp and foot finish'],
    array['Releases deep muscle tension', 'Calms the nervous system', 'Better sleep that night']),
  ('SPA005', 'luxury-body-spa-ritual', 'Two hours that feel like a weekend away.', 'services.body-spa', false, 43, '{}', '{}'),
  ('BDY001', 'full-body-polishing', 'Silk-smooth skin, head to toe.', 'services.body-polish', false, 50, '{}', '{}'),
  ('BDY002', 'coffee-body-scrub', 'An energising scrub for soft, awake skin.', 'services.body-polish', false, 51, '{}', '{}'),
  ('BDY003', 'chocolate-body-wrap', 'A rich, nourishing cocoon for dry skin.', 'services.body-polish', false, 52, '{}', '{}'),
  ('HR001', 'luxury-hair-spa', 'A scalp ritual for soft, glossy, healthy hair.', 'services.hair-spa', true, 5,
    array['Scalp analysis', 'Warm oil scalp massage', 'Steam and deep-conditioning mask', 'Gentle wash and blow-dry'],
    array['Healthier scalp', 'Softer, shinier lengths', 'Less frizz and breakage']),
  ('HR002', 'keratin-hair-treatment', 'Smooth, manageable hair for months.', 'services.hair-spa', false, 60, '{}', '{}'),
  ('HR003', 'hair-botox-treatment', 'Deep repair for dry, damaged lengths.', 'services.hair-spa', false, 61, '{}', '{}'),
  ('HR004', 'haircut-and-styling', 'A considered cut that grows out beautifully.', 'services.hair-spa', false, 62, '{}', '{}'),
  ('HR005', 'global-hair-colour', 'Rich, even colour that keeps its shine.', 'services.hair-spa', false, 63, '{}', '{}'),
  ('HR006', 'balayage-and-highlights', 'Hand-painted light, soft and lived-in.', 'services.hair-spa', false, 64, '{}', '{}'),
  ('NA001', 'classic-manicure', 'Clean, shaped and polished.', 'services.nails', false, 70, '{}', '{}'),
  ('NA002', 'luxury-spa-manicure', 'A soak, scrub, mask and massage for your hands.', 'services.nails', true, 6,
    array['Warm milk soak', 'Cuticle care and shaping', 'Exfoliation and hydrating mask', 'Hand massage and polish'],
    array['Softer hands', 'Neat, healthy cuticles', 'A finish that lasts']),
  ('NA003', 'classic-pedicure', 'Fresh, tidy feet in under an hour.', 'services.nails', false, 71, '{}', '{}'),
  ('NA004', 'luxury-spa-pedicure', 'The full ritual for tired feet.', 'services.nails', false, 72, '{}', '{}'),
  ('GR001', 'eyebrow-threading', 'Precise brows, shaped to your face.', 'services.threading-waxing', false, 80, '{}', '{}'),
  ('GR002', 'full-face-threading', 'Smooth, even skin, gently done.', 'services.threading-waxing', false, 81, '{}', '{}'),
  ('GR003', 'full-arms-waxing', 'Quick, clean and kind to skin.', 'services.threading-waxing', false, 82, '{}', '{}'),
  ('GR004', 'full-legs-waxing', 'Smooth legs with soothing aftercare.', 'services.threading-waxing', false, 83, '{}', '{}'),
  ('GR005', 'full-body-waxing', 'Head-to-toe smoothness in one visit.', 'services.threading-waxing', false, 84, '{}', '{}')
) as v (code, slug, headline, image, featured, sort, ritual, benefits)
where b.slug = 'lumiere'
on conflict (brand_id, code) do nothing;

-- ── SAMPLE content (hidden on the live site until replaced) ─────
insert into public.testimonials (brand_id, salon_id, guest_name, quote, rating, service_code, is_sample, sort_order)
select b.id, s.id, t.name, t.quote, 5, t.code, true, t.n
from public.brands b
join (values
  (1, 'Riya', 'MUM-BAN', 'FAC001', 'I have never had a therapist explain my skin to me like that. Three weeks later it still looks rested.'),
  (2, 'Nandini', 'DEL-KHN', 'PKG001', 'They planned my skin for two months before the wedding. On the day, I needed almost no foundation.'),
  (3, 'Aisha', 'BLR-IND', 'SPA004', 'The quietest ninety minutes of my month. I booked the next one before I left.'),
  (4, 'Meenakshi', 'CHE-NUN', 'HR001', 'My hair finally feels like mine again: soft, light and so much less frizz.'),
  (5, 'Sohini', 'KOL-PRK', 'FAC003', 'Spotless rooms, kind people and skin that glowed for days. It feels like a five-star hotel.')
) as t (n, name, branch, code, quote) on true
join public.salons s on s.branch_code = t.branch
where b.slug = 'lumiere' and not exists (select 1 from public.testimonials x where x.brand_id = b.id);

insert into public.press (brand_id, publication, headline, year, is_sample, sort_order)
select b.id, p.pub, p.head, 2026, true, p.n
from public.brands b, (values
  (1, 'Sample publication', 'Sample: the facial studio everyone is booking before wedding season'),
  (2, 'Sample award', 'Sample: Best Day Spa, regional beauty awards'),
  (3, 'Sample magazine', 'Sample: ten treatments worth the trip'),
  (4, 'Sample newspaper', 'Sample: inside the studio that standardised luxury skincare')
) as p (n, pub, head)
where b.slug = 'lumiere' and not exists (select 1 from public.press x where x.brand_id = b.id);

insert into public.offers (brand_id, title, description, terms, image, service_code, is_sample, sort_order)
select b.id, o.title, o.descr, o.terms, o.img, o.code, true, o.n
from public.brands b, (values
  (1, 'Your first ritual', 'A complimentary LED light therapy add-on with your first facial at any studio.', 'Sample offer for design preview. Not a live offer.', 'rituals.mask-application', 'FAC001'),
  (2, 'Weekday quiet hours', 'Book a massage between 11:00 and 15:00, Monday to Thursday, and we will add a scalp ritual.', 'Sample offer for design preview. Not a live offer.', 'rituals.massage', 'SPA003'),
  (3, 'Bring a friend', 'Book two facials together and both of you receive a hydrating sheet mask to take home.', 'Sample offer for design preview. Not a live offer.', 'rituals.products', 'FAC003')
) as o (n, title, descr, terms, img, code)
where b.slug = 'lumiere' and not exists (select 1 from public.offers x where x.brand_id = b.id);

insert into public.memberships (brand_id, name, price, period, benefits, highlight, is_sample, sort_order)
select b.id, m.name, m.price, 'year', m.benefits, m.hl, true, m.n
from public.brands b, (values
  (1, 'Lumière Circle', 9999, false, array['One signature facial every quarter', 'Priority weekend booking', '10% off all services', 'Birthday ritual on us']),
  (2, 'Lumière Circle Gold', 24999, true, array['One signature facial every month', 'Priority booking at any studio', '15% off all services and packages', 'Complimentary add-on every visit', 'Two guest passes a year'])
) as m (n, name, price, hl, benefits)
where b.slug = 'lumiere' and not exists (select 1 from public.memberships x where x.brand_id = b.id);

insert into public.lookbook_items (brand_id, title, category, caption, image, service_code, is_sample, sort_order)
select b.id, l.title, l.cat, l.caption, l.img, l.code, true, l.n
from public.brands b, (values
  (1, 'Glass skin', 'Skin', 'After a Korean Glass Skin Facial.', 'lookbook.01', 'FAC001'),
  (2, 'Soft glow', 'Skin', 'Celebrity Glow Facial, the evening before a wedding.', 'lookbook.02', 'FAC002'),
  (3, 'Glossy lengths', 'Hair', 'Luxury Hair Spa with a smooth blow-dry.', 'lookbook.03', 'HR001'),
  (4, 'Quiet neutrals', 'Nails', 'Luxury Spa Manicure in a sheer nude.', 'lookbook.04', 'NA002'),
  (5, 'Bridal radiance', 'Bridal', 'Week six of the Royal Bridal Glow programme.', 'lookbook.05', 'PKG001'),
  (6, 'Calm, even tone', 'Skin', 'Vitamin C Brightening Facial.', 'lookbook.06', 'FAC005')
) as l (n, title, cat, caption, img, code)
where b.slug = 'lumiere' and not exists (select 1 from public.lookbook_items x where x.brand_id = b.id);

-- Before/after sample (kept unpublished: the frames don't align well enough to read as a comparison).
-- The slider appears automatically once a published lookbook item has real, consented before/after photos.
insert into public.lookbook_items (brand_id, title, category, caption, image, before_image, after_image, service_code, published, is_sample, sort_order)
select b.id, 'Fresh, rested skin', 'Skin', 'Sample pairing for the design preview: a hydrating sheet-mask ritual. Replace with real, consented client photos.',
       'lookbook.pair1-after', 'lookbook.pair1-before', 'lookbook.pair1-after', 'FAC001', false, true, 0
from public.brands b
where b.slug = 'lumiere' and not exists (select 1 from public.lookbook_items x where x.brand_id = b.id and x.before_image is not null);
