const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const boot = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-boot.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'mall.css'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-ui.js'), 'utf8');

assert.match(html, /id="proximity-context-dismiss"[^>]*data-mall-action="dismissProximityContext"[^>]*aria-label="Cerrar aviso"/);
assert.match(boot, /dismissProximityContext:\s*\(\)\s*=>\s*callGlobal\('dismissProximityContext'\)/);
assert.match(css, /\.proximity-context \.proximity-context__dismiss\s*\{[^}]*width:\s*40px/s);
assert.match(ui, /const PROXIMITY_CONTEXT_IDLE_DISMISS_MS = 15000/);

const blockStart = ui.indexOf('        let activeProximityContext = null;');
const blockEnd = ui.indexOf('        window.openMallIntro = function () {', blockStart);
assert.ok(blockStart >= 0 && blockEnd > blockStart, 'The proximity context behavior block must exist.');

function createClock() {
    let now = 0;
    let nextId = 1;
    const pending = new Map();
    const history = new Map();

    return {
        setTimeout(callback, delay = 0) {
            const timer = { id: nextId++, at: now + Math.max(0, delay), callback, canceled: false };
            pending.set(timer.id, timer);
            history.set(timer.id, timer);
            return timer.id;
        },
        clearTimeout(id) {
            const timer = pending.get(id);
            if (!timer) return;
            timer.canceled = true;
            pending.delete(id);
        },
        advance(ms) {
            const target = now + ms;
            let guard = 1000;
            while (guard-- > 0) {
                const next = [...pending.values()]
                    .filter((timer) => timer.at <= target)
                    .sort((a, b) => a.at - b.at || a.id - b.id)[0];
                if (!next) break;
                pending.delete(next.id);
                now = next.at;
                if (!next.canceled) next.callback();
            }
            assert.ok(guard > 0, 'Timer loop should settle.');
            now = target;
        },
        runEvenIfCanceled(id) {
            history.get(id)?.callback();
        },
        latestId() {
            return nextId - 1;
        },
        pendingCount() {
            return pending.size;
        }
    };
}

class Element {
    constructor() {
        this.hidden = false;
        this.textContent = '';
        this.style = {};
        this.listeners = new Map();
        this.children = [];
    }

    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) || [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }

    dispatch(type) {
        for (const listener of this.listeners.get(type) || []) listener({ type, target: this });
    }

    contains(element) {
        return this === element || this.children.includes(element);
    }
}

function createTarget(x, userData = {}) {
    return {
        userData,
        getWorldPosition(vector) {
            vector.x = x;
            vector.y = 0;
            vector.z = 0;
            return vector;
        }
    };
}

function createHarness() {
    const clock = createClock();
    const ids = [
        'proximity-context', 'proximity-context-icon', 'proximity-context-title',
        'proximity-context-description', 'proximity-context-action',
        'proximity-context-dismiss', 'store-modal', 'store-contact-form',
        'checkout-modal', 'confirmation-modal', 'mall-assistant-modal'
    ];
    const nodes = Object.fromEntries(ids.map((id) => [id, new Element()]));
    const bar = nodes['proximity-context'];
    const action = nodes['proximity-context-action'];
    const dismiss = nodes['proximity-context-dismiss'];
    bar.children.push(action, dismiss);
    bar.hidden = true;

    for (const id of ['store-modal', 'store-contact-form', 'checkout-modal', 'confirmation-modal', 'mall-assistant-modal']) {
        nodes[id].style.display = 'block';
    }

    const document = {
        activeElement: null,
        getElementById: (id) => nodes[id] || null
    };
    const window = {
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout,
        mallInformationModuleTargets: [createTarget(1)],
        mallStoreAttendantTargets: [],
        openMallOrientationCalls: 0,
        openStoreAssistantCalls: [],
        openMallOrientation() { this.openMallOrientationCalls += 1; },
        openStoreAssistant(code) { this.openStoreAssistantCalls.push(code); }
    };
    const camera = { position: { x: 0, y: 0, z: 0 } };
    class Vector3 {}

    vm.runInNewContext(`${ui.slice(blockStart, blockEnd)}\nwindow.__testUpdateProximityContext = updateProximityContext;`, {
        window,
        document,
        camera,
        hasEnteredMall: true,
        catalogClickTargets: [],
        THREE: { Vector3 },
        console
    });

    return { clock, document, window, nodes, camera };
}

const h = createHarness();
h.window.__testUpdateProximityContext();
assert.equal(h.nodes['proximity-context'].hidden, false, 'A nearby notice should appear.');
assert.equal(h.nodes['proximity-context-action'].textContent, 'Preguntar');
assert.equal(h.clock.pendingCount(), 1, 'A new notice should start one idle-dismiss timer.');

