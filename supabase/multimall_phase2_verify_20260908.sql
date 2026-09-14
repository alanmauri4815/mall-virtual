-- Verificacion posterior a multimall_phase2_access_20260908.sql.

select mall_id, count(*) as total
from public.stores
group by mall_id
order by mall_id;

select table_name, count(*) as policy_count
from information_schema.table_privileges
where grantee in ('anon', 'authenticated')
  and table_name in (
      'tenant_applications', 'stores', 'store_products', 'mall_messages',
      'physical_spaces', 'store_physical_links', 'mall_editable_objects',
      'mall_object_overrides'
  )
group by table_name
order by table_name;

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
      'tenant_applications', 'stores', 'store_products', 'mall_messages',
      'physical_spaces', 'store_physical_links', 'mall_editable_objects',
      'mall_object_overrides', 'mall_admin_memberships'
  )
order by tablename, policyname;

select event_object_table as table_name, trigger_name
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name like '%_mall_scope_guard'
order by event_object_table;

select mall_id, auth_user_id, role
from public.mall_admin_memberships
order by mall_id, auth_user_id;
