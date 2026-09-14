const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const world = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-world.js'), 'utf8');
const asset = path.join(root, 'assets', 'models', 'mall-public-commons-v1.glb');
const blenderSource = path.join(root, 'assets', 'blender', 'mall-public-commons-v1.blend');

assert.ok(fs.existsSync(asset), 'The optimized public commons GLB must be shipped with the app.');
assert.ok(fs.existsSync(blenderSource), 'The editable Blender source must remain available.');
assert.ok(fs.statSync(asset).size < 1024 * 1024, 'The first public commons asset must remain below 1 MB.');
assert.match(world, /const PUBLIC_COMMONS_ASSET_URL = 'assets\/models\/mall-public-commons-v1\.glb'/);
assert.match(world, /function loadPublicCommonsModel\(\)/);
assert.match(world, /function schedulePublicCommonsModel\(\)/);
assert.match(world, /window\.requestIdleCallback/);
assert.match(world, /window\.setTimeout\(loadWhenIdle, 1200\)/);
assert.match(world, /isLowEndMobile/);
assert.match(world, /registerCircularCollider\(x, z, 2\.7, 0, 2\.4\)/);
assert.match(world, /schedulePublicCommonsModel\(\);/);

console.log('Blender public commons are deferred, lightweight, and physically registered after loading.');
