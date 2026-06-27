-- Cambio puntual de codigo visible: E105 -> S-102.
-- Mantiene el guion para evitar confusion con el antiguo S102.
-- Ejecutar en Supabase SQL Editor.

begin;

update public.stores
set local_code = 'S-102'
where local_code = 'E105';

update public.store_products
set local_code = 'S-102'
where local_code = 'E105';

update public.store_rent_rates
set local_code = 'S-102'
where local_code = 'E105';

update public.tenant_leases
set local_code = 'S-102'
where local_code = 'E105';

update public.tenant_payments
set local_code = 'S-102'
where local_code = 'E105';

update public.tenant_notes
set local_code = 'S-102'
where local_code = 'E105';

commit;
