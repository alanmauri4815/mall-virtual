# Auditoria integral de espacios fisicos

Fecha: 2026-08-05

## Resumen

- Componentes fisicos: **100**.
- Locales ancla: **4**.
- Componentes boutique: **96**.
- Codigos comerciales con mas de un componente: **16**.
- Solapamientos entre componentes del mismo local: **16**.
- Solapamientos entre locales distintos: **24**.
- Muebles o elementos comunes fuera de locales: **40**.
- Supabase verificado: **100 espacios**, **100 vinculos** y la misma geometria del inventario.
- Las 100 placas `display_code` quedaron reconciliadas con el frontend.

## Solapamientos entre locales distintos

| Local A | Componente A | Local B | Componente B | Rectangulo compartido | Area |
| --- | --- | --- | --- | --- | ---: |
| SE-10 | phys_b_f1_xn_zn_horizontal_01 | S-107 | phys_b_f1_xn_zn_vertical_02 | X -29..-17; Z -35..-29 | 72 |
| E-108 | phys_b_f1_xn_zn_horizontal_02 | SE-10 | phys_b_f1_xn_zn_vertical_01 | X -35..-29; Z -29..-17 | 72 |
| E-108 | phys_b_f1_xn_zn_horizontal_02 | S-107 | phys_b_f1_xn_zn_vertical_02 | X -35..-29; Z -35..-29 | 36 |
| EN-10 | phys_b_f1_xn_zp_horizontal_01 | N-108 | phys_b_f1_xn_zp_vertical_02 | X -29..-17; Z 29..35 | 72 |
| E-107 | phys_b_f1_xn_zp_horizontal_02 | EN-10 | phys_b_f1_xn_zp_vertical_01 | X -35..-29; Z 17..29 | 72 |
| E-107 | phys_b_f1_xn_zp_horizontal_02 | N-108 | phys_b_f1_xn_zp_vertical_02 | X -35..-29; Z 29..35 | 36 |
| OS-10 | phys_b_f1_xp_zn_horizontal_01 | S-108 | phys_b_f1_xp_zn_vertical_02 | X 17..29; Z -35..-29 | 72 |
| O-107 | phys_b_f1_xp_zn_horizontal_02 | OS-10 | phys_b_f1_xp_zn_vertical_01 | X 29..35; Z -29..-17 | 72 |
| O-107 | phys_b_f1_xp_zn_horizontal_02 | S-108 | phys_b_f1_xp_zn_vertical_02 | X 29..35; Z -35..-29 | 36 |
| NO-10 | phys_b_f1_xp_zp_horizontal_01 | N-107 | phys_b_f1_xp_zp_vertical_02 | X 17..29; Z 29..35 | 72 |
| O-108 | phys_b_f1_xp_zp_horizontal_02 | NO-10 | phys_b_f1_xp_zp_vertical_01 | X 29..35; Z 17..29 | 72 |
| O-108 | phys_b_f1_xp_zp_horizontal_02 | N-107 | phys_b_f1_xp_zp_vertical_02 | X 29..35; Z 29..35 | 36 |
| SE-20 | phys_b_f2_xn_zn_horizontal_01 | S-209 | phys_b_f2_xn_zn_vertical_02 | X -29..-17; Z -35..-29 | 72 |
| E-210 | phys_b_f2_xn_zn_horizontal_02 | SE-20 | phys_b_f2_xn_zn_vertical_01 | X -35..-29; Z -29..-17 | 72 |
| E-210 | phys_b_f2_xn_zn_horizontal_02 | S-209 | phys_b_f2_xn_zn_vertical_02 | X -35..-29; Z -35..-29 | 36 |
| EN-20 | phys_b_f2_xn_zp_horizontal_01 | N-210 | phys_b_f2_xn_zp_vertical_02 | X -29..-17; Z 29..35 | 72 |
| E-209 | phys_b_f2_xn_zp_horizontal_02 | EN-20 | phys_b_f2_xn_zp_vertical_01 | X -35..-29; Z 17..29 | 72 |
| E-209 | phys_b_f2_xn_zp_horizontal_02 | N-210 | phys_b_f2_xn_zp_vertical_02 | X -35..-29; Z 29..35 | 36 |
| OS-20 | phys_b_f2_xp_zn_horizontal_01 | S-210 | phys_b_f2_xp_zn_vertical_02 | X 17..29; Z -35..-29 | 72 |
| O-209 | phys_b_f2_xp_zn_horizontal_02 | OS-20 | phys_b_f2_xp_zn_vertical_01 | X 29..35; Z -29..-17 | 72 |
| O-209 | phys_b_f2_xp_zn_horizontal_02 | S-210 | phys_b_f2_xp_zn_vertical_02 | X 29..35; Z -35..-29 | 36 |
| NO-20 | phys_b_f2_xp_zp_horizontal_01 | N-209 | phys_b_f2_xp_zp_vertical_02 | X 17..29; Z 29..35 | 72 |
| O-210 | phys_b_f2_xp_zp_horizontal_02 | NO-20 | phys_b_f2_xp_zp_vertical_01 | X 29..35; Z 17..29 | 72 |
| O-210 | phys_b_f2_xp_zp_horizontal_02 | N-209 | phys_b_f2_xp_zp_vertical_02 | X 29..35; Z 29..35 | 36 |

