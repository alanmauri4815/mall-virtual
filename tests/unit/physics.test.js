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

console.log('physics.test.js: OK');
