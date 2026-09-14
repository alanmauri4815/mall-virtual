-- Imágenes públicas para marcos decorativos administrados desde el editor del mall.
-- Ejecutar completo en Supabase SQL Editor con el rol postgres.

begin;

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'mall-public-media',
    'mall-public-media',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Mall public media is readable" on storage.objects;
create policy "Mall public media is readable"
on storage.objects for select
to public
using (bucket_id = 'mall-public-media');

drop policy if exists "Mall admins upload public media" on storage.objects;
create policy "Mall admins upload public media"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'mall-public-media'
    and public.is_mall_admin()
);

drop policy if exists "Mall admins update public media" on storage.objects;
create policy "Mall admins update public media"
on storage.objects for update
to authenticated
using (
    bucket_id = 'mall-public-media'
    and public.is_mall_admin()
)
with check (
    bucket_id = 'mall-public-media'
    and public.is_mall_admin()
);

drop policy if exists "Mall admins delete public media" on storage.objects;
create policy "Mall admins delete public media"
on storage.objects for delete
to authenticated
using (
    bucket_id = 'mall-public-media'
    and public.is_mall_admin()
);

commit;

select
    id,
    public,
    file_size_limit,
    allowed_mime_types
from storage.buckets
where id = 'mall-public-media';

