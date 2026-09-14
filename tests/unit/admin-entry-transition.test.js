const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const uiSource = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-ui.js'), 'utf8');

assert.match(
    uiSource,
    /let mallEntryPromise = null;/,
    'Mall entry must keep one shared transition promise.'
);

assert.match(
    uiSource,
    /if \(mallEntryPromise\) return mallEntryPromise;[\s\S]*?mallEntryPromise = performMallEntry\(options\);/,
    'Concurrent entry attempts must reuse the active transition instead of returning early.'
);

assert.match(
    uiSource,
    /if \(mallEntryCompleted\) \{\s*finalizeMallEntryUi\(\);\s*return true;\s*\}/,
    'A completed entry must always restore the visible mall UI.'
);

assert.match(
    uiSource,
    /const enterAsAdmin = hasAdminAccess \|\| currentUserRole === ['"]admin['"];[\s\S]*?role: enterAsAdmin \? ['"]admin['"] : ['"]tenant['"][\s\S]*?skipTenantAutoArrival: adminValidationTimedOut \|\| enterAsAdmin/,
    'Administrator login must bypass tenant placement lookup and enter with the admin role.'
);

assert.match(
    uiSource,
    /window\.startMallExperience = async function \(\) \{[\s\S]*?role: "guest"[\s\S]*?\};/,
    'The generic entry button must always use the anonymous guest flow.'
);

assert.doesNotMatch(
    uiSource,
    /window\.startMallExperience = async function \(\) \{[\s\S]*?window\.memberLogin/,
    'The generic guest entry must never submit an autofilled member password.'
);

assert.match(
    uiSource,
    /clearLocalSupabaseSessionStorage[\s\S]*?auth\.storage\?\.removeItem[\s\S]*?supabaseClient\.auth\.signOut\(\{ scope: ['"]local['"] \}\)/,
    'Guest entry must clear persisted auth state without waiting on the blocked session reader.'
);

assert.match(
    uiSource,
    /catch \(error\) \{[\s\S]*?El cierre de sesión anterior continúa en segundo plano[\s\S]*?\}/,
    'A stale auth lock must not block the guest transition.'
);

console.log('admin-entry-transition.test.js: ok');
