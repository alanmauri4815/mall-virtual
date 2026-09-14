# Supabase Setup - Mall Emprendimientos

Este proyecto usa Supabase para:

- cuentas de visitantes inscritos y locatarios;
- postulaciones de locatarios;
- asignacion de locales;
- tarifas, historial de arriendos, pagos y observaciones administrativas;
- productos, logos e imagenes publicas;
- mensajes de contacto por local;
- presencia/chat en el mall.

## Archivo Principal

Ejecuta este archivo en el SQL Editor de Supabase:

```sql
supabase/mall_current_setup.sql
```

Ese archivo es la fuente de verdad actual. Es idempotente: se puede ejecutar mas de una vez para alinear tablas, columnas, RLS, grants y politicas de Storage.

## Orden Recomendado

1. Abre Supabase Dashboard.
2. Ve a `SQL Editor`.
3. Ejecuta completo `supabase/mall_current_setup.sql`.
4. Revisa que el usuario administrador `alanmauri4815@gmail.com` exista en Authentication.
5. Si ese usuario fue creado despues de ejecutar el SQL, vuelve a ejecutar el archivo para sembrar su rol `admin`.

## Modelo Actual

La regla de datos del mall queda asi:

- `stores.local_code`: codigo visible del mall, por ejemplo `O101`, `N204`.
- `stores.id`: identificador interno heredado o estable.
- `store_products.local_code`: vincula productos con el local visible.
- `storage.objects.name`: debe comenzar con la carpeta del local, por ejemplo `O101/logo-...webp`.

El codigo frontend tolera bases antiguas que todavia usan `stores.id` como codigo real, pero el modelo objetivo es `local_code`.

El setup tambien repara datos heredados importantes:

- rellena `stores.local_code` desde `stores.id` cuando falta;
- rellena `stores.contact_email` desde el usuario Auth asignado al local;
- vincula `tenant_applications.applicant_auth_user_id` usando el email del usuario Auth;
- conserva el rol `admin` del administrador aunque tambien tenga locales asignados.

## Tablas Administrativas Nuevas

El setup maestro tambien crea estas tablas para gestion administrativa de locatarios:

- `store_rent_rates`: tabla maestra de tarifas por local.
- `tenant_leases`: historial de arriendos por local y locatario.
- `tenant_payments`: registro de pagos, vencimientos, montos y referencias.
- `tenant_notes`: observaciones internas o visibles para el locatario.

Regla de acceso:

- el administrador del mall puede leer y escribir todo;
- el locatario solo puede leer sus propios arriendos, pagos y notas visibles para el;
- las tarifas del local quedan visibles para el dueño actual del local.

## Archivos SQL Antiguos

Estos archivos quedan como compatibilidad o referencia historica:

- `supabase/admin_enable_current_schema.sql`
- `supabase/store_products_local_code_fix.sql`
- `supabase/store_assets_storage.sql`
- `supabase/admin_delete_accounts.sql`
- `supabase/mall_access_schema.sql`

Para una instalacion o reparacion normal, usa primero `supabase/mall_current_setup.sql`.

## Records del Laberinto

Los tiempos globales del laberinto usan el archivo adicional:

```sql
supabase/maze_records_20260905.sql
```

Ejecuta el archivo completo en el SQL Editor del mismo proyecto configurado en
`js/mall/mall-multiplayer.js` (`kcfuixvrwbnizspgtmtr`). Crea una tabla con RLS
habilitado y dos RPC públicas validadas: una para publicar un tiempo y otra
para consultar los diez mejores. No se conceden permisos directos de lectura
ni escritura sobre la tabla. El navegador guarda primero el resultado local y
usa ese respaldo si las RPC todavía no están disponibles o si la red falla.

El ranking es competitivo a nivel de experiencia, pero el tiempo se origina
en el navegador y no puede probar por si solo que el recorrido se haya hecho
sin manipulación. Para premios reales se debe añadir validación server-side de
la ruta y una política antifraude.

Para habilitar esa validación, ejecuta despues:

```sql
supabase/maze_validation_20260905.sql
```

Este segundo archivo crea la partida server-side y valida los cinco puntos de
control antes de aceptar un récord global. El cliente actualizado conserva el
resultado local si la validación no está disponible.

## Importante

Los cambios en archivos locales no modifican Supabase remoto automaticamente. Cada cambio SQL debe ejecutarse en el dashboard o mediante CLI autenticada.

Desde abril de 2026, los proyectos nuevos de Supabase pueden no exponer tablas nuevas al Data API automaticamente. Por eso el setup maestro incluye `GRANT` explicitos ademas de RLS.

## Telegram

El proyecto ya incluye una base para notificaciones por Telegram:

- columnas de Telegram en `stores`
- tabla `mall_messages`
- Edge Function en `supabase/functions/telegram-bot/index.ts`

Para activarlo:

1. Ejecuta de nuevo `supabase/mall_current_setup.sql`.
2. Crea un bot con `@BotFather` y guarda:
   - `TELEGRAM_BOT_TOKEN`
   - el username publico del bot
3. Define en la Edge Function estas variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_WEBHOOK_SECRET`
   - `MALL_ALLOWED_ORIGIN` con `https://mall-virtual-one-ten.vercel.app`
   - `MALL_INTERNAL_NOTIFY_SECRET` solo si vas a disparar notificaciones desde un backend propio, nunca desde el frontend
4. Despliega la function sin verificacion JWT:

```bash
supabase functions deploy telegram-bot --no-verify-jwt
```

5. Configura el webhook de Telegram apuntando a la function y usando el mismo `TELEGRAM_WEBHOOK_SECRET` como `secret_token`:

```text
https://<project-ref>.functions.supabase.co/telegram-bot
```

6. Configura el disparo automatico de mensajes desde Supabase, no desde el navegador:
   - Opcion recomendada por Dashboard: Database Webhooks.
   - Tabla/evento: `public.mall_messages` / `INSERT`.
   - URL: `https://<project-ref>.functions.supabase.co/telegram-bot`.
   - Metodo: `POST`.
   - Header: `Content-Type: application/json`.
   - Header: `x-mall-notify-secret: <MALL_INTERNAL_NOTIFY_SECRET>`.
   - Repite lo mismo para `public.contact_messages` / `INSERT` si quieres cubrir el fallback antiguo.

   Tambien puedes usar la plantilla:

```text
supabase/telegram_message_webhook_20260603.sql
```

   Antes de ejecutarla, reemplaza los placeholders y no guardes el secreto real en git.

7. En el frontend, reemplaza la constante `TELEGRAM_BOT_USERNAME` en [index.html](C:/Users/javii/Downloads/Web Tienda Virtual/index.html:5600) por el username real del bot.

Flujo final:

- el locatario activa Telegram en su panel
- abre el bot con su enlace
- el bot valida el local con `/start`
- cuando un visitante deja un mensaje, el sistema guarda el registro
- para disparar avisos automáticos a Telegram, usa un backend seguro o trigger controlado que envie `x-mall-notify-secret`; no expongas ese secreto en JavaScript del navegador

## Nota actualizada de Telegram - 2026-06-03

Para avisos automaticos de mensajes:

- Supabase debe disparar un Database Webhook con `x-mall-notify-secret`.
- La Edge Function `telegram-bot` valida ese secreto y envia el aviso a Telegram.
- No expongas `MALL_INTERNAL_NOTIFY_SECRET` en JavaScript del navegador.
- Usa `supabase/telegram_message_webhook_20260603.sql` como plantilla si prefieres configurarlo desde SQL Editor.
