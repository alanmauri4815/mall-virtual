# Mall Virtual

Aplicacion web 3D del Mall Creaciones. El punto de entrada publico es `index.html`.

## Estructura

- `assets/`: modelos y dependencias vendorizadas para el navegador.
- `css/`: estilos de la experiencia principal.
- `js/mall/`: motor 3D y dominios de navegacion, comercio, seguridad e interfaz.
- `supabase/`: esquema maestro, migraciones operativas y Edge Functions.
- `tests/`: contratos, pruebas unitarias y verificacion en navegador.
- `tools/`: respaldo, inventario, auditoria y ejecucion de pruebas.
- `docs/`: arquitectura, operacion, auditorias y datos derivados.
- `backups/`: contiene el respaldo canonico verificable y no se publica.

## Verificacion

```powershell
npm.cmd test
npm.cmd run test:browser
```

Antes de cambios estructurales importantes, ejecutar `npm.cmd run backup` y conservar el
SHA-256 generado. Para hitos TDD tambien existen `npm.cmd run backup:pre-tdd` y
`npm.cmd run backup:post-tdd`. Las reglas de acceso definitivas viven en RLS dentro de
`supabase/mall_current_setup.sql`; ocultar controles en el navegador no reemplaza esas reglas.
