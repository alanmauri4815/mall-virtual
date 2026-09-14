# Implementacion multitienda - 2026-07-16

## Objetivo

Permitir que una cuenta de Supabase Auth administre varios locales independientes con el mismo correo y la misma contrasena.

## Resultado

- `stores.owner_id` sigue siendo la relacion entre la cuenta y cada local.
- Un mismo `owner_id` puede estar asignado a varias filas de `stores`.
- El Panel Locatario incluye un selector permanente `Mis locales`.
- El local seleccionado controla los datos, productos, mensajes, archivos y configuracion que se muestran y guardan.
- Cambiar de local no requiere cerrar sesion.
- El panel advierte antes de descartar cambios sin guardar.
- La asignacion administrativa agrega locales sin liberar automaticamente los anteriores.
- No se requiere una cuenta Auth ni un correo diferente por cada local.

## Archivos modificados

- `index.html`
- `css/mall.css`
- `js/mall/mall-boot.js`
- `js/mall/mall-ui.js`

## Verificacion local

- `node --check js/mall/mall-ui.js`: OK.
- `node --check js/mall/mall-boot.js`: OK.
- `git diff --check` limitado a los archivos modificados: OK.
- `http://127.0.0.1:8080/index.html`: HTTP 200.
- Navegador automatizado: carga con contenido, sin overlay de error y sin errores de consola.
- Prueba simulada con dos locales: seleccion, cambio, cancelacion por datos sin guardar y confirmacion de descarte: OK.
- Escritorio 1440x900: selector visible y sin desbordamiento horizontal.
- Celular 390x844: panel dentro del viewport y sin desbordamiento horizontal.

## Estado

Implementado, probado localmente y publicado en Vercel.

- Dominio principal: `https://mall-virtual-one-ten.vercel.app/`
- Despliegue: `dpl_3PcgApSSjm4mpXn95xUzYajmgYpf`
- URL inmutable: `https://mall-virtual-907zhnuor-alanmauri4815s-projects.vercel.app`
- Estado confirmado por Vercel: `Ready`.

## Correccion adicional del Panel Maestro

Durante la primera prueba real se detecto este estado en Supabase:

- `EN-20`: propietario `2545564b-41e4-47f4-93ea-ec22b8b0ee7e`.
- `SE-10`: conservaba `AM Store` y `alanmauri4815@gmail.com`, pero `owner_id` estaba vacio.
- El perfil visible del administrador aparecia con rol `tenant`.

Se agregaron las siguientes protecciones:

- El Panel Maestro relaciona locales por UID y tambien recupera locales sin propietario que conservan exactamente el correo de la cuenta.
- Al asignar un local nuevo se incluyen y vuelven a vincular los locales anteriores encontrados por correo.
- Un local que ya tiene otro propietario nunca se recupera solamente por coincidencia de correo.
- Las postulaciones con UID antiguo o incorrecto priorizan la cuenta cuyo correo coincide.
- La cuenta `alanmauri4815@gmail.com` conserva el rol efectivo `admin` y los guardados de perfil no pueden degradarla a `tenant`.
- El Panel Locatario combina los locales vinculados por UID con los locales pendientes de vincular por correo.

Prueba automatizada del caso AM Store:

- Locales detectados: `SE-10` y `EN-20`.
- Local con propietario diferente: excluido.
- Rol escrito al asignar: `admin`.
- Errores de navegador: ninguno.

La reparacion definitiva de los datos reales requiere abrir nuevamente AM Store en el Panel Maestro y confirmar la asignacion con la sesion administradora. Esa operacion vinculara `SE-10` y `EN-20` al UID del administrador.

## Acceso administrativo a todos los locales

Se amplio el Panel Locatario para que la cuenta administradora pueda intervenir cualquier local sin entrar con la cuenta de su propietaria.

- La cuenta `alanmauri4815@gmail.com` consulta todos los registros de `stores` y muestra el selector `Todos los locales`.
- Los locales aparecen ordenados por codigo y los que no tienen propietario se identifican como disponibles.
- Al abrir el panel se conserva el local seleccionado; si no existe una seleccion previa, se prioriza un local propio del administrador.
- Las locatarias normales siguen viendo solamente sus locales vinculados por `owner_id` o los locales sin propietario que coinciden exactamente con su correo.
- Guardar datos como administrador nunca agrega ni modifica `owner_id`.
- Subir un logo o una imagen como administrador usa las politicas RLS administrativas y no transfiere la propiedad del local.

### Verificacion local del acceso global

- Cuenta administradora simulada: recibio los tres locales de prueba, incluidos uno ajeno y uno disponible.
- Selector administrativo: etiqueta `Todos los locales`, conteo correcto y seleccion inicial de `SE-10`.
- Cuenta locataria simulada: excluyo correctamente un local perteneciente a otra cuenta.
- Carga administrativa sobre local ajeno: cero actualizaciones de propiedad y `owner_id` conservado.
- Guardado administrativo sobre local disponible: payload sin campo `owner_id`.
- `node --check` para `mall-stores.js`, `mall-ui.js` y `mall-boot.js`: OK.
- `git diff --check` para los archivos intervenidos: OK.
- Aplicacion local: HTTP 200 y sin errores de JavaScript durante la prueba automatizada.

Estado: implementado y probado localmente; pendiente de publicacion en Vercel despues de la prueba manual del administrador.
