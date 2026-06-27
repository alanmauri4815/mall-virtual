-- Cambio puntual de codigo visible: O102 -> S-107.
-- Mantiene el guion para evitar confusion con el antiguo S107.
-- Ejecutar en Supabase SQL Editor.

begin;

update public.stores
set local_code = 'S-107'
where local_code = 'O102';

update public.store_products
set local_code = 'S-107'
where local_code = 'O102';

update public.store_rent_rates
set local_code = 'S-107'
where local_code = 'O102';

update public.tenant_leases
set local_code = 'S-107'
where local_code = 'O102';

update public.tenant_payments
set local_code = 'S-107'
where local_code = 'O102';

update public.tenant_notes
set local_code = 'S-107'
where local_code = 'O102';

commit;
