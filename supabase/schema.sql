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
-- Added 2026-08-15 (migration add_vehicle_type_enum): what cars.category actually
-- stores. Lets listings cover more than cars without an invasive table rename -
-- caravans/jet skis/atvs/boats have no matching data.gov.il registry, so plate lookup
-- only works for car/motorcycle/truck/bus (see app/api/plate-lookup/route.ts).
-- 'bus' added later the same day (migration add_plate_number_and_bus_type); 'scooter',
-- 'atv', 'boat' added after that (migration add_scooter_atv_boat_types) to mirror
-- Yad2's category tree, which splits those out from motorcycle/jet_ski.
create type vehicle_type as enum (
  'car', 'motorcycle', 'truck', 'caravan', 'jet_ski', 'bus', 'scooter', 'atv', 'boat'
);

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
  -- Foreground match-notification opt-in (added 2026-08-15, migration
  -- add_avatars_bucket_and_notification_pref). No service worker/push server behind
  -- this - MatchNotifier.tsx only shows a Notification while a tab is open. See README.
  notify_on_match boolean not null default false,
  is_admin boolean not null default false,
  is_banned boolean not null default false,
  -- Marks bulk-generated test/demo rows (added 2026-08-15, migration
  -- add_is_seed_flags_for_test_data) so they can be found and removed later without
  -- guessing from names/emails. See delete_seed_data() below.
  is_seed boolean not null default false,
  -- Added 2026-08-16 (migration add_user_last_seen_at) for an "online now" indicator
  -- (car cards, car details, admin panel). Updated by a client-side heartbeat
  -- (PresenceHeartbeat.tsx) roughly every 30s while the app is open in a foreground
  -- tab - "online" is computed wherever this is read as last_seen_at within the last
  -- couple of minutes, not a realtime presence channel.
  last_seen_at timestamptz,
  -- Added 2026-08-16 (migration add_dealer_slug_and_inventory_rpc): the public URL
  -- path segment for a dealer/importer's branded landing page + scoped swipe deck at
  -- /d/[slug] (see app/d/[slug]/page.tsx, dealer_inventory() below). Self-service,
  -- editable from /business (PublicPageLink.tsx). Only meaningful for role IN
  -- ('dealer', 'importer'), but not constrained to that - a slug just does nothing
  -- for a private user since /d/[slug] rejects non-dealer roles at read time.
  dealer_slug text unique,
  -- Added 2026-08-16 (migration add_dealer_requested_car_cap): which /business/join
  -- pricing tier a self-service dealer signup picked (50/100/150/200, or null for the
  -- "over 200, contact us" custom tier). Purely informational for now - not enforced
  -- anywhere - it's what our team bills for once they call the dealer to activate
  -- subscription_valid_until (see ActivateSubscriptionButton in /admin). Also null for
  -- any dealer/importer set up the old way (direct DB update), not through the join flow.
  requested_car_cap integer,
  -- Added 2026-08-16 (migration add_dealer_custom_domain): lets a dealer point their
  -- own domain (e.g. www.some-dealership.co.il) at their /d/[slug] page instead of
  -- switchapp.vercel.app/d/[slug] - see proxy.ts's resolveCustomDomainSlug(), which
  -- rewrites any request whose Host header matches an active custom_domain. Both
  -- columns are self-service from /business (CustomDomainCard.tsx) EXCEPT
  -- custom_domain_active, which is admin-only (protect_privileged_user_columns()) -
  -- a dealer can save their domain, but nothing actually routes until our team has
  -- both added the domain to the Vercel project and verified its DNS, then flips this
  -- from /admin (ActivateCustomDomainButton.tsx).
  custom_domain text unique,
  custom_domain_active boolean not null default false,
  -- Added 2026-08-16 (migration add_dealer_branding_fields): lets a dealer's
  -- /d/[slug] page look like a real branded business site instead of our swipe UI
  -- with their name on it - logo/cover feed the hero on that page (see
  -- app/d/[slug]/page.tsx), all self-service from /business
  -- (DealerBrandingCard.tsx), stored in the existing "avatars" storage bucket
  -- (same per-user-folder RLS, just a different filename prefix). public_phone is
  -- deliberately separate from user_contacts.phone - that one is only visible to a
  -- matched buyer under mutual consent, this one is meant to be shown to anyone
  -- who lands on the page.
  logo_url text,
  cover_photo_url text,
  dealer_description text,
  public_phone text,
  -- Added 2026-08-16 (migration add_dealer_address), same day, same self-service
  -- pattern - shown with a pin icon on /d/[slug].
  dealer_address text,
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
  -- Repurposed 2026-08-15 (migration add_vehicle_type_enum) from a free-text field
  -- into the vehicle-type discriminator (car/motorcycle/truck/caravan/jet_ski).
  category vehicle_type not null default 'car',
  color text,
  -- Added 2026-08-15 (migration add_plate_number_and_bus_type). Saved from the plate
  -- lookup field in CarForm (or typed manually) - not validated against the gov
  -- registry format, just stored as entered.
  plate_number text,
  -- Added 2026-08-16 (migration add_car_description) for the car details page's
  -- free-text description section.
  description text,
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
  -- Added 2026-08-15 (migration add_sold_at_to_cars) - there was previously no way to
  -- mark a listing sold. Owner-settable, unlike listing_fee_paid/boosted_until below
  -- (not added to protect_privileged_car_columns' blocklist). MarkSoldButton also
  -- flips for_sale/for_swap off, which is what actually drops it out of
  -- cars_for_sale()/nearby_swap_cars() - no RPC changes needed for this.
  sold_at timestamptz,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.swipes (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.users (id),
  to_user_id uuid not null references public.users (id),
  car_id uuid not null references public.cars (id),
  -- 'maybe' added 2026-08-15 (migration add_maybe_swipe_direction): a third,
  -- non-committal swipe - unlike 'left'/'right' it doesn't permanently exclude the
  -- car from future decks (see cars_for_sale/nearby_swap_cars below).
  direction text not null check (direction in ('left', 'right', 'maybe')),
  created_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references public.users (id),
  user_b_id uuid not null references public.users (id),
  -- The car each side brought to this match (added 2026-08-14, migration
  -- add_matched_cars_and_price_diff). Sale match: only the seller's side is set.
  -- Swap match: both sides are set - used to compute the price difference.
  user_a_car_id uuid references public.cars (id),
  user_b_car_id uuid references public.cars (id),
  status text not null default 'negotiating' check (status in ('negotiating', 'closed')),
  user_a_agreed_to_call boolean not null default false,
  user_b_agreed_to_call boolean not null default false,
  -- Added 2026-08-15 (migration add_match_read_tracking_and_preview_rpc) - each side's
  -- own read receipt. Powers the unread badge on /matches and the bottom-nav Matches
  -- tab; only the owning side may set their own (see enforce_match_consent_update).
  user_a_last_read_at timestamptz,
  user_b_last_read_at timestamptz,
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

-- Enforces that each side of a match can only set their own "agreed to call" flag
-- (and, added 2026-08-15 migration add_match_read_tracking_and_preview_rpc, their own
-- last_read_at - otherwise either side could clear the other's unread badge).
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
  if new.user_a_last_read_at is distinct from old.user_a_last_read_at
     and auth.uid() <> old.user_a_id then
    raise exception 'Only user_a can set user_a_last_read_at';
  end if;
  if new.user_b_last_read_at is distinct from old.user_b_last_read_at
     and auth.uid() <> old.user_b_id then
    raise exception 'Only user_b can set user_b_last_read_at';
  end if;
  return new;
end;
$$;

create trigger before_match_consent_update
  before update on public.matches
  for each row execute function public.enforce_match_consent_update();

-- On a right-swipe: instant match for "for sale" cars, mutual-swipe match for "for swap"
-- cars. Also records which car each side brought (added 2026-08-14, migration
-- add_matched_cars_and_price_diff) so the app can compute the swap price difference.
-- Sale match: new.car_id is the seller's (to_user's) car - the buyer isn't offering one.
-- Swap match: new.car_id is the target's car; the reciprocal right-swipe (already
-- required to reach this branch) tells us the caller's own car that was offered back.
create or replace function public.handle_new_swipe()
returns trigger
language plpgsql
security definer
as $$
declare
  reciprocal_car_id uuid;
  car_for_sale boolean;
  car_for_swap boolean;
  a uuid;
  b uuid;
  a_car uuid;
  b_car uuid;
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
      if a = new.to_user_id then
        a_car := new.car_id; b_car := null;
      else
        b_car := new.car_id; a_car := null;
      end if;

      insert into public.matches (user_a_id, user_b_id, user_a_car_id, user_b_car_id)
      values (a, b, a_car, b_car)
      on conflict (user_a_id, user_b_id) do nothing;
    elsif car_for_swap then
      select car_id into reciprocal_car_id
      from public.swipes
      where from_user_id = new.to_user_id
        and to_user_id = new.from_user_id
        and direction = 'right'
      order by created_at desc
      limit 1;

      if reciprocal_car_id is not null then
        if a = new.from_user_id then
          a_car := reciprocal_car_id; b_car := new.car_id;
        else
          a_car := new.car_id; b_car := reciprocal_car_id;
        end if;

        insert into public.matches (user_a_id, user_b_id, user_a_car_id, user_b_car_id)
        values (a, b, a_car, b_car)
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

-- RPC: swap-deck candidates near the caller, excluding already-decided cars.
-- p_category added 2026-08-15 (migration add_vehicle_type_to_deck_rpcs) to let the
-- swap deck filter by vehicle type alongside the sale deck. p_make/p_min_price/
-- p_max_price/p_min_year/p_max_year/p_max_distance_km added later the same day
-- (migration add_filters_to_swap_deck_rpc) - the swap deck had no filter UI at all
-- before that, unlike the sale deck. Updated again the same day (migration
-- add_maybe_swipe_direction): the exclusion only counts 'left'/'right' swipes now -
-- a 'maybe' doesn't permanently remove a car, it can resurface on a later deck load -
-- and results are boosted toward makes the caller has already liked ('right'), a
-- simple preference signal from swipe history. p_include_dealers added 2026-08-15,
-- later (migration cap_private_listings_and_gate_dealer_visibility): private callers
-- now see only other private sellers by default - dealer/importer inventory is
-- opt-in, not mixed into the regular deck automatically. seller_online added
-- 2026-08-16 (migration add_seller_online_to_nearby_swap_cars) - also the point
-- where a stray duplicate overload (left behind when p_include_dealers was added via
-- CREATE OR REPLACE with a different parameter count, which creates a new overload
-- instead of replacing in place) got cleaned up; there should only ever be one.
-- p_max_mileage added 2026-08-17 (migration add_max_mileage_to_nearby_swap_cars) -
-- matches cars_for_sale()'s p_max_mileage below; mileage was already selected/
-- returned here, just never filterable. p_model added the same day (migration
-- add_model_filter_to_deck_rpcs) alongside cars_for_sale()'s - see the note there.
create or replace function public.nearby_swap_cars(
  my_lat double precision, my_lon double precision, my_id uuid,
  p_category vehicle_type default null,
  p_make text default null, p_min_price numeric default null, p_max_price numeric default null,
  p_min_year integer default null, p_max_year integer default null,
  p_max_distance_km double precision default null,
  p_include_dealers boolean default false,
  p_max_mileage integer default null,
  p_model text default null
)
returns table (
  user_id uuid, name text, seller_online boolean, lat double precision, lon double precision,
  distance_km double precision,
  car_id uuid, make text, model text, year integer, mileage integer, transmission text,
  category vehicle_type, photo_urls text[], want_make text, want_notes text, price numeric
)
language sql
stable
as $$
  select
    u.id, u.name, (u.last_seen_at > now() - interval '2 minutes'), u.lat, u.lon,
    public.haversine_km(my_lat, my_lon, u.lat, u.lon) as distance_km,
    c.id, c.make, c.model, c.year, c.mileage, c.transmission, c.category, c.photo_urls,
    c.want_make, c.want_notes, c.price
  from public.users u
  join public.cars c on c.user_id = u.id
  where c.for_swap = true
    and u.id <> my_id
    and not exists (
      select 1 from public.swipes s
      where s.from_user_id = my_id and s.car_id = c.id and s.direction in ('left', 'right')
    )
    -- Added 2026-08-15 (migration enforce_blocks_in_messages_and_decks).
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = my_id and b.blocked_id = u.id)
         or (b.blocker_id = u.id and b.blocked_id = my_id)
    )
    and (
      case (select role from public.users where id = my_id)
        when 'private' then u.role = 'private' or (p_include_dealers and u.role in ('dealer', 'importer'))
        else u.role in ('dealer', 'importer')
      end
    )
    and (p_category is null or c.category = p_category)
    and (p_make is null or c.make = p_make)
    and (p_model is null or c.model = p_model)
    and (p_min_price is null or c.price >= p_min_price)
    and (p_max_price is null or c.price <= p_max_price)
    and (p_min_year is null or c.year >= p_min_year)
    and (p_max_year is null or c.year <= p_max_year)
    and (p_max_mileage is null or c.mileage <= p_max_mileage)
    and (
      p_max_distance_km is null
      or public.haversine_km(my_lat, my_lon, u.lat, u.lon) <= p_max_distance_km
    )
  order by
    (c.boosted_until > now()) desc nulls last,
    (c.make in (
      select c2.make from public.swipes s2
      join public.cars c2 on c2.id = s2.car_id
      where s2.from_user_id = my_id and s2.direction = 'right'
    )) desc,
    distance_km asc nulls last;
