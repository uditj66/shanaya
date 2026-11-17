-- Multi-branch chain with a standard (SOP) catalogue.
alter table public.salons
  add column brand_name text,
  add column city text,
  add column area text,
  add column branch_code text unique,
  add column is_placeholder boolean not null default false,
  add column guest_profiles jsonb not null default '[]'::jsonb;

alter table public.services
  add column code text,
  add column suitable_for text[] not null default '{}',
  add column add_ons text[] not null default '{}',
  add column consultation_first boolean not null default false,  -- medical / multi-visit: request a consultation, never direct-book
  add column provider_note text;
create unique index services_salon_code on public.services (salon_id, code) where code is not null;

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  code text not null,
  name text not null,
  occasion text not null,
  target_customers text[] not null default '{}',
  price numeric(10, 2) not null check (price >= 0),
  visits int not null default 1 check (visits >= 1),
  validity_days int,
  description text not null default '',
  included_codes text[] not null default '{}',
  service_id uuid references public.services(id) on delete set null,  -- bookable single-visit package
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (salon_id, code)
);
alter table public.packages enable row level security;
create policy "members read" on public.packages for select using (private.is_member(salon_id));
create policy "admins write" on public.packages for all using (private.is_admin(salon_id)) with check (private.is_admin(salon_id));
