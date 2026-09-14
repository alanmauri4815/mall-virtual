const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
    path.resolve(__dirname, '../../js/mall/mall-stores.js'),
    'utf8'
);
const start = source.indexOf('function getProductSlotIndex');
const endMarker = 'window.arrangeStoreProductsBySlot = arrangeStoreProductsBySlot;';
const end = source.indexOf(endMarker, start) + endMarker.length;

assert.ok(start >= 0 && end > start, 'Product slot helpers must remain available.');

const context = { window: {} };
vm.runInNewContext(source.slice(start, end), context);

const arranged = context.window.arrangeStoreProductsBySlot([
    { id: 30, image_url: 'slot-10.webp', slot_index: 10 },
    { id: 10, image_url: 'slot-1.webp', slot_index: 1 },
    { id: 20, image_url: 'slot-3.webp', sort_order: 2 }
], 10);

assert.equal(arranged.length, 10);
assert.equal(arranged[0].image_url, 'slot-1.webp');
assert.equal(arranged[1], null);
assert.equal(arranged[2].image_url, 'slot-3.webp');
assert.equal(arranged[9].image_url, 'slot-10.webp');
assert.equal(arranged.filter(Boolean).length, 3);

const outOfRange = context.window.arrangeStoreProductsBySlot([
    { id: 1, image_url: 'slot-11.webp', slot_index: 11 }
], 10);
assert.equal(outOfRange.filter(Boolean).length, 0);

const sparseProducts = context.window.arrangeStoreProductsBySlot([
    null,
    { id: 40, image_url: 'slot-4.webp', slot_index: 4 },
    null
], 12);
assert.equal(sparseProducts.length, 12);
assert.equal(sparseProducts[3].image_url, 'slot-4.webp');
assert.equal(sparseProducts.filter(Boolean).length, 1);

console.log('Product images retain their exact tenant-panel slots without arrival-order compaction.');
