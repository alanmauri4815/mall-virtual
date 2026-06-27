-- Ejecuta esto en el SQL Editor de Supabase.
-- Crea un bucket publico para imagenes de locales/productos.
-- Los archivos se guardan por carpeta de local: O101/logo-..., O101/product-...

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'store-assets',
    'store-assets',
    true,
    8388608,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Store assets are publicly readable" on storage.objects;
create policy "Store assets are publicly readable"
on storage.objects for select
to public
using (bucket_id = 'store-assets');

drop policy if exists "Tenants upload owned store assets" on storage.objects;
create policy "Tenants upload owned store assets"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'store-assets'
    and exists (
        select 1
        from public.stores st
        where (st.local_code = (storage.foldername(storage.objects.name))[1] or st.id::text = (storage.foldername(storage.objects.name))[1])
          and (
              st.owner_id = auth.uid()
              or public.is_mall_admin()
          )
    )
);

drop policy if exists "Tenants update owned store assets" on storage.objects;
create policy "Tenants update owned store assets"
on storage.objects for update
to authenticated
using (
    bucket_id = 'store-assets'
    and exists (
        select 1
        from public.stores st
        where (st.local_code = (storage.foldername(storage.objects.name))[1] or st.id::text = (storage.foldername(storage.objects.name))[1])
          and (
              st.owner_id = auth.uid()
              or public.is_mall_admin()
          )
    )
)
with check (
    bucket_id = 'store-assets'
    and exists (
        select 1
        from public.stores st
        where (st.local_code = (storage.foldername(storage.objects.name))[1] or st.id::text = (storage.foldername(storage.objects.name))[1])
          and (
              st.owner_id = auth.uid()
              or public.is_mall_admin()
          )
    )
);

drop policy if exists "Tenants delete owned store assets" on storage.objects;
create policy "Tenants delete owned store assets"
on storage.objects for delete
to authenticated
using (
    bucket_id = 'store-assets'
    and exists (
        select 1
        from public.stores st
        where (st.local_code = (storage.foldername(storage.objects.name))[1] or st.id::text = (storage.foldername(storage.objects.name))[1])
          and (
              st.owner_id = auth.uid()
              or public.is_mall_admin()
          )
    )
);
