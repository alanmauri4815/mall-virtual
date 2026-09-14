# Entorno de pruebas Supabase

## Regla de seguridad

No ejecutar pruebas de escritura, autenticacion ni RLS contra el proyecto productivo. El
entorno de ensayo debe tener una URL y claves distintas, datos descartables y ningun webhook
externo real.

## Estado actual

- Las cuatro Edge Functions compilan con Deno 2.9.5.
- Cada funcion fija `@supabase/supabase-js` 2.112.2 en su propio `deno.json` y `deno.lock`.
- Las pruebas HTTP locales validan CORS, metodos y solicitudes sin autenticacion.
- La maquina no tiene Docker, PostgreSQL ni credenciales `SUPABASE_TEST_*`.

## Variables reservadas para ensayo

Configurar solamente en `.env.test.local`, que debe permanecer fuera de Git:

```text
SUPABASE_TEST_URL=
SUPABASE_TEST_ANON_KEY=
SUPABASE_TEST_SERVICE_ROLE_KEY=
SUPABASE_TEST_DATABASE_URL=
```

## Matriz RLS obligatoria

1. Anonimo no puede leer perfiles, administradores, postulaciones privadas ni mensajes.
2. Anonimo solo puede leer el catalogo publico y enviar una postulacion pendiente.
3. Locatario puede leer y actualizar exclusivamente sus locales y productos.
4. Locatario no puede cambiar `owner_id`, acceder a otro local ni usar funciones de administrador.
5. Administrador registrado en `admin_members` puede gestionar locales y postulaciones.
6. Subidas de Storage quedan limitadas al propietario del local o al administrador.
7. La baja de un usuario no debe eliminar accidentalmente locales, catalogos ni auditorias.

## Caminos habilitantes

- Local: instalar Docker Desktop y Supabase CLI, ejecutar `supabase start` y cargar el esquema.
- Remoto: crear un proyecto Supabase separado y cargar las variables anteriores.

Antes de cualquiera de los dos caminos se debe crear un respaldo `PRE_TEST_DB`. Los datos de
ensayo deben usar correos reservados y nunca tokens, chats de Telegram o servicios de correo
reales.
