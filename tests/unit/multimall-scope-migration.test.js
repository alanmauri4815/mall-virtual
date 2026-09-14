const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const migration = fs.readFileSync(
    path.join(root, 'supabase', 'multimall_core_scope_20260908.sql'),
    'utf8'
);
const keyAudit = fs.readFileSync(
    path.join(root, 'supabase', 'multimall_phase3_key_audit_20260908.sql'),
    'utf8'
);

const scopedTables = [
    'stores',
    'store_products',
    'physical_spaces',
    'store_physical_links',
    'mall_editable_objects',
    'mall_object_overrides',
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
    'tenant_applications',
    'tenant_leases',
    'tenant_payments',
    'tenant_notes',
    'mall_messages'
];

assert.match(migration, /713c1740-0621-4fd7-98e6-fac2a93e4781/);
assert.match(migration, /raise exception 'No existe el registro canonico del mall Providencia\.'/);
assert.doesNotMatch(migration, /add column if not exists mall_id uuid[^;]*default/i);
assert.doesNotMatch(migration, /alter table public\.\w+[^;]*mall_id[^;]*set not null/i);
assert.match(keyAudit, /information_schema\.table_constraints/i);
assert.match(keyAudit, /from pg_indexes/i);
assert.match(keyAudit, /store_products/i);

scopedTables.forEach((table) => {
    assert.match(migration, new RegExp(`alter table public\\.${table} add column if not exists mall_id`, 'i'));
    assert.match(migration, new RegExp(`update public\\.${table} set mall_id`, 'i'));
    assert.match(migration, new RegExp(`create index if not exists ${table}_mall_id_idx`, 'i'));
});

console.log('multimall-scope-migration.test.js: ok');
