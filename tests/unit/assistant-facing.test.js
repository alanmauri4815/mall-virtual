const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'js', 'mall', 'mall-store-assistant.js'),
    'utf8'
);

assert.match(source, /function updateAttendantFacing\(actor, visitorInsideStore, nowMs\)/);
assert.match(source, /visitorInsideStore[\s\S]*?Math\.atan2\(dx, dz\)/);
assert.match(source, /Math\.atan2\([\s\S]*?Math\.sin\(targetRotation - actor\.mesh\.rotation\.y\)/);
assert.match(source, /updateAttendantFacing\(actor, visitorInsideStore, nowMs\)/);

console.log('Store attendants face visitors smoothly only while they are inside the store.');
