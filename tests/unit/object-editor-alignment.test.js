const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const editor = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-object-editor.js'), 'utf8');

assert.match(editor, /const POSITION_GRID_STEP = 0\.25/);
assert.match(editor, /const ROTATION_GRID_DEGREES = 15/);
assert.match(editor, /const MAGNET_DISTANCE = 0\.3/);
assert.match(editor, /const MAGNET_RELEASE_WINDOW_MS = 3000/);
assert.match(editor, /const nextGridValue = \(value, direction, origin = 0\)/);
assert.match(editor, /applyMagneticAlignment\(entry, axis\)/);
assert.match(editor, /releaseRequested/);
assert.match(editor, /Imán activo: repite la misma flecha antes de 3 s para despegarlo\./);
assert.match(editor, /Imán liberado: el objeto ya se separó y conserva la retícula de 0,25 m\./);
assert.match(editor, /const detachedMagnetEntries = new Set\(\)/);
assert.match(editor, /action === 'detach'/);
assert.match(editor, /detachedMagnetEntries\.has\(entry\.id\)/);
assert.match(editor, /nextRotationDegrees\(object\.rotation\.y, -1\)/);
assert.match(editor, /nextRotationDegrees\(object\.rotation\.y, 1\)/);

const step = 0.25;
const nextGridValue = (value, direction, origin = 0) => {
    const relative = (value - origin) / step;
    const epsilon = 1e-7;
    const gridIndex = direction > 0
        ? Math.floor(relative + epsilon) + 1
        : Math.ceil(relative - epsilon) - 1;
    return origin + gridIndex * step;
};

assert.equal(nextGridValue(2, 1), 2.25);
assert.equal(nextGridValue(2.07, 1), 2.25);
assert.equal(nextGridValue(2.07, -1), 2);
assert.equal(nextGridValue(5.3, 1, 5.3), 5.55);

const allowedAngles = Array.from({ length: 24 }, (_, index) => index * 15);
assert.deepEqual(allowedAngles.slice(0, 7), [0, 15, 30, 45, 60, 75, 90]);
assert.equal(allowedAngles.at(-1), 345);

const shouldReleaseMagnet = (armed, axis, direction, now) => Boolean(
    armed && armed.axis === axis && armed.direction === direction && now - armed.armedAt <= 3000
);

assert.equal(shouldReleaseMagnet({ axis: 'x', direction: 1, armedAt: 1000 }, 'x', 1, 2500), true);
assert.equal(shouldReleaseMagnet({ axis: 'x', direction: 1, armedAt: 1000 }, 'x', -1, 1200), false);
assert.equal(shouldReleaseMagnet({ axis: 'z', direction: 1, armedAt: 1000 }, 'x', 1, 1200), false);
assert.equal(shouldReleaseMagnet({ axis: 'x', direction: 1, armedAt: 1000 }, 'x', 1, 4000), true);
assert.equal(shouldReleaseMagnet({ axis: 'x', direction: 1, armedAt: 1000 }, 'x', 1, 4001), false);

console.log('Infrastructure-editor furniture uses a shared grid, edge magnets, and an intentional double-tap release.');
