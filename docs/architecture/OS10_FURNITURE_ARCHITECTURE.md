# Mobiliario del local OS-10

## Alcance

El mobiliario de OS-10 se define en codigo del frontend 3D. No se agregaron tablas, filas, columnas ni funciones en Supabase.

La geometria heredada representa OS-10 con dos componentes solapados:

- `phys_b_f1_xp_zn_horizontal_01`
- `phys_b_f1_xp_zn_vertical_01`

El espacio comercial confirmado por inspeccion es el cuadrado mundial `X = 17..29`, `Z = -29..-17`. Para evitar duplicar muebles en las extensiones heredadas, el mobiliario se renderiza una sola vez desde `phys_b_f1_xp_zn_horizontal_01`, usando limites locales `X = -5.7..5.7`, `Z = -2.7..8.7`.

## Mapa de archivos

### `js/mall/mall-furniture.js`

Es la fuente de configuracion del mobiliario por local. La entrada `OS-10` indica los espacios fisicos que reciben muebles y contiene la lista de estanterias, islas, vitrinas y caja.

Para mover, agregar o quitar muebles de OS-10, este es el archivo principal que se debe editar.

Cada pieza debe quedar dentro de `safeBounds`. El motor calcula su huella antes de construirla y omite automaticamente cualquier pieza que sobrepase ese limite.

### `js/mall/mall-world.js`

Construye la geometria Three.js. Lee `window.MALL_STORE_FURNITURE_LAYOUTS`, crea los muebles con los generadores existentes y registra una colision ajustada a la huella de cada objeto.

La infraestructura del local (piso, paredes, fachada, puertas y techo) sigue siendo responsabilidad de este archivo, pero no fue modificada por este cambio.

### `index.html`

Carga `mall-furniture.js` antes de `mall-world.js`. El orden es necesario para que la configuracion exista cuando se construye la escena.

### `tests/os10-furniture.test.js`

Comprueba que el layout use un unico componente, que cada mueble permanezca dentro de `safeBounds` y que su huella mundial no salga del cuadrado confirmado. Se ejecuta con `node tests/os10-furniture.test.js`.

## Bases de datos

Este cambio no usa Supabase. Las tablas `stores`, `physical_spaces` y `store_physical_links` siguen identificando el local y su relacion comercial, pero no almacenan estos muebles.

Si en el futuro el mobiliario debe ser editable desde el panel de administrador, la evolucion recomendada es crear una tabla `store_furniture_layouts` con una politica RLS de lectura publica y escritura exclusiva para administradores. Hasta entonces, mantener el layout en `mall-furniture.js` evita cambios accidentales en produccion y conserva el control de versiones en Git.

## Regla de aislamiento

La configuracion se activa por dos condiciones simultaneas:

1. El codigo comercial debe ser `OS-10`.
2. El identificador fisico debe ser `phys_b_f1_xp_zn_horizontal_01`.

Por eso otro local no puede heredar este mobiliario aunque comparta un codigo geometrico antiguo o una orientacion similar.
