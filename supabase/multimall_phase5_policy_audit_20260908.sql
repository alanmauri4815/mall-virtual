-- Auditoria de solo lectura de politicas RLS para superficies multimall restantes.

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
