-- LOCAL REVIEW ONLY. Apply after managed runtime and normalized plate lookup.
-- Site session and per-visitor limits remain the responsibility of the trusted server.
begin;
grant switchapp_whatsapp_owner to postgres with inherit true, set true;

create table whatsapp_private.plate_web_limit(
 singleton boolean primary key default true check(singleton),
 hits timestamptz[] not null default '{}'::timestamptz[] check(cardinality(hits)<=30)
);
insert into whatsapp_private.plate_web_limit default values;
alter table whatsapp_private.plate_web_limit owner to switchapp_whatsapp_owner;
revoke all on whatsapp_private.plate_web_limit from public,anon,authenticated,service_role,switchapp_whatsapp_runtime;

create function whatsapp_api.lookup_plate_web(p_plate text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c whatsapp_private.config; locked_hits timestamptz[]; kept timestamptz[]; n timestamptz; result jsonb;
begin
 if p_plate is null or p_plate collate "C" !~ '^[0-9]{7,8}$' then return null; end if;
 c:=whatsapp_private.machine();
 if c.subject is null then return null; end if;
 select l.hits into locked_hits from whatsapp_private.plate_web_limit l where l.singleton for update;
 if not found then return null; end if;
 -- Another web request may have held the lock until after the credential expired.
 c:=whatsapp_private.machine();
 if c.subject is null then return null; end if;
 n:=clock_timestamp();
 select coalesce(array_agg(t order by t),'{}'::timestamptz[]) into kept
 from unnest(locked_hits) as recent(t) where t>n-interval '1 minute';
 if cardinality(kept)>=30 then return null; end if;
 -- Count accepted attempts (including no match and ambiguity); no plate/IP/user is retained.
 update whatsapp_private.plate_web_limit set hits=array_append(kept,n) where singleton;
 result:=whatsapp_private.catalog_lookup_plate(p_plate);
 c:=whatsapp_private.machine();
 if c.subject is null then return null; end if;
 return result;
end $$;
alter function whatsapp_api.lookup_plate_web(text) owner to switchapp_whatsapp_owner;
revoke all on function whatsapp_api.lookup_plate_web(text) from public,anon,authenticated,service_role;
grant execute on function whatsapp_api.lookup_plate_web(text) to switchapp_whatsapp_runtime;
grant switchapp_whatsapp_owner to postgres with inherit false, set false;
commit;
