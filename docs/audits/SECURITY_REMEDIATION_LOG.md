# Bitacora de Seguridad y Continuidad

## Objetivo

Mejorar seguridad, estabilidad, mantenibilidad, funcionalidad y eficiencia del Mall Virtual sin perder integridad del codigo ni continuidad del proceso.

## Reglas de trabajo

- Registrar cada etapa en este archivo antes de cerrar una sesion.
- Crear respaldo antes de cambios con impacto de despliegue o seguridad.
- Hacer cambios pequenos y verificables.
- No borrar archivos historicos sin respaldo previo.
- Mantener la URL publica principal: https://mall-virtual-one-ten.vercel.app/

## Estado inicial confirmado

- Fecha local: 2026-05-30 14:12:07 -04:00.
- Workspace: `C:\Users\javii\Downloads\Web Tienda Virtual`.
- URL local abierta: `http://127.0.0.1:8080/index.html`.
- URL publica activa: `https://mall-virtual-one-ten.vercel.app/`.
- Respaldo existente: `backups/web-tienda-virtual-backup-20260530-132129.zip`.
- Respaldo de inicio de remediacion: `backups/pre-security-public-files-20260530-141250.zip`.

## Hallazgos priorizados

1. Archivos internos publicados por Vercel: `supabase/*.sql`, backups HTML y otros archivos de trabajo respondian `200`.
2. `.env.local` contiene `VERCEL_OIDC_TOKEN`; no estaba publicado, pero debe rotarse y mantenerse fuera de respaldos compartibles.
3. Admin hardcodeado por email en JS y SQL.
4. RPCs publicas pueden resolver emails desde nickname/marca/local.
5. Edge Function Telegram acepta requests publicos sin firma propia para notificaciones.
6. Riesgo XSS/URL injection por uso amplio de `innerHTML` y URLs dinamicas.
7. Storage autoriza assets por `contact_email`, no solo por `owner_id`.
8. Faltaban cabeceras de seguridad HTTP.
9. Dependencias CDN y carga movil aun requieren endurecimiento.
10. HTML invalido/deuda de accesibilidad y duplicados de ID.

## Cambios realizados

### 2026-05-30 - Paso 1: reducir superficie publica de Vercel

Archivos planificados:

- `.vercelignore`: bloquear carpetas internas, backups, documentos, SQL, scripts de mantenimiento y backups dentro de `js/**`.
- `vercel.json`: agregar cabeceras de seguridad base.

Nota de continuidad:

- Primer intento de `.vercelignore` con lista blanca fue demasiado restrictivo: `/js/**` y `/assets/**` quedaron en `404`.
- Se corrigio inmediatamente a lista negra explicita para conservar `index.html`, `js/mall/*.js` activos y `assets/avatars/model.glb`.

Verificacion pendiente:

- Desplegado a produccion y reasignado alias `mall-virtual-one-ten.vercel.app`.
- Confirmado `200` para `/` y `/index.html`.
- Confirmado `200` para `/js/mall/mall-navigation.js`.
- Confirmado `200` para `/assets/avatars/model.glb`.
- Confirmado `404` para `/supabase/mall_current_setup.sql`.
- Confirmado `404` para `/index_BKP_20260520_225123_STRUCTURAL_WALLS_AND_RAILS.html`.
- Confirmado `404` para `/config.js`.
- Confirmado `404` para `/store.html`.
- Confirmado `404` para `/js/mall/mall-navigation.backup-20260522.js`.
- Confirmadas cabeceras `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- Verificacion en navegador: `readyState=complete`, canvas creado, login visible, loader removido.

Resultado del Paso 1:

- Exposicion publica de SQL, backups, docs y scripts internos mitigada en Vercel.
- App principal restaurada despues de corregir `.vercelignore`.
- Queda pendiente revisar en celular real despues de recarga completa.

### 2026-05-30 - Paso 2: saneamiento de respaldos y token local

Motivo:

- Los respaldos creados antes del endurecimiento incluian `.env.local`.
- `.env.local` contenia un `VERCEL_OIDC_TOKEN`.

Evidencia:

- `backups/web-tienda-virtual-backup-20260530-132129.zip`: contenia `.env.local`.
- `backups/pre-security-public-files-20260530-141250.zip`: contenia `.env.local`.
- Ambos fueron movidos a `backups/SENSITIVE_DO_NOT_SHARE_contains_env_token/`.

Cambios:

- Creado respaldo estricto saneado: `backups/safe-public-code-backup-strict-20260530-142011.zip`.
- Verificacion del respaldo estricto:
  - `HAS_ENV_COUNT=0`.
  - `HAS_SQL_COUNT=0`.
  - `HAS_BACKUP_COUNT=0`.
- `.env.local` fue reemplazado por notas locales sin token.
- `.gitignore` fue reforzado para excluir `backups/`, temporales `.tmp_*`, respaldos HTML adicionales, respaldos JS y documentos `.xlsx`.

Pendiente externo:

- Revocar/rotar el `VERCEL_OIDC_TOKEN` en Vercel si sigue activo. Se removio del workspace, pero solo Vercel puede invalidarlo definitivamente.

## Proximos pasos despues del Paso 1

1. Rotar/revocar `VERCEL_OIDC_TOKEN` y excluir `.env.local` de respaldos compartibles.
2. Migrar admin hardcodeado a tabla/claim server-side y exigir MFA.
3. Limitar RPCs anon que revelan emails.
4. Proteger Edge Function Telegram con secreto/JWT/rate limit.
5. Sanitizar URLs e ir reemplazando `innerHTML` dinamico critico.
6. Corregir HTML invalido y duplicados.

### 2026-05-30 - Paso 3: quitar admin hardcodeado y reducir enumeracion de correos

Motivo:

- El cliente y algunos SQL otorgaban privilegio admin por un email fijo.
- Los login de locatario/visitante podian transformar nickname, marca o local en correo, lo que facilita enumeracion de emails.

Cambios en cliente:

- `js/mall/mall-ui.js`:
  - `userHasAdminAccess()` ahora depende solo de `profile.role === "admin"`.
  - Se removio la creacion local de perfiles admin por email fijo.
  - El login de locatario con contrasena exige correo directo.
  - El login de visitante inscrito con contrasena exige correo directo.
  - La eliminacion de cuentas protege perfiles admin por rol, no por email escrito en codigo.
- `js/mall/mall-multiplayer.js`:
  - Recuperacion de contrasena exige correo directo.
- `index.html`:
  - Placeholders de ingreso/recuperacion actualizados a `Correo` / `Correo de locatario`.

Cambios SQL:

- `supabase/mall_current_setup.sql`:
  - Agregada tabla `public.admin_members`.
  - `public.is_mall_admin()` queda basado en `admin_members`.
  - Eliminado seed de admin por email fijo.
  - `resolve_member_login_email` y `resolve_tenant_login_email` ya no se conceden a `anon`.
- `supabase/admin_delete_accounts.sql`:
  - Protege cuentas admin usando `user_profiles.role` y `admin_members`.
- `supabase/admin_login_hardening_20260530.sql`:
  - Nueva migracion acotada para aplicar en Supabase SQL Editor.
- SQL historicos auxiliares:
  - Removido email fijo y grants anon peligrosos en `mall_access_schema.sql` y `admin_enable_current_schema.sql`.
  - `diagnose_store_asset_access.sql` usa placeholder generico.

Verificacion:

- `rg` no encuentra `alanmauri4815` en archivos activos del cliente ni SQL de trabajo.
- `rg` no encuentra grants `resolve_*` a `anon` fuera de backups ignorados.
- `node --check js/mall/mall-ui.js`: OK.
- `node --check js/mall/mall-multiplayer.js`: OK.
- Servidor local `http://127.0.0.1:8080/index.html`: HTTP 200.
- Navegador integrado:
  - `readyState=complete`.
  - Canvas presente.
  - Login visible.
  - Loader removido.
  - Sin errores de consola.
  - Placeholders actualizados a correo directo.

Publicacion:

- Deployment de produccion creado:
  - `https://mall-virtual-9le9nati6-alanmauri4815s-projects.vercel.app`
- Alias oficial reasignado correctamente:
  - `https://mall-virtual-one-ten.vercel.app/`

Pendiente externo:

- Aplicar `supabase/admin_login_hardening_20260530.sql` en Supabase SQL Editor.
- Antes de aplicar la migracion, confirmar que al menos una cuenta admin existente tenga `user_profiles.role = 'admin'`; si no existe, insertar manualmente el primer admin en `admin_members` usando el `auth_user_id` correcto.
- Despues de aplicar, probar login admin, login locatario por correo y login visitante por correo.

### 2026-05-30 - Paso 4: endurecer Telegram / notificaciones externas

Motivo:

- `supabase/functions/telegram-bot/index.ts` aceptaba `action: notify_message` desde requests publicos sin secreto.
- La Function estaba pensada para desplegarse con `--no-verify-jwt`, necesario para webhook de Telegram, por lo que el webhook debe tener una verificacion propia.
- El frontend llamaba directamente a la Function para notificar Telegram; un secreto en JavaScript publico no seria seguro.

Cambios:

- `supabase/functions/telegram-bot/index.ts`:
  - CORS deja de usar `*`; usa `MALL_ALLOWED_ORIGIN` o `https://mall-virtual-one-ten.vercel.app`.
  - Webhook de Telegram exige `TELEGRAM_WEBHOOK_SECRET`.
  - Webhook valida header `x-telegram-bot-api-secret-token`.
  - `notify_message` queda bloqueado si no existe `MALL_INTERNAL_NOTIFY_SECRET`.
  - `notify_message` exige header `x-mall-notify-secret` cuando se use desde un backend propio.
- `js/mall/mall-ui.js`:
  - `notifyTelegramForStoreMessage()` ya no hace `fetch` directo al endpoint publico.
  - El mensaje queda guardado en Supabase; el disparo a Telegram debe moverse a backend seguro.
- `SUPABASE_SETUP.md`:
  - Documentadas las nuevas variables `TELEGRAM_WEBHOOK_SECRET`, `MALL_ALLOWED_ORIGIN`, `MALL_INTERNAL_NOTIFY_SECRET`.
  - Documentado que `MALL_INTERNAL_NOTIFY_SECRET` no debe exponerse en frontend.

Verificacion:

- `node --check js/mall/mall-ui.js`: OK.
- `deno` no esta instalado localmente; no se pudo hacer type-check de la Edge Function en esta maquina.
- Navegador integrado local:
  - `readyState=complete`.
  - Canvas presente.
  - Login visible.
  - Loader removido despues del fallback.
  - Sin errores de consola.

Publicacion:

- Frontend desplegado a produccion:
  - `https://mall-virtual-7n17lctph-alanmauri4815s-projects.vercel.app`
- Alias oficial reasignado correctamente:
  - `https://mall-virtual-one-ten.vercel.app/`

Pendiente externo:

- Configurar variables de la Edge Function en Supabase.
- Actualizar el webhook de Telegram con `secret_token = TELEGRAM_WEBHOOK_SECRET`.
- Desplegar la Edge Function:
  - `supabase functions deploy telegram-bot --no-verify-jwt`
- Implementar un disparo server-side para notificaciones automaticas si se quiere mantener Telegram en tiempo real.

### 2026-05-30 - Paso 5: endurecer Storage de assets de tiendas

Motivo:

- Las politicas de `store-assets` permitian insertar/actualizar/borrar archivos si el email del token coincidia con `stores.contact_email`.
- `contact_email` es dato comercial editable y visible; no debe probar propiedad ni autorizacion.

Cambios:

- `supabase/store_assets_storage.sql`:
  - Politicas de insert/update/delete quedan basadas solo en `stores.owner_id = auth.uid()` o `public.is_mall_admin()`.
- `supabase/mall_current_setup.sql`:
  - Se alinearon las politicas maestras de Storage con la misma regla.
- `supabase/store_assets_owner_only_hardening_20260530.sql`:
  - Nueva migracion acotada para aplicar sobre una base existente.

Verificacion:

- `rg` no encuentra condiciones `contact_email` contra `auth.jwt()->>'email'` en `supabase/` fuera de backups ignorados.

Pendiente externo:

- Aplicar `supabase/store_assets_owner_only_hardening_20260530.sql` en Supabase SQL Editor.
- Probar subida de logo/producto con una cuenta locataria dueña del local.
- Probar que una cuenta autenticada sin `owner_id` del local no pueda modificar assets.

### 2026-05-30 - Paso 6: endurecer XSS y URLs dinamicas criticas

Motivo:

- La ficha publica de tiendas renderizaba productos, imagenes, logo, email y WhatsApp con `innerHTML`, `src` y `href` generados desde datos de Supabase.
- El buscador y el chat tambien mezclaban contenido de usuario con HTML.
- Aunque varios campos usaban `escapeHtml`, faltaba validacion de URL/protocolo y se podia crear un enlace peligroso si el dato de origen venia contaminado.

Cambios:

- `js/mall/mall-ui.js`:
  - Agregados helpers `safeHttpUrl`, `safeImageUrl`, `buildSafeMailtoHref`, `buildSafeWhatsAppHref`.
  - Buscador de locales ahora arma nodos DOM con `textContent`, no HTML con datos dinamicos.
  - Texto de ubicacion del mapa se arma con nodos DOM.
  - Mensajes del buzon de locatario ahora se renderizan con nodos DOM y `textContent`.
  - Link `Responder` del buzon usa `buildSafeMailtoHref`.
  - Chat/presencia ya no usa `innerHTML` para usuario/texto; usa `textContent`.
- `js/mall/mall-main.js`:
  - Ficha publica de productos usa `appendProductRow()` y `appendGalleryCard()` con nodos DOM.
  - Imagenes de productos y logo pasan por `safeImageUrl`.
  - `mailto:` y WhatsApp pasan por builders seguros; si el dato no valida, se oculta el boton.

Verificacion:

- `node --check js/mall/mall-ui.js`: OK.
- `node --check js/mall/mall-main.js`: OK.
- Servidor local `http://127.0.0.1:8080/index.html`: HTTP 200.
- Navegador integrado local:
  - `readyState=complete`.
  - Canvas presente.
  - Login visible.
  - Loader removido.
  - Sin errores de consola.
  - Warnings conocidos pendientes: Tailwind CDN en produccion y fallback REST de Supabase Realtime.

Publicacion:

- Intento de deploy de produccion:
  - Deployment generado: `https://mall-virtual-cmupdbp5i-alanmauri4815s-projects.vercel.app`
  - Resultado: fallido por `Not authorized` durante build/despliegue en Vercel.
- No se reintrodujeron tokens locales ni credenciales en `.env.local`.

Pendiente externo:

- Reautenticar Vercel CLI o renovar credenciales de Vercel sin guardar tokens en el repositorio.
- Reintentar deploy y reasignar `https://mall-virtual-one-ten.vercel.app/`.
- Continuar eliminando usos de `innerHTML` restantes en paneles administrativos donde aun se usan plantillas con `escapeHtml`.

### 2026-05-30 - Paso 7: corregir ID duplicado en interfaz de ingreso

Motivo:

- `index.html` tenia dos elementos con `id="avatar-selection"`.
- El JS ya tenia una funcion defensiva para ocultar el panel antiguo, pero el HTML seguia siendo invalido y podia afectar selectores, accesibilidad y mantenimiento.

Cambios:

- `index.html`:
  - Eliminado el panel antiguo de avatar basado en tres estilos legacy.
  - Se conserva el selector nuevo de cuerpo y vestimenta.

Verificacion:

- Script local de deteccion de IDs duplicados en `index.html`: `[]`.
- `node --check js/mall/mall-ui.js`: OK.
- `node --check js/mall/mall-main.js`: OK.
- Servidor local `http://127.0.0.1:8080/index.html`: HTTP 200.

Pendiente:

- Desplegar este cambio junto con el Paso 6 cuando Vercel CLI vuelva a estar autorizado.

### 2026-06-02 - Paso 8: recuperar despliegue Vercel y publicar cambios pendientes

Motivo:

- El Paso 6 y Paso 7 estaban validados localmente, pero no publicados porque Vercel habia fallado con `Not authorized`.

Diagnostico:

- `.vercel/project.json` sigue vinculado a:
  - `projectName`: `mall-virtual-one`
  - `projectId`: `prj_YaUmmVD7aux6DWJX9ybNv0Zgep1o`
  - `orgId`: `team_wABIUM0xz4K9V2mVwZPXO0nJ`
- `vercel whoami` ejecutado fuera del sandbox confirmo sesion activa:
  - usuario: `alanmauri4815`

Acciones:

- Reintentado deploy de produccion con Vercel CLI.
- Verificada URL oficial:
  - `https://mall-virtual-one-ten.vercel.app/index.html`: HTTP 200.
- Descargados y verificados archivos publicos:
  - `https://mall-virtual-one-ten.vercel.app/js/mall/mall-ui.js`: HTTP 200.
  - `https://mall-virtual-one-ten.vercel.app/js/mall/mall-main.js`: HTTP 200.

Evidencia de publicacion:

- `index.html` publico:
  - Sin IDs duplicados.
  - Ya no contiene el selector legacy `selectAvatar('1'...)`.
- `mall-ui.js` publico:
  - Contiene `function buildSafeMailtoHref`.
  - Contiene `function buildSafeWhatsAppHref`.
  - Ya no contiene el render antiguo vulnerable de chat con `p.innerHTML = ... text.replace`.
- `mall-main.js` publico:
  - Contiene `function appendGalleryCard`.
  - Usa `safeImageUrl(product?.image_url...)`.
  - Usa `buildSafeMailtoHref`.
  - Usa `buildSafeWhatsAppHref`.

Resultado:

- La URL oficial `https://mall-virtual-one-ten.vercel.app/` quedo actualizada con los cambios pendientes de seguridad de los Pasos 6 y 7.

Pendiente:

- Mantener la sesion de Vercel via `vercel login`; no guardar tokens en `.env.local` ni en respaldos.

### 2026-06-02 - Paso 9: endurecer cabeceras publicas y cache de assets

Motivo:

- Despues de desactivar llamadas directas a Telegram desde el frontend, `connect-src` aun permitia `https://api.telegram.org`.
- Los assets JS/GLB no tenian una regla de cache especifica.
- Faltaban cabeceras defensivas COOP/CORP para aislamiento de contexto.

Cambios:

- `vercel.json`:
  - Removido `https://api.telegram.org` de `Content-Security-Policy connect-src`.
  - Agregada `Cross-Origin-Opener-Policy: same-origin`.
  - Agregada `Cross-Origin-Resource-Policy: same-origin`.
  - Agregado cache especifico para `/js/(.*)`:
    - `Cache-Control: public, max-age=3600, immutable`.
  - Agregado cache especifico para `/assets/(.*)`:
    - `Cache-Control: public, max-age=86400, immutable`.
  - Conservado `X-Content-Type-Options: nosniff`.

Verificacion local:

- `vercel.json` parsea correctamente con `JSON.parse`.
- `rg` confirma que `api.telegram.org` ya no aparece en `vercel.json`.
- El servidor local `http://127.0.0.1:8080/index.html` no estaba activo en esta sesion; no se uso como bloqueo porque el cambio fue de cabeceras Vercel y se verifico en produccion.

Verificacion publica:

- Rutas:
  - `/`: `200`.
  - `/supabase/mall_current_setup.sql`: `404`.
  - `/config.js`: `404`.
  - `/store.html`: `404`.
  - `/js/mall/mall-ui.js`: `200`.
  - `/assets/avatars/model.glb`: `200`.
- Cabeceras en `https://mall-virtual-one-ten.vercel.app/`:
  - CSP ya no contiene `https://api.telegram.org`.
  - `Cross-Origin-Opener-Policy: same-origin`.
  - `Cross-Origin-Resource-Policy: same-origin`.
  - `Strict-Transport-Security` presente.
  - `X-Content-Type-Options: nosniff`.
- Cabeceras en `/js/mall/mall-ui.js`:
  - `Cache-Control: public, max-age=3600, immutable`.
  - `Content-Type: application/javascript`.
  - `X-Content-Type-Options: nosniff`.
- Cabeceras en `/assets/avatars/model.glb`:
  - `Cache-Control: public, max-age=86400, immutable`.
  - `Content-Type: model/gltf-binary`.
  - `X-Content-Type-Options: nosniff`.

Publicacion:

- Desplegado a produccion con Vercel CLI.
- Verificado en URL oficial:
  - `https://mall-virtual-one-ten.vercel.app/`.

Pendiente:

- Reducir dependencia de CDN (`cdn.tailwindcss.com`, `cdnjs`, `cdn.jsdelivr`) en una etapa posterior para poder endurecer CSP sin `unsafe-inline` y reducir riesgo de supply chain.

### 2026-06-02 - Paso 10: servir librerias JS criticas desde el mismo dominio

Motivo:

- `index.html` cargaba librerias criticas desde `cdnjs` y `cdn.jsdelivr`.
- Esa dependencia externa aumentaba el riesgo de supply chain y obligaba a mantener esos dominios en `script-src`.
- Se busco reducir superficie externa sin cambiar todavia Tailwind ni Google Fonts, para mantener el riesgo visual acotado.

Cambios:

- Agregados archivos locales en `assets/vendor/three/`:
  - `three.r128.min.js`.
  - `OrbitControls.r128.js`.
  - `GLTFLoader.r128.js`.
  - `SkeletonUtils.r128.js`.
- Agregado cliente Supabase local en:
  - `assets/vendor/sb-client/client-v2.min.js`.
- `index.html`:
  - Reemplazadas las URLs externas de Three.js, addons de Three y Supabase por rutas locales bajo `assets/vendor/`.
- `vercel.json`:
  - Removidos `https://cdnjs.cloudflare.com` y `https://cdn.jsdelivr.net` de `Content-Security-Policy script-src`.
  - Conservado temporalmente `https://cdn.tailwindcss.com` para una etapa posterior.

Observacion importante:

- La primera ruta propuesta para Supabase fue `assets/vendor/supabase/supabase-js-2.min.js`.
- Vercel no la publico porque `.vercelignore` bloquea rutas con `supabase` para evitar exponer archivos internos.
- Se corrigio a `assets/vendor/sb-client/client-v2.min.js`, manteniendo privada la carpeta real `supabase/`.

Verificacion local:

- `vercel.json` parsea correctamente con `JSON.parse`.
- `index.html` y `vercel.json` ya no contienen `cdnjs.cloudflare.com` ni `cdn.jsdelivr.net`.
- Servidor local `http://127.0.0.1:8080`:
  - `/index.html`: `200`.
  - `/assets/vendor/three/three.r128.min.js`: `200`.
  - `/assets/vendor/three/OrbitControls.r128.js`: `200`.
  - `/assets/vendor/three/GLTFLoader.r128.js`: `200`.
  - `/assets/vendor/three/SkeletonUtils.r128.js`: `200`.
  - `/assets/vendor/sb-client/client-v2.min.js`: `200`.
- `node --check`:
  - Scripts propios bajo `js/mall/*.js`: OK.
  - Addons locales de Three: OK.

Verificacion publica:

- Desplegado a produccion con Vercel CLI.
- URL oficial verificada:
  - `https://mall-virtual-one-ten.vercel.app/`: `200`.
- Rutas publicas vendorizadas:
  - `/assets/vendor/three/three.r128.min.js`: `200`.
  - `/assets/vendor/three/OrbitControls.r128.js`: `200`.
  - `/assets/vendor/three/GLTFLoader.r128.js`: `200`.
  - `/assets/vendor/three/SkeletonUtils.r128.js`: `200`.
  - `/assets/vendor/sb-client/client-v2.min.js`: `200`.
  - `/assets/vendor/supabase/supabase-js-2.min.js`: `404` esperado.
- HTML publico:
  - Contiene las cinco rutas locales nuevas.
  - No contiene `cdnjs.cloudflare.com`.
  - No contiene `cdn.jsdelivr.net`.
- Cabeceras publicas:
  - CSP `script-src` queda en `'self' 'unsafe-inline' https://cdn.tailwindcss.com`.
  - `Cross-Origin-Opener-Policy: same-origin`.
  - `Cross-Origin-Resource-Policy: same-origin`.
  - `Strict-Transport-Security` presente.
  - `X-Content-Type-Options: nosniff`.
- Cliente Supabase local:
  - `Content-Type: application/javascript`.
  - `Cache-Control: public, max-age=86400, immutable`.

Limitacion:

- La verificacion visual automatizada con Browser no pudo completarse por fallo del entorno local de la herramienta de navegador.
- Se compenso con verificaciones HTTP local/publica, sintaxis JS y marcadores del HTML publico.

Pendiente:

- Sustituir `cdn.tailwindcss.com` por CSS local o eliminar su uso, para poder quitar el ultimo CDN de `script-src`.
- En una etapa posterior, reducir `unsafe-inline` migrando scripts/handlers inline a archivos locales.

### 2026-06-02 - Paso 11: eliminar Tailwind CDN y dejar `script-src` solo en origen propio

Motivo:

- `cdn.tailwindcss.com` era el ultimo script externo cargado por `index.html`.
- Mantenerlo obligaba a permitir un CDN externo en `Content-Security-Policy script-src`.
- El uso real de clases tipo Tailwind era pequeno y estaba concentrado en textos del loader/header y layout basico del header.

Cambios:

- `index.html`:
  - Removido `<script src="https://cdn.tailwindcss.com" defer></script>`.
  - Agregado CSS local equivalente para las clases usadas:
    - `.text-4xl`.
    - `.font-extralight`.
    - `.tracking-[15px]`.
    - `.tracking-[10px]`.
    - `.tracking-widest`.
    - `.mb-4`.
    - `.mt-8`.
    - `.text-[9px]`.
    - `.text-gray-600`.
    - `.uppercase`.
    - `.fixed`.
    - `.top-0`.
    - `.w-full`.
    - `.p-8`.
    - `.flex`.
    - `.justify-between`.
    - `.items-start`.
    - `.pointer-events-none`.
    - `.pointer-events-auto`.
- `vercel.json`:
  - CSP `script-src` quedo en:
    - `'self' 'unsafe-inline'`.
  - Ya no permite `cdn.tailwindcss.com`, `cdnjs.cloudflare.com` ni `cdn.jsdelivr.net`.

Verificacion local:

- `vercel.json` parsea correctamente con `JSON.parse`.
- `index.html` y `vercel.json` no contienen:
  - `cdn.tailwindcss.com`.
  - `cdnjs.cloudflare.com`.
  - `cdn.jsdelivr.net`.
- Clases tipo Tailwind restantes en HTML:
  - Todas estan cubiertas por CSS local agregado.
- `node --check`:
  - Scripts propios bajo `js/mall/*.js`: OK.
- Servidor local `http://127.0.0.1:8080`:
  - `/index.html`: `200`.
  - `/assets/vendor/three/three.r128.min.js`: `200`.
  - `/assets/vendor/sb-client/client-v2.min.js`: `200`.

Verificacion publica:

- Desplegado a produccion con Vercel CLI.
- URL oficial verificada:
  - `https://mall-virtual-one-ten.vercel.app/`: `200`.
- Rutas criticas:
  - `/assets/vendor/three/three.r128.min.js`: `200`.
  - `/assets/vendor/sb-client/client-v2.min.js`: `200`.
  - `/js/mall/mall-ui.js`: `200`.
- HTML publico:
  - No contiene `cdn.tailwindcss.com`.
  - No contiene `cdnjs.cloudflare.com`.
  - No contiene `cdn.jsdelivr.net`.
  - Contiene rutas locales de Three y cliente Supabase.
  - Contiene CSS local `.text-4xl` y `.tracking-[15px]`.
- Cabeceras publicas:
  - `Content-Security-Policy` con `script-src 'self' 'unsafe-inline'`.
  - `Cross-Origin-Opener-Policy: same-origin`.
  - `Cross-Origin-Resource-Policy: same-origin`.
  - `Strict-Transport-Security` presente.
  - `X-Content-Type-Options: nosniff`.

Pendiente:

- Reducir `unsafe-inline` migrando el script inline temprano y handlers `onclick` a archivos JS locales con `addEventListener`.
- Evaluar si Google Fonts/Material Symbols deben servirse localmente para cerrar tambien `style-src`/`font-src`.

### 2026-06-02 - Paso 12: mover scripts inline de arranque a archivo local

Motivo:

- Despues de eliminar CDNs de scripts, CSP seguia necesitando `unsafe-inline`.
- `index.html` todavia tenia dos bloques `<script>` inline:
  - Redireccionamiento preventivo cuando se abre la app como `file://`.
  - Logica de orientacion movil, retiro del loader y auto-scroll hacia ingreso en celular.
- Mover estos bloques a un archivo local reduce deuda CSP sin tocar todavia los numerosos handlers inline de botones.

Cambios:

- Nuevo archivo:
  - `js/mall/mall-boot.js`.
- `mall-boot.js` ahora contiene:
  - `redirectFileProtocolToLocalhost`.
  - `window.mallMobileViewport`.
  - Listener de `DOMContentLoaded` que remueve el loader.
  - Logica de auto-scroll hacia la tarjeta de ingreso en pantallas tactiles pequenas.
- `index.html`:
  - Eliminados los dos bloques `<script>` inline.
  - Agregado:
    - `<script src="js/mall/mall-boot.js" defer></script>`.

Verificacion local:

- `index.html` ya no contiene bloques `<script>` sin `src`.
- `node --check js/mall/mall-boot.js`: OK.
- `node --check` sobre `js/mall/*.js`: OK.
- Servidor local `http://127.0.0.1:8080`:
  - `/index.html`: `200`.
  - `/js/mall/mall-boot.js`: `200`.
- Conteo pendiente:
  - Quedan `72` handlers inline (`onclick`, `onchange`, `oninput`, `onsubmit`) en `index.html`.

Verificacion publica:

- Desplegado a produccion con Vercel CLI.
- URL oficial verificada:
  - `https://mall-virtual-one-ten.vercel.app/`: `200`.
