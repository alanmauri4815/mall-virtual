(function (root, factory) {
    const search = factory();
    if (typeof module === 'object' && module.exports) module.exports = search;
    if (root) root.mallAssistantCatalogSearch = search;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const STOP_WORDS = new Set([
        'a', 'al', 'algun', 'alguna', 'algo', 'amigo', 'amiga', 'amigos', 'amigas', 'ayuda',
        'busca', 'buscar', 'busco', 'como', 'con', 'de', 'del', 'donde', 'el', 'ella', 'en',
        'es', 'esta', 'este', 'la', 'las', 'lo', 'los', 'me', 'mi', 'mis', 'necesito', 'no',
        'para', 'por', 'que', 'quiero', 'quisiera', 'recomienda', 'recomiendas', 'regalo',
        'regalar', 'regalarle', 'regalos', 'sea', 'sobre', 'tenga', 'tienen', 'un', 'una',
        'unos', 'unas', 'hasta', 'menos', 'maximo', 'maxima', 'pase', 'pasar', 'pesos', 'clp',
        'producto', 'productos', 'catalogo', 'local', 'locales', 'tienda', 'tiendas', 'venden',
        'vende', 'ofrecen', 'ofrece', 'precio', 'precios', 'comprar', 'encontrar', 'opcion',
        'opciones', 'que', 'del', 'este', 'esta', 'necesite'
    ]);
    const JEWELRY_TERMS = [
        'joya', 'joyas', 'joyeria', 'joyerias', 'collar', 'collares', 'cadena', 'cadenas',
        'aro', 'aros', 'arete', 'aretes', 'pendiente', 'pendientes', 'anillo', 'anillos',
        'argolla', 'argollas', 'pulsera', 'pulseras', 'sortija', 'sortijas', 'accesorios',
        'bisuteria', 'bijouterie'
    ];
    const CATALOG_INTENT = /\b(producto|productos|catalogo|venden|vende|ofrecen|ofrece|tienen|tiene|precio|precios|comprar|busco|buscar|encontrar|recomiendas|recomendar|regalo|regalos|regalar|regalarle|joya|joyas|joyeria|joyerias|collar|collares|cadena|cadenas|aro|aros|arete|aretes|pendiente|pendientes|anillo|anillos|argolla|argollas|pulsera|pulseras|sortija|sortijas|bisuteria|bijouterie)\b/;
    const DIRECTORY_ONLY = /\b(local|locales|tienda|tiendas|comercio|comercios|directorio)\b/;
    const PRODUCT_INTENT = /\b(producto|productos|catalogo|venden|vende|ofrecen|ofrece|tienen|tiene|precio|precios|comprar|busco|buscar|encontrar|recomiendas|recomendar|regalo|regalos|regalar|regalarle)\b/;

    function normalize(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function codeKey(value) {
        return String(value || '').trim().toUpperCase().replace(/-/g, '').replace(/\s+/g, '');
    }

    function parsePrice(value) {
        const amounts = String(value || '').match(/\d[\d.,\s]*/g) || [];
        const parsed = amounts
            .map((amount) => Number(amount.replace(/\D/g, '')))
            .filter((amount) => Number.isFinite(amount) && amount > 0);
        return parsed.length ? Math.max(...parsed) : null;
    }

    function budgetFromQuestion(question) {
        const normalized = String(question || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        const amounts = normalized.match(/\b\d{1,3}(?:[.,\s]\d{3})+\b|\b\d+\b/g) || [];
        const parsed = amounts.map((amount) => Number(amount.replace(/\D/g, ''))).filter((amount) => amount > 0);
        const hasBudgetCue = /\b(hasta|menos|no pase|no mas de|no supere|no exceda|maximo|maxima|tope|presupuesto)\b/.test(normalized);
        const giftWithPrice = /\b(regalo|regalos|regalar|regalarle)\b/.test(normalized) && parsed.length > 0;
        if (!hasBudgetCue && !giftWithPrice) return null;
        return parsed.length ? Math.max(...parsed) : null;
    }

    function queryTerms(question) {
        const normalized = normalize(question);
        const terms = new Set(normalized.split(' ').filter((term) => term.length > 2 && !STOP_WORDS.has(term) && !/^\d+$/.test(term)));
        if (JEWELRY_TERMS.some((term) => terms.has(term))) JEWELRY_TERMS.forEach((term) => terms.add(term));
        return [...terms];
    }

    function overlap(terms, value) {
        const text = new Set(normalize(value).split(' ').filter(Boolean));
        return terms.reduce((count, term) => count + (text.has(term) ? 1 : 0), 0);
    }

    function formatBudget(value) {
        return `$${new Intl.NumberFormat('es-CL').format(value)}`;
    }

    return function searchMallCatalog(question, stores = [], products = []) {
        const normalized = normalize(question);
        if (!CATALOG_INTENT.test(normalized)) return null;
        if (DIRECTORY_ONLY.test(normalized) && !PRODUCT_INTENT.test(normalized)) return null;

        const storeByKey = new Map();
        stores.forEach((store) => {
            [store?.id, store?.local_code, store?.shop_code, store?.code].forEach((key) => {
                const normalizedKey = codeKey(key);
                if (normalizedKey) storeByKey.set(normalizedKey, store);
            });
        });

        const linkedProducts = products.map((product) => {
            const store = storeByKey.get(codeKey(product?.local_code))
                || storeByKey.get(codeKey(product?.store_id));
            if (!store || !String(product?.name || '').trim()) return null;
            return { product, store, price: parsePrice(product.price) };
        }).filter(Boolean);
        const budget = budgetFromQuestion(question);
        const terms = queryTerms(question);
        let candidates = linkedProducts;
        if (budget !== null) candidates = candidates.filter((item) => item.price !== null && item.price <= budget);

        const productHits = candidates.map((item) => ({
            ...item,
            score: overlap(terms, item.product.name) * 6 + overlap(terms, item.product.description) * 2
        })).filter((item) => budget !== null || terms.length === 0 || item.score > 0)
            .sort((a, b) => {
                if (budget !== null && a.price !== b.price) return b.price - a.price;
                return b.score - a.score || (a.product.sort_order || 0) - (b.product.sort_order || 0);
            });

        const storeHits = stores.map((store) => ({
            store,
            score: overlap(terms, `${store?.name || ''} ${store?.category || ''} ${store?.local_code || ''}`)
        })).filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score || String(a.store.name || '').localeCompare(String(b.store.name || ''), 'es'));

        const recommendations = productHits.slice(0, 4).map(({ product, store }) => {
            const price = product.price ? ` (${product.price})` : '';
            const code = store.local_code ? `, local ${store.local_code}` : '';
            return `${product.name}${price}, en ${store.name || 'un local del mall'}${code}`;
        });
        if (budget !== null) {
            if (!recommendations.length) {
                return `No encontré productos con precio publicado que pueda confirmar bajo ${formatBudget(budget)}. Puedes ampliar el presupuesto o revisar otros catálogos.`;
            }
            return `¡Claro! Encontré estas opciones dentro de tu presupuesto de ${formatBudget(budget)}: ${recommendations.join('; ')}. Puedes abrir el catálogo de cada local para ver más detalles.`;
        }
        if (recommendations.length) {
            return `¡Claro! Encontré estas opciones en los catálogos: ${recommendations.join('; ')}. Puedes abrir cada local para revisar más detalles.`;
        }
        if (storeHits.length) {
            const matchingStores = [...new Map(storeHits.slice(0, 5).map(({ store }) => [store.id || store.local_code || store.name, store])).values()]
                .map((store) => `${store.name || store.local_code}${store.category ? ` (${store.category})` : ''}${store.local_code ? `, local ${store.local_code}` : ''}`);
            return `Por el rubro, puedes revisar: ${matchingStores.join('; ')}. No encontré un producto específico coincidente en sus catálogos publicados.`;
        }
        if (!linkedProducts.length) return 'No hay productos cargados en los catálogos públicos para consultar ahora.';
        return 'No encontré coincidencias en los catálogos publicados. Prueba con otro producto o rubro y lo busco.';
    };
});
