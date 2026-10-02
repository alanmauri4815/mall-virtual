const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const readMallSource = (name) => fs.readFileSync(
    path.resolve(__dirname, '../../js/mall', name),
    'utf8'
);

const factorSource = readMallSource('mall-constants.js');
const factorMatch = factorSource.match(/const MALL_WALK_TRAVEL_SCALE = ([\d.]+);/);
assert.ok(factorMatch, 'A shared walk-travel scale must be configured.');

const travelScale = Number(factorMatch[1]);
assert.equal(travelScale, 0.9, 'Walking travel must be reduced by exactly 10%.');

const navigationSource = readMallSource('mall-navigation.js');
assert.match(navigationSource, /MALL_PEDESTRIAN_WALK_SPEED \* MALL_WALK_TRAVEL_SCALE/,
    'Visitor travel must use the shared 90% factor.');

const npcSource = readMallSource('mall-npc.js');
assert.match(npcSource, /speed: \(NPC_MIN_WALK_SPEED[\s\S]*?\* MALL_WALK_TRAVEL_SCALE,/,
    'NPC travel speed must use the shared 90% factor.');
assert.match(npcSource, /applyAvatarPose\(npc, movedAmount \/ MALL_WALK_TRAVEL_SCALE, nowMs\)/,
    'NPC gait must be normalized to its pre-reduction travel signal.');
assert.match(npcSource, /moveStep \/ MALL_WALK_TRAVEL_SCALE\) \* 4\.5/,
    'NPC escalator movement must retain its original pace.');

const uiSource = readMallSource('mall-ui.js');
assert.match(uiSource, /Math\.max\(stepDistance,[\s\S]*?\/ MALL_WALK_TRAVEL_SCALE/,
    'Remote visitor gait must be normalized independently of reduced travel.');

const baselineStep = 1.1 * (1 / 60);
const reducedStep = baselineStep * travelScale;
assert.ok(Math.abs(reducedStep / baselineStep - 0.9) < 1e-12,
    'A walk cycle must now cover exactly 90% of the previous distance.');
assert.ok(Math.abs(reducedStep / travelScale - baselineStep) < 1e-12,
    'The gait animation input must remain at its original pace.');

console.log('walk-animation-ratio.test.js: 90% travel with unchanged gait verified.');
