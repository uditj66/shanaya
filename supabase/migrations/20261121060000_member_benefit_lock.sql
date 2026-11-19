-- Member benefits decided in the database, one booking at a time per membership.
--   Before: the app counted this period's included treatments, then tagged the booking. Two bookings made at the same
--   moment could both see "none used", and a reschedule into a month already used kept its free treatment.
--   Now: the count and the tag happen under a lock on the membership, and moving an included booking re-checks the
--   allowance for its new date (falling back to the member discount when the new period is used up).

/** Allowance period of a moment, in the studio's time zone: '2026-11', '2026-Q4' or '2026'. */
create or replace function private.member_period_key(p_at timestamptz, p_period text, p_tz text)
returns text language sql immutable as $$
  select case p_period
    when 'year' then to_char(p_at at time zone p_tz, 'YYYY')
    when 'quarter' then to_char(p_at at time zone p_tz, 'YYYY-"Q"Q')
    else to_char(p_at at time zone p_tz, 'YYYY-MM')
  end;
$$;

/**
 * What a membership gives one booking: the included treatment while this period's allowance lasts, else the discount.
 * Locks the membership row, so two bookings on the same membership are decided one after the other.
 * Returns null when the membership isn't active or gives nothing for this treatment.
 */
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
  select * into v_tier from memberships where id = v_mp.membership_id;
  if not found then return null; end if;
  select category, price into v_category, v_price from services where id = p_service;
  v_price := coalesce(p_price, v_price, 0);
  select coalesce(timezone, 'Asia/Kolkata') into v_tz from salons where id = p_salon;

  if v_tier.included_per_period > 0 and v_category = any (v_tier.included_categories) then
    v_key := private.member_period_key(p_starts_at, v_tier.included_period, v_tz);
    select count(*) into v_used from bookings
     where membership_purchase_id = p_membership and member_benefit = 'included' and status <> 'cancelled'
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

/** Apply a membership to a just-made booking (the server only). Returns the benefit given, or null. */
create or replace function public.claim_member_benefit(p_booking uuid, p_membership uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_b public.bookings%rowtype;
  v_r jsonb;
begin
  select * into v_b from bookings where id = p_booking for update;
  if not found or v_b.status = 'cancelled' then return null; end if;
  v_r := private.member_benefit_for(p_membership, p_booking, v_b.starts_at, v_b.service_id, v_b.salon_id, v_b.price);
  if v_r is null then return null; end if;
  update bookings set membership_purchase_id = p_membership, member_benefit = v_r->>'benefit', member_discount = (v_r->>'discount')::numeric
   where id = p_booking;
  return v_r;
end;
$$;
revoke execute on function public.claim_member_benefit from public, anon, authenticated;
grant execute on function public.claim_member_benefit to service_role;

/**
 * Guard for every way a booking moves (AI reschedule, calendar drag, anything later): an included treatment moved to a
 * new date only stays free if that period still has allowance; otherwise it becomes the member discount (or nothing).
 */
create or replace function private.recheck_included_on_move()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_r jsonb;
begin
  v_r := private.member_benefit_for(new.membership_purchase_id, new.id, new.starts_at, new.service_id, new.salon_id, new.price);
  if v_r is null then
    new.member_benefit := null;
    new.member_discount := null;
  else
    new.member_benefit := v_r->>'benefit';
    new.member_discount := (v_r->>'discount')::numeric;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_recheck_included on public.bookings;
create trigger bookings_recheck_included
  before update of starts_at on public.bookings
  for each row
  when (new.member_benefit = 'included' and new.membership_purchase_id is not null and new.starts_at is distinct from old.starts_at)
  execute function private.recheck_included_on_move();
