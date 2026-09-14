# Plataforma multimall

Estado: primera migracion remota aplicada; catalogo, objetos editables y canales runtime
ya se separan por mall. La segunda fase remota de acceso y memberships tambien esta
aplicada y verificada. La cuarta fase de claves compuestas esta aplicada y verificada;
el siguiente paso es auditar las superficies restantes antes de habilitar otro mall.

## Decisiones aprobadas

- Primer mall: Providencia. Nombre comercial editable; puede cambiar a Sector Centro Oriente sin cambiar su identidad.
- Segundo mall: Mall de ensayo, sin acceso publico.
- Una cuenta por persona; permisos independientes por mall.
- Administrador general con acceso a todos; administradores comunales limitados a sus malls.
- La cuenta actual conserva el rol de administrador general; no requiere una fila en
  `mall_admin_memberships` para operar cualquier mall.
- Geometria y herramientas administrativas comunes. Personalizaciones de contenido y mobiliario por mall.
- Un repositorio y versiones compartidas; despliegue gradual con ensayo previo.

## Identidad

El UUID del mall sera permanente. Nombre, comuna, slug y dominio son atributos editables, no claves de relaciones. No se derivaran permisos del dominio ni de un mall_id enviado por el navegador.

## Inventario de aislamiento

| Superficie | Trabajo necesario |
| --- | --- |
| stores y productos | Identidad interna independiente del codigo visible; unicidad por mall y codigo; relaciones que impidan cruzar malls |
| Espacios fisicos | Instancias por mall sobre la misma plantilla geometrica; verificar nombre y claves del esquema remoto |
| Objetos y overrides | Separar object_id de plantilla e identidad de instancia; movimientos y borrados por mall |
| Auth y administradores | Identidad global y membresias por mall; conservar admin general existente |
| Postulaciones, arriendos, pagos y mensajes | Pertenencia y autorizacion por mall, incluidas funciones privilegiadas |
| Promociones y asistentes | Contexto, codigos, reclamos, conversaciones y entrenamiento por mall |
| Analitica y juegos | Sesiones, eventos, premios y clasificaciones por mall |
| Storage | Rutas por mall/local; politicas de lectura privada y escritura comprobadas en servidor |
| Realtime | Canales por mall y permisos de canal; desconectar y limpiar al cambiar de sala |
| Navegador | Claves de almacenamiento, caches, posicion y solicitudes pendientes por mall |

La clave actual mall-object-overrides-v1 no distingue malls. Debe migrarse exclusivamente al primer mall, nunca copiarse automaticamente al entrar en otro.

El frontend ya carga un contexto estable por mall, separa las claves locales de runtime,
separa los canales Realtime por slug, filtra el catalogo y conserva los overrides historicos
de Providencia mediante una migracion unica al nuevo espacio de almacenamiento. Las nuevas
escrituras de productos, postulaciones, mensajes, promociones y objetos incluyen mall_id.
Esto no reemplaza RLS: la pertenencia de datos, permisos y filtros definitivos deben
resolverse en Supabase antes de habilitar un segundo mall.

La primera migracion aditiva esta aplicada y verificada desde
`supabase/multimall_core_scope_20260908.sql`. Las 7 tablas principales comprobadas tienen
0 filas sin mall_id. Antes de habilitar un segundo mall continuaremos con restricciones
`NOT NULL`, claves compuestas y politicas RLS por mall.

La segunda migracion esta aplicada desde `supabase/multimall_phase2_access_20260908.sql`.
Agrega memberships administrativas por mall, protege cambios de pertenencia y reemplaza
las politicas de locales, productos, espacios, objetos, mensajes y postulaciones. Debe
mantenerse verificada antes de crear el segundo registro de malls.
La funcion `is_mall_admin_for` conserva el acceso global de `is_mall_admin()` y permite
delegar acceso puntual mas adelante sin cambiar la cuenta principal.

La cuarta migracion se ejecuto y verifico desde
`supabase/multimall_phase4_composite_keys_20260908.sql`. Hace obligatoria la pertenencia
al mall en las tablas de catalogo y objetos, permite repetir codigos visibles y claves de
objetos en malls diferentes, y reconstruye las relaciones de espacios y overrides con
claves compuestas. La verificacion confirmo los dos indices de locales y las seis claves
compuestas esperadas. No crea un segundo mall ni duplica datos.

La auditoria de la siguiente fase esta preparada en
`supabase/multimall_phase5_remaining_scope_audit_20260908.sql`. Solo lee cantidades,
columnas y politicas de las superficies que aun no tienen politicas multimall dedicadas.
Para obtener solo el primer resultado se puede ejecutar
`supabase/multimall_phase5_null_audit_20260908.sql`.
La auditoria de politicas RLS, sin resultados mezclados, esta en
`supabase/multimall_phase5_policy_audit_20260908.sql`.
La auditoria de columnas de las superficies restantes esta en
`supabase/multimall_phase5_remaining_columns_20260908.sql`.
El extracto reducido para la migracion final esta en
`supabase/multimall_phase5_focus_columns_20260908.sql`.

La analitica revelo cinco eventos y una sesion sin mall, todos pertenecientes a la misma
sesion general. La correccion esta preparada en
`supabase/multimall_phase5_analytics_scope_20260908.sql`: asigna esos registros a
Providencia, actualiza `record_analytics_event` para recibir el mall activo y establece
`mall_id` como obligatorio en ambas tablas.

## Entregas y criterios

1. Respaldo de archivos con hashes; respaldo y restauracion de BD y Storage por separado.
2. Registro de malls aditivo en ensayo; Providencia conserva todos sus datos. No habilita aun otros malls.
3. Migracion de identidades, relaciones, RLS, RPC y Storage; probar dos locales con el mismo codigo en malls diferentes.
4. Contexto de mall en frontend, canales y caches; impedir que respuestas tardias del mall anterior alteren el nuevo.
5. Creacion administrativa reintentable: plantilla y locales vacios, sin copiar clientes ni secretos.
6. Pruebas cruzadas de API, usuarios y escenas antes de publicar. Misma posicion y distinto mall: sin interaccion; mismo mall: presencia compartida.

No usar el esquema SQL historico como prueba del estado remoto. Obtener esquema actual antes de generar la migracion de pertenencia. No agregar mall_id con un valor por defecto permanente: podria asignar escrituras futuras al mall equivocado.

## Recuperacion

El respaldo canonico excluye variables de entorno, archivos de node_modules y datos remotos. No equivale a un respaldo de Supabase ni de Storage. Un rollback de frontend exige migraciones compatibles; no se debe restaurar una BD antigua sobre nuevas operaciones comerciales.
