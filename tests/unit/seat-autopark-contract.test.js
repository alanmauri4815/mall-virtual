const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const ui = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-ui.js'), 'utf8');
const world = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-world.js'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-navigation.js'), 'utf8');
const npcs = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-npc.js'), 'utf8');
const mobile = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-mobile-controls.js'), 'utf8');
const context = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-context.js'), 'utf8');

assert.match(context, /benchSeatingEnabled:\s*false/,
    'Bench seating must stay temporarily disabled through the shared feature flag.');

assert.match(ui, /function findMallBenchSeat\(origin, maxDistance = Infinity, options = \{\}\)/,
    'Visitors and NPCs must resolve the same nearest bench anchor.');
assert.match(ui, /\.find\(\(bench\) => !options\.requireAvailable \|\| bench\.seats\.length > 0\);/,
    'Seat discovery must choose the closest bench, or the closest bench with an available seat when requested.');
assert.match(world, /benchCenterNode: gr/,
    'Linear benches must expose their physical center for proximity checks.');
assert.match(world, /footAnchor\.position\.set\(seatX, 0, side \* 0\.42\)/,
    'The linear bench foot anchor must keep the seated avatar close to the cushion.');
assert.match(world, /Panel lateral de privacidad/,
    'The information desk must conceal its staff bench from side views.');
assert.match(world, /benchType: 'circular'/,
    'Circular bench anchors must be scored from their physical seat segment.');
assert.match(ui, /if \(options\.benchType && data\.benchType !== options\.benchType\) return;/,
    'Seat discovery must support filtering destinations by bench type.');
assert.match(ui, /owner: 'visitor',\s*benchType: 'linear'/,
    'Visitors must only auto-park at calibrated linear benches.');
assert.match(ui, /if \(!window\.mallMotionSeated && window\.mallFeatureFlags\?\.benchSeatingEnabled !== true\) return;/,
    'A visitor cannot begin sitting while the temporary pause is active, but an already-seated visitor can still stand.');
assert.match(ui, /function reserveMallBenchSeat\(seat, owner, durationMs = 30000\)/,
    'A bench seat must be reserved before automatic parking begins.');
assert.match(ui, /MALL_SEATED_EYE_HEIGHT/,
    'The seated camera needs its own eye height.');
