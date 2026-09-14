const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');
const boot = read('js/mall/mall-boot.js');
const stores = read('js/mall/mall-stores.js');
const ui = read('js/mall/mall-ui.js');
const world = read('js/mall/mall-world.js');
const editor = read('js/mall/mall-object-editor.js');
const mallStores = read('js/mall/mall-stores.js');

assert.match(boot, /window\.mallCatalogRequests = \(\(\) => \{/);
assert.match(boot, /if \(current\) return current;/, 'Concurrent callers must share an in-flight request.');
assert.match(boot, /clear\(\);\s*throw error;/, 'A failed request must not poison future catalog loads.');
assert.match(boot, /async getData\(\) \{[\s\S]*Promise\.all\(\[getStores\(\), getProducts\(\)\]\)/);
assert.match(boot, /scopeQuery\(client\.from\('stores'\)\.select\('\*'\)\)/, 'Store catalog requests must be scoped to the active mall.');
assert.match(boot, /scopeQuery\(client\.from\('store_products'\)/, 'Product catalog requests must be scoped to the active mall.');
assert.match(stores, /await window\.mallCatalogRequests\.getProducts\(\)/);
assert.match(stores, /invalidate\(\{ products: true \}\)/, 'Product writes must invalidate the shared snapshot.');
assert.match(ui, /await window\.mallCatalogRequests\.getStores\(\)/);
assert.match(world, /await window\.mallCatalogRequests\.getData\(\)/);
assert.doesNotMatch(world, /from\('store_products'\)\s*\.select\('\*'\)/, 'Central displays must reuse the shared product request.');
assert.match(editor, /scopePayload\(\{[\s\S]*mall_id|scopePayload\(\{[\s\S]*object_id: entry\.id/, 'Editable object writes must carry the active mall.');
assert.match(mallStores, /mall_id: window\.mallContext\?\.id/, 'New products must carry the active mall.');
console.log('catalog-request-deduplication.test.js: ok');
