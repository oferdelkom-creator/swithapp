-- SwitchApp schema, reconstructed from the live Supabase project
-- (hltpqflqngtrmprayyvd, eu-west-3) on 2026-08-14.
--
-- This is a snapshot for reference/versioning. The live project already has
-- this schema applied - do not re-run blindly against it. Use this file as
-- the starting point for a fresh project, or as a diffing baseline.

-- ── Enums ────────────────────────────────────────────────────────────────

create type user_role as enum ('private', 'dealer', 'importer');
create type billing_plan as enum ('subscription', 'per_listing');
create type fuel_type as enum ('Petrol', 'Diesel', 'Hybrid', 'Electric', 'Gas');
create type car_region as enum (
  'North', 'Haifa', 'Center', 'Tel Aviv', 'Jerusalem', 'Shfela', 'South',
  'Judea and Samaria'
);
-- 'chat' added 2026-08-14: ordinary between-match messages. 'report' is reserved for
-- actual user reports (surfaced in /admin); 'hello' is unused in switchapp (leftover
-- from cross-contamination with a different Supabase project - see README).
create type message_kind as enum ('report', 'hello', 'chat');

-- ── Tables ───────────────────────────────────────────────────────────────

create table public.users (
  id uuid primary key references auth.users (id),
  name text not null,
  avatar_url text,
  lat double precision,
  lon double precision,
  role user_role not null default 'private',
  business_name text,
  billing_plan billing_plan,
  subscription_valid_until timestamptz,
  premium_until timestamptz,
  accepts_hello_messages boolean not null default true,
  is_admin boolean not null default false,
  is_banned boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.user_contacts (
  user_id uuid primary key references public.users (id),
  phone text not null unique
);

create table public.cars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id),
  make text not null,
  model text not null,
  year integer,
  mileage integer,
  transmission text default 'Automatic',
  category text default 'Other',
  color text,
  photo_urls text[] not null default '{}',
  price numeric,
  hand integer check (hand is null or hand >= 0),
  fuel_type fuel_type,
  region car_region,
  for_sale boolean not null default true,
  for_swap boolean not null default true,
  want_make text,
  want_model text,
  want_notes text,
  listing_fee_paid boolean not null default false,
  boosted_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.swipes (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.users (id),
  to_user_id uuid not null references public.users (id),
  car_id uuid not null references public.cars (id),
  direction text not null check (direction in ('left', 'right')),
  created_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references public.users (id),
  user_b_id uuid not null references public.users (id),
  status text not null default 'negotiating' check (status in ('negotiating', 'closed')),
  user_a_agreed_to_call boolean not null default false,
  user_b_agreed_to_call boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_a_id, user_b_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id),
  sender_id uuid not null references public.users (id),
  text text not null,
  kind message_kind not null default 'chat',
  created_at timestamptz not null default now()
);

