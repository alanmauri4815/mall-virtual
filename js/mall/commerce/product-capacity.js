(function registerProductCapacity(globalScope, factory) {
    const api = Object.freeze(factory());

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (globalScope) {
        globalScope.mallProductCapacity = api;
    }
})(typeof window !== 'undefined' ? window : globalThis, function createProductCapacity() {
    const PRODUCT_DESCRIPTION_MAX_LENGTH = 500;
    const STORE_PRODUCT_LIMIT_DEFAULT = 10;
    const STORE_PRODUCT_LIMIT_MAX = 50;
    const PRODUCT_LIMIT_BY_TIER = Object.freeze({
        T0: 10,
        T1: 10,
        T2: 12,
        T3: 15,
        T4: 20,
        T5: 50
    });

    const PRODUCT_TIER_BY_CODE = new Map();
    const assignTier = (tier, codes) => codes.forEach((code) => PRODUCT_TIER_BY_CODE.set(code, tier));

    assignTier('T4', ['EN10', 'NO10', 'OS10', 'SE10']);
    ['N', 'S', 'E', 'O'].forEach((wing) => {
        assignTier('T3', [101, 102, 107, 108].map((number) => `${wing}${number}`));
        assignTier('T1', [103, 104].map((number) => `${wing}${number}`));
        assignTier('T2', [105, 106].map((number) => `${wing}${number}`));

        assignTier('T2', [201, 202, 209, 210].map((number) => `${wing}${number}`));
        assignTier('T1', [203, 204, 207, 208].map((number) => `${wing}${number}`));
        assignTier('T0', [205, 206].map((number) => `${wing}${number}`));
    });

    function normalizeProductTier(value = '') {
        const tier = String(value || '').trim().toUpperCase();
        return Object.hasOwn(PRODUCT_LIMIT_BY_TIER, tier) ? tier : '';
    }

    function normalizeStoreCode(value = '') {
        return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    function getStoreCodeCandidates(store) {
        if (typeof store === 'string') return [store];
        return [store?.local_code, store?.id, store?.shopCode, store?.shop_code, store?.code]
            .map((value) => String(value || '').trim())
            .filter(Boolean);
    }

    function clampStoreProductLimit(value, fallback = STORE_PRODUCT_LIMIT_DEFAULT) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
        return Math.max(1, Math.min(STORE_PRODUCT_LIMIT_MAX, Math.round(parsed)));
    }

    function getFallbackProductTierForStore(store) {
        const directTier = normalizeProductTier(store?.product_tier || store?.tier || store?.category_tier);
        if (directTier) return directTier;

        for (const code of getStoreCodeCandidates(store)) {
            const tier = PRODUCT_TIER_BY_CODE.get(normalizeStoreCode(code));
            if (tier) return tier;
        }
        return 'T0';
    }

    function getFallbackProductLimitForStore(store) {
        const explicit = store?.product_limit || store?.max_products || store?.included_products;
        if (explicit !== undefined && explicit !== null && explicit !== '') {
            return clampStoreProductLimit(explicit);
        }
        return PRODUCT_LIMIT_BY_TIER[getFallbackProductTierForStore(store)] || STORE_PRODUCT_LIMIT_DEFAULT;
    }

    return {
        PRODUCT_DESCRIPTION_MAX_LENGTH,
        STORE_PRODUCT_LIMIT_DEFAULT,
        STORE_PRODUCT_LIMIT_MAX,
        PRODUCT_LIMIT_BY_TIER,
        normalizeProductTier,
        normalizeStoreCode,
        clampStoreProductLimit,
        getFallbackProductTierForStore,
        getFallbackProductLimitForStore
    };
});
