const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../../js/mall/mall-ui.js'), 'utf8');
const heartbeat = Number(source.match(/const HEARTBEAT_LIMIT = (\d+)/)[1]);
assert.ok(heartbeat >= 30000, 'Idle position heartbeat must be at most twice per minute');
assert.match(source, /x: camera\.position\.x,[\s\S]*?y: camera\.position\.y,[\s\S]*?z: camera\.position\.z,[\s\S]*?r: Math\.atan2\(direction\.x, direction\.z\)/,
    'Presence must retain an initial position and rotation for late joiners');
assert.match(source, /const hasInitialPose = \[presence\.x, presence\.y, presence\.z, presence\.r\][\s\S]*?actor\.hasReceivedPose = true/,
    'Presence sync must hydrate a remote avatar before the first broadcast arrives');
assert.doesNotMatch(source, /void trackMySelf\(\{ force: false \}\)/,
    'Movement broadcasts must not retrack Presence and create a join-update loop');
assert.match(source, /const presence = \(presences \|\| \[\]\)\.reduce[\s\S]*?candidateAt >= latestAt/,
    'Presence sync must select the newest metadata entry when stale entries coexist');
assert.match(source, /function acceptRemotePose\(actor, pose\)[\s\S]*?poseRevision < lastRevision[\s\S]*?actor\.lastPoseUpdatedAt = poseUpdatedAt \|\| Date\.now\(\)/,
    'Presence sync must accept a newer pose revision and reject a late stale pose');
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
    window: { mallMotionSeated: false }, lastSampleYaw: null,
    sampledMotion: 'idle', lastSentMotion: 'idle',
    Date: { now: () => time }, performance: { now: () => time },
    broadcastMyPosition() { sent++; context.lastSentMotion = context.sampledMotion; }
};
vm.runInNewContext(block, context);
assert.equal(typeof callback, 'function');
for (let i = 0; i < 600; i++) { time += 100; callback(); }
assert.ok(sent <= 2, `Idle broadcasts per minute: ${sent}`);
context.camera.position = { ...position, distanceTo: () => 1 };
callback();
assert.ok(sent >= 2, 'Movement still sends immediately');
console.log('presence-idle-budget.test.js: ok');
