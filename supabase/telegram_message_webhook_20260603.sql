-- Plantilla para crear webhooks de mensajes hacia la Edge Function telegram-bot.
--
-- IMPORTANTE:
-- - Reemplaza <project-ref> por el ref real del proyecto Supabase.
-- - Reemplaza <MALL_INTERNAL_NOTIFY_SECRET> por el mismo secreto configurado en
--   la Edge Function como MALL_INTERNAL_NOTIFY_SECRET.
-- - No guardes el secreto real en git ni en archivos compartidos.
-- - Ejecuta este archivo solo despues de desplegar la Edge Function telegram-bot.

drop trigger if exists mall_messages_telegram_webhook on public.mall_messages;
create trigger mall_messages_telegram_webhook
after insert on public.mall_messages
for each row
execute function supabase_functions.http_request(
  'https://<project-ref>.functions.supabase.co/telegram-bot',
  'POST',
  '{"Content-Type":"application/json","x-mall-notify-secret":"<MALL_INTERNAL_NOTIFY_SECRET>"}',
  '{}',
  '2000'
);

drop trigger if exists contact_messages_telegram_webhook on public.contact_messages;
create trigger contact_messages_telegram_webhook
after insert on public.contact_messages
for each row
execute function supabase_functions.http_request(
  'https://<project-ref>.functions.supabase.co/telegram-bot',
  'POST',
  '{"Content-Type":"application/json","x-mall-notify-secret":"<MALL_INTERNAL_NOTIFY_SECRET>"}',
  '{}',
  '2000'
);

-- Verificacion sugerida:
-- select trigger_name, event_object_table, action_timing, event_manipulation
-- from information_schema.triggers
-- where trigger_schema = 'public'
--   and trigger_name in ('mall_messages_telegram_webhook', 'contact_messages_telegram_webhook')
-- order by trigger_name;
