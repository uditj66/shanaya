-- Memberships bought online. Paid once for the tier's period (e.g. a year); renewal is a new purchase.
create type public.membership_status as enum ('pending', 'active', 'expired', 'cancelled');

create table public.membership_purchases (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  membership_id uuid references public.memberships(id) on delete set null,
  salon_id uuid references public.salons(id) on delete set null,          -- home studio, if chosen
  tier_name text not null,                                                -- kept even if the tier is later renamed
  price numeric(10, 2) not null check (price > 0),
  period text not null,
  name text not null,
  phone text not null,
  email text,
  status public.membership_status not null default 'pending',
  starts_at timestamptz,
  ends_at timestamptz,
  consent_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index membership_purchases_brand_time on public.membership_purchases (brand_id, created_at desc);
create index membership_purchases_phone on public.membership_purchases (brand_id, phone);
alter table public.membership_purchases enable row level security;
create policy "members read" on public.membership_purchases for select using (private.is_brand_member(brand_id));
