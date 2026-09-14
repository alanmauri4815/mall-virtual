begin;

-- Stores keep the tenant's catalog presentation without changing existing data.
alter table public.stores add column if not exists catalog_theme text;

update public.stores
set catalog_theme = case lower(trim(catalog_theme))
    when 'vibrant' then 'vibrant'
    when 'modern' then 'modern'
    when 'professional' then 'professional'
    when 'joyful' then 'joyful'
    else 'elegant'
end;

alter table public.stores alter column catalog_theme set default 'elegant';
alter table public.stores alter column catalog_theme set not null;

alter table public.stores drop constraint if exists stores_catalog_theme_check;
alter table public.stores add constraint stores_catalog_theme_check
    check (catalog_theme in ('elegant', 'vibrant', 'modern', 'professional', 'joyful'));

comment on column public.stores.catalog_theme is 'Tema de colores elegido por el locatario para su catálogo público.';

commit;
