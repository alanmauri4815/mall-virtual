-- Verificacion de la sexta fase multimall. Solo lectura.

select
    table_name,
    total_rows,
    rows_without_mall
from (
    select 'tenant_leases' as table_name,
           count(*) as total_rows,
           count(*) filter (where mall_id is null) as rows_without_mall
    from public.tenant_leases
    union all
    select 'tenant_payments',
           count(*),
           count(*) filter (where mall_id is null)
    from public.tenant_payments
    union all
    select 'tenant_notes',
           count(*),
           count(*) filter (where mall_id is null)
    from public.tenant_notes
) scoped
order by table_name;

select
    table_name,
    column_name,
    is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('tenant_leases', 'tenant_payments', 'tenant_notes')
  and column_name = 'mall_id'
order by table_name;

select
    event_object_table as table_name,
    trigger_name,
    event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
      'tenant_leases_mall_scope_guard',
      'tenant_payments_mall_scope_guard',
      'tenant_notes_mall_scope_guard'
  )
order by event_object_table, trigger_name, event_manipulation;

select
    tablename,
    policyname,
    cmd,
    qual,
    with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('tenant_leases', 'tenant_payments', 'tenant_notes')
order by tablename, policyname;
