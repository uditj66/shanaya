-- Phase 4: dashboard roles, guest CRM fields, website analytics.

-- ── Roles: owner · manager · receptionist · stylist (legacy "staff" behaves as receptionist) ──
alter type public.member_role add value if not exists 'receptionist';
alter type public.member_role add value if not exists 'stylist';

-- A stylist's login is linked to their therapist row so they see their own column and guests.
alter table public.salon_members add column if not exists staff_id uuid references public.staff(id) on delete set null;

-- ── Guests (CRM) ──
alter table public.customers
  add column if not exists tags text[] not null default '{}',
  add column if not exists preferences text not null default '';

-- ── Website analytics (first-party, privacy-friendly: no IP, no cookies; a random per-tab session id) ──
create table if not exists public.site_events (
  id bigint generated always as identity primary key,
  brand_id uuid not null references public.brands(id) on delete cascade,
  session_id text not null check (length(session_id) between 8 and 64),
  kind text not null check (kind in ('page_view', 'booking_step', 'booking_done', 'chat_open', 'chat_message', 'enquiry')),
  path text not null default '' check (length(path) <= 200),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists site_events_brand_time on public.site_events (brand_id, created_at desc);
create index if not exists site_events_brand_kind_time on public.site_events (brand_id, kind, created_at desc);
alter table public.site_events enable row level security;
drop policy if exists "members read" on public.site_events;
create policy "members read" on public.site_events for select using (private.is_brand_member(brand_id));
-- inserts come only from the server (/api/track, rate limited)

-- Per-guest totals for the dashboard CRM. security_invoker: the caller's row level security applies.
create or replace view public.guest_summary with (security_invoker = true) as
select
  c.id, c.salon_id, c.name, c.phone, c.email, c.tags, c.created_at,
  count(b.id) filter (where b.status in ('confirmed', 'completed') and b.starts_at < now()) as visits,
  count(b.id) filter (where b.status = 'confirmed' and b.starts_at >= now()) as upcoming,
  coalesce(sum(b.price) filter (where b.status in ('confirmed', 'completed') and b.starts_at < now()), 0) as spend,
  max(b.starts_at) filter (where b.status in ('confirmed', 'completed') and b.starts_at < now()) as last_visit,
  min(b.starts_at) filter (where b.status = 'confirmed' and b.starts_at >= now()) as next_visit
from public.customers c
left join public.bookings b on b.customer_id = c.id
group by c.id;
grant select on public.guest_summary to authenticated;