$$;

-- RPC: sale-deck candidates with filters, excluding already-decided cars.
-- p_category changed from text to vehicle_type 2026-08-15 (migration
-- add_vehicle_type_to_deck_rpcs) to match the cars.category column. Updated again the
-- same day (migration add_maybe_swipe_direction) - same 'maybe' exclusion change and
-- liked-make preference boost as nearby_swap_cars above. seller_online added
-- 2026-08-16 (migration add_seller_online_to_cars_for_sale).
--
-- my_id defaults to null (migration allow_anonymous_cars_for_sale, later the same
-- day) so /swipe's sale mode can be browsed signed-out, same pattern as
-- dealer_inventory's allow_anonymous_dealer_inventory migration. The swipe/block
-- exclusion subqueries already work correctly against a null my_id (vacuously true -
-- nothing to exclude by for a visitor with no account). Two clauses needed an
-- explicit "my_id is null or ..." guard: the ownership check (`<> my_id` evaluates to
-- null, not true, when my_id is null - excluding every row instead of none), and the
-- private/dealer visibility rule, which now gives an anonymous visitor the same
-- default view as a signed-in private user (both private and dealer listings)
-- instead of falling through to "dealer/importer sellers only".
--
-- p_model added 2026-08-17 (migration add_model_filter_to_deck_rpcs) - the filter
-- panel's Make field became a constrained dropdown (getMakes()) with a cascading
-- Model dropdown (getModels()) instead of free text, so only a real, known model can
-- ever be filtered by, matching CarForm's own make/model picker.
create or replace function public.cars_for_sale(
  my_id uuid default null,
  p_make text default null, p_min_price numeric default null, p_max_price numeric default null,
  p_min_year integer default null, p_max_year integer default null, p_max_mileage integer default null,
  p_transmission text default null, p_category vehicle_type default null, p_color text default null,
  p_fuel_type fuel_type default null, p_region car_region default null, p_max_hand integer default null,
  p_model text default null
)
returns table (
  user_id uuid, seller_name text, seller_role user_role, seller_online boolean,
  car_id uuid, make text, model text, year integer, mileage integer, transmission text,
  category vehicle_type, color text, photo_urls text[], price numeric, hand integer,
  fuel_type fuel_type, region car_region
)
language sql
stable
as $$
  select
    u.id, u.name, u.role, (u.last_seen_at > now() - interval '2 minutes'),
    c.id, c.make, c.model, c.year, c.mileage, c.transmission, c.category, c.color,
    c.photo_urls, c.price, c.hand, c.fuel_type, c.region
  from public.cars c
  join public.users u on u.id = c.user_id
  where c.for_sale = true
    and (my_id is null or c.user_id <> my_id)
    and not exists (
      select 1 from public.swipes s
      where s.from_user_id = my_id and s.car_id = c.id and s.direction in ('left', 'right')
    )
    -- Added 2026-08-15 (migration enforce_blocks_in_messages_and_decks).
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = my_id and b.blocked_id = c.user_id)
         or (b.blocker_id = c.user_id and b.blocked_id = my_id)
    )
    and (
      my_id is null
      or (select role from public.users where id = my_id) = 'private'
      or u.role in ('dealer', 'importer')
    )
    and (p_make is null or c.make = p_make)
    and (p_model is null or c.model = p_model)
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
  order by
    (c.boosted_until > now()) desc nulls last,
    (c.make in (
      select c2.make from public.swipes s2
      join public.cars c2 on c2.id = s2.car_id
      where s2.from_user_id = my_id and s2.direction = 'right'
    )) desc,
    c.created_at desc;
