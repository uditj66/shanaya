-- Member benefits only for appointments inside the membership's dates.
--   Before: the app checked the membership was valid *today*, and the database only checked status = 'active'
--   (nothing ever sets 'expired'). So a membership ending 30 Nov could book a free facial for 10 Dec, and a free
--   facial could be moved past the end date and stay free.
--   Now: member_benefit_for gives nothing when the appointment is before the membership starts or on/after it ends.
--   That one rule covers booking, every reschedule, and the free treatment passed on after a cancel.
--   Moving any member booking (not only an included one) re-checks its benefit, so a discount visit moved past the
--   end date loses the discount too.

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
  -- The appointment itself must fall inside the membership.
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

-- Re-check every member booking that moves (was: only included ones).
drop trigger if exists bookings_recheck_included on public.bookings;
create trigger bookings_recheck_included
  before update of starts_at on public.bookings
  for each row
  when (new.member_benefit is not null and new.membership_purchase_id is not null and new.starts_at is distinct from old.starts_at)
  execute function private.recheck_included_on_move();
