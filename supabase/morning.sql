-- Plant Parenthood: checks every 15 minutes whether it is morning for
-- anyone, and sends them their list of plant jobs. Run once, after the
-- "push" function is deployed. Safe to run again.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'plant-parenthood-digest',
  '*/15 * * * *',
  $$select net.http_post(
    url := 'https://bmghljsucuwtztcqbbpq.supabase.co/functions/v1/push',
    body := '{"action":"digest"}'::jsonb,
    headers := '{"Content-Type":"application/json"}'::jsonb
  )$$
);
