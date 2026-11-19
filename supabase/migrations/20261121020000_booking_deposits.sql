-- Booking deposits for online bookings (website and website chat). Phone and front-desk bookings never take one.
-- A booking waiting for its deposit is created as 'confirmed' (so the database's no-double-booking rule holds the slot)
-- with deposit_status 'pending' and a short hold; unpaid holds are released automatically every minute.

alter table public.brands
  add column deposit_amount integer not null default 500 check (deposit_amount between 0 and 100000),  -- rupees; 0 turns deposits off
  add column deposit_refund_hours integer not null default 24 check (deposit_refund_hours between 0 and 168),
  add column deposit_hold_minutes integer not null default 20 check (deposit_hold_minutes between 5 and 60);

alter table public.bookings
  add column deposit_amount numeric(10, 2),
  add column deposit_status text check (deposit_status in ('pending', 'paid', 'refunded', 'forfeited', 'applied', 'expired')),
  add column hold_expires_at timestamptz,
  add column pay_token text unique;
create index bookings_pending_holds on public.bookings (hold_expires_at) where deposit_status = 'pending';

-- Release slots whose deposit wasn't paid in time.
create or replace function public.release_expired_holds()
returns integer
language sql security definer set search_path = public as $$
  with released as (
    update bookings
       set status = 'cancelled', cancel_reason = 'Deposit not paid in time', deposit_status = 'expired', hold_expires_at = null, updated_at = now()
     where deposit_status = 'pending' and status = 'confirmed' and hold_expires_at < now()
    returning 1
  )
  select count(*)::int from released;
$$;
revoke execute on function public.release_expired_holds from public, anon, authenticated;
grant execute on function public.release_expired_holds to service_role;

create extension if not exists pg_cron;
select cron.schedule('release-expired-booking-holds', '* * * * *', $$select public.release_expired_holds()$$);
