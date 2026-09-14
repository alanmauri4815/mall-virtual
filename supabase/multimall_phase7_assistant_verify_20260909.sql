-- Verificacion de la septima fase multimall. Solo lectura.

select
    table_name,
    total_rows,
    rows_without_mall
from (
    select 'mall_assistant_settings' as table_name,
           count(*) as total_rows,
           count(*) filter (where mall_id is null) as rows_without_mall
    from public.mall_assistant_settings
    union all
    select 'mall_feedback',
           count(*),
           count(*) filter (where mall_id is null)
    from public.mall_feedback
) scoped
group by table_name, total_rows, rows_without_mall
order by table_name;

select
    table_name,
    column_name,
    is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('mall_assistant_settings', 'mall_feedback')
  and column_name = 'mall_id'
order by table_name;

select
    table_name,
    constraint_name,
    constraint_type
from information_schema.table_constraints
where table_schema = 'public'
  and table_name = 'mall_assistant_settings'
  and constraint_type = 'PRIMARY KEY';

select
    table_name,
    count(*) as legacy_scope_rows
from (
    select 'mall_assistant_sessions' as table_name from public.mall_assistant_sessions where scope_id = 'mall'
    union all
    select 'mall_assistant_usage' from public.mall_assistant_usage where scope_id = 'mall'
    union all
    select 'mall_assistant_rate_limits' from public.mall_assistant_rate_limits where scope_id = 'mall'
    union all
    select 'mall_assistant_answer_cache' from public.mall_assistant_answer_cache where scope_id = 'mall'
) legacy
group by table_name
order by table_name;

select
    routine_name,
    routine_type,
    data_type as return_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'submit_mall_feedback';

select
    tablename,
    policyname,
    cmd,
    qual,
    with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('mall_assistant_settings', 'mall_feedback')
order by tablename, policyname;
