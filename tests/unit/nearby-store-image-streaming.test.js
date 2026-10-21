const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const world = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'mall', 'mall-world.js'), 'utf8');

assert.match(world, /STORE_NEAR_IMAGE_EXPANSION_DISTANCE\s*=\s*2\s*;/);
assert.match(world, /STORE_NEAR_IMAGE_EXPANSION_RELEASE_DISTANCE\s*=\s*2\.4\s*;/);
assert.match(world, /window\.mallPerformanceProfile\?\.isLowEndMobile\s*&&\s*isWalking/);
assert.match(world, /distanceByStoreCode\.get\(storeCode\)/);
assert.match(world, /distance < nearestStoreDistance/);
assert.match(world, /storeCode === nextExpandedStoreCode/);
assert.match(world, /if \(shop\.userData\.nearbyProductImagesExpanded === shouldExpand\) return/);
assert.match(world, /imageLimit = isLowEndMobile && !isNearbyExpanded\s*\?\s*4\s*:/);
assert.match(world, /\?\s*2\s*:\s*4\s*;/);
assert.match(world, /sh\.userData\.facadeVisualExpandedImageState === expandedImageState/);
assert.match(world, /ensureFacadeStoreVisuals\?\.\(\)/);

console.log('Low-end mobile visitors load expanded product imagery only for their nearest store within 2 m.');
