-- A freed included treatment passes to the member's next eligible booking in the same period.
--   Before: cancelling the free facial (or moving it to another month) freed the allowance, but the member's other
--   facial that month kept its discount; only a brand-new booking could take the free one.
--   Now: when an included booking is cancelled, or moved out of its period, the member's earliest upcoming confirmed
--   booking in that period for an included category becomes the included treatment. Bookings with a paid or pending
--   deposit, or paid with a gift card, are left alone (money already taken; the desk settles those).
--   The promoted booking records where its benefit came from (member_included_from), so callers can tell the guest.

alter table public.bookings
  add column member_included_from uuid references public.bookings(id) on delete set null;

/** Give a freed included treatment (membership p_membership, the period holding p_at) to the next eligible booking. */
create or replace function private.pass_on_included(p_membership uuid, p_at timestamptz, p_from uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_mp public.membership_purchases%rowtype;
  v_tier public.memberships%rowtype;
  v_tz text;
  v_key text;
  v_b public.bookings%rowtype;
  v_r jsonb;
begin
  select * into v_mp from membership_purchases where id = p_membership;
  if not found or v_mp.status <> 'active' then return null; end if;
  select * into v_tier from memberships where id = v_mp.membership_id;
  if not found or v_tier.included_per_period <= 0 then return null; end if;
  select coalesce(s.timezone, 'Asia/Kolkata') into v_tz from bookings b join salons s on s.id = b.salon_id where b.id = p_from;
  v_key := private.member_period_key(p_at, v_tier.included_period, coalesce(v_tz, 'Asia/Kolkata'));

  -- The member's bookings: linked to this membership, or (when the tier gave nothing at the time) made with the
  -- membership's mobile number at one of the brand's studios.
  select b.* into v_b
    from bookings b
    join services sv on sv.id = b.service_id
    join salons sl on sl.id = b.salon_id
    join customers c on c.id = b.customer_id
   where b.id <> p_from
     and b.status = 'confirmed'
     and b.starts_at > now()
     and (v_mp.ends_at is null or b.starts_at < v_mp.ends_at)
     and b.member_benefit is distinct from 'included'
     and (b.membership_purchase_id = p_membership
          or (b.membership_purchase_id is null and sl.brand_id = v_mp.brand_id and c.phone = v_mp.phone))
     and sv.category = any (v_tier.included_categories)
     and private.member_period_key(b.starts_at, v_tier.included_period, coalesce(sl.timezone, 'Asia/Kolkata')) = v_key
     and b.deposit_status is distinct from 'paid' and b.deposit_status is distinct from 'pending'
     and b.gift_card_state is distinct from 'used'
   order by b.starts_at
   limit 1
   for update of b;
  if not found then return null; end if;

  -- Same locked decision as at booking time, so the allowance can never be over-given.
  v_r := private.member_benefit_for(p_membership, v_b.id, v_b.starts_at, v_b.service_id, v_b.salon_id, v_b.price);
  if v_r is null or v_r->>'benefit' <> 'included' then return null; end if;
  update bookings
     set membership_purchase_id = p_membership, member_benefit = 'included', member_discount = (v_r->>'discount')::numeric,
         member_included_from = p_from, updated_at = now()
   where id = v_b.id;
  return v_b.id;
end;
$$;
revoke execute on function private.pass_on_included from public, anon, authenticated;

/** An included booking cancelled: its treatment passes on. */
create or replace function private.pass_on_included_on_cancel()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform private.pass_on_included(old.membership_purchase_id, old.starts_at, old.id);
  return null;
end;
$$;

drop trigger if exists bookings_pass_on_included_cancel on public.bookings;
create trigger bookings_pass_on_included_cancel
  after update of status on public.bookings
  for each row
  when (old.member_benefit = 'included' and old.membership_purchase_id is not null
        and old.status <> 'cancelled' and new.status = 'cancelled')
  execute function private.pass_on_included_on_cancel();

/** An included booking moved to another period (still included there or not): the old period's treatment passes on. */
create or replace function private.pass_on_included_on_move()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_period text;
  v_tz text;
begin
  select t.included_period into v_period
    from membership_purchases mp join memberships t on t.id = mp.membership_id where mp.id = old.membership_purchase_id;
  if v_period is null then return null; end if;
  select coalesce(timezone, 'Asia/Kolkata') into v_tz from salons where id = old.salon_id;
  if private.member_period_key(old.starts_at, v_period, v_tz) <> private.member_period_key(new.starts_at, v_period, v_tz) then
    perform private.pass_on_included(old.membership_purchase_id, old.starts_at, old.id);
  end if;
  return null;
end;
$$;

drop trigger if exists bookings_pass_on_included_move on public.bookings;
create trigger bookings_pass_on_included_move
  after update of starts_at on public.bookings
  for each row
  when (old.member_benefit = 'included' and old.membership_purchase_id is not null
        and new.status = 'confirmed' and new.starts_at is distinct from old.starts_at)
  execute function private.pass_on_included_on_move();

revoke execute on function private.pass_on_included_on_cancel from public, anon, authenticated;
revoke execute on function private.pass_on_included_on_move from public, anon, authenticated;
