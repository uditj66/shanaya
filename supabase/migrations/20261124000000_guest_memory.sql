-- What Shanaya remembers about a guest between conversations (concerns, occasions, preferences), keyed by mobile
-- number. Written by the server after each voice call; one row per guest per brand (the row lives on the branch of
-- her latest call, and older rows at sister branches are merged into it).
-- Health details are never stored here: they belong on the booking only.
create table public.guest_memory (
  salon_id uuid not null references public.salons(id) on delete cascade,
  phone text not null,               -- normalised digits, e.g. 919876543210 (same as customers.phone)
  notes jsonb not null default '[]'::jsonb,   -- [{ text, kind, until, at }]
  source_call_id uuid references public.calls(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (salon_id, phone)
);
create index guest_memory_phone on public.guest_memory (phone);

alter table public.guest_memory enable row level security;
-- The studio team can see, correct and clear what Shanaya remembers (dashboard). Guests never read it directly.
create policy "members read" on public.guest_memory for select using (private.is_member(salon_id));
create policy "members update" on public.guest_memory for update using (private.is_member(salon_id)) with check (private.is_member(salon_id));
create policy "members delete" on public.guest_memory for delete using (private.is_member(salon_id));
