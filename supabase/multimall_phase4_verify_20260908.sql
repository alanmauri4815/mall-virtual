-- Verificacion de la cuarta fase multimall.
-- Ejecutar despues de multimall_phase4_composite_keys_20260908.sql.

select
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as columns
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_schema = tc.constraint_schema
 and kcu.constraint_name = tc.constraint_name
 and kcu.table_name = tc.table_name
where tc.constraint_schema = 'public'
  and tc.table_name in (
      'stores',
      'physical_spaces',
      'mall_editable_objects',
      'mall_object_overrides',
      'store_physical_links'
  )
  and tc.constraint_type in ('PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY')
group by tc.table_name, tc.constraint_name, tc.constraint_type
order by tc.table_name, tc.constraint_name;

select
    table_name,
    count(*) filter (where mall_id is null) as rows_without_mall,
    count(*) as total_rows
from (
    select 'stores' as table_name, mall_id from public.stores
    union all
    select 'physical_spaces', mall_id from public.physical_spaces
    union all
    select 'mall_editable_objects', mall_id from public.mall_editable_objects
    union all
    select 'mall_object_overrides', mall_id from public.mall_object_overrides
    union all
    select 'store_physical_links', mall_id from public.store_physical_links
    union all
    select 'store_products', mall_id from public.store_products
) scoped
group by table_name
order by table_name;

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'stores'
  and indexname in ('stores_mall_local_code_uidx', 'stores_mall_slug_uidx')
order by indexname;

select table_name, column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and column_name = 'mall_id'
  and table_name in (
      'stores',
      'store_products',
      'physical_spaces',
      'store_physical_links',
      'mall_editable_objects',
      'mall_object_overrides'
  )
order by table_name;
