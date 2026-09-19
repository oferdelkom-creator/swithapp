create table if not exists public.telegram_pilot_users (
  id bigint generated always as identity primary key,
  telegram_user_id bigint not null unique,
  market_country text not null default 'RU' check (market_country in ('IL', 'RU')),
  founder_number integer,
  username text,
  first_name text not null,
  last_name text,
  language_code text,
  city text not null,
  budget text not null,
  default_sale_price numeric not null check (default_sale_price between 10000 and 1000000000),
  latitude numeric(8,3),
  longitude numeric(9,3),
  location_accuracy_m integer,
  search_radius_km integer not null default 50 check (search_radius_km in (25, 50, 100, 250)),
  saved_car_ids text[] not null default '{}',
  stars_spent bigint not null default 0,
  premium_until timestamptz,
  start_param text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint telegram_pilot_founder_range check (founder_number between 1 and 1000 or founder_number is null),
  constraint telegram_pilot_location_pair check (
    (latitude is null and longitude is null) or
    (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180)
  ),
  constraint telegram_pilot_market_founder_unique unique (market_country, founder_number),
  constraint telegram_pilot_user_market_unique unique (telegram_user_id, market_country)
);

alter table public.telegram_pilot_users enable row level security;

create schema if not exists private;

create or replace function private.assign_telegram_founder_number()
returns trigger
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  next_number integer;
begin
  perform pg_advisory_xact_lock(hashtext('switchapp_telegram_founder_1000_' || new.market_country));
  select coalesce(max(founder_number), 0) + 1
    into next_number
    from public.telegram_pilot_users
    where founder_number is not null and market_country = new.market_country;
  if next_number <= 1000 then
    new.founder_number := next_number;
  end if;
  return new;
end;
$$;

revoke all on function private.assign_telegram_founder_number() from public, anon, authenticated;

drop trigger if exists before_telegram_pilot_insert on public.telegram_pilot_users;
create trigger before_telegram_pilot_insert
  before insert on public.telegram_pilot_users
  for each row execute function private.assign_telegram_founder_number();

revoke all on table public.telegram_pilot_users from anon, authenticated;
grant all on table public.telegram_pilot_users to service_role;
grant usage, select on sequence public.telegram_pilot_users_id_seq to service_role;

create index if not exists telegram_pilot_users_created_at_idx
  on public.telegram_pilot_users (market_country, created_at desc);

create table if not exists public.market_vehicle_inventory (
  id uuid primary key default gen_random_uuid(),
  market_country text not null check (market_country in ('IL', 'RU')),
  source_name text not null,
  source_listing_id text not null,
  source_url text,
  seller_name text not null,
  make text not null,
  model text not null,
  year integer,
  price numeric,
  currency text not null check (currency in ('ILS', 'RUB')),
  latitude numeric(9,6),
  longitude numeric(9,6),
  photo_urls text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'sold', 'paused')),
  source_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (market_country, source_name, source_listing_id),
  constraint market_inventory_currency_matches_country check (
    (market_country = 'IL' and currency = 'ILS') or
    (market_country = 'RU' and currency = 'RUB')
  ),
  constraint market_inventory_location_pair check (
    (latitude is null and longitude is null) or
    (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180)
  )
);

alter table public.market_vehicle_inventory enable row level security;
revoke all on table public.market_vehicle_inventory from anon, authenticated;
grant select on table public.market_vehicle_inventory to anon, authenticated;
grant all on table public.market_vehicle_inventory to service_role;

create policy "Anyone can view active market inventory"
  on public.market_vehicle_inventory for select
  to anon, authenticated
  using (status = 'active');

create index if not exists market_vehicle_inventory_country_active_idx
  on public.market_vehicle_inventory (market_country, updated_at desc)
  where status = 'active';

create or replace function public.market_inventory_for_country(
  p_market_country text,
  p_limit integer default 24
)
returns table (
  car_id text,
  make text,
  model text,
  year integer,
  price numeric,
  photo_urls text[],
  seller_name text,
  currency text,
  latitude numeric,
  longitude numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select i.id::text, i.make, i.model, i.year, i.price, i.photo_urls, i.seller_name, i.currency,
    i.latitude, i.longitude
  from public.market_vehicle_inventory i
  where i.market_country = upper(p_market_country)
    and i.status = 'active'
  order by i.updated_at desc
  limit least(greatest(coalesce(p_limit, 24), 1), 100);
$$;
grant execute on function public.market_inventory_for_country(text, integer) to anon, authenticated;

create table if not exists public.telegram_star_payments (
  charge_id text primary key,
  telegram_user_id bigint not null,
  market_country text not null check (market_country in ('IL', 'RU')),
  product_id text not null,
  stars integer not null check (stars > 0),
  created_at timestamptz not null default now(),
  constraint telegram_payment_user_market_fk
    foreign key (telegram_user_id, market_country)
    references public.telegram_pilot_users (telegram_user_id, market_country)
);
alter table public.telegram_star_payments enable row level security;
revoke all on table public.telegram_star_payments from anon, authenticated;
grant all on table public.telegram_star_payments to service_role;

create or replace function public.record_telegram_stars_payment(
  p_telegram_user_id bigint,
  p_charge_id text,
  p_product_id text,
  p_stars integer,
  p_market_country text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.telegram_star_payments (charge_id, telegram_user_id, market_country, product_id, stars)
  values (p_charge_id, p_telegram_user_id, p_market_country, p_product_id, p_stars)
  on conflict (charge_id) do nothing;
  if not found then return false; end if;

  update public.telegram_pilot_users
  set stars_spent = stars_spent + p_stars,
      premium_until = case
        when p_product_id in ('buyer_plus_30d', 'dealer_pro_30d')
          then greatest(coalesce(premium_until, now()), now()) + interval '30 days'
        else premium_until
      end,
      last_seen_at = now()
  where telegram_user_id = p_telegram_user_id
    and market_country = p_market_country;
  return found;
end;
$$;
revoke all on function public.record_telegram_stars_payment(bigint, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.record_telegram_stars_payment(bigint, text, text, integer, text) to service_role;
