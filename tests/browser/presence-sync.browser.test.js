const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');

const TEST_URL = process.env.MALL_TEST_URL || 'http://127.0.0.1:4174/?v=presence-sync-browser-test';
const CHROME_PATH = process.env.PLAYWRIGHT_CHROME_PATH
    || 'C:/Users/javii/AppData/Local/Google/Chrome/Application/chrome.exe';

async function enterMall(page, nickname) {
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.evaluate((name) => {
        const input = document.getElementById('nickname-input');
        if (input) input.value = name;
        document.getElementById('guest-entry-button')?.click();
    }, nickname);
    await page.waitForFunction(() => typeof hasEnteredMall !== 'undefined' && hasEnteredMall, { timeout: 30000 });
    await page.waitForFunction(() => document.documentElement.dataset.mallPresenceReady === 'true', { timeout: 30000 });
}

async function readRemote(page, nickname) {
    return page.evaluate((name) => {
        const actor = Object.values(otherPlayers).find((candidate) => candidate.nickname === name);
        if (!actor) return null;
        return {
            style: actor.styleCode,
            target: actor.targetPos.toArray(),
            rotation: actor.targetRot,
            moving: actor.remoteMoving,
            motion: actor.motionMode,
            activeMotion: actor.activeMotion
        };
    }, nickname);
}

async function readLocal(page) {
    return page.evaluate(() => ({
        nickname: myNickname,
        style: myAvatarStyle,
        camera: camera.position.toArray(),
        moving: myIsMoving,
        speed: myMoveSpeed,
        motion: sampledMotion,
        presence: presenceChannel?.presenceState?.() || null
    }));
}

(async () => {
    const browser = await puppeteer.launch({ headless: true, executablePath: CHROME_PATH });
    const output = path.resolve('tests/artifacts/presence-sync');
    fs.mkdirSync(output, { recursive: true });
    const errors = [];
    let result = null;
    let broadcastProbe = null;
    const leftContext = await browser.createBrowserContext();
    const rightContext = await browser.createBrowserContext();
    const left = await leftContext.newPage();
    const right = await rightContext.newPage();
    await Promise.all([
        left.setViewport({ width: 960, height: 720 }),
        right.setViewport({ width: 960, height: 720 })
    ]);
    left.on('pageerror', (error) => errors.push(`left: ${error.stack}`));
    right.on('pageerror', (error) => errors.push(`right: ${error.stack}`));

    try {
        await Promise.all([enterMall(left, 'SYNC LEFT'), enterMall(right, 'SYNC RIGHT')]);
        await Promise.all([
            left.waitForFunction(() => Object.values(otherPlayers).some((actor) => actor.nickname === 'SYNC RIGHT'), { timeout: 30000 }),
            right.waitForFunction(() => Object.values(otherPlayers).some((actor) => actor.nickname === 'SYNC LEFT'), { timeout: 30000 })
        ]);

        await left.evaluate(() => {
            window.__presenceProbe = [];
            presenceChannel.on('broadcast', { event: 'sync_probe' }, ({ payload }) => {
                window.__presenceProbe.push(payload);
            });
        });
        const probeStatus = await right.evaluate(() => presenceChannel.send({
            type: 'broadcast',
            event: 'sync_probe',
            payload: { sentAt: Date.now() }
        }));
        await new Promise((resolve) => setTimeout(resolve, 800));
        broadcastProbe = {
            sendStatus: probeStatus,
            received: await left.evaluate(() => window.__presenceProbe)
        };

        await right.evaluate(async () => {
            openAvatarCustomizer();
            selectAvatarBody('female');
            selectAvatarTrait('skinTone', 'deep');
            await applyAvatarCustomizer();
        });

        await left.waitForFunction(() => {
            const actor = Object.values(otherPlayers).find((candidate) => candidate.nickname === 'SYNC RIGHT');
            return actor?.styleCode?.includes('.female.') && actor?.styleCode?.includes('.deep.');
        }, { timeout: 20000 });

        await left.evaluate(() => presenceChannel.send({
            type: 'broadcast',
            event: 'pos_update',
            payload: {
                playerId: myPresenceId,
                nickname: myNickname,
                style: myAvatarStyle,
                x: 11,
                y: PLAYER_EYE_HEIGHT,
                z: 10,
                r: 0,
                moving: true,
                speed: 1.4,
                motion: 'walk',
                poseUpdatedAt: Date.now()
            }
        }));
        await right.evaluate(() => presenceChannel.send({
            type: 'broadcast',
            event: 'pos_update',
            payload: {
                playerId: myPresenceId,
                nickname: myNickname,
                style: myAvatarStyle,
                x: 11,
                y: PLAYER_EYE_HEIGHT,
                z: 11,
                r: Math.PI,
                moving: true,
                speed: 1.4,
                motion: 'walk',
                poseUpdatedAt: Date.now()
            }
        }));
        await Promise.all([
            left.waitForFunction(() => {
                const actor = Object.values(otherPlayers).find((candidate) => candidate.nickname === 'SYNC RIGHT');
                return Math.abs(actor?.targetPos?.z - 11) < 0.05 && actor?.motionMode === 'walk';
            }, { timeout: 10000 }),
            right.waitForFunction(() => {
                const actor = Object.values(otherPlayers).find((candidate) => candidate.nickname === 'SYNC LEFT');
                return Math.abs(actor?.targetPos?.z - 10) < 0.05 && actor?.motionMode === 'walk';
            }, { timeout: 10000 })
        ]);
        await new Promise((resolve) => setTimeout(resolve, 600));

        result = {
            leftLocal: await readLocal(left),
            rightLocal: await readLocal(right),
            broadcastProbe,
            leftSees: await readRemote(left, 'SYNC RIGHT'),
            rightSees: await readRemote(right, 'SYNC LEFT')
        };
        assert.equal(result.leftSees.style.includes('.female.'), true);
        assert.ok(Math.abs(result.leftSees.target[2] - 11) < 0.05);
        assert.ok(Math.abs(result.rightSees.target[2] - 10) < 0.05);
        assert.equal(result.leftSees.motion, 'walk');
        assert.equal(result.rightSees.motion, 'walk');
        assert.equal(result.broadcastProbe.sendStatus, 'ok');
        assert.equal(result.broadcastProbe.received.length, 1);
        assert.deepEqual(errors, []);
        console.log('PRESENCE_SYNC_OK', JSON.stringify(result));
    } finally {
        if (!result) {
            result = {
                leftLocal: await readLocal(left).catch(() => null),
                rightLocal: await readLocal(right).catch(() => null),
                broadcastProbe,
                leftSees: await readRemote(left, 'SYNC RIGHT').catch(() => null),
                rightSees: await readRemote(right, 'SYNC LEFT').catch(() => null)
            };
        }
        fs.writeFileSync(path.join(output, 'diagnostics.json'), JSON.stringify({ errors, result }, null, 2));
        await browser.close();
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
