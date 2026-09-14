# Publicacion en Coolify: maucore.cl

## Arquitectura objetivo

- `maucore.cl`: mall publico.
- `www.maucore.cl`: redirige a `maucore.cl`.
- `staging.maucore.cl`: prueba privada antes de publicar.
- `coolify.maucore.cl`: panel de Coolify. No se usa para el mall.
- Supabase permanece como base de datos, autenticacion, tiempo real y funciones. No se migran ni se copian datos.

## Antes de publicar

1. En Supabase Authentication, agregar `https://maucore.cl`, `https://www.maucore.cl` y `https://staging.maucore.cl` a Redirect URLs. Mantener temporalmente las direcciones Vercel para poder volver atras.
2. En las variables de las funciones de Supabase, configurar:
   - `MALL_ALLOWED_ORIGIN=https://maucore.cl`
   - `MALL_ALLOWED_ORIGINS=https://maucore.cl,https://www.maucore.cl,https://staging.maucore.cl`
3. Publicar las funciones modificadas: `admin-create-tenant`, `admin-reset-tenant-password`, `member-promotion-email` y `store-attendant`.
4. Preparar una version de publicacion en Git. No publicar directamente un directorio de trabajo con cambios sin revisar.

## Aplicacion de prueba en Coolify

1. Crear una nueva aplicacion desde el repositorio GitHub del mall.
2. Seleccionar Dockerfile como metodo de compilacion. El Dockerfile del repositorio sirve el mall mediante Nginx y conserva los encabezados de seguridad y cache.
3. Usar directorio base `/`, puerto expuesto `80` y dominio `https://staging.maucore.cl`.
4. Desplegar. El registro DNS comodin existente debe llevar el subdominio al mismo servidor; Coolify emitira el certificado HTTPS.
5. Probar inicio de sesion, registro, visitante, locatario, administrador, paneles, catalogos, imagenes, mensajeria, tiempo real, laberinto, asistente y analitica.

## Cambio a produccion

1. Agregar a la misma aplicacion `https://maucore.cl,https://www.maucore.cl`.
2. Configurar en Coolify la redireccion de `www.maucore.cl` a `maucore.cl`.
3. Confirmar que los registros DNS `@`, `www` y `*` siguen resolviendo al servidor de Coolify y que los puertos 80 y 443 estan abiertos.
4. Desplegar y comprobar HTTPS, cabeceras y funcionalidades desde una ventana privada.
5. Mantener Vercel operativo durante al menos 72 horas. Se usa como retorno inmediato si apareciera una incidencia.

## Retorno

Si la version nueva falla, se revierte el destino del dominio al despliegue anterior o se retira el dominio de la aplicacion de Coolify. Los datos permanecen en Supabase y no se pierden.
