-- Cambio puntual de codigo visible: E103 -> S-106.
-- Mantiene el guion para evitar confusion con el antiguo S106.
-- Ejecutar en Supabase SQL Editor.

begin;

update public.stores
set local_code = 'S-106'
where local_code = 'E103';

update public.store_products
set local_code = 'S-106'
where local_code = 'E103';

update public.store_rent_rates
set local_code = 'S-106'
where local_code = 'E103';

update public.tenant_leases
set local_code = 'S-106'
where local_code = 'E103';

update public.tenant_payments
set local_code = 'S-106'
where local_code = 'E103';

update public.tenant_notes
set local_code = 'S-106'
where local_code = 'E103';

commit;