create table public.blocks (
  blocker_id uuid not null references public.users (id),
  blocked_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- ── Functions ────────────────────────────────────────────────────────────

create or replace function public.haversine_km(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns double precision
language sql
immutable
as $$
  select 6371 * 2 * asin(
    sqrt(
      sin(radians(lat2 - lat1) / 2) ^ 2 +
      cos(radians(lat1)) * cos(radians(lat2)) *
      sin(radians(lon2 - lon1) / 2) ^ 2
    )
  );
$$;

-- Enforces that each side of a match can only set their own "agreed to call" flag.
create or replace function public.enforce_match_consent_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.user_a_agreed_to_call is distinct from old.user_a_agreed_to_call
     and auth.uid() <> old.user_a_id then
    raise exception 'Only user_a can set user_a_agreed_to_call';
  end if;
  if new.user_b_agreed_to_call is distinct from old.user_b_agreed_to_call
     and auth.uid() <> old.user_b_id then
    raise exception 'Only user_b can set user_b_agreed_to_call';
  end if;
  return new;
end;
$$;

create trigger before_match_consent_update
  before update on public.matches
  for each row execute function public.enforce_match_consent_update();

-- On a right-swipe: instant match for "for sale" cars, mutual-swipe match for "for swap" cars.
create or replace function public.handle_new_swipe()
returns trigger
language plpgsql
security definer
as $$
declare
  reciprocal_exists boolean;
  car_for_sale boolean;
  car_for_swap boolean;
  a uuid;
  b uuid;
begin
  if new.direction = 'right' then
    select for_sale, for_swap into car_for_sale, car_for_swap
    from public.cars where id = new.car_id;

    if new.from_user_id < new.to_user_id then
      a := new.from_user_id; b := new.to_user_id;
    else
      a := new.to_user_id; b := new.from_user_id;
    end if;

    if car_for_sale then
      insert into public.matches (user_a_id, user_b_id)
      values (a, b)
      on conflict (user_a_id, user_b_id) do nothing;
    elsif car_for_swap then
      select exists (
        select 1 from public.swipes
        where from_user_id = new.to_user_id
          and to_user_id = new.from_user_id
          and direction = 'right'
      ) into reciprocal_exists;

      if reciprocal_exists then
        insert into public.matches (user_a_id, user_b_id)
        values (a, b)
        on conflict (user_a_id, user_b_id) do nothing;
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger on_swipe_created
  after insert on public.swipes
  for each row execute function public.handle_new_swipe();

-- RPC: swap-deck candidates near the caller, excluding already-swiped cars.
create or replace function public.nearby_swap_cars(my_lat double precision, my_lon double precision, my_id uuid)
returns table (
  user_id uuid, name text, lat double precision, lon double precision,
  distance_km double precision,
  car_id uuid, make text, model text, year integer, mileage integer, transmission text,
  photo_urls text[], want_make text, want_notes text, price numeric
)
language sql
stable
as $$
  select
    u.id, u.name, u.lat, u.lon,
    public.haversine_km(my_lat, my_lon, u.lat, u.lon) as distance_km,
    c.id, c.make, c.model, c.year, c.mileage, c.transmission, c.photo_urls,
    c.want_make, c.want_notes, c.price
  from public.users u
  join public.cars c on c.user_id = u.id
  where c.for_swap = true
    and u.id <> my_id
    and not exists (
      select 1 from public.swipes s
      where s.from_user_id = my_id and s.car_id = c.id
    )
    and (
      (select role from public.users where id = my_id) = 'private'
      or u.role in ('dealer', 'importer')
    )
  order by (c.boosted_until > now()) desc nulls last, distance_km asc nulls last;
$$;

-- RPC: sale-deck candidates with filters, excluding already-swiped cars.
create or replace function public.cars_for_sale(
  my_id uuid,
  p_make text default null, p_min_price numeric default null, p_max_price numeric default null,
  p_min_year integer default null, p_max_year integer default null, p_max_mileage integer default null,
  p_transmission text default null, p_category text default null, p_color text default null,
  p_fuel_type fuel_type default null, p_region car_region default null, p_max_hand integer default null
)
returns table (
  user_id uuid, seller_name text, seller_role user_role,
  car_id uuid, make text, model text, year integer, mileage integer, transmission text,
  category text, color text, photo_urls text[], price numeric, hand integer,
  fuel_type fuel_type, region car_region
)
language sql
stable
as $$
  select
    u.id, u.name, u.role,
    c.id, c.make, c.model, c.year, c.mileage, c.transmission, c.category, c.color,
    c.photo_urls, c.price, c.hand, c.fuel_type, c.region
  from public.cars c
  join public.users u on u.id = c.user_id
  where c.for_sale = true
    and c.user_id <> my_id
    and not exists (
      select 1 from public.swipes s
      where s.from_user_id = my_id and s.car_id = c.id
    )
    and (
      (select role from public.users where id = my_id) = 'private'
      or u.role in ('dealer', 'importer')
    )
    and (p_make is null or c.make = p_make)
    and (p_min_price is null or c.price >= p_min_price)
    and (p_max_price is null or c.price <= p_max_price)
    and (p_min_year is null or c.year >= p_min_year)
    and (p_max_year is null or c.year <= p_max_year)
    and (p_max_mileage is null or c.mileage <= p_max_mileage)
    and (p_transmission is null or c.transmission = p_transmission)
    and (p_category is null or c.category = p_category)
    and (p_color is null or c.color = p_color)
    and (p_fuel_type is null or c.fuel_type = p_fuel_type)
    and (p_region is null or c.region = p_region)
    and (p_max_hand is null or c.hand <= p_max_hand)
  order by (c.boosted_until > now()) desc nulls last, c.created_at desc;
$$;

-- RPC: "who liked you" - premium-only, shows right-swipes the caller hasn't reciprocated yet.
create or replace function public.get_incoming_likes(my_id uuid)
returns table (
  from_user_id uuid, from_user_name text, car_id uuid, make text, model text, year integer,
  photo_urls text[], liked_at timestamptz
)
language sql
stable
as $$
  select distinct on (s.from_user_id)
    s.from_user_id, u.name, c.id, c.make, c.model, c.year, c.photo_urls, s.created_at
  from public.swipes s
  join public.users u on u.id = s.from_user_id
  join public.cars c on c.user_id = s.from_user_id and c.for_swap = true
  where s.to_user_id = my_id
    and s.direction = 'right'
    and (select premium_until from public.users where id = my_id) > now()
    and not exists (
      select 1 from public.swipes s2
      where s2.from_user_id = my_id
        and s2.to_user_id = s.from_user_id
        and s2.direction = 'right'
    )
  order by s.from_user_id, s.created_at desc;
$$;

-- ── Row Level Security ───────────────────────────────────────────────────

alter table public.users enable row level security;
alter table public.user_contacts enable row level security;
alter table public.cars enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;

create policy "Users can view all profiles" on public.users
  for select using (true);
create policy "Users can insert their own profile" on public.users
  for insert with check (auth.uid() = id);
create policy "Users can update their own profile" on public.users
  for update using (auth.uid() = id);

create policy "Users can view their own phone" on public.user_contacts
  for select using (auth.uid() = user_id);
create policy "Users can view a matched contact's phone after mutual consent" on public.user_contacts
  for select using (
    exists (
      select 1 from public.matches m
      where m.user_a_agreed_to_call and m.user_b_agreed_to_call
        and ((m.user_a_id = auth.uid() and m.user_b_id = user_contacts.user_id)
          or (m.user_b_id = auth.uid() and m.user_a_id = user_contacts.user_id))
    )
  );
create policy "Users can insert their own contact row" on public.user_contacts
  for insert with check (auth.uid() = user_id);
create policy "Users can update their own contact row" on public.user_contacts
  for update using (auth.uid() = user_id);

create policy "Anyone can view listed cars" on public.cars
  for select using (true);
create policy "Users can insert their own car" on public.cars
  for insert with check (auth.uid() = user_id);
create policy "Users can update their own car" on public.cars
  for update using (auth.uid() = user_id);
create policy "Users can delete their own car" on public.cars
  for delete using (auth.uid() = user_id);

create policy "Users can view their own swipes" on public.swipes
  for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);
-- from_user_id must be the caller; to_user_id must be the car's actual owner; capped at
-- 20 swipes/day unless premium; private users can swipe on dealer/importer cars freely,
-- dealers/importers can only swipe back at someone who already swiped right on them.
create policy "Users can insert their own swipes" on public.swipes
  for insert with check (
    auth.uid() = from_user_id
    and to_user_id = (select c.user_id from public.cars c where c.id = swipes.car_id)
    and (
      (select role from public.users where id = auth.uid()) = 'private'
      or (select role from public.users where id = swipes.to_user_id) in ('dealer', 'importer')
      or exists (
        select 1 from public.swipes s
        where s.from_user_id = s.to_user_id
          and s.to_user_id = auth.uid()
          and s.direction = 'right'
      )
    )
    and (
      (select premium_until from public.users where id = auth.uid()) > now()
      or (
        select count(*) from public.swipes s
        where s.from_user_id = auth.uid() and s.created_at >= date_trunc('day', now())
      ) < 20
    )
  );
create policy "Users can update their own swipes" on public.swipes
  for update using (auth.uid() = from_user_id);
create policy "Premium users can delete their own swipes" on public.swipes
  for delete using (
    auth.uid() = from_user_id
    and (select premium_until from public.users where id = auth.uid()) > now()
  );

create policy "Users can view their own matches" on public.matches
  for select using (auth.uid() = user_a_id or auth.uid() = user_b_id);
create policy "Users can update their own matches" on public.matches
  for update using (auth.uid() = user_a_id or auth.uid() = user_b_id);

create policy "Match participants can view messages" on public.messages
  for select using (
    exists (
      select 1 from public.matches m
      where m.id = messages.match_id
        and (m.user_a_id = auth.uid() or m.user_b_id = auth.uid())
    )
  );
create policy "Match participants can send messages" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.matches m
      where m.id = messages.match_id
        and (m.user_a_id = auth.uid() or m.user_b_id = auth.uid())
    )
  );

create policy "Users can view their own blocks" on public.blocks
  for select using (auth.uid() = blocker_id);
create policy "Users can block someone" on public.blocks
  for insert with check (auth.uid() = blocker_id and blocker_id <> blocked_id);
create policy "Users can unblock someone" on public.blocks
  for delete using (auth.uid() = blocker_id);

-- ── Admin/auth support (added 2026-08-14, migration add_admin_and_ban_flags) ───────

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.users where id = uid), false);
$$;

-- Auto-creates the public.users row on signup (DB trigger, not a client-side insert,
-- so it can't be skipped or raced by the client).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'private'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create policy "Admins can update any user" on public.users
  for update using (public.is_admin(auth.uid()));

create policy "Admins can delete any car" on public.cars
  for delete using (public.is_admin(auth.uid()));
create policy "Admins can update any car" on public.cars
  for update using (public.is_admin(auth.uid()));

create policy "Admins can view all messages" on public.messages
  for select using (public.is_admin(auth.uid()));
create policy "Admins can delete any message" on public.messages
  for delete using (public.is_admin(auth.uid()));

create policy "Admins can view all matches" on public.matches
  for select using (public.is_admin(auth.uid()));
