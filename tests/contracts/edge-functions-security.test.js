const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const functionsRoot = path.resolve(__dirname, '..', '..', 'supabase', 'functions');
const readFunction = (name) => fs.readFileSync(path.join(functionsRoot, name, 'index.ts'), 'utf8');
const functionDirectories = [
    'admin-create-tenant',
    'member-promotion-email',
    'store-attendant',
    'telegram-bot'
];

const functions = {
    adminCreateTenant: readFunction('admin-create-tenant'),
    memberPromotionEmail: readFunction('member-promotion-email'),
    storeAttendant: readFunction('store-attendant'),
    telegramBot: readFunction('telegram-bot')
};

Object.entries(functions).forEach(([name, source]) => {
    assert.match(source, /Deno\.serve\s*\(/, `${name} must expose a Deno handler`);
    assert.match(source, /request\.method\s*!==\s*["']POST["']/, `${name} must reject non-POST requests`);
    assert.doesNotMatch(
        source,
        /["']Access-Control-Allow-Origin["']\s*:\s*["']\*["']/,
        `${name} must not allow every browser origin`
    );
    assert.doesNotMatch(source, /(?:service_role|bot\d+:)[A-Za-z0-9._-]{20,}/i, `${name} contains a literal secret`);
});

functionDirectories.forEach((name) => {
    const directory = path.join(functionsRoot, name);
    const configPath = path.join(directory, 'deno.json');
    const lockPath = path.join(directory, 'deno.lock');
    assert.ok(fs.existsSync(configPath), `${name} must have an isolated deno.json`);
    assert.ok(fs.existsSync(lockPath), `${name} must have a Deno lockfile`);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.equal(config.nodeModulesDir, 'none', `${name} must not rewrite npm node_modules`);
    assert.equal(
        config.imports['@supabase/supabase-js'],
        'npm:@supabase/supabase-js@2.112.2',
        `${name} must pin supabase-js exactly`
    );
    assert.match(readFunction(name), /from\s+["']@supabase\/supabase-js["']/);
});

assert.match(functions.adminCreateTenant, /auth\.getUser\(token\)/);
assert.match(functions.adminCreateTenant, /\.from\(["']admin_members["']\)/);
assert.ok(
    functions.adminCreateTenant.indexOf('.from("admin_members")') < functions.adminCreateTenant.indexOf('auth.admin.createUser'),
    'Admin membership must be verified before creating an Auth user'
);

assert.match(functions.memberPromotionEmail, /auth\.getUser\(token\)/);
assert.match(functions.memberPromotionEmail, /rpc\(["']is_mall_admin["']\)/);
assert.match(functions.memberPromotionEmail, /mode\s*===\s*["']announce-active["']/);

assert.match(functions.storeAttendant, /store_bot_rate_limits/);
assert.match(functions.storeAttendant, /requestCount\s*>\s*30/);
assert.match(functions.storeAttendant, /leadRequestCount\s*>\s*5/);

assert.match(functions.telegramBot, /x-telegram-bot-api-secret-token/i);
assert.match(functions.telegramBot, /x-mall-notify-secret/i);
assert.match(functions.telegramBot, /receivedSecret\s*!==\s*telegramWebhookSecret/);

console.log('Edge Functions enforce origins, sessions, admin membership, webhook secrets and rate limits.');
