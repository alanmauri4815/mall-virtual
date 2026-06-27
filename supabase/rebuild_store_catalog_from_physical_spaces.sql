begin;

drop table if exists public._codex_display_codes;
drop table if exists public._codex_store_candidates;
drop table if exists public._codex_store_winners;
drop table if exists public._codex_store_id_map;
drop table if exists public._codex_rebuilt_store_physical_links;

create table public._codex_display_codes as
select distinct
    trim(display_code) as display_code
from public.physical_spaces
where nullif(trim(display_code), '') is not null;

create unique index _codex_display_codes_pk
on public._codex_display_codes(display_code);

create table public._codex_store_candidates as
with normalized_spaces as (
    select
        physical_space_id,
        trim(display_code) as display_code,
        upper(regexp_replace(trim(coalesce(source_code, '')), '[^A-Z0-9]+', '', 'g')) as source_key,
        upper(regexp_replace(trim(coalesce(display_code, '')), '[^A-Z0-9]+', '', 'g')) as display_key
    from public.physical_spaces
    where nullif(trim(display_code), '') is not null
),
normalized_stores as (
    select
        s.*,
        upper(regexp_replace(trim(coalesce(s.id, '')), '[^A-Z0-9]+', '', 'g')) as id_key,
        upper(regexp_replace(trim(coalesce(s.local_code, '')), '[^A-Z0-9]+', '', 'g')) as local_code_key
    from public.stores s
)
select distinct
    dc.display_code as canonical_store_id,
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
from public._codex_display_codes dc
left join normalized_spaces ps
  on ps.display_code = dc.display_code
left join normalized_stores s
  on s.id = dc.display_code
  or s.local_code = dc.display_code
  or s.id_key = ps.source_key
  or s.local_code_key = ps.source_key
  or s.id_key = ps.display_key
  or s.local_code_key = ps.display_key;

create table public._codex_store_winners as
select distinct on (canonical_store_id)
    canonical_store_id,
    old_store_id,
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
from public._codex_store_candidates
order by
    canonical_store_id,
    (owner_id is not null) desc,
    (nullif(trim(coalesce(contact_email, '')), '') is not null) desc,
    (nullif(trim(coalesce(name, '')), '') is not null) desc,
    updated_at desc nulls last,
    created_at desc nulls last,
    old_store_id asc nulls last;

create table public._codex_store_id_map as
with normalized_spaces as (
    select
        physical_space_id,
        trim(display_code) as display_code,
        upper(regexp_replace(trim(coalesce(source_code, '')), '[^A-Z0-9]+', '', 'g')) as source_key,
        upper(regexp_replace(trim(coalesce(display_code, '')), '[^A-Z0-9]+', '', 'g')) as display_key
    from public.physical_spaces
    where nullif(trim(display_code), '') is not null
),
normalized_stores as (
    select
        s.id as old_store_id,
        upper(regexp_replace(trim(coalesce(s.id, '')), '[^A-Z0-9]+', '', 'g')) as id_key,
        upper(regexp_replace(trim(coalesce(s.local_code, '')), '[^A-Z0-9]+', '', 'g')) as local_code_key
    from public.stores s
),
matches as (
    select distinct
        s.old_store_id,
        ps.display_code as canonical_store_id
    from normalized_stores s
    join normalized_spaces ps
      on s.id_key = ps.source_key
      or s.local_code_key = ps.source_key
      or s.id_key = ps.display_key
      or s.local_code_key = ps.display_key
    union
    select
        s.id as old_store_id,
        trim(s.id) as canonical_store_id
    from public.stores s
    where exists (
        select 1
        from public._codex_display_codes dc
        where dc.display_code = s.id
    )
    union
    select
        s.id as old_store_id,
        trim(s.local_code) as canonical_store_id
    from public.stores s
    where exists (
        select 1
        from public._codex_display_codes dc
        where dc.display_code = s.local_code
    )
)
select distinct old_store_id, canonical_store_id
from matches;

