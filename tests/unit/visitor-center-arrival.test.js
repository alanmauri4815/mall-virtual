const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const constantsSource = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-constants.js'), 'utf8');
const uiSource = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-ui.js'), 'utf8');
const worldSource = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-world.js'), 'utf8');
const physicsSource = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-physics.js'), 'utf8');

assert.match(
    constantsSource,
    /const INFORMATION_DESK_VISITOR_SPAWN = new THREE\.Vector3\(-9\.90, 1\.95, -0\.22\);[\s\S]*?const INFORMATION_DESK_VISITOR_TARGET = new THREE\.Vector3\(-16\.75, 1\.82, 0\.00\);/,
    'Visitor entry must use a calibrated viewpoint facing the information desk.'
);

const fountainRadius = Number(worldSource.match(/registerCircularCollider\(0, 0, ([0-9.]+)/)?.[1]);
const playerCollisionRadius = Number(physicsSource.match(/const PLAYER_COLLISION_RADIUS = ([0-9.]+)/)?.[1]);
const visitorSpawnDistanceFromFountain = Math.hypot(-9.90, -0.22);
const visitorDeskDistance = Math.hypot(-9.90 - (-16.75), -0.22);
assert.ok(
    Number.isFinite(fountainRadius)
        && Number.isFinite(playerCollisionRadius)
        && visitorSpawnDistanceFromFountain > fountainRadius + playerCollisionRadius,
    'Visitor entry must remain outside the central circular structure and its collision margin.'
);
assert.ok(
    visitorDeskDistance > 6 && visitorDeskDistance < 8,
    'Visitor entry must keep a similar viewing distance to the information desk.'
);

assert.match(
    constantsSource,
    /const forceInformationDeskVisitorSpawn = \(\) => \{[\s\S]*?resolveWalkableSpawnPosition\(INFORMATION_DESK_VISITOR_SPAWN\)[\s\S]*?INFORMATION_DESK_VISITOR_TARGET/,
    'Visitor entry must resolve a walkable position in front of the information desk.'
);

assert.match(
    constantsSource,
    /function getEntryControlsTarget\([\s\S]*?maxDistance <= 0\.2[\s\S]*?return position\.clone\(\)\.add\(direction\.normalize\(\)\.multiplyScalar\(targetDistance\)\)/,
    'Visitor entry must preserve its requested camera position while walking mode clamps the orbit distance.'
);

assert.match(
    uiSource,
    /const isVisitorEntry = role === ["']guest["'][\s\S]*?role === ["']member["'][\s\S]*?role === ["']registered_visitor["']/,
    'Every visitor role must be classified as an information-desk entry.'
);

assert.match(
    uiSource,
    /else if \(isVisitorEntry\) \{\s*forceInformationDeskVisitorSpawn\(\);\s*\} else \{\s*forceEntrySpawn\(\);/,
    'Only visitor roles should be redirected to the information desk.'
);

assert.doesNotMatch(
    uiSource,
    /forceCentralVisitorSpawn\(\)/,
    'Visitor entry must not fall back to the old central spawn.'
);

console.log('visitor-center-arrival.test.js: ok');
