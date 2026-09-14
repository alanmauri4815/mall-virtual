const assert = require('node:assert/strict');

global.window = global;
global.THREE = require('../../assets/vendor/three/three.r128.min.js');
global.navigator = { maxTouchPoints: 2 };
global.isWalking = true;
global.shouldForceWalkMode = () => true;
global.matchMedia = () => ({ matches: true });

let animationNow = 0;
global.performance = { now: () => animationNow };
global.requestAnimationFrame = (callback) => {
    animationNow += 30;
    callback(animationNow);
    return animationNow;
};

const listeners = new Map();
function createElement(overrides = {}) {
    const elementListeners = new Map();
    return {
        hidden: false,
        value: '1',
        checked: false,
        title: '',
        style: {},
        classList: {
            values: new Set(),
            toggle(name, active) {
                if (active) this.values.add(name);
                else this.values.delete(name);
            }
        },
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = String(value); },
        addEventListener(type, callback) { elementListeners.set(type, callback); },
        dispatch(type, event = {}) { return elementListeners.get(type)?.({ target: this, ...event }); },
        ...overrides
    };
}

const canvas = createElement({
    setPointerCapture() {},
    addEventListener(type, callback) { listeners.set(type, callback); }
});
const elements = {
    'mobile-auto-forward-btn': createElement(),
    'mobile-settings-btn': createElement(),
    'mobile-control-settings': createElement({ hidden: true }),
    'mobile-control-settings-close': createElement(),
    'mobile-reset-zoom-btn': createElement(),
    'mobile-look-sensitivity': createElement(),
    'mobile-left-handed': createElement()
};
global.document = {
    body: createElement(),
    getElementById(id) { return elements[id] || null; }
};
global.localStorage = {
    data: new Map(),
    getItem(key) { return this.data.get(key) || null; },
    setItem(key, value) { this.data.set(key, value); }
};
global.camera = {
    fov: 55,
    position: new THREE.Vector3(0, 1.7, 0),
    updateProjectionMatrix() {}
};
global.controls = {
    target: new THREE.Vector3(0, 1.7, 1),
    update() {}
};
global.renderer = { domElement: canvas };

require('../../js/mall/mall-mobile-controls.js');
window.mallMobileControls.bind();

elements['mobile-auto-forward-btn'].dispatch('click');
assert.equal(window.mallMobileControls.isAutoForwardActive(), true);
assert.equal(elements['mobile-auto-forward-btn'].attributes['aria-pressed'], 'true');

elements['mobile-settings-btn'].dispatch('click');
assert.equal(window.mallMobileControls.isAutoForwardActive(), false);
assert.equal(elements['mobile-control-settings'].hidden, false);
elements['mobile-control-settings-close'].dispatch('click');
assert.equal(elements['mobile-control-settings'].hidden, true);

elements['mobile-look-sensitivity'].value = '1.6';
elements['mobile-look-sensitivity'].dispatch('input');
elements['mobile-left-handed'].checked = true;
elements['mobile-left-handed'].dispatch('change');
assert.equal(document.body.classList.values.has('mobile-controls-left-handed'), true);

const touchEvent = (pointerId, clientX, clientY) => ({
    pointerType: 'touch', pointerId, clientX, clientY, preventDefault() {}
});
const originalTarget = controls.target.clone();
listeners.get('pointerdown')(touchEvent(1, 100, 100));
listeners.get('pointermove')(touchEvent(1, 140, 112));
assert.equal(controls.target.equals(originalTarget), false, 'Drag must rotate the walking view');
listeners.get('pointerup')(touchEvent(1, 140, 112));

camera.fov = 55;
listeners.get('pointerdown')(touchEvent(2, 100, 100));
listeners.get('pointerdown')(touchEvent(3, 200, 100));
listeners.get('pointermove')(touchEvent(3, 250, 100));
assert.ok(camera.fov < 55 && camera.fov >= 35, 'Pinch-out must reduce FOV without exceeding limits');
listeners.get('pointerup')(touchEvent(3, 250, 100));
listeners.get('pointerup')(touchEvent(2, 100, 100));

window.mallMobileControls.resetZoom();
assert.equal(Math.round(camera.fov), 55);
assert.ok(window.mallSuppressCanvasTapUntil > Date.now());

console.log('Mobile controls support drag, pinch zoom, auto-forward and preferences.');
