-- Extiende las compras con alternativas por producto, datos de transferencia
-- del locatario y montos de pago ahora / pago al recibir.
-- Ejecutar después de store_orders_and_shipping_20260927.sql.

begin;

alter table public.store_products
    add column if not exists payment_methods text[] not null
    default array['cash_on_delivery']::text[];

update public.store_products
set payment_methods = array['cash_on_delivery']::text[]
where payment_methods is null or cardinality(payment_methods) = 0;

alter table public.store_products
    drop constraint if exists store_products_payment_methods_chk;
alter table public.store_products
    add constraint store_products_payment_methods_chk
    check (
        cardinality(payment_methods) > 0
        and payment_methods <@ array['cash_on_delivery', 'bank_transfer', 'deposit_50']::text[]
    );

alter table public.store_orders
    drop constraint if exists store_orders_payment_method_check;
alter table public.store_orders
    drop constraint if exists store_orders_payment_method_allowed_chk;
alter table public.store_orders
    add constraint store_orders_payment_method_allowed_chk
    check (payment_method in ('cash_on_delivery', 'bank_transfer', 'deposit_50'));
alter table public.store_orders
    add column if not exists payment_amount_due_now numeric(12, 0) not null default 0
    check (payment_amount_due_now >= 0);
alter table public.store_orders
    add column if not exists payment_balance_due numeric(12, 0) not null default 0
    check (payment_balance_due >= 0);

create table if not exists public.store_payment_details (
    id uuid primary key default gen_random_uuid(),
    mall_id uuid not null references public.malls(id) on delete cascade,
    store_id text not null references public.stores(id) on delete cascade,
    account_holder_name text not null,
    account_holder_rut text not null default '',
    bank_name text not null,
    account_type text not null,
    account_number text not null,
    transfer_email text not null default '',
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint store_payment_details_scope_unique unique (mall_id, store_id),
    constraint store_payment_details_required_values_chk check (
        length(trim(account_holder_name)) > 0
        and length(trim(bank_name)) > 0
        and length(trim(account_type)) > 0
        and length(trim(account_number)) > 0
    )
);

create index if not exists store_payment_details_mall_store_idx
    on public.store_payment_details (mall_id, store_id, is_active);

alter table public.store_payment_details enable row level security;

drop policy if exists "Buyers read active store payment details" on public.store_payment_details;
create policy "Buyers read active store payment details"
on public.store_payment_details for select to anon, authenticated
using (mall_id is not null and is_active = true);

drop policy if exists "Owners manage store payment details" on public.store_payment_details;
create policy "Owners manage store payment details"
on public.store_payment_details for all to authenticated
using (
    public.is_mall_admin_for(mall_id)
    or exists (
        select 1
        from public.stores store_row
        where store_row.id = store_payment_details.store_id
          and store_row.mall_id = store_payment_details.mall_id
          and store_row.owner_id = auth.uid()
    )
)
with check (
    public.is_mall_admin_for(mall_id)
    or exists (
        select 1
        from public.stores store_row
        where store_row.id = store_payment_details.store_id
          and store_row.mall_id = store_payment_details.mall_id
          and store_row.owner_id = auth.uid()
    )
);

drop policy if exists "Visitors create delivery orders" on public.store_orders;
create policy "Visitors create delivery orders"
on public.store_orders for insert to anon, authenticated
with check (
    mall_id is not null
    and payment_method in ('cash_on_delivery', 'bank_transfer', 'deposit_50')
    and status = 'pending_store_confirmation'
    and (buyer_auth_user_id is null or buyer_auth_user_id = auth.uid())
    and exists (
        select 1
        from public.stores store_row
        where store_row.id = store_orders.store_id
          and store_row.mall_id = store_orders.mall_id
    )
    and exists (
        select 1
        from public.store_products product_row
        where product_row.id = store_orders.product_id
          and product_row.store_id::text = store_orders.store_id
          and store_orders.payment_method = any(product_row.payment_methods)
    )
);

grant select on public.store_payment_details to anon, authenticated;
grant insert, update, delete on public.store_payment_details to authenticated;

comment on column public.store_products.payment_methods is
    'Medios de pago habilitados por el locatario para este producto.';
comment on column public.store_orders.payment_method is
    'Medio de pago escogido por el comprador entre los habilitados para el producto.';
comment on column public.store_orders.payment_amount_due_now is
    'Monto que el comprador debe transferir ahora; el anticipo es 50% del subtotal de productos.';
comment on column public.store_orders.payment_balance_due is
    'Saldo pendiente para coordinar con el local, incluidos los costos de despacho.';
comment on table public.store_payment_details is
    'Datos de transferencia del locatario que se muestran al comprador cuando los necesita.';

commit;
