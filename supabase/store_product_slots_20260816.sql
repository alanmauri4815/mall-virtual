-- Posiciones estables para productos: el casillero del panel determina la vitrina.
begin;

alter table public.store_products
    add column if not exists slot_index integer;

-- Conserva el orden visual actual y lo convierte en casilleros 1..50.
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
            with ranked as (
                select id,
                       row_number() over (
                           partition by coalesce(nullif(upper(trim(local_code)), ''), store_id::text)
                           order by coalesce(sort_order, 2147483647), created_at, id
                       ) as new_slot
                from public.store_products
            )
            update public.store_products p
            set slot_index = ranked.new_slot,
                sort_order = ranked.new_slot - 1
            from ranked
            where p.id = ranked.id
        $sql$;
    else
        with ranked as (
            select id,
                   row_number() over (
                       partition by upper(trim(local_code))
                       order by coalesce(sort_order, 2147483647), created_at, id
                   ) as new_slot
            from public.store_products
        )
        update public.store_products p
        set slot_index = ranked.new_slot,
            sort_order = ranked.new_slot - 1
        from ranked
        where p.id = ranked.id;
    end if;
end $$;

alter table public.store_products
    drop constraint if exists store_products_slot_index_chk;
alter table public.store_products
    add constraint store_products_slot_index_chk
    check (slot_index between 1 and 50);

create unique index if not exists store_products_local_code_slot_uidx
on public.store_products (upper(trim(local_code)), slot_index)
where local_code is not null and slot_index is not null;

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
            create unique index if not exists store_products_store_id_slot_uidx
            on public.store_products (store_id, slot_index)
            where store_id is not null and slot_index is not null
        $sql$;
    end if;
end $$;

create or replace function public.sync_store_product_slot()
returns trigger
language plpgsql
as $$
begin
    if new.slot_index is null then
        new.slot_index := greatest(1, coalesce(new.sort_order, 0) + 1);
    end if;
    new.slot_index := least(50, greatest(1, new.slot_index));
    new.sort_order := new.slot_index - 1;
    return new;
end;
$$;

drop trigger if exists store_products_sync_slot on public.store_products;
create trigger store_products_sync_slot
before insert or update of slot_index, sort_order
on public.store_products
for each row
execute function public.sync_store_product_slot();

commit;

select local_code, slot_index, sort_order, name
from public.store_products
order by upper(local_code), slot_index;
