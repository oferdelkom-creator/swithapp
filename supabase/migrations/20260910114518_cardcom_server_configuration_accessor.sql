create function public.switchapp_payment_config() returns jsonb language sql security definer set search_path='' as $$ select decrypted_secret::jsonb from vault.decrypted_secrets where name='switchapp_cardcom'; $$;
revoke all on function public.switchapp_payment_config() from public,anon,authenticated;
grant execute on function public.switchapp_payment_config() to service_role;
