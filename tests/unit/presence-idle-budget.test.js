const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../../js/mall/mall-ui.js'), 'utf8');
const heartbeat = Number(source.match(/const HEARTBEAT_LIMIT = (\d+)/)[1]);
assert.ok(heartbeat >= 30000, 'Idle position heartbeat must be at most twice per minute');
// Execute the actual scheduler callback against a stationary camera.
const start = source.indexOf('setInterval(() => {', source.indexOf('function initPresence()'));
const end = source.indexOf('}, 100);', start);
const block = source.slice(start, end + '}, 100);'.length);
let callback;
let sent = 0;
let time = 100000;
const position = { x: 0, z: 0, distanceTo: () => 0, copy() {} };
const context = {
    setInterval(fn) { callback = fn; }, presenceChannel: {}, presenceReady: true,
    THREE: { Vector3: function () {} }, camera: { position, getWorldDirection(d) { d.x = 0; d.z = 1; } },
    lastSentPos: position, lastSentRot: 0, lastMovementSamplePos: position,
    lastMovementSampleAt: time, lastUpdateTime: time, currentEscalatorState: null,
    MOVEMENT_SPEED_THRESHOLD: 0.1, POS_THRESHOLD: 0.2, ROT_THRESHOLD: 0.1,
    myIsMoving: false, myMoveSpeed: 0, HEARTBEAT_LIMIT: heartbeat,
    Date: { now: () => time }, performance: { now: () => time },
    broadcastMyPosition() { sent++; }
};
vm.runInNewContext(block, context);
assert.equal(typeof callback, 'function');
for (let i = 0; i < 600; i++) { time += 100; callback(); }
assert.ok(sent <= 2, `Idle broadcasts per minute: ${sent}`);
context.camera.position = { ...position, distanceTo: () => 1 };
callback();
assert.ok(sent >= 2, 'Movement still sends immediately');
console.log('presence-idle-budget.test.js: ok');
