create policy "Telegram dealer accounts stay server-private"
  on public.telegram_dealer_accounts
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "Telegram dealer leads stay server-private"
  on public.telegram_dealer_leads
  for all
  to anon, authenticated
  using (false)
  with check (false);


