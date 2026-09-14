const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
    const browser = await chromium.launch({ headless: true,
        executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Users/javii/AppData/Local/Google/Chrome/Application/chrome.exe' });
    try {
        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(120000);
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Network.enable');
        const requests = new Map();
        const phases = [];
        let phase;
        const errors = [];
        const failedRequests = [];
        page.on('pageerror', error => errors.push(error.stack || error.message));
        page.on('requestfailed', request => failedRequests.push({
            path: new URL(request.url()).pathname, error: request.failure()?.errorText
        }));
        cdp.on('Network.responseReceived', ({ requestId, response }) => {
            const url = new URL(response.url);
            if (!url.hostname.endsWith('.supabase.co')) return;
            const row = { resource: `${url.pathname}${url.search}`, type: response.type, status: response.status, bytes: 0,
                cache: Boolean(response.fromDiskCache || response.fromServiceWorker),
                cacheControl: response.headers['cache-control'] || response.headers['Cache-Control'] || '' };
            phase.requests.push(row);
            requests.set(requestId, row);
        });
        cdp.on('Network.loadingFinished', ({ requestId, encodedDataLength }) => {
            if (requests.has(requestId)) requests.get(requestId).bytes = encodedDataLength;
        });
        cdp.on('Network.webSocketFrameSent', ({ response }) => {
            if (response.payloadData.includes('pos_update')) phase.positionMessages++;
        });
        const begin = name => {
            phase = { name, requests: [], positionMessages: 0 };
            phases.push(phase);
        };
        let presenceReady = false;
        try {
        begin('cold-entry');
        await page.goto(process.env.MALL_AUDIT_URL || 'http://127.0.0.1:8080/', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(15000);
        console.log('ENTRY_BUTTONS', JSON.stringify(await page.locator('button:visible').allTextContents()));
        // This is a traffic audit, not the interaction test. The mobile browser
        // test exercises the physical tap; here we invoke the same DOM handler.
        await page.evaluate(() => document.getElementById('guest-entry-button')?.click());
        await page.waitForFunction(() => typeof hasEnteredMall !== 'undefined' && hasEnteredMall, null, { timeout: 30000 });
        await page.waitForTimeout(10000);
        begin('idle-30s');
        await page.waitForTimeout(30000);
        presenceReady = await page.evaluate(() => document.documentElement.dataset.mallPresenceReady === 'true');
        begin('reload');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(15000);
        } catch (error) {
            errors.push(error.stack || error.message);
        }
        const report = { date: new Date().toISOString(), validVisit: errors.length === 0 && presenceReady,
            presenceReady, errors, failedRequests, phases };
        const output = path.resolve('tests/artifacts/traffic-audit.json');
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, JSON.stringify(report, null, 2));
        console.log(JSON.stringify(phases.map(p => ({ name: p.name, requests: p.requests.length,
            bytes: p.requests.reduce((n, r) => n + r.bytes, 0), positionMessages: p.positionMessages,
            largest: [...p.requests].sort((a, b) => b.bytes - a.bytes).slice(0, 8) })), null, 2));
        console.log('REPORT', output, 'ERRORS', JSON.stringify(errors));
        if (!report.validVisit) process.exitCode = 1;
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
