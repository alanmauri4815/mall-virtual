-- Crea el mall de ensayo aislado de Providencia.
-- Requiere las migraciones multimall de alcance, acceso y claves compuestas.
-- No copia locales, productos, usuarios, enlaces comerciales ni datos de visitantes.
begin;

do $$
declare
    v_test_mall_id constant uuid := '4a5ed5cf-6f03-4e7d-8fbb-3d01e151586d';
begin
    insert into public.malls (id, slug, display_name, commune, status, template_version)
    values (
        v_test_mall_id,
        'ensayo',
        'Mall de Ensayo',
        'Entorno de pruebas',
        'testing',
        'mall-shared-v1'
    )
    on conflict (id) do update
    set
        slug = excluded.slug,
        display_name = excluded.display_name,
        commune = excluded.commune,
        status = excluded.status,
        template_version = excluded.template_version;
end;
$$;

-- Replica solo la plantilla geométrica necesaria para asignar locales y
-- teletransportes. Los espacios no quedan enlazados a comercios.
insert into public.physical_spaces (
    mall_id,
    physical_space_id,
    kind,
    floor_label,
    axis,
    quadrant,
    slot_index,
    display_code,
    x1, z1, x2, z2, x3, z3, x4, z4,
    y1, y2,
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
select
    '4a5ed5cf-6f03-4e7d-8fbb-3d01e151586d'::uuid,
    physical_space_id,
    kind,
    floor_label,
    axis,
    quadrant,
    slot_index,
    display_code,
    x1, z1, x2, z2, x3, z3, x4, z4,
    y1, y2,
    inventory_status,
    inventory_notes,
    teleport_x,
    teleport_y,
    teleport_z,
    teleport_target_x,
    teleport_target_y,
    teleport_target_z,
    teleport_notes
from public.physical_spaces
where mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781'::uuid
on conflict (mall_id, physical_space_id) do nothing;

-- La versión anterior no recibía contexto y podía mezclar puntos de
-- teletransporte de distintos malls.
drop function if exists public.get_physical_space_teleport_points();
drop function if exists public.get_physical_space_teleport_points(uuid);

create function public.get_physical_space_teleport_points(p_mall_id uuid)
returns table (
    physical_space_id text,
    display_code text,
    floor_label text,
    camera_x numeric,
    camera_y numeric,
    camera_z numeric,
    look_x numeric,
    look_y numeric,
    look_z numeric
)
language sql
stable
security definer
set search_path = public
as $$
    select
        ps.physical_space_id,
        ps.display_code,
        ps.floor_label,
        ps.teleport_x as camera_x,
        ps.teleport_y as camera_y,
        ps.teleport_z as camera_z,
        ps.teleport_target_x as look_x,
        ps.teleport_target_y as look_y,
        ps.teleport_target_z as look_z
    from public.physical_spaces ps
    where ps.mall_id = p_mall_id
      and ps.teleport_x is not null
      and ps.teleport_y is not null
      and ps.teleport_z is not null
      and ps.teleport_target_x is not null
      and ps.teleport_target_y is not null
      and ps.teleport_target_z is not null;
$$;

revoke all on function public.get_physical_space_teleport_points(uuid) from public;
grant execute on function public.get_physical_space_teleport_points(uuid) to anon, authenticated;

commit;
