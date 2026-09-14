# Analitica del Mall - Implementacion 2026-07-26

## Objetivo

Registrar comportamiento agregado y util para la administracion y los locatarios,
sin almacenar contrasenas, mensajes, correos, telefonos, posiciones exactas ni
recorridos individuales.

## Estado

- Frontend instrumentado en `js/mall/mall-analytics.js`.
- Panel estadistico agregado al Panel Locatario.
- Panel estadistico agregado al Panel de Control Maestro.
- Migracion preparada en `supabase/analytics_foundation_20260726.sql`.
- La migracion debe ejecutarse en Supabase antes de que los paneles reciban datos.
- La implementacion esta validada localmente en `http://127.0.0.1:5500/index.html`.

## Activacion en Supabase

1. Abrir el proyecto Mall Emprendimientos en Supabase.
2. Entrar a **SQL Editor**.
3. Crear una consulta nueva.
4. Pegar el contenido completo de
   `supabase/analytics_foundation_20260726.sql`.
5. Presionar **Run**.
6. Confirmar que finalice sin errores.
7. Recargar el mall y realizar un recorrido de prueba.

El script es repetible: usa `create table if not exists` y
`create or replace function`.

## Eventos

| Evento | Significado |
| --- | --- |
| `session_started` | Inicio de una sesion estadistica de hasta 30 minutos de inactividad. |
| `mall_entered` | Ingreso efectivo al recorrido 3D. |
| `search_opened` | Apertura del buscador. |
| `search_submitted` | Busqueda consolidada, con cantidad de resultados. |
| `search_result_clicked` | Seleccion de un local desde los resultados. |
| `route_requested` | Solicitud de ruta o traslado a un local. |
| `store_attention_qualified` | Mirada sostenida y directa frente a una vitrina. |
| `store_attention_ended` | Fin de esa atencion, con duracion total. |
| `store_opened` | Apertura de la ficha comercial del local. |
| `product_viewed` | Apertura del detalle de un producto. |
| `contact_clicked` | Accion sobre email, WhatsApp o red social. |
| `message_sent` | Mensaje almacenado correctamente. |

## Atencion frente a vitrinas

La primera version considera los locales boutique y esquinas construidos con la
fachada estandar del mall.

Una atencion se registra solo cuando:

- el visitante esta recorriendo en modo caminata;
- la pestana esta visible y no hay un modal bloqueando la experiencia;
- la camara esta a 2 metros o menos del frente del local;
- la mirada se mantiene dentro de un angulo de +/-30 grados;
- existe linea de vista real hacia la fachada;
- las condiciones se mantienen por 3 segundos.

Para evitar cortes por pequenas variaciones de movimiento se usa una salida con
2,3 metros, 38 grados y 350 milisegundos de tolerancia. La duracion termina al
mirar a otro lugar, alejarse, abrir un modal, ocultar la pestana o salir.

## Metricas

### Panel Locatario

- visitantes unicos relacionados con el local;
- atenciones calificadas;
- aperturas de ficha;
- vistas de productos;
- acciones de contacto;
- conversion de atencion o apertura a contacto;
- tiempo promedio de atencion;
- atenciones sin accion posterior;
- productos mas vistos;
- busquedas que condujeron al local.

### Panel Administrador

- visitantes unicos;
- ingresos al mall;
- busquedas y busquedas sin resultados;
- atenciones, aperturas, vistas de producto y contactos;
- locales con mayor actividad ponderada;
- demanda expresada en busquedas sin oferta.

Las consultas excluyen eventos generados por administradores y locatarios para
que el trabajo de gestion no infle las metricas comerciales.

## Seguridad y privacidad

- Las tablas tienen RLS habilitado.
- No existen politicas de lectura o escritura directa para clientes.
- Los eventos ingresan solo mediante una funcion `SECURITY DEFINER` validada.
- Un locatario solo puede consultar las estadisticas de locales donde su UID es
  `stores.owner_id`.
- El administrador puede consultar todos los locales y el agregado del mall.
- Los visitantes anonimos no pueden leer ninguna tabla ni panel estadistico.
- Los terminos con apariencia de correo o telefono se descartan.
- Los identificadores de productos se guardan como texto validado para admitir
  tanto los UUID actuales como instalaciones historicas con IDs numericos.
- El servidor deriva el rol desde `auth.uid()`; el navegador no puede declararse
  administrador.
- Existe limite defensivo de 90 eventos por minuto y sesion.
- La limpieza recomendada conserva 90 dias y se ejecuta manualmente con:

```sql
select public.purge_old_analytics_events(90);
```

## Verificacion posterior

Ejecutar en SQL Editor:

```sql
select
    n.nspname as schema_name,
    c.relname as table_name,
    c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('analytics_sessions', 'analytics_events')
order by c.relname;
```

Ambas filas deben mostrar `rls_enabled = true`.

Despues de una prueba de navegacion:

```sql
select event_name, count(*) as total
from public.analytics_events
group by event_name
order by total desc, event_name;
```

## Continuidad

Si el proceso se retoma mas adelante:

1. comprobar si la migracion fue ejecutada;
2. recorrer el mall localmente durante al menos 3 segundos frente a una vitrina;
3. abrir una ficha y un producto;
4. verificar eventos en SQL Editor;
5. entrar como administrador y como locatario para revisar los paneles;
6. publicar solo despues de completar estas pruebas.
