# Beneficios para miembros inscritos

## Funciones incluidas

- Teletransporte desde los totems solo para miembros, locatarios y administradores.
- Vista aerea solo para miembros, locatarios y administradores.
- Chat interno solo para miembros, locatarios y administradores.
- Podometro mensual con respaldo local y sincronizacion por cuenta.
- Promociones generales, por distancia y de tipo Globo Dorado.
- Confirmacion automatica por correo al obtener un beneficio.
- Aviso automatico de promociones activas cuando entra el administrador.

## Activar persistencia en Supabase

Ejecutar en SQL Editor:

`supabase/member_benefits_20260803.sql`

El script crea las tablas y RPC con RLS para que cada usuario solo pueda leer su actividad y sus participaciones.

## Activar correo automatico

Desplegar la funcion:

```bash
supabase functions deploy member-promotion-email
```

Configurar secretos:

```bash
supabase secrets set RESEND_API_KEY=re_xxxxx
supabase secrets set PROMOTION_FROM_EMAIL="Mall Creaciones <beneficios@tu-dominio.cl>"
```

El remitente debe pertenecer a un dominio verificado en Resend.

## Crear o activar una promocion

La migracion deja una plantilla inactiva de Globo Dorado. Desde Table Editor, abrir `mall_promotions`, definir premio y fechas, y cambiar `active` a `true`.

Tipos admitidos:

- `general`: participacion directa.
- `golden_balloon`: activa el coleccionable dentro del mall.
- `monthly_distance`: exige `min_monthly_meters` antes del canje.

Al activar una promocion con `notify_by_email = true`, el siguiente ingreso del administrador dispara una sola ronda de avisos a los miembros con `marketing_opt_in = true`.
