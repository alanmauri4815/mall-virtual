-- Cambio puntual de codigo visible: O104 -> S-103.
-- Mantiene el guion para evitar confusion con el antiguo S103.
-- Ejecutar en Supabase SQL Editor.

begin;

update public.stores
set local_code = 'S-103'
where local_code = 'O104';

update public.store_products
set local_code = 'S-103'
where local_code = 'O104';

update public.store_rent_rates
set local_code = 'S-103'
where local_code = 'O104';

update public.tenant_leases
set local_code = 'S-103'
where local_code = 'O104';

update public.tenant_payments
set local_code = 'S-103'
where local_code = 'O104';

update public.tenant_notes
set local_code = 'S-103'
where local_code = 'O104';

commit;
