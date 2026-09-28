-- Notifica por Telegram al local que recibe una nueva solicitud de compra.
--
-- Antes de ejecutar:
-- 1. Despliega supabase/functions/telegram-bot/index.ts actualizado.
-- 2. Reemplaza <MALL_INTERNAL_NOTIFY_SECRET> por el secreto ya configurado
--    en la Edge Function. No guardes el valor real en Git ni en este archivo.

drop trigger if exists store_orders_telegram_webhook on public.store_orders;
create trigger store_orders_telegram_webhook
after insert on public.store_orders
for each row
when (new.status = 'pending_store_confirmation')
execute function supabase_functions.http_request(
  'https://kcfuixvrwbnizspgtmtr.supabase.co/functions/v1/telegram-bot',
  'POST',
  '{"Content-Type":"application/json","x-mall-notify-secret":"<MALL_INTERNAL_NOTIFY_SECRET>"}',
  '{}',
  '2000'
);

-- Verificación del trigger:
-- select trigger_name, event_object_table, action_timing, event_manipulation
-- from information_schema.triggers
-- where trigger_schema = 'public'
--   and trigger_name = 'store_orders_telegram_webhook';
