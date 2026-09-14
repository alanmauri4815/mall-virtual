# Auditoria de acceso privilegiado - 2026-07-31

## Objetivo

- Impedir que visitantes anonimos o sesiones antiguas abran el panel locatario o el panel administrador.
- Verificar que Supabase tampoco entregue informacion sensible sin una sesion valida.

## Cambios implementados

- La sesion se valida con `auth.getUser()` antes de abrir un panel privilegiado.
- El rol administrador se vuelve a comprobar mediante `is_mall_admin()` antes de abrir el panel o ejecutar una accion administrativa.
- Se elimino el acceso administrativo basado unicamente en un permiso guardado en memoria.
- Un cierre de sesion o cambio de cuenta ahora cierra y limpia ambos paneles, sus formularios, listados y datos en memoria.
- Las acciones administrativas globales vuelven a comprobar la autorizacion antes de consultar o modificar datos.
- El boton `Panel Locatario` abre correctamente el formulario de ingreso en el primer toque cuando no hay sesion.

## Archivos modificados

- `js/mall/mall-ui.js`.
- `js/mall/mall-boot.js`.

## Verificacion local

- `node --check js/mall/mall-ui.js`: OK.
- `node --check js/mall/mall-boot.js`: OK.
- `git diff --check`: OK.
- Prueba aislada sin sesion:
  - boton administrador oculto;
  - opcion administrador oculta;
  - panel administrador cerrado;
  - `Panel Locatario` muestra solo el formulario de autenticacion;
  - panel locatario cerrado;
  - consola sin errores.

## Verificacion de Supabase sin sesion

Las siguientes tablas respondieron HTTP 401 a una lectura con la clave publica y sin usuario autenticado:

- `admin_members`.
- `tenant_applications`.
- `tenant_leases`.
- `tenant_payments`.
- `tenant_notes`.
- `physical_spaces`.
- `store_physical_links`.
- `mall_messages`.
- `contact_messages`.
- `user_profiles`.

Las RPC `is_mall_admin` y `get_mall_analytics` tambien respondieron HTTP 401.

Las tablas `stores` y `store_products` continuan con lectura publica intencional para mostrar el catalogo a los visitantes.

## Estado

- Cambios verificados localmente.
- Publicacion en Vercel pendiente de autorizacion del propietario.
