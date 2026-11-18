-- Durable inbound queue for the WhatsApp channel: idempotency (unique MessageSid),
-- crash-durability (the row exists before processing), a per-lease fencing token so only
-- the current owner can send/complete, and retry visibility.

create table public.whatsapp_inbound (
  message_sid text primary key,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9]\d{7,14}$'),
  to_e164 text,
  body text not null,
  received_at timestamptz not null default now(),
  processing_at timestamptz,
  lease_token uuid,
  send_attempted_at timestamptz,
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

-- Claim an inbound message exactly once and take a fencing lease. Returns the lease token
-- to the first caller; a duplicate MessageSid (a Twilio retry) inserts nothing and returns
-- null.
create function public.claim_whatsapp_inbound(p_sid text, p_phone text, p_to text, p_body text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare n_inserted integer; v_token uuid;
begin
  if p_sid is null or p_sid = '' or p_phone !~ '^\+[1-9]\d{7,14}$' or p_body is null then
    return null;
  end if;
  v_token := gen_random_uuid();
  insert into public.whatsapp_inbound (message_sid, phone_e164, to_e164, body, processing_at, lease_token)
  values (p_sid, p_phone, left(coalesce(p_to, ''), 40), left(p_body, 4000), now(), v_token)
  on conflict (message_sid) do nothing;
  get diagnostics n_inserted = row_count;
  if n_inserted = 1 then return v_token; else return null; end if;
end; $$;
revoke all on function public.claim_whatsapp_inbound(text, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_whatsapp_inbound(text, text, text, text) to service_role;

-- Atomically lease up to p_limit never-sent pending rows whose lease has expired, issuing a
-- FRESH lease_token to each (which fences off any previous owner). FOR UPDATE SKIP LOCKED
-- keeps two concurrent sweeps from grabbing the same rows.
create function public.lease_stale_whatsapp_inbound(p_limit integer, p_max_attempts integer, p_lease_seconds integer)
returns setof public.whatsapp_inbound language plpgsql security invoker set search_path = '' as $$
begin
  return query
  update public.whatsapp_inbound w
  set processing_at = now(), lease_token = gen_random_uuid()
  where w.message_sid in (
    select s.message_sid from public.whatsapp_inbound s
    where s.processed_at is null
      and s.send_attempted_at is null  -- never auto-resend a message a send was already attempted for
      and s.attempts < p_max_attempts
      and (s.processing_at is null or s.processing_at < now() - make_interval(secs => p_lease_seconds))
    order by s.received_at
    limit greatest(p_limit, 0)
    for update skip locked
  )
  returning w.*;
end; $$;
revoke all on function public.lease_stale_whatsapp_inbound(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.lease_stale_whatsapp_inbound(integer, integer, integer) to service_role;

-- Atomically claim the right to send, but only for the holder of the current lease token:
-- sets send_attempted_at only if still null AND the lease matches. Returns true only to that
-- owner, so a stale worker whose lease was reassigned cannot send.
create function public.begin_whatsapp_send(p_sid text, p_token uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare n_updated integer;
begin
  update public.whatsapp_inbound set send_attempted_at = now()
  where message_sid = p_sid and send_attempted_at is null and lease_token = p_token;
  get diagnostics n_updated = row_count;
  return n_updated = 1;
end; $$;
revoke all on function public.begin_whatsapp_send(text, uuid) from public, anon, authenticated;
grant execute on function public.begin_whatsapp_send(text, uuid) to service_role;

-- Mark processed (ok) or bump the retry counter (not ok) — only if the caller still holds
-- the lease. A stale worker is ignored.
create function public.mark_whatsapp_inbound_processed(p_sid text, p_token uuid, p_ok boolean, p_error text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_ok then
    update public.whatsapp_inbound set processed_at = now(), last_error = null
    where message_sid = p_sid and lease_token = p_token;
  else
    update public.whatsapp_inbound set attempts = attempts + 1, last_error = left(coalesce(p_error, ''), 500)
    where message_sid = p_sid and lease_token = p_token;
  end if;
end; $$;
revoke all on function public.mark_whatsapp_inbound_processed(text, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.mark_whatsapp_inbound_processed(text, uuid, boolean, text) to service_role;

-- Defined path for messages stuck after a send was attempted (send_attempted_at set but
-- never completed). These are never auto-resent; after a threshold they are resolved as
-- 'send_unconfirmed' so they stop lingering as pending and an admin can review them.
create function public.resolve_stuck_whatsapp_sends(p_older_seconds integer)
returns integer language plpgsql security invoker set search_path = '' as $$
declare n_resolved integer;
begin
  update public.whatsapp_inbound set processed_at = now(), last_error = 'send_unconfirmed'
  where processed_at is null
    and send_attempted_at is not null
    and send_attempted_at < now() - make_interval(secs => greatest(p_older_seconds, 0));
  get diagnostics n_resolved = row_count;
  return n_resolved;
end; $$;
revoke all on function public.resolve_stuck_whatsapp_sends(integer) from public, anon, authenticated;
grant execute on function public.resolve_stuck_whatsapp_sends(integer) to service_role;
