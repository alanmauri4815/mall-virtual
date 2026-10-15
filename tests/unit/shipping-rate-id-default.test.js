const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const purchases = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-purchases.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(purchases, /function createShippingRateId\(\)/);
assert.match(purchases, /tenantShippingRates\.push\(\{ id: createShippingRateId\(\)/);
assert.match(purchases, /const preparedRates = rates\.map\(\(rate\) => \(\{[\s\S]*?id: rate\.id \|\| createShippingRateId\(\)/);
assert.match(purchases, /const payload = preparedRates\.map\(\(rate\) => scopePayload\(\{\s*id: rate\.id/);
assert.match(html, /mall-purchases\.js\?v=20261014-shipping-rate-id-guard-v1/);

console.log('Shipping-rate upserts always send a non-null UUID and use a fresh asset URL.');
