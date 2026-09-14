const assert = require('node:assert/strict');

const {
    PRODUCT_DESCRIPTION_MAX_LENGTH,
    PRODUCT_LIMIT_BY_TIER,
    clampStoreProductLimit,
    getFallbackProductTierForStore,
    getFallbackProductLimitForStore
} = require('../../js/mall/commerce/product-capacity.js');

assert.equal(PRODUCT_DESCRIPTION_MAX_LENGTH, 500);
assert.deepEqual(PRODUCT_LIMIT_BY_TIER, {
    T0: 10,
    T1: 10,
    T2: 12,
    T3: 15,
    T4: 20,
    T5: 50
});

assert.equal(getFallbackProductTierForStore({ local_code: 'OS-10' }), 'T4');
assert.equal(getFallbackProductTierForStore({ id: 'E108' }), 'T3');
assert.equal(getFallbackProductTierForStore({ local_code: 'O-205' }), 'T0');
assert.equal(getFallbackProductTierForStore({ local_code: 'unknown', product_tier: 't5' }), 'T5');
assert.equal(getFallbackProductTierForStore({ local_code: 'unknown' }), 'T0');

assert.equal(getFallbackProductLimitForStore({ local_code: 'N-105' }), 12);
assert.equal(getFallbackProductLimitForStore({ local_code: 'N-107' }), 15);
assert.equal(getFallbackProductLimitForStore({ local_code: 'EN-10' }), 20);
assert.equal(getFallbackProductLimitForStore({ product_tier: 'T5' }), 50);
assert.equal(getFallbackProductLimitForStore({ product_limit: 17 }), 17);
assert.equal(clampStoreProductLimit(500), 50);
assert.equal(clampStoreProductLimit(-2, 12), 12);

console.log('Product capacity follows the T0-T5 commercial plan and clamps explicit limits safely.');
