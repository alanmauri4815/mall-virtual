-- Cambio puntual de codigo visible: N105 -> O-102.
-- Mantiene el guion para evitar confusion con codigos antiguos.
-- Ejecutar en Supabase SQL Editor.

begin;

update public.stores
set local_code = 'O-102'
where local_code = 'N105';

update public.store_products
set local_code = 'O-102'
where local_code = 'N105';

update public.store_rent_rates
set local_code = 'O-102'
where local_code = 'N105';

update public.tenant_leases
set local_code = 'O-102'
where local_code = 'N105';

update public.tenant_payments
set local_code = 'O-102'
where local_code = 'N105';

update public.tenant_notes
set local_code = 'O-102'
where local_code = 'N105';

commit;
