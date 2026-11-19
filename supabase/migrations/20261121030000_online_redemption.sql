-- Online redemption when booking on the website.
--   Gift cards: the code pays the treatment price at booking (up to the balance). No deposit is taken then.
--     Cancelled with enough notice (the brand's deposit_refund_hours) puts the amount back on the card; later it's kept.
--   Memberships: recognised by the booking's mobile number. Members skip the deposit, get their discount, and
--     the included treatment (e.g. one signature facial a month) books at no charge while the allowance lasts.

-- What each tier gives at booking (the text `benefits` stay as the marketing copy).
alter table public.memberships
  add column discount_pct int not null default 0 check (discount_pct between 0 and 100),
  add column skip_deposit boolean not null default true,
  add column included_per_period int not null default 0 check (included_per_period >= 0),
  add column included_period text not null default 'month' check (included_period in ('month', 'quarter', 'year')),
  add column included_categories text[] not null default '{}';

update public.memberships set discount_pct = 10, included_per_period = 1, included_period = 'quarter', included_categories = '{Luxury Facials}'
  where name = 'Lumière Circle';
update public.memberships set discount_pct = 15, included_per_period = 1, included_period = 'month', included_categories = '{Luxury Facials}'
  where name = 'Lumière Circle Gold';

-- How a booking is being paid for, beyond the deposit.
alter table public.bookings
  add column gift_card_id uuid references public.gift_cards(id) on delete set null,
  add column gift_card_amount numeric(10, 2),
  add column gift_card_state text check (gift_card_state in ('used', 'returned', 'kept')),
  add column membership_purchase_id uuid references public.membership_purchases(id) on delete set null,
  add column member_benefit text check (member_benefit in ('discount', 'included')),
  add column member_discount numeric(10, 2);
create index bookings_member_included on public.bookings (membership_purchase_id, starts_at) where member_benefit = 'included';

-- Redemptions can come from a booking, and a returned amount is recorded as a negative line.
alter table public.gift_card_redemptions
  add column booking_id uuid references public.bookings(id) on delete set null,
  drop constraint gift_card_redemptions_amount_check,
  add constraint gift_card_redemptions_amount_check check (amount <> 0);

/** Take up to p_max off a gift card for an online booking (atomic; the server only, never the browser). */
create or replace function public.redeem_gift_card_for_booking(p_code text, p_booking uuid, p_max numeric)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_booking public.bookings%rowtype;
  v_brand uuid;
  v_card public.gift_cards%rowtype;
  v_take numeric;
begin
  if p_max is null or p_max <= 0 then return jsonb_build_object('ok', false, 'reason', 'bad_amount'); end if;
  select * into v_booking from bookings where id = p_booking for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_booking.gift_card_id is not null then return jsonb_build_object('ok', false, 'reason', 'already_used'); end if;
  select brand_id into v_brand from salons where id = v_booking.salon_id;
  select * into v_card from gift_cards where code = upper(trim(p_code)) and brand_id = v_brand for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_card.status <> 'active' then return jsonb_build_object('ok', false, 'reason', v_card.status::text); end if;
  if v_card.expires_at is not null and v_card.expires_at < now() then
    update gift_cards set status = 'expired' where id = v_card.id;
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  v_take := least(v_card.balance, p_max);
  if v_take <= 0 then return jsonb_build_object('ok', false, 'reason', 'redeemed'); end if;
  update gift_cards set balance = balance - v_take, status = case when balance - v_take = 0 then 'redeemed'::gift_card_status else status end
    where id = v_card.id;
  insert into gift_card_redemptions (gift_card_id, salon_id, amount, note, booking_id)
    values (v_card.id, v_booking.salon_id, v_take, 'Online booking ' || v_booking.reference, v_booking.id);
  update bookings set gift_card_id = v_card.id, gift_card_amount = v_take, gift_card_state = 'used' where id = v_booking.id;
  return jsonb_build_object('ok', true, 'amount', v_take, 'balance', v_card.balance - v_take);
end;
$$;
revoke execute on function public.redeem_gift_card_for_booking from public, anon, authenticated;
grant execute on function public.redeem_gift_card_for_booking to service_role;

/** Put a cancelled booking's gift card amount back on the card (once). */
create or replace function public.return_gift_card_for_booking(p_booking uuid)
returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_booking public.bookings%rowtype;
begin
  select * into v_booking from bookings where id = p_booking for update;
  if not found or v_booking.gift_card_state is distinct from 'used' or coalesce(v_booking.gift_card_amount, 0) <= 0 then return 0; end if;
  update gift_cards
     set balance = balance + v_booking.gift_card_amount,
         status = case when status = 'redeemed' and (expires_at is null or expires_at > now()) then 'active'::gift_card_status else status end
   where id = v_booking.gift_card_id;
  insert into gift_card_redemptions (gift_card_id, salon_id, amount, note, booking_id)
    values (v_booking.gift_card_id, v_booking.salon_id, -v_booking.gift_card_amount, 'Returned: booking ' || v_booking.reference || ' cancelled', v_booking.id);
  update bookings set gift_card_state = 'returned' where id = v_booking.id;
  return v_booking.gift_card_amount;
end;
$$;
revoke execute on function public.return_gift_card_for_booking from public, anon, authenticated;
grant execute on function public.return_gift_card_for_booking to service_role;
