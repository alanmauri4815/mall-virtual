const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../../js/mall/mall-world.js'), 'utf8');
assert.match(source, /const getStorefrontProductImageUrl = \(product = \{\}\) =>/);
assert.ok(source.includes(String.raw`source.replace(/-catalog-(\d+)\.(webp|jpg|jpeg|png)`),
    'Catalog URLs must map to the existing display variant when available.');
const shelf = source.slice(source.indexOf('const createShelfUnit'), source.indexOf('sh.userData.ensureDynamicStoreVisuals'));
assert.match(shelf, /textureLoader\.load\(getStorefrontProductImageUrl\(p\)/,
    'Interior shelves must use display-sized images.');
console.log('storage-display-variant.test.js: ok');
