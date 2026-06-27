-- Cambio puntual de codigo visible: E104 -> S-104.
-- Mantiene el guion para evitar confusion con el antiguo S104.
-- Ejecutar en Supabase SQL Editor.

begin;

update public.stores
set local_code = 'S-104'
where local_code = 'E104';

update public.store_products
set local_code = 'S-104'
where local_code = 'E104';

update public.store_rent_rates
set local_code = 'S-104'
where local_code = 'E104';

update public.tenant_leases
set local_code = 'S-104'
where local_code = 'E104';

update public.tenant_payments
set local_code = 'S-104'
where local_code = 'E104';

update public.tenant_notes
set local_code = 'S-104'
where local_code = 'E104';

commit;