$$;

-- RPC: a single dealer/importer's active inventory, for the branded /d/[slug] deck
-- (added 2026-08-16, migration add_dealer_slug_and_inventory_rpc). Unlike
-- cars_for_sale/nearby_swap_cars this isn't a matching search across all sellers - the
-- caller already knows which dealer they're browsing (resolved via users.dealer_slug),
-- so it just filters that one dealer's cars down to what's still available and not
-- already swiped/blocked.
--
-- my_id defaults to null (migration allow_anonymous_dealer_inventory, same day) so
-- /d/[slug] can be browsed signed-out - cars.users select policies already allow the
-- anon role (`using (true)`), the only thing stopping an anonymous visitor was this
-- RPC's own exclusion filters dividing by a null my_id. Each filter is now guarded
-- with "my_id is null or ..." - a signed-out visitor has no swipes/blocks to exclude
-- by anyway, so skipping those checks entirely for them is correct, not just a
-- workaround. p_dealer_id moved before my_id in the declared parameter list, since
-- Postgres requires a defaulted parameter to be declared after non-defaulted ones -
-- callers already pass both by name (supabase.rpc(name, {my_id, p_dealer_id})) so
-- this reordering doesn't affect any call site.
create function public.dealer_inventory(p_dealer_id uuid, my_id uuid default null)
returns table (
  car_id uuid, make text, model text, year integer, mileage integer, transmission text,
  category vehicle_type, color text, photo_urls text[], price numeric, hand integer,
  fuel_type fuel_type, region car_region, for_sale boolean, for_swap boolean,
  want_make text, want_notes text
)
language sql
stable
as $$
  select
    c.id, c.make, c.model, c.year, c.mileage, c.transmission, c.category, c.color,
    c.photo_urls, c.price, c.hand, c.fuel_type, c.region, c.for_sale, c.for_swap,
    c.want_make, c.want_notes
  from public.cars c
  where c.user_id = p_dealer_id
    and c.sold_at is null
    and (c.for_sale or c.for_swap)
    and (my_id is null or c.user_id <> my_id)
    and (my_id is null or not exists (
      select 1 from public.swipes s
      where s.from_user_id = my_id and s.car_id = c.id and s.direction in ('left', 'right')
    ))
    and (my_id is null or not exists (
      select 1 from public.blocks b
      where (b.blocker_id = my_id and b.blocked_id = p_dealer_id)
         or (b.blocker_id = p_dealer_id and b.blocked_id = my_id)
    ))
  order by
    (c.boosted_until > now()) desc nulls last,
    c.created_at desc;
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

