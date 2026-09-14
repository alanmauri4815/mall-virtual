-- Capacidad de catalogo por tipo de local y descripcion de producto.
-- Ejecutar en Supabase SQL Editor.

alter table public.store_products
    add column if not exists description text;

alter table public.store_products
    drop constraint if exists store_products_description_length_chk;

alter table public.store_products
    add constraint store_products_description_length_chk
    check (description is null or char_length(description) <= 500);

create index if not exists store_products_store_sort_idx
on public.store_products (store_id, sort_order);

create index if not exists store_products_local_sort_idx
on public.store_products (local_code, sort_order);

alter table public.stores
    add column if not exists product_tier text,
    add column if not exists product_limit int;

alter table public.stores
    drop constraint if exists stores_product_tier_chk;

alter table public.stores
    add constraint stores_product_tier_chk
    check (product_tier is null or product_tier in ('T0', 'T1', 'T2', 'T3', 'T4', 'T5'));

alter table public.stores
    drop constraint if exists stores_product_limit_chk;

alter table public.stores
    add constraint stores_product_limit_chk
    check (product_limit is null or product_limit between 1 and 50);

with product_plan(local_code, product_tier, product_limit, monthly_amount, quarterly_total, semiannual_total, annual_total) as (
    values
        ('EN-10', 'T4', 20, 18000, 50200, 95000, 177100),
        ('NO-10', 'T4', 20, 18000, 50200, 95000, 177100),
        ('OS-10', 'T4', 20, 18000, 50200, 95000, 177100),
        ('SE-10', 'T4', 20, 18000, 50200, 95000, 177100),

        ('N-101', 'T3', 15, 16200, 45200, 85500, 159400),
        ('N-102', 'T3', 15, 16200, 45200, 85500, 159400),
        ('N-103', 'T1', 10, 13200, 36800, 69700, 129900),
        ('N-104', 'T1', 10, 13200, 36800, 69700, 129900),
        ('N-105', 'T2', 12, 14600, 40700, 77100, 143700),
        ('N-106', 'T2', 12, 14600, 40700, 77100, 143700),
        ('N-107', 'T3', 15, 16200, 45200, 85500, 159400),
        ('N-108', 'T3', 15, 16200, 45200, 85500, 159400),
        ('S-101', 'T3', 15, 16200, 45200, 85500, 159400),
        ('S-102', 'T3', 15, 16200, 45200, 85500, 159400),
        ('S-103', 'T1', 10, 13200, 36800, 69700, 129900),
        ('S-104', 'T1', 10, 13200, 36800, 69700, 129900),
        ('S-105', 'T2', 12, 14600, 40700, 77100, 143700),
        ('S-106', 'T2', 12, 14600, 40700, 77100, 143700),
        ('S-107', 'T3', 15, 16200, 45200, 85500, 159400),
        ('S-108', 'T3', 15, 16200, 45200, 85500, 159400),
        ('E-101', 'T3', 15, 16200, 45200, 85500, 159400),
        ('E-102', 'T3', 15, 16200, 45200, 85500, 159400),
        ('E-103', 'T1', 10, 13200, 36800, 69700, 129900),
        ('E-104', 'T1', 10, 13200, 36800, 69700, 129900),
        ('E-105', 'T2', 12, 14600, 40700, 77100, 143700),
        ('E-106', 'T2', 12, 14600, 40700, 77100, 143700),
        ('E-107', 'T3', 15, 16200, 45200, 85500, 159400),
        ('E-108', 'T3', 15, 16200, 45200, 85500, 159400),
        ('O-101', 'T3', 15, 16200, 45200, 85500, 159400),
        ('O-102', 'T3', 15, 16200, 45200, 85500, 159400),
        ('O-103', 'T1', 10, 13200, 36800, 69700, 129900),
        ('O-104', 'T1', 10, 13200, 36800, 69700, 129900),
        ('O-105', 'T2', 12, 14600, 40700, 77100, 143700),
        ('O-106', 'T2', 12, 14600, 40700, 77100, 143700),
        ('O-107', 'T3', 15, 16200, 45200, 85500, 159400),
        ('O-108', 'T3', 15, 16200, 45200, 85500, 159400),

        ('N-201', 'T2', 12, 14600, 40700, 77100, 143700),
        ('N-202', 'T2', 12, 14600, 40700, 77100, 143700),
        ('N-203', 'T1', 10, 13200, 36800, 69700, 129900),
        ('N-204', 'T1', 10, 13200, 36800, 69700, 129900),
        ('N-205', 'T0', 10, 12000, 33500, 63400, 118100),
        ('N-206', 'T0', 10, 12000, 33500, 63400, 118100),
        ('N-207', 'T1', 10, 13200, 36800, 69700, 129900),
        ('N-208', 'T1', 10, 13200, 36800, 69700, 129900),
        ('N-209', 'T2', 12, 14600, 40700, 77100, 143700),
        ('N-210', 'T2', 12, 14600, 40700, 77100, 143700),
        ('S-201', 'T2', 12, 14600, 40700, 77100, 143700),
        ('S-202', 'T2', 12, 14600, 40700, 77100, 143700),
        ('S-203', 'T1', 10, 13200, 36800, 69700, 129900),
        ('S-204', 'T1', 10, 13200, 36800, 69700, 129900),
        ('S-205', 'T0', 10, 12000, 33500, 63400, 118100),
        ('S-206', 'T0', 10, 12000, 33500, 63400, 118100),
        ('S-207', 'T1', 10, 13200, 36800, 69700, 129900),
        ('S-208', 'T1', 10, 13200, 36800, 69700, 129900),
        ('S-209', 'T2', 12, 14600, 40700, 77100, 143700),
        ('S-210', 'T2', 12, 14600, 40700, 77100, 143700),
        ('E-201', 'T2', 12, 14600, 40700, 77100, 143700),
        ('E-202', 'T2', 12, 14600, 40700, 77100, 143700),
        ('E-203', 'T1', 10, 13200, 36800, 69700, 129900),
        ('E-204', 'T1', 10, 13200, 36800, 69700, 129900),
        ('E-205', 'T0', 10, 12000, 33500, 63400, 118100),
        ('E-206', 'T0', 10, 12000, 33500, 63400, 118100),
        ('E-207', 'T1', 10, 13200, 36800, 69700, 129900),
        ('E-208', 'T1', 10, 13200, 36800, 69700, 129900),
        ('E-209', 'T2', 12, 14600, 40700, 77100, 143700),
        ('E-210', 'T2', 12, 14600, 40700, 77100, 143700),
        ('O-201', 'T2', 12, 14600, 40700, 77100, 143700),
        ('O-202', 'T2', 12, 14600, 40700, 77100, 143700),
        ('O-203', 'T1', 10, 13200, 36800, 69700, 129900),
        ('O-204', 'T1', 10, 13200, 36800, 69700, 129900),
        ('O-205', 'T0', 10, 12000, 33500, 63400, 118100),
        ('O-206', 'T0', 10, 12000, 33500, 63400, 118100),
        ('O-207', 'T1', 10, 13200, 36800, 69700, 129900),
        ('O-208', 'T1', 10, 13200, 36800, 69700, 129900),
        ('O-209', 'T2', 12, 14600, 40700, 77100, 143700),
        ('O-210', 'T2', 12, 14600, 40700, 77100, 143700)
),
matched_stores as (
    select
        s.id as store_id,
        s.local_code,
        pp.product_tier,
        pp.product_limit,
        pp.monthly_amount,
        pp.quarterly_total,
        pp.semiannual_total,
        pp.annual_total
    from public.stores s
    join product_plan pp
      on upper(replace(coalesce(s.local_code, s.id::text), '-', '')) = upper(replace(pp.local_code, '-', ''))
      or upper(replace(s.id::text, '-', '')) = upper(replace(pp.local_code, '-', ''))
)
update public.stores s
set
    product_tier = ms.product_tier,
    product_limit = ms.product_limit,
    updated_at = now()
