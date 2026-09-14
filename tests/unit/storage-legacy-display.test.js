const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const world = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-world.js'), 'utf8');
const legacyPattern = String.raw`return source.replace(/(\/product-\d+-\d+)\.(webp|jpg|jpeg|png)(\?|$)/i, '$1-display.webp$3');`;

assert.ok(world.includes(legacyPattern), 'Legacy product URLs must resolve to the prepared display copy.');
assert.match(
    world,
    /loadProductTexture\(image, getStorefrontProductImageUrl\(product\), 1, product\.image_url\)/,
    'Legacy display copies must retain the original image as a loading fallback.'
);

console.log('storage-legacy-display.test.js: ok');
