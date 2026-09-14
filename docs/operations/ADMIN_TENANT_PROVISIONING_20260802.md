# Alta segura de locatarios desde el Panel de Control Maestro

Fecha: 2026-08-02

## Objetivo

Permitir que el unico administrador cree o vincule accesos de locatarios sin abrir la interfaz visual de Supabase Authentication y sin almacenar contrasenas en tablas publicas.

## Arquitectura

1. El administrador selecciona una postulacion en el Panel de Control Maestro.
2. El frontend genera una clave temporal criptograficamente aleatoria.
3. El frontend invoca la Edge Function `admin-create-tenant` con la sesion activa.
4. La funcion valida el JWT con Supabase Auth.
5. La funcion exige que el UID figure en `public.admin_members`.
6. Solo entonces usa `SUPABASE_SERVICE_ROLE_KEY`, disponible unicamente dentro de Supabase, para crear o vincular el usuario.
7. La funcion actualiza `user_profiles`, la postulacion y los locales reservados para el mismo correo.
8. El locatario inicia sesion con su correo y clave temporal; las politicas RLS siguen usando `auth.uid()`.

## Archivos

- `index.html`
- `css/mall.css`
- `js/mall/mall-ui.js`
- `js/mall/mall-boot.js`
- `supabase/functions/admin-create-tenant/index.ts`

## Despliegue Supabase

- Funcion: `admin-create-tenant`
- URL: `https://kcfuixvrwbnizspgtmtr.supabase.co/functions/v1/admin-create-tenant`
- La opcion `Verify JWT with legacy secret` esta desactivada.
- La funcion valida el token actual mediante `auth.getUser` y luego consulta `admin_members`.

## Controles de seguridad verificados

- Solicitud anonima desde produccion: HTTP 401.
- Token invalido desde produccion: HTTP 401.
- Origen no autorizado: HTTP 403.
- Preflight desde produccion: HTTP 204 y origen CORS correcto.
- La Service Role no aparece en el frontend.
- Una cuenta existente solo cambia su clave despues de confirmacion explicita.
- No se creo ningun usuario real durante las pruebas.

## Uso operativo

1. Entrar al mall con la cuenta administradora.
2. Abrir `Panel administrador`.
3. Seleccionar una postulacion y pulsar `Revisar`.
4. Revisar el correo y nombre en `Acceso del locatario`.
5. Pulsar `Generar` para crear otra clave si es necesario.
6. Pulsar `Copiar` y guardar temporalmente la clave para entregarla al locatario.
7. Pulsar `Crear acceso`.
8. Aprobar y asignar uno o mas locales desde el mismo formulario.

El frontend de esta mejora debe desplegarse en Vercel antes de usar el nuevo bloque en produccion. La Edge Function ya esta publicada.
