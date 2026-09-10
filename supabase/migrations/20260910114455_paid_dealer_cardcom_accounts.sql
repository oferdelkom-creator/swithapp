create table public.dealer_billing_accounts (
 user_id uuid primary key references public.users(id),
 plan text not null check(plan in ('small','lot')),
 legal_name text not null, tax_id text not null, email text not null,
 accepted_at timestamptz not null default now(), terms_version text not null default '2026-09-10',
 activated_at timestamptz, cancelled_at timestamptz,
 state text not null default 'pending' check(state in ('pending','active','cancelled','review'))
);
alter table public.dealer_billing_accounts enable row level security;
revoke all on public.dealer_billing_accounts from anon,authenticated;
grant select on public.dealer_billing_accounts to authenticated;
grant all on public.dealer_billing_accounts to service_role;
create policy billing_account_read on public.dealer_billing_accounts for select to authenticated
 using(user_id=(select auth.uid()) or exists(select 1 from public.users where id=(select auth.uid()) and is_admin));

create table public.dealer_payment_tokens (
 user_id uuid primary key references public.dealer_billing_accounts(user_id),
 token text not null, expiration text not null check(expiration ~ '^[0-9]{4}$')
);
alter table public.dealer_payment_tokens enable row level security;
revoke all on public.dealer_payment_tokens from public,anon,authenticated;
grant all on public.dealer_payment_tokens to service_role;

create table public.dealer_billing_orders (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.dealer_billing_accounts(user_id),
 kind text not null check(kind in ('setup','monthly')), period date,
 peak integer not null default 0 check(peak>=0),
 amount_agorot bigint not null check(amount_agorot>=0),
 status text not null default 'pending' check(status in ('pending','creating','processing','paid','failed','review')),
 low_profile_id uuid unique, payment_url text, transaction_id text unique,
 document_number text, document_status text,
 failure_code text, created_at timestamptz not null default now(), paid_at timestamptz,
 unique(user_id,period,kind)
);
create unique index dealer_setup_once on public.dealer_billing_orders(user_id) where kind='setup';
alter table public.dealer_billing_orders enable row level security;
revoke all on public.dealer_billing_orders from anon,authenticated;
grant select on public.dealer_billing_orders to authenticated;
grant all on public.dealer_billing_orders to service_role;
create policy billing_orders_read on public.dealer_billing_orders for select to authenticated
 using(user_id=(select auth.uid()) or exists(select 1 from public.users where id=(select auth.uid()) and is_admin));

-- Called only after the Edge Function authenticates the user and validates consent.
create function public.begin_dealer_setup(p_user uuid,p_plan text,p_name text,p_tax text,p_email text)
returns public.dealer_billing_orders language plpgsql security invoker set search_path='' as $$
declare a public.dealer_billing_accounts; o public.dealer_billing_orders;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if p_plan not in ('small','lot') or not exists(select 1 from public.users where id=p_user and role in ('dealer','importer') and not is_banned) then raise exception 'Invalid dealer'; end if;
 if p_plan='small' and coalesce((select active_count from public.dealer_inventory_meter where user_id=p_user),0)>10 then raise exception 'More than 10 active vehicles'; end if;
 select * into a from public.dealer_billing_accounts where user_id=p_user;
 if found and a.plan<>p_plan then raise exception 'Existing plan requires a reviewed change'; end if;
 insert into public.dealer_billing_accounts(user_id,plan,legal_name,tax_id,email) values(p_user,p_plan,p_name,p_tax,p_email) on conflict do nothing;
 insert into public.dealer_billing_orders(user_id,kind,amount_agorot) values(p_user,'setup',300000) on conflict do nothing;
 select * into o from public.dealer_billing_orders where user_id=p_user and kind='setup';
 return o;
