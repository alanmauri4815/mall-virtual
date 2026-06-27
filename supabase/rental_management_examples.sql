-- Ejemplos de uso para la capa administrativa de arriendos.
-- Ejecuta estos ejemplos despues de correr `supabase/mall_current_setup.sql`.

-- 1. Crear o actualizar la tarifa base de un local.
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
    notes
)
values (
    'S101',
    'S101',
    1,
    20,
    20000,
    55800,
    18600,
    105600,
    17600,
    196800,
    16400,
    'Tarifa base comercial del local S101.'
)
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
    updated_at = now();

-- 2. Crear un arriendo activo para una locataria ya aprobada.
insert into public.tenant_leases (
    store_id,
    local_code,
    tenant_auth_user_id,
    tenant_application_id,
    tenant_name_snapshot,
    tenant_email_snapshot,
    tenant_phone_snapshot,
    status,
    billing_cycle,
    monthly_amount,
    billing_amount,
    discount_amount,
    deposit_amount,
    start_date,
    due_day,
    contract_signed_at,
    admin_notes,
    created_by
)
select
    s.id,
    s.local_code,
    ta.applicant_auth_user_id,
    ta.id::text,
    ta.brand_name,
    ta.email,
    ta.phone,
    'active',
    'monthly',
    20000,
    20000,
    0,
    0,
    current_date,
    5,
    now(),
    'Arriendo inicial habilitado desde panel administrativo.',
    auth.uid()
from public.stores s
join public.tenant_applications ta
    on lower(ta.email) = lower('mallas.ross.confecciones@gmail.com')
where s.id = 'S101';

-- 3. Registrar un pago asociado al arriendo mas reciente del local.
insert into public.tenant_payments (
    lease_id,
    store_id,
    local_code,
    tenant_auth_user_id,
    period_start,
    period_end,
    due_date,
    paid_at,
    amount_due,
    amount_paid,
    payment_method,
    payment_reference,
    status,
    notes,
    recorded_by
)
select
    tl.id,
    tl.store_id,
    tl.local_code,
    tl.tenant_auth_user_id,
    date_trunc('month', current_date)::date,
    (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
    (date_trunc('month', current_date) + interval '4 day')::date,
    now(),
    20000,
    20000,
    'transferencia',
    'TRX-001',
    'paid',
    'Pago de prueba registrado por administrador.',
    auth.uid()
from public.tenant_leases tl
where tl.store_id = 'S101'
order by tl.created_at desc
limit 1;

-- 4. Dejar una observacion administrativa visible para la locataria.
insert into public.tenant_notes (
    store_id,
    local_code,
    tenant_auth_user_id,
    lease_id,
    category,
    visibility,
    pinned,
    note,
    created_by
)
select
    tl.store_id,
    tl.local_code,
    tl.tenant_auth_user_id,
    tl.id,
    'cobranza',
    'tenant',
    true,
    'Recuerda enviar comprobante de transferencia durante los primeros 5 dias de cada mes.',
    auth.uid()
from public.tenant_leases tl
where tl.store_id = 'S101'
order by tl.created_at desc
limit 1;