- Rutas criticas:
  - `/js/mall/mall-boot.js`: `200`.
  - `/js/mall/mall-ui.js`: `200`.
- Headers de `/js/mall/mall-boot.js`:
  - `Content-Type: application/javascript`.
  - `Cache-Control: public, max-age=3600, immutable`.
  - `X-Content-Type-Options: nosniff`.
- HTML publico:
  - Contiene `js/mall/mall-boot.js`.
  - No contiene `<script>` inline.
  - No contiene `redirectFileProtocolToLocalhost`.
  - No contiene `window.mallMobileViewport = (() =>`.

Pendiente:

- Migrar los `72` handlers inline restantes a listeners en JS local.
- Luego quitar `unsafe-inline` de `script-src` si no quedan otros usos que lo requieran.

### 2026-06-02 - Paso 13: migrar handlers inline de ingreso, chat y controles a delegacion local

Motivo:

- Tras mover los scripts inline a `mall-boot.js`, quedaban `72` handlers inline en `index.html`.
- Para avanzar hacia una CSP sin `unsafe-inline`, se migro primero el tramo visible y de uso frecuente:
  - Boton de orientacion movil.
  - Ingreso visitante/miembro/locatario.
  - Selector de avatar.
  - Acciones secundarias de ingreso.
  - Boton admin persistente.
  - Chat minimizado/cierre/reset.
  - Menu de controles del mall.

Cambios:

- `js/mall/mall-boot.js`:
  - Agregada delegacion de eventos basada en `data-mall-action`.
  - Agregado helper `callGlobal` para invocar funciones globales existentes sin duplicar logica.
  - Agregado soporte para `data-stop-propagation="true"`.
  - Acciones cubiertas:
    - `requestLandscape`.
    - `recoverMember`.
    - `recoverTenant`.
    - `memberLogin`.
    - `memberRegister`.
    - `verifyMemberPhoneOtp`.
    - `entryGuest`.
    - `entryMember`.
    - `entryTenant`.
    - `tenantLoginMain`.
    - `startMallExperience`.
    - `toggleTenantApply`.
    - `openSuperAdmin`.
    - `toggleChat`.
    - `resetChatTarget`.
    - `toggleControlsMenu`.
    - `toggleWalkMode`.
    - `toggleAvatarLabelMode`.
    - `toggleTenantLogin`.
    - `openTenantAdminFromMenu`.
    - `avatarBody`.
    - `avatarOutfit`.
- `index.html`:
  - Reemplazados handlers `onclick` del tramo inicial por `data-mall-action`.
  - Reemplazados argumentos simples por `data-mall-value` cuando correspondia.
  - Conservado el comportamiento de `event.stopPropagation()` con `data-stop-propagation="true"`.

Verificacion local:

- Conteo de handlers inline bajo de `72` a `39`.
- Todas las acciones `data-mall-action` encontradas en HTML tienen implementacion en `mall-boot.js`.
- `index.html` no contiene bloques `<script>` inline.
- `node --check js/mall/mall-boot.js`: OK.
- `node --check` sobre `js/mall/*.js`: OK.
- Servidor local `http://127.0.0.1:8080`:
  - `/index.html`: `200`.
  - `/js/mall/mall-boot.js`: `200`.
  - `/js/mall/mall-ui.js`: `200`.

Verificacion publica:

- Desplegado a produccion con Vercel CLI.
- URL oficial verificada:
  - `https://mall-virtual-one-ten.vercel.app/`: `200`.
- Rutas criticas:
  - `/js/mall/mall-boot.js`: `200`.
  - `/js/mall/mall-ui.js`: `200`.
- HTML publico:
  - `inline_handlers=39`.
  - `data_actions=32`.
  - Contiene `data-mall-action="startMallExperience"`.
  - Contiene `data-mall-action="toggleControlsMenu"`.
  - Ya no contiene `onclick="toggleChat()"`.
- `mall-boot.js` publico:
  - Contiene `const entryActions`.
  - Contiene `data-mall-action`.
  - Contiene `toggleControlsMenu`.
  - Contiene `avatarBody`.

Pendiente:

- Migrar los `39` handlers inline restantes, concentrados principalmente en:
  - Formularios y modal de contacto de tienda.
  - Modal de login/password de locatarios.
  - Panel administrativo.
  - Configuracion de local del locatario.
  - Buscador de tiendas.
- Quitar `unsafe-inline` de `script-src` solo cuando el conteo de handlers/script inline llegue a cero.

### 2026-06-02 - Paso 14: migrar handlers de formularios y locatario a delegacion local

Motivo:

- Despues del Paso 13 quedaban `39` handlers inline.
- Se separo el trabajo en dos grupos:
  - Formularios/modales de tienda y locatario.
  - Panel administrativo central.
- En este paso se migro el grupo de tienda/locatario para reducir riesgo antes de tocar las acciones administrativas mas sensibles.

Cambios:

- `js/mall/mall-boot.js`:
  - Agregada delegacion para eventos `submit` mediante `data-mall-submit`.
  - Agregada delegacion para eventos `input` mediante `data-mall-input`.
  - Agregada delegacion para eventos `change` mediante `data-mall-change`.
  - Nuevas acciones cubiertas:
    - `storeContactSubmit`.
    - `tenantLoginDefault`.
    - `skipTenantPasswordSetup`.
    - `submitTenantPasswordSetup`.
    - `closePasswordRecovery`.
    - `sendPasswordRecovery`.
    - `submitRecoveredPassword`.
    - `submitTenantApplication`.
    - `closeTenantAdmin`.
    - `refreshTenantTelegramUi`.
    - `regenerateTenantTelegramLinkCode`.
    - `openTenantTelegramBotLink`.
    - `uploadTenantLogo`.
    - `clickTenantLogoFile`.
    - `updateTenantPassword`.
    - `previewTenantStore`.
    - `saveTenantData`.
    - `filterStores`.
- `index.html`:
  - Migrado formulario de contacto de tienda a `data-mall-submit="storeContactSubmit"`.
  - Migrado login/modal de locatario y cambio inicial de password.
  - Migrado modal de recuperacion de password.
  - Migrado formulario de postulacion de locatario.
  - Migradas acciones de configuracion de local del locatario.
  - Migrado `filterStores` del buscador a `data-mall-input`.

Verificacion local:

- Conteo de handlers inline bajo de `39` a `18`.
- Los `18` restantes pertenecen al panel administrativo central.
- Todas las acciones `data-mall-action`, `data-mall-submit`, `data-mall-input` y `data-mall-change` tienen implementacion en `mall-boot.js`.
- `index.html` no contiene bloques `<script>` inline.
- `node --check js/mall/mall-boot.js`: OK.
- `node --check` sobre `js/mall/*.js`: OK.
- Servidor local `http://127.0.0.1:8080`:
  - `/index.html`: `200`.
  - `/js/mall/mall-boot.js`: `200`.
  - `/js/mall/mall-ui.js`: `200`.

Verificacion publica:

- Desplegado a produccion con Vercel CLI.
- URL oficial verificada:
  - `https://mall-virtual-one-ten.vercel.app/`: `200`.
- Rutas criticas:
  - `/js/mall/mall-boot.js`: `200`.
  - `/js/mall/mall-ui.js`: `200`.
- HTML publico:
  - `inline_handlers=18`.
  - `data_actions=48`.
  - `data_submit=2`.
  - `data_input=1`.
  - `data_change=2`.
  - Contiene `data-mall-submit="storeContactSubmit"`.
  - Contiene `data-mall-submit="submitTenantApplication"`.
  - Contiene `data-mall-change="uploadTenantLogo"`.
  - Contiene `data-mall-input="filterStores"`.
- `mall-boot.js` publico:
  - Contiene `storeContactSubmit`.
  - Contiene `submitTenantApplication`.
  - Contiene `uploadTenantLogo`.
  - Contiene `document.addEventListener('submit'`.
  - Contiene `document.addEventListener('change'`.

Pendiente:

- Migrar los `18` handlers inline restantes del panel administrativo central:
  - Logout/cierre modal admin.
  - Toggles de herramientas admin.
  - Teletransporte a hotspot.
  - Seleccion/limpieza de codigos de locales.
  - Aprobacion/rechazo/eliminacion de cuentas.
  - Estado de servicio.
  - Guardado de tarifa, arriendo, pago y observacion.
- Cuando el conteo llegue a cero, quitar `unsafe-inline` de `script-src` y verificar CSP en produccion.

### 2026-06-02 - Paso 15: eliminar handlers admin inline y cerrar CSP de scripts

Motivo:

- Despues del Paso 14 quedaban `18` handlers inline, todos concentrados en el panel administrativo central.
- Mientras existieran esos handlers, `Content-Security-Policy script-src` debia mantener `unsafe-inline`.
- La meta de esta fase era dejar scripts ejecutables solo desde archivos servidos por el mismo origen.

Cambios:

- `js/mall/mall-boot.js`:
  - Agregadas acciones admin delegadas:
    - `adminLogout`.
    - `closeSuperAdmin`.
    - `toggleAdminTool`.
    - `teleportAdminToSelectedHotspot`.
    - `appendSelectedAdminStoreCode`.
    - `clearSelectedAdminStoreCodes`.
    - `refreshAdminLocalCodes`.
    - `approveSelectedTenantApplication`.
    - `rejectSelectedTenantApplication`.
    - `deleteSelectedTenantAccount`.
    - `saveAdminServiceStatus`.
    - `saveAdminRentRate`.
    - `saveAdminLease`.
    - `saveAdminPayment`.
    - `saveAdminNote`.
- `index.html`:
  - Reemplazados los ultimos handlers `onclick`, `onchange` y `oninput` del panel admin por:
    - `data-mall-action`.
    - `data-mall-change`.
    - `data-mall-input`.
    - `data-mall-tool`.
    - `data-mall-status`.
- `vercel.json`:
  - CSP `script-src` cambio de:
    - `'self' 'unsafe-inline'`.
  - A:
    - `'self'`.
  - `style-src` conserva temporalmente `'unsafe-inline'` porque el HTML todavia usa muchos estilos inline.

Verificacion local:

- Conteo de scripts/handlers inline:
  - `onclick`, `onchange`, `oninput`, `onsubmit`, `<script>` sin `src`: `0`.
- Todas las acciones declaradas con `data-mall-*` tienen implementacion en `mall-boot.js`.
- `vercel.json` parsea correctamente con `JSON.parse`.
- `node --check js/mall/mall-boot.js`: OK.
- `node --check` sobre `js/mall/*.js`: OK.
- Servidor local `http://127.0.0.1:8080`:
  - `/index.html`: `200`.
  - `/js/mall/mall-boot.js`: `200`.
  - `/js/mall/mall-ui.js`: `200`.
  - `/assets/vendor/three/three.r128.min.js`: `200`.

Verificacion publica:

- Desplegado a produccion con Vercel CLI.
- URL oficial verificada:
  - `https://mall-virtual-one-ten.vercel.app/`: `200`.
- Rutas criticas:
  - `/js/mall/mall-boot.js`: `200`.
  - `/js/mall/mall-ui.js`: `200`.
  - `/assets/vendor/three/three.r128.min.js`: `200`.
- Cabeceras publicas:
  - `Content-Security-Policy` contiene `script-src 'self'`.
  - `script-src` ya no contiene `unsafe-inline`.
  - `style-src` aun contiene `unsafe-inline` por estilos inline pendientes.
  - `Cross-Origin-Opener-Policy: same-origin`.
  - `Cross-Origin-Resource-Policy: same-origin`.
  - `Strict-Transport-Security` presente.
  - `X-Content-Type-Options: nosniff`.
- HTML publico:
  - `inline_script_or_handlers=0`.
  - `data_actions_total=71`.
  - Contiene:
    - `data-mall-action="adminLogout"`.
    - `data-mall-change="toggleAdminTool"`.
    - `data-mall-input="refreshAdminLocalCodes"`.
    - `data-mall-action="saveAdminNote"`.
- `mall-boot.js` publico:
  - Contiene `adminLogout`.
  - Contiene `toggleAdminTool`.
  - Contiene `saveAdminPayment`.
  - Contiene `saveAdminNote`.
  - Contiene `refreshAdminLocalCodes`.

Pendiente:

- Proxima fase CSP:
  - Reducir/eliminar estilos inline para poder quitar `unsafe-inline` de `style-src`.
  - Evaluar servir Google Fonts/Material Symbols localmente o mantenerlos con allowlist estricta.
- Continuar pendientes externos de Supabase:
  - Aplicar migraciones SQL de hardening.
  - Configurar secretos y webhook seguro de Telegram Edge Function.
  - Verificar politicas Storage/RLS en proyecto Supabase.

### 2026-06-02 - Paso 16: extraer CSS principal del HTML a archivo local

Motivo:

- Tras cerrar CSP de scripts, `style-src` todavia necesitaba `unsafe-inline`.
- El HTML tenia dos fuentes de estilos inline:
  - Un bloque grande `<style>...</style>` en el `head`.
  - Cientos de atributos `style="..."` en modales y paneles.
- Se eligio primero extraer el bloque completo de CSS porque es un cambio mecanico, de bajo riesgo visual y prepara la eliminacion posterior de estilos inline restantes.

Cambios:

- Nuevo archivo:
  - `css/mall.css`.
- `index.html`:
  - Eliminado el bloque `<style>...</style>` del `head`.
  - Agregado:
    - `<link rel="stylesheet" href="css/mall.css">`.
- `css/mall.css`:
  - Contiene el CSS existente sin reescribir selectores ni cambiar estilos.
  - Incluye reglas criticas como:
    - `:root`.
    - `#login-overlay`.
    - `.login-card`.
    - `#search-modal`.
    - `#mobile-orientation-helper`.

Verificacion local:

- `css/mall.css` creado con contenido del bloque CSS original.
- Conteos:
  - Bloques `<style>` en `index.html`: `0`.
  - Atributos `style="..."` restantes: `348` en local.
  - Scripts/handlers inline: `0`.
- `vercel.json` parsea correctamente con `JSON.parse`.
- `node --check` sobre `js/mall/*.js`: OK.
- Servidor local `http://127.0.0.1:8080`:
  - `/index.html`: `200`.
  - `/css/mall.css`: `200`.
  - `/js/mall/mall-boot.js`: `200`.
  - `/js/mall/mall-ui.js`: `200`.

Verificacion publica:

- Desplegado a produccion con Vercel CLI.
- URL oficial verificada:
  - `https://mall-virtual-one-ten.vercel.app/`: `200`.
- Rutas criticas:
  - `/css/mall.css`: `200`.
  - `/js/mall/mall-boot.js`: `200`.
  - `/js/mall/mall-ui.js`: `200`.
- Headers de `/css/mall.css`:
  - `Content-Type: text/css`.
  - `X-Content-Type-Options: nosniff`.
- HTML publico:
  - `style_blocks=0`.
  - `style_attrs=352`.
  - `css_link=True`.
  - `inline_script_or_handlers=0`.
- CSS publico:
  - Contiene `:root`.
  - Contiene `#login-overlay`.
  - Contiene `#mobile-orientation-helper`.
  - Contiene `.login-card`.
  - Contiene `#search-modal`.

