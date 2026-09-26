const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const uiSource = fs.readFileSync(path.join(projectRoot, 'js/mall/mall-ui.js'), 'utf8');
const storesSource = fs.readFileSync(path.join(projectRoot, 'js/mall/mall-stores.js'), 'utf8');

function section(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    assert.notEqual(start, -1, `Missing authorization marker: ${startMarker}`);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.notEqual(end, -1, `Missing authorization boundary after: ${startMarker}`);
    return source.slice(start, end);
}

const adminVerification = section(
    uiSource,
    'async function refreshAuthoritativeAdminAccess',
    'function applyUserRole'
);
assert.match(adminVerification, /supabaseClient\.auth\.getUser\(\)/);
assert.match(adminVerification, /supabaseClient\.rpc\(['"]is_mall_admin['"]\)/);
assert.match(adminVerification, /String\(currentTenantUser\?\.id/);
assert.match(adminVerification, /authoritativeAdminUserId\s*=\s*userId/);

const requiredAdmin = section(
    uiSource,
    'async function requireAuthoritativeAdminAccess',
    'window.closeSuperAdmin'
);
assert.match(requiredAdmin, /currentAccessRole\s*===\s*['"]guest['"]/);
assert.match(requiredAdmin, /getVerifiedTenantSessionUser\(\{\s*forceAdminRefresh:\s*true\s*\}\)/);
assert.match(requiredAdmin, /userHasAdminAccess\(currentUserProfile,\s*sessionUser\)/);
assert.match(requiredAdmin, /resetPrivilegedClientState\(\)/);

const seatMonitor = section(
    uiSource,
    'async function setRemoteSeatTraceEnabled',
    'function traceRemoteSeatPosition'
);
assert.match(uiSource, /let remoteSeatTraceEnabled\s*=\s*false/);
assert.doesNotMatch(uiSource, /new URLSearchParams\(window\.location\.search\)\.get\(['"]remoteSeatTrace['"]\)/);
assert.match(seatMonitor, /requireAuthoritativeAdminAccess\(\{\s*showAlert:\s*false\s*\}\)/);
assert.match(seatMonitor, /mallCanUseAdminTools/);
assert.match(seatMonitor, /mountRemoteSeatTracePanel\(\)/);
const adminMonitorToggle = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
assert.match(adminMonitorToggle, /id="admin-toggle-seat-motion-monitor"[^>]+data-mall-tool="seat-motion-monitor"/);
assert.match(adminMonitorToggle, /id="admin-seat-motion-monitor-status"/);

const tenantPanelEntry = section(
    uiSource,
    'window.openTenantAdminFromMenu = async function',
    'window.openSuperAdmin = async function'
);
assert.match(tenantPanelEntry, /currentAccessRole\s*===\s*['"]guest['"]/);
assert.match(tenantPanelEntry, /getVerifiedTenantSessionUser/);
assert.match(tenantPanelEntry, /verifyTenantStoreAccess\(myOwnedStore\)/);
assert.match(tenantPanelEntry, /if\s*\(!access\.allowed\)/);

const ownedStores = section(
    storesSource,
    'async function refreshMyOwnedStoresFromSupabase',
    'function updateLocalStoresCache'
);
assert.match(ownedStores, /if\s*\(userHasAdminAccess\(currentUserProfile,\s*currentTenantUser\)\)/);
assert.match(ownedStores, /\.from\(['"]stores['"]\)[\s\S]*?\.select\(['"]\*['"]\)[\s\S]*?\.limit\(500\)/);
assert.match(ownedStores, /\.eq\(['"]owner_id['"],\s*currentTenantUser\.id\)/);
assert.match(ownedStores, /!storeOwnerId\s*\|\|\s*storeOwnerId\s*===\s*String\(currentTenantUser\.id\)/);

console.log('Authorization boundaries require a verified session, authoritative admin RPC and store ownership.');
