-- Reconciliacion generada desde la geometria y placas activas del frontend.
-- Es idempotente y conserva un respaldo anterior a la primera ejecucion.
begin;

create table if not exists public._backup_physical_spaces_20260805 as
select * from public.physical_spaces;

create table if not exists public._backup_store_physical_links_20260805 as
select * from public.store_physical_links;

alter table public._backup_physical_spaces_20260805 enable row level security;
alter table public._backup_store_physical_links_20260805 enable row level security;

do $$
begin
    if (select count(*) from public.physical_spaces) <> 100 then
        raise exception 'Se esperaban 100 physical_spaces; se encontraron %',
            (select count(*) from public.physical_spaces);
    end if;
end;
$$;

create temporary table expected_physical_codes (
    physical_space_id text primary key,
    display_code text not null
) on commit drop;

insert into expected_physical_codes (physical_space_id, display_code)
values
        ('phys_anchor_e', 'E'),
        ('phys_anchor_n', 'N'),
        ('phys_anchor_o', 'O'),
        ('phys_anchor_s', 'S'),
        ('phys_b_f1_xn_zn_horizontal_01', 'SE-10'),
        ('phys_b_f1_xn_zn_horizontal_02', 'E-108'),
        ('phys_b_f1_xn_zn_horizontal_03', 'E-106'),
        ('phys_b_f1_xn_zn_horizontal_04', 'E-104'),
        ('phys_b_f1_xn_zn_horizontal_05', 'E-102'),
        ('phys_b_f1_xn_zn_vertical_01', 'SE-10'),
        ('phys_b_f1_xn_zn_vertical_02', 'S-107'),
        ('phys_b_f1_xn_zn_vertical_03', 'S-105'),
        ('phys_b_f1_xn_zn_vertical_04', 'S-103'),
        ('phys_b_f1_xn_zn_vertical_05', 'S-101'),
        ('phys_b_f1_xn_zp_horizontal_01', 'EN-10'),
        ('phys_b_f1_xn_zp_horizontal_02', 'E-107'),
        ('phys_b_f1_xn_zp_horizontal_03', 'E-105'),
        ('phys_b_f1_xn_zp_horizontal_04', 'E-103'),
        ('phys_b_f1_xn_zp_horizontal_05', 'E-101'),
        ('phys_b_f1_xn_zp_vertical_01', 'EN-10'),
        ('phys_b_f1_xn_zp_vertical_02', 'N-108'),
        ('phys_b_f1_xn_zp_vertical_03', 'N-106'),
        ('phys_b_f1_xn_zp_vertical_04', 'N-104'),
        ('phys_b_f1_xn_zp_vertical_05', 'N-102'),
        ('phys_b_f1_xp_zn_horizontal_01', 'OS-10'),
        ('phys_b_f1_xp_zn_horizontal_02', 'O-107'),
        ('phys_b_f1_xp_zn_horizontal_03', 'O-105'),
        ('phys_b_f1_xp_zn_horizontal_04', 'O-103'),
        ('phys_b_f1_xp_zn_horizontal_05', 'O-101'),
        ('phys_b_f1_xp_zn_vertical_01', 'OS-10'),
        ('phys_b_f1_xp_zn_vertical_02', 'S-108'),
        ('phys_b_f1_xp_zn_vertical_03', 'S-106'),
        ('phys_b_f1_xp_zn_vertical_04', 'S-104'),
        ('phys_b_f1_xp_zn_vertical_05', 'S-102'),
        ('phys_b_f1_xp_zp_horizontal_01', 'NO-10'),
        ('phys_b_f1_xp_zp_horizontal_02', 'O-108'),
        ('phys_b_f1_xp_zp_horizontal_03', 'O-106'),
        ('phys_b_f1_xp_zp_horizontal_04', 'O-104'),
        ('phys_b_f1_xp_zp_horizontal_05', 'O-102'),
        ('phys_b_f1_xp_zp_vertical_01', 'NO-10'),
        ('phys_b_f1_xp_zp_vertical_02', 'N-107'),
        ('phys_b_f1_xp_zp_vertical_03', 'N-105'),
        ('phys_b_f1_xp_zp_vertical_04', 'N-103'),
        ('phys_b_f1_xp_zp_vertical_05', 'N-101'),
        ('phys_b_f2_xn_zn_horizontal_01', 'SE-20'),
        ('phys_b_f2_xn_zn_horizontal_02', 'E-210'),
        ('phys_b_f2_xn_zn_horizontal_03', 'E-208'),
        ('phys_b_f2_xn_zn_horizontal_04', 'E-206'),
        ('phys_b_f2_xn_zn_horizontal_05', 'E-204'),
        ('phys_b_f2_xn_zn_horizontal_06', 'E-202'),
        ('phys_b_f2_xn_zn_horizontal_07', 'E-202'),
        ('phys_b_f2_xn_zn_vertical_01', 'SE-20'),
        ('phys_b_f2_xn_zn_vertical_02', 'S-209'),
        ('phys_b_f2_xn_zn_vertical_03', 'S-207'),
        ('phys_b_f2_xn_zn_vertical_04', 'S-205'),
        ('phys_b_f2_xn_zn_vertical_05', 'S-203'),
        ('phys_b_f2_xn_zn_vertical_06', 'S-201'),
        ('phys_b_f2_xn_zn_vertical_07', 'S-201'),
        ('phys_b_f2_xn_zp_horizontal_01', 'EN-20'),
        ('phys_b_f2_xn_zp_horizontal_02', 'E-209'),
        ('phys_b_f2_xn_zp_horizontal_03', 'E-207'),
        ('phys_b_f2_xn_zp_horizontal_04', 'E-205'),
        ('phys_b_f2_xn_zp_horizontal_05', 'E-203'),
        ('phys_b_f2_xn_zp_horizontal_06', 'E-201'),
        ('phys_b_f2_xn_zp_horizontal_07', 'E-201'),
        ('phys_b_f2_xn_zp_vertical_01', 'EN-20'),
        ('phys_b_f2_xn_zp_vertical_02', 'N-210'),
        ('phys_b_f2_xn_zp_vertical_03', 'N-208'),
        ('phys_b_f2_xn_zp_vertical_04', 'N-206'),
        ('phys_b_f2_xn_zp_vertical_05', 'N-204'),
        ('phys_b_f2_xn_zp_vertical_06', 'N-202'),
        ('phys_b_f2_xn_zp_vertical_07', 'N-202'),
        ('phys_b_f2_xp_zn_horizontal_01', 'OS-20'),
        ('phys_b_f2_xp_zn_horizontal_02', 'O-209'),
        ('phys_b_f2_xp_zn_horizontal_03', 'O-207'),
        ('phys_b_f2_xp_zn_horizontal_04', 'O-205'),
        ('phys_b_f2_xp_zn_horizontal_05', 'O-203'),
        ('phys_b_f2_xp_zn_horizontal_06', 'O-201'),
        ('phys_b_f2_xp_zn_horizontal_07', 'O-201'),
        ('phys_b_f2_xp_zn_vertical_01', 'OS-20'),
        ('phys_b_f2_xp_zn_vertical_02', 'S-210'),
        ('phys_b_f2_xp_zn_vertical_03', 'S-208'),
        ('phys_b_f2_xp_zn_vertical_04', 'S-206'),
        ('phys_b_f2_xp_zn_vertical_05', 'S-204'),
        ('phys_b_f2_xp_zn_vertical_06', 'S-202'),
        ('phys_b_f2_xp_zn_vertical_07', 'S-202'),
        ('phys_b_f2_xp_zp_horizontal_01', 'NO-20'),
        ('phys_b_f2_xp_zp_horizontal_02', 'O-210'),
        ('phys_b_f2_xp_zp_horizontal_03', 'O-208'),
        ('phys_b_f2_xp_zp_horizontal_04', 'O-206'),
        ('phys_b_f2_xp_zp_horizontal_05', 'O-204'),
        ('phys_b_f2_xp_zp_horizontal_06', 'O-202'),
        ('phys_b_f2_xp_zp_horizontal_07', 'O-202'),
        ('phys_b_f2_xp_zp_vertical_01', 'NO-20'),
        ('phys_b_f2_xp_zp_vertical_02', 'N-209'),
        ('phys_b_f2_xp_zp_vertical_03', 'N-207'),
        ('phys_b_f2_xp_zp_vertical_04', 'N-205'),
        ('phys_b_f2_xp_zp_vertical_05', 'N-203'),
        ('phys_b_f2_xp_zp_vertical_06', 'N-201'),
        ('phys_b_f2_xp_zp_vertical_07', 'N-201');

do $$
begin
    if exists (
        select 1
        from expected_physical_codes expected
        full join public.physical_spaces actual using (physical_space_id)
        where expected.physical_space_id is null or actual.physical_space_id is null
    ) then
        raise exception 'Los physical_space_id no coinciden con el inventario esperado';
    end if;
end;
$$;

update public.physical_spaces ps
set display_code = expected.display_code,
    updated_at = now()
from expected_physical_codes expected
where ps.physical_space_id = expected.physical_space_id
  and ps.display_code is distinct from expected.display_code;

commit;

select display_code, count(*) as component_count
from public.physical_spaces
group by display_code
having count(*) > 1
order by display_code;
