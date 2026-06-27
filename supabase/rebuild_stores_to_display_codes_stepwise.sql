-- Ejecutar por etapas en el SQL Editor de Supabase.
-- Cada etapa puede correrse completa en una consulta nueva.

-- =========================================================
-- ETAPA 1: Construir mapas auxiliares
-- =========================================================

drop table if exists public._codex_store_target_map;
drop table if exists public._codex_store_winners;
drop table if exists public._codex_store_child_state;
drop table if exists public._codex_store_physical_links_rebuilt;

create table public._codex_store_target_map (
    old_store_id text primary key,
    new_store_id text not null
);

insert into public._codex_store_target_map (old_store_id, new_store_id)
select
    s.id as old_store_id,
    coalesce(
        linked_space.display_code,
        source_space.display_code,
        display_space.display_code,
        nullif(trim(s.local_code), ''),
        trim(s.id)
    ) as new_store_id
from public.stores s
left join lateral (
    select ps.display_code
    from public.store_physical_links spl
    join public.physical_spaces ps
      on ps.physical_space_id = spl.physical_space_id
    where spl.store_id = s.id
      and nullif(trim(ps.display_code), '') is not null
    order by spl.is_primary desc, spl.id asc
    limit 1
) linked_space on true
left join lateral (
    select ps.display_code
    from public.physical_spaces ps
    where upper(regexp_replace(trim(coalesce(ps.source_code, '')), '[^A-Z0-9]+', '', 'g')) =
          upper(regexp_replace(trim(coalesce(s.id, '')), '[^A-Z0-9]+', '', 'g'))
      and nullif(trim(ps.display_code), '') is not null
    order by ps.physical_space_id
    limit 1
) source_space on true
left join lateral (
    select ps.display_code
    from public.physical_spaces ps
    where upper(regexp_replace(trim(coalesce(ps.display_code, '')), '[^A-Z0-9]+', '', 'g')) =
          upper(regexp_replace(trim(coalesce(s.local_code, '')), '[^A-Z0-9]+', '', 'g'))
      and nullif(trim(ps.display_code), '') is not null
    order by ps.physical_space_id
    limit 1
) display_space on true;

create table public._codex_store_winners as
select distinct on (m.new_store_id)
    m.new_store_id,
    s.id as old_store_id,
    s.owner_id,
    s.slug,
    s.name,
    s.category,
    s.contact_email,
    s.contact_phone,
    s.whatsapp,
    s.logo_url,
    s.shelf_style,
    s.primary_color,
    s.checkout_mode,
    s.telegram_notifications_enabled,
    s.telegram_chat_id,
    s.telegram_chat_username,
    s.telegram_link_code,
    s.telegram_verified_at,
    s.service_status,
    s.service_status_note,
    s.service_suspended_at,
    s.created_at,
    s.updated_at
from public._codex_store_target_map m
join public.stores s
  on s.id = m.old_store_id
order by
    m.new_store_id,
    (s.owner_id is not null) desc,
    (nullif(trim(coalesce(s.contact_email, '')), '') is not null) desc,
    (nullif(trim(coalesce(s.name, '')), '') is not null) desc,
    s.updated_at desc nulls last,
    s.created_at desc nulls last,
    s.id asc;

create table public._codex_store_child_state as
select
    s.id as old_store_id,
    m.new_store_id,
    m.new_store_id as new_local_code
from public.stores s
join public._codex_store_target_map m
  on m.old_store_id = s.id;

create table public._codex_store_physical_links_rebuilt as
select distinct
    spl.physical_space_id,
    cs.new_store_id as store_id,
    case
        when count(*) over (partition by cs.new_store_id) > 1 then 'shared_front'
        else coalesce(spl.relation_type, 'exclusive')
    end as relation_type,
    row_number() over (
        partition by cs.new_store_id
        order by spl.is_primary desc, spl.id asc
    ) = 1 as is_primary,
    min(spl.created_at) over (partition by spl.physical_space_id, cs.new_store_id) as created_at,
    now()::timestamptz as updated_at
from public.store_physical_links spl
join public._codex_store_child_state cs
  on cs.old_store_id = spl.store_id;

select 'ETAPA 1 OK' as status;

-- =========================================================
-- ETAPA 2: Actualizar tablas hijas
-- =========================================================

alter table public.store_rent_rates drop constraint if exists store_rent_rates_store_id_fkey;
alter table public.tenant_leases drop constraint if exists tenant_leases_store_id_fkey;
alter table public.tenant_payments drop constraint if exists tenant_payments_store_id_fkey;
alter table public.tenant_notes drop constraint if exists tenant_notes_store_id_fkey;
alter table public.store_physical_links drop constraint if exists store_physical_links_store_id_fkey;

update public.store_rent_rates rr
set store_id = cs.new_store_id,
    local_code = cs.new_local_code