-- RPC: free-tier teaser count (added 2026-08-15, migration add_count_incoming_likes) - no
-- premium gate, no identities revealed. get_incoming_likes() above still gates the actual
-- reveal behind premium; this just lets the system tell a free user "N people are
-- interested" instead of leaving them with zero signal.
create or replace function public.count_incoming_likes(my_id uuid)
returns integer
language sql
stable
as $$
  select count(distinct s.from_user_id)::int
  from public.swipes s
  where s.to_user_id = my_id
    and s.direction = 'right'
    and not exists (
      select 1 from public.swipes s2
      where s2.from_user_id = my_id
        and s2.to_user_id = s.from_user_id
        and s2.direction = 'right'
    );
$$;

-- RPC: matches list with a last-message preview, unread flag, and enough car info to
-- tell sale vs swap deals apart and show a thumbnail (added 2026-08-15, migration
-- add_match_read_tracking_and_preview_rpc) - the list was a flat name+date table before.
-- Fixed 2026-08-16 (migration exclude_blocked_users_from_matches_list): never excluded
-- blocked users - blocking someone correctly stopped new messages and dropped them
-- from future swipe decks, but the existing match (and their car) kept showing here,
-- since nothing checked the blocks table at all.
create or replace function public.get_matches_with_previews(my_id uuid)
returns table (
  match_id uuid,
  other_id uuid,
  other_name text,
  status text,
  created_at timestamptz,
  my_car_id uuid,
  my_car_make text,
  my_car_model text,
  other_car_id uuid,
  other_car_make text,
  other_car_model text,
  other_car_price numeric,
  other_car_photo text,
  last_message_text text,
  last_message_at timestamptz,
  last_message_from_me boolean,
  unread boolean
)
language sql
stable
as $$
  select
    m.id,
    other.id,
    other.name,
    m.status,
    m.created_at,
    my_c.id, my_c.make, my_c.model,
    other_c.id, other_c.make, other_c.model, other_c.price, other_c.photo_urls[1],
    lm.text,
    lm.created_at,
    lm.sender_id = my_id,
    (
      lm.created_at is not null
      and lm.sender_id <> my_id
      and lm.created_at > coalesce(
        case when m.user_a_id = my_id then m.user_a_last_read_at else m.user_b_last_read_at end,
        m.created_at
      )
    )
  from public.matches m
  join public.users other
    on other.id = case when m.user_a_id = my_id then m.user_b_id else m.user_a_id end
  left join public.cars my_c
    on my_c.id = case when m.user_a_id = my_id then m.user_a_car_id else m.user_b_car_id end
  left join public.cars other_c
    on other_c.id = case when m.user_a_id = my_id then m.user_b_car_id else m.user_a_car_id end
  left join lateral (
    select msg.text, msg.created_at, msg.sender_id
    from public.messages msg
    where msg.match_id = m.id and msg.kind = 'chat'
    order by msg.created_at desc
    limit 1
  ) lm on true
  where (m.user_a_id = my_id or m.user_b_id = my_id)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = my_id and b.blocked_id = other.id)
         or (b.blocker_id = other.id and b.blocked_id = my_id)
    )
  order by coalesce(lm.created_at, m.created_at) desc;
