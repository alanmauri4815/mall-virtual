# Matriz de pruebas del proyecto

Fecha base: 2026-08-09  
Rama de trabajo: `codex/tdd-reorganization`

## Regla de trabajo

El proyecto existente se protege primero con pruebas de caracterizacion. Toda correccion o
reorganizacion posterior debe comenzar con una prueba que falle por el problema concreto,
aplicar el cambio minimo y finalizar con regresion completa. Los respaldos historicos no se
consideran codigo activo y no se ejecutan en la suite.

## Ejecucion

- `npm.cmd test`: sintaxis de JavaScript activo y pruebas rapidas.
- `npm.cmd run test:browser`: prueba WebGL en navegador para celular antiguo.
- `npm.cmd run test:edge`: compilacion Deno aislada y con dependencias bloqueadas.
- `npm.cmd run test:edge:http`: solicitudes HTTP locales contra las cuatro Edge Functions.
- `npm.cmd run test:all`: suite rapida, Edge Functions y navegador movil.
- `npm.cmd run backup`: crea un respaldo manual canonico verificable.
- `npm.cmd run backup:pre-tdd`: crea el punto de retorno anterior a una etapa TDD.
- `npm.cmd run backup:post-tdd`: crea el punto verificado posterior a una etapa TDD.
- `npm.cmd run inventory`: vuelve a generar el inventario de archivos.

## Cobertura del frontend activo

| Archivo | Responsabilidad | Cobertura actual | Proxima prueba prioritaria |
|---|---|---|---|
| `index.html` | Entrada, paneles y orden de modulos | `entrypoint-contract`, `source-text-integrity` | Flujo visual desktop/celular |
| `css/mall.css` | Presentacion y respuesta movil | sintaxis indirecta, `source-text-integrity`, browser movil | Capturas comparativas |
| `js/mall/mall-boot.js` | Arranque, Supabase y viewport | sintaxis, entrada | Inicializacion con/sin configuracion |
| `js/mall/mall-physics.js` | Colisiones y limites | `physics`, sintaxis | Geometria integrada con la escena completa |
| `js/mall/mall-furniture.js` | Layouts declarativos de muebles | `os10-furniture` | Registro de nuevos locales |
| `js/mall/mall-constants.js` | Estado global y perfil de rendimiento | `mobile-performance`, browser movil | Perdida/restauracion WebGL |
| `js/mall/mall-world.js` | Geometria y construccion del mall | `interior-streaming`, browser movil | Inventario fisico por planta |
| `js/mall/mall-mobile-controls.js` | Joystick, gestos y zoom | `mobile-controls`, browser movil | Eventos tactiles reales |
| `js/mall/mall-navigation.js` | Movimiento y camara | `mobile-controls`, sintaxis | Avance/retroceso y bloqueos |
| `js/mall/mall-multiplayer.js` | Presencia y recuperacion de acceso | sintaxis | Sesion y reconexion |
| `js/mall/commerce/product-capacity.js` | Planes T0-T5 y capacidad | `product-capacity` | Integracion con tarifas Supabase |
| `js/mall/mall-stores.js` | Tiendas, productos y archivos | `authorization-boundary`, sintaxis | CRUD con cliente Supabase simulado |
| `js/mall/mall-interaction.js` | Raycast e interaccion 3D | sintaxis | Seleccion de vitrina/producto |
| `js/mall/security/url-safety.js` | Sanitizacion y enlaces externos | `security-utils` | Integracion visual de enlaces |
| `js/mall/mall-ui.js` | Login y paneles de gestion | `authorization-boundary`, sintaxis | Flujos admin/locatario/anonimo |
| `js/mall/mall-analytics.js` | Eventos y estadisticas | sintaxis | Deduplicacion y privacidad |
| `js/mall/mall-store-assistant.js` | Asistente virtual de local | sintaxis | Permisos y respuestas fallidas |
| `js/mall/mall-npc.js` | Avatares NPC | `mobile-performance`, browser movil | Ciclo de vida y limite por perfil |
| `js/mall/mall-main.js` | Orquestacion y render | entrada, sintaxis, browser movil | Arranque y recuperacion de contexto |

## Cobertura de datos y backend

| Area | Archivo canonico | Cobertura actual | Pendiente |
|---|---|---|---|
| Esquema y RLS | `supabase/mall_current_setup.sql` | `security-schema-contract` | Pruebas integradas contra Supabase de ensayo |
| Edge Functions | `supabase/functions/*/index.ts` | contrato estatico, Deno check y HTTP local | Sesiones validas contra Supabase de ensayo |
| Limite de despliegue | `.vercelignore`, `.gitignore` | `deployment-boundary` | Inspeccion automatica del artefacto Vercel |
| Catalogo de productos | `stores`, `store_products`, Storage | contratos RLS estaticos | CRUD real por admin, propietario y anonimo |
| Analitica | `analytics_*` | esquema ejecutado, JS con sintaxis | insercion, agregacion y retencion |

## Clasificacion estructural

- Codigo activo: `index.html`, `css/`, `js/mall/`, `assets/vendor/`, `supabase/functions/`.
- Base de datos: `supabase/mall_current_setup.sql` y migraciones operativas fechadas.
- Pruebas: `tests/`.
- Herramientas reproducibles: `tools/`.
- Documentacion: `docs/` y guias operativas vigentes.
- Historico obsoleto: retirado tras inventario y conservado en el respaldo `PRE_TDD`; el
  manifiesto de 516 archivos permanece en `docs/audits/data/OBSOLETE_ARTIFACTS_REMOVED_20260809.csv`.
- Puntos de retorno: `backups/CANONICAL_PRE_TDD_20260809_083443` y el respaldo mas reciente
  `backups/CANONICAL_POST_TDD_*`, cada uno con ZIP, manifiesto SHA-256 y restaurador.
