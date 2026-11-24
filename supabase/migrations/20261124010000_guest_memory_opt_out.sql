-- A guest can ask Shanaya to stop remembering her (DPDP Act: withdraw consent / erasure). The row then stays with
-- no notes and opted_out = true, so the after-call step knows not to start remembering her again.
alter table public.guest_memory add column opted_out boolean not null default false;

-- The front desk can add a note for a guest who has no memory row yet (dashboard → guest → What Shanaya remembers).
create policy "members insert" on public.guest_memory for insert with check (private.is_member(salon_id));
