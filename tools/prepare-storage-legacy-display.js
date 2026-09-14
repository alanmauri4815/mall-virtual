const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const source = fs.readFileSync(path.resolve(__dirname, '../js/mall/mall-multiplayer.js'), 'utf8');
const supabaseUrl = source.match(/const SUPABASE_URL = '([^']+)'/)?.[1];
const publishableKey = source.match(/const SUPABASE_PUBLISHABLE_KEY = '([^']+)'/)?.[1];
const timeoutMs = 15000;
const maxSide = 1024;
const quality = 74;
const artifactRoot = path.resolve(__dirname, '../tests/artifacts/storage-legacy-display');
const manifestPath = path.resolve(artifactRoot, 'manifest.json');

const withTimeout = async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return Buffer.from(await response.arrayBuffer());
    } finally {
        clearTimeout(timer);
    }
};

const getStoragePath = (url) => {
    const parsed = new URL(url);
    const marker = '/storage/v1/object/public/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex < 0) throw new Error(`URL fuera del Storage publico: ${url}`);
    return decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
};

const getDisplayPath = (storagePath) => storagePath.replace(/\.[^.\/]+$/, '-display.webp');

(async () => {
    if (!supabaseUrl || !publishableKey) throw new Error('No se encontro la configuracion publica de Supabase.');

    const response = await fetch(`${supabaseUrl}/rest/v1/store_products?select=local_code,name,image_url&image_url=not.is.null&limit=500`, {
        headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` }
    });
    if (!response.ok) throw new Error(`No se pudo consultar el catalogo publico (${response.status}).`);

    const rows = await response.json();
    const uniqueRows = [...new Map(
        rows
            .map(row => [String(row.image_url || '').trim(), row])
            .filter(([url]) => url)
    ).values()];
    const legacyRows = uniqueRows.filter(row => !/-catalog-(\d+)\.(webp|jpg|jpeg|png)(\?|$)/i.test(row.image_url));
    fs.mkdirSync(artifactRoot, { recursive: true });

    const manifest = {
        generatedAt: new Date().toISOString(),
        mode: 'local-staging-only',
        uploaded: false,
        databaseUpdated: false,
        count: legacyRows.length,
        images: []
    };

    for (const row of legacyRows) {
        const originalUrl = String(row.image_url).trim();
        const originalStoragePath = getStoragePath(originalUrl);
        const displayStoragePath = getDisplayPath(originalStoragePath);
        const localPath = path.join(artifactRoot, ...displayStoragePath.split('/'));
        fs.mkdirSync(path.dirname(localPath), { recursive: true });

        const originalBuffer = await withTimeout(originalUrl);
        const result = await sharp(originalBuffer)
            .rotate()
            .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
            .webp({ quality })
            .toBuffer({ resolveWithObject: true });
        fs.writeFileSync(localPath, result.data);

        manifest.images.push({
            localCode: row.local_code || '',
            name: row.name || '',
            originalUrl,
            originalStoragePath,
            displayStoragePath,
            localPath: path.relative(path.resolve(__dirname, '..'), localPath).replaceAll('\\', '/'),
            originalBytes: originalBuffer.length,
            displayBytes: result.data.length,
            width: result.info.width,
            height: result.info.height,
            contentType: 'image/webp'
        });
    }

    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(manifest, null, 2));
})().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
