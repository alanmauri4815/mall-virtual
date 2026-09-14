const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const world = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'mall', 'mall-world.js'), 'utf8');
const boutiqueSetup = world.slice(world.indexOf('const ensureDetailedInterior = () => {', world.indexOf('function createBoutique')));
const assignmentIndex = boutiqueSetup.indexOf('sh.userData.ensureDetailedInterior = ensureDetailedInterior;');
const slidingDoorsIndex = boutiqueSetup.indexOf('const leftDoorFixed');
const eagerSection = boutiqueSetup.slice(assignmentIndex, slidingDoorsIndex);

assert.ok(assignmentIndex >= 0 && slidingDoorsIndex > assignmentIndex);
assert.doesNotMatch(eagerSection, /\n\s*ensureDetailedInterior\(\);/);
assert.match(world, /disposeDetailedInterior/);
assert.match(world, /disposeFacadeStoreVisuals/);
assert.match(world, /clearStoreVisualGroup\(showcase\)/);
assert.match(world, /mallPerformanceProfile\?\.isLowEndMobile/);

console.log('Boutique interiors are lazy-loaded and released on constrained devices.');
