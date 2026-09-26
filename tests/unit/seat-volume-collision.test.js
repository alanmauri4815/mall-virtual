const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-physics.js'), 'utf8');
const context = {
    console,
    Math,
    Number,
    Object,
    parseInt,
    isWalking: false,
    camera: { position: { x: 0, y: 1.7, z: 0 } },
    PLAYER_EYE_HEIGHT: 1.7,
    otherPlayers: {},
    npcs: [],
    THREE: {}
};

vm.createContext(context);
vm.runInContext(`${source}\n;globalThis.__seatVolumeTestApi = { registerCollider, doesBodyOverlapCollider, checkCollision };`, context);

const { registerCollider, doesBodyOverlapCollider, checkCollision } = context.__seatVolumeTestApi;
const bench = registerCollider(2, 3, 2, 1, 0, 0.78);

assert.equal(
    doesBodyOverlapCollider(2, 3, 0.06, 2.34, bench, 0.12),
    true,
    'The seated avatar body must still collide with the real seat volume.'
);
assert.equal(
    doesBodyOverlapCollider(2, 3, 0.9, 2.34, bench, 0.18),
    false,
    'An object entirely above the seat height must remain clear.'
);

const ownedBench = registerCollider(6, 3, 2, 1, 0, 0.78, 'bench:test');
assert.equal(
    checkCollision(6, 1.2, 3, { bodyMinY: 0.06, bodyMaxY: 2.41, includeActors: false }),
    true,
    'A walking NPC body must collide with a low bench.'
);
assert.equal(
    checkCollision(6, 1.2, 3, {
        bodyMinY: 0.06,
        bodyMaxY: 2.41,
        includeActors: false,
        ignoredColliderOwnerIds: [ownedBench.ownerId]
    }),
    false,
    'The NPC assigned to a seat may cross only that bench collider while approaching it.'
);

// Reproduce the post-stand safety loop. Before the regression fix, its first
// frame saw the bench and restored lastSafePosition several metres away.
let simulatedPosition = { x: 6, z: 3 };
let simulatedLastSafe = { x: -4, z: -3 };
let maximumFrameStep = 0;
for (let frame = 0; frame < 36; frame += 1) {
    const previous = { ...simulatedPosition };
    simulatedPosition.z += 0.05;
    const departing = frame < 30;
    const blocked = checkCollision(simulatedPosition.x, 1.2, simulatedPosition.z, {
        bodyMinY: 0.06,
        bodyMaxY: 2.41,
        includeActors: false,
        ignoredColliderOwnerIds: departing ? [ownedBench.ownerId] : []
    });
    if (blocked) simulatedPosition = { ...simulatedLastSafe };
    else simulatedLastSafe = { ...simulatedPosition };
    maximumFrameStep = Math.max(
        maximumFrameStep,
        Math.hypot(simulatedPosition.x - previous.x, simulatedPosition.z - previous.z)
    );
}
assert.ok(maximumFrameStep <= 0.051,
    `Standing up must not restore the pre-seat position (max frame step: ${maximumFrameStep}).`);
assert.ok(simulatedPosition.z > 4.5,
    'The avatar must clear the bench before its temporary collider exemption expires.');

console.log('seat-volume-collision.test.js: ok');
