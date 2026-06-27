-- Cambio puntual de codigo visible: O101 -> SE-10.
-- Mantiene el guion para evitar confusion con codigos antiguos.
-- Ejecutar en Supabase SQL Editor.

begin;

update public.stores
set local_code = 'SE-10'
where local_code = 'O101';

update public.store_products
set local_code = 'SE-10'
where local_code = 'O101';

update public.store_rent_rates
set local_code = 'SE-10'
where local_code = 'O101';

update public.tenant_leases
set local_code = 'SE-10'
where local_code = 'O101';

update public.tenant_payments
set local_code = 'SE-10'
where local_code = 'O101';

update public.tenant_notes
set local_code = 'SE-10'
where local_code = 'O101';

commit;
