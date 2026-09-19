create table if not exists public.telegram_dealer_accounts (
  telegram_user_id bigint primary key,
  market_country text not null default 'RU' check (market_country in ('RU', 'IL')),
  role text not null check (role in ('dealer', 'importer')),
  business_name text not null,
  legal_name text,
  tax_id text,
  city text not null,
  phone text not null,
  inventory_mode text not null default 'manual' check (inventory_mode in ('manual', 'csv', 'xml', 'api')),
  verified boolean not null default false,
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.telegram_dealer_leads (
  id uuid primary key default gen_random_uuid(),
  dealer_telegram_user_id bigint not null references public.telegram_dealer_accounts(telegram_user_id) on delete cascade,
  buyer_telegram_user_id bigint,
  inventory_id uuid references public.market_vehicle_inventory(id) on delete set null,
  lead_type text not null default 'sale' check (lead_type in ('sale', 'swap')),
  buyer_name text,
  buyer_phone text,
  buyer_car jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed', 'lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists telegram_dealer_leads_owner_created_idx
  on public.telegram_dealer_leads (dealer_telegram_user_id, created_at desc);

alter table public.telegram_dealer_accounts enable row level security;
alter table public.telegram_dealer_leads enable row level security;

revoke all on table public.telegram_dealer_accounts from anon, authenticated;
revoke all on table public.telegram_dealer_leads from anon, authenticated;
grant all on table public.telegram_dealer_accounts to service_role;
grant all on table public.telegram_dealer_leads to service_role;


