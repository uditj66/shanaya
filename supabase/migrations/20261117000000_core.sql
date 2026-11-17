-- ═══════════════════════════════════════════════════════════════
--  Shanaya platform — core schema (multi-salon)
-- ═══════════════════════════════════════════════════════════════
create extension if not exists btree_gist;

create type public.member_role as enum ('owner', 'manager', 'staff');
create type public.booking_status as enum ('confirmed', 'cancelled', 'completed', 'no_show');
create type public.booking_source as enum ('phone', 'web', 'staff');
create type public.call_channel as enum ('phone', 'web');
create type public.callback_status as enum ('open', 'done');

-- ── Salons (tenants) ───────────────────────────────────────────
create table public.salons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,50}$'),
  timezone text not null default 'Asia/Kolkata',
  currency text not null default 'INR',
  phone text,
  address text,
  website text,
  -- {"0": [["11:00","18:00"]], "1": [["10:00","20:00"]], "2": [] ...}  (0 = Sunday, [] = closed)
  business_hours jsonb not null default '{"0":[["11:00","18:00"]],"1":[["10:00","20:00"]],"2":[["10:00","20:00"]],"3":[["10:00","20:00"]],"4":[["10:00","20:00"]],"5":[["10:00","20:00"]],"6":[["10:00","20:00"]]}',
  slot_interval_minutes int not null default 15 check (slot_interval_minutes in (5, 10, 15, 20, 30, 60)),
  min_notice_minutes int not null default 60 check (min_notice_minutes >= 0),
  max_days_ahead int not null default 60 check (max_days_ahead between 1 and 365),
  -- AI agent settings
  agent_name text not null default 'Aria',
  agent_greeting text,
  agent_instructions text not null default '',
  policies text not null default '',
  llm_model text not null default 'gpt-6-luna',
  phone_llm_model text not null default 'gpt-4o',
  voice_provider text not null default '11labs',
  voice_id text,
  vapi_phone_number_id text unique,
  transfer_phone text,
  widget_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.salon_members (
  salon_id uuid not null references public.salons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (salon_id, user_id)
);
create index on public.salon_members (user_id);

-- ── Staff & schedules ──────────────────────────────────────────
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  name text not null,
  title text,
  color text not null default '#b4746b',
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.staff (salon_id);

