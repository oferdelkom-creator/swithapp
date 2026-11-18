-- Durable inbound queue for the WhatsApp channel: idempotency (unique MessageSid),
-- crash-durability (the row exists before processing), and retry visibility for the sweep.

create table public.whatsapp_inbound (
  message_sid text primary key,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9]\d{7,14}$'),
  to_e164 text,
  body text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  last_error text
);
create index whatsapp_inbound_pending on public.whatsapp_inbound (received_at) where processed_at is null;

alter table public.whatsapp_inbound enable row level security;
revoke all on public.whatsapp_inbound from public, anon, authenticated;
grant all on public.whatsapp_inbound to service_role;
create policy whatsapp_inbound_admin_read on public.whatsapp_inbound
  for select to authenticated using (public.is_admin((select auth.uid())));

-- Claim an inbound message exactly once. Returns true to the first caller; a duplicate
-- MessageSid (a Twilio retry) inserts nothing and returns false.
create function public.claim_whatsapp_inbound(p_sid text, p_phone text, p_to text, p_body text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare n_inserted integer;
begin
  if p_sid is null or p_sid = '' or p_phone !~ '^\+[1-9]\d{7,14}$' or p_body is null then
    return false;
  end if;
  insert into public.whatsapp_inbound (message_sid, phone_e164, to_e164, body)
  values (p_sid, p_phone, left(coalesce(p_to, ''), 40), left(p_body, 4000))
  on conflict (message_sid) do nothing;
  get diagnostics n_inserted = row_count;
  return n_inserted = 1;
end; $$;
revoke all on function public.claim_whatsapp_inbound(text, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_whatsapp_inbound(text, text, text, text) to service_role;

-- Mark an inbound row processed (ok) or bump its retry counter and record the error (not ok).
create function public.mark_whatsapp_inbound_processed(p_sid text, p_ok boolean, p_error text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_ok then
    update public.whatsapp_inbound set processed_at = now(), last_error = null where message_sid = p_sid;
  else
    update public.whatsapp_inbound set attempts = attempts + 1, last_error = left(coalesce(p_error, ''), 500) where message_sid = p_sid;
  end if;
end; $$;
revoke all on function public.mark_whatsapp_inbound_processed(text, boolean, text) from public, anon, authenticated;
grant execute on function public.mark_whatsapp_inbound_processed(text, boolean, text) to service_role;
