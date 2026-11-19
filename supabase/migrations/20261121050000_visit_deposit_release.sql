-- One deposit per visit (chat): extra treatments booked in the same chat, same studio and day, carry no deposit of
-- their own. When the visit's deposit isn't paid in time, release those treatments together with the held one.
create or replace function public.release_expired_holds()
returns integer
language sql security definer set search_path = public as $$
  with expired as (
    update bookings
       set status = 'cancelled', cancel_reason = 'Deposit not paid in time', deposit_status = 'expired', hold_expires_at = null, updated_at = now()
     where deposit_status = 'pending' and status = 'confirmed' and hold_expires_at < now()
    returning id, call_id, salon_id, customer_id, starts_at
  ),
  same_visit as (
    update bookings b
       set status = 'cancelled', cancel_reason = 'Deposit for this visit not paid in time', updated_at = now()
      from expired e
     where e.call_id is not null and b.call_id = e.call_id and b.salon_id = e.salon_id and b.customer_id = e.customer_id
       and b.id <> e.id and b.status = 'confirmed' and b.deposit_status is null
       and (b.starts_at at time zone 'Asia/Kolkata')::date = (e.starts_at at time zone 'Asia/Kolkata')::date
    returning 1
  )
  select ((select count(*) from expired) + (select count(*) from same_visit))::int;
$$;
revoke execute on function public.release_expired_holds from public, anon, authenticated;
grant execute on function public.release_expired_holds to service_role;
