-- Cambio puntual de codigo visible: O105 -> S-101.
-- Mantiene el guion para evitar confusion con el antiguo S101.
-- Ejecutar en Supabase SQL Editor.

begin;

update public.stores
set local_code = 'S-101'
where local_code = 'O105';

update public.store_products
set local_code = 'S-101'
where local_code = 'O105';

update public.store_rent_rates
set local_code = 'S-101'
where local_code = 'O105';

update public.tenant_leases
set local_code = 'S-101'
where local_code = 'O105';

update public.tenant_payments
set local_code = 'S-101'
where local_code = 'O105';

update public.tenant_notes
set local_code = 'S-101'
where local_code = 'O105';

commit;
