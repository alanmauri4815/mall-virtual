-- Renombrado batch de un brazo completo hacia codigos O-* visibles.
-- Ejecutar en Supabase SQL Editor.

begin;

update public.stores
set local_code = case local_code
    when 'S104' then 'O-103'
    when 'N104' then 'O-104'
    when 'S103' then 'O-105'
    when 'N103' then 'O-106'
    when 'S102' then 'O-107'
    when 'N102' then 'O-108'
    else local_code
end
where local_code in ('S104', 'N104', 'S103', 'N103', 'S102', 'N102');

update public.store_products
set local_code = case local_code
    when 'S104' then 'O-103'
    when 'N104' then 'O-104'
    when 'S103' then 'O-105'
    when 'N103' then 'O-106'
    when 'S102' then 'O-107'
    when 'N102' then 'O-108'
    else local_code
end
where local_code in ('S104', 'N104', 'S103', 'N103', 'S102', 'N102');

update public.store_rent_rates
set local_code = case local_code
    when 'S104' then 'O-103'
    when 'N104' then 'O-104'
    when 'S103' then 'O-105'
    when 'N103' then 'O-106'
    when 'S102' then 'O-107'
    when 'N102' then 'O-108'
    else local_code
end
where local_code in ('S104', 'N104', 'S103', 'N103', 'S102', 'N102');

update public.tenant_leases
set local_code = case local_code
    when 'S104' then 'O-103'
    when 'N104' then 'O-104'
    when 'S103' then 'O-105'
    when 'N103' then 'O-106'
    when 'S102' then 'O-107'
    when 'N102' then 'O-108'
    else local_code
end
where local_code in ('S104', 'N104', 'S103', 'N103', 'S102', 'N102');

update public.tenant_payments
set local_code = case local_code
    when 'S104' then 'O-103'
    when 'N104' then 'O-104'
    when 'S103' then 'O-105'
    when 'N103' then 'O-106'
    when 'S102' then 'O-107'
    when 'N102' then 'O-108'
    else local_code
end
where local_code in ('S104', 'N104', 'S103', 'N103', 'S102', 'N102');

update public.tenant_notes
set local_code = case local_code
    when 'S104' then 'O-103'
    when 'N104' then 'O-104'
    when 'S103' then 'O-105'
    when 'N103' then 'O-106'
    when 'S102' then 'O-107'
    when 'N102' then 'O-108'
    else local_code
end
where local_code in ('S104', 'N104', 'S103', 'N103', 'S102', 'N102');

commit;
