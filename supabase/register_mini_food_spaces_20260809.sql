-- Registra los ocho puestos de alimentos creados en los vacios del primer piso.
-- Cada fila representa una propiedad fisica independiente. El locatario se
-- vincula posteriormente mediante store_physical_links.
begin;

insert into public.physical_spaces (
    physical_space_id,
    kind,
    floor_label,
    axis,
    quadrant,
    slot_index,
    display_code,
    x1, z1,
    x2, z2,
    x3, z3,
    x4, z4,
    y1,
    y2,
    inventory_status,
    inventory_notes,
    teleport_x,
    teleport_y,
    teleport_z,
    teleport_target_x,
    teleport_target_y,
    teleport_target_z,
    teleport_notes
)
values
    ('phys_m_f1_xn_zn_horizontal_01', 'micro', '1', 'horizontal', 'xn_zn', 1, 'FE-02', -59, -35, -53, -35, -53, -17, -59, -17, 0, 5.20, 'candidate_store', 'Puesto de alimentos; mostrador izquierdo y acceso derecho.', -54.50, 1.80, -15.50, -56.00, 1.80, -24.00, 'Llegada frente al acceso libre del puesto.'),
    ('phys_m_f1_xn_zn_vertical_01',   'micro', '1', 'vertical',   'xn_zn', 1, 'FS-01', -35, -59, -17, -59, -17, -53, -35, -53, 0, 5.20, 'candidate_store', 'Puesto de alimentos; mostrador izquierdo y acceso derecho.', -15.50, 1.80, -54.50, -24.00, 1.80, -56.00, 'Llegada frente al acceso libre del puesto.'),
    ('phys_m_f1_xn_zp_horizontal_01', 'micro', '1', 'horizontal', 'xn_zp', 1, 'FE-01', -59,  17, -53,  17, -53,  35, -59,  35, 0, 5.20, 'candidate_store', 'Puesto de alimentos; mostrador izquierdo y acceso derecho.', -57.50, 1.80,  15.50, -56.00, 1.80,  24.00, 'Llegada frente al acceso libre del puesto.'),
    ('phys_m_f1_xn_zp_vertical_01',   'micro', '1', 'vertical',   'xn_zp', 1, 'FN-02', -35,  53, -17,  53, -17,  59, -35,  59, 0, 5.20, 'candidate_store', 'Puesto de alimentos; mostrador izquierdo y acceso derecho.', -15.50, 1.80,  57.50, -24.00, 1.80,  56.00, 'Llegada frente al acceso libre del puesto.'),
    ('phys_m_f1_xp_zn_horizontal_01', 'micro', '1', 'horizontal', 'xp_zn', 1, 'FO-01',  53, -35,  59, -35,  59, -17,  53, -17, 0, 5.20, 'candidate_store', 'Puesto de alimentos; mostrador izquierdo y acceso derecho.',  57.50, 1.80, -15.50,  56.00, 1.80, -24.00, 'Llegada frente al acceso libre del puesto.'),
    ('phys_m_f1_xp_zn_vertical_01',   'micro', '1', 'vertical',   'xp_zn', 1, 'FS-02',  17, -59,  35, -59,  35, -53,  17, -53, 0, 5.20, 'candidate_store', 'Puesto de alimentos; mostrador izquierdo y acceso derecho.',  15.50, 1.80, -57.50,  24.00, 1.80, -56.00, 'Llegada frente al acceso libre del puesto.'),
    ('phys_m_f1_xp_zp_horizontal_01', 'micro', '1', 'horizontal', 'xp_zp', 1, 'FO-02',  53,  17,  59,  17,  59,  35,  53,  35, 0, 5.20, 'candidate_store', 'Puesto de alimentos; mostrador izquierdo y acceso derecho.',  54.50, 1.80,  15.50,  56.00, 1.80,  24.00, 'Llegada frente al acceso libre del puesto.'),
    ('phys_m_f1_xp_zp_vertical_01',   'micro', '1', 'vertical',   'xp_zp', 1, 'FN-01',  17,  53,  35,  53,  35,  59,  17,  59, 0, 5.20, 'candidate_store', 'Puesto de alimentos; mostrador izquierdo y acceso derecho.',  15.50, 1.80,  54.50,  24.00, 1.80,  56.00, 'Llegada frente al acceso libre del puesto.')
on conflict (physical_space_id) do update
set display_code = excluded.display_code,
    updated_at = now();

do $$
declare
    registered_count integer;
begin
    select count(*)
    into registered_count
    from public.physical_spaces
    where physical_space_id like 'phys_m_f1_%';

    if registered_count <> 8 then
        raise exception 'Se esperaban 8 puestos micro registrados; se encontraron %', registered_count;
    end if;
end;
$$;

commit;

-- Verificacion: deben aparecer ocho filas, inicialmente sin store_id.
select
    ps.physical_space_id,
    ps.display_code,
    ps.kind,
    ps.inventory_status,
    spl.store_id
from public.physical_spaces ps
left join public.store_physical_links spl
    on spl.physical_space_id = ps.physical_space_id
where ps.physical_space_id like 'phys_m_f1_%'
order by ps.display_code;
