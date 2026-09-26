const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');

const TEST_URL = process.env.MALL_TEST_URL || 'http://127.0.0.1:4174/?v=npc-shared-avatar-browser-test';
const CHROME_PATH = process.env.PLAYWRIGHT_CHROME_PATH
    || 'C:/Users/javii/AppData/Local/Google/Chrome/Application/chrome.exe';

(async () => {
    const browser = await puppeteer.launch({ headless: true, executablePath: CHROME_PATH });
    const output = path.resolve('tests/artifacts/npc-shared-avatar');
    fs.mkdirSync(output, { recursive: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1100, height: 720, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack));

    try {
        await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.evaluate(() => document.getElementById('guest-entry-button')?.click());
        await page.waitForFunction(() => typeof hasEnteredMall !== 'undefined' && hasEnteredMall, { timeout: 30000 });
        await page.waitForFunction(() => {
            const male = npcs.find(npc => npc.gender === 'male');
            const female = npcs.find(npc => npc.gender === 'female');
            return male?.ready && female?.ready && male.actions?.walk && female.actions?.walk;
        }, { timeout: 60000 });

        const diagnostics = await page.evaluate(() => {
            const male = npcs.find(npc => npc.gender === 'male');
            const female = npcs.find(npc => npc.gender === 'female');
            const previewCanvas = document.createElement('canvas');
            previewCanvas.id = 'npc-test-preview';
            previewCanvas.width = 900;
            previewCanvas.height = 620;
            previewCanvas.style.cssText = 'position:fixed;inset:0;z-index:99999;width:900px;height:620px';
            document.body.appendChild(previewCanvas);
            const previewRenderer = new THREE.WebGLRenderer({ canvas: previewCanvas, antialias: true });
            previewRenderer.setSize(900, 620, false);
            previewRenderer.outputEncoding = THREE.sRGBEncoding;
            const previewScene = new THREE.Scene();
            previewScene.background = new THREE.Color(0x747a7d);
            previewScene.add(new THREE.HemisphereLight(0xffffff, 0x303438, 1.25));
            const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
            keyLight.position.set(3, 5, 4);
            previewScene.add(keyLight);
            previewScene.add(male.mesh, female.mesh);
            male.speed = 0;
            female.speed = 0;
            male.state = 'looking';
            female.state = 'looking';
            male.timer = Date.now() + 60000;
            female.timer = Date.now() + 60000;
            male.mesh.position.set(-0.9, getAvatarGroundY(0), 0);
            female.mesh.position.set(0.9, getAvatarGroundY(0), 0);
            male.mesh.rotation.y = 0;
            female.mesh.rotation.y = 0;
            const previewCamera = new THREE.PerspectiveCamera(28, 900 / 620, 0.1, 20);
            previewCamera.position.set(0, 1.15, 4.6);
            previewCamera.lookAt(0, 1.02, 0);
            previewRenderer.render(previewScene, previewCamera);
            return {
                count: npcs.length,
                male: { name: male.name, gender: male.gender, modelKey: male.modelKey, kind: male.avatarKind, actions: Object.keys(male.actions) },
                female: { name: female.name, gender: female.gender, modelKey: female.modelKey, kind: female.avatarKind, actions: Object.keys(female.actions) }
            };
        });

        const preview = await page.$('#npc-test-preview');
        await preview.screenshot({ path: path.join(output, 'male-female.png') });
        fs.writeFileSync(path.join(output, 'diagnostics.json'), JSON.stringify({ errors, diagnostics }, null, 2));
        assert.ok(diagnostics.count >= 4);
        assert.equal(diagnostics.male.modelKey, 'male');
        assert.equal(diagnostics.female.modelKey, 'female');
        assert.equal(diagnostics.male.kind, 'gltf');
        assert.equal(diagnostics.female.kind, 'gltf');
        assert.ok(diagnostics.male.actions.includes('walk'));
        assert.ok(diagnostics.female.actions.includes('walk'));
        assert.deepEqual(errors, []);
        console.log('NPC_SHARED_AVATAR_OK', JSON.stringify(diagnostics));
    } finally {
        await browser.close();
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
