create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.schedule('switchapp-month-end-billing','5 * * * *',$job$
 select net.http_post(url:='https://hltpqflqngtrmprayyvd.supabase.co/functions/v1/dealer-billing?action=close-month',headers:=jsonb_build_object('Content-Type','application/json','x-billing-secret',(select (decrypted_secret::jsonb)->>'cron_secret' from vault.decrypted_secrets where name='switchapp_cardcom')),body:='{}'::jsonb,timeout_milliseconds:=60000);
$job$);
