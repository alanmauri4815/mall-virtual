-- Auditoria de solo lectura de columnas para la siguiente fase multimall.

select
    table_name,
    ordinal_position,
    column_name,
    data_type,
    is_nullable,
    column_default
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
      'mall_assistant_sessions',
      'mall_assistant_usage',
      'mall_assistant_rate_limits',
      'mall_assistant_answer_cache',
      'mall_feedback',
      'tenant_leases',
      'tenant_payments',
      'tenant_notes'
  )
order by table_name, ordinal_position;
