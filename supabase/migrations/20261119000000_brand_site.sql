-- ═══════════════════════════════════════════════════════════════
--  Brand websites (Phase 2): brands, public studio + specialist details, page content, enquiries.
--  Public pages read through the server (service role, explicit column lists, cached); nothing here
--  is readable by anonymous browsers directly. Staff manage it from the dashboard (Phase 4).
--  Rows marked is_sample are illustrative placeholders: the site hides them unless SHOW_SAMPLE_CONTENT=true.
-- ═══════════════════════════════════════════════════════════════

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null,                  -- wordmark, e.g. Lumière
  full_name text not null,
  tagline text not null default '',
  story text not null default '',
  agent_name text not null default 'Shanaya',
  site_url text,
  currency text not null default 'INR',
  locale text not null default 'en-IN',
  instagram text,
  email text,
  phone text,
  faqs jsonb not null default '[]'::jsonb,            -- [{q, a}]
  nudge_settings jsonb not null default '{"enabled": true, "delay_seconds": 20, "scroll_ratio": 0.5, "max_per_session": 2}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.salons
  add column brand_id uuid references public.brands(id) on delete set null,
  add column studio_slug text check (studio_slug ~ '^[a-z0-9-]{2,60}$'),
  add column latitude double precision,
  add column longitude double precision,
  add column hero_image text,                -- public/images manifest id
  add column gallery text[] not null default '{}',
  add column is_flagship boolean not null default false,
  add column published boolean not null default true;
create unique index salons_brand_studio_slug on public.salons (brand_id, studio_slug) where brand_id is not null;

alter table public.staff
  add column slug text check (slug ~ '^[a-z0-9-]{2,80}$'),
  add column bio text not null default '',
  add column specialties text[] not null default '{}',
  add column languages text[] not null default '{}',
  add column years_experience int check (years_experience between 0 and 60),
  add column portrait text,                  -- manifest id
  add column portfolio text[] not null default '{}',
  add column public_profile boolean not null default true;
create unique index staff_salon_slug on public.staff (salon_id, slug) where slug is not null;

-- Brand-level page content for each catalogue service code (prices/durations stay on services, per branch).
create table public.service_content (
  brand_id uuid not null references public.brands(id) on delete cascade,
  code text not null,
  slug text not null check (slug ~ '^[a-z0-9-]{2,80}$'),
  headline text not null default '',
  image text,
  featured boolean not null default false,
  sort_order int not null default 0,
  ritual text[] not null default '{}',       -- what happens, step by step
  benefits text[] not null default '{}',
  primary key (brand_id, code),
  unique (brand_id, slug)
);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  salon_id uuid references public.salons(id) on delete set null,
  guest_name text not null,
  quote text not null,
  rating smallint not null default 5 check (rating between 1 and 5),
  service_code text,
  published boolean not null default true,
  is_sample boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.press (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  publication text not null,
  headline text not null,
  url text,
  year int,
  published boolean not null default true,
  is_sample boolean not null default false,
  sort_order int not null default 0
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  title text not null,
  description text not null,
  terms text not null default '',
  image text,
  service_code text,
  starts_on date,
  ends_on date,
  published boolean not null default true,
  is_sample boolean not null default false,
  sort_order int not null default 0
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  price numeric(10, 2) not null check (price >= 0),
  period text not null default 'year',
  benefits text[] not null default '{}',
  highlight boolean not null default false,
  published boolean not null default true,
  is_sample boolean not null default false,
  sort_order int not null default 0
);

create table public.lookbook_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  title text not null,
  category text not null,
  caption text not null default '',
  image text not null,                      -- manifest id
  before_image text,                        -- before/after pairs need real, consented client photos
  after_image text,
  service_code text,
  published boolean not null default true,
  is_sample boolean not null default false,
  sort_order int not null default 0
);

-- Enquiries from the website (written by the server after validation + rate limiting).
create type public.enquiry_status as enum ('new', 'contacted', 'converted', 'closed');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  salon_id uuid references public.salons(id) on delete set null,
  kind text not null check (kind in ('contact', 'membership', 'consultation', 'chat')),
  name text not null,
  phone text,
  email text,
  message text not null default '',
  consent_at timestamptz not null,
  status public.enquiry_status not null default 'new',
  created_at timestamptz not null default now()
);
create index on public.leads (brand_id, created_at desc);

create table public.gift_card_requests (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  salon_id uuid references public.salons(id) on delete set null,
  amount numeric(10, 2) not null check (amount between 500 and 100000),
  sender_name text not null,
  sender_phone text not null,
  sender_email text,
  recipient_name text not null,
  message text not null default '',
  consent_at timestamptz not null,
  status public.enquiry_status not null default 'new',
  created_at timestamptz not null default now()
);

create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  role text not null,
  city text not null,
  name text not null,
  phone text not null,
  email text not null,
  experience_years int,
  message text not null default '',
  consent_at timestamptz not null,
  status public.enquiry_status not null default 'new',
  created_at timestamptz not null default now()
);

-- ── Security ───────────────────────────────────────────────────
create function private.is_brand_member(p_brand uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from salon_members m join salons s on s.id = m.salon_id
                 where s.brand_id = p_brand and m.user_id = auth.uid());
$$;
create function private.is_brand_admin(p_brand uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from salon_members m join salons s on s.id = m.salon_id
                 where s.brand_id = p_brand and m.user_id = auth.uid() and m.role in ('owner', 'manager'));
$$;
revoke execute on function private.is_brand_member, private.is_brand_admin from public, anon;
grant execute on function private.is_brand_member, private.is_brand_admin to authenticated, service_role;

alter table public.brands enable row level security;
create policy "members read brand" on public.brands for select using (private.is_brand_member(id));
create policy "admins update brand" on public.brands for update using (private.is_brand_admin(id)) with check (private.is_brand_admin(id));

do $$
declare t text;
begin
  -- Site content: members read, owners/managers edit.
  foreach t in array array['service_content', 'testimonials', 'press', 'offers', 'memberships', 'lookbook_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "members read" on public.%I for select using (private.is_brand_member(brand_id))', t);
    execute format('create policy "admins write" on public.%I for all using (private.is_brand_admin(brand_id)) with check (private.is_brand_admin(brand_id))', t);
  end loop;
  -- Enquiries: members read and update status; inserts come only from the server.
  foreach t in array array['leads', 'gift_card_requests', 'job_applications'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "members read" on public.%I for select using (private.is_brand_member(brand_id))', t);
    execute format('create policy "members update" on public.%I for update using (private.is_brand_member(brand_id)) with check (private.is_brand_member(brand_id))', t);
  end loop;
end $$;
