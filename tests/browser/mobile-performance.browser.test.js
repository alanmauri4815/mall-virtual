const assert = require('node:assert/strict');
const { chromium, devices } = require('playwright');

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
    await page.waitForFunction(() => window.mallPerformanceProfile && document.querySelector('#canvas-container canvas'), null, { timeout: 60000 });
    await page.evaluate(() => {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('mobile-controls-container').style.display = 'flex';
        window.mallMobileViewport.activate();
    });
    assert.equal(await page.locator('#mobile-orientation-helper').count(), 0,
        'Visitors must not be blocked by an orientation confirmation screen.');
    await page.locator('#mobile-settings-btn').evaluate(button => button.click());
    assert.equal(await page.locator('#mobile-control-settings').isVisible(), true);
    await page.locator('#mobile-control-settings-close').evaluate(button => button.click());
    assert.equal(await page.locator('#mobile-control-settings').isVisible(), false);

    const originalNavigationCount = await page.evaluate(() => performance.getEntriesByType('navigation').length);
    const captureViewportState = () => page.evaluate(() => {
        const canvas = document.querySelector('#canvas-container canvas');
        const rect = canvas.getBoundingClientRect();
        const renderCamera = window.getMallRenderCamera();
        return {
            portrait: document.body.classList.contains('mobile-portrait'),
            landscape: document.body.classList.contains('mobile-landscape'),
            width: rect.width,
            height: rect.height,
            aspect: camera.aspect,
            thirdPersonAspect: thirdPersonCamera.aspect,
            isThirdPerson: window.isMallThirdPersonView(),
            cameraPosition: renderCamera.position.toArray(),
            url: location.href
        };
    });
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForFunction(() => document.body.classList.contains('mobile-portrait') && document.querySelector('#canvas-container canvas')?.clientHeight >= 660);
    const portraitState = await captureViewportState();
    assert.equal(portraitState.portrait, true);
    assert.equal(await page.locator('#mobile-orientation-helper').count(), 0);
    assert.ok(Math.abs(portraitState.width / portraitState.height - 375 / 667) < 0.02);
    assert.ok(Math.abs(portraitState.aspect - 375 / 667) < 0.02);
    assert.ok(Math.abs(portraitState.thirdPersonAspect - 375 / 667) < 0.02);

    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => document.body.classList.contains('mobile-landscape') && document.querySelector('#canvas-container canvas')?.clientWidth >= 840);
    const landscapeState = await captureViewportState();
    assert.equal(landscapeState.landscape, true);
    assert.equal(await page.locator('#mobile-orientation-helper').count(), 0);
    assert.ok(Math.abs(landscapeState.width / landscapeState.height - 844 / 390) < 0.02);
    assert.ok(Math.abs(landscapeState.aspect - 844 / 390) < 0.02);
    assert.ok(Math.abs(landscapeState.thirdPersonAspect - 844 / 390) < 0.02);
    assert.equal(landscapeState.isThirdPerson, portraitState.isThirdPerson);
    assert.deepEqual(landscapeState.cameraPosition, portraitState.cameraPosition);
    assert.equal(landscapeState.url, portraitState.url);
    assert.equal(await page.evaluate(() => performance.getEntriesByType('navigation').length), originalNavigationCount);

    const controlBounds = await page.evaluate(() => {
        const rect = element => {
            const { x, y, right, bottom, width, height } = element.getBoundingClientRect();
            return { x, y, right, bottom, width, height };
        };
        return {
            viewport: { width: innerWidth, height: innerHeight },
            move: rect(document.getElementById('mobile-move-panel')),
            look: rect(document.getElementById('mobile-look-panel')),
            actions: rect(document.getElementById('mobile-quick-actions'))
        };
    });
    for (const [name, bounds] of Object.entries({ move: controlBounds.move, look: controlBounds.look, actions: controlBounds.actions })) {
        assert.ok(bounds.x >= 0 && bounds.y >= 0, `${name} controls must remain within the viewport`);
        assert.ok(bounds.right <= controlBounds.viewport.width && bounds.bottom <= controlBounds.viewport.height, `${name} controls must remain within the viewport`);
    }
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
    assert.equal(diagnostics.profile.pixelRatioCap, 1);
    assert.ok(diagnostics.builtBoutiqueInteriors <= 1, 'Boutique interiors must be streamed instead of prebuilt.');
    assert.equal(diagnostics.contextLost, false);
    assert.ok(diagnostics.canvasWidth > 0 && diagnostics.canvasHeight > 0);

    const channelSpread = await page.evaluate(() => {
        const size = 96;
        const target = new THREE.WebGLRenderTarget(size, size);
        const pixels = new Uint8Array(size * size * 4);
        try {
            renderer.setRenderTarget(target);
            renderer.render(scene, window.getMallRenderCamera?.() || camera);
            renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
        } finally {
            renderer.setRenderTarget(null);
            target.dispose();
        }
        return [0, 1, 2].reduce((total, channel) => {
            const values = pixels.filter((_, index) => index % 4 === channel);
            const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
            const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
            return total + Math.sqrt(variance);
        }, 0);
    });
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
