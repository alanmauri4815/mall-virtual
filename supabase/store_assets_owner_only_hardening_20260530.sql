-- Endurecimiento de Storage para assets de tiendas.
-- Ejecutar en Supabase SQL Editor despues de respaldar la base.
--
-- Objetivo:
-- Autorizar cambios de imagenes/logos/productos solo por owner_id o admin.
-- No usar contact_email como prueba de propiedad, porque es editable y visible.

begin;

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

commit;