## Locales formados por varios componentes

| Codigo | Componentes |
| --- | --- |
| E-201 | phys_b_f2_xn_zp_horizontal_06, phys_b_f2_xn_zp_horizontal_07 |
| E-202 | phys_b_f2_xn_zn_horizontal_06, phys_b_f2_xn_zn_horizontal_07 |
| EN-10 | phys_b_f1_xn_zp_horizontal_01, phys_b_f1_xn_zp_vertical_01 |
| EN-20 | phys_b_f2_xn_zp_horizontal_01, phys_b_f2_xn_zp_vertical_01 |
| N-201 | phys_b_f2_xp_zp_vertical_06, phys_b_f2_xp_zp_vertical_07 |
| N-202 | phys_b_f2_xn_zp_vertical_06, phys_b_f2_xn_zp_vertical_07 |
| NO-10 | phys_b_f1_xp_zp_horizontal_01, phys_b_f1_xp_zp_vertical_01 |
| NO-20 | phys_b_f2_xp_zp_horizontal_01, phys_b_f2_xp_zp_vertical_01 |
| O-201 | phys_b_f2_xp_zn_horizontal_06, phys_b_f2_xp_zn_horizontal_07 |
| O-202 | phys_b_f2_xp_zp_horizontal_06, phys_b_f2_xp_zp_horizontal_07 |
| OS-10 | phys_b_f1_xp_zn_horizontal_01, phys_b_f1_xp_zn_vertical_01 |
| OS-20 | phys_b_f2_xp_zn_horizontal_01, phys_b_f2_xp_zn_vertical_01 |
| S-201 | phys_b_f2_xn_zn_vertical_06, phys_b_f2_xn_zn_vertical_07 |
| S-202 | phys_b_f2_xp_zn_vertical_06, phys_b_f2_xp_zn_vertical_07 |
| SE-10 | phys_b_f1_xn_zn_horizontal_01, phys_b_f1_xn_zn_vertical_01 |
| SE-20 | phys_b_f2_xn_zn_horizontal_01, phys_b_f2_xn_zn_vertical_01 |

## Mobiliario fuera de locales

El archivo `furniture_outside_store_spaces_20260805.csv` contiene las coordenadas individuales.
Estos elementos son urbanismo interior intencional: bancas, maceteros, fuente, pantallas y totems.
No se consideran invasiones porque estan ubicados en pasillos o areas comunes.

## Fuente de verdad

- La placa visible se calcula con `PHYSICAL_SPACE_PLATE_OVERRIDES` y `STORE_CODE_RENAMES`.
- El inventario nuevo no incluye `source_code`; conserva `physicalSpaceId` y `displayCode`.
- La retirada de `source_code` queda en una migracion separada para ejecutarla despues de publicar el frontend compatible.
- Las coordenadas siguen describiendo componentes 3D. Los solapamientos listados deben resolverse antes de tratarlos como superficies comerciales exclusivas.
