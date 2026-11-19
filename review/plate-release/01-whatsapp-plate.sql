-- LOCAL REVIEW ONLY. Separate scoped capability, after managed facade/catalog.
begin;
grant switchapp_whatsapp_owner to postgres with inherit true, set true;
grant switchapp_whatsapp_catalog to postgres with inherit true, set true;
grant create on schema whatsapp_private to switchapp_whatsapp_catalog;
grant select(plate_number) on public.cars to switchapp_whatsapp_catalog;

create function whatsapp_private.catalog_lookup_plate(p_plate text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare count_found bigint; rows_found jsonb;
begin
 if p_plate is null or p_plate collate "C" !~ '^[0-9]{7,8}$' then return null; end if;
 select count(*),jsonb_agg(case when length(q.make) between 1 and 60 and length(q.model) between 1 and 60
  then jsonb_build_object('id',q.id,'make',q.make,'model',q.model,'year',q.year,'price',q.price,
   'mileage',q.mileage,'fuel_type',q.fuel,'region',q.region) else null end)
 into count_found,rows_found
 from (
  select c.id,c.make,c.model,c.year,c.price,c.mileage,c.fuel_type::text as fuel,c.region::text as region
  from public.cars c
  where c.plate_number::text collate "C" ~ '^[0-9 -]+$'
   and regexp_replace(c.plate_number::text,'[ -]','','g') collate "C"=p_plate collate "C"
   and c.for_sale is true and c.is_seed is false and c.sold_at is null
   and exists(select 1 from public.users s where s.id=c.user_id and s.is_seed is false)
  limit 2
 ) q;
 if count_found=0 then return '[]'::jsonb; end if;
 if count_found<>1 or rows_found->0='null'::jsonb then return null; end if;
 return rows_found;
end $$;
alter function whatsapp_private.catalog_lookup_plate(text) owner to switchapp_whatsapp_catalog;
revoke all on function whatsapp_private.catalog_lookup_plate(text) from public,anon,authenticated,service_role,switchapp_whatsapp_runtime;
grant execute on function whatsapp_private.catalog_lookup_plate(text) to switchapp_whatsapp_owner;

create function whatsapp_api.lookup_plate(p_sid text,p_token uuid,p_plate text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q whatsapp_private.queue; result jsonb;
begin
 if p_plate is null or p_plate collate "C" !~ '^[0-9]{7,8}$' then return null; end if;
 q:=whatsapp_private.owned(p_sid,p_token,true);
 if q.sid is null then return null; end if;
 result:=whatsapp_private.catalog_lookup_plate(p_plate);
 if (whatsapp_private.owned(p_sid,p_token,true)).sid is null then return null; end if;
 return result;
end $$;
alter function whatsapp_api.lookup_plate(text,uuid,text) owner to switchapp_whatsapp_owner;
revoke all on function whatsapp_api.lookup_plate(text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function whatsapp_api.lookup_plate(text,uuid,text) to switchapp_whatsapp_runtime;
revoke create on schema whatsapp_private from switchapp_whatsapp_catalog;
grant switchapp_whatsapp_owner to postgres with inherit false, set false;
grant switchapp_whatsapp_catalog to postgres with inherit false, set false;
commit;
