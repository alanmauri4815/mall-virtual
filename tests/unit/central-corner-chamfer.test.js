const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const world = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-world.js'), 'utf8');
const physicsSource = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-physics.js'), 'utf8');

assert.match(world, /function createCentralCornerChamfer/);
assert.match(world, /function getCentralCornerBoutiqueFloorGeometry/);
assert.match(world, /function getCentralCornerBoutiqueCapGeometry/);
assert.match(world, /const cut = 3/);
assert.match(world, /Vidrio chaflán/);
assert.match(world, /new THREE\.ExtrudeGeometry/);
assert.match(world, /corner-chamfer:/);
assert.match(world, /gr\.add\(createCentralCornerChamfer\(sx, sz, y\)\)/);
assert.match(world, /cornerChamferSide/);
assert.match(world, /if \(facadeSide === cornerChamferSide\) return/);
assert.match(world, /if \(hasLeftChamferCut\) \{\s*cw\(9\.1, 0\.2, 0\.2, 1\.55/);
assert.match(world, /cw\(9\.1, 0\.2, 0\.2, 1\.55, shopH, 9\.05, frM\)/);
assert.match(world, /cw\(9\.1, 0\.2, 0\.2, -1\.55, shopH, 9\.05, frM\)/);
assert.match(world, /Hipotenusa chaflán/);
assert.match(world, /length \+ 0\.16, 0\.20, 0\.20, center\.x, y \+ 0\.10/);
assert.match(world, /function createCentralCornerFloorInfill/);
assert.match(world, /Relleno estructural piso chaflán/);
assert.match(world, /depth: 0\.6/);
assert.match(world, /infill\.position\.y = y/);
assert.match(world, /const CENTRAL_CORNER_FLOOR_SURFACE_OFFSET = -0\.1/);
assert.match(world, /const chamferFloorY = y === 0 \? 0\.1 : y \+ CENTRAL_CORNER_FLOOR_SURFACE_OFFSET/);
assert.match(world, /chamfer\.add\(createCentralCornerFloorInfill\(sx, sz, chamferFloorY\)\)/);
assert.match(world, /const centralCorridorFloorMat/);
assert.match(world, /const centralCorridorFloorGridMat/);
assert.match(world, /function createCentralCornerFloorGrid/);
assert.match(world, /infill\.add\(createCentralCornerFloorGrid/);
assert.match(world, /const marbleMat = centralCorridorFloorMat/);
assert.match(physicsSource, /function registerOrientedCollider/);

const context = {
    Math,
    Object,
    otherPlayers: {},
    npcs: [],
    isWalking: false,
    camera: { position: { x: 0, y: 1.7, z: 0 } },
    PLAYER_EYE_HEIGHT: 1.7,
    THREE: {}
};
vm.createContext(context);
vm.runInContext(`${physicsSource}\n;globalThis.__chamferPhysics = { registerOrientedCollider, isPointInsideCollider, colliders };`, context);
const physics = context.__chamferPhysics;
physics.registerOrientedCollider(0, 0, 6, 0.2, Math.PI / 4, 0, 4);
assert.equal(physics.isPointInsideCollider(1, 1, -1, physics.colliders[0]), true);
assert.equal(physics.isPointInsideCollider(1, 1, 1, physics.colliders[0]), false);

console.log('Central corner boutiques use a glazed chamfer with exact diagonal collision.');
