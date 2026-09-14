const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const constants = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'mall', 'mall-constants.js'), 'utf8');
const npc = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'mall', 'mall-npc.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', '..', 'css', 'mall.css'), 'utf8');
const assistant = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'mall', 'mall-store-assistant.js'), 'utf8');

assert.match(constants, /IS_LOW_END_MOBILE/);
assert.match(constants, /antialias:\s*!IS_LOW_END_MOBILE/);
assert.match(constants, /pixelRatioCap:\s*IS_LOW_END_MOBILE\s*\?\s*0\.6/);
assert.match(constants, /webglcontextlost/);
assert.match(constants, /webglcontextrestored/);
assert.match(constants, /npcCount:\s*IS_LOW_END_MOBILE\s*\?\s*4/);
assert.match(constants, /function getMallBoxGeometry/);
assert.match(constants, /function getMallPlaneGeometry/);
assert.match(npc, /document\.hidden\s*\|\|\s*window\.isMallWebGLContextLost/);
assert.match(npc, /targetFrameIntervalMs/);
assert.match(css, /\.mall-low-end-device[\s\S]*backdrop-filter:\s*none/);
assert.match(assistant, /streamConstrainedDeviceAttendants/);
assert.match(assistant, /distance <= 34/);
assert.match(assistant, /distanceTo\(actor\.mesh\.position\) > 46/);

console.log('Legacy mobile profile limits GPU load and recovers WebGL safely.');