assert.match(ui, /avatarY: seatedAnchor\?\.y \?\? \(window\.mallMotionSeated/,
    'Remote clients must receive the seated avatar floor height separately from camera height.');
assert.match(ui, /function getSeatedAvatarAnchor\(\)/,
    'A seated player must expose the selected foot anchor as a first-class network coordinate.');
assert.match(ui, /seatX: seatedAnchor\?\.x \?\? null,\s*seatY: seatedAnchor\?\.y \?\? null,\s*seatZ: seatedAnchor\?\.z \?\? null/,
    'Presence and broadcast payloads must carry the seated anchor rather than inferring it from camera coordinates.');
assert.match(ui, /const remoteGroundY = hasSeatAnchor\s*\? pData\.seatY\s*: Number\.isFinite\(pData\.avatarY\)/,
    'Realtime position broadcasts must preserve the seated avatar floor height.');
assert.match(ui, /const hasSeatAnchor = p\.motionMode === 'sit'/,
    'Remote seated avatars must recognize an explicit seated anchor.');
assert.match(ui, /p\.targetPos\.copy\(p\.seatedWorldAnchor\)/,
    'Remote seated avatars must use the selected bench anchor as their world position.');
assert.match(ui, /window\.mallLastSeatSelection = \{/,
    'Seat selection must retain the chosen anchor coordinates for diagnostics.');
const seatToggleStart = ui.indexOf('window.toggleMallSeatedPosture = function() {');
const seatToggleEnd = ui.indexOf('postureButton.addEventListener', seatToggleStart);
assert.ok(seatToggleStart >= 0 && seatToggleEnd > seatToggleStart,
    'The visitor sitting control must remain identifiable for its movement contract.');
const seatToggle = ui.slice(seatToggleStart, seatToggleEnd);
assert.match(seatToggle, /const seatedPosition = seat\.position\.clone\(\);[\s\S]*?transitionSeatCamera\(seatedPosition, seat\.yaw, sitApproachDurationMs/,
    'Visitor autoparking must move directly toward the selected seat instead of backing away to a fixed clearance point.');
assert.doesNotMatch(seatToggle, /standingPosition/,
    'Sitting must not insert an outward standing position before approaching the seat.');
assert.match(ui, /if \(p\.motionMode === 'sit'\) \{\s*p\.remoteMoving = false;/,
    'Receiving a seated pose must stop residual walk interpolation.');
assert.match(ui, /guardRemoteSeatDisplacement\(p, 'broadcast-snap'/,
    'Diagnostic mode must detect a teleport already present in a received visitor position.');
assert.match(ui, /guardRemoteSeatDisplacement\(p, 'render-frame'/,
    'Diagnostic mode must detect a teleport introduced while rendering a visitor position.');
assert.match(ui, /function acceptRemotePose\(actor, pose\)/,
    'Remote pose updates must have one authoritative ordering rule across broadcast and presence.');
assert.match(ui, /function applyRemoteSeatStandAnchor\(actor, previousMotion, previousSeatAnchor, nextMotion, hasSeatAnchor\)/,
    'A remote avatar must retain its bench position after the stand animation.');
assert.match(ui, /window\.mallCanRecoverLocalCollision = \(\) =>\s*\['guest', 'member', 'registered_visitor', 'tenant'\]\.includes\(currentUserRole\)/,
    'Collision recovery must be limited to local visitor and tenant roles.');
assert.match(navigation, /allowStaticCollisionEscape: window\.mallCanRecoverLocalCollision\?\.\(\) === true/,
    'Only eligible local roles may use static-collider escape while moving.');
assert.match(ui, /actor\.targetPos\.x = actor\.remoteStandAnchor\.x;[\s\S]*?actor\.targetPos\.z = actor\.remoteStandAnchor\.z;/,
    'Idle and turning pose packets must not pull a standing avatar forward from its bench anchor.');
assert.match(ui, /if \(nextMotion === 'walk' \|\| nextMotion === 'backward'\) \{\s*actor\.remoteStandAnchor = null;/,
    'The bench hold must release only when the remote player intentionally starts walking.');
assert.match(ui, /poseRevision: myPoseRevision/,
    'Both presence and broadcast payloads must identify their semantic pose revision.');
assert.match(ui, /advanceMyPoseRevision\(\);[\s\S]*?void trackMySelf\(\);[\s\S]*?broadcastMyPosition\(\);/,
    'Sitting and standing must publish a newer presence pose before broadcasting it.');
assert.match(ui, /if \(hasCandidateRevision && !hasLatestRevision\) return candidate;/,
    'Presence reconciliation must prefer a versioned newer pose over a legacy snapshot.');
assert.match(ui, /if \(p\.motionMode === 'sit'\) \{\s*p\.remoteMoving = false;\s*if \(p\.remoteSeatApproach\) \{[\s\S]*?p\.mesh\.position\.lerpVectors\(approach\.from, approach\.to, progress\);[\s\S]*?p\.mesh\.position\.copy\(p\.seatedWorldAnchor \|\| p\.targetPos\);/,
    'A seated remote avatar must blend smoothly into its synchronized anchor and stay anchored.');
assert.match(ui, /const correctRemoteVisualRoot = actor\.isRemotePlayer\s*&& shouldKeepFeetPlanted\s*&& !!anchors\s*&& !!feet;/,
    'Remote avatars may compensate their visual root only while seated-foot anchors are active.');
assert.match(ui, /const visitorSeatedPose = visitorSeatBlend\s*&&\s*\(nextMotion === 'sit' \|\| sittingDown\);[\s\S]*?if \(enteringSeat && !actor\.seatFootAnchors && !visitorSeatedPose\)/,
    'A visitor must not carry standing foot anchors into the seated pose and shift its body into the bench.');
assert.match(ui, /Brecha asiento: \$\{lastSnapshot\.seatGapCm[\s\S]*?raíz visual XZ: \$\{lastSnapshot\.visualRootGapCm/,
    'The live diagnostic must report both the gap to the seat and visual-root offset.');
assert.match(ui, /if \(!actor\.isRemotePlayer \|\| correctRemoteVisualRoot\) \{[\s\S]*?actor\.seatVisualOffset\.set\(/,
    'The assistant keeps its existing root correction, while a remote visitor gets the same correction only during the anchored seat transition.');
assert.match(ui, /transitionSeatCamera\(seatedPosition, seat\.yaw, sitApproachDurationMs/,
    'Automatic parking must interpolate directly to the selected seat anchor.');
assert.match(navigation, /window\.mallMotionSeated \|\| window\.mallSeatAutoparking/,
    'Manual navigation must pause during seated or automatic parking states.');
assert.match(navigation, /window\.mallFeatureFlags\?\.benchSeatingEnabled === true \|\| window\.mallMotionSeated/,
    'The C shortcut stays disabled until seating is re-enabled, while still allowing a seated visitor to stand.');
assert.match(npcs, /function updateNPCSeatState\(/,
    'NPCs need a dedicated seated state machine.');
assert.match(npcs, /NPC_SEAT_DECISION_CHANCE/,
    'NPC seating must remain probabilistic.');
assert.match(npcs, /window\.reserveMallBenchSeat\?\.\(seat, `npc:\$\{npcIndex\}`/,
    'NPCs must reserve a seat before approaching it.');
assert.match(npcs, /npc\.state = 'standing-up';[\s\S]*?npc\.seatStandAnchor = npc\.mesh\.position\.clone\(\);/,
    'NPCs must remain anchored while the stand-up animation is running.');
assert.match(npcs, /motionNowMs < npc\.standUntil/,
    'NPC navigation must wait for the stand-up clip to finish.');
assert.match(npcs, /const NPC_POST_STAND_STABILIZE_MS = 1200;/,
    'NPCs need a visible stationary settle after standing up.');
assert.match(npcs, /npc\.state = 'post-stand';[\s\S]*?npc\.postStandUntil = now \+ NPC_POST_STAND_STABILIZE_MS;/,
    'The navigation target must not be assigned in the same frame that standing finishes.');
assert.doesNotMatch(npcs, /window\.commitGameReadySeatRootOffset\?\.\(npc\)/,
    'A stand-up animation must never transfer its visual root offset into NPC navigation coordinates.');
assert.match(npcs, /window\.runMallSeatStandGpsSimulation = function\(\)/,
    'A deterministic NPC must be available for frame-by-frame shoe GPS diagnostics.');
assert.match(ui, /function sampleGameReadyShoeGps\(actor, motion, nowMs\)/,
    'Both animated feet must expose frame-by-frame world-position telemetry.');
assert.match(npcs, /bodyMinY: meshY,[\s\S]*?bodyMaxY: meshY \+ DYNAMIC_ACTOR_COLLISION_HEIGHT/,
    'NPC collision checks must include the full body height against low benches.');
assert.match(npcs, /const occupiesStaticObstacle = checkCollision\([\s\S]*?ignoredColliderOwnerIds: now < \(npc\.departingSeatColliderUntil \|\| 0\)/,
    'The final safety pass must not roll a departing NPC back to its pre-seat position.');
assert.match(ui, /gps\.maxFrameStep\[key\] = Math\.max/,
    'Shoe GPS diagnostics must detect a one-frame teleport after the stand clip ends.');
assert.match(mobile, /mobile-sit-btn/,
    'Mobile users need a visible sitting control.');
assert.match(mobile, /sitButton\.disabled = parking \|\| \(!seatingEnabled && !seated\)/,
    'Mobile sitting is disabled during the pause, with stand-up still available for an already-seated visitor.');
assert.match(npcs, /window\.mallFeatureFlags\?\.benchSeatingEnabled === true\s*&&\s*updateNPCSeatState/,
    'NPCs must not begin autonomous seat movement while bench seating is paused.');

console.log('seat-autopark-contract.test.js: ok');
