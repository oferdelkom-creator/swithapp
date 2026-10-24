-- Europe-ready market separation. Existing Israeli records remain IL.
alter table public.users
  add column if not exists market_code text not null default 'IL'
    check (market_code in ('IL', 'FR')),
  add column if not exists business_kind text
    check (business_kind is null or business_kind in (
      'private_seller',
      'small_dealer',
      'dealership',
      'official_importer',
      'parallel_importer',
      'leasing_company',
      'rental_company'
    ));

alter table public.cars
  add column if not exists market_code text not null default 'IL'
    check (market_code in ('IL', 'FR')),
  add column if not exists currency_code text not null default 'ILS'
    check (currency_code in ('ILS', 'EUR'));

create index if not exists users_market_role_idx
  on public.users (market_code, role);

create index if not exists cars_market_active_idx
  on public.cars (market_code, created_at desc)
  where sold_at is null;

comment on column public.users.market_code is
  'Commercial market. IL remains production; FR is the first SwitchApp Europe market.';
comment on column public.users.business_kind is
  'Detailed participant category while role remains compatible with existing authorization.';
comment on column public.cars.currency_code is
  'Listing currency. Must be interpreted together with market_code.';