$$;

-- RPC: unread-match count for the bottom-nav Matches badge (added 2026-08-15, same
-- migration as get_matches_with_previews above). Fixed 2026-08-16 (migration
-- exclude_blocked_users_from_unread_match_count): same gap as get_matches_with_previews -
-- without this, blocking someone with an unread message left the nav badge showing a
-- count for a match that no longer appears in /matches at all.
create or replace function public.count_unread_matches(my_id uuid)
returns integer
language sql
stable
as $$
  select count(distinct m.id)::integer
  from public.matches m
  join lateral (
    select msg.created_at, msg.sender_id
    from public.messages msg
    where msg.match_id = m.id and msg.kind = 'chat'
    order by msg.created_at desc
    limit 1
  ) lm on true
  where (m.user_a_id = my_id or m.user_b_id = my_id)
    and lm.sender_id <> my_id
    and lm.created_at > coalesce(
      case when m.user_a_id = my_id then m.user_a_last_read_at else m.user_b_last_read_at end,
      m.created_at
    )
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = my_id and b.blocked_id = case when m.user_a_id = my_id then m.user_b_id else m.user_a_id end)
         or (b.blocker_id = case when m.user_a_id = my_id then m.user_b_id else m.user_a_id end and b.blocked_id = my_id)
    );