Observacion:

- La medicion local de atributos `style` fue `348`, mientras que la medicion publica fue `352` porque el patron publico conto apariciones de `style=` en el HTML serializado. En ambos casos confirma que aun quedan cientos de estilos inline.
- Por eso `style-src` mantiene temporalmente `unsafe-inline`.

Pendiente:

- Migrar atributos `style="..."` a clases CSS por zonas:
  - Ingreso/login y selector de avatar.
  - Chat.
  - Paneles de diagnostico.
  - Modales tienda/locatario.
  - Panel admin central.
- Cuando `style_attrs=0`, quitar `unsafe-inline` de `style-src` y verificar CSP publica.

### 2026-06-02 - Paso 17: migrar estilos inline del chat a CSS local

Motivo:

- Despues del Paso 16 quedaban cientos de atributos `style="..."` que obligan a mantener `style-src 'unsafe-inline'`.
- Se eligio el bloque de chat como siguiente corte por ser compacto, visible y con estilos agrupables por ID/clase.

Cambios:

- `css/mall.css`:
  - Agregadas reglas para:
    - `#chat-minimized-btn`.
    - `.chat-minimized-icon`.
    - `#chat-badge`.
    - `#mall-chat`.
    - `.chat-header`.
    - `.chat-title`.
    - `.chat-close-btn`.
    - `#chat-messages`.
    - `#chat-target-indicator`.
    - `#chat-reset-btn`.
    - `#chat-input-container`.
    - `#chat-input`.
    - `#chat-send`.
- `index.html`:
  - Eliminados estilos inline del bloque de chat minimizado y caja de chat.
  - Agregadas clases semanticas donde correspondia:
    - `.chat-minimized-icon`.
    - `.chat-header`.
    - `.chat-title`.
    - `.chat-close-btn`.

Verificacion local:

- Conteo local de `style="..."` bajo de `348` a `335`.
- El bloque del chat ya no contiene `style="..."`.
- `/index.html`: `200`.
- `/css/mall.css`: `200`.
- `/js/mall/mall-boot.js`: `200`.
- `node --check` sobre `js/mall/*.js`: OK.
- Scripts/handlers inline se mantienen en `0`.
- `vercel.json` parsea correctamente con `JSON.parse`.

Verificacion publica:

- Desplegado a produccion con Vercel CLI.
- URL oficial verificada:
  - `https://mall-virtual-one-ten.vercel.app/`: `200`.
- Rutas criticas:
  - `/css/mall.css`: `200`.
  - `/js/mall/mall-boot.js`: `200`.
- HTML publico:
  - `style_attrs=339`.
  - `inline_script_or_handlers=0`.
  - Contiene `id="chat-minimized-btn" data-mall-action="toggleChat"`.
  - Contiene `id="mall-chat"`.
  - Contiene `class="chat-header"`.
  - Contiene `id="chat-input"`.
- CSS publico:
  - Contiene `#chat-minimized-btn`.
  - Contiene `#mall-chat`.
  - Contiene `.chat-header`.
  - Contiene `#chat-input`.
  - Contiene `#chat-send`.
- CSP publica:
  - `script-src 'self'`.
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` se mantiene temporalmente.

Observacion:

- El conteo publico de estilos inline difiere del conteo local por diferencias de serializacion/medicion (`style=` vs `style="..."`), pero ambos muestran reduccion y confirman que quedan estilos inline pendientes.

Pendiente:

- Continuar migracion de `style="..."` por zonas.
- Siguiente zona recomendada:
  - Cabecera/overlays de diagnostico pequenos (`main-header`, `gps-display`, `debug-build-stamp`, `axis-reference`) o ingreso/login si se prioriza experiencia movil.

### 2026-06-03 - Paso 18: migrar estilos inline de cabecera y diagnostico a CSS local

Motivo:

- Reducir progresivamente los atributos `style="..."` restantes para poder quitar `style-src 'unsafe-inline'` en una etapa posterior.
- Se eligio una zona pequena y visible: cabecera principal, texto secundario del overlay, indicador de build, panel GPS y referencia de ejes.

Cambios:

- `css/mall.css`:
  - Agregadas reglas para:
    - `#main-header`.
    - `.ui-overlay-tagline`.
    - `.is-hidden`.
    - `#debug-build-stamp`.
    - `#gps-display`.
    - `.gps-header`.
    - `.gps-status-dot`.
    - `.gps-grid`.
    - `.gps-axis-label`.
    - `.gps-axis-x`.
    - `.gps-axis-y`.
    - `.gps-axis-z`.
    - `.gps-axis-angle`.
    - `.gps-value`.
    - `.gps-footnote`.
  - Agregado `display: none` a `#axis-reference`.
- `index.html`:
  - Eliminados estilos inline de `#main-header`, `#debug-build-stamp`, `#gps-display` y `#axis-reference`.
  - Reemplazados estilos inline de cabecera/diagnostico por clases CSS.
  - `tenant-manage-menu-item`, `admin-manage-menu-item` y `object-debug-panel` ahora usan `.is-hidden` para su estado inicial oculto.

Verificacion local:

- Conteo local de `style="..."` bajo de `335` a `319`.
- Scripts, handlers y bloques `<style>` inline se mantienen en `0`.
- `/index.html`: `200`.
- `/css/mall.css`: `200`.
- `/js/mall/mall-boot.js`: `200`.
- `/js/mall/mall-ui.js`: `200`.
- `node --check` sobre `js/mall/*.js`: OK.
- `vercel.json` parsea correctamente con `JSON.parse`.

Verificacion publica:

- Desplegado a produccion con Vercel CLI.
- URL oficial verificada:
  - `https://mall-virtual-one-ten.vercel.app/`: `200`.
- Rutas criticas:
  - `/css/mall.css`: `200`.
  - `/js/mall/mall-boot.js`: `200`.
  - `/js/mall/mall-ui.js`: `200`.
- HTML publico:
  - `style_attrs=319`.
  - `inline_script_or_handlers=0`.
  - Contiene `id="main-header"`.
  - Contiene `class="ui-overlay-tagline"`.
  - Contiene `id="debug-build-stamp"`.
  - Contiene `class="gps-header"`.
  - Contiene `id="axis-reference"`.
- CSS publico:
  - Contiene `#main-header`.
  - Contiene `.ui-overlay-tagline`.
  - Contiene `#gps-display`.
  - Contiene `.gps-value`.
  - Contiene `#axis-reference`.
- CSP publica:
  - `script-src 'self'`.
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` se mantiene temporalmente hasta eliminar todos los estilos inline.
- Encabezados publicos verificados:
  - `Cross-Origin-Opener-Policy: same-origin`.
  - `Cross-Origin-Resource-Policy: same-origin`.
  - `Strict-Transport-Security`.
  - `X-Content-Type-Options: nosniff`.

Pendiente:

- Continuar migracion de `style="..."` por zonas hasta llegar a `0`.
- Siguiente zona recomendada:
  - Interfaz de ingreso/login movil, por impacto directo en experiencia de celulares.
- Despues de `style_attrs=0`, quitar `'unsafe-inline'` de `style-src` y volver a verificar en produccion.

### 2026-06-03 - Paso 19: migrar estilos inline del ingreso inicial a CSS local

Motivo:

- Continuar eliminando estilos inline en una zona critica para celulares: ingreso como visitante, inscripcion de visitante, acceso locatario aprobado y seleccion de avatar.
- Mantener intactos los IDs usados por JavaScript para no romper el flujo de entrada ni los cambios de panel.

Cambios:

- `css/mall.css`:
  - Agregadas reglas reutilizables para:
    - `#guest-entry-panel`.
    - `#member-entry-panel`.
    - `#tenant-entry-panel`.
    - `.entry-panel-title`.
    - `.entry-input-line`.
    - `.entry-input-box`.
    - `.entry-help-copy`.
    - `.entry-guest-note`.
    - `.entry-status-copy`.
    - `.entry-link-btn`.
    - `.entry-back-btn`.
    - `.entry-button-grid`.
    - `.entry-compact-btn`.
    - `.entry-outline-btn`.
    - `#member-phone-verify-panel`.
    - `.entry-verify-btn`.
    - `.entry-full-btn`.
    - `#avatar-selection`.
    - `.avatar-section-label`.
    - `.entry-tenant-link`.
- `index.html`:
  - Eliminados estilos inline del panel inicial de visitante.
  - Eliminados estilos inline del panel de inscripcion de visitante.
  - Eliminados estilos inline del panel de acceso locatario aprobado.
  - Eliminados estilos inline de etiquetas de seleccion de avatar.
  - Se conservaron IDs y atributos `data-mall-*` existentes.

Verificacion local:

- Conteo local de `style="..."` bajo de `319` a `285`.
- Scripts, handlers y bloques `<style>` inline se mantienen en `0`.
- `/index.html`: `200`.
- `/css/mall.css`: `200`.
- `/js/mall/mall-boot.js`: `200`.
- `/js/mall/mall-ui.js`: `200`.
- `node --check` sobre scripts principales: OK.
- `vercel.json` parsea correctamente con `JSON.parse`.
- Navegador integrado:
  - `#login-overlay` visible.
  - `#guest-entry-panel` visible.
  - `#visitor-password-input` usa `.entry-input-line`.
  - No se detectaron handlers inline.

Despliegue:

- `npx --yes vercel deploy --prod --yes --debug` fallo por descarga npm de `@vercel/express@0.1.96` no encontrada.
- `npx --yes vercel@39.4.2 deploy --prod --yes` subio archivos, pero Vercel rechazo el CLI por version antigua.
- `npx --yes vercel@48.0.0 deploy --prod --yes` completo correctamente.
- Production URL de despliegue:
  - `https://mall-virtual-nc4gt7u7e-alanmauri4815s-projects.vercel.app`.

Verificacion publica:

- URL oficial verificada:
  - `https://mall-virtual-one-ten.vercel.app/`: `200`.
- Rutas criticas:
  - `/css/mall.css`: `200`.
  - `/js/mall/mall-boot.js`: `200`.
  - `/js/mall/mall-ui.js`: `200`.
- HTML publico:
  - `style_attrs=285`.
  - `inline_script_or_handlers=0`.
  - Contiene `.entry-input-line`.
  - Contiene `.entry-link-btn`.
  - Contiene `#member-entry-panel`.
  - Contiene `#tenant-entry-panel`.
  - Contiene `#avatar-selection`.
- CSS publico:
  - Contiene `.entry-input-line`.
  - Contiene `.entry-link-btn`.
  - Contiene `#member-entry-panel`.
  - Contiene `#tenant-entry-panel`.
  - Contiene `#avatar-selection`.

Pendiente:

- Continuar migracion de `style="..."` por zonas hasta llegar a `0`.
- Siguiente zona recomendada:
  - Modal de ficha comercial/contacto (`store-modal`), porque es parte del flujo comprador-vendedor.
- Cuando `style_attrs=0`, quitar `'unsafe-inline'` de `style-src` y verificar nuevamente la CSP publica.

### 2026-06-03 - Paso 20: migrar estilos inline del modal de ficha comercial/contacto

Motivo:

- Reducir estilos inline en una zona de alto impacto comercial: ficha publica del local, formulario de contacto y enlaces directos a email/WhatsApp.
- Mejorar mantenibilidad del modal moviendo presentacion a `css/mall.css`.
- Corregir dos restos invalidos `});` que quedaban en CSS dentro de reglas antiguas del modal.

Cambios:

- `css/mall.css`:
  - Corregidos cierres invalidos en reglas de `#store-modal` y `#store-modal .price`.
  - Agregadas reglas para:
    - `#modal-close-btn-fixed`.
    - `#modal-title`.
    - `#modal-contact-section`.
    - `.modal-contact-title`.
    - `.store-contact-input`.
    - `.store-contact-message`.
    - `.store-contact-actions`.
    - `.store-contact-action`.
    - `.store-contact-link`.
    - `.store-mail-link`.
    - `.store-whatsapp-link`.
    - `#btn-manage-store`.
    - `.store-modal-footer`.
- `index.html`:
  - Eliminado `style` inline de `#store-modal`.
  - Eliminado `style` inline del boton de cierre y titulo del modal.
  - `#modal-store-logo-box`, `#modal-store-gallery` y `#btn-manage-store` usan `.is-hidden` como estado inicial.
  - Eliminados estilos inline de formulario de contacto, botones y pie del modal.
  - Se conservaron IDs usados por `mall-main.js` para apertura, cierre, logo, galeria, contacto y gestion de tienda.

Verificacion local:

- Conteo local de `style="..."` bajo de `285` a `269`.
- Scripts, handlers y bloques `<style>` inline se mantienen en `0`.
- `/index.html`: `200`.
- `/css/mall.css`: `200`.
- `/js/mall/mall-boot.js`: `200`.
- `/js/mall/mall-main.js`: `200`.
- `node --check` sobre scripts principales: OK.
- `vercel.json` parsea correctamente con `JSON.parse`.
- Busqueda de restos invalidos `});` en `css/mall.css`: sin resultados.
- Navegador integrado:
  - Confirmo presencia de clases del modal y `0` handlers inline.
  - La API disponible no permitio mutar `style.display` desde `evaluate`, por lo que no se forzo apertura visual del modal en esa prueba.

Despliegue:

- Publicado con:
  - `npx --yes vercel@48.0.0 deploy --prod --yes`.
- Production URL de despliegue:
  - `https://mall-virtual-o53o33vll-alanmauri4815s-projects.vercel.app`.

Verificacion publica:

- URL oficial verificada:
  - `https://mall-virtual-one-ten.vercel.app/`: `200`.
- Rutas criticas:
  - `/css/mall.css`: `200`.
  - `/js/mall/mall-boot.js`: `200`.
  - `/js/mall/mall-main.js`: `200`.
- HTML publico:
  - `style_attrs=269`.
  - `inline_script_or_handlers=0`.
  - Contiene `id="store-modal"`.
  - Contiene `id="modal-close-btn-fixed"`.
  - Contiene `.modal-contact-title`.
  - Contiene `.store-contact-input`.
  - Contiene `.store-contact-actions`.
  - Contiene `.store-modal-footer`.
- CSS publico:
  - Contiene `#modal-close-btn-fixed`.
  - Contiene `.modal-contact-title`.
  - Contiene `.store-contact-input`.
  - Contiene `.store-contact-actions`.
  - Contiene `#btn-manage-store`.
  - Contiene `.store-modal-footer`.
