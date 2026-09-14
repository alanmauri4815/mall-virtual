-- Memoria comercial pública por local.
-- Se utiliza para promociones, ofertas, eventos, horarios especiales y noticias.
begin;

alter table public.stores
    add column if not exists catalog_memory text;

update public.stores
set catalog_memory = left(coalesce(catalog_memory, ''), 3000)
where catalog_memory is null
   or char_length(catalog_memory) > 3000;

alter table public.stores
    alter column catalog_memory set default '';

alter table public.stores
    alter column catalog_memory set not null;

alter table public.stores
    drop constraint if exists stores_catalog_memory_length_check;

alter table public.stores
    add constraint stores_catalog_memory_length_check
    check (char_length(catalog_memory) <= 3000);

comment on column public.stores.catalog_memory is
    'Información comercial vigente visible en el catálogo y buscable desde los tótems.';

commit;
