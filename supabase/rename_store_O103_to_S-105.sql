-- Cambio puntual de codigo visible: O103 -> S-105.
-- Mantiene el guion para evitar confusion con el antiguo S105.
-- Ejecutar en Supabase SQL Editor.

begin;

update public.stores
set local_code = 'S-105'
where local_code = 'O103';

update public.store_products
set local_code = 'S-105'
where local_code = 'O103';

update public.store_rent_rates
set local_code = 'S-105'
where local_code = 'O103';

update public.tenant_leases
set local_code = 'S-105'
where local_code = 'O103';

update public.tenant_payments
set local_code = 'S-105'
where local_code = 'O103';

update public.tenant_notes
set local_code = 'S-105'
where local_code = 'O103';

commit;
