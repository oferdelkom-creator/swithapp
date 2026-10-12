-- Every service provider: ILS 499/month including VAT, setup and inventory.
-- No existing invoices or completed payments are rewritten.
CREATE OR REPLACE FUNCTION public.begin_dealer_setup(p_user uuid, p_plan text, p_name text, p_tax text, p_email text)
 RETURNS dealer_billing_orders
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare a public.dealer_billing_accounts; o public.dealer_billing_orders;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if p_plan not in ('small','lot') or not exists(select 1 from public.users where id=p_user and role in ('dealer','importer') and not is_banned) then raise exception 'Invalid dealer'; end if;
 select * into a from public.dealer_billing_accounts where user_id=p_user;
 if found and a.plan<>p_plan then raise exception 'Existing plan requires a reviewed change'; end if;
 insert into public.dealer_billing_accounts(user_id,plan,legal_name,tax_id,email,terms_version) values(p_user,p_plan,p_name,p_tax,p_email,'2026-10-12-flat-499') on conflict do nothing;
 insert into public.dealer_billing_orders(user_id,kind,amount_agorot) values(p_user,'setup',49900) on conflict do nothing;
 select * into o from public.dealer_billing_orders where user_id=p_user and kind='setup';
 if o.amount_agorot<>49900 then raise exception 'Existing payment requires review'; end if;
 return o;
end; $function$;

CREATE OR REPLACE FUNCTION public.prepare_dealer_monthly_orders()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare a public.dealer_billing_accounts; start_at timestamptz; end_at timestamptz; first_at timestamptz; p date; n integer; total integer:=0;
begin
 end_at:=date_trunc('month',now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem';
 p:=((end_at at time zone 'Asia/Jerusalem')-interval '1 month')::date;
 start_at:=p::timestamp at time zone 'Asia/Jerusalem';
 for a in select * from public.dealer_billing_accounts where activated_at<end_at and (cancelled_at is null or cancelled_at>=start_at) loop
  -- The activation payment covers the first calendar month.
  if a.terms_version='2026-10-12-flat-499' and p=date_trunc('month',a.activated_at at time zone 'Asia/Jerusalem')::date then continue; end if;
  first_at:=greatest(start_at,a.activated_at);
  select greatest(coalesce((select active_count from public.dealer_inventory_events where user_id=a.user_id and recorded_at<=first_at order by recorded_at desc,id desc limit 1),0),coalesce((select max(active_count) from public.dealer_inventory_events where user_id=a.user_id and recorded_at>first_at and recorded_at<least(end_at,coalesce(a.cancelled_at,end_at))),0)) into n;
  insert into public.dealer_billing_orders(user_id,kind,period,peak,amount_agorot,status,failure_code)
   values(a.user_id,'monthly',p,n,49900,'pending',null)
   on conflict(user_id,period,kind) do nothing;
  total:=total+1;
 end loop;
 return total;
end; $function$;

create or replace function billing_private.enforce_small_inventory() returns trigger
language plpgsql security invoker set search_path='' as $$
begin return NEW; end; $$;
revoke all on function billing_private.enforce_small_inventory() from public,anon,authenticated;
revoke all on function public.begin_dealer_setup(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.begin_dealer_setup(uuid,text,text,text,text) to service_role;
revoke all on function public.prepare_dealer_monthly_orders() from public,anon,authenticated;
grant execute on function public.prepare_dealer_monthly_orders() to service_role;