- CSP publica:
  - `script-src 'self'`.
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` se mantiene temporalmente.
- Encabezados publicos verificados:
  - `Cross-Origin-Opener-Policy: same-origin`.
  - `Cross-Origin-Resource-Policy: same-origin`.
  - `Strict-Transport-Security`.
  - `X-Content-Type-Options: nosniff`.

Pendiente:

- Continuar migracion de `style="..."` por zonas hasta llegar a `0`.
- Siguiente zona recomendada:
  - Modales de acceso locatario, definicion de clave y recuperacion de contrasena, porque son flujo de autenticacion.
- Cuando `style_attrs=0`, quitar `'unsafe-inline'` de `style-src` y verificar nuevamente la CSP publica.

### 2026-06-03 - Paso 21: migrar estilos inline de modales de autenticacion

Motivo:

- Reducir estilos inline en flujos sensibles: acceso locatario, definicion de clave personal y recuperacion de contrasena.
- Consolidar estilos repetidos en clases compartidas para mejorar mantenibilidad.
- Mantener intactos IDs y `data-mall-action` usados por `mall-ui.js` y `mall-multiplayer.js`.

Cambios:

- `css/mall.css`:
  - Agregadas reglas compartidas para:
    - `.auth-modal`.
    - `.auth-title`.
    - `.tenant-login-title`.
    - `.auth-input-line`.
    - `.auth-input-box`.
    - `.auth-full-btn`.
    - `.auth-link-btn`.
    - `.auth-cancel-btn`.
    - `.auth-modal-header`.
    - `.auth-close-btn`.
    - `.auth-copy`.
    - `.auth-copy-spaced`.
    - `.auth-check-label`.
    - `.auth-checkbox`.
    - `.auth-actions`.
    - `.auth-flex-btn`.
    - `.auth-muted-btn`.
    - `.auth-status`.
    - `.auth-panel`.
  - Agregadas reglas especificas para:
    - `#tenant-login-modal`.
    - `#tenant-password-setup-modal`.
    - `#password-recovery-modal`.
    - `#tenant-email`.
    - `#tenant-pass`.
    - `#tenant-password-setup-new`.
    - `#password-recovery-reset-panel`.
- `index.html`:
  - Eliminados estilos inline de:
    - `#tenant-login-modal`.
    - `#tenant-password-setup-modal`.
    - `#password-recovery-modal`.
  - Eliminados estilos inline de inputs, titulos, botones, labels, paneles y mensajes de estado de esos modales.
  - Se conservaron IDs y acciones existentes:
    - `tenantLoginDefault`.
    - `recoverTenant`.
    - `toggleTenantLogin`.
    - `submitTenantPasswordSetup`.
    - `skipTenantPasswordSetup`.
    - `closePasswordRecovery`.
    - `sendPasswordRecovery`.
    - `submitRecoveredPassword`.

Verificacion local:

- Conteo local de `style="..."` bajo de `269` a `235`.
- Scripts, handlers y bloques `<style>` inline se mantienen en `0`.
- `/index.html`: `200`.
- `/css/mall.css`: `200`.
- `/js/mall/mall-boot.js`: `200`.
- `/js/mall/mall-ui.js`: `200`.
- `/js/mall/mall-multiplayer.js`: `200`.
- `node --check` sobre scripts principales: OK.
- `vercel.json` parsea correctamente con `JSON.parse`.
- Navegador integrado:
  - `#tenant-login-modal`, `#tenant-password-setup-modal` y `#password-recovery-modal` quedan ocultos al inicio.
  - `#password-recovery-request-panel` queda visible dentro del modal.
  - `#password-recovery-reset-panel` queda oculto al inicio.
  - Inputs usan `.auth-input-line` / `.auth-input-box`.
  - `inlineHandlers=0`.

Despliegue:

- Publicado con:
  - `npx --yes vercel@48.0.0 deploy --prod --yes`.
- Production URL de despliegue:
  - `https://mall-virtual-2n718a9nt-alanmauri4815s-projects.vercel.app`.

Verificacion publica:

- URL oficial verificada:
  - `https://mall-virtual-one-ten.vercel.app/`: `200`.
- Rutas criticas:
  - `/css/mall.css`: `200`.
  - `/js/mall/mall-boot.js`: `200`.
  - `/js/mall/mall-ui.js`: `200`.
  - `/js/mall/mall-multiplayer.js`: `200`.
- HTML publico:
  - `style_attrs=235`.
  - `inline_script_or_handlers=0`.
  - Contiene `id="tenant-login-modal" class="auth-modal"`.
  - Contiene `id="tenant-password-setup-modal" class="auth-modal"`.
  - Contiene `id="password-recovery-modal" class="auth-modal"`.
  - Contiene `.auth-input-box`.
  - Contiene `.auth-panel`.
  - Contiene `.auth-status`.
- CSS publico:
  - Contiene `.auth-modal`.
  - Contiene `#tenant-login-modal`.
  - Contiene `#tenant-password-setup-modal`.
  - Contiene `#password-recovery-modal`.
  - Contiene `.auth-input-box`.
  - Contiene `.auth-panel`.
  - Contiene `.auth-status`.
- CSP publica:
  - `script-src 'self'`.
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` se mantiene temporalmente.
- Encabezados publicos verificados:
  - `Cross-Origin-Opener-Policy: same-origin`.
  - `Cross-Origin-Resource-Policy: same-origin`.
  - `Strict-Transport-Security`.
  - `X-Content-Type-Options: nosniff`.

Pendiente:

- Continuar migracion de `style="..."` por zonas hasta llegar a `0`.
- Siguiente zona recomendada:
  - Panel super admin, empezando por cabecera/resumen/diagnostico para reducir estilos repetidos sin tocar aun logica de aprobacion.
- Cuando `style_attrs=0`, quitar `'unsafe-inline'` de `style-src` y verificar nuevamente la CSP publica.

### 2026-06-03 - Paso 22: migrar estilos inline iniciales del panel super admin

Motivo:

- Reducir estilos inline en el panel maestro sin tocar todavia la logica de aprobacion/asignacion.
- Empezar por una zona acotada: contenedor, cabecera, lista de postulaciones, resumen y herramientas de diagnostico.
- Mantener intactos los IDs usados por `mall-ui.js` para logout, cierre, estadisticas, toggles de diagnostico y desplazamiento rapido.

Cambios:

- `css/mall.css`:
  - Agregadas reglas para:
    - `#super-admin-modal`.
    - `.admin-modal-header`.
    - `.admin-modal-title`.
    - `.admin-header-actions`.
    - `.admin-logout-btn`.
    - `.admin-close-btn`.
    - `.admin-overview-grid`.
    - `.admin-card`.
    - `.admin-card-title`.
    - `.admin-apps-list`.
    - `.admin-muted-copy`.
    - `.admin-side-stack`.
    - `#admin-stats`.
    - `#stat-free-stores`.
    - `.admin-tool-list`.
    - `.admin-tool-label`.
    - `.admin-tool-checkbox`.
    - `.admin-hotspot-panel`.
    - `.admin-hotspot-title`.
    - `#admin-hotspot-select`.
    - `.admin-primary-btn`.
    - `#admin-hotspot-status`.
- `index.html`:
  - Eliminados estilos inline de `#super-admin-modal`.
  - Eliminados estilos inline de cabecera, titulo, logout/cierre, grid principal, tarjetas iniciales, resumen, checkboxes de diagnostico y desplazamiento rapido.
  - Se conservaron IDs y `data-mall-*` de:
    - `adminLogout`.
    - `closeSuperAdmin`.
    - `admin-apps-list`.
    - `admin-stats`.
    - `stat-total-stores`.
    - `stat-occupied-stores`.
    - `stat-free-stores`.
    - `admin-toggle-compass`.
    - `admin-toggle-inspector`.
    - `admin-toggle-gps`.
    - `admin-hotspot-select`.
    - `teleportAdminToSelectedHotspot`.
    - `admin-hotspot-status`.

Verificacion local:

- Conteo local de `style="..."` bajo de `235` a `205`.
- Scripts, handlers y bloques `<style>` inline se mantienen en `0`.
- `/index.html`: `200`.
- `/css/mall.css`: `200`.
- `/js/mall/mall-boot.js`: `200`.
- `/js/mall/mall-ui.js`: `200`.
- `node --check` sobre scripts principales: OK.
- `vercel.json` parsea correctamente con `JSON.parse`.
- Navegador integrado:
  - `#super-admin-modal` queda oculto al inicio.
  - `z-index` del modal admin se mantiene en `4000`.
  - `.admin-modal-header` usa `display:flex`.
  - `.admin-overview-grid` usa `display:grid`.
  - `#admin-apps-list` usa `.admin-apps-list`.
  - `#admin-toggle-compass` usa `.admin-tool-checkbox`.
  - `#admin-hotspot-select` conserva `width:100%`.
  - `inlineHandlers=0`.

Despliegue:

- Publicado con:
  - `npx --yes vercel@48.0.0 deploy --prod --yes`.
- Production URL de despliegue:
  - `https://mall-virtual-gd6crwug1-alanmauri4815s-projects.vercel.app`.

Verificacion publica:

- URL oficial verificada:
  - `https://mall-virtual-one-ten.vercel.app/`: `200`.
- Rutas criticas:
  - `/css/mall.css`: `200`.
  - `/js/mall/mall-boot.js`: `200`.
  - `/js/mall/mall-ui.js`: `200`.
- HTML publico:
  - `style_attrs=205`.
  - `inline_script_or_handlers=0`.
  - Contiene `id="super-admin-modal"`.
  - Contiene `.admin-modal-header`.
  - Contiene `.admin-overview-grid`.
  - Contiene `id="admin-apps-list" class="admin-apps-list"`.
  - Contiene `.admin-tool-checkbox`.
  - Contiene `.admin-primary-btn`.
- CSS publico:
  - Contiene `#super-admin-modal`.
  - Contiene `.admin-modal-header`.
  - Contiene `.admin-overview-grid`.
  - Contiene `.admin-apps-list`.
  - Contiene `.admin-tool-checkbox`.
  - Contiene `.admin-primary-btn`.
- CSP publica:
  - `script-src 'self'`.
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` se mantiene temporalmente.
- Encabezados publicos verificados:
  - `Cross-Origin-Opener-Policy: same-origin`.
  - `Cross-Origin-Resource-Policy: same-origin`.
  - `Strict-Transport-Security`.
  - `X-Content-Type-Options: nosniff`.

Pendiente:

- Continuar migracion de `style="..."` por zonas hasta llegar a `0`.
- Siguiente zona recomendada:
  - Panel super admin: seccion de aprobacion/asignacion, migrando primero textos, grids, selects y botones reutilizables.
- Cuando `style_attrs=0`, quitar `'unsafe-inline'` de `style-src` y verificar nuevamente la CSP publica.

### 2026-06-03 - Paso 23: migrar estilos inline de aprobacion/asignacion admin

Motivo:

- Continuar limpieza del panel super admin en una zona funcional: aprobacion/rechazo/asignacion de locales a postulantes.
- Reducir estilos inline sin modificar la logica de seleccion, chips, estados ni acciones administrativas.
- Reutilizar patrones admin ya creados en el Paso 22.

Cambios:

- `css/mall.css`:
  - Agregadas reglas para:
    - `.admin-section-panel`.
    - `.admin-empty-copy`.
    - `#admin-selection-content`.
    - `.admin-selection-summary`.
    - `.admin-selected-brand`.
    - `.admin-selected-category`.
    - `.admin-selected-contact`.
    - `.admin-selected-status`.
    - `.admin-success-copy`.
    - `.admin-assigned-stores`.
    - `.admin-field-label`.
    - `.admin-store-row`.
    - `.admin-select`.
    - `.admin-text-input`.
    - `.admin-compact-btn`.
    - `.admin-secondary-btn`.
    - `.admin-chip-list`.
    - `.admin-help-copy`.
    - `.admin-available-stores`.
    - `.admin-action-row`.
    - `.admin-approve-btn`.
    - `.admin-danger-btn`.
    - `.admin-delete-btn`.
    - `.admin-assignment-status`.
- `index.html`:
  - Eliminados estilos inline de la tarjeta "Aprobacion y Asignacion".
  - Eliminados estilos inline de:
    - `#admin-assignment-panel`.
    - `#admin-selection-empty`.
    - `#admin-selection-content`.
    - datos seleccionados del postulante.
    - label, select, input y chips de locales.
    - botones Agregar/Limpiar/Aprobar/Rechazar/Eliminar.
    - textos de ayuda y estado.
  - Se conservaron IDs y `data-mall-*` de:
    - `admin-store-select`.
    - `appendSelectedAdminStoreCode`.
    - `clearSelectedAdminStoreCodes`.
    - `admin-local-codes`.
    - `refreshAdminLocalCodes`.
    - `admin-selected-store-chips`.
    - `admin-available-stores`.
    - `approveSelectedTenantApplication`.
    - `rejectSelectedTenantApplication`.
    - `deleteSelectedTenantAccount`.
    - `admin-assignment-status`.

Verificacion local:

- Conteo local de `style="..."` bajo de `205` a `178`.
- Scripts, handlers y bloques `<style>` inline se mantienen en `0`.
- `/index.html`: `200`.
- `/css/mall.css`: `200`.
- `/js/mall/mall-boot.js`: `200`.
- `/js/mall/mall-ui.js`: `200`.
- `node --check` sobre scripts principales: OK.
- `vercel.json` parsea correctamente con `JSON.parse`.
- Navegador integrado:
  - `#admin-assignment-panel` usa `.admin-section-panel`.
  - `#admin-selection-content` queda oculto al inicio.
  - `#admin-selection-empty` queda visible al inicio.
  - `#admin-store-select` y `#admin-local-codes` conservan `width:100%`.
  - `#admin-selected-store-chips` usa `display:flex`.
  - Botones aprobar/rechazar usan clases nuevas.
  - `inlineHandlers=0`.

Despliegue:

- Publicado con:
  - `npx --yes vercel@48.0.0 deploy --prod --yes`.
- Production URL de despliegue:
  - `https://mall-virtual-4q7rkamlv-alanmauri4815s-projects.vercel.app`.

Verificacion publica:

- URL oficial verificada:
  - `https://mall-virtual-one-ten.vercel.app/`: `200`.
- Rutas criticas:
  - `/css/mall.css`: `200`.
  - `/js/mall/mall-boot.js`: `200`.
  - `/js/mall/mall-ui.js`: `200`.
- HTML publico:
  - `style_attrs=178`.
  - `inline_script_or_handlers=0`.
  - Contiene `id="admin-assignment-panel" class="admin-section-panel"`.
  - Contiene `id="admin-selection-empty" class="admin-empty-copy"`.
  - Contiene `id="admin-store-select" class="admin-select"`.
  - Contiene `id="admin-local-codes" class="admin-text-input"`.
  - Contiene `id="admin-approve-assign-btn" type="button" class="admin-approve-btn"`.
  - Contiene `id="admin-assignment-status" class="admin-assignment-status"`.
- CSS publico:
  - Contiene `.admin-section-panel`.
  - Contiene `.admin-empty-copy`.
  - Contiene `#admin-selection-content`.
  - Contiene `.admin-select`.
  - Contiene `.admin-text-input`.
  - Contiene `.admin-approve-btn`.
  - Contiene `.admin-assignment-status`.
