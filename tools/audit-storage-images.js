const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../js/mall/mall-multiplayer.js'), 'utf8');
const supabaseUrl = source.match(/const SUPABASE_URL = '([^']+)'/)?.[1];
const publishableKey = source.match(/const SUPABASE_PUBLISHABLE_KEY = '([^']+)'/)?.[1];
const timeoutMs = 5000;
const concurrency = 6;

const withTimeout = async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
        const cacheProbe = await fetch(url, {
            headers: { Range: 'bytes=0-0' },
            signal: controller.signal
        });
        await cacheProbe.body?.cancel();
        return {
            ok: response.ok,
            bytes: Number(response.headers.get('content-length') || 0),
            type: response.headers.get('content-type') || 'unknown',
            cacheControl: cacheProbe.headers.get('cache-control') || response.headers.get('cache-control') || ''
        };
    } finally {
        clearTimeout(timer);
    }
};

const measureUrls = async (urls) => {
    const results = [];
    for (let index = 0; index < urls.length; index += concurrency) {
        results.push(...await Promise.all(urls.slice(index, index + concurrency).map(async (url) => {
            try { return await withTimeout(url); }
            catch (error) { return { ok: false, error: error.name === 'AbortError' ? 'timeout' : 'request-failed' }; }
        })));
    }
    return results;
};

(async () => {
    if (!supabaseUrl || !publishableKey) throw new Error('No se encontró la configuración pública de Supabase.');
    const response = await fetch(`${supabaseUrl}/rest/v1/store_products?select=image_url&image_url=not.is.null&limit=500`, {
        headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` }
    });
    if (!response.ok) throw new Error(`No se pudo consultar el catálogo público (${response.status}).`);
    const rows = await response.json();
    const urls = [...new Set(rows.map(row => String(row.image_url || '').trim()).filter(Boolean))];
    const catalogResults = await measureUrls(urls);
    const displayUrls = [...new Set(urls.map(url => url.replace(/-catalog-(\d+)\.(webp|jpg|jpeg|png)(\?|$)/i, '-display-$1.$2$3')).filter((url, index) => url !== urls[index]))];
    const displayResults = await measureUrls(displayUrls);
    const legacyUrls = urls.filter(url => !/-catalog-(\d+)\.(webp|jpg|jpeg|png)(\?|$)/i.test(url));
    const legacyResults = await measureUrls(legacyUrls);
    const successful = catalogResults.filter(result => result.ok);
    const displaySuccessful = displayResults.filter(result => result.ok);
    const cacheControls = [...new Set(successful.map(result => result.cacheControl).filter(Boolean))];
    const displayCacheControls = [...new Set(displaySuccessful.map(result => result.cacheControl).filter(Boolean))];
    const types = successful.reduce((counts, result) => {
        counts[result.type] = (counts[result.type] || 0) + 1;
        return counts;
    }, {});
    const report = {
        catalogRows: rows.length,
        uniqueImageUrls: urls.length,
        reachableImages: successful.length,
        failedImages: catalogResults.length - successful.length,
        failedTimeouts: catalogResults.filter(result => result.error === 'timeout').length,
        totalBytes: successful.reduce((sum, result) => sum + result.bytes, 0),
        averageBytes: successful.length ? Math.round(successful.reduce((sum, result) => sum + result.bytes, 0) / successful.length) : 0,
        largestBytes: Math.max(0, ...successful.map(result => result.bytes)),
        contentTypes: types,
        cacheControlValues: cacheControls,
        displayCacheControlValues: displayCacheControls,
        displayVariantUrls: displayUrls.length,
        displayVariantsReachable: displaySuccessful.length,
        displayVariantsFailed: displayResults.length - displaySuccessful.length,
        displayVariantsTotalBytes: displaySuccessful.reduce((sum, result) => sum + result.bytes, 0),
        displayVariantsAverageBytes: displaySuccessful.length ? Math.round(displaySuccessful.reduce((sum, result) => sum + result.bytes, 0) / displaySuccessful.length) : 0,
        displayVariantsLargestBytes: Math.max(0, ...displaySuccessful.map(result => result.bytes)),
        legacyCacheControlValues: [...new Set(legacyResults.filter(result => result.ok).map(result => result.cacheControl).filter(Boolean))],
        legacyImages: legacyResults.map((result, index) => ({
            path: new URL(legacyUrls[index]).pathname,
            ...result
        }))
    };
    const artifactPath = path.resolve(__dirname, '../tests/artifacts/storage-audit.json');
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
