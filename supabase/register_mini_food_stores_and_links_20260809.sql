-- Crea la identidad comercial de los ocho puestos de alimentos ya
-- inventariados en physical_spaces y los vincula uno a uno.
-- Ejecutar completo en Supabase > SQL Editor.
begin;

do $$
declare
    conflicting_link_count integer;
begin
    select count(*)
    into conflicting_link_count
    from public.store_physical_links spl
    join public.physical_spaces ps
      on ps.physical_space_id = spl.physical_space_id
    where ps.physical_space_id in (
        'phys_m_f1_xn_zn_horizontal_01',
        'phys_m_f1_xn_zn_vertical_01',
        'phys_m_f1_xn_zp_horizontal_01',
        'phys_m_f1_xn_zp_vertical_01',
        'phys_m_f1_xp_zn_horizontal_01',
        'phys_m_f1_xp_zn_vertical_01',
        'phys_m_f1_xp_zp_horizontal_01',
        'phys_m_f1_xp_zp_vertical_01'
    )
      and spl.store_id is distinct from ps.display_code;

    if conflicting_link_count > 0 then
        raise exception 'Hay % vinculos comerciales previos incompatibles en los puestos de alimentos.', conflicting_link_count;
    end if;
end;
$$;

insert into public.stores (
    id,
    local_code,
    name,
    category,
    shelf_style,
    primary_color,
    checkout_mode,
    service_status,
    updated_at
)
values
    ('FO-01', 'FO-01', 'FO-01', 'Alimentos y bebidas', 'madera', '#c9a66b', 'whatsapp', 'active', now()),
    ('FO-02', 'FO-02', 'FO-02', 'Alimentos y bebidas', 'madera', '#c9a66b', 'whatsapp', 'active', now()),
    ('FE-01', 'FE-01', 'FE-01', 'Alimentos y bebidas', 'madera', '#c9a66b', 'whatsapp', 'active', now()),
    ('FE-02', 'FE-02', 'FE-02', 'Alimentos y bebidas', 'madera', '#c9a66b', 'whatsapp', 'active', now()),
    ('FS-01', 'FS-01', 'FS-01', 'Alimentos y bebidas', 'madera', '#c9a66b', 'whatsapp', 'active', now()),
    ('FS-02', 'FS-02', 'FS-02', 'Alimentos y bebidas', 'madera', '#c9a66b', 'whatsapp', 'active', now()),
    ('FN-01', 'FN-01', 'FN-01', 'Alimentos y bebidas', 'madera', '#c9a66b', 'whatsapp', 'active', now()),
    ('FN-02', 'FN-02', 'FN-02', 'Alimentos y bebidas', 'madera', '#c9a66b', 'whatsapp', 'active', now())
on conflict (id) do update
set local_code = excluded.local_code,
    category = coalesce(public.stores.category, excluded.category),
    updated_at = now();

insert into public.store_physical_links (
    physical_space_id,
    store_id,
    relation_type,
    is_primary,
    updated_at
)
select
    ps.physical_space_id,
    ps.display_code,
    'exclusive',
    true,
    now()
from public.physical_spaces ps
where ps.physical_space_id in (
    'phys_m_f1_xn_zn_horizontal_01',
    'phys_m_f1_xn_zn_vertical_01',
    'phys_m_f1_xn_zp_horizontal_01',
    'phys_m_f1_xn_zp_vertical_01',
    'phys_m_f1_xp_zn_horizontal_01',
    'phys_m_f1_xp_zn_vertical_01',
    'phys_m_f1_xp_zp_horizontal_01',
    'phys_m_f1_xp_zp_vertical_01'
)
on conflict (physical_space_id, store_id) do update
set relation_type = excluded.relation_type,
    is_primary = excluded.is_primary,
    updated_at = now();

-- physical_space_legacy_codes_20260805 conserva exclusivamente source_code
-- historicos. Estos puestos nacieron con identidad vigente y no poseen alias
-- legado; insertar FO/FE/FS/FN alli convertiría un código actual en legado.

do $$
declare
    store_count integer;
    link_count integer;
begin
    select count(*) into store_count
    from public.stores
    where id in ('FO-01', 'FO-02', 'FE-01', 'FE-02', 'FS-01', 'FS-02', 'FN-01', 'FN-02')
      and local_code = id;

    select count(*) into link_count
    from public.store_physical_links spl
    join public.physical_spaces ps
      on ps.physical_space_id = spl.physical_space_id
     and ps.display_code = spl.store_id
    where spl.store_id in ('FO-01', 'FO-02', 'FE-01', 'FE-02', 'FS-01', 'FS-02', 'FN-01', 'FN-02');

    if store_count <> 8 or link_count <> 8 then
        raise exception 'Validacion fallida: stores=%, links=%; se esperaban 8 y 8.', store_count, link_count;
    end if;
end;
$$;

commit;

select
    s.id,
    s.local_code,
    s.name,
    s.category,
    ps.physical_space_id,
    ps.display_code,
    spl.relation_type,
    spl.is_primary
from public.stores s
join public.store_physical_links spl on spl.store_id = s.id
join public.physical_spaces ps on ps.physical_space_id = spl.physical_space_id
where s.id in ('FO-01', 'FO-02', 'FE-01', 'FE-02', 'FS-01', 'FS-02', 'FN-01', 'FN-02')
order by s.id;