$$;

-- RPC: lightweight "Insights" style stats for /profile - active listings, all-time
-- likes received, total matches, and a 7-day likes sparkline (added 2026-08-15,
-- migration add_get_profile_stats_rpc). No premium gate, no identities revealed - same
-- free-tier-teaser spirit as count_incoming_likes.
create or replace function public.get_profile_stats(my_id uuid)
returns table (
  active_listings integer,
  total_likes_received integer,
  total_matches integer,
  likes_by_day integer[]
)
language sql
stable
as $$
  select
    (select count(*)::int from public.cars c
       where c.user_id = my_id and c.sold_at is null and (c.for_sale or c.for_swap)),
    (select count(distinct s.from_user_id)::int from public.swipes s
       where s.to_user_id = my_id and s.direction = 'right'),
    (select count(*)::int from public.matches m
       where m.user_a_id = my_id or m.user_b_id = my_id),
    (select array_agg(coalesce(x.cnt, 0) order by gs.d)
     from generate_series(current_date - 6, current_date, interval '1 day') gs(d)
     left join (
       select date_trunc('day', s.created_at)::date as day, count(*) as cnt
       from public.swipes s
       where s.to_user_id = my_id and s.direction = 'right'
       group by 1
     ) x on x.day = gs.d::date
    );
$$;

-- RPC: 30-day daily lead count (incoming right-swipes) for the /business dashboard's
-- LeadsChart.tsx (added 2026-08-16, migration add_dealer_leads_by_day_rpc). Separate
-- from get_profile_stats()'s 7-day likes_by_day above rather than extending it -
-- that RPC is shared with the private-user /profile page, which has no use for a
-- 30-day business-oriented view, and returning one row per day (instead of a single
-- array column) gives the chart both the x-axis label and y-axis value per row for
-- free.
create function public.get_dealer_leads_by_day(my_id uuid)
returns table (day date, leads integer)
language sql
stable
as $$
  select gs.d::date as day, coalesce(x.cnt, 0)::int as leads
  from generate_series(current_date - 29, current_date, interval '1 day') gs(d)
  left join (
    select date_trunc('day', s.created_at)::date as day, count(*) as cnt
    from public.swipes s
    where s.to_user_id = my_id and s.direction = 'right'
    group by 1
  ) x on x.day = gs.d::date
  order by gs.d;
