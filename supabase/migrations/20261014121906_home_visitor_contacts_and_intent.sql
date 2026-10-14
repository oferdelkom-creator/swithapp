create table public.visitor_contacts (
 id uuid primary key default gen_random_uuid(),
 contact_name text not null check(length(contact_name) between 2 and 80),
 phone_e164 text not null check(phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
 session_token_hash text not null unique check(length(session_token_hash)=64),
 intent text check(intent in ('buy','sell','swap','business')),
 consent_at timestamptz not null,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index visitor_contacts_created on public.visitor_contacts(created_at desc);
alter table public.visitor_contacts enable row level security;
revoke all on public.visitor_contacts from public,anon,authenticated;
grant select on public.visitor_contacts to authenticated;
grant all on public.visitor_contacts to service_role;
create policy visitor_contacts_admin_read on public.visitor_contacts for select to authenticated using(public.is_admin((select auth.uid())));

create table public.visitor_request_limits (
 bucket text not null check(length(bucket) between 1 and 100),
 hour_start timestamptz not null,
 requests integer not null default 1,
 primary key(bucket,hour_start)
);
alter table public.visitor_request_limits enable row level security;
revoke all on public.visitor_request_limits from public,anon,authenticated;
grant all on public.visitor_request_limits to service_role;
create function public.consume_visitor_request(p_bucket text,p_limit integer) returns boolean
language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if p_limit<1 or p_limit>1000 or length(p_bucket) not between 1 and 100 then return false; end if;
 insert into public.visitor_request_limits(bucket,hour_start,requests) values(p_bucket,date_trunc('hour',now()),1)
 on conflict(bucket,hour_start) do update set requests=public.visitor_request_limits.requests+1 where public.visitor_request_limits.requests<p_limit returning requests into n;
 return n is not null;
end; $$;
revoke all on function public.consume_visitor_request(text,integer) from public,anon,authenticated;
grant execute on function public.consume_visitor_request(text,integer) to service_role;
