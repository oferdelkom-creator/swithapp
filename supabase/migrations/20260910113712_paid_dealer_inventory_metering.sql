-- Paid dealer plans: no new automatic trials. Existing grants are preserved.
drop trigger if exists z_before_users_update_start_dealer_trial on public.users;
create schema if not exists billing_private;
revoke all on schema billing_private from public, anon, authenticated;

create table public.dealer_inventory_meter (
 user_id uuid primary key references public.users(id) on delete cascade,
 active_count integer not null check(active_count >= 0),
 tracking_started_at timestamptz not null default clock_timestamp()
);
alter table public.dealer_inventory_meter enable row level security;
grant select on public.dealer_inventory_meter to authenticated;
create policy inventory_meter_read on public.dealer_inventory_meter for select to authenticated
 using (user_id=(select auth.uid()) or exists(select 1 from public.users where id=(select auth.uid()) and is_admin));

create table public.dealer_inventory_events (
 id bigint generated always as identity primary key,
 user_id uuid not null references public.users(id) on delete cascade,
 active_count integer not null check(active_count >= 0),
 recorded_at timestamptz not null default clock_timestamp()
);
create index dealer_inventory_events_owner_time on public.dealer_inventory_events(user_id,recorded_at desc);
alter table public.dealer_inventory_events enable row level security;
grant select on public.dealer_inventory_events to authenticated;
create policy inventory_events_read on public.dealer_inventory_events for select to authenticated
 using (user_id=(select auth.uid()) or exists(select 1 from public.users where id=(select auth.uid()) and is_admin));

-- Lock inventory while baselining so no transaction falls between seed and trigger.
lock table public.cars in share row exclusive mode;
insert into public.dealer_inventory_meter(user_id,active_count)
 select u.id,count(c.id)::integer from public.users u left join public.cars c
 on c.user_id=u.id and c.sold_at is null and (c.for_sale or c.for_swap) and not c.is_seed
 group by u.id;
insert into public.dealer_inventory_events(user_id,active_count)
 select user_id,active_count from public.dealer_inventory_meter;

create function billing_private.record_inventory_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare old_owner uuid; new_owner uuid; old_active integer:=0; new_active integer:=0; owner_id uuid; delta integer; current_count integer;
begin
 if TG_OP <> 'INSERT' then
  old_owner:=OLD.user_id;
  old_active:=case when OLD.sold_at is null and (OLD.for_sale or OLD.for_swap) and not OLD.is_seed then 1 else 0 end;
 end if;
 if TG_OP <> 'DELETE' then
  new_owner:=NEW.user_id;
  new_active:=case when NEW.sold_at is null and (NEW.for_sale or NEW.for_swap) and not NEW.is_seed then 1 else 0 end;
 end if;
 -- Stable lock order and atomic counters avoid undercounting concurrent changes.
 for owner_id in select distinct x from unnest(array[old_owner,new_owner]) x where x is not null order by x loop
  delta:=(case when owner_id=new_owner then new_active else 0 end)-(case when owner_id=old_owner then old_active else 0 end);
  if delta<>0 then
   insert into public.dealer_inventory_meter(user_id,active_count) values(owner_id,0) on conflict do nothing;
   update public.dealer_inventory_meter set active_count=active_count+delta where user_id=owner_id returning active_count into current_count;
   insert into public.dealer_inventory_events(user_id,active_count) values(owner_id,current_count);
  end if;
 end loop;
 return null;
end;
$$;
revoke all on function billing_private.record_inventory_change() from public,anon,authenticated;
create trigger record_dealer_inventory after insert or update or delete on public.cars
 for each row execute function billing_private.record_inventory_change();

-- RLS is respected: callers see only their own meter (or admin-authorized rows).
create function public.dealer_monthly_peak(p_month date) returns table(user_id uuid,peak integer,tracking_started_at timestamptz)
language sql stable security invoker set search_path='' as $$
 select m.user_id,greatest(
  coalesce((select e.active_count from public.dealer_inventory_events e where e.user_id=m.user_id and e.recorded_at < (date_trunc('month',p_month::timestamp) at time zone 'Asia/Jerusalem') order by e.recorded_at desc,e.id desc limit 1),0),
  coalesce((select max(e.active_count) from public.dealer_inventory_events e where e.user_id=m.user_id and e.recorded_at >= (date_trunc('month',p_month::timestamp) at time zone 'Asia/Jerusalem') and e.recorded_at < ((date_trunc('month',p_month::timestamp)+interval '1 month') at time zone 'Asia/Jerusalem')),0)
 )::integer,m.tracking_started_at from public.dealer_inventory_meter m;
$$;
revoke all on function public.dealer_monthly_peak(date) from public,anon;
grant execute on function public.dealer_monthly_peak(date) to authenticated,service_role;