from public._codex_store_child_state cs
where rr.store_id = cs.old_store_id;

update public.tenant_leases tl
set store_id = cs.new_store_id,
    local_code = cs.new_local_code
from public._codex_store_child_state cs
where tl.store_id = cs.old_store_id;

update public.tenant_payments tp
set store_id = cs.new_store_id,
    local_code = cs.new_local_code
from public._codex_store_child_state cs
where tp.store_id = cs.old_store_id;

update public.tenant_notes tn
set store_id = cs.new_store_id,
    local_code = cs.new_local_code
from public._codex_store_child_state cs
where tn.store_id = cs.old_store_id;

update public.contact_messages cm
set store_id = cs.new_store_id
from public._codex_store_child_state cs
where cm.store_id = cs.old_store_id;

update public.mall_messages mm
set store_id = cs.new_store_id,
    local_code = cs.new_local_code
from public._codex_store_child_state cs
where mm.store_id = cs.old_store_id
   or upper(trim(coalesce(mm.local_code, ''))) = upper(trim(cs.old_store_id));

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'store_products'
          and column_name = 'store_id'
    ) then
        execute $sql$
            update public.store_products sp
            set store_id = cs.new_store_id
            from public._codex_store_child_state cs
            where sp.store_id = cs.old_store_id
        $sql$;
    end if;
end $$;

update public.store_products sp
set local_code = cs.new_local_code
from public._codex_store_child_state cs
where upper(trim(coalesce(sp.local_code, ''))) = upper(trim(cs.old_store_id))
   or upper(trim(coalesce(sp.local_code, ''))) = upper(trim(cs.new_store_id));

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'site_content'
          and column_name = 'store_id'
    ) then
        execute $sql$
            update public.site_content sc
            set store_id = cs.new_store_id
            from public._codex_store_child_state cs
            where sc.store_id = cs.old_store_id
        $sql$;
    end if;
end $$;

select 'ETAPA 2 OK' as status;

-- =========================================================
-- ETAPA 3: Reconstruir stores y vínculos físicos
-- =========================================================

delete from public.store_physical_links;
delete from public.stores;

insert into public.stores (
    id,
    local_code,
    owner_id,
    slug,
    name,
    category,
    contact_email,
    contact_phone,
    whatsapp,
    logo_url,
    shelf_style,
    primary_color,
    checkout_mode,
    telegram_notifications_enabled,
    telegram_chat_id,
    telegram_chat_username,
    telegram_link_code,
    telegram_verified_at,
    service_status,
    service_status_note,
    service_suspended_at,
    created_at,
    updated_at
)
select
    new_store_id as id,
    new_store_id as local_code,
    owner_id,
    slug,
    name,
    category,
    contact_email,
    contact_phone,
    whatsapp,
    logo_url,
    shelf_style,
    primary_color,
    checkout_mode,
    coalesce(telegram_notifications_enabled, false),
    telegram_chat_id,
    telegram_chat_username,
    telegram_link_code,
    telegram_verified_at,
    coalesce(service_status, 'active'),
    service_status_note,
    service_suspended_at,
    created_at,
    updated_at
from public._codex_store_winners;

insert into public.store_physical_links (
    physical_space_id,
    store_id,
    relation_type,
    is_primary,
    created_at,
    updated_at
)
select
    physical_space_id,
    store_id,
    relation_type,
    is_primary,
    coalesce(created_at, now()),
    updated_at
from public._codex_store_physical_links_rebuilt;

select 'ETAPA 3 OK' as status;

-- =========================================================
-- ETAPA 4: Restaurar FKs y limpiar auxiliares
-- =========================================================

alter table public.store_rent_rates
    add constraint store_rent_rates_store_id_fkey
    foreign key (store_id) references public.stores(id) on delete cascade;

alter table public.tenant_leases
    add constraint tenant_leases_store_id_fkey
    foreign key (store_id) references public.stores(id) on delete restrict;

alter table public.tenant_payments
    add constraint tenant_payments_store_id_fkey
    foreign key (store_id) references public.stores(id) on delete restrict;

alter table public.tenant_notes
    add constraint tenant_notes_store_id_fkey
    foreign key (store_id) references public.stores(id) on delete cascade;

alter table public.store_physical_links
    add constraint store_physical_links_store_id_fkey
    foreign key (store_id) references public.stores(id) on delete cascade;

drop table if exists public._codex_store_physical_links_rebuilt;
drop table if exists public._codex_store_child_state;
drop table if exists public._codex_store_winners;
drop table if exists public._codex_store_target_map;

select 'ETAPA 4 OK' as status;

-- Verificaciones sugeridas:
-- select id, local_code, owner_id, name from public.stores order by id;
-- select id, store_id, local_code from public.tenant_leases order by id;
-- select physical_space_id, store_id, relation_type, is_primary from public.store_physical_links order by store_id, physical_space_id;
