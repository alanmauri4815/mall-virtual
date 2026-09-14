const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const context = read('js/mall/mall-context.js');
const boot = read('js/mall/mall-boot.js');
const ui = read('js/mall/mall-ui.js');
const editor = read('js/mall/mall-object-editor.js');
const constants = read('js/mall/mall-constants.js');
const analytics = read('js/mall/mall-analytics.js');

assert.match(context, /PROVIDENCIA_MALL_ID = ['"]713c1740-0621-4fd7-98e6-fac2a93e4781['"]/);
assert.match(context, /ENSAYO_MALL_ID = ['"]4a5ed5cf-6f03-4e7d-8fbb-3d01e151586d['"]/);
assert.match(context, /mall-virtual-one-mu\.vercel\.app['"]:\s*['"]ensayo['"]/);
assert.match(context, /window\.mallContext = context/);
assert.match(context, /querySelectorAll\('\[data-mall-context-name\]'\)/);
assert.match(context, /storageKey\(name\)/);
assert.match(context, /channelName\(name\)/);
assert.match(context, /scopeQuery\(query\)/);
assert.match(context, /scopePayload\(payload\)/);
assert.match(context, /configuredMalls\[requestedSlug\] \|\| configuredMalls\[hostSlug\] \|\| configuredMalls\.providencia/);

const contextScriptIndex = html.indexOf('js/mall/mall-context.js');
const bootScriptIndex = html.indexOf('js/mall/mall-boot.js');
assert.ok(contextScriptIndex >= 0 && contextScriptIndex < bootScriptIndex, 'Mall context must load before catalog boot.');
assert.match(boot, /const getContextKey = \(\) => window\.mallContext\?\.key/);
assert.match(boot, /syncContext\(\);/);
assert.match(boot, /scopeQuery\(client\.from\('stores'\)\.select\('\*'\)\)/);
assert.match(boot, /scopeQuery\(client\.from\('store_products'\)/);
assert.match(ui, /window\.mallContext\?\.channelName\('mall_presence'\)/);
assert.match(ui, /GAME_READY_AVATAR_URL = ['"]assets\/avatars\/mall-avatar-walk-v4\.glb['"]/);
assert.match(ui, /function createAvatar\([^)]*\) \{\s*const actor = createGameReadyAvatar\(/);
assert.match(ui, /GAME_READY_AVATAR_YAW_OFFSET = Math\.PI \/ 6/);
assert.match(ui, /clonedScene\.rotation\.y = GAME_READY_AVATAR_YAW_OFFSET;/);
assert.match(ui, /mallUiScopeQuery\([\s\S]*?from\('stores'\)\.select\('\*'\)\.eq\('owner_id', user\.id\)[\s\S]*?\)\.limit\(20\)/);
assert.match(ui, /rpc\('get_physical_space_teleport_points',\s*\{[\s\S]*?p_mall_id:\s*window\.mallContext\?\.id/);
assert.match(ui, /mallUiScopeQuery\([\s\S]*?from\('physical_spaces'\)[\s\S]*?select\(PHYSICAL_TELEPORT_SELECT_COLUMNS\)/);
assert.match(ui, /mallUiScopeQuery\([\s\S]*?from\('physical_spaces'\)[\s\S]*?\.update\(payload\)[\s\S]*?\.in\('physical_space_id', ids\)/);
assert.match(editor, /const LEGACY_STORAGE_KEY = ['"]mall-object-overrides-v1['"]/);
assert.match(editor, /if \(window\.mallContext\?\.isDefault\)/);
assert.match(editor, /scopePayload\(\{[\s\S]*object_id: entry\.id/);
assert.match(editor, /scopeQuery\(client\.from\('mall_object_overrides'\)\.select\('\*'\)\)/);
assert.match(constants, /window\.mallContext\?\.storageKey\('mall-runtime-checkpoint-v1'\)/);
assert.match(analytics, /window\.mallContext\?\.storageKey\('mall_analytics_session_v1'\)/);

console.log('mall-context.test.js: ok');
