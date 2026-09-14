-- Auditoria de solo lectura: columnas necesarias para aislar las superficies restantes.

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
  and column_name in (
      'id',
      'mall_id',
      'scope_id',
      'object_id',
      'promotion_id',
      'auth_user_id',
      'tenant_auth_user_id',
      'store_id',
      'lease_id',
      'local_code',
      'visibility',
      'active',
      'created_at',
      'updated_at'
  )
order by table_name, ordinal_position;
