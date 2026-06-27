-- Ejecuta esto en Supabase SQL Editor si aparece:
-- column store_products.local_code does not exist
--
-- La app usa stores.id como codigo real del local, y store_products.local_code
-- guarda ese mismo valor para vincular productos con su local.

alter table public.store_products
    add column if not exists local_code text;

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'store_products'
          and column_name = 'store_id'
    ) then
        update public.store_products
        set local_code = store_id::text
        where local_code is null
          and store_id is not null;
    end if;
end $$;

create index if not exists store_products_local_code_idx
on public.store_products (local_code);

drop policy if exists "Store products are public readable" on public.store_products;
create policy "Store products are public readable"
on public.store_products for select
using (true);

drop policy if exists "Tenants manage products for owned stores" on public.store_products;
create policy "Tenants manage products for owned stores"
on public.store_products for all
using (
    exists (
        select 1
        from public.stores s
        where (s.id::text = store_products.local_code or s.local_code = store_products.local_code)
        and (
            s.owner_id = auth.uid()
            or public.is_mall_admin()
        )
    )
)
with check (
    exists (
        select 1
        from public.stores s
        where (s.id::text = store_products.local_code or s.local_code = store_products.local_code)
        and (
            s.owner_id = auth.uid()
            or public.is_mall_admin()
        )
    )
);

grant select on public.store_products to anon, authenticated;
grant insert, update, delete on public.store_products to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
