-- Online payments (Razorpay) and gift cards.
-- Money is stored in paise (integer) on payments, matching Razorpay; gift card balances are in rupees like prices.
-- Writes come only from the server (service role) after Razorpay signature checks; staff read, and redeem through a function.

create type public.payment_kind as enum ('gift_card', 'membership', 'deposit');
create type public.payment_status as enum ('created', 'paid', 'failed', 'refunded');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  salon_id uuid references public.salons(id) on delete set null,
  kind public.payment_kind not null,
  amount integer not null check (amount > 0),            -- paise
  currency text not null default 'INR',
  status public.payment_status not null default 'created',
  razorpay_order_id text not null unique,
  razorpay_payment_id text unique,
  method text,                                            -- upi, card, netbanking, wallet…
  payer_name text not null,
  payer_phone text not null,
  payer_email text,
  ref_id uuid,                                            -- the gift card / membership / booking it pays for
  error text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  refunded_at timestamptz
);
create index payments_brand_time on public.payments (brand_id, created_at desc);
create index payments_ref on public.payments (ref_id);
alter table public.payments enable row level security;
create policy "members read" on public.payments for select using (private.is_brand_member(brand_id));

create type public.gift_card_status as enum ('pending', 'active', 'redeemed', 'expired', 'cancelled');

create table public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  salon_id uuid references public.salons(id) on delete set null,     -- the buyer's preferred studio, if any
  code text not null unique check (code ~ '^[A-Z0-9-]{8,24}$'),       -- what the guest shows at the studio
  view_token text not null unique check (length(view_token) >= 24),   -- private link to view the card
  amount numeric(10, 2) not null check (amount between 500 and 100000),
  balance numeric(10, 2) not null check (balance >= 0),
  sender_name text not null,
  sender_phone text not null,
  sender_email text,
  recipient_name text not null,
  message text not null default '',
  status public.gift_card_status not null default 'pending',
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  expires_at timestamptz
);
create index gift_cards_brand_time on public.gift_cards (brand_id, created_at desc);
alter table public.gift_cards enable row level security;
create policy "members read" on public.gift_cards for select using (private.is_brand_member(brand_id));

create table public.gift_card_redemptions (
  id uuid primary key default gen_random_uuid(),
  gift_card_id uuid not null references public.gift_cards(id) on delete cascade,
  salon_id uuid not null references public.salons(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  note text not null default '',
  redeemed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index gift_card_redemptions_card on public.gift_card_redemptions (gift_card_id, created_at desc);
alter table public.gift_card_redemptions enable row level security;
create policy "members read" on public.gift_card_redemptions for select using (private.is_member(salon_id));

-- Redeem part or all of a gift card at a studio. Atomic (no double spend), and only for staff of that studio.
create or replace function public.redeem_gift_card(p_code text, p_amount numeric, p_salon uuid, p_note text default '')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_brand uuid;
  v_card public.gift_cards%rowtype;
begin
  if auth.uid() is null or not private.is_member(p_salon) then
    return jsonb_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'bad_amount');
  end if;
  select brand_id into v_brand from salons where id = p_salon;
  select * into v_card from gift_cards where code = upper(trim(p_code)) and brand_id = v_brand for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_card.status <> 'active' then return jsonb_build_object('ok', false, 'reason', v_card.status::text); end if;
  if v_card.expires_at is not null and v_card.expires_at < now() then
    update gift_cards set status = 'expired' where id = v_card.id;
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  if v_card.balance < p_amount then
    return jsonb_build_object('ok', false, 'reason', 'insufficient', 'balance', v_card.balance);
  end if;
  update gift_cards set balance = balance - p_amount, status = case when balance - p_amount = 0 then 'redeemed'::gift_card_status else status end
    where id = v_card.id;
  insert into gift_card_redemptions (gift_card_id, salon_id, amount, note, redeemed_by)
    values (v_card.id, p_salon, p_amount, left(coalesce(p_note, ''), 200), auth.uid());
  return jsonb_build_object('ok', true, 'balance', v_card.balance - p_amount);
end;
$$;
revoke execute on function public.redeem_gift_card from public, anon;
grant execute on function public.redeem_gift_card to authenticated;