$$;

-- RPC: the small public "trust bar" on /d/[slug] (active listing count, completed
-- deals) - added 2026-08-16, migration add_dealer_public_stats_rpc. SECURITY DEFINER
-- is required here, unlike the other stats RPCs above: those are always called with
-- the caller's own id, so the underlying RLS (which only lets a user see their own
-- swipes/matches) does the real filtering and the function body is just a convenience
-- wrapper. This one is called by an anonymous or unrelated visitor about a *different*
-- user (the dealer), so without SECURITY DEFINER the same RLS would silently return
-- zero for everything. Safe to expose broadly since it only returns two aggregate
-- counts, never row-level data.
create function public.get_dealer_public_stats(p_dealer_id uuid)
returns table (active_listings integer, completed_matches integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from public.cars c
       where c.user_id = p_dealer_id and c.sold_at is null and (c.for_sale or c.for_swap)),
    (select count(*)::int from public.matches m
       where m.user_a_id = p_dealer_id or m.user_b_id = p_dealer_id);
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
-- Private accounts are capped at 2 active (unsold) listings (added 2026-08-15,
-- migration cap_private_listings_and_gate_dealer_visibility); dealers/importers are
-- unbounded, since a large inventory is the whole point of a business account.
create policy "Users can insert their own car" on public.cars
  for insert with check (
    auth.uid() = user_id
    and (
      (select role from public.users where id = auth.uid()) <> 'private'
      or (
        select count(*) from public.cars c
        where c.user_id = auth.uid() and c.sold_at is null
      ) < 2
    )
  );
create policy "Users can update their own car" on public.cars
  for update using (auth.uid() = user_id);
create policy "Users can delete their own car" on public.cars
  for delete using (auth.uid() = user_id);

create policy "Users can view their own swipes" on public.swipes
  for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);
-- from_user_id must be the caller; to_user_id must be the car's actual owner; capped at
-- 20 swipes/day unless premium; private users can swipe on dealer/importer cars freely,
-- dealers/importers can only swipe back at someone who already swiped right on them.
-- Fixed 2026-08-15 (migration fix_dealer_swipe_back_rls_bug): the third branch used to
-- compare s.from_user_id = s.to_user_id, which can never be true for a real swipe row -
-- it silently blocked every dealer/importer from ever completing a swap match with a
-- private user, since the "like back" action on /likes was always rejected by RLS.
create policy "Users can insert their own swipes" on public.swipes
  for insert with check (
    auth.uid() = from_user_id
    and to_user_id = (select c.user_id from public.cars c where c.id = swipes.car_id)
    and (
      (select role from public.users where id = auth.uid()) = 'private'
      or (select role from public.users where id = swipes.to_user_id) in ('dealer', 'importer')
      or exists (
        select 1 from public.swipes s
        where s.from_user_id = swipes.to_user_id
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
-- Updated 2026-08-15 (migration enforce_blocks_in_messages_and_decks) to also check
-- neither side has blocked the other - blocking previously had no effect anywhere.
create policy "Match participants can send messages" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.matches m
      where m.id = messages.match_id
        and (m.user_a_id = auth.uid() or m.user_b_id = auth.uid())
        and not exists (
          select 1 from public.blocks b
          where (b.blocker_id = m.user_a_id and b.blocked_id = m.user_b_id)
             or (b.blocker_id = m.user_b_id and b.blocked_id = m.user_a_id)
        )
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
-- so it can't be skipped or raced by the client). Updated 2026-08-15 (migration
-- auto_fill_profile_from_oauth_metadata) to also read Google OAuth's metadata keys
-- ('full_name', 'avatar_url'/'picture') - the original only checked 'name', the
-- email/password signup convention, so Google sign-ins fell through to the email-prefix
-- fallback despite Google actually supplying a real name and avatar. Updated again the
-- same day (migration handle_phone_only_signups) for phone-OTP signups, which have no
-- email - the old fallback chain resolved to null and violated users.name's not-null
-- constraint - and to seed user_contacts with the OTP-verified number (previously no
-- UI path set that table at all).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, avatar_url, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1),
      new.phone,
      'New user'
    ),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    'private'
  )
  on conflict (id) do nothing;

  if new.phone is not null then
    insert into public.user_contacts (user_id, phone)
    values (new.id, new.phone)
    on conflict (user_id) do nothing;
  end if;

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