end; $$;
revoke all on function public.begin_dealer_setup(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.begin_dealer_setup(uuid,text,text,text,text) to service_role;

create function public.confirm_dealer_setup(p_order uuid,p_transaction text,p_token text,p_expiration text,p_document text,p_document_ok boolean)
returns void language plpgsql security invoker set search_path='' as $$
declare o public.dealer_billing_orders;
begin
 select * into o from public.dealer_billing_orders where id=p_order and kind='setup' for update;
 if not found then raise exception 'Unknown setup'; end if;
 if o.status='paid' then return; end if;
 if length(p_token)<10 or p_expiration !~ '^[0-9]{4}$' then raise exception 'Missing recurring token'; end if;
 insert into public.dealer_payment_tokens(user_id,token,expiration) values(o.user_id,p_token,p_expiration) on conflict(user_id) do update set token=excluded.token,expiration=excluded.expiration;
 update public.dealer_billing_orders set status='paid',transaction_id=p_transaction,paid_at=now(),document_number=p_document,document_status=case when p_document_ok then 'issued' else 'review' end where id=o.id;
 update public.dealer_billing_accounts set state='active',activated_at=coalesce(activated_at,now()) where user_id=o.user_id and cancelled_at is null;
 update public.users set billing_plan='subscription',subscription_valid_until=((date_trunc('month',now() at time zone 'Asia/Jerusalem')+interval '1 month') at time zone 'Asia/Jerusalem') where id=o.user_id;
end; $$;
revoke all on function public.confirm_dealer_setup(uuid,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.confirm_dealer_setup(uuid,text,text,text,text,boolean) to service_role;

-- The report covers the closed month only, and only after a dealer opted in and paid setup.
create function public.prepare_dealer_monthly_orders() returns integer
language plpgsql security invoker set search_path='' as $$
declare a public.dealer_billing_accounts; start_at timestamptz; end_at timestamptz; first_at timestamptz; p date; n integer; total integer:=0;
begin
 end_at:=date_trunc('month',now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem';
 p:=((end_at at time zone 'Asia/Jerusalem')-interval '1 month')::date;
 start_at:=p::timestamp at time zone 'Asia/Jerusalem';
 for a in select * from public.dealer_billing_accounts where activated_at<end_at and (cancelled_at is null or cancelled_at>=start_at) loop
  first_at:=greatest(start_at,a.activated_at);
  select greatest(coalesce((select active_count from public.dealer_inventory_events where user_id=a.user_id and recorded_at<=first_at order by recorded_at desc,id desc limit 1),0),coalesce((select max(active_count) from public.dealer_inventory_events where user_id=a.user_id and recorded_at>first_at and recorded_at<least(end_at,coalesce(a.cancelled_at,end_at))),0)) into n;
  insert into public.dealer_billing_orders(user_id,kind,period,peak,amount_agorot,status,failure_code)
   values(a.user_id,'monthly',p,n,case when a.plan='small' then n*10000 else greatest(n,40)*5000 end,case when a.plan='small' and n>10 then 'review' else 'pending' end,case when a.plan='small' and n>10 then 'plan_limit' end)
   on conflict(user_id,period,kind) do nothing;
  total:=total+1;
 end loop;
 return total;
end; $$;
revoke all on function public.prepare_dealer_monthly_orders() from public,anon,authenticated;
grant execute on function public.prepare_dealer_monthly_orders() to service_role;

create function public.complete_dealer_monthly_order(p_order uuid,p_transaction text,p_document text)
returns void language plpgsql security invoker set search_path='' as $$
declare o public.dealer_billing_orders;
begin
 select * into o from public.dealer_billing_orders where id=p_order and kind='monthly' for update;
 if not found then raise exception 'Unknown invoice'; end if;
 if o.status='paid' then return; end if;
 update public.dealer_billing_orders set status='paid',paid_at=now(),transaction_id=p_transaction,document_number=p_document,document_status=case when p_document is null then 'review' else 'issued' end where id=o.id;
 update public.users set subscription_valid_until=greatest(subscription_valid_until,((o.period::timestamp+interval '2 months') at time zone 'Asia/Jerusalem')) where id=o.user_id and exists(select 1 from public.dealer_billing_accounts a where a.user_id=o.user_id and a.cancelled_at is null);
end; $$;
revoke all on function public.complete_dealer_monthly_order(uuid,text,text) from public,anon,authenticated;
grant execute on function public.complete_dealer_monthly_order(uuid,text,text) to service_role;

-- Service-role operations come from the authenticated payment verifier, never a browser.
create or replace function public.protect_privileged_user_columns() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if current_setting('role',true)='service_role' then return new; end if;
 if not public.is_admin(auth.uid()) then
  if new.is_admin is distinct from old.is_admin or new.is_banned is distinct from old.is_banned or new.premium_until is distinct from old.premium_until or new.subscription_valid_until is distinct from old.subscription_valid_until or new.dealer_trial_started_at is distinct from old.dealer_trial_started_at or new.custom_domain_active is distinct from old.custom_domain_active then
   raise exception 'Only an admin can change these fields';
  end if;
 end if;
 return new;
end; $$;

create function billing_private.enforce_small_inventory() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if NEW.active_count>10 and exists(select 1 from public.dealer_billing_accounts where user_id=NEW.user_id and plan='small' and state='active') then
  raise exception 'מסלול סוחר קטן מוגבל ל-10 רכבים פעילים. יש לעבור למסלול מגרש לפני הוספת רכב.';
 end if;
 return NEW;
end; $$;
revoke all on function billing_private.enforce_small_inventory() from public,anon,authenticated;
create trigger enforce_small_inventory before update on public.dealer_inventory_meter for each row execute function billing_private.enforce_small_inventory();
