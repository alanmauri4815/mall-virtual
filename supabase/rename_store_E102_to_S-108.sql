-- Cambio puntual de codigo visible: E102 -> S-108.
-- Mantiene el guion para evitar confusion con el antiguo S108.
-- Ejecutar en Supabase SQL Editor.

begin;

update public.stores
set local_code = 'S-108'
where local_code = 'E102';

update public.store_products
set local_code = 'S-108'
where local_code = 'E102';

update public.store_rent_rates
set local_code = 'S-108'
where local_code = 'E102';

update public.tenant_leases
set local_code = 'S-108'
where local_code = 'E102';

update public.tenant_payments
set local_code = 'S-108'
where local_code = 'E102';

update public.tenant_notes
set local_code = 'S-108'
where local_code = 'E102';

commit;
