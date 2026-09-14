# Pruebas

- `contracts/`: protege limites entre HTML, modulos, autorizacion, RLS y despliegue.
- `unit/`: prueba reglas aisladas y comportamiento determinista.
- `integration/`: levanta Edge Functions locales y valida solicitudes HTTP reales.
- `browser/`: valida el recorrido WebGL en un navegador real y un perfil movil limitado.
- `artifacts/`: capturas temporales generadas por las pruebas; Git y Vercel las excluyen.

Ejecutar `npm.cmd test` durante el desarrollo y `npm.cmd run test:all` antes de publicar.
La prueba integrada de RLS requiere Docker o un proyecto Supabase separado; nunca debe usar
el proyecto productivo. Consulta `docs/operations/SUPABASE_TEST_ENVIRONMENT.md`.
