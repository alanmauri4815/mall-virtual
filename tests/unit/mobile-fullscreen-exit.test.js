const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const boot = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-boot.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-ui.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'mall.css'), 'utf8');

assert.match(
    html,
    /id="guest-account-actions"[\s\S]*?data-mall-action="exitMallExperience"[\s\S]*?aria-label="Salir del mall"/
);
assert.match(boot, /exitMallExperience:\s*\(\)\s*=>\s*callGlobal\('exitMallExperience'\)/);
assert.match(boot, /navigationUI:\s*isAndroid\s*\?\s*'show'\s*:\s*'hide'/);
assert.ok(html.includes('js/mall/mall-boot.js?v=20261024-mobile-rotation-suggestion-v1'));
assert.match(css, /\.guest-account-actions__exit\s*\{[\s\S]*?min-height:\s*36px/);

const entry = ui.match(/window\.startMallExperience = async function \(\) \{([\s\S]*?)\n        \};/);
assert.ok(entry, 'Mall entry must remain available.');
assert.match(
    entry[1],
    /requestFullscreenFromGesture\?\.\(\)[\s\S]*?await enterMallWithIdentity/,
    'Mobile fullscreen must be requested synchronously from the existing entry tap.'
);

const exit = ui.match(/window\.exitMallExperience = async function \(\) \{([\s\S]*?)\n        \};/);
assert.ok(exit, 'The mall exit action must exist.');
assert.match(exit[1], /exitFullscreen/);
assert.match(exit[1], /window\.location\.reload\(\)/);

const syncActions = ui.match(/function syncGuestAccountActions\(\) \{([\s\S]*?)\n        \}/);
assert.ok(syncActions, 'Mall session actions must stay in sync with role changes.');
assert.match(syncActions[1], /accountActions\.hidden = !hasEnteredMall/);
assert.match(syncActions[1], /loginButton\.hidden = !isAnonymousGuest/);
assert.match(syncActions[1], /exitButton\.hidden = !hasEnteredMall/);

const viewportBlock = boot.match(/window\.mallMobileViewport = \(\(\) => \{[\s\S]*?\n\}\)\(\);/);
assert.ok(viewportBlock, 'The mobile viewport controller must remain available.');

function createViewport({ touch = true, fullscreenSupported = true, userAgent = '', platform = '' } = {}) {
    const state = { requestOptions: null, requestCalls: 0, exitCalls: 0 };
    const orientation = { type: 'portrait-primary', addEventListener() {} };
    const window = {
        innerWidth: 390,
        innerHeight: 844,
        screen: { orientation },
        visualViewport: { width: 390, height: 844, addEventListener() {} },
        matchMedia(query) {
            return {
                matches: query === '(pointer: coarse)' && touch,
                addEventListener() {},
                addListener() {}
            };
        },
        addEventListener() {}
    };
    const rootElement = {};
    let document;
    if (fullscreenSupported) {
        rootElement.requestFullscreen = (options) => {
            state.requestCalls += 1;
            state.requestOptions = options;
            document.fullscreenElement = rootElement;
            return Promise.resolve();
        };
    }
    document = {
        documentElement: rootElement,
        body: { classList: { toggle() {} } },
        getElementById() { return null; },
        exitFullscreen() {
            state.exitCalls += 1;
            document.fullscreenElement = null;
            return Promise.resolve();
        }
    };
    vm.runInNewContext(viewportBlock[0], {
        window,
        document,
        navigator: { maxTouchPoints: touch ? 1 : 0, userAgent, userAgentData: { platform } },
        setTimeout: () => 1,
        clearTimeout() {}
    });
    return { viewport: window.mallMobileViewport, state, document };
}

(async () => {
    const mobile = createViewport();
    assert.equal(await mobile.viewport.requestFullscreenFromGesture(), true);
    assert.equal(mobile.state.requestCalls, 1);
    assert.equal(mobile.state.requestOptions.navigationUI, 'hide');
    assert.equal(await mobile.viewport.exitFullscreen(), true);
    assert.equal(mobile.state.exitCalls, 1);

    const android = createViewport({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' });
    assert.equal(await android.viewport.requestFullscreenFromGesture(), true);
    assert.equal(android.state.requestOptions.navigationUI, 'show');

    const androidUserAgentData = createViewport({ platform: 'Android' });
    assert.equal(await androidUserAgentData.viewport.requestFullscreenFromGesture(), true);
    assert.equal(androidUserAgentData.state.requestOptions.navigationUI, 'show');

    const ios = createViewport({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' });
    assert.equal(await ios.viewport.requestFullscreenFromGesture(), true);
    assert.equal(ios.state.requestOptions.navigationUI, 'hide');

    const desktop = createViewport({ touch: false });
    assert.equal(await desktop.viewport.requestFullscreenFromGesture(), false);
    assert.equal(desktop.state.requestCalls, 0);

    const unsupported = createViewport({ fullscreenSupported: false });
    assert.equal(await unsupported.viewport.requestFullscreenFromGesture(), false);
    assert.equal(unsupported.state.requestCalls, 0);

    console.log('mobile-fullscreen-exit.test.js: ok');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

