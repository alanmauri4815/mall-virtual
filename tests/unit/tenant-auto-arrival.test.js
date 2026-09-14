const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-ui.js'), 'utf8');

assert.match(
    source,
    /if \(role === ["']tenant["'] && user && currentUserRole !== ["']admin["'] && !skipTenantAutoArrival\)/,
    'Administrators must bypass tenant store resolution during mall entry.'
);

assert.match(
    source,
    /adminAccessPromise,\s*1800,[\s\S]*?adminValidationTimedOut = true/,
    'A slow admin permission lookup must not keep the login overlay blocked.'
);

assert.match(
    source,
    /skipTenantAutoArrival: adminValidationTimedOut/,
    'A timed-out permission lookup must use the immediate safe entry path.'
);

assert.match(
    source,
    /forceEntrySpawn\(\);[\s\S]*?void scheduleTenantAutoArrival\(user\)\.catch/,
    'Tenant arrival must show a safe spawn before resolving the store in the background.'
);

assert.match(
    source,
    /Date\.now\(\) - startedAt < 6000[\s\S]*?setTimeout\(runTryArrival, 350\)/,
    'Background tenant placement must stop retrying after a bounded lookup window.'
);

assert.match(
    source,
    /\.from\(['"]tenant_leases['"]\)[\s\S]*?\.eq\(['"]tenant_auth_user_id['"], userId\)[\s\S]*?\.eq\(['"]status['"], ['"]active['"]\)/,
    'Tenant arrival should prefer the active lease linked to the authenticated user.'
);

assert.match(
    source,
    /\.limit\(5\),\s*3000,\s*['"]La consulta del local tardó demasiado\./,
    'The active lease lookup must not block mall entry indefinitely.'
);

console.log('tenant-auto-arrival.test.js: ok');