create table public.staff_hours (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index on public.staff_hours (staff_id, weekday);

-- salon-wide closure (staff_id null) or one person's leave / break
create table public.time_off (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on public.time_off (salon_id, starts_at);

-- ── Services ───────────────────────────────────────────────────
create table public.services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  name text not null,
  category text not null default 'Facial',
  description text not null default '',
  duration_minutes int not null check (duration_minutes between 5 and 600),
  buffer_minutes int not null default 0 check (buffer_minutes between 0 and 120),
  price numeric(10, 2) not null default 0 check (price >= 0),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.services (salon_id);

create table public.staff_services (
  salon_id uuid not null references public.salons(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (staff_id, service_id)
);

-- ── Customers ──────────────────────────────────────────────────
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  name text not null,
  phone text not null,          -- normalised digits, e.g. 919876543210
  email text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (salon_id, phone)
);

-- ── Calls (phone + web conversations) ──────────────────────────
create table public.calls (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  channel public.call_channel not null,
  external_id text unique,
  customer_phone text,
  customer_id uuid references public.customers(id) on delete set null,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds int,
  ended_reason text,
  summary text,
  transcript text,
  recording_url text,
  cost numeric(10, 4),
  outcome text,
  created_at timestamptz not null default now()
);
create index on public.calls (salon_id, created_at desc);

-- ── Bookings ───────────────────────────────────────────────────
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  reference text not null default upper(substr(md5(random()::text), 1, 6)),
  staff_id uuid not null references public.staff(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  blocked_until timestamptz not null,         -- ends_at + cleanup buffer
  status public.booking_status not null default 'confirmed',
  source public.booking_source not null default 'staff',
  price numeric(10, 2) not null default 0,
  notes text not null default '',
  call_id uuid references public.calls(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, reference),
  check (ends_at > starts_at and blocked_until >= ends_at),
  -- The database itself refuses double-bookings for the same therapist, even under concurrent calls.
  constraint bookings_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(starts_at, blocked_until, '[)') with &&
  ) where (status = 'confirmed')
);
create index on public.bookings (salon_id, starts_at);
create index on public.bookings (customer_id);

create table public.callbacks (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  customer_name text,
  phone text,
  reason text not null,
  status public.callback_status not null default 'open',
  call_id uuid references public.calls(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);
create index on public.callbacks (salon_id, status, created_at desc);

-- ── updated_at trigger ─────────────────────────────────────────
create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

-- ═══════════════════════════════════════════════════════════════
--  Row level security: members only ever see their own salon.
--  The AI agent runs server-side with the service role and scopes every query by salon_id.
-- ═══════════════════════════════════════════════════════════════
create function public.is_member(p_salon uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from salon_members where salon_id = p_salon and user_id = auth.uid());
$$;

create function public.is_admin(p_salon uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from salon_members
                 where salon_id = p_salon and user_id = auth.uid() and role in ('owner', 'manager'));
$$;

alter table public.salons enable row level security;
create policy "members read salon" on public.salons for select using (public.is_member(id));
create policy "admins update salon" on public.salons for update using (public.is_admin(id)) with check (public.is_admin(id));

alter table public.salon_members enable row level security;
create policy "members read team" on public.salon_members for select using (public.is_member(salon_id));
create policy "admins manage team" on public.salon_members for all using (public.is_admin(salon_id)) with check (public.is_admin(salon_id));

-- Day-to-day tables: any member can read and write (front desk staff need to book).
do $$
declare t text;
begin
  foreach t in array array['bookings', 'customers', 'callbacks', 'time_off'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "members all" on public.%I for all using (public.is_member(salon_id)) with check (public.is_member(salon_id))', t);
  end loop;
  -- Configuration tables: members read, admins write.
  foreach t in array array['staff', 'staff_hours', 'services', 'staff_services'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "members read" on public.%I for select using (public.is_member(salon_id))', t);
    execute format('create policy "admins write" on public.%I for all using (public.is_admin(salon_id)) with check (public.is_admin(salon_id))', t);
  end loop;
end $$;

alter table public.calls enable row level security;
create policy "members read calls" on public.calls for select using (public.is_member(salon_id));

-- ── Onboarding: a signed-in user creates their salon and becomes its owner ──
create function public.create_salon(p_name text, p_slug text, p_timezone text default 'Asia/Kolkata', p_currency text default 'INR')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_salon uuid;
  v_staff uuid;
  d int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into salons (name, slug, timezone, currency) values (p_name, p_slug, p_timezone, p_currency) returning id into v_salon;
  insert into salon_members (salon_id, user_id, role) values (v_salon, auth.uid(), 'owner');
  insert into staff (salon_id, name, title) values (v_salon, 'Therapist 1', 'Skin Therapist') returning id into v_staff;
  for d in 0..6 loop
    insert into staff_hours (salon_id, staff_id, weekday, start_time, end_time)
    values (v_salon, v_staff, d, case when d = 0 then '11:00'::time else '10:00'::time end, case when d = 0 then '18:00'::time else '20:00'::time end);
  end loop;
  return v_salon;
end $$;
revoke execute on function public.create_salon from anon, public;
grant execute on function public.create_salon to authenticated;
revoke execute on function public.is_member, public.is_admin from anon, public;
grant execute on function public.is_member, public.is_admin to authenticated, service_role;

-- ── Realtime: dashboards update live when the AI books ─────────
alter publication supabase_realtime add table public.bookings, public.callbacks, public.calls;