- CSP publica:
  - `script-src 'self'`.
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` se mantiene temporalmente.
- Encabezados publicos verificados:
  - `Cross-Origin-Opener-Policy: same-origin`.
  - `Cross-Origin-Resource-Policy: same-origin`.
  - `Strict-Transport-Security`.
  - `X-Content-Type-Options: nosniff`.

Pendiente:

- Continuar migracion de `style="..."` por zonas hasta llegar a `0`.
- Siguiente zona recomendada:
  - Panel super admin: gestion comercial del local, empezando por resumen de arriendo/tarifas sin tocar calculos ni guardado.
- Cuando `style_attrs=0`, quitar `'unsafe-inline'` de `style-src` y verificar nuevamente la CSP publica.

### 2026-06-03 - Paso 24: migrar estilos inline de gestion comercial y tarifa base admin

Motivo:

- Continuar limpieza del panel super admin en gestion comercial del local.
- Migrar presentacion de resumen de arriendo, nota de servicio/mora y tarifa base sin tocar calculos, carga ni guardado.
- Mantener intactos IDs usados por `mall-ui.js` para llenar campos, leer valores y ejecutar acciones.

Cambios:

- `css/mall.css`:
  - Agregadas reglas para:
    - `#admin-rental-panel`.
    - `#admin-rental-content`.
    - `.admin-rental-summary-card`.
    - `#admin-rental-store-summary`.
    - `#admin-rental-balance-summary`.
    - `.admin-service-grid`.
    - `.admin-small-label`.
    - `.admin-textarea`.
    - `.admin-field-input`.
    - `.admin-suspend-btn`.
    - `.admin-reactivate-btn`.
    - `#admin-rental-status`.
    - `.admin-rate-grid`.
    - `.admin-grid-title`.
    - `.admin-span-2`.
    - `.admin-actions-end`.
    - `.admin-save-btn`.
- `index.html`:
  - Eliminados estilos inline de la tarjeta "Gestion Comercial del Local".
  - Eliminados estilos inline de:
    - `#admin-rental-panel`.
    - `#admin-rental-empty`.
    - `#admin-rental-content`.
    - resumen de local/arriendo.
    - `#admin-rental-balance-summary`.
    - nota de servicio/mora.
    - botones Suspender/Reactivar Servicio.
    - `#admin-rental-status`.
    - grilla de Tarifa Base del Local.
    - inputs numericos de tarifas.
    - `#admin-rate-notes`.
    - boton Guardar Tarifa.
  - Se conservaron IDs y `data-mall-*` de:
    - `admin-service-note`.
    - `saveAdminServiceStatus`.
    - `admin-rate-floor`.
    - `admin-rate-products`.
    - `admin-rate-monthly`.
    - `admin-rate-quarterly-total`.
    - `admin-rate-quarterly-eq`.
    - `admin-rate-semiannual-total`.
    - `admin-rate-semiannual-eq`.
    - `admin-rate-annual-total`.
    - `admin-rate-annual-eq`.
    - `admin-rate-notes`.
    - `saveAdminRentRate`.

Verificacion local:

- Conteo local de `style="..."` bajo de `178` a `139`.
- Scripts, handlers y bloques `<style>` inline se mantienen en `0`.
- `/index.html`: `200`.
- `/css/mall.css`: `200`.
- `/js/mall/mall-boot.js`: `200`.
- `/js/mall/mall-ui.js`: `200`.
- `node --check` sobre scripts principales: OK.
- `vercel.json` parsea correctamente con `JSON.parse`.
- Navegador integrado:
  - `#admin-rental-content` queda oculto al inicio.
  - `#admin-rental-empty` queda visible al inicio.
  - `#admin-service-note`, inputs de tarifa y `#admin-rate-notes` conservan `width:100%`.
  - `.admin-rate-grid` usa `display:grid`.
  - Boton Guardar Tarifa usa `.admin-save-btn`.
  - `inlineHandlers=0`.

Despliegue:

- Publicado con:
  - `npx --yes vercel@48.0.0 deploy --prod --yes`.
- Production URL de despliegue:
  - `https://mall-virtual-51h2ot4oa-alanmauri4815s-projects.vercel.app`.

Verificacion publica:

- URL oficial verificada:
  - `https://mall-virtual-one-ten.vercel.app/`: `200`.
- Rutas criticas:
  - `/css/mall.css`: `200`.
  - `/js/mall/mall-boot.js`: `200`.
  - `/js/mall/mall-ui.js`: `200`.
- HTML publico:
  - `style_attrs=139`.
  - `inline_script_or_handlers=0`.
  - Contiene `id="admin-rental-panel"`.
  - Contiene `id="admin-rental-content"`.
  - Contiene `id="admin-service-note" class="admin-textarea"`.
  - Contiene `.admin-suspend-btn`.
  - Contiene `id="admin-rate-monthly" class="admin-field-input"`.
  - Contiene `.admin-save-btn`.
- CSS publico:
  - Contiene `#admin-rental-panel`.
  - Contiene `#admin-rental-content`.
  - Contiene `.admin-service-grid`.
  - Contiene `.admin-field-input`.
  - Contiene `.admin-rate-grid`.
  - Contiene `.admin-save-btn`.
- CSP publica:
  - `script-src 'self'`.
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` se mantiene temporalmente.
- Encabezados publicos verificados:
  - `Cross-Origin-Opener-Policy: same-origin`.
  - `Cross-Origin-Resource-Policy: same-origin`.
  - `Strict-Transport-Security`.
  - `X-Content-Type-Options: nosniff`.

Pendiente:

- Continuar migracion de `style="..."` por zonas hasta llegar a `0`.
- Siguiente zona recomendada:
  - Panel super admin: Arriendo Activo / Historial, pagos y notas, manteniendo intactos los IDs usados por guardado y carga.
- Cuando `style_attrs=0`, quitar `'unsafe-inline'` de `style-src` y verificar nuevamente la CSP publica.

### 2026-06-03 - Paso 25: migrar estilos inline de arriendo, pagos y notas admin

Motivo:

- Completar la limpieza de la parte comercial del panel super admin: arriendo activo, registro de pagos y observaciones del locatario.
- Mantener intactos los IDs usados por `mall-ui.js` para carga, guardado, historial y reset de formularios.
- Reducir agresivamente los estilos inline restantes antes de abordar el siguiente bloque.

Cambios:

- `css/mall.css`:
  - Agregadas reglas para:
    - `.admin-subgrid`.
    - `.admin-history-row`.
    - `.admin-history-copy`.
    - `.admin-pinned-label`.
    - `.admin-checkbox`.
- `index.html`:
  - Eliminados estilos inline de:
    - Arriendo Activo / Historial.
    - selects e inputs de arriendo.
    - observaciones de arriendo.
    - historial y boton Guardar Arriendo.
    - Registrar Pago.
    - inputs, selects y textarea de pago.
    - historial y boton Registrar Pago.
    - Observaciones del Locatario.
    - categoria, visibilidad, checkbox destacado, nota, historial y boton Guardar Observacion.
  - Se conservaron IDs y `data-mall-*` de:
    - `admin-lease-status`.
    - `admin-lease-cycle`.
    - `admin-lease-monthly-amount`.
    - `admin-lease-billing-amount`.
    - `admin-lease-discount`.
    - `admin-lease-deposit`.
    - `admin-lease-start-date`.
    - `admin-lease-end-date`.
    - `admin-lease-due-day`.
    - `admin-lease-notes`.
    - `admin-lease-history`.
    - `saveAdminLease`.
    - `admin-payment-*`.
    - `saveAdminPayment`.
    - `admin-note-category`.
    - `admin-note-visibility`.
    - `admin-note-pinned`.
    - `admin-note-text`.
    - `admin-notes-history`.
    - `saveAdminNote`.

Verificacion local:

- Conteo local de `style="..."` bajo de `139` a `68`.
- Scripts, handlers y bloques `<style>` inline se mantienen en `0`.
- `/index.html`: `200`.
- `/css/mall.css`: `200`.
- `/js/mall/mall-boot.js`: `200`.
- `/js/mall/mall-ui.js`: `200`.
- `node --check` sobre scripts principales: OK.
- `vercel.json` parsea correctamente con `JSON.parse`.
- Navegador integrado:
  - `#admin-lease-status` y `#admin-payment-status` usan `.admin-select`.
  - `#admin-lease-monthly-amount` usa `.admin-field-input`.
  - `#admin-lease-notes`, `#admin-payment-notes` y `#admin-note-text` usan `.admin-textarea`.
  - `#admin-note-pinned` usa `.admin-checkbox`.
  - Hay `3` subgrids admin.
  - `inlineHandlers=0`.

Despliegue:

- Publicado con:
  - `npx --yes vercel@48.0.0 deploy --prod --yes`.
- Production URL de despliegue:
  - `https://mall-virtual-q7zumzr2d-alanmauri4815s-projects.vercel.app`.

Verificacion publica:

- URL oficial verificada:
  - `https://mall-virtual-one-ten.vercel.app/`: `200`.
- Rutas criticas:
  - `/css/mall.css`: `200`.
  - `/js/mall/mall-boot.js`: `200`.
  - `/js/mall/mall-ui.js`: `200`.
- HTML publico:
  - `style_attrs=68`.
  - `inline_script_or_handlers=0`.
  - Contiene `id="admin-lease-status" class="admin-select"`.
  - Contiene `id="admin-lease-monthly-amount" class="admin-field-input"`.
  - Contiene `id="admin-payment-status" class="admin-select"`.
  - Contiene `id="admin-note-pinned" class="admin-checkbox"`.
  - Contiene `.admin-subgrid`.
  - Contiene `.admin-history-row`.
- CSS publico:
  - Contiene `.admin-subgrid`.
  - Contiene `.admin-history-row`.
  - Contiene `.admin-history-copy`.
  - Contiene `.admin-pinned-label`.
  - Contiene `.admin-checkbox`.
- CSP publica:
  - `script-src 'self'`.
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` se mantiene temporalmente.
- Encabezados publicos verificados:
  - `Cross-Origin-Opener-Policy: same-origin`.
  - `Cross-Origin-Resource-Policy: same-origin`.
  - `Strict-Transport-Security`.
  - `X-Content-Type-Options: nosniff`.

Pendiente:

- Continuar migracion de los `68` estilos inline restantes hasta llegar a `0`.
- Siguiente zona recomendada:
  - Modal de postulacion de locatarios (`tenant-apply-modal`) y los bloques de administracion de locatario que queden con `style="..."`.
- Cuando `style_attrs=0`, quitar `'unsafe-inline'` de `style-src` y verificar nuevamente la CSP publica.

### 2026-06-03 - Paso 26: migrar estilos inline del modal de postulacion de locatarios

Motivo:

- Reducir estilos inline en el flujo publico de postulacion comercial.
- Mantener intactos IDs y `data-mall-submit` usados por `submitTenantApplication`.
- Preparar el cierre de CSP de estilos dejando cada vez menos `style="..."`.

Cambios:

- `css/mall.css`:
  - Agregadas reglas para:
    - `#tenant-apply-modal`.
    - `.tenant-apply-title`.
    - `.tenant-apply-copy`.
    - `.tenant-apply-form`.
    - `.tenant-apply-label`.
    - `.tenant-apply-input`.
    - `.tenant-apply-grid`.
    - `.tenant-apply-submit`.
    - `.tenant-apply-close`.
- `index.html`:
  - Eliminados estilos inline del modal de postulacion comercial.
  - Eliminados estilos inline de titulo, copy, form, labels, inputs, grilla, boton submit y boton cerrar.
  - Se conservaron IDs y acciones:
    - `tenant-apply-modal`.
    - `submitTenantApplication`.
    - `apply-brand`.
    - `apply-category`.
    - `apply-email`.
    - `apply-phone`.
    - `apply-social`.
    - `toggleTenantApply`.

Verificacion local:

- Conteo local de `style="..."` bajo de `68` a `51`.
- Scripts, handlers y bloques `<style>` inline se mantienen en `0`.
- `/index.html`: `200`.
- `/css/mall.css`: `200`.
- `/js/mall/mall-boot.js`: `200`.
- `/js/mall/mall-ui.js`: `200`.
- `node --check` sobre scripts principales: OK.
- `vercel.json` parsea correctamente con `JSON.parse`.
- Navegador integrado:
  - `#tenant-apply-modal` queda oculto al inicio.
  - `.tenant-apply-form` usa `display:flex`.
  - `.tenant-apply-grid` usa `display:grid`.
  - `#apply-brand` usa `.tenant-apply-input` y conserva `width:100%`.
  - submit usa `.enter-btn.tenant-apply-submit` y conserva `width:100%`.
  - `inlineHandlers=0`.

Despliegue:

- Publicado con:
  - `npx --yes vercel@48.0.0 deploy --prod --yes`.
- Production URL de despliegue:
  - `https://mall-virtual-4ead39ikp-alanmauri4815s-projects.vercel.app`.

Verificacion publica:

- URL oficial verificada:
  - `https://mall-virtual-one-ten.vercel.app/`: `200`.
- Rutas criticas:
  - `/css/mall.css`: `200`.
  - `/js/mall/mall-boot.js`: `200`.
  - `/js/mall/mall-ui.js`: `200`.
- HTML publico:
  - `style_attrs=51`.
  - `inline_script_or_handlers=0`.
  - Contiene `id="tenant-apply-modal"`.
  - Contiene `.tenant-apply-form`.
  - Contiene `id="apply-brand" class="tenant-apply-input"`.
  - Contiene `.tenant-apply-grid`.
  - Contiene `.enter-btn tenant-apply-submit`.
  - Contiene `.tenant-apply-close`.
- CSS publico:
  - Contiene `#tenant-apply-modal`.
  - Contiene `.tenant-apply-title`.
  - Contiene `.tenant-apply-form`.
  - Contiene `.tenant-apply-input`.
  - Contiene `.tenant-apply-grid`.
  - Contiene `.tenant-apply-close`.
- CSP publica:
  - `script-src 'self'`.
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` se mantiene temporalmente.
- Encabezados publicos verificados:
  - `Cross-Origin-Opener-Policy: same-origin`.
  - `Cross-Origin-Resource-Policy: same-origin`.
  - `Strict-Transport-Security`.
  - `X-Content-Type-Options: nosniff`.

Pendiente:

- Continuar migracion de los `51` estilos inline restantes hasta llegar a `0`.
- Siguiente zona recomendada:
  - Modal de administracion de tienda de locatarios (`tenant-admin-modal`), empezando por cabecera, datos basicos y bloque Telegram.
- Cuando `style_attrs=0`, quitar `'unsafe-inline'` de `style-src` y verificar nuevamente la CSP publica.

### 2026-06-03 - Paso 27: migrar cabecera, datos basicos y Telegram del modal locatario

Motivo:

- Reducir estilos inline en el modal de administracion de tienda de locatarios.
- Empezar por un corte seguro: contenedor, cabecera, local asignado, datos basicos y bloque Telegram.
- Mantener intactos IDs y acciones usados por `mall-ui.js` y `mall-boot.js`.

Cambios:

- `css/mall.css`:
  - Agregadas reglas para:
    - `#tenant-admin-modal`.
    - `.tenant-admin-title`.
    - `.tenant-admin-close`.
    - `.tenant-store-badge-row`.
    - `#tenant-store-code-display`.
    - `.tenant-admin-grid`.
    - `.tenant-admin-label`.
    - `.tenant-admin-input`.
    - `.tenant-telegram-card`.
    - `.tenant-telegram-header`.
    - `.tenant-telegram-label`.
    - `.tenant-telegram-checkbox`.
    - `.tenant-telegram-secondary`.
    - `#edit-store-telegram-status`.
    - `.tenant-telegram-link-row`.
    - `#edit-store-telegram-link`.
    - `.tenant-telegram-primary`.
    - `.tenant-telegram-help`.
