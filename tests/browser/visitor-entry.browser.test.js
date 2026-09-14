const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true,
        executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Users/javii/AppData/Local/Google/Chrome/Application/chrome.exe' });
    const output = path.resolve('tests/artifacts/visitor-entry');
    fs.mkdirSync(output, { recursive: true });
    const errors = [];
    const scripts = [];
    const failures = [];
    let state;
    try {
        const context = await browser.newContext({ ...devices['iPhone 8'], viewport: { width: 667, height: 375 } });
        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 2 });
            Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 4 });
        });
        const page = await context.newPage();
        page.on('pageerror', error => { errors.push(error.stack); console.log('PAGE_ERROR', error.stack); });
        page.on('crash', () => errors.push('Browser renderer crashed'));
        page.on('requestfailed', request => failures.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
        page.on('response', response => {
            if (response.request().resourceType() === 'script') scripts.push({ path: new URL(response.url()).pathname, status: response.status() });
        });
        await page.goto(process.env.MALL_TEST_URL || 'http://127.0.0.1:8080/', { waitUntil: 'domcontentloaded', timeout: 120000 });
        console.log('ENTRY_DOM', await page.evaluate(() => Array.from(document.querySelectorAll('button')).filter(b => b.offsetWidth).map(b => ({ id: b.id, text: b.textContent.trim() }))));
        assert.deepEqual(errors, [], 'Startup must not throw');
        // Headless mobile Chrome can hang while scrolling this button despite it
        // being visible. Native click dispatch still exercises the delegated
        // application handler registered by mall-boot.
        await page.evaluate(() => document.getElementById('guest-entry-button')?.click());
        await page.waitForFunction(() => typeof hasEnteredMall !== 'undefined' && hasEnteredMall, null, { timeout: 30000 });
        await page.waitForFunction(() => document.documentElement.dataset.mallPresenceReady === 'true', null, { timeout: 30000 });
        state = await page.evaluate(() => ({
            entered: hasEnteredMall, presenceReady: document.documentElement.dataset.mallPresenceReady,
            role: currentAccessRole, camera: camera.position.toArray(),
            canvasWidth: renderer.domElement.width, canvasHeight: renderer.domElement.height,
            contextLost: renderer.getContext().isContextLost()
        }));
        await page.screenshot({ path: path.join(output, 'entered.png'), timeout: 30000 });
        assert.equal(state.role, 'guest');
        assert.equal(state.contextLost, false);
        assert.ok(state.canvasWidth > 0 && state.canvasHeight > 0);
        assert.deepEqual(errors, [], 'Entry must not throw');
        console.log('ENTRY_OK', JSON.stringify(state));
    } finally {
        fs.writeFileSync(path.join(output, 'diagnostics.json'), JSON.stringify({ errors, scripts, failures, state }, null, 2));
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
