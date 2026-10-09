begin;

alter table public.store_products
    add column if not exists product_category text;

alter table public.store_products
    add column if not exists origin_type text;

alter table public.store_products
    add column if not exists availability_status text;

alter table public.store_products
    add column if not exists delivery_options text[] not null default '{}';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'store_products_origin_type_chk'
          and conrelid = 'public.store_products'::regclass
    ) then
        alter table public.store_products
            add constraint store_products_origin_type_chk
            check (origin_type is null or origin_type in ('own_made', 'commercialized'));
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'store_products_availability_status_chk'
          and conrelid = 'public.store_products'::regclass
    ) then
        alter table public.store_products
            add constraint store_products_availability_status_chk
            check (availability_status is null or availability_status in ('in_stock', 'made_to_order', 'contact'));
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'store_products_delivery_options_chk'
          and conrelid = 'public.store_products'::regclass
    ) then
        alter table public.store_products
            add constraint store_products_delivery_options_chk
            check (delivery_options <@ array['mall_pickup', 'local_delivery', 'nationwide_shipping']::text[]);
    end if;
end;
$$;

create index if not exists store_products_discovery_facets_idx
    on public.store_products (mall_id, product_category, origin_type, availability_status);

create index if not exists store_products_delivery_options_idx
    on public.store_products using gin (delivery_options);

comment on column public.store_products.product_category is
    'Categoría explícita elegida por el locatario para facilitar la búsqueda pública.';
comment on column public.store_products.origin_type is
    'Origen declarado por el locatario: own_made o commercialized; null significa sin especificar.';
comment on column public.store_products.availability_status is
    'Disponibilidad declarada por el locatario: in_stock, made_to_order o contact.';
comment on column public.store_products.delivery_options is
    'Opciones de entrega declaradas: mall_pickup, local_delivery y/o nationwide_shipping.';

commit;
