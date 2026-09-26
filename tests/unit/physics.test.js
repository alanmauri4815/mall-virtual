const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const sourcePath = path.join(root, 'js', 'mall', 'mall-physics.js');
const source = fs.readFileSync(sourcePath, 'utf8');

function loadPhysics(overrides = {}) {
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
        THREE: {},
        ...overrides
    };
    vm.createContext(context);
    vm.runInContext(`${source}\n;globalThis.__physicsTestApi = {\n        colliders,\n        registerCollider,\n        registerCircularCollider,\n        isPointInsideCollider,\n        getDynamicCollisionActors,\n        checkCollision\n    };`, context, { filename: sourcePath });
    return context.__physicsTestApi;
}

{
    const physics = loadPhysics();
    physics.registerCollider(10, 20, 4, 6, 0, 3);
    const collider = physics.colliders[0];

    assert.equal(physics.isPointInsideCollider(10, 1, 20, collider), true);
    assert.equal(physics.isPointInsideCollider(13, 1, 20, collider), false);
    assert.equal(physics.isPointInsideCollider(10, 4, 20, collider), false);
    assert.equal(
        physics.isPointInsideCollider(12.2, 1, 20, collider, 0.4),
        true,
        'El radio del jugador debe ampliar la huella de colision.'
    );
}

{
    const physics = loadPhysics();
    physics.registerCircularCollider(-3, 4, 2, 0, 3);
    const collider = physics.colliders[0];

    assert.equal(physics.isPointInsideCollider(-3, 1, 4, collider), true);
    assert.equal(physics.isPointInsideCollider(0, 1, 4, collider), false);
    assert.equal(physics.isPointInsideCollider(-0.8, 1, 4, collider, 0.4), true);
}

{
    const physics = loadPhysics({
        otherPlayers: {
            remoteA: {
                hasReceivedPose: true,
                mesh: {
                    position: { x: 5, y: 0, z: 5 },
                    userData: { collisionRadius: 0.5, collisionHeight: 2 }
                }
            }
        }
    });

    assert.equal(physics.checkCollision(5.6, 1, 5), true);
    assert.equal(physics.checkCollision(7, 1, 5), false);
    assert.equal(physics.checkCollision(5.1, 3, 5), false);
    assert.equal(
        physics.checkCollision(5.1, 1, 5, { ignoreActorId: 'remote:remoteA' }),
        false,
        'Un actor no debe colisionar consigo mismo.'
    );
}

{
    const physics = loadPhysics({
        camera: { position: { x: 0.8, y: 1.7, z: 0 } }
    });
    physics.registerCollider(0, 0, 2, 2, 0, 3, 'planter');

    const escapeOptions = {
        ignoreActorId: '__local__',
        bodyMinY: 0.06,
        bodyMaxY: 2.34,
        allowStaticCollisionEscape: true
    };
    assert.equal(physics.checkCollision(0.9, 1.7, 0, escapeOptions), false,
        'A visitor already inside a planter may move out when penetration decreases.');
    assert.equal(physics.checkCollision(0.7, 1.7, 0, escapeOptions), true,
        'Collision recovery must still block a step deeper into the planter.');
    assert.equal(physics.checkCollision(0.9, 1.7, 0), true,
        'Ordinary callers must keep the existing collision behavior.');
}

{
    const physics = loadPhysics({
        camera: { position: { x: 0.8, y: 1.7, z: 0 } }
    });
    physics.registerCollider(0, 0, 2, 2, 0, 3, 'planter');
    physics.registerCollider(2.2, 0, 1, 1, 0, 3, 'nearby-kiosk');

    assert.equal(physics.checkCollision(1.5, 1.7, 0, {
        ignoreActorId: '__local__',
        bodyMinY: 0.06,
        bodyMaxY: 2.34,
        allowStaticCollisionEscape: true
    }), true, 'Recovery must not let the visitor escape into a different obstacle.');
}

{
    const physics = loadPhysics();
    physics.registerCollider(0, 0, 4, 2, 0.1, 0.7, 'bench');
    const bench = physics.colliders[0];

    assert.equal(physics.isPointInsideCollider(0, 1, 0, bench, 0.4, 0.11, 2.2), true,
        'A body must collide with the bench across its full vertical span.');
    assert.equal(physics.isPointInsideCollider(0, 1, 0, bench, 0.4, 0.71, 2.2), false,
        'A body above the bench volume must not be blocked by its height.');
    assert.equal(physics.isPointInsideCollider(2.3, 1, 1.3, bench, 0.4), false,
        'The rounded corner must not expand beyond the actor circle.');
}

{
    const physics = loadPhysics();
    const shelf = {
        shape: 'oriented-box', x: 0, z: 0,
        halfW: 2, halfD: 0.5, rotation: Math.PI / 4,
        minY: 0, maxY: 2, enabled: true
    };
    physics.colliders.push(shelf);

    assert.equal(physics.isPointInsideCollider(1.6, 1, 1.6, shelf), false,
        'A rotated collider must not block the empty corners of its axis-aligned bounds.');
    assert.equal(physics.isPointInsideCollider(0.353553, 1, -0.353553, shelf), true,
        'A point in the rotated shelf volume must remain blocked.');
}

console.log('physics.test.js: OK');
