-- FIX TENANT CATALOG PERMISSIONS - 2026-07-17
-- Run this complete file in Supabase SQL Editor.
-- Restores owner/admin writes without reopening anonymous access.

begin;

create or replace function public.can_manage_store(
    requested_store_id text default null,
    requested_local_code text default null
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
    select auth.uid() is not null
       and (
            public.is_mall_admin()
            or exists (
                select 1
                from public.stores s
                where s.owner_id = auth.uid()
                  and (
                      nullif(trim(coalesce(requested_store_id, '')), '') is not null
                      or nullif(trim(coalesce(requested_local_code, '')), '') is not null
                  )
                  and (
                      nullif(trim(coalesce(requested_store_id, '')), '') is null
                      or upper(trim(requested_store_id)) = upper(trim(s.id::text))
                      or upper(trim(requested_store_id)) = upper(trim(coalesce(s.local_code, '')))
                  )
                  and (
                      nullif(trim(coalesce(requested_local_code, '')), '') is null
                      or upper(trim(requested_local_code)) = upper(trim(s.id::text))
                      or upper(trim(requested_local_code)) = upper(trim(coalesce(s.local_code, '')))
                  )
            )
       );
$$;

revoke all on function public.can_manage_store(text, text) from public;
revoke execute on function public.can_manage_store(text, text) from anon;
grant execute on function public.can_manage_store(text, text) to authenticated;

create or replace function public.can_manage_store_asset(asset_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
    select public.can_manage_store(
        split_part(coalesce(asset_name, ''), '/', 1),
        split_part(coalesce(asset_name, ''), '/', 1)
    );
$$;

revoke all on function public.can_manage_store_asset(text) from public;
revoke execute on function public.can_manage_store_asset(text) from anon;
grant execute on function public.can_manage_store_asset(text) to authenticated;

alter table public.store_products enable row level security;

drop policy if exists "Owners manage own products" on public.store_products;
drop policy if exists "Tenants manage products for owned stores" on public.store_products;
drop policy if exists "Owners and admins manage store products" on public.store_products;

create policy "Owners and admins manage store products"
on public.store_products for all to authenticated
using (
    public.can_manage_store(store_id::text, local_code)
)
with check (
    public.can_manage_store(store_id::text, local_code)
);

grant select on public.store_products to anon, authenticated;
grant insert, update, delete on public.store_products to authenticated;

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

do $$
declare
    policy_row record;
begin
    for policy_row in
        select policyname
        from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and (
              coalesce(qual, '') ilike '%store-assets%'
              or coalesce(with_check, '') ilike '%store-assets%'
              or policyname ilike '%store asset%'
          )
    loop
        execute format('drop policy if exists %I on storage.objects', policy_row.policyname);
    end loop;
end $$;

create policy "Store assets public read"
on storage.objects for select to public
using (bucket_id = 'store-assets');

create policy "Store owners and admins upload assets"
on storage.objects for insert to authenticated
with check (
    bucket_id = 'store-assets'
    and public.can_manage_store_asset(name)
);

create policy "Store owners and admins update assets"
on storage.objects for update to authenticated
using (
    bucket_id = 'store-assets'
    and public.can_manage_store_asset(name)
)
with check (
    bucket_id = 'store-assets'
    and public.can_manage_store_asset(name)
);

create policy "Store owners and admins delete assets"
on storage.objects for delete to authenticated
using (
    bucket_id = 'store-assets'
    and public.can_manage_store_asset(name)
);

commit;

select
    schemaname,
    tablename,
    policyname,
    roles,
    cmd
from pg_policies
where (schemaname = 'public' and tablename = 'store_products')
   or (schemaname = 'storage' and tablename = 'objects'
       and (coalesce(qual, '') ilike '%store-assets%'
            or coalesce(with_check, '') ilike '%store-assets%'))
order by schemaname, tablename, policyname;
