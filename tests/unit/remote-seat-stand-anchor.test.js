const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ui = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'mall', 'mall-ui.js'), 'utf8');
const start = ui.indexOf('function applyRemoteSeatStandAnchor(');
assert.notEqual(start, -1, 'Remote stand-anchor helper must exist.');
const end = ui.indexOf('\n        function ', start + 1);
const helperSource = ui.slice(start, end).trim();
const applyRemoteSeatStandAnchor = vm.runInNewContext(`(${helperSource})`, {
    MALL_BENCH_STAND_CLEARANCE: 0.55
});

const actor = {
    isRemotePlayer: true,
    role: 'guest',
    targetRot: 0,
    mesh: { position: { x: 4.2, y: 0.115, z: 8.7 }, rotation: { y: 0 } },
    targetPos: { x: 4.9, y: 0.115, z: 9.1 },
    remoteMoving: true,
    remoteSpeed: 0.6,
    remoteStandAnchor: null
};
const seatAnchor = { x: 4.2, y: 0.115, z: 8.7 };

assert.equal(applyRemoteSeatStandAnchor(actor, 'sit', seatAnchor, 'idle', false), true);
assert.deepEqual({ ...actor.targetPos }, seatAnchor, 'Standing must remain at the bench after the sit pose ends.');
assert.equal(actor.remoteMoving, false, 'A stale movement flag must not play a walking cycle while standing at the bench.');
assert.equal(actor.remoteSpeed, 0, 'A stale network speed must not restart the walking pose.');

actor.targetPos.x = 5.3;
actor.targetPos.z = 9.4;
assert.equal(applyRemoteSeatStandAnchor(actor, 'idle', null, 'turnLeft', false), true);
assert.deepEqual({ ...actor.targetPos }, seatAnchor, 'Turning in place must not move the avatar away from the bench.');

actor.targetPos.x = 5.1;
actor.targetPos.z = 9.2;
assert.equal(applyRemoteSeatStandAnchor(actor, 'idle', null, 'walk', false), false);
assert.equal(actor.remoteStandAnchor, null, 'Intentional walking must release the bench anchor.');
assert.deepEqual({ ...actor.targetPos }, { x: 5.1, y: 0.115, z: 9.2 }, 'Walking must use the new network target.');

assert.equal(applyRemoteSeatStandAnchor(actor, 'idle', null, 'sit', true), false);
assert.equal(actor.remoteStandAnchor, null, 'A new seated anchor must replace the standing hold.');

const runawayActor = {
    isRemotePlayer: true,
    role: 'guest',
    targetRot: 0,
    mesh: { position: { x: 4.2, y: 0.115, z: 8.7 }, rotation: { y: 0 } },
    targetPos: {
        x: 4.2,
        y: 0.115,
        z: 15.2,
        set(x, y, z) { this.x = x; this.y = y; this.z = z; }
    },
    remoteMoving: false,
    remoteSpeed: 0,
    remoteStandAnchor: null
};
assert.equal(applyRemoteSeatStandAnchor(runawayActor, 'sit', seatAnchor, 'idle', false), true);
assert.equal(runawayActor.remoteStandRejectedDestination.horizontalGapM, 6.5,
    'A distant idle destination after standing must be recorded for diagnosis.');
assert.deepEqual({ ...runawayActor.remoteStandDestination }, { x: 4.2, y: 0.115, z: 9.25 },
    'A distant idle destination must be replaced with the safe bench exit position.');
runawayActor.remoteStandAnchor = null; // Simulate the end of the stand clip.
runawayActor.targetPos.x = 4.2;
runawayActor.targetPos.z = 15.2;
assert.equal(applyRemoteSeatStandAnchor(runawayActor, 'idle', null, 'idle', false), true,
    'The safe position must remain held after the stand animation completes.');
assert.deepEqual({ x: runawayActor.targetPos.x, y: runawayActor.targetPos.y, z: runawayActor.targetPos.z }, { x: 4.2, y: 0.115, z: 9.25 },
    'A later idle packet must not move the visitor away from the bench.');
runawayActor.targetPos.x = 5.2;
runawayActor.targetPos.z = 10.2;
assert.equal(applyRemoteSeatStandAnchor(runawayActor, 'idle', null, 'walk', false), false,
    'Explicit walking must release the safe bench hold.');
assert.equal(runawayActor.remoteSeatStandHold, null);
assert.deepEqual({ x: runawayActor.targetPos.x, y: runawayActor.targetPos.y, z: runawayActor.targetPos.z }, { x: 5.2, y: 0.115, z: 10.2 },
    'Intentional walking must use the received target after releasing the hold.');

console.log('remote-seat-stand-anchor.test.js: ok');
