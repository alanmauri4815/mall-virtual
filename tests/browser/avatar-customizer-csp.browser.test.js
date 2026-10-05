const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');

const TEST_URL = process.env.MALL_TEST_URL || 'http://127.0.0.1:4174/?avatar-customizer-csp-test';
const CHROME_PATH = process.env.PLAYWRIGHT_CHROME_PATH
    || 'C:/Users/javii/AppData/Local/Google/Chrome/Application/chrome.exe';
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; media-src 'self' https: blob:; connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self' mailto: https://wa.me; upgrade-insecure-requests";

(async () => {
    const browser = await puppeteer.launch({ headless: true, executablePath: CHROME_PATH });
    const page = await browser.newPage();
    const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
    const cspViolations = [];
    const pageErrors = [];
    await page.setRequestInterception(true);
    page.on('request', request => {
        if (request.isNavigationRequest() && new URL(request.url()).pathname === '/') {
            request.respond({
                status: 200,
                contentType: 'text/html; charset=utf-8',
                headers: { 'Content-Security-Policy': CSP, 'Cache-Control': 'no-store' },
                body: html
            }).catch(error => pageErrors.push(String(error)));
        } else {
            request.continue().catch(error => pageErrors.push(String(error)));
        }
    });
    page.on('console', message => {
        if (/Content Security Policy|Refused to execute inline/i.test(message.text())) cspViolations.push(message.text());
    });
    page.on('pageerror', error => pageErrors.push(String(error)));

    try {
        await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.evaluate(() => {
            localStorage.removeItem('mall-avatar-profile-v2');
            window.openAvatarCustomizer();
        });
        await page.waitForFunction(() => !document.getElementById('avatar-customizer-modal')?.hidden, { timeout: 10000 });

        const choose = async (kind, value) => {
            const selector = `#avatar-customizer-modal [data-avatar-kind="${kind}"][data-avatar-value="${value}"]`;
            await page.$eval(selector, button => button.click());
            const selected = await page.$eval(selector, button => button.classList.contains('selected'));
            assert.equal(selected, true, `${kind}=${value} should become selected`);
        };

        await choose('body', 'female');
        await choose('skinTone', 'fair');
        await choose('hairStyle', 'bob01');
        await choose('hairColor', 'blonde');
        await choose('eyeColor', 'blue');
        await choose('age', 'senior');
        await choose('height', '190');
        await choose('outfit', 'sport');
        await page.$eval('#avatar-customizer-modal [data-avatar-action="apply"]', button => button.click());
        await page.waitForFunction(() => document.getElementById('avatar-customizer-modal')?.hidden, { timeout: 10000 });

        const savedProfile = await page.evaluate(() => localStorage.getItem('mall-avatar-profile-v2'));
        assert.equal(savedProfile, 'av2.female.sport.fair.blonde.190.blue.senior.bob01');
        assert.deepEqual(cspViolations, [], 'Avatar controls must not trigger CSP inline-handler violations.');
        assert.deepEqual(pageErrors, [], 'Avatar customizer should not throw in the browser.');
        console.log('AVATAR_CUSTOMIZER_CSP_OK', savedProfile);
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exit(1); });
