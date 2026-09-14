const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const migration = fs.readFileSync(
    path.join(root, 'supabase', 'multimall_phase2_access_20260908.sql'),
    'utf8'
);
const verification = fs.readFileSync(
    path.join(root, 'supabase', 'multimall_phase2_verify_20260908.sql'),
    'utf8'
);
const compositeKeys = fs.readFileSync(
    path.join(root, 'supabase', 'multimall_phase4_composite_keys_20260908.sql'),
    'utf8'
);
const compositeVerification = fs.readFileSync(
    path.join(root, 'supabase', 'multimall_phase4_verify_20260908.sql'),
    'utf8'
);
const remainingScopeAudit = fs.readFileSync(
    path.join(root, 'supabase', 'multimall_phase5_remaining_scope_audit_20260908.sql'),
    'utf8'
);
const analyticsScope = fs.readFileSync(
    path.join(root, 'supabase', 'multimall_phase5_analytics_scope_20260908.sql'),
    'utf8'
);
const policyAudit = fs.readFileSync(
    path.join(root, 'supabase', 'multimall_phase5_policy_audit_20260908.sql'),
    'utf8'
);
const remainingColumns = fs.readFileSync(
    path.join(root, 'supabase', 'multimall_phase5_remaining_columns_20260908.sql'),
    'utf8'
);
const focusColumns = fs.readFileSync(
    path.join(root, 'supabase', 'multimall_phase5_focus_columns_20260908.sql'),
    'utf8'
);
const mallUi = fs.readFileSync(
    path.join(root, 'js', 'mall', 'mall-ui.js'),
    'utf8'
);
const tenantAccess = fs.readFileSync(
    path.join(root, 'supabase', 'multimall_phase6_tenant_access_20260909.sql'),
    'utf8'
);
const tenantVerification = fs.readFileSync(
    path.join(root, 'supabase', 'multimall_phase6_tenant_verify_20260909.sql'),
    'utf8'
);
const tenantPolicyCleanup = fs.readFileSync(
    path.join(root, 'supabase', 'multimall_phase6_tenant_policy_cleanup_20260909.sql'),
    'utf8'
);

assert.match(migration, /create table if not exists public\.mall_admin_memberships/i);
assert.match(migration, /create or replace function public\.is_mall_admin_for\(p_mall_id uuid\)/i);
assert.match(migration, /public\.is_mall_admin\(\)[\s\S]*or exists/i);
assert.match(migration, /create or replace function public\.protect_mall_scope_change\(\)/i);
assert.match(migration, /mall_id es obligatorio/i);
assert.match(migration, /old\.mall_id is distinct from new\.mall_id/i);
assert.match(migration, /Public reads scoped store catalog/i);
assert.match(migration, /Owners and mall admins manage scoped products/i);
assert.match(migration, /Mall admins manage scoped editable objects/i);
assert.match(migration, /Public sends scoped mall messages/i);
assert.match(migration, /mall_id is not null/i);
assert.doesNotMatch(migration, /mall_id uuid[^\n]*default/i);
assert.match(migration, /drop policy if exists/i);
assert.match(verification, /from pg_policies/i);
assert.match(verification, /mall_scope_guard/i);
assert.match(verification, /mall_admin_memberships/i);
assert.match(compositeKeys, /add primary key \(mall_id, object_id\)/i);
assert.match(compositeKeys, /stores_mall_local_code_uidx/i);
assert.match(compositeKeys, /store_physical_links_mall_space_fkey/i);
assert.match(compositeVerification, /rows_without_mall/i);
assert.match(compositeVerification, /constraint_type in \('PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY'\)/i);
assert.match(compositeVerification, /stores_mall_slug_uidx/i);
assert.match(compositeVerification, /is_nullable/i);
assert.match(remainingScopeAudit, /mall_promotions/i);
assert.match(remainingScopeAudit, /member_monthly_activity/i);
assert.match(remainingScopeAudit, /pg_policies/i);
assert.match(analyticsScope, /p_mall_id uuid/i);
assert.match(analyticsScope, /analytics_sessions alter column mall_id set not null/i);
assert.match(analyticsScope, /analytics_events alter column mall_id set not null/i);
assert.match(policyAudit, /from pg_policies/i);
assert.match(policyAudit, /tenant_notes/i);
assert.match(remainingColumns, /mall_assistant_sessions/i);
assert.match(remainingColumns, /column_default/i);
assert.match(focusColumns, /scope_id/i);
assert.match(focusColumns, /tenant_auth_user_id/i);
assert.match(mallUi, /mallUiScopeQuery\(\s*supabaseClient[\s\S]*from\('tenant_leases'\)/i);
assert.match(mallUi, /mall_id:\s*window\.mallContext\?\.id\s*\|\|\s*null/i);
assert.match(mallUi, /from\('tenant_applications'\)[\s\S]*eq\('mall_id',\s*window\.mallContext\?\.id/i);
assert.match(mallUi, /from\('stores'\)[\s\S]*mallUiScopeQuery/i);
assert.match(tenantAccess, /tenant_leases[\s\S]*alter column mall_id set not null/i);
assert.match(tenantAccess, /tenant_payments[\s\S]*alter column mall_id set not null/i);
assert.match(tenantAccess, /tenant_notes[\s\S]*alter column mall_id set not null/i);
assert.match(tenantAccess, /is_mall_admin_for\(mall_id\)/i);
assert.match(tenantAccess, /s\.mall_id = tenant_leases\.mall_id/i);
assert.match(tenantVerification, /rows_without_mall/i);
assert.match(tenantVerification, /information_schema\.triggers/i);
assert.match(tenantVerification, /pg_policies/i);
assert.match(tenantPolicyCleanup, /Admins manage tenant leases/i);
assert.match(tenantPolicyCleanup, /Tenants read visible notes/i);

console.log('multimall-phase2-access.test.js: ok');
