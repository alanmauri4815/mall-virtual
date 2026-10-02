const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const constants = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'mall', 'mall-constants.js'), 'utf8');
const world = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'mall', 'mall-world.js'), 'utf8');
const npc = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'mall', 'mall-npc.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', '..', 'css', 'mall.css'), 'utf8');
const assistant = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'mall', 'mall-store-assistant.js'), 'utf8');

assert.match(constants, /IS_LOW_END_MOBILE/);
assert.match(constants, /antialias:\s*!IS_LOW_END_MOBILE/);
assert.match(constants, /pixelRatioCap:\s*IS_LOW_END_MOBILE\s*\?\s*0\.82\s*:\s*\(IS_COARSE_POINTER\s*\?\s*1\.15/);
assert.match(constants, /textureScale:\s*IS_LOW_END_MOBILE\s*\?\s*0\.65/);
assert.match(constants, /textureAnisotropyCap:\s*IS_LOW_END_MOBILE\s*\?\s*2\s*:\s*\(IS_COARSE_POINTER\s*\?\s*4/);
assert.match(constants, /renderer\.outputEncoding\s*=\s*THREE\.sRGBEncoding/);
assert.match(constants, /window\.configureMallColorTexture\s*=\s*\(texture\)/);
assert.match(constants, /texture\.encoding\s*=\s*THREE\.sRGBEncoding/);
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
assert.match(world, /wallColorPalette = \[0xead9c1, 0xdce7dc, 0xe9d6cc, 0xd5e2ea\]/);
assert.match(world, /kind === 'wall' && !material\.map && material\.color/);
assert.match(world, /material\.color\.lerp\(tone, 0\.72\)/);

console.log('Mobile clarity/color, wall palette, and low-end GPU safeguards are configured.');
