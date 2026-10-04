# Publicacion en Hostinger DNS y Coolify

## Arquitectura objetivo

- `mallcreaciones.maucore.cl`: dominio oficial del mall.
- `staging.maucore.cl`: prueba privada antes de publicar.
- `coolify.maucore.cl`: panel de Coolify. No se usa para el mall.
- `maucore.cl` y `www.maucore.cl`: conservar su destino actual; no redirigirlos como parte de este cambio.
- Supabase permanece como base de datos, autenticacion, tiempo real y funciones. No se migran ni se copian datos.

## Antes de publicar

1. En Supabase Authentication, establecer `https://mallcreaciones.maucore.cl` como Site URL y agregarlo a Redirect URLs. Mantener `https://staging.maucore.cl` y las direcciones Vercel durante la transicion.
2. En las variables de las funciones de Supabase, configurar:
   - `MALL_ALLOWED_ORIGIN=https://mallcreaciones.maucore.cl`
   - `MALL_ALLOWED_ORIGINS=https://mallcreaciones.maucore.cl,https://staging.maucore.cl`
3. Publicar las funciones modificadas: `admin-create-tenant`, `admin-reset-tenant-password`, `member-promotion-email` y `store-attendant`.
4. Preparar una version de publicacion en Git. No publicar directamente un directorio de trabajo con cambios sin revisar.

## Aplicacion de prueba en Coolify

1. Crear una nueva aplicacion desde el repositorio GitHub del mall.
2. Seleccionar Dockerfile como metodo de compilacion. El Dockerfile del repositorio sirve el mall mediante Nginx y conserva los encabezados de seguridad y cache.
3. Usar directorio base `/`, puerto expuesto `80` y dominio `https://staging.maucore.cl`.
4. Desplegar. El registro DNS comodin existente debe llevar el subdominio al mismo servidor; Coolify emitira el certificado HTTPS.
5. Probar inicio de sesion, registro, visitante, locatario, administrador, paneles, catalogos, imagenes, mensajeria, tiempo real, laberinto, asistente y analitica.

## Dominio oficial en Coolify

1. En Hostinger DNS, confirmar que el registro `mallcreaciones` apunta a la IPv4 publica del servidor de la aplicacion en Coolify. El comodin actual ya resuelve el subdominio al servidor; un registro A explicito es preferible para que siga funcionando si cambia el comodin.
2. En Coolify, agregar `https://mallcreaciones.maucore.cl` a Domains de la aplicacion del mall y conservar `https://staging.maucore.cl` para pruebas.
3. Guardar y desplegar para que Coolify configure la ruta y el certificado HTTPS.
4. Comprobar DNS, HTTPS, inicio de sesion, registro, visitante, locatario, administrador, catalogos, imagenes, mensajeria, tiempo real, laberinto, asistente y analitica.
5. Mantener el destino anterior operativo durante al menos 72 horas para usarlo como retorno inmediato si apareciera una incidencia.

## Retorno

Si la version nueva falla, se revierte el destino del dominio al despliegue anterior o se retira el dominio de la aplicacion de Coolify. Los datos permanecen en Supabase y no se pierden.
