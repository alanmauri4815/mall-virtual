-- Cuarta fase multimall: identidad por mall para codigos y objetos.
-- Ejecutar despues de multimall_phase2_access_20260908.sql.
-- No crea un segundo mall ni duplica datos; prepara la estructura para hacerlo.

begin;

do $$
declare
    duplicate_count bigint;
begin
    select count(*) into duplicate_count
    from (
        select mall_id, local_code
        from public.stores
        group by mall_id, local_code
        having count(*) > 1
    ) duplicated;
    if duplicate_count > 0 then
        raise exception 'Hay % codigos de local duplicados dentro del mismo mall.', duplicate_count;
    end if;

    select count(*) into duplicate_count
    from (
        select mall_id, physical_space_id
        from public.physical_spaces
        group by mall_id, physical_space_id
        having count(*) > 1
    ) duplicated;
    if duplicate_count > 0 then
        raise exception 'Hay % espacios fisicos duplicados dentro del mismo mall.', duplicate_count;
    end if;

    select count(*) into duplicate_count
    from (
        select mall_id, object_id
        from public.mall_editable_objects
        group by mall_id, object_id
        having count(*) > 1
    ) duplicated;
    if duplicate_count > 0 then
        raise exception 'Hay % objetos editables duplicados dentro del mismo mall.', duplicate_count;
    end if;

    select count(*) into duplicate_count
    from (
        select mall_id, object_id
        from public.mall_object_overrides
        group by mall_id, object_id
        having count(*) > 1
    ) duplicated;
    if duplicate_count > 0 then
        raise exception 'Hay % overrides duplicados dentro del mismo mall.', duplicate_count;
    end if;

    select count(*) into duplicate_count
    from (
        select mall_id, physical_space_id, store_id
        from public.store_physical_links
        group by mall_id, physical_space_id, store_id
        having count(*) > 1
    ) duplicated;
    if duplicate_count > 0 then
        raise exception 'Hay % relaciones espacio-local duplicadas dentro del mismo mall.', duplicate_count;
    end if;
end;
$$;

do $$
declare
    null_count bigint;
    table_name text;
begin
    foreach table_name in array array[
        'stores',
        'store_products',
        'physical_spaces',
        'store_physical_links',
        'mall_editable_objects',
        'mall_object_overrides'
    ] loop
        execute format('select count(*) from public.%I where mall_id is null', table_name)
        into null_count;
        if null_count > 0 then
            raise exception 'La tabla % tiene % filas sin mall_id.', table_name, null_count;
        end if;
    end loop;
end;
$$;

alter table public.stores alter column mall_id set not null;
alter table public.store_products alter column mall_id set not null;
alter table public.physical_spaces alter column mall_id set not null;
alter table public.store_physical_links alter column mall_id set not null;
alter table public.mall_editable_objects alter column mall_id set not null;
alter table public.mall_object_overrides alter column mall_id set not null;

-- local_code y slug son identificadores visibles dentro de cada mall.
do $$
declare
    constraint_row record;
begin
    for constraint_row in
        select con.conname
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace nsp on nsp.oid = rel.relnamespace
        where nsp.nspname = 'public'
          and rel.relname = 'stores'
          and con.contype = 'u'
          and pg_get_constraintdef(con.oid) in ('UNIQUE (local_code)', 'UNIQUE (slug)')
    loop
        execute format('alter table public.stores drop constraint %I', constraint_row.conname);
    end loop;
end;
$$;

do $$
declare
    index_row record;
begin
    for index_row in
        select indexname
        from pg_indexes
        where schemaname = 'public'
          and tablename = 'stores'
          and indexdef ilike 'CREATE UNIQUE INDEX%'
          and indexdef ilike '%(local_code)%'
          and indexdef not ilike '%mall_id%'
    loop
        execute format('drop index if exists public.%I', index_row.indexname);
    end loop;
end;
$$;

create unique index if not exists stores_mall_local_code_uidx
on public.stores (mall_id, local_code);
create unique index if not exists stores_mall_slug_uidx
on public.stores (mall_id, slug)
where slug is not null;

-- Los objetos y sus overrides pueden repetir object_id en malls diferentes.
alter table public.mall_object_overrides
    drop constraint if exists mall_object_overrides_object_id_fkey;
alter table public.mall_editable_objects
    drop constraint if exists mall_editable_objects_pkey;
alter table public.mall_object_overrides
    drop constraint if exists mall_object_overrides_pkey;

alter table public.mall_editable_objects
    add primary key (mall_id, object_id);
alter table public.mall_object_overrides
    add primary key (mall_id, object_id);
alter table public.mall_object_overrides
    add constraint mall_object_overrides_mall_object_fkey
    foreign key (mall_id, object_id)
    references public.mall_editable_objects (mall_id, object_id)
    on delete cascade;

-- Los espacios fisicos tambien se identifican dentro de un mall.
alter table public.store_physical_links
    drop constraint if exists store_physical_links_physical_space_id_fkey;
alter table public.physical_spaces
    drop constraint if exists physical_spaces_pkey;
alter table public.physical_spaces
    add primary key (mall_id, physical_space_id);
alter table public.store_physical_links
    add constraint store_physical_links_mall_space_fkey
    foreign key (mall_id, physical_space_id)
    references public.physical_spaces (mall_id, physical_space_id)
    on delete cascade;

alter table public.store_physical_links
    drop constraint if exists store_physical_links_unique;
alter table public.store_physical_links
    add constraint store_physical_links_mall_unique
    unique (mall_id, physical_space_id, store_id);

comment on constraint mall_object_overrides_mall_object_fkey on public.mall_object_overrides is
    'Cada override pertenece al objeto del mismo mall.';
comment on constraint store_physical_links_mall_space_fkey on public.store_physical_links is
    'Cada enlace fisico pertenece al espacio del mismo mall.';

commit;
