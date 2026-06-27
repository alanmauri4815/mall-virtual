# Reporte de placas físicas vs Supabase

- Total espacios revisados: **100**
- Total mismatches entre `plate_code_3d` y `display_code_supabase`: **76**

## Resumen de mismatches por piso

- Piso `1`: 20
- Piso `2`: 56

## Resumen de mismatches por tipo

- `boutique`: 76

## Primeros mismatches detectados

| physical_space_id | floor | source_code | display_code_supabase | generated_code_3d | renamed_code_3d | plate_code_3d |
| --- | --- | --- | --- | --- | --- | --- |
| phys_b_f1_xn_zn_horizontal_02 | 1 | S102 | O-107 | S102 | O-107 | E-108 |
| phys_b_f1_xn_zn_horizontal_03 | 1 | S103 | O-105 | S103 | O-105 | E-106 |
| phys_b_f1_xn_zn_horizontal_04 | 1 | S104 | O-103 | S104 | O-103 | E-104 |
| phys_b_f1_xn_zn_horizontal_05 | 1 | S105 | O-101 | S105 | O-101 | E-102 |
| phys_b_f1_xn_zp_horizontal_01 | 1 | N101 | N101 | N101 | N101 | EN-10 |
| phys_b_f1_xn_zp_horizontal_02 | 1 | N102 | O-108 | N102 | O-108 | E-107 |
| phys_b_f1_xn_zp_horizontal_03 | 1 | N103 | O-106 | N103 | O-106 | E-105 |
| phys_b_f1_xn_zp_horizontal_04 | 1 | N104 | O-104 | N104 | O-104 | E-103 |
| phys_b_f1_xn_zp_horizontal_05 | 1 | N105 | O-102 | N105 | O-102 | E-101 |
| phys_b_f1_xn_zp_vertical_01 | 1 | E101 | SE-10 | E101 | SE-10 | EN-10 |
| phys_b_f1_xn_zp_vertical_02 | 1 | E102 | S-107 | E102 | S-107 | N-108 |
| phys_b_f1_xn_zp_vertical_03 | 1 | E103 | S-105 | E103 | S-105 | N-106 |
| phys_b_f1_xn_zp_vertical_04 | 1 | E104 | S-103 | E104 | S-103 | N-104 |
| phys_b_f1_xn_zp_vertical_05 | 1 | E105 | S-101 | E105 | S-101 | N-102 |
| phys_b_f1_xp_zp_horizontal_01 | 1 | N101 | N101 | N101 | N101 | NO-10 |
| phys_b_f1_xp_zp_vertical_01 | 1 | O101 | OS-10 | O101 | OS-10 | NO-10 |
| phys_b_f1_xp_zp_vertical_02 | 1 | O102 | S-108 | O102 | S-108 | N-107 |
| phys_b_f1_xp_zp_vertical_03 | 1 | O103 | S-106 | O103 | S-106 | N-105 |
| phys_b_f1_xp_zp_vertical_04 | 1 | O104 | S-104 | O104 | S-104 | N-103 |
| phys_b_f1_xp_zp_vertical_05 | 1 | O105 | S-102 | O105 | S-102 | N-101 |
| phys_b_f2_xn_zn_horizontal_01 | 2 | S201 | S201 | S201 | S201 | SE-20 |
| phys_b_f2_xn_zn_horizontal_02 | 2 | S202 | S202 | S202 | S202 | E-210 |
| phys_b_f2_xn_zn_horizontal_03 | 2 | S203 | S203 | S203 | S203 | E-208 |
| phys_b_f2_xn_zn_horizontal_04 | 2 | S204 | S204 | S204 | S204 | E-206 |
| phys_b_f2_xn_zn_horizontal_05 | 2 | S205 | S205 | S205 | S205 | E-204 |
| phys_b_f2_xn_zn_horizontal_06 | 2 | S206 | S206 | S206 | S206 | E-202 |
| phys_b_f2_xn_zn_horizontal_07 | 2 | S207 | S207 | S207 | S207 | E-202 |
| phys_b_f2_xn_zn_vertical_01 | 2 | E201 | E201 | E201 | E201 | SE-20 |
| phys_b_f2_xn_zn_vertical_02 | 2 | E202 | E202 | E202 | E202 | S-209 |
| phys_b_f2_xn_zn_vertical_03 | 2 | E203 | E203 | E203 | E203 | S-207 |
| phys_b_f2_xn_zn_vertical_04 | 2 | E204 | E204 | E204 | E204 | S-205 |
| phys_b_f2_xn_zn_vertical_05 | 2 | E205 | E205 | E205 | E205 | S-203 |
| phys_b_f2_xn_zn_vertical_06 | 2 | E206 | E206 | E206 | E206 | S-201 |
| phys_b_f2_xn_zn_vertical_07 | 2 | E207 | E207 | E207 | E207 | S-201 |
| phys_b_f2_xn_zp_horizontal_01 | 2 | N201 | N201 | N201 | N201 | EN-20 |
| phys_b_f2_xn_zp_horizontal_02 | 2 | N202 | N202 | N202 | N202 | E-209 |
| phys_b_f2_xn_zp_horizontal_03 | 2 | N203 | N203 | N203 | N203 | E-207 |
| phys_b_f2_xn_zp_horizontal_04 | 2 | N204 | N204 | N204 | N204 | E-205 |
| phys_b_f2_xn_zp_horizontal_05 | 2 | N205 | N205 | N205 | N205 | E-203 |
| phys_b_f2_xn_zp_horizontal_06 | 2 | N206 | N206 | N206 | N206 | E-201 |

## Archivos generados

- CSV completo: `physical_space_plate_report.csv`
- Este resumen: `physical_space_plate_report.md`