- `index.html`:
  - Eliminados estilos inline de:
    - `#tenant-admin-modal`.
    - titulo/cierre.
    - fila de local asignado.
    - grilla de datos basicos.
    - nombre comercial, giro, email y telefono.
    - bloque Telegram completo: checkbox, regenerar codigo, estado, link, boton abrir bot y ayuda.
  - Se conservaron IDs y acciones:
    - `tenant-store-code-display`.
    - `edit-store-name`.
    - `edit-store-category`.
    - `edit-store-email`.
    - `edit-store-phone`.
    - `edit-store-telegram-enabled`.
    - `refreshTenantTelegramUi`.
    - `regenerateTenantTelegramLinkCode`.
    - `edit-store-telegram-link-code`.
    - `edit-store-telegram-status`.
    - `edit-store-telegram-link`.
    - `openTenantTelegramBotLink`.

Verificacion local:

- Conteo local de `style="..."` bajo de `51` a `27`.
- Scripts, handlers y bloques `<style>` inline se mantienen en `0`.
- `/index.html`: `200`.
- `/css/mall.css`: `200`.
- `/js/mall/mall-boot.js`: `200`.
- `/js/mall/mall-ui.js`: `200`.
- `node --check` sobre scripts principales: OK.
- `vercel.json` parsea correctamente con `JSON.parse`.
- Navegador integrado:
  - `#tenant-admin-modal` queda oculto al inicio y mantiene `width:820px` en viewport desktop.
  - `.tenant-admin-title` usa `display:flex`.
  - `.tenant-admin-grid` usa `display:grid`.
  - `#edit-store-name` usa `.tenant-admin-input` y conserva `width:100%`.
  - `.tenant-telegram-card` presente.
  - `#edit-store-telegram-enabled` usa `.tenant-telegram-checkbox`.
  - `#edit-store-telegram-link` conserva `width:100%`.
  - `inlineHandlers=0`.

Despliegue:

- Publicado con:
  - `npx --yes vercel@48.0.0 deploy --prod --yes`.
- Production URL de despliegue:
  - `https://mall-virtual-nbo6bzrsv-alanmauri4815s-projects.vercel.app`.

Verificacion publica:

- URL oficial verificada:
  - `https://mall-virtual-one-ten.vercel.app/`: `200`.
- Rutas criticas:
  - `/css/mall.css`: `200`.
  - `/js/mall/mall-boot.js`: `200`.
  - `/js/mall/mall-ui.js`: `200`.
- HTML publico:
  - `style_attrs=27`.
  - `inline_script_or_handlers=0`.
  - Contiene `id="tenant-admin-modal"`.
  - Contiene `.tenant-admin-title`.
  - Contiene `.tenant-admin-grid`.
  - Contiene `id="edit-store-name" class="tenant-admin-input"`.
  - Contiene `.tenant-telegram-card`.
  - Contiene `.tenant-telegram-primary`.
- CSS publico:
  - Contiene `#tenant-admin-modal`.
  - Contiene `.tenant-admin-title`.
  - Contiene `.tenant-admin-grid`.
  - Contiene `.tenant-admin-input`.
  - Contiene `.tenant-telegram-card`.
  - Contiene `.tenant-telegram-primary`.
- CSP publica:
  - `script-src 'self'`.
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` se mantiene temporalmente.
- Encabezados publicos verificados:
  - `Cross-Origin-Opener-Policy: same-origin`.
  - `Cross-Origin-Resource-Policy: same-origin`.
  - `Strict-Transport-Security`.
  - `X-Content-Type-Options: nosniff`.

Pendiente:

- Continuar migracion de los `27` estilos inline restantes hasta llegar a `0`.
- Siguiente zona recomendada:
  - Resto de `tenant-admin-modal`: logo, shelf style, seguridad, inventario, buzon de consultas y acciones finales.
- Cuando `style_attrs=0`, quitar `'unsafe-inline'` de `style-src` y verificar nuevamente la CSP publica.

### 2026-06-03 - Paso 28: eliminar ultimos estilos inline y cerrar CSP de estilos

Motivo:

- Completar el objetivo de eliminar `style="..."` del HTML publico.
- Quitar `'unsafe-inline'` de `style-src` ahora que el HTML ya no depende de estilos inline.
- Cerrar una mejora importante de seguridad en CSP manteniendo funcionalidad.

Cambios:

- `css/mall.css`:
  - Agregadas reglas para:
    - `#super-admin-btn-persistent`.
    - `.tenant-logo-actions`.
    - `.tenant-file-hidden`.
    - `.tenant-logo-upload-btn`.
    - `.tenant-logo-status`.
    - `.tenant-security-card`.
    - `.tenant-security-label`.
    - `.tenant-security-row`.
    - `#new-tenant-pass`.
    - `.tenant-password-btn`.
    - `.tenant-section-title`.
    - `#edit-products-list`.
    - `.tenant-messages-section`.
    - `.tenant-messages-title`.
    - `#tenant-msg-count`.
    - `#tenant-messages-list`.
    - `.tenant-empty-message`.
    - `.tenant-admin-footer`.
    - `.tenant-footer-copy`.
    - `.tenant-footer-actions`.
    - `.tenant-preview-btn`.
    - `.search-title`.
    - `#location-text`.
- `index.html`:
  - Eliminado el ultimo `style` inline de `#super-admin-btn-persistent`.
  - Eliminados estilos inline restantes de `tenant-admin-modal`:
    - logo.
    - input file oculto.
    - boton subir logo.
    - estado de logo.
    - estilo de estanteria.
    - cambio de contrasena.
    - inventario.
    - buzon de consultas.
    - acciones finales.
  - Eliminados estilos inline restantes de `search-modal`:
    - titulo del concierge.
    - `#location-text`.
- `vercel.json`:
  - `style-src` cambio de:
    - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
  - a:
    - `style-src 'self' https://fonts.googleapis.com`

Verificacion local:

- Conteo local de `style="..."` bajo de `27` a `0`.
- Scripts, handlers y bloques `<style>` inline se mantienen en `0`.
- Verificacion agregada:
  - `inline_total=0` para `style=`, handlers inline, scripts inline y bloques `<style>`.
- `/index.html`: `200`.
- `/css/mall.css`: `200`.
- `/js/mall/mall-boot.js`: `200`.
- `/js/mall/mall-ui.js`: `200`.
- `/js/mall/mall-stores.js`: `200`.
- `node --check` sobre scripts principales: OK.
- `vercel.json` parsea correctamente con `JSON.parse`.
- Navegador integrado:
  - `#super-admin-btn-persistent` queda oculto por CSS.
  - `#edit-store-logo` usa `.tenant-admin-input` y conserva `width:100%`.
  - `#edit-products-list` usa `display:grid`.
  - `.search-title` usa `display:flex`.
  - `styleBlocks=0`.
  - `inlineHandlers=0`.
  - Observacion: el DOM runtime puede mostrar estilos dinamicos agregados por JS tras cargar la app, pero el HTML fuente y la CSP ya no dependen de estilos inline.

Despliegue:

- Publicado con:
  - `npx --yes vercel@48.0.0 deploy --prod --yes`.
- Production URL de despliegue:
  - `https://mall-virtual-l9ioxqrna-alanmauri4815s-projects.vercel.app`.

Verificacion publica:

- URL oficial verificada:
  - `https://mall-virtual-one-ten.vercel.app/`: `200`.
- Rutas criticas:
  - `/css/mall.css`: `200`.
  - `/js/mall/mall-boot.js`: `200`.
  - `/js/mall/mall-ui.js`: `200`.
  - `/js/mall/mall-stores.js`: `200`.
- HTML publico:
  - `style_attrs=0`.
  - `inline_script_or_handlers=0`.
  - Contiene `id="super-admin-btn-persistent"`.
  - Contiene `id="edit-store-logo" class="tenant-admin-input"`.
  - Contiene `id="edit-products-list"`.
  - Contiene `id="tenant-messages-list"`.
  - Contiene `.search-title`.
  - Contiene `id="location-text"`.
- CSS publico:
  - Contiene `#super-admin-btn-persistent`.
  - Contiene `.tenant-logo-actions`.
  - Contiene `.tenant-security-card`.
  - Contiene `#edit-products-list`.
  - Contiene `#tenant-messages-list`.
  - Contiene `.search-title`.
  - Contiene `#location-text`.
- CSP publica:
  - `script-src 'self'`.
  - `style-src 'self' https://fonts.googleapis.com`.
  - Confirmado: `style-src` ya no contiene `'unsafe-inline'`.
- Encabezados publicos verificados:
  - `Cross-Origin-Opener-Policy: same-origin`.
  - `Cross-Origin-Resource-Policy: same-origin`.
  - `Strict-Transport-Security`.
  - `X-Content-Type-Options: nosniff`.

Pendiente:

- Continuar auditoria general fuera de CSP inline:
  - Revisar estilos dinamicos generados por JavaScript y reducirlos si conviene.
  - Revisar seguridad de SQL/RLS y aplicar scripts pendientes en Supabase.
  - Revisar flujo Telegram externo pendiente de variables/webhook.
  - Revisar accesibilidad y pruebas funcionales de panel locatario/admin.

## Paso 29 - Auditoria Supabase/RLS inicial y script incremental

Fecha: 2026-06-03

Objetivo:

- Continuar la auditoria en el orden acordado, comenzando por Supabase/RLS.
- Revisar que las tablas comerciales sensibles tengan RLS y que los permisos SQL no contradigan las politicas.
- Preparar un script incremental aplicable en Supabase sin tocar datos de negocio.

Archivos revisados:

- `supabase/mall_access_schema.sql`.
- `supabase/admin_enable_current_schema.sql`.
- `supabase/admin_login_hardening_20260530.sql`.
- `supabase/store_assets_owner_only_hardening_20260530.sql`.
- `supabase/store_assets_storage.sql`.
- `supabase/store_products_local_code_fix.sql`.
- `supabase/admin_delete_accounts.sql`.
- `supabase/mall_current_setup.sql`.
- `js/mall/mall-ui.js`.
- `js/mall/mall-stores.js`.
- `js/mall/mall-main.js`.
- `js/mall/mall-npc.js`.

Hallazgos:

- Las tablas principales tienen RLS habilitado en el setup consolidado.
- `store_assets_storage.sql` deja el bucket `store-assets` publico para lectura y limita insert/update/delete a propietario del local o admin.
- `store_assets_owner_only_hardening_20260530.sql` elimina dependencia de `contact_email` para escribir assets y usa `owner_id = auth.uid()` o `public.is_mall_admin()`.
- `tenant_leases`, `tenant_payments`, `tenant_notes` y `store_rent_rates` tienen politicas RLS razonables: admin gestiona, locatario lee lo propio.
- El frontend usa `upsert`/`insert`/`update` en `store_rent_rates`, `tenant_leases`, `tenant_payments` y `tenant_notes`, pero el setup consolidado solo concedia `select` a `authenticated` sobre esas tablas. Eso puede bloquear funciones admin aunque RLS permita la operacion.
- Las funciones `resolve_member_login_email(text)` y `resolve_tenant_login_email(text)` seguian concedidas a `authenticated`. Como el frontend actual ya usa email directo, mantenerlas ejecutables puede permitir enumeracion de correos por alias/marca/local entre usuarios autenticados.
- `delete_mall_account(uuid,text)` es `security definer`, pero valida `public.is_mall_admin()` antes de operar y tiene `search_path` definido. Se mantiene disponible para `authenticated` porque el frontend la usa desde el panel admin.

Cambio preparado:

- Nuevo archivo:
  - `supabase/rls_security_hardening_20260603.sql`.

Contenido del script:

- Revoca ejecucion de `resolve_member_login_email(text)` y `resolve_tenant_login_email(text)` para `public`, `anon` y `authenticated`, si existen.
- Reafirma RLS en tablas sensibles.
- Concede `select`, `insert` y `update` a `authenticated` en:
  - `store_rent_rates`.
  - `tenant_leases`.
  - `tenant_payments`.
  - `tenant_notes`.
- Mantiene `delete_mall_account(uuid,text)` sin acceso anonimo y ejecutable por `authenticated`, con control interno de admin.
- Incluye consultas de verificacion para revisar privilegios despues de aplicar.

Pendiente:

- Aplicar `supabase/rls_security_hardening_20260603.sql` en el SQL Editor de Supabase.
- Ejecutar las consultas de verificacion incluidas al final del archivo.
- Probar desde la app:
  - login admin.
  - guardar tarifa.
  - guardar arriendo.
  - registrar pago.
  - guardar nota.
  - eliminar cuenta no administradora.
- Continuar luego con etapa Telegram.

## Paso 30 - Confirmacion de aplicacion RLS en Supabase

Fecha: 2026-06-03

Resultado:

- El usuario confirmo que `supabase/rls_security_hardening_20260603.sql` fue ejecutado con exito en Supabase.

Pendiente de verificacion funcional:

- Login admin.
- Guardar tarifa.
- Guardar arriendo.
- Registrar pago.
- Guardar nota.
- Eliminar cuenta no administradora.

## Paso 31 - Telegram: webhook seguro para mensajes

Fecha: 2026-06-03

Objetivo:

- Continuar con la etapa Telegram/backend seguro.
- Evitar exponer `MALL_INTERNAL_NOTIFY_SECRET` en JavaScript del navegador.
- Permitir que Supabase dispare las notificaciones a Telegram desde un Database Webhook o trigger controlado.

Archivos modificados:

- `supabase/functions/telegram-bot/index.ts`.
- `supabase/telegram_message_webhook_20260603.sql`.
- `SUPABASE_SETUP.md`.

Cambios:

- `telegram-bot` ahora acepta payloads de Database Webhook para inserts en:
  - `mall_messages`.
  - `contact_messages`.
- Antes de notificar, la Function exige `x-mall-notify-secret` y lo compara contra `MALL_INTERNAL_NOTIFY_SECRET`.
- Se reutilizo la validacion de secreto tambien para `action: notify_message`.
- Se normalizan payloads de:
  - `mall_messages`: `sender_name`, `sender_email`, `message`, `store_id`, `local_code`.
  - `contact_messages`: `name`, `email`, `requirement`, `store_id`.
- Se agrego plantilla `supabase/telegram_message_webhook_20260603.sql` para crear triggers hacia la Edge Function sin guardar secretos reales.
- Se actualizo `SUPABASE_SETUP.md` con la configuracion recomendada de Database Webhooks.

Verificacion local:

- `npx --yes prettier@3.3.3 --write supabase/functions/telegram-bot/index.ts`: OK.

Pendiente:

