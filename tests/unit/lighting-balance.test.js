const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const world = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-world.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(world, /ambientLight\.intensity = 0\.40;[\s\S]*?hemisphereLight\.intensity = 0\.60;[\s\S]*?sun\.intensity = 0\.90;/);
assert.match(world, /ambientLight\.intensity = 0\.46;[\s\S]*?hemisphereLight\.intensity = 0\.78;[\s\S]*?sun\.intensity = 1\.66;/);
assert.match(html, /mall-world\.js\?v=20261012-mall-color-vibrance-v1/);

console.log('Day/night light balance is active with a fresh mall-world asset version.');
