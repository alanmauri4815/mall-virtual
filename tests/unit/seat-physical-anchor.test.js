const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const ui = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-ui.js'), 'utf8');
const npcs = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-npc.js'), 'utf8');
const data = fs.readFileSync(path.join(root, 'assets', 'avatars', 'animations', 'sitting.glb'));

const jsonLength = data.readUInt32LE(12);
const gltf = JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8'));
const binaryOffset = 20 + jsonLength + 8;
const componentBytes = { 5126: 4 };
const componentCount = { SCALAR: 1, VEC3: 3 };

function readFloatAccessor(index) {
    const accessor = gltf.accessors[index];
    assert.strictEqual(accessor.componentType, 5126, 'The physical animation test expects float data.');
    const view = gltf.bufferViews[accessor.bufferView];
    const count = componentCount[accessor.type];
    const stride = view.byteStride || count * componentBytes[accessor.componentType];
    const start = binaryOffset + view.byteOffset + (accessor.byteOffset || 0);
    return Array.from({ length: accessor.count }, (_, row) => Array.from(
        { length: count },
        (_, column) => data.readFloatLE(start + row * stride + column * 4)
    ));
}

const sit = gltf.animations.find((animation) => animation.name === 'Sit') || gltf.animations[0];
const hipsChannel = sit.channels.find((channel) => {
    const nodeName = String(gltf.nodes[channel.target.node]?.name || '').toLowerCase();
    return channel.target.path === 'translation' && nodeName.includes('hips');
});
assert.ok(hipsChannel, 'The sitting clip must expose its hips translation.');

const hips = readFloatAccessor(sit.samplers[hipsChannel.sampler].output);
const horizontalDrift = hips.reduce((max, value) => Math.max(
    max,
    Math.hypot(value[0] - hips[0][0], value[2] - hips[0][2])
), 0);

// The real Mixamo sitting clip changes the rig horizontally by millimetres,
// never by the metres reported in the scene. Those metres must therefore be
// prevented at the world-anchor/camera layer.
assert.ok(horizontalDrift < 0.02,
    `The sitting clip moved ${horizontalDrift.toFixed(3)} m horizontally; expected less than 2 cm.`);
assert.match(ui, /window\.keepMallSeatedCameraAnchored = function\(\)/,
    'The seated camera must be pinned to the selected bench anchor.');
assert.match(ui, /camera\.position\.x = seatPosition\.x;\s*camera\.position\.z = seatPosition\.z;/,
    'The camera must not retain an OrbitControls horizontal offset while seated.');
assert.match(npcs, /controls\.update\(\);\s*window\.keepMallSeatedCameraAnchored\?\.\(\);/,
    'The camera anchor must be restored after OrbitControls on every frame.');

console.log(`seat-physical-anchor.test.js: ok (Sit horizontal drift ${(horizontalDrift * 100).toFixed(1)} cm)`);
