# Asistentes virtuales de tiendas y del mall

La plataforma usa una sola Edge Function de Supabase, `store-attendant`, para dos contextos:

- asistentes de cada local, con sus productos, datos de contacto, induccion y FAQ;
- el asistente del meson principal, con la induccion general y FAQ configuradas por la administracion.

Ambos contextos usan la API de Responses de OpenAI desde el servidor. La clave de OpenAI nunca se expone al navegador.

## 1. Crear las tablas y permisos

En Supabase, abre **SQL Editor** y ejecuta completamente, en este orden:

1. `supabase/store_attendant_bot_20260804.sql`
2. `supabase/mall_information_assistant_20260830.sql`

La primera migracion crea la configuracion, sesiones, cache, limites de uso y contactos de los asistentes de tiendas. La segunda crea la configuracion del asistente del mall, sus sesiones, cache, limites de uso, estadisticas y el formulario de reclamos y sugerencias.

La configuracion del mall es publica para que el visitante pueda leer el saludo, las FAQ y la induccion. Los cambios y los reclamos quedan protegidos por RLS y solo pueden administrarse con una sesion autorizada como administrador.

## 2. Crear la clave de OpenAI

1. Crea o usa una cuenta de API en OpenAI Platform.
2. Activa facturacion con un limite mensual bajo.
3. Crea una API key para este proyecto.
4. No pegues la clave en `index.html`, JavaScript del navegador ni Git.

## 3. Guardar secretos en Supabase

Desde una terminal autenticada con Supabase CLI:

```powershell
supabase secrets set OPENAI_API_KEY="tu-clave"
```

El correo automatico de los asistentes de tienda es opcional. Si se usa Resend:

```powershell
supabase secrets set RESEND_API_KEY="tu-clave-resend" BOT_FROM_EMAIL="Mall Creaciones <asistente@tu-dominio.cl>"
```

El asistente del mall no envia consultas a locatarios: guarda los reclamos y sugerencias en `mall_feedback` para que la administracion los revise.

## 4. Publicar la funcion segura

Cada vez que se modifica `supabase/functions/store-attendant/index.ts`, vuelve a publicar la funcion:

```powershell
supabase functions deploy store-attendant
```

La funcion distingue el contexto con `scope: "mall"` y `action: "mall_message"`. Para una tienda usa `store_code` y valida su configuracion y propietario. Para el mall lee la fila unica de `mall_assistant_settings`.

La funcion usa `gpt-4o-mini`, limita preguntas a la longitud configurada, respuestas al numero de palabras configurado, cuatro interacciones por defecto por sesion, 30 consultas por hora y cinco solicitudes de contacto por hora y cliente. La informacion de contacto del visitante no se envia a OpenAI.

Si `OPENAI_API_KEY` no esta configurada, la interfaz sigue funcionando con respuestas directas de las FAQ y muestra un mensaje de derivacion cuando no encuentra informacion. Para respuestas generativas, la clave y la funcion publicada deben estar disponibles en Supabase.

## 5. Configurar el asistente del mall

En el panel de administrador abre la pestaña **Asistente del Mall** y configura:

- habilitado o deshabilitado;
- nombre y saludo;
- induccion general del mall;
- preguntas frecuentes y sus respuestas;
- limites de preguntas, respuestas y turnos.

El asistente se abre desde el personaje del meson de informaciones. La pantalla de conversacion usa el mismo flujo de sesion, historial, cache, limites, respuesta directa y llamada a OpenAI que un asistente de local.

El formulario **Reclamos y sugerencias** usa la funcion SQL `submit_mall_feedback`, valida consentimiento y guarda los registros para revision administrativa.

## 6. Probar localmente

Inicia un servidor estatico en la raiz del proyecto:

```powershell
python -m http.server 5500
```

Luego abre `http://127.0.0.1:5500/index.html`.

Para probar el asistente del mall, selecciona el meson de informaciones y abre la ficha de Mauricio. Para probar la administracion, entra con una cuenta administradora y abre la pestaña **Asistente del Mall**.

Las pruebas automatizadas disponibles son:

```powershell
npm test
npm run test:edge
npm run test:browser
```
