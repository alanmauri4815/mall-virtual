-- Auditoria previa a las claves compuestas multimall.
-- Ejecutar en Supabase SQL Editor. Solo lee metadatos; no modifica tablas.

select
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    kcu.ordinal_position
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
    on kcu.constraint_schema = tc.constraint_schema
   and kcu.constraint_name = tc.constraint_name
   and kcu.table_name = tc.table_name
where tc.constraint_schema = 'public'
  and tc.table_name in (
      'malls',
      'stores',
      'store_products',
      'physical_spaces',
      'store_physical_links',
      'mall_editable_objects',
      'mall_object_overrides',
      'mall_promotions',
      'mall_promotion_codes',
      'mall_promotion_claims'
  )
order by tc.table_name, tc.constraint_name, kcu.ordinal_position;

select
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name as referenced_table,
    ccu.column_name as referenced_column
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
    on kcu.constraint_schema = tc.constraint_schema
   and kcu.constraint_name = tc.constraint_name
   and kcu.table_name = tc.table_name
join information_schema.constraint_column_usage ccu
    on ccu.constraint_schema = tc.constraint_schema
   and ccu.constraint_name = tc.constraint_name
where tc.constraint_schema = 'public'
  and tc.constraint_type = 'FOREIGN KEY'
  and tc.table_name in (
      'stores',
      'store_products',
      'physical_spaces',
      'store_physical_links',
      'mall_editable_objects',
      'mall_object_overrides',
      'mall_promotions',
      'mall_promotion_codes',
      'mall_promotion_claims'
  )
order by tc.table_name, tc.constraint_name, kcu.ordinal_position;

select
    schemaname,
    tablename,
    indexname,
    indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
      'malls',
      'stores',
      'store_products',
      'physical_spaces',
      'store_physical_links',
      'mall_editable_objects',
      'mall_object_overrides',
      'mall_promotions',
      'mall_promotion_codes',
      'mall_promotion_claims'
  )
order by tablename, indexname;
