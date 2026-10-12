const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const world = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-world.js'), 'utf8');

assert.match(world, /const boostSurfaceSaturation = \(color\) => \{[\s\S]*?hsl\.s \+ 0\.08 \* \(1 - hsl\.s\)/);
assert.match(world, /if \(\(kind === 'wall' \|\| kind === 'floor'\) && !material\.map && material\.color\) \{\s*boostSurfaceSaturation\(material\.color\);/);
assert.match(world, /const excludedPattern = \/glass\|vidrio\|image\|imagen\|poster\|logo\|sign\|cartel\|avatar\|npc/);

console.log('Color vibrance is limited to flat wall and floor materials.');