create table public._codex_rebuilt_store_physical_links as
select
    ps.physical_space_id,
    ps.display_code as store_id,
    case
        when count(*) over (partition by ps.display_code) > 1 then 'merged'
        else 'exclusive'
    end as relation_type,
    row_number() over (
        partition by ps.display_code
        order by ps.floor_label, ps.axis, ps.slot_index, ps.physical_space_id
    ) = 1 as is_primary,
    now()::timestamptz as created_at,
    now()::timestamptz as updated_at
from public.physical_spaces ps
where nullif(trim(ps.display_code), '') is not null;

alter table public.store_rent_rates drop constraint if exists store_rent_rates_store_id_fkey;
alter table public.tenant_leases drop constraint if exists tenant_leases_store_id_fkey;
alter table public.tenant_payments drop constraint if exists tenant_payments_store_id_fkey;
alter table public.tenant_notes drop constraint if exists tenant_notes_store_id_fkey;
alter table public.store_physical_links drop constraint if exists store_physical_links_store_id_fkey;

update public.store_rent_rates rr
set store_id = m.canonical_store_id,
    local_code = m.canonical_store_id
from public._codex_store_id_map m
where rr.store_id = m.old_store_id;

update public.tenant_leases tl
set store_id = m.canonical_store_id,
    local_code = m.canonical_store_id
from public._codex_store_id_map m
where tl.store_id = m.old_store_id;

update public.tenant_payments tp
set store_id = m.canonical_store_id,
    local_code = m.canonical_store_id
from public._codex_store_id_map m
where tp.store_id = m.old_store_id;

update public.tenant_notes tn
set store_id = m.canonical_store_id,
    local_code = m.canonical_store_id
from public._codex_store_id_map m
where tn.store_id = m.old_store_id;

update public.contact_messages cm
set store_id = m.canonical_store_id
from public._codex_store_id_map m
where cm.store_id = m.old_store_id;

update public.mall_messages mm
set store_id = m.canonical_store_id,
    local_code = m.canonical_store_id
from public._codex_store_id_map m
where mm.store_id = m.old_store_id
   or mm.local_code = m.old_store_id;

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
            set store_id = m.canonical_store_id
            from public._codex_store_id_map m
            where sp.store_id = m.old_store_id
        $sql$;
    end if;
end $$;

update public.store_products sp
set local_code = m.canonical_store_id
from public._codex_store_id_map m
where sp.local_code = m.old_store_id;

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
            set store_id = m.canonical_store_id
            from public._codex_store_id_map m
            where sc.store_id = m.old_store_id
        $sql$;
    end if;
end $$;

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
    dc.display_code as id,
    dc.display_code as local_code,
    w.owner_id,
    w.slug,
    coalesce(w.name, dc.display_code) as name,
    w.category,
    w.contact_email,
    w.contact_phone,
    w.whatsapp,
    w.logo_url,
    w.shelf_style,
    w.primary_color,
    w.checkout_mode,
    coalesce(w.telegram_notifications_enabled, false),
    w.telegram_chat_id,
    w.telegram_chat_username,
    w.telegram_link_code,
    w.telegram_verified_at,
    coalesce(w.service_status, 'active'),
    w.service_status_note,
    w.service_suspended_at,
    coalesce(w.created_at, now()),
    coalesce(w.updated_at, now())
from public._codex_display_codes dc
left join public._codex_store_winners w
  on w.canonical_store_id = dc.display_code
order by dc.display_code;

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
    created_at,
    updated_at
from public._codex_rebuilt_store_physical_links
order by store_id, physical_space_id;

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

commit;

-- Verificaciones sugeridas:
-- 1. select id, local_code, owner_id, name from public.stores order by id;
-- 2. select display_code, count(*) from public.physical_spaces group by display_code order by display_code;
-- 3. select store_id, count(*) from public.store_physical_links group by store_id order by store_id;
-- 4. select id, store_id, local_code from public.tenant_leases order by id;
