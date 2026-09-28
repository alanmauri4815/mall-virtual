-- Sistema de compras sin pago en linea.
-- El visitante solicita un producto y el locatario confirma el despacho.
-- El pago queda expresamente definido como contra entrega.

begin;

do $$
begin
    if not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'stores'
          and column_name = 'mall_id'
    ) then
        raise exception 'Falta public.stores.mall_id. Ejecuta primero la migracion multimall.';
    end if;
end;
$$;

alter table public.mall_members
    add column if not exists default_delivery_address text;
alter table public.mall_members
    add column if not exists default_delivery_commune text;

create table if not exists public.store_shipping_rates (
    id uuid primary key default gen_random_uuid(),
    mall_id uuid not null references public.malls(id) on delete cascade,
    store_id text not null references public.stores(id) on delete cascade,
    commune text not null,
    shipping_cost numeric(12, 0) not null default 0
        check (shipping_cost >= 0),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint store_shipping_rates_commune_not_blank
        check (length(trim(commune)) > 0),
    constraint store_shipping_rates_scope_unique
        unique (mall_id, store_id, commune)
);

create table if not exists public.store_orders (
    id uuid primary key default gen_random_uuid(),
    mall_id uuid not null references public.malls(id) on delete cascade,
    store_id text not null references public.stores(id) on delete restrict,
    product_id uuid references public.store_products(id) on delete set null,
    buyer_auth_user_id uuid references auth.users(id) on delete set null,
    buyer_name text not null,
    buyer_email text not null,
    buyer_phone text not null,
    delivery_address text not null,
    delivery_commune text not null,
    product_name text not null,
    product_price text not null default '',
    quantity integer not null default 1 check (quantity between 1 and 20),
    shipping_cost numeric(12, 0) not null default 0
        check (shipping_cost >= 0),
    buyer_note text,
    payment_method text not null default 'cash_on_delivery'
        check (payment_method = 'cash_on_delivery'),
    status text not null default 'pending_store_confirmation'
        check (status in (
            'pending_store_confirmation',
            'accepted',
            'preparing',
            'out_for_delivery',
            'delivered',
            'cancelled'
        )),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists store_shipping_rates_mall_store_idx
    on public.store_shipping_rates (mall_id, store_id, is_active, commune);

create index if not exists store_orders_mall_store_created_idx
    on public.store_orders (mall_id, store_id, created_at desc);

create index if not exists store_orders_buyer_idx
    on public.store_orders (mall_id, buyer_auth_user_id, created_at desc);

alter table public.store_shipping_rates enable row level security;
alter table public.store_orders enable row level security;

drop policy if exists "Public reads active shipping rates" on public.store_shipping_rates;
create policy "Public reads active shipping rates"
on public.store_shipping_rates for select to anon, authenticated
using (
    mall_id is not null
    and is_active = true
);

drop policy if exists "Owners manage shipping rates" on public.store_shipping_rates;
create policy "Owners manage shipping rates"
on public.store_shipping_rates for all to authenticated
using (
    public.is_mall_admin_for(mall_id)
    or exists (
        select 1
        from public.stores store_row
        where store_row.id = store_shipping_rates.store_id
          and store_row.mall_id = store_shipping_rates.mall_id
          and store_row.owner_id = auth.uid()
    )
)
with check (
    public.is_mall_admin_for(mall_id)
    or exists (
        select 1
        from public.stores store_row
        where store_row.id = store_shipping_rates.store_id
          and store_row.mall_id = store_shipping_rates.mall_id
          and store_row.owner_id = auth.uid()
    )
);

drop policy if exists "Visitors create delivery orders" on public.store_orders;
create policy "Visitors create delivery orders"
on public.store_orders for insert to anon, authenticated
with check (
    mall_id is not null
    and payment_method = 'cash_on_delivery'
    and status = 'pending_store_confirmation'
    and (buyer_auth_user_id is null or buyer_auth_user_id = auth.uid())
    and exists (
        select 1
        from public.stores store_row
        where store_row.id = store_orders.store_id
          and store_row.mall_id = store_orders.mall_id
    )
);

drop policy if exists "Buyers read own delivery orders" on public.store_orders;
create policy "Buyers read own delivery orders"
on public.store_orders for select to authenticated
using (buyer_auth_user_id = auth.uid());

drop policy if exists "Owners read store delivery orders" on public.store_orders;
create policy "Owners read store delivery orders"
on public.store_orders for select to authenticated
using (
    public.is_mall_admin_for(mall_id)
    or exists (
        select 1
        from public.stores store_row
        where store_row.id = store_orders.store_id
          and store_row.mall_id = store_orders.mall_id
          and store_row.owner_id = auth.uid()
    )
);

drop policy if exists "Owners update store delivery orders" on public.store_orders;
create policy "Owners update store delivery orders"
on public.store_orders for update to authenticated
using (
    public.is_mall_admin_for(mall_id)
    or exists (
        select 1
        from public.stores store_row
        where store_row.id = store_orders.store_id
          and store_row.mall_id = store_orders.mall_id
          and store_row.owner_id = auth.uid()
    )
)
with check (
    public.is_mall_admin_for(mall_id)
    or exists (
        select 1
        from public.stores store_row
        where store_row.id = store_orders.store_id
          and store_row.mall_id = store_orders.mall_id
          and store_row.owner_id = auth.uid()
    )
);

grant select on public.store_shipping_rates to anon, authenticated;
grant insert, update, delete on public.store_shipping_rates to authenticated;
grant insert on public.store_orders to anon, authenticated;
grant select, update on public.store_orders to authenticated;

comment on table public.store_shipping_rates is
    'Tarifas de despacho configuradas por cada local y comuna.';
comment on table public.store_orders is
    'Solicitudes de compra sin pago online. El pago se realiza contra entrega.';
comment on column public.store_orders.payment_method is
    'Siempre cash_on_delivery: el visitante paga al recibir el producto.';
comment on column public.mall_members.default_delivery_address is
    'Direccion que se ofrece como autocompletado para futuras compras.';
comment on column public.mall_members.default_delivery_commune is
    'Comuna que se ofrece como autocompletado para futuras compras.';

commit;
