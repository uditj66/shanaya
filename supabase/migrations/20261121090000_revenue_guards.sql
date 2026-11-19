-- Revenue guards (owner's rules, 2026-11-20).
--   1. Refund deadline per booking (refund_by = start − the brand's refund hours). Moving a booking before its
--      deadline sets a new deadline from the new time; moving it after the deadline keeps the old one, so a late
--      reschedule can't turn a kept deposit or gift card payment back into a refund.
--   2. Late cancels: a booking cancelled at or after its refund deadline is marked late_cancel. A late-cancelled
--      included treatment counts as used for its period (like a no-show) and isn't passed to another booking.
--   3. One deposit per treatment: chat visits no longer share one deposit, so an unpaid hold releases only itself.
--      (Before, it also cancelled the guest's other same-day chat bookings without a deposit, including member and
--      gift card bookings that were already secured.)

alter table public.bookings
  add column refund_by timestamptz,
  add column late_cancel boolean not null default false;

/** The brand's refund notice in hours for a studio (24 when the studio has no brand). */
create or replace function private.refund_hours(p_salon uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select b.deposit_refund_hours from salons s join brands b on b.id = s.brand_id where s.id = p_salon), 24);
$$;
revoke execute on function private.refund_hours from public, anon, authenticated;

create or replace function private.set_refund_by()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.refund_by := new.starts_at - make_interval(hours => private.refund_hours(new.salon_id));
  elsif old.refund_by is null or now() < old.refund_by then
    new.refund_by := new.starts_at - make_interval(hours => private.refund_hours(new.salon_id));
  else
    new.refund_by := old.refund_by; -- moved after the deadline: it stays passed
  end if;
  return new;
end;
$$;
revoke execute on function private.set_refund_by from public, anon, authenticated;

drop trigger if exists bookings_refund_by_insert on public.bookings;
create trigger bookings_refund_by_insert before insert on public.bookings
  for each row execute function private.set_refund_by();
drop trigger if exists bookings_refund_by_move on public.bookings;
create trigger bookings_refund_by_move before update of starts_at on public.bookings
  for each row when (new.starts_at is distinct from old.starts_at) execute function private.set_refund_by();

update public.bookings b set refund_by = b.starts_at - make_interval(hours => private.refund_hours(b.salon_id)) where refund_by is null;

-- Late-cancelled included treatments count against the allowance.
create or replace function private.member_benefit_for(p_membership uuid, p_booking uuid, p_starts_at timestamptz, p_service uuid, p_salon uuid, p_price numeric)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_mp public.membership_purchases%rowtype;
  v_tier public.memberships%rowtype;
  v_category text;
  v_price numeric;
  v_tz text;
  v_key text;
  v_used int;
begin
  select * into v_mp from membership_purchases where id = p_membership for update;
  if not found or v_mp.status <> 'active' then return null; end if;
  if v_mp.starts_at is not null and p_starts_at < v_mp.starts_at then return null; end if;
  if v_mp.ends_at is not null and p_starts_at >= v_mp.ends_at then return null; end if;
  select * into v_tier from memberships where id = v_mp.membership_id;
  if not found then return null; end if;
  select category, price into v_category, v_price from services where id = p_service;
  v_price := coalesce(p_price, v_price, 0);
  select coalesce(timezone, 'Asia/Kolkata') into v_tz from salons where id = p_salon;

  if v_tier.included_per_period > 0 and v_category = any (v_tier.included_categories) then
    v_key := private.member_period_key(p_starts_at, v_tier.included_period, v_tz);
    select count(*) into v_used from bookings
     where membership_purchase_id = p_membership and member_benefit = 'included'
       and (status <> 'cancelled' or late_cancel)
       and id <> p_booking and private.member_period_key(starts_at, v_tier.included_period, v_tz) = v_key;
    if v_used < v_tier.included_per_period then
      return jsonb_build_object('benefit', 'included', 'discount', v_price, 'tier', v_mp.tier_name,
        'included_left', v_tier.included_per_period - v_used - 1, 'included_period', v_tier.included_period);
    end if;
  end if;
  if v_tier.discount_pct > 0 then
    return jsonb_build_object('benefit', 'discount', 'discount', round(v_price * v_tier.discount_pct / 100), 'tier', v_mp.tier_name);
  end if;
  return null;
end;
$$;
revoke execute on function private.member_benefit_for from public, anon, authenticated;

-- A late-cancelled included treatment is used up, so there is nothing to pass on.
drop trigger if exists bookings_pass_on_included_cancel on public.bookings;
create trigger bookings_pass_on_included_cancel
  after update of status on public.bookings
  for each row
  when (old.member_benefit = 'included' and old.membership_purchase_id is not null
        and old.status <> 'cancelled' and new.status = 'cancelled' and not new.late_cancel)
  execute function private.pass_on_included_on_cancel();

-- Unpaid holds release only themselves (one deposit per treatment).
create or replace function public.release_expired_holds()
returns integer
language sql security definer set search_path = public as $$
  with expired as (
    update bookings
       set status = 'cancelled', cancel_reason = 'Deposit not paid in time', deposit_status = 'expired', hold_expires_at = null, updated_at = now()
     where deposit_status = 'pending' and status = 'confirmed' and hold_expires_at < now()
    returning 1
  )
  select count(*)::int from expired;
$$;
revoke execute on function public.release_expired_holds from public, anon, authenticated;
grant execute on function public.release_expired_holds to service_role;

-- Partial refunds (memberships refund the price minus benefits used): what actually went back, in paise.
alter table public.payments add column refund_amount integer check (refund_amount > 0);
