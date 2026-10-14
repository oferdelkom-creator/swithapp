alter table public.visitor_contacts add column email text check(email is null or length(email) between 3 and 254), add column offers_consent_at timestamptz;
create table public.visitor_conversations (
 id uuid primary key default gen_random_uuid(), visitor_id uuid not null references public.visitor_contacts(id),
 intent text not null check(intent in ('buy','sell','swap','business')), locale text not null default 'he',
 messages jsonb not null default '[]'::jsonb check(jsonb_typeof(messages)='array' and octet_length(messages::text)<=160000),
 search_filters jsonb, no_match boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), ended_at timestamptz, report_sent_at timestamptz
);
create index visitor_conversations_owner on public.visitor_conversations(visitor_id,created_at desc);
alter table public.visitor_conversations enable row level security;
revoke all on public.visitor_conversations from public,anon,authenticated;
grant select on public.visitor_conversations to authenticated;
grant all on public.visitor_conversations to service_role;
create policy visitor_conversations_admin_read on public.visitor_conversations for select to authenticated using(public.is_admin((select auth.uid())));
create function public.append_visitor_conversation(p_id uuid,p_visitor uuid,p_user text,p_assistant text,p_filters jsonb,p_no_match boolean) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 if length(p_user)>2000 or length(p_assistant)>10000 then return false; end if;
 update public.visitor_conversations set messages=messages||jsonb_build_array(jsonb_build_object('role','user','content',p_user),jsonb_build_object('role','assistant','content',p_assistant)), search_filters=coalesce(p_filters,search_filters),no_match=case when p_filters is null then no_match else p_no_match end,updated_at=now()
 where id=p_id and visitor_id=p_visitor and ended_at is null and jsonb_array_length(messages)<120;
 return found;
end; $$;
revoke all on function public.append_visitor_conversation(uuid,uuid,text,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.append_visitor_conversation(uuid,uuid,text,text,jsonb,boolean) to service_role;
