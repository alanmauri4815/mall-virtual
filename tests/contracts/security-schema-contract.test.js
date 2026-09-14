const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const schemaPath = path.resolve(__dirname, '..', '..', 'supabase', 'mall_current_setup.sql');
const sql = fs.readFileSync(schemaPath, 'utf8');

function requirePattern(pattern, message) {
    assert.match(sql, pattern, message);
}

[
    'user_profiles',
    'admin_members',
    'tenant_applications',
    'stores',
    'store_products',
    'contact_messages',
    'mall_messages'
].forEach((table) => {
    requirePattern(
        new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, 'i'),
        `RLS must be enabled on public.${table}`
    );
});

requirePattern(
    /create\s+or\s+replace\s+function\s+public\.is_mall_admin\(\)[\s\S]*?security\s+definer[\s\S]*?auth\.uid\(\)[\s\S]*?admin_members/i,
    'Administrator checks must derive from the authenticated UID and admin_members'
);
requirePattern(
    /create\s+policy\s+"Tenants can update owned stores"[\s\S]*?auth\.uid\(\)\s*=\s*owner_id[\s\S]*?public\.is_mall_admin\(\)/i,
    'Store updates must be restricted to the owner or an administrator'
);
requirePattern(
    /create\s+policy\s+"Tenants manage products for owned stores"[\s\S]*?s\.owner_id\s*=\s*auth\.uid\(\)[\s\S]*?public\.is_mall_admin\(\)/i,
    'Product writes must be restricted to the store owner or an administrator'
);
requirePattern(
    /create\s+policy\s+"Anyone can submit tenant applications"[\s\S]*?for\s+insert/i,
    'Anonymous application access must be insert-only'
);

const policyStatements = sql.match(/create\s+policy\s+[\s\S]*?;/gi) || [];
const privateReadPolicies = policyStatements.filter((statement) => (
    /on\s+public\.(?:admin_members|user_profiles|tenant_applications)\s+for\s+(?:all|select)\b/i.test(statement)
));

privateReadPolicies.forEach((statement) => {
    assert.doesNotMatch(
        statement,
        /\bto\s+(?:public|anon)\b/i,
        `Private read policy exposes public/anon access: ${statement.split(/\r?\n/)[0]}`
    );
});

console.log('Supabase security contract verified for identity, tenant, store, product and message tables.');
