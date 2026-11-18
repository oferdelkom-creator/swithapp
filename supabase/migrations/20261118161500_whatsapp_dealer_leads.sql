-- Dealer-recruitment leads captured over WhatsApp. This row IS the human handoff: the
-- team works 'new' leads. No account, payment, or promised feature is created here.

create table public.whatsapp_dealer_leads (
  phone_e164 text primary key check (phone_e164 ~ '^\+[1-9]\d{7,14}$'),
  business_name text not null,
  city text,
  status text not null default 'new' check (status in ('new', 'contacted', 'converted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_dealer_leads enable row level security;
revoke all on public.whatsapp_dealer_leads from public, anon, authenticated;
grant all on public.whatsapp_dealer_leads to service_role;
create policy whatsapp_dealer_leads_admin_read on public.whatsapp_dealer_leads
  for select to authenticated using (public.is_admin((select auth.uid())));

-- Record (or update) a prospective dealer keyed by phone. Returns false on invalid input.
create function public.capture_whatsapp_dealer_lead(p_phone text, p_business text, p_city text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if p_phone !~ '^\+[1-9]\d{7,14}$'
     or p_business is null
     or length(btrim(p_business)) < 2
     or length(p_business) > 120 then
    return false;
  end if;
  insert into public.whatsapp_dealer_leads as c (phone_e164, business_name, city)
  values (p_phone, left(btrim(p_business), 120), nullif(left(btrim(coalesce(p_city, '')), 80), ''))
  on conflict (phone_e164) do update set
    business_name = excluded.business_name,
    city = coalesce(excluded.city, c.city),
    updated_at = now();
  return true;
end; $$;
revoke all on function public.capture_whatsapp_dealer_lead(text, text, text) from public, anon, authenticated;
grant execute on function public.capture_whatsapp_dealer_lead(text, text, text) to service_role;
