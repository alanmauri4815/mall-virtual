-- Auditoria de solo lectura para la siguiente fase multimall.
-- No modifica tablas, datos, politicas ni funciones.

select
    table_name,
    count(*) as total_rows,
    count(*) filter (where mall_id is null) as rows_without_mall
from (
    select 'mall_promotions' as table_name, mall_id from public.mall_promotions
    union all
    select 'mall_promotion_codes', mall_id from public.mall_promotion_codes
    union all
    select 'mall_promotion_claims', mall_id from public.mall_promotion_claims
    union all
    select 'member_monthly_activity', mall_id from public.member_monthly_activity
    union all
    select 'analytics_sessions', mall_id from public.analytics_sessions
    union all
    select 'analytics_events', mall_id from public.analytics_events
    union all
    select 'mall_maze_records', mall_id from public.mall_maze_records
    union all
    select 'mall_maze_runs', mall_id from public.mall_maze_runs
    union all
    select 'mall_assistant_settings', mall_id from public.mall_assistant_settings
    union all
    select 'mall_feedback', mall_id from public.mall_feedback
    union all
    select 'tenant_leases', mall_id from public.tenant_leases
    union all
    select 'tenant_payments', mall_id from public.tenant_payments
    union all
    select 'tenant_notes', mall_id from public.tenant_notes
) scoped
group by table_name
order by table_name;

select
    table_name,
    column_name,
    data_type,
    is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in (
      'mall_promotions',
      'mall_promotion_codes',
      'mall_promotion_claims',
      'member_monthly_activity',
      'analytics_sessions',
      'analytics_events',
      'mall_maze_records',
      'mall_maze_runs',
      'mall_assistant_settings',
      'mall_feedback',
      'tenant_leases',
      'tenant_payments',
      'tenant_notes'
  )
order by table_name, ordinal_position;

select
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
      'mall_promotions',
      'mall_promotion_codes',
      'mall_promotion_claims',
      'member_monthly_activity',
      'analytics_sessions',
      'analytics_events',
      'mall_maze_records',
      'mall_maze_runs',
      'mall_assistant_settings',
      'mall_feedback',
      'tenant_leases',
      'tenant_payments',
      'tenant_notes'
  )
order by tablename, policyname;

select
    routine_name,
    routine_type,
    data_type as return_type
from information_schema.routines
where routine_schema = 'public'
  and (
      routine_name ilike '%promotion%'
      or routine_name ilike '%maze%'
      or routine_name ilike '%feedback%'
      or routine_name ilike '%analytics%'
  )
order by routine_name;