from matched_stores ms
where s.id = ms.store_id;

with product_plan(local_code, product_tier, product_limit, monthly_amount, quarterly_total, semiannual_total, annual_total) as (
    values
        ('EN-10', 'T4', 20, 18000, 50200, 95000, 177100),
        ('NO-10', 'T4', 20, 18000, 50200, 95000, 177100),
        ('OS-10', 'T4', 20, 18000, 50200, 95000, 177100),
        ('SE-10', 'T4', 20, 18000, 50200, 95000, 177100),
        ('N-101', 'T3', 15, 16200, 45200, 85500, 159400),
        ('N-102', 'T3', 15, 16200, 45200, 85500, 159400),
        ('N-103', 'T1', 10, 13200, 36800, 69700, 129900),
        ('N-104', 'T1', 10, 13200, 36800, 69700, 129900),
        ('N-105', 'T2', 12, 14600, 40700, 77100, 143700),
        ('N-106', 'T2', 12, 14600, 40700, 77100, 143700),
        ('N-107', 'T3', 15, 16200, 45200, 85500, 159400),
        ('N-108', 'T3', 15, 16200, 45200, 85500, 159400),
        ('S-101', 'T3', 15, 16200, 45200, 85500, 159400),
        ('S-102', 'T3', 15, 16200, 45200, 85500, 159400),
        ('S-103', 'T1', 10, 13200, 36800, 69700, 129900),
        ('S-104', 'T1', 10, 13200, 36800, 69700, 129900),
        ('S-105', 'T2', 12, 14600, 40700, 77100, 143700),
        ('S-106', 'T2', 12, 14600, 40700, 77100, 143700),
        ('S-107', 'T3', 15, 16200, 45200, 85500, 159400),
        ('S-108', 'T3', 15, 16200, 45200, 85500, 159400),
        ('E-101', 'T3', 15, 16200, 45200, 85500, 159400),
        ('E-102', 'T3', 15, 16200, 45200, 85500, 159400),
        ('E-103', 'T1', 10, 13200, 36800, 69700, 129900),
        ('E-104', 'T1', 10, 13200, 36800, 69700, 129900),
        ('E-105', 'T2', 12, 14600, 40700, 77100, 143700),
        ('E-106', 'T2', 12, 14600, 40700, 77100, 143700),
        ('E-107', 'T3', 15, 16200, 45200, 85500, 159400),
        ('E-108', 'T3', 15, 16200, 45200, 85500, 159400),
        ('O-101', 'T3', 15, 16200, 45200, 85500, 159400),
        ('O-102', 'T3', 15, 16200, 45200, 85500, 159400),
        ('O-103', 'T1', 10, 13200, 36800, 69700, 129900),
        ('O-104', 'T1', 10, 13200, 36800, 69700, 129900),
        ('O-105', 'T2', 12, 14600, 40700, 77100, 143700),
        ('O-106', 'T2', 12, 14600, 40700, 77100, 143700),
        ('O-107', 'T3', 15, 16200, 45200, 85500, 159400),
        ('O-108', 'T3', 15, 16200, 45200, 85500, 159400),
        ('N-201', 'T2', 12, 14600, 40700, 77100, 143700),
        ('N-202', 'T2', 12, 14600, 40700, 77100, 143700),
        ('N-203', 'T1', 10, 13200, 36800, 69700, 129900),
        ('N-204', 'T1', 10, 13200, 36800, 69700, 129900),
        ('N-205', 'T0', 10, 12000, 33500, 63400, 118100),
        ('N-206', 'T0', 10, 12000, 33500, 63400, 118100),
        ('N-207', 'T1', 10, 13200, 36800, 69700, 129900),
        ('N-208', 'T1', 10, 13200, 36800, 69700, 129900),
        ('N-209', 'T2', 12, 14600, 40700, 77100, 143700),
        ('N-210', 'T2', 12, 14600, 40700, 77100, 143700),
        ('S-201', 'T2', 12, 14600, 40700, 77100, 143700),
        ('S-202', 'T2', 12, 14600, 40700, 77100, 143700),
        ('S-203', 'T1', 10, 13200, 36800, 69700, 129900),
        ('S-204', 'T1', 10, 13200, 36800, 69700, 129900),
        ('S-205', 'T0', 10, 12000, 33500, 63400, 118100),
        ('S-206', 'T0', 10, 12000, 33500, 63400, 118100),
        ('S-207', 'T1', 10, 13200, 36800, 69700, 129900),
        ('S-208', 'T1', 10, 13200, 36800, 69700, 129900),
        ('S-209', 'T2', 12, 14600, 40700, 77100, 143700),
        ('S-210', 'T2', 12, 14600, 40700, 77100, 143700),
        ('E-201', 'T2', 12, 14600, 40700, 77100, 143700),
        ('E-202', 'T2', 12, 14600, 40700, 77100, 143700),
        ('E-203', 'T1', 10, 13200, 36800, 69700, 129900),
        ('E-204', 'T1', 10, 13200, 36800, 69700, 129900),
        ('E-205', 'T0', 10, 12000, 33500, 63400, 118100),
        ('E-206', 'T0', 10, 12000, 33500, 63400, 118100),
        ('E-207', 'T1', 10, 13200, 36800, 69700, 129900),
        ('E-208', 'T1', 10, 13200, 36800, 69700, 129900),
        ('E-209', 'T2', 12, 14600, 40700, 77100, 143700),
        ('E-210', 'T2', 12, 14600, 40700, 77100, 143700),
        ('O-201', 'T2', 12, 14600, 40700, 77100, 143700),
        ('O-202', 'T2', 12, 14600, 40700, 77100, 143700),
        ('O-203', 'T1', 10, 13200, 36800, 69700, 129900),
        ('O-204', 'T1', 10, 13200, 36800, 69700, 129900),
        ('O-205', 'T0', 10, 12000, 33500, 63400, 118100),
        ('O-206', 'T0', 10, 12000, 33500, 63400, 118100),
        ('O-207', 'T1', 10, 13200, 36800, 69700, 129900),
        ('O-208', 'T1', 10, 13200, 36800, 69700, 129900),
        ('O-209', 'T2', 12, 14600, 40700, 77100, 143700),
        ('O-210', 'T2', 12, 14600, 40700, 77100, 143700)
),
matched_stores as (
    select
        s.id as store_id,
        coalesce(s.local_code, pp.local_code) as local_code,
        pp.product_limit,
        pp.monthly_amount,
        pp.quarterly_total,
        round(pp.quarterly_total / 3.0)::int as quarterly_monthly_equivalent,
        pp.semiannual_total,
        round(pp.semiannual_total / 6.0)::int as semiannual_monthly_equivalent,
        pp.annual_total,
        round(pp.annual_total / 12.0)::int as annual_monthly_equivalent,
        pp.product_tier
    from public.stores s
    join product_plan pp
      on upper(replace(coalesce(s.local_code, s.id::text), '-', '')) = upper(replace(pp.local_code, '-', ''))
      or upper(replace(s.id::text, '-', '')) = upper(replace(pp.local_code, '-', ''))
)
insert into public.store_rent_rates (
    store_id,
    local_code,
    floor,
    included_products,
    monthly_amount,
    quarterly_total,
    quarterly_monthly_equivalent,
    semiannual_total,
    semiannual_monthly_equivalent,
    annual_total,
    annual_monthly_equivalent,
    notes,
    active,
    updated_at
)
select
    store_id,
    local_code,
    case when local_code like '%-2%' or local_code like '%2__' then 2 else 1 end,
    product_limit,
    monthly_amount,
    quarterly_total,
    quarterly_monthly_equivalent,
    semiannual_total,
    semiannual_monthly_equivalent,
    annual_total,
    annual_monthly_equivalent,
    'Plan ' || product_tier || ' cargado desde tabla oficial de capacidad de catalogo.',
    true,
    now()
from matched_stores
on conflict (store_id) do update
set
    local_code = excluded.local_code,
    floor = excluded.floor,
    included_products = excluded.included_products,
    monthly_amount = excluded.monthly_amount,
    quarterly_total = excluded.quarterly_total,
    quarterly_monthly_equivalent = excluded.quarterly_monthly_equivalent,
    semiannual_total = excluded.semiannual_total,
    semiannual_monthly_equivalent = excluded.semiannual_monthly_equivalent,
    annual_total = excluded.annual_total,
    annual_monthly_equivalent = excluded.annual_monthly_equivalent,
    notes = excluded.notes,
    active = true,
    updated_at = now();
