create table public.assistant_usage (
 user_id uuid not null references public.users(id) on delete cascade,
 hour_start timestamptz not null,
 requests integer not null default 1 check(requests between 1 and 15),
 primary key(user_id,hour_start)
);
alter table public.assistant_usage enable row level security;
revoke all on public.assistant_usage from public,anon,authenticated;
grant all on public.assistant_usage to service_role;

create function public.consume_assistant_request() returns boolean
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); n integer;
begin
 if u is null or not exists(select 1 from public.users where id=u and not is_banned) then return false; end if;
 insert into public.assistant_usage(user_id,hour_start,requests)
 values(u,date_trunc('hour',now()),1)
 on conflict(user_id,hour_start) do update set requests=public.assistant_usage.requests+1
 where public.assistant_usage.requests<15 returning requests into n;
 return n is not null;
end; $$;
revoke all on function public.consume_assistant_request() from public,anon;
grant execute on function public.consume_assistant_request() to authenticated;

create table public.bot_sale_commissions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.users(id),
 car_id uuid not null unique,
 sale_price numeric(14,2) not null check(sale_price>0 and sale_price<=100000000),
 bot_reference text not null check(length(bot_reference) between 5 and 500),
 commission_agorot bigint not null check(commission_agorot>=0),
 vat_agorot bigint not null check(vat_agorot>=0),
 vat_rate numeric not null default 0.18,
 status text not null default 'reported' check(status in ('reported','verified','paid','rejected')),
 terms_version text not null default '2026-10-14-3pct-plus-vat',
 created_at timestamptz not null default now()
);
create index bot_sale_commissions_owner on public.bot_sale_commissions(user_id,created_at desc);
alter table public.bot_sale_commissions enable row level security;
revoke all on public.bot_sale_commissions from public,anon,authenticated;
grant select on public.bot_sale_commissions to authenticated;
grant all on public.bot_sale_commissions to service_role;
create policy bot_sales_read on public.bot_sale_commissions for select to authenticated
 using(user_id=(select auth.uid()) or public.is_admin((select auth.uid())));

create function public.report_bot_vehicle_sale(p_car uuid,p_sale_price numeric,p_bot_reference text,p_accepted boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); id uuid; fee bigint; tax bigint;
begin
 if u is null or p_accepted is distinct from true or p_sale_price is null or p_sale_price='NaN'::numeric or p_sale_price<=0 or p_sale_price>100000000 or p_bot_reference is null or length(trim(p_bot_reference)) not between 5 and 500 then raise exception 'Invalid sale'; end if;
 if not exists(select 1 from public.users where users.id=u and role in ('dealer','importer') and not is_banned) then raise exception 'Supplier required'; end if;
 perform 1 from public.cars where cars.id=p_car and user_id=u and sold_at is null for update;
 if not found then raise exception 'Active owned vehicle required'; end if;
 fee:=round(round(p_sale_price,2)*100*0.03); tax:=round(fee*0.18);
 insert into public.bot_sale_commissions(user_id,car_id,sale_price,bot_reference,commission_agorot,vat_agorot)
 values(u,p_car,round(p_sale_price,2),trim(p_bot_reference),fee,tax) returning bot_sale_commissions.id into id;
 update public.cars set sold_at=now(),for_sale=false,for_swap=false where cars.id=p_car and user_id=u;
 return id;
end; $$;
revoke all on function public.report_bot_vehicle_sale(uuid,numeric,text,boolean) from public,anon;
grant execute on function public.report_bot_vehicle_sale(uuid,numeric,text,boolean) to authenticated;

create function public.review_bot_vehicle_sale(p_id uuid,p_status text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if public.is_admin(auth.uid()) is distinct from true or p_status not in ('verified','paid','rejected') then raise exception 'Admin review required'; end if;
 update public.bot_sale_commissions set status=p_status where id=p_id and
 ((status='reported' and p_status in ('verified','rejected')) or (status='verified' and p_status in ('paid','rejected')));
 if not found then raise exception 'Invalid sale transition'; end if;
end; $$;
revoke all on function public.review_bot_vehicle_sale(uuid,text) from public,anon;
grant execute on function public.review_bot_vehicle_sale(uuid,text) to authenticated;