- Configurar secretos de la Edge Function:
  - `TELEGRAM_BOT_TOKEN`.
  - `TELEGRAM_WEBHOOK_SECRET`.
  - `MALL_INTERNAL_NOTIFY_SECRET`.
  - `MALL_ALLOWED_ORIGIN=https://mall-virtual-one-ten.vercel.app`.
- Desplegar Edge Function:
  - `supabase functions deploy telegram-bot --no-verify-jwt`.
- Configurar webhook de Telegram con `secret_token`.
- Configurar Database Webhook/trigger para inserts en `mall_messages` y opcionalmente `contact_messages`.
- Probar el flujo real con un local conectado a Telegram.

Actualizacion:

- El usuario configuro los secretos en Supabase Dashboard.
- El token de Telegram fue rotado despues de quedar visible en captura.
- La Edge Function `telegram-bot` fue actualizada manualmente desde la pestaña `Code` del Dashboard y desplegada con `Deploy updates` sin errores.

Siguiente paso:

- Configurar webhook de Telegram hacia `https://kcfuixvrwbnizspgtmtr.supabase.co/functions/v1/telegram-bot` usando `TELEGRAM_WEBHOOK_SECRET` como `secret_token`.

Actualizacion 2:

- El webhook de Telegram fue configurado desde PowerShell.
- Verificacion reportada por el usuario:
  - `ok: True`.
  - URL configurada: `https://kcfuixvrwbnizspgtmtr.supabase.co/functions/v1/telegram-bot`.

Siguiente paso:

- Crear Database Webhook en Supabase para `public.mall_messages` / `INSERT`.

Actualizacion 3:

- Database Webhooks fue habilitado en Supabase.
- Se creo el webhook `notify_telegram_mall_messages` para:
  - tabla `public.mall_messages`.
  - evento `INSERT`.
  - metodo `POST`.
  - URL `https://kcfuixvrwbnizspgtmtr.supabase.co/functions/v1/telegram-bot`.
  - header `Content-Type: application/json`.
  - header `x-mall-notify-secret` con el valor de `MALL_INTERNAL_NOTIFY_SECRET`.

Pendiente:

- Probar flujo real enviando un mensaje desde la tienda/local.
- Revisar invocaciones/logs de `telegram-bot`.
- Si se necesita compatibilidad con fallback antiguo, crear otro webhook para `public.contact_messages` / `INSERT`.

Actualizacion 4:

- El locatario conecto Telegram para el local `SE-10 - AM Store`.
- Respuesta recibida del bot:
  - Telegram conectado correctamente al local SE-10 - AM Store.
- Esto confirma:
  - webhook de Telegram activo.
  - `TELEGRAM_WEBHOOK_SECRET` aceptado.
  - Edge Function ejecutando la logica nueva.
  - escritura de `telegram_chat_id`, `telegram_chat_username`, `telegram_verified_at` y estado de notificaciones en `stores`.

Siguiente prueba:

- Enviar mensaje de visitante al local y confirmar notificacion automatica por Database Webhook.

## Paso 32 - Reparacion de textos mojibake en codigo fuente activo

Fecha: 2026-06-03

Objetivo:

- Corregir letras y simbolos ilegibles por mojibake en la interfaz y archivos fuente activos.
- Ejemplos detectados:
  - `CONFIGURACIÃ“N`.
  - `ContraseÃ±a`.
  - `catÃ¡logo`.
  - `BÃšSQUEDA`.
  - `â–¾`.

Archivos tratados:

- `index.html`.
- `css/mall.css`.
- `js/mall/*.js`.

Cambios:

- Reparados acentos y eñes dañados:
  - á, é, í, ó, ú.
  - Á, É, Í, Ó, Ú.
  - ñ, Ñ.
- Reparados simbolos:
  - `°`.
  - `·`.
  - `▴` y `▾`.
  - `↑` y `↓`.
  - `×`.
  - `…`.
  - `±`.
- Corregidos textos visibles del panel de local, modales, busqueda, postulacion, gestion comercial, controles moviles y comentarios fuente activos.

Verificacion:

- Busqueda de patrones dañados en archivos relevantes:
  - `rg -n "Ã|Â|â|�|├" index.html css js/mall SUPABASE_SETUP.md SECURITY_REMEDIATION_LOG.md supabase --glob '!*.backup-*'`: sin resultados.
- Validacion de sintaxis:
  - `node --check js/mall/mall-ui.js`: OK.
  - `node --check js/mall/mall-constants.js`: OK.
  - `node --check js/mall/mall-world.js`: OK.
  - `node --check js/mall/mall-navigation.js`: OK.
- Verificacion en navegador local:
  - URL: `http://127.0.0.1:8080/index.html`.
  - DOM sin patrones `Ã`, `Â`, `â`, `�`, `├`.
  - Muestras correctas:
    - `Mall Emprendimientos PRO - REPARACIÓN TOTAL`.
    - `CONFIGURACIÓN DEL LOCAL ×`.
    - `Los visitantes pueden revisar catálogo, productos, precios e imágenes disponibles de este local.`
    - `Busca tienda, producto o categoría...`.
    - `▾`.

Pendiente:

- Desplegar a Vercel para que la correccion visual quede publicada.

Actualizacion:

- Desplegado a produccion con:
  - `npx --yes vercel@48.0.0 deploy --prod --yes`.
- URL de despliegue:
  - `https://mall-virtual-nuzxla3yh-alanmauri4815s-projects.vercel.app`.
- Verificacion publica en URL oficial:
  - `https://mall-virtual-one-ten.vercel.app/`: OK.
  - HTML publico:
    - patrones dañados `Ã|Â|â|�|├`: `0`.
    - contiene `CONFIGURACIÓN DEL LOCAL`.
    - contiene `catálogo`.
    - contiene `categoría`.
    - contiene `REPARACIÓN TOTAL`.
  - CSS publico:
    - patrones dañados `Ã|Â|â|�|├`: `0`.
    - contiene `BÚSQUEDA`.
  - `js/mall/mall-ui.js` publico:
    - patrones dañados `Ã|Â|â|�|├`: `0`.
    - contiene `×`.
    - contiene `…`.

## Paso 33 - Unificar panel locatario y restaurar acceso admin para AM Store

Fecha: 2026-06-03

Objetivo:

- Evitar duplicidad en el menu de controles:
  - `Panel Locatario`.
  - `Gestionar mi local`.
- Mantener una sola entrada visible: `Panel Locatario`.
- Restaurar controles de administrador para la cuenta principal del mall y AM Store.

Cambios:

- `index.html`:
  - La entrada `Acceso Locatarios` del menu pasa a llamarse `Panel Locatario`.
  - Se elimina la entrada duplicada `Gestionar mi local`.
  - Se conserva `Panel administrador` como acceso separado para administradores.
- `js/mall/mall-ui.js`:
  - `userHasAdminAccess()` reconoce explicitamente `alanmauri4815@gmail.com` como correo admin ademas del rol `admin`.
  - Al restaurar una sesion Supabase activa al cargar la pagina, ya no se borra `currentTenantUser`; ahora se mantiene la sesion privilegiada, se carga perfil y se refrescan locales propios.
  - El texto del boton locatario queda siempre como `Panel Locatario`.
- `js/mall/mall-stores.js`:
  - Si la cuenta admin no encuentra local por `owner_id` o `contact_email`, intenta recuperar AM Store por `local_code = SE-10` y luego por `name = AM Store`.

Verificacion local:

- `node --check js/mall/mall-ui.js`: OK.
- `node --check js/mall/mall-stores.js`: OK.
- Navegador local:
  - Menú contiene exactamente un `Panel Locatario`.
  - Menú ya no contiene `Gestionar mi local`.
  - `Panel administrador` existe y queda oculto cuando no hay sesion admin activa.

Despliegue:

- Publicado con:
  - `npx --yes vercel@48.0.0 deploy --prod --yes`.
- Production URL de despliegue:
  - `https://mall-virtual-8br5u9lkm-alanmauri4815s-projects.vercel.app`.

Verificacion publica:

- URL oficial:
  - `https://mall-virtual-one-ten.vercel.app/`.
- HTML publico:
  - contiene `Panel Locatario`.
  - no contiene `Gestionar mi local`.
- `js/mall/mall-ui.js` publico:
  - contiene override admin para `alanmauri4815@gmail.com`.
  - contiene `innerText = 'Panel Locatario'`.
  - patrones dañados `Ã|Â|â|�|├`: `0`.
- `js/mall/mall-stores.js` publico:
  - contiene fallback para `AM Store`.

## Paso 34 - Cancelar/archivar postulaciones sin borrar Supabase

Fecha: 2026-06-03

Objetivo:

- Permitir ocultar postulantes del panel admin sin eliminarlos fisicamente de Supabase.
- Evitar que solicitudes rechazadas/canceladas llenen la lista de postulaciones pendientes.

Cambios:

- `index.html`:
  - Reemplazado boton `Eliminar Cuenta` por `Cancelar Postulación`.
  - Nuevo `data-mall-action="cancelSelectedTenantApplication"`.
  - Texto de ayuda actualizado: cancelar oculta la postulacion sin borrarla de Supabase.
- `js/mall/mall-ui.js`:
  - Nueva funcion `cancelTenantApplication(appId)`.
  - Nueva funcion `cancelSelectedTenantApplication()`.
  - Actualiza `tenant_applications.status` a `cancelled`.
  - `loadAdminData()` filtra de la lista principal:
    - `cancelled`.
    - `canceled`.
    - `rejected`.
  - `adminApplicationsCache` ahora contiene solo postulaciones visibles para revision.
- `js/mall/mall-boot.js`:
  - Enrutada accion `cancelSelectedTenantApplication`.

Verificacion:

- `node --check js/mall/mall-ui.js`: OK.
- `node --check js/mall/mall-boot.js`: OK.
- Fuente local:
  - contiene `Cancelar Postulación`.
  - no contiene boton `Eliminar Cuenta`.
  - sin patrones dañados `Ã|Â|â|�|├`.

Despliegue:

- Publicado con:
  - `npx --yes vercel@48.0.0 deploy --prod --yes`.
- Production URL de despliegue:
  - `https://mall-virtual-ohyc5fjfc-alanmauri4815s-projects.vercel.app`.

Verificacion publica:

- URL oficial:
  - `https://mall-virtual-one-ten.vercel.app/`.
- HTML publico:
  - contiene `data-mall-action="cancelSelectedTenantApplication"`.
  - no contiene `Eliminar Cuenta`.
- `js/mall/mall-ui.js` publico:
  - contiene `status: 'cancelled'`.
  - filtra `cancelled`, `canceled` y `rejected`.
  - contiene `window.cancelSelectedTenantApplication`.
  - patrones dañados `Ã|Â|â|�|├`: `0`.
- `js/mall/mall-boot.js` publico:
  - contiene accion `cancelSelectedTenantApplication`.

## Paso 35 - Respaldo completo del proyecto

Fecha: 2026-06-03

Objetivo:

- Crear un respaldo completo del proyecto antes de continuar con nuevas mejoras.
- Guardar el backup fuera de la carpeta del proyecto para evitar incluir el ZIP dentro de si mismo.

Resultado:

- ZIP creado:
  - `C:\Users\javii\Downloads\Web_Tienda_Virtual_backup_20260603_220844.zip`.
- Manifest creado:
  - `C:\Users\javii\Downloads\Web_Tienda_Virtual_backup_20260603_220844.manifest.txt`.

Contenido:

- Incluye carpeta completa `Web Tienda Virtual`.
- Incluye archivos ocultos y carpetas de configuracion:
  - `.git`.
  - `.vercel`.
  - `.env.local`.
- Incluye codigo fuente, assets, SQL Supabase, respaldos locales y logs de remediacion.

Verificacion:

- ZIP legible con `tar -tf`.
- Entradas listadas en ZIP:
  - `3318`.
- Tamaño ZIP:
  - `159.82 MB`.
- SHA256 ZIP:
  - `51A1AD7B8BCFA91DBB71C9BBCFFCCF4AF609A62E390BBCFB9DC66881FA798D24`.
- Manifest:
  - `3317` lineas.
  - `282.09 KB`.
- SHA256 manifest:
  - `25DAE447D5E4AAB8F85965E5B15B152FBA369A163B813598E20E102A3FA19B45`.

## Paso 36 - Reserva de local para postulantes sin cuenta creada

Fecha: 2026-06-04

Problema:

- Al intentar aprobar/asignar una postulante que envio formulario pero aun no creo cuenta Auth, el panel mostraba:
  - `Ese correo todavía no tiene cuenta creada. Debe registrarse primero.`
- Causa:
  - `stores.owner_id` referencia `auth.users.id`.
  - Sin usuario Auth no existe UUID para asignar propiedad definitiva.

Solucion implementada:

- Se agrega flujo de reserva sin borrar ni forzar creacion de cuenta:
  - Si la postulante no tiene cuenta, `Aprobar y Asignar` reserva los locales seleccionados.
  - La reserva actualiza `stores` con:
    - `contact_email = app.email`.
    - `contact_phone = app.phone`.
    - `whatsapp = app.phone`.
    - `category = app.category`.
    - `name = app.brand_name`.
    - `service_status = 'reserved'`.
    - `service_status_note = 'Reserva creada desde postulación pendiente de cuenta.'`.
  - La postulacion queda `status = 'approved'`.
  - No se escribe `owner_id` hasta que exista cuenta Auth.
- La lista de disponibles excluye locales reservados por otro correo.
- Para la misma postulante, los locales reservados por su correo siguen disponibles/visibles para editar la reserva.
- El indicador del panel ahora explica:
  - puede reservar locales ahora;
  - se vinculan cuando la postulante cree cuenta.

Archivos modificados:

- `js/mall/mall-ui.js`.

Verificacion:

- `node --check js/mall/mall-ui.js`: OK.
- Produccion:
  - `https://mall-virtual-one-ten.vercel.app/js/mall/mall-ui.js`.
  - contiene mensaje `Puedes reservar locales ahora`.
  - contiene `service_status: 'reserved'`.
  - contiene filtro `reservedByOther`.
  - ya no contiene el bloqueo `Debe registrarse primero`.
  - patrones dañados `Ã|Â|â|�|├`: `0`.

Despliegue:

- Publicado con:
  - `npx --yes vercel@48.0.0 deploy --prod --yes`.
- Production URL de despliegue:
  - `https://mall-virtual-4l2u6xqnv-alanmauri4815s-projects.vercel.app`.

## Paso 37 - 2026-06-29 - Capacidad de cat�logo por tipo y descripciones
- Se agreg� capacidad din�mica de productos por tipo T0-T5: T0/T1=10, T2=12, T3=15, T4=20, T5=50.
- El panel locatario ahora genera los campos de productos seg�n la capacidad del local.
- Se agreg� campo de descripci�n por producto con m�ximo de 500 caracteres.
- La vista p�blica del cat�logo permite abrir una ficha ampliada al pinchar producto o foto, mostrando imagen, precio y descripci�n.
- Se cre� `supabase/product_catalog_capacity_20260629.sql` para agregar columnas, constraints e inicializar tarifas/capacidades seg�n tabla oficial.
- Se actualiz� `supabase/mall_current_setup.sql` para que el esquema base incluya las nuevas columnas.
