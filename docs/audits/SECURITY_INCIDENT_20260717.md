# Incidente de seguridad y remediacion - 2026-07-17

## Hallazgos confirmados

Las pruebas contra la API de produccion, usando solamente la clave publica, confirmaron que:

- Un visitante anonimo podia leer registros de `tenant_applications`.
- Un visitante anonimo podia actualizar filas de `stores`.
- Un visitante anonimo podia actualizar filas de `store_products`.
- `user_profiles` no devolvio filas anonimas en la prueba.
- Las tablas de mensajes, contratos y pagos probadas no quedaron expuestas por REST anonimo.

## Endurecimiento aplicado al frontend

- La autoridad de administrador ya no depende de correos ni de `user_profiles.role` en el navegador.
- Cada apertura del panel valida la sesion con `auth.getUser()` y confirma al administrador mediante `is_mall_admin()`.
- El panel locatario y cada guardado vuelven a comprobar que el local pertenece al usuario autenticado.
- Un perfil manipulado con `role = admin` no concede acceso al panel maestro.
- Las cargas de imagen verifican nuevamente la propiedad del local.

Archivos modificados:

- `js/mall/mall-ui.js`.
- `js/mall/mall-stores.js`.
- `index.html` (version de cache `20260717-access-hardening`).

## Migraciones creadas

- `supabase/emergency_core_access_lockdown_20260717.sql`: cierre inmediato de las tablas principales y `store-assets`.
- `supabase/access_control_hardening_20260717.sql`: segunda etapa para tablas complementarias.

## Verificacion local

- `node --check js/mall/mall-ui.js`: OK.
- `node --check js/mall/mall-stores.js`: OK.
- Prueba automatizada: anonimo sin paneles; locatario solo en local propio; perfil admin falsificado rechazado; administrador autorizado aceptado.
- `git diff --check`: OK.

## Estado pendiente critico

- La migracion `supabase/emergency_core_access_lockdown_20260717.sql` fue ejecutada el 2026-07-17.
- Verificacion REST posterior contra produccion:
  - lectura anonima de `tenant_applications`: `401`.
  - escritura anonima en `stores`: `401`.
  - escritura anonima en `store_products`: `401`.
  - llamada anonima a `is_mall_admin()`: `401`.
- Las lecturas publicas de `stores` y `store_products` continuaron funcionando.
- El acceso anonimo critico confirmado queda cerrado.
- Pendiente: prueba funcional autenticada con una cuenta de locatario para confirmar el aislamiento entre locales en produccion.

## Mejora de ingreso - 2026-07-17

- Se detecto que el ingreso esperaba autenticacion, verificacion administrativa, perfil y locales en serie.
- Mediciones de produccion: autenticacion aproximada de 3,2 segundos y lectura REST aproximada de 1,7 segundos.
- La entrada ahora espera solamente la autenticacion; permisos, perfil y locales cargan en paralelo sin bloquear el mall.
- La interfaz informa inmediatamente `Verificando credenciales...` y bloquea dobles clics durante el proceso.
- Se elimino una llamada duplicada a `auth.getUser()` cuando la sesion ya habia sido verificada.
- Se agregaron limites de 15 segundos para autenticacion y 8 segundos para cada carga posterior.
- Los permisos iniciales siguen siendo minimos y el rol administrador solo se activa tras respuesta positiva de `is_mall_admin()`.

## Continuidad de autoridad administrativa - 2026-07-17

- Se confirmo que `OBJECT_INSPECTOR_ENABLED` permanece activo.
- La autoridad administrativa sigue dependiendo exclusivamente de `admin_members` y `is_mall_admin()`.
- Se elimino el timeout que podia descartar visualmente una respuesta administrativa tardia.
- Cuando Supabase confirma al administrador, se reaplican los controles y se cargan todos los locales.
- La apertura del Panel administrador vuelve a validar la sesion y la autoridad en Supabase.
- Version publicada: `20260717-admin-authority`.

## Restauracion de catalogos y Storage - 2026-07-17

- Se confirmo un rechazo RLS al subir productos al bucket `store-assets`.
- El local de prueba `O-101` mantiene propietario Auth valido y carpeta coherente.
- Causa: la politica de Storage evaluaba directamente una consulta cruzada a `stores`, que podia ser rechazada dentro del contexto de Storage.
- Se creo `supabase/fix_tenant_catalog_permissions_20260717.sql`.
- La migracion usa funciones `security definer` restringidas a `authenticated` para comprobar:
  - administrador confirmado por `is_mall_admin()`; o
  - propietario Auth del local exacto indicado por `id` y `local_code`.
- Se reconstruyen las politicas de imagenes y productos sin otorgar escrituras a `anon`.
- La migracion fue ejecutada en Supabase el 2026-07-17.
- Verificacion externa posterior con credenciales publicas:
  - lectura publica de `store_products`: `200`.
  - lectura publica de una imagen en `store-assets`: `200`.
  - insercion anonima en `store_products`: `401`.
  - llamada anonima a `can_manage_store()`: `401`.
- Pendiente: prueba funcional autenticada de carga y guardado con una cuenta administradora y una cuenta propietaria.

## Estabilidad de la sesion administradora - 2026-07-17

- Se detecto una carrera en el frontend: cada llamada a `refreshAuthoritativeAdminAccess()` borraba la autoridad antes de consultar Supabase.
- Las verificaciones simultaneas ahora comparten una sola solicitud a `is_mall_admin()`.
- Una autorizacion positiva se conserva exclusivamente para el UID autenticado durante esa sesion.
- La autorizacion se elimina al cerrar sesion o al cambiar de UID.
- El ingreso espera solo la comprobacion administrativa critica; perfil y locales siguen cargando en paralelo.
- La apertura posterior de los paneles administrativos reutiliza la autoridad ya corroborada y evita esperas repetidas.
- Prueba automatizada: una llamada RPC ante dos comprobaciones concurrentes; autoridad estable; cambio de UID y cierre de sesion revocan el estado local.
- Version local del frontend: `20260717-stable-admin-session`.
