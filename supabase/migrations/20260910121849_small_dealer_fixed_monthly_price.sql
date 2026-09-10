create or replace function public.prepare_dealer_monthly_orders() returns integer
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
   values(a.user_id,'monthly',p,n,case when a.plan='small' then 100000 else greatest(n,40)*5000 end,case when a.plan='small' and n>10 then 'review' else 'pending' end,case when a.plan='small' and n>10 then 'plan_limit' end)
   on conflict(user_id,period,kind) do nothing;
  total:=total+1;
 end loop;
 return total;
end; $$;
revoke all on function public.prepare_dealer_monthly_orders() from public,anon,authenticated;
grant execute on function public.prepare_dealer_monthly_orders() to service_role;