const firstTimerId = h.clock.latestId();
h.clock.advance(14999);
assert.equal(h.nodes['proximity-context'].hidden, false, 'The notice stays visible before 15 seconds.');
h.clock.advance(1);
assert.equal(h.nodes['proximity-context'].hidden, true, 'The notice hides after 15 seconds.');
assert.equal(h.clock.pendingCount(), 0, 'Auto-dismiss must clear its timer.');
for (const id of ['store-modal', 'store-contact-form', 'checkout-modal', 'confirmation-modal', 'mall-assistant-modal']) {
    assert.equal(h.nodes[id].style.display, 'block', `Auto-dismiss must not close ${id}.`);
}
h.window.__testUpdateProximityContext();
assert.equal(h.nodes['proximity-context'].hidden, true, 'A dismissed notice must not immediately reappear while still nearby.');

h.camera.position.x = 100;
h.window.__testUpdateProximityContext();
h.camera.position.x = 0;
h.window.__testUpdateProximityContext();
assert.equal(h.nodes['proximity-context'].hidden, false, 'Leaving and re-entering proximity allows the notice to appear again.');
const manualCloseTimerId = h.clock.latestId();
h.window.dismissProximityContext();
assert.equal(h.nodes['proximity-context'].hidden, true, 'The close action hides the notice.');
assert.equal(h.clock.pendingCount(), 0, 'The close action cancels its timer.');
h.window.__testUpdateProximityContext();
assert.equal(h.nodes['proximity-context'].hidden, true, 'The close action suppresses the same notice while nearby.');
h.clock.runEvenIfCanceled(manualCloseTimerId);
assert.equal(h.nodes['proximity-context'].hidden, true, 'A canceled close timer cannot affect the current UI.');
h.camera.position.x = 100;
h.window.__testUpdateProximityContext();
h.camera.position.x = 0;
h.window.__testUpdateProximityContext();
assert.equal(h.nodes['proximity-context'].hidden, false);

h.window.mallInformationModuleTargets = [];
const attendantTarget = createTarget(1, { storeCode: 'S-105', assistantName: 'Asistente Ana' });
h.window.mallStoreAttendantTargets = [attendantTarget];
h.window.__testUpdateProximityContext();
assert.match(h.nodes['proximity-context-title'].textContent, /Asistente Ana/);
const oldTimerId = h.clock.latestId();
h.window.mallStoreAttendantTargets = [createTarget(1, { storeCode: 'S-106', assistantName: 'Asistente Luz' })];
h.window.__testUpdateProximityContext();
assert.match(h.nodes['proximity-context-title'].textContent, /Asistente Luz/);
h.clock.runEvenIfCanceled(oldTimerId);
assert.equal(h.nodes['proximity-context'].hidden, false, 'A stale timer must not hide a newer notice.');
assert.match(h.nodes['proximity-context-title'].textContent, /Asistente Luz/);

h.document.activeElement = h.nodes['proximity-context-action'];
h.nodes['proximity-context'].dispatch('focusin');
h.clock.advance(20000);
assert.equal(h.nodes['proximity-context'].hidden, false, 'Focus within the notice pauses auto-dismiss.');
h.document.activeElement = null;
h.nodes['proximity-context'].dispatch('focusout');
h.clock.advance(0);
assert.equal(h.clock.pendingCount(), 1, 'Moving focus out restarts a full timer.');
h.clock.advance(14999);
assert.equal(h.nodes['proximity-context'].hidden, false);
h.clock.advance(1);
assert.equal(h.nodes['proximity-context'].hidden, true);

h.window.mallStoreAttendantTargets = [];
h.window.mallInformationModuleTargets = [createTarget(1)];
h.window.__testUpdateProximityContext();
assert.equal(h.nodes['proximity-context'].hidden, false);
const actionTimerId = h.clock.latestId();
h.window.openProximityContextAction();
assert.equal(h.window.openMallOrientationCalls, 1, 'Preguntar should still open mall orientation.');
assert.equal(h.nodes['proximity-context'].hidden, true, 'Activating Preguntar dismisses the notice.');
assert.equal(h.clock.pendingCount(), 0, 'Activating Preguntar cancels its timer.');
h.clock.runEvenIfCanceled(actionTimerId);
assert.equal(h.nodes['proximity-context'].hidden, true, 'A canceled action timer cannot change the later UI.');
h.window.__testUpdateProximityContext();
assert.equal(h.nodes['proximity-context'].hidden, true, 'The same notice stays dismissed while the visitor remains nearby.');

console.log('Proximity context dismisses after 15 idle seconds, pauses for focus, and protects newer notices and other surfaces.');

