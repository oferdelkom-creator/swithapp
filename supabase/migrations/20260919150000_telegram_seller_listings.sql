alter table public.market_vehicle_inventory
  add column if not exists seller_telegram_user_id bigint,
  add column if not exists listing_payment_charge_id text;

create index if not exists market_inventory_telegram_seller_idx
  on public.market_vehicle_inventory (market_country, seller_telegram_user_id, created_at desc)
  where seller_telegram_user_id is not null;

create unique index if not exists market_inventory_listing_payment_charge_unique
  on public.market_vehicle_inventory (listing_payment_charge_id)
  where listing_payment_charge_id is not null;
