const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const world = fs.readFileSync(path.join(root, 'js/mall/mall-world.js'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'js/mall/mall-navigation.js'), 'utf8');
const arrival = fs.readFileSync(path.join(root, 'js/mall/mall-visitor-arrival.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'js/mall/mall-ui.js'), 'utf8');

assert.match(world, /const PLAYER_HEIGHT_REFERENCE_CM = 175/);
assert.match(world, /const PLAYER_EYE_HEIGHT_AT_REFERENCE = 2\.15/);
assert.match(world, /let PLAYER_EYE_HEIGHT = PLAYER_EYE_HEIGHT_AT_REFERENCE/);
assert.match(world, /window\.setPlayerAvatarEyeHeight = function\(avatarHeight, \{ force = false \} = \{\}\)/);
assert.match(world, /new CustomEvent\('mall:avatar-eye-height-changed'/);
assert.match(navigation, /window\.addEventListener\('mall:avatar-eye-height-changed'/);
assert.match(navigation, /syncWalkCameraEyeHeight\(\{ levelView: true \}\)/);
assert.match(arrival, /const getEntryEyeY = \(\) =>/);
assert.doesNotMatch(arrival, /const ENTRY_EYE_Y/);
assert.match(ui, /function syncPlayerEyeHeightToAvatarProfile\(\)/);
assert.match(ui, /window\.setPlayerAvatarEyeHeight\?\.\(myAvatarHeight, \{ force: true \}\)/);
assert.equal((ui.match(/syncPlayerEyeHeightToAvatarProfile\(\);/g) || []).length, 4);

console.log('avatar-eye-height.test.js: ok');
