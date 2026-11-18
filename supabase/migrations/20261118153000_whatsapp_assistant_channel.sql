-- WhatsApp assistant channel: per-phone conversation store for the Twilio WhatsApp webhook.
-- Mirrors visitor_conversations (service-role writes, admin-only read) but keyed by phone,
-- since a WhatsApp sender has no browser visitor session. Customer mode only for now.

create table public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null unique check (phone_e164 ~ '^\+[1-9]\d{7,14}$'),
  locale text not null default 'he' check (locale in ('he','en','ru','ar')),
  intent text check (intent is null or intent in ('buy','sell','swap','business')),
  messages jsonb not null default '[]'::jsonb
    check (jsonb_typeof(messages) = 'array' and octet_length(messages::text) <= 160000),
  search_filters jsonb,
  no_match boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_inbound_at timestamptz
);
create index whatsapp_conversations_phone on public.whatsapp_conversations(phone_e164);

alter table public.whatsapp_conversations enable row level security;
revoke all on public.whatsapp_conversations from public, anon, authenticated;
grant all on public.whatsapp_conversations to service_role;
create policy whatsapp_conversations_admin_read on public.whatsapp_conversations
  for select to authenticated using (public.is_admin((select auth.uid())));

-- Append an inbound/outbound pair, creating the conversation on first contact.
-- Caps history at 120 messages to bound row size; returns false on invalid input.
create function public.append_whatsapp_message(
  p_phone text, p_user text, p_assistant text, p_locale text,
  p_filters jsonb, p_no_match boolean
) returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if p_phone !~ '^\+[1-9]\d{7,14}$' or length(p_user) > 2000 or length(p_assistant) > 10000 then
    return false;
  end if;
  insert into public.whatsapp_conversations as c
    (phone_e164, locale, messages, search_filters, no_match, last_inbound_at)
  values (
    p_phone,
    coalesce(nullif(p_locale, ''), 'he'),
    jsonb_build_array(
      jsonb_build_object('role', 'user', 'content', p_user),
      jsonb_build_object('role', 'assistant', 'content', p_assistant)
    ),
    p_filters,
    coalesce(p_no_match, false),
    now()
  )
  on conflict (phone_e164) do update set
    messages = case
      when jsonb_array_length(c.messages) < 120
        then c.messages || jsonb_build_array(
          jsonb_build_object('role', 'user', 'content', p_user),
          jsonb_build_object('role', 'assistant', 'content', p_assistant)
        )
      else c.messages
    end,
    search_filters = coalesce(excluded.search_filters, c.search_filters),
    no_match = case when excluded.search_filters is null then c.no_match else excluded.no_match end,
    locale = coalesce(nullif(p_locale, ''), c.locale),
    last_inbound_at = now(),
    updated_at = now();
  return true;
end; $$;
revoke all on function public.append_whatsapp_message(text, text, text, text, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.append_whatsapp_message(text, text, text, text, jsonb, boolean)
  to service_role;
