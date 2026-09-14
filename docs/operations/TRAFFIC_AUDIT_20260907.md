# Auditoria local de trafico: 2026-09-07

## Alcance y estado

Revision local; sin despliegue ni cambios en Supabase. Auditoria incompleta:
la visita automatizada no termino correctamente y no permite estimar el consumo
real de un recorrido ni atribuir el exceso de Cached Egress.

## Respaldo

`backups/CANONICAL_PRE_TRAFFIC_AUDIT_20260907_151938`: 217 archivos,
10.462.445 bytes, SHA256 verificado por la herramienta de respaldo.
No incluye respaldo de la base de datos ni de Storage.

## Cambio verificado

`js/mall/mall-ui.js`: HEARTBEAT_LIMIT cambia de 4000 a 30000 ms.
Solo cambia el envio periodico de posicion en reposo. Se conserva el muestreo
de movimiento cada 100 ms, umbrales, aviso de parada y respuesta al ingreso
de otros usuarios. No cambia el heartbeat interno del WebSocket ni el chat.
`index.html` actualiza la version de ese script.

Reduccion teorica de avisos periodicos por cliente quieto: unos 15 a 2 por minuto.
No es una reduccion medida del total de mensajes facturados ni de Cached Egress.

TDD: `tests/unit/presence-idle-budget.test.js` fallo con 4000 ms y paso con
30000 ms; ejecuta el callback real con reloj y camara simulados, verificando
reposo y envio por desplazamiento. `npm test`: 33 pruebas y 23 comprobaciones
de sintaxis aprobadas. No sustituye una prueba multijugador con dos navegadores.

## Medicion exploratoria no valida como visita completa

Primera ejecucion: 16 respuestas de Supabase, 131.912 bytes en la fase inicial.
Tres respuestas de store_products de aproximadamente 34,9 KB cada una.
No se conservaron parametros de consulta: no se puede afirmar que sean consultas
identicas o innecesarias. No se registraron mensajes de posicion ni descargas
durante reposo/recarga. Esto NO demuestra ahorro o ausencia de consumo.

Errores observados: colliders no definido, hasEnteredMall no definido,
SECOND_FLOOR_ATRIUM_EDGE no definido y STORE_CODE_RENAMES antes de inicializar.
No se ha determinado si el origen es la carga incompleta de scripts o el codigo.
Segunda ejecucion: tiempo de espera agotado al pulsar guest-entry-button.
El servidor HTTP si responde 200 en 127.0.0.1:8080.

## Herramienta y siguientes comprobaciones

`tools/audit-local-traffic.js` usa Playwright y Chrome instalado. Acepta
MALL_AUDIT_URL y PLAYWRIGHT_CHROME_PATH. Produce
`tests/artifacts/traffic-audit.json`; no guarda cookies, claves, cuerpos de
respuestas, conversaciones ni parametros URL. Registra rutas de archivos.
Una visita con errores o sin Presence listo devuelve codigo de salida 1.

1. Resolver/reproducir el fallo de entrada con errores de red y stacks completos.
2. Repetir entrada, recorrido y recarga con aplicacion y Presence operativos.
3. Comparar consultas completas en memoria sin persistir credenciales.
4. Medir imagenes de Storage, tamanos, cache y duplicaciones.
5. Probar movimiento, parada y segundo plano con dos clientes.
6. Optimizar solo los recursos confirmados, antes de desplegar.

## Actualizacion: catalogo compartido

La revision de codigo confirmo que la busqueda, la publicidad central y la
cache de locales iniciaban lecturas completas e independientes de
`store_products`; dos de ellas tambien pedian `stores`. Se incorporo
`window.mallCatalogRequests` en `js/mall/mall-boot.js`. Durante una misma
carga de pagina comparte tanto la solicitud en curso como su resultado para
`stores` y `store_products`.

Cambios de consumo esperados por visita nueva: una lectura completa de
`store_products` en vez de tres, y una lectura completa de `stores` en vez de
dos. Es una reduccion de solicitudes y transferencia de API, no una afirmacion
sobre los bytes de imagenes de Storage ni sobre Cached Egress hasta completar
la medicion de red.

Al guardar productos desde el panel, `replaceStoreProducts` invalida solo la
instantanea de productos. La siguiente lectura vuelve a consultar Supabase.
No se guardan catalogos en localStorage, no se cambian permisos, tablas, RLS
ni relaciones de base de datos.

