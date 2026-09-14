const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require('playwright');
const sharp = require('sharp');

(async () => {
    let browser;
    try {
    browser = await chromium.launch({
        headless: true,
        executablePath: process.env.PLAYWRIGHT_CHROME_PATH || undefined
    });
    const context = await browser.newContext({ ...devices['iPhone 8'] });
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 2 });
        Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 4 });
    });
    const page = await context.newPage();
    await page.setViewportSize({ width: 667, height: 375 });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.mallPerformanceProfile && document.querySelector('#canvas-container canvas'), null, { timeout: 20000 });
    await page.evaluate(() => {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('mobile-orientation-helper').style.display = 'none';
        document.getElementById('mobile-controls-container').style.display = 'flex';
    });
    await page.locator('#mobile-settings-btn').click();
    assert.equal(await page.locator('#mobile-control-settings').isVisible(), true);
    await page.locator('#mobile-control-settings-close').click();
    assert.equal(await page.locator('#mobile-control-settings').isVisible(), false);
    await page.waitForTimeout(Number(process.env.MOBILE_STRESS_MS || 5000));

    const diagnostics = await page.evaluate(() => {
        const canvas = document.querySelector('#canvas-container canvas');
        const geometries = new Set();
        const geometryTypes = {};
        const materials = new Set();
        let objects = 0;
        let meshes = 0;
        scene.traverse((object) => {
            objects += 1;
            if (object.isMesh) meshes += 1;
            if (object.geometry) {
                geometries.add(object.geometry.uuid);
                geometryTypes[object.geometry.type] = (geometryTypes[object.geometry.type] || 0) + 1;
            }
            const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
            objectMaterials.filter(Boolean).forEach(material => materials.add(material.uuid));
        });
        return {
            profile: window.mallPerformanceProfile,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            clientWidth: canvas.clientWidth,
            clientHeight: canvas.clientHeight,
            contextLost: window.isMallWebGLContextLost?.() || false,
            objects,
            meshes,
            geometries: geometries.size,
            geometryTypes,
            materials: materials.size,
            builtBoutiqueInteriors: allStoreGroups.filter(shop => shop?.userData?.isBoutique && shop.userData.detailedInteriorBuilt).length,
            rendererMemory: { ...renderer.info.memory },
            rendererTriangles: renderer.info.render.triangles
        };
    });
    assert.equal(await page.evaluate(() => typeof window.mallRuntimeMonitor?.getLastCheckpoint === 'function'), true);
    assert.equal(diagnostics.profile.isLowEndMobile, true);
    assert.equal(diagnostics.profile.npcCount, 4);
    assert.equal(diagnostics.profile.pixelRatioCap, 0.6);
    assert.ok(diagnostics.builtBoutiqueInteriors <= 1, 'Boutique interiors must be streamed instead of prebuilt.');
    assert.equal(diagnostics.contextLost, false);
    assert.ok(diagnostics.canvasWidth > 0 && diagnostics.canvasHeight > 0);

    const artifactsDirectory = path.join(__dirname, '..', 'artifacts');
    fs.mkdirSync(artifactsDirectory, { recursive: true });
    const screenshotPath = path.join(artifactsDirectory, 'legacy-mobile-page.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    const canvasScreenshotPath = path.join(artifactsDirectory, 'legacy-mobile-canvas.png');
    await page.locator('#canvas-container canvas').screenshot({ path: canvasScreenshotPath });
    const stats = await sharp(canvasScreenshotPath).stats();
    const channelSpread = stats.channels.slice(0, 3).reduce((sum, channel) => sum + channel.stdev, 0);
    assert.ok(channelSpread > 8, 'The rendered page must not be blank or monochrome.');
    assert.equal(pageErrors.length, 0, `Browser errors: ${pageErrors.join(' | ')}`);

    console.log(JSON.stringify({ ...diagnostics, channelSpread: Math.round(channelSpread * 10) / 10 }));
    } finally {
        await browser?.close();
    }
})().catch(error => {
    console.error(error);
    process.exit(1);
});
