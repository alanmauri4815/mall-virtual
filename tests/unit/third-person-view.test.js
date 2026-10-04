const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const boot = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-boot.js'), 'utf8');
const constants = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-constants.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-ui.js'), 'utf8');
const npc = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-npc.js'), 'utf8');
const entryStart = ui.indexOf('async function performMallEntry({');
const entryEnd = ui.indexOf('window.startMallExperience', entryStart);
const entry = ui.slice(entryStart, entryEnd);

assert.match(html, /id="third-person-view-menu-item"[^>]*data-mall-action="toggleThirdPersonView"/);
assert.match(boot, /toggleThirdPersonView:\s*\(\)\s*=>\s*callGlobal\('toggleThirdPersonView'\)/);
assert.match(constants, /const thirdPersonCamera = new THREE\.PerspectiveCamera/);
assert.match(constants, /window\.getMallRenderCamera = \(\) => isThirdPersonView \? thirdPersonCamera : camera/);
assert.match(constants, /window\.setMallThirdPersonView = function \(enabled\)/);
assert.match(constants, /isThirdPersonView = shouldUseThirdPerson;[\s\S]*?window\.updateMallThirdPersonAvatar\?\./);
assert.match(constants, /window\.toggleThirdPersonView = function/);
assert.match(constants, /window\.checkCollision\(/);
assert.match(ui, /localThirdPersonAvatar = createGameReadyAvatar/);
assert.match(ui, /actor\.mesh\.position\.set\([\s\S]*camera\.position\.x[\s\S]*camera\.position\.z/);
assert.match(ui, /applyAvatarPose\(actor, moving \? distance \/ MALL_WALK_TRAVEL_SCALE : 0, nowMs\)/);
assert.match(npc, /renderer\.render\(scene, window\.getMallRenderCamera\?\.\(\) \|\| camera\)/);
assert.match(entry, /if \(!isWalking\) window\.toggleWalkMode\(\{ preservePosition: true \}\);\s*window\.setMallThirdPersonView\?\.\(true\);/);

console.log('Third-person view is the entry default, follows the local visitor, and preserves the logical walk camera.');