## Actualizacion: Storage

La consulta publica del catalogo encontro 188 filas con 188 URLs unicas.
Las 188 respondieron correctamente y suman 54.779.331 bytes (promedio
291.379; mayor 4.828.885). Se observaron 178 `image/webp` y 10 `image/png`.
La cabecera de entrega publica se midio con un `GET` de rango minimo; una
solicitud `HEAD` aislada devuelve `no-cache` en este gateway y no representa la
politica efectiva de descarga. Las variantes catalog y display existentes
entregan cache reutilizable; las copias nuevas de esta migracion entregan
`public, max-age=31536000`.

Las cargas nuevas de imagenes de locatario y marcos ahora usan
`cacheControl: 31536000`. Los nombres de archivos de locatario incluyen
timestamp y no se sobrescriben; los marcos usan version en la URL después de
una sobreescritura. Las 188 imagenes existentes no fueron re-subidas ni
alteradas remotamente.

La verificacion encontro 175 variantes `display` disponibles, sin fallas,
con 17.339.547 bytes en total (promedio 99.083; mayor 1.628.468). Las otras
13 URLs no coinciden con el patron de nombre de variante y deben revisarse
individualmente. Servir la variante `display` reduce el conjunto medido de
54,78 MB a 17,34 MB para las 175 imagenes que la tienen, aproximadamente un
68 por ciento menos para esos recursos. Es una comparacion de tamanos, no una
medicion de Cached Egress de produccion.

El codigo usa `display` en los estantes interiores y deja `catalog` para la
ficha ampliada. Tambien fija `Cache-Control: 31536000` para nuevas imagenes
con nombres versionados. Las imagenes antiguas entregan `max-age=3600` en la
respuesta publica medida; no se modificaron automaticamente.

El inventario detallado queda en `tests/artifacts/storage-audit.json`. Las 13
imagenes heredadas sin variante `display` son:

| Local | Archivo | Tipo | Tamano |
| --- | --- | --- | ---: |
| N-104 | `product-0-17831344788937.webp` | WebP | 37.046 B |
| N-104 | `product-1-17831774433881.webp` | WebP | 59.468 B |
| N-104 | `product-2-17831778944324.png` | PNG | 1.409.292 B |
| N-104 | `product-3-17831781488514.webp` | WebP | 63.664 B |
| N-104 | `product-4-17832067477770.webp` | WebP | 36.432 B |
| N-104 | `product-5-17832084844270.webp` | WebP | 54.026 B |
| N-104 | `product-6-17832228900504.webp` | WebP | 51.022 B |
| N-104 | `product-7-17832239300935.webp` | WebP | 98.998 B |
| N-104 | `product-9-17832577855174.webp` | WebP | 63.134 B |
| S-107 | `product-0-17832980244835.webp` | WebP | 52.254 B |
| S-107 | `product-1-17832980100460.png` | PNG | 2.716.089 B |
| S-107 | `product-2-17833076966819.png` | PNG | 2.734.692 B |
| O-101 | `product-0-17835604922645.png` | PNG | 1.358.976 B |

Todas las heredadas respondieron correctamente. Las copias nuevas se subieron
como WebP sin reemplazar los originales y entregan
`public, max-age=31536000`. No fue necesario actualizar los `image_url` de
`store_products` porque el cargador 3D deriva la ruta `-display.webp` y deja el
original como respaldo.

La herramienta `npm run prepare:storage-legacy` ya genera esas copias en
`tests/artifacts/storage-legacy-display/` y escribe un manifiesto. El proceso
es local y no contiene llamadas de subida ni cambios de base de datos. El
cargador 3D reconoce el nombre propuesto `product-original-display.webp` y
mantiene el archivo original como respaldo hasta que la copia exista en
Storage.

Verificacion: `catalog-request-deduplication.test.js` y `npm test` aprobaron
(39 pruebas rapidas y 23 comprobaciones de sintaxis). La prueba de navegador
`visitor-entry.browser.test.js` aprobo con perfil iPhone 8: visitante activo,
Presence listo, rol guest, camera `[-9.9, 1.8, -0.22]`, canvas `400x225` y
contexto WebGL activo.