-- ── Column-level protection (added 2026-08-14, migration protect_privileged_user_columns)

-- "Users can update their own profile" above has no column restriction, so without this
-- a signed-in user could self-promote to admin or self-grant premium via a plain client
-- update call. Blocks non-admins from touching these columns on any update, including
-- their own row.
create or replace function public.protect_privileged_user_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    if new.is_admin is distinct from old.is_admin
       or new.is_banned is distinct from old.is_banned
       or new.premium_until is distinct from old.premium_until
       or new.subscription_valid_until is distinct from old.subscription_valid_until
       or new.custom_domain_active is distinct from old.custom_domain_active then
      raise exception 'Only an admin can change these fields';
    end if;
  end if;
  return new;
end;
$$;

create trigger before_users_update_protect
  before update on public.users
  for each row execute function public.protect_privileged_user_columns();

-- Same gap on cars: "Users can update their own car" has no column restriction, so an
-- owner could self-set listing_fee_paid or boosted_until, bypassing admin-only billing.
create or replace function public.protect_privileged_car_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    if new.listing_fee_paid is distinct from old.listing_fee_paid
       or new.boosted_until is distinct from old.boosted_until then
      raise exception 'Only an admin can change these fields';
    end if;
  end if;
  return new;
end;
$$;

create trigger before_cars_update_protect
  before update on public.cars
  for each row execute function public.protect_privileged_car_columns();

-- ── Test/seed data support (added 2026-08-15, migration add_is_seed_flags_for_test_data)

create index if not exists users_is_seed_idx on public.users (is_seed) where is_seed;
create index if not exists cars_is_seed_idx on public.cars (is_seed) where is_seed;

-- One-call cleanup for bulk-generated test users/cars (is_seed = true) - explicitly clears
-- dependents in FK-safe order (none of swipes/matches/messages/blocks/user_contacts cascade
-- from auth.users), then deletes auth.users, which cascades to public.users.
create or replace function public.delete_seed_data()
returns table (deleted_users integer, deleted_cars integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  seed_ids uuid[];
  car_count integer;
  user_count integer;
begin
  select array_agg(id) into seed_ids from public.users where is_seed;
  if seed_ids is null then
    return query select 0, 0;
    return;
  end if;

  delete from public.messages where sender_id = any(seed_ids)
    or match_id in (select id from public.matches where user_a_id = any(seed_ids) or user_b_id = any(seed_ids));
  delete from public.matches where user_a_id = any(seed_ids) or user_b_id = any(seed_ids);
  delete from public.swipes where from_user_id = any(seed_ids) or to_user_id = any(seed_ids);
  delete from public.blocks where blocker_id = any(seed_ids) or blocked_id = any(seed_ids);
  delete from public.user_contacts where user_id = any(seed_ids);
  delete from public.cars where user_id = any(seed_ids);
  get diagnostics car_count = row_count;
  delete from auth.users where id = any(seed_ids); -- cascades to public.users and auth.identities
  get diagnostics user_count = row_count;

  return query select user_count, car_count;
end;
$$;

-- ── Storage buckets (car-photos predates this snapshot, undocumented until now;
-- avatars added 2026-08-15, migration add_avatars_bucket_and_notification_pref) ────

insert into storage.buckets (id, name, public) values ('car-photos', 'car-photos', true);
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);

create policy "Anyone can view car photos" on storage.objects for select
  using (bucket_id = 'car-photos');
create policy "Users can upload their own car photos" on storage.objects for insert
  with check (bucket_id = 'car-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete their own car photos" on storage.objects for delete
  using (bucket_id = 'car-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Anyone can view avatars" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "Users can upload their own avatar" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can update their own avatar" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete their own avatar" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Realtime (matches added 2026-08-15, migration add_matches_to_realtime_publication;
-- messages predates this snapshot) - both gated by each table's own RLS SELECT policy,
-- so a subscriber only receives rows they're already allowed to read ────────────────

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.matches;
