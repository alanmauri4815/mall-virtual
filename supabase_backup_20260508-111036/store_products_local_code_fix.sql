-- Ejecuta esto en Supabase SQL Editor si aparece:
-- column store_products.local_code does not exist
--
-- La app usa stores.id como codigo real del local, y store_products.local_code
-- guarda ese mismo valor para vincular productos con su local.

alter table public.store_products
    add column if not exists local_code text;

update public.store_products
set local_code = store_id
where local_code is null
  and store_id is not null;

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
        where s.id = store_products.local_code
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
        where s.id = store_products.local_code
        and (
            s.owner_id = auth.uid()
            or public.is_mall_admin()
        )
    )
);
