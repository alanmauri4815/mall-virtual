const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/mall.css'), 'utf8');
const boot = fs.readFileSync(path.join(root, 'js/mall/mall-boot.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'js/mall/mall-ui.js'), 'utf8');

assert.ok(html.includes('js/mall/mall-boot.js?v=20261104-mobile-fullscreen-toggle-v1'));
assert.ok(html.includes('css/mall.css?v=20261104-mobile-fullscreen-toggle-v1'));
assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
assert.match(html, /id="mobile-fullscreen-toggle"[^>]*data-mall-action="toggleMobileFullscreen"/);
assert.match(html, /id="mobile-fullscreen-status" role="status" aria-live="polite"/);
assert.match(boot, /toggleMobileFullscreen:\s*\(\)\s*=>\s*callGlobal\('toggleMobileFullscreen'\)/);
assert.match(css, /#mobile-fullscreen-toggle:focus-visible/);
assert.match(css, /#mobile-fullscreen-toggle\[hidden\]\s*\{\s*display:\s*none;/);
assert.match(css, /#mobile-fullscreen-status\[hidden\]\s*\{\s*display:\s*none;/);
assert.ok(html.includes('js/mall/mall-ui.js?v=20261104-fullscreen-entry-gesture-v1'));

const guestEntry = ui.match(/window\.startMallExperience = async function \(\) \{([\s\S]*?)\n        \};/);
assert.ok(guestEntry, 'The anonymous mall entry handler must remain available.');
assert.match(
    guestEntry[1],
    /requestFullscreenFromGesture\?\.\(\)[\s\S]*?await enterMallWithIdentity/,
    'Fullscreen must be requested synchronously before guest entry awaits.'
);

async function runGuestEntry(requestFullscreenFromGesture) {
    const callOrder = [];
    const nicknameInput = { value: '' };
    let enteredIdentity = null;
    const sandbox = {
        window: {
            mallMobileViewport: {
                requestFullscreenFromGesture() {
                    callOrder.push('fullscreen-request');
                    return requestFullscreenFromGesture();
                }
            }
        },
        document: {
            getElementById(id) { return id === 'nickname-input' ? nicknameInput : null; }
        },
        buildGuestNickname() { return 'Visitante de prueba'; },
        async enterMallWithIdentity(identity) {
            callOrder.push('guest-entry');
            enteredIdentity = identity;
            return identity;
        }
    };
    vm.runInNewContext(guestEntry[0], sandbox);
    await sandbox.window.startMallExperience();
    return { callOrder, identity: enteredIdentity, nicknameInput };
}

const viewportBlock = boot.match(/window\.mallMobileViewport = \(\(\) => \{[\s\S]*?\n\}\)\(\);/);
assert.ok(viewportBlock, 'The mobile viewport controller must remain available.');
assert.match(viewportBlock[0], /requestFullscreen\(\{\s*navigationUI:\s*'hide'\s*\}\)/);
assert.match(viewportBlock[0], /document\.addEventListener\?\.\('fullscreenchange', syncFullscreenButton\)/);
assert.match(viewportBlock[0], /document\.addEventListener\?\.\('webkitfullscreenchange', syncFullscreenButton\)/);
assert.doesNotMatch(viewportBlock[0], /orientation\.lock\s*\(/, 'Fullscreen must not lock screen orientation.');

class FakeClassList {
    constructor() { this.values = new Set(); }
    toggle(name, force) {
        if (force === undefined ? !this.values.has(name) : force) this.values.add(name);
        else this.values.delete(name);
    }
    contains(name) { return this.values.has(name); }
}

function fakeElement(child = null) {
    return {
        hidden: false,
        disabled: false,
        textContent: '',
        title: '',
        attributes: {},
        classList: new FakeClassList(),
        setAttribute(name, value) { this.attributes[name] = value; },
        querySelector() { return child; }
    };
}

function createViewport({
    touch = true,
    fullscreenSupported = true,
    requestReject = false,
    exitReject = false,
    userAgent = '',
    platform = '',
    standalone = false
} = {}) {
    const state = { requestOptions: null, requestCalls: 0, exitCalls: 0, timers: new Map(), nextTimer: 1 };
    const listeners = new Map();
    const orientation = { type: 'portrait-primary', addEventListener() {} };
    const media = (query) => ({
        matches: (query === '(pointer: coarse)' && touch)
            || (query === '(orientation: landscape)' && orientation.type.startsWith('landscape'))
            || (query === '(display-mode: standalone)' && standalone),
        addEventListener() {},
        addListener() {}
    });
    const window = {
        innerWidth: 390,
        innerHeight: 844,
        screen: { orientation },
        visualViewport: { width: 390, height: 844, addEventListener() {} },
        matchMedia: media,
        addEventListener(type, listener) { listeners.set(type, listener); }
    };
    const icon = { textContent: '' };
    const button = fakeElement(icon);
    const status = fakeElement();
    status.hidden = true;
    const rootElement = {};
    let document;
    const fireFullscreenChange = () => {
        listeners.get('fullscreenchange')?.();
        listeners.get('webkitfullscreenchange')?.();
    };
    if (fullscreenSupported) {
        rootElement.requestFullscreen = (options) => {
            state.requestCalls += 1;
            state.requestOptions = options;
            if (requestReject) return Promise.reject(new Error('Not allowed'));
            document.fullscreenElement = rootElement;
            fireFullscreenChange();
            return Promise.resolve();
        };
    }
    document = {
        documentElement: rootElement,
        body: { classList: { toggle() {} } },
        getElementById(id) {
            if (id === 'mobile-fullscreen-toggle') return button;
            if (id === 'mobile-fullscreen-status') return status;
            return null;
        },
        addEventListener(type, listener) { listeners.set(type, listener); },
        exitFullscreen() {
            state.exitCalls += 1;
            if (exitReject) return Promise.reject(new Error('Not allowed'));
            document.fullscreenElement = null;
            fireFullscreenChange();
            return Promise.resolve();
        }
    };
    const setTimeout = (callback, duration) => {
        const timer = state.nextTimer++;
        state.timers.set(timer, { callback, duration });
        return timer;
    };
    const clearTimeout = (timer) => state.timers.delete(timer);

    vm.runInNewContext(viewportBlock[0], {
        window,
        document,
        navigator: { maxTouchPoints: touch ? 1 : 0, userAgent, platform, standalone },
        setTimeout,
        clearTimeout
    });
    return { viewport: window.mallMobileViewport, state, document, button, icon, status, orientation, fireFullscreenChange };
}

(async () => {
    const rejectedGuestEntry = await runGuestEntry(() => Promise.reject(new Error('Fullscreen denied')));
    assert.deepEqual(rejectedGuestEntry.callOrder, ['fullscreen-request', 'guest-entry']);
    assert.equal(rejectedGuestEntry.identity.role, 'guest', 'A rejected fullscreen request must not block anonymous entry.');
    assert.equal(rejectedGuestEntry.identity.nickname, 'Visitante de prueba');
    assert.equal(rejectedGuestEntry.nicknameInput.value, 'Visitante de prueba');

    const unsupportedGuestEntry = await runGuestEntry(() => { throw new Error('Fullscreen unsupported'); });
    assert.deepEqual(unsupportedGuestEntry.callOrder, ['fullscreen-request', 'guest-entry']);
    assert.equal(unsupportedGuestEntry.identity.role, 'guest', 'A synchronous fullscreen failure must not block anonymous entry.');

    const mobile = createViewport();
    assert.equal(mobile.button.hidden, false);
    assert.equal(mobile.button.attributes['aria-pressed'], 'false');
    assert.equal(mobile.button.attributes['aria-label'], 'Activar pantalla completa');

    const entering = mobile.viewport.toggleFullscreen();
    assert.equal(mobile.state.requestCalls, 1, 'The request must start in the tap activation window.');
    assert.equal(await entering, true);
    assert.equal(mobile.state.requestOptions.navigationUI, 'hide');
    assert.equal(mobile.button.attributes['aria-pressed'], 'true');
    assert.equal(mobile.button.attributes['aria-label'], 'Salir de pantalla completa');
    assert.equal(mobile.icon.textContent, 'fullscreen_exit');
    assert.equal(mobile.button.classList.contains('is-active'), true);

    assert.equal(await mobile.viewport.toggleFullscreen(), true);
    assert.equal(mobile.state.exitCalls, 1);
    assert.equal(mobile.button.attributes['aria-pressed'], 'false');
    assert.equal(mobile.icon.textContent, 'fullscreen');

    mobile.document.fullscreenElement = {};
    mobile.fireFullscreenChange();
    assert.equal(mobile.button.attributes['aria-pressed'], 'true', 'Browser-initiated entry must sync the control.');
    mobile.document.fullscreenElement = null;
    mobile.fireFullscreenChange();
    assert.equal(mobile.button.attributes['aria-pressed'], 'false', 'Browser-initiated exit must sync the control.');

    const iphone = createViewport({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' });
    assert.equal(await iphone.viewport.toggleFullscreen(), false);
    assert.equal(iphone.state.requestCalls, 0, 'Do not call unsupported browser fullscreen on iPhone.');
    assert.match(iphone.status.textContent, /Safari[\s\S]*Añadir a pantalla de inicio/);
    assert.equal(iphone.status.hidden, false);

    const iphoneStandalone = createViewport({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
        standalone: true
    });
    assert.equal(iphoneStandalone.button.hidden, true, 'Standalone iPhone web apps already run without browser bars.');

    const desktop = createViewport({ touch: false });
    assert.equal(desktop.button.hidden, true);
    assert.equal(await desktop.viewport.toggleFullscreen(), false);
    assert.equal(desktop.state.requestCalls, 0);

    const unsupported = createViewport({ fullscreenSupported: false });
    assert.equal(await unsupported.viewport.toggleFullscreen(), false);
    assert.match(unsupported.status.textContent, /no admite pantalla completa/);

    const rejected = createViewport({ requestReject: true });
    assert.equal(await rejected.viewport.toggleFullscreen(), false);
    assert.match(rejected.status.textContent, /no permitió activar/);

    const rejectedExit = createViewport({ exitReject: true });
    rejectedExit.document.fullscreenElement = {};
    assert.equal(await rejectedExit.viewport.toggleFullscreen(), false);
    assert.match(rejectedExit.status.textContent, /no permitió salir/);

    console.log('mobile-fullscreen-toggle.test.js: ok');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
