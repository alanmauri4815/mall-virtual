const assert = require('node:assert/strict');

const windowListeners = new Map();
const viewportListeners = new Map();
const screenOrientationListeners = new Map();
const mediaListeners = new Map();
const bodyClasses = new Set();
let legacyOrientationGateRemoved = false;

let mediaIsLandscape = false;
const orientationMedia = {
    get matches() { return mediaIsLandscape; },
    addEventListener(type, listener) { mediaListeners.set(type, listener); },
    addListener(listener) { mediaListeners.set('change-legacy', listener); }
};

global.navigator = { maxTouchPoints: 1 };
global.document = {
    getElementById(id) {
        if (id !== 'mobile-orientation-helper') return null;
        return { remove() { legacyOrientationGateRemoved = true; } };
    },
    body: {
        classList: {
            toggle(name, active) {
                if (active) bodyClasses.add(name);
                else bodyClasses.delete(name);
            }
        }
    }
};
global.window = {
    location: { protocol: 'https:' },
    innerWidth: 390,
    innerHeight: 844,
    screen: {
        orientation: {
            type: 'portrait-primary',
            addEventListener(type, listener) { screenOrientationListeners.set(type, listener); }
        }
    },
    visualViewport: {
        width: 390,
        height: 844,
        addEventListener(type, listener) { viewportListeners.set(type, listener); }
    },
    matchMedia(query) {
        if (query === '(orientation: landscape)') return orientationMedia;
        return { matches: query === '(pointer: coarse)' };
    },
    addEventListener(type, listener) { windowListeners.set(type, listener); }
};

require('../../js/mall/mall-boot.js');
assert.equal(legacyOrientationGateRemoved, true,
    'A cached legacy orientation gate must be removed without requiring visitor input.');
window.mallMobileViewport.activate();
assert.equal(bodyClasses.has('mobile-portrait'), true);

window.visualViewport.width = 844;
window.visualViewport.height = 390;
window.screen.orientation.type = 'portrait-primary';
viewportListeners.get('resize')();
assert.equal(bodyClasses.has('mobile-landscape'), true,
    'Visual viewport resize must dismiss the gate if the layout viewport is stale.');
assert.equal(bodyClasses.has('mobile-portrait'), false);

window.innerWidth = 390;
window.innerHeight = 844;
window.visualViewport.width = 390;
window.visualViewport.height = 844;
mediaIsLandscape = false;
window.screen.orientation.type = 'portrait-primary';
windowListeners.get('orientationchange')();
assert.equal(bodyClasses.has('mobile-portrait'), true);

window.screen.orientation.type = 'landscape-secondary';
screenOrientationListeners.get('change')();
assert.equal(bodyClasses.has('mobile-landscape'), true,
    'Screen orientation must win when embedded browsers keep stale viewport dimensions.');

window.screen.orientation.type = 'portrait-primary';
mediaIsLandscape = true;
mediaListeners.get('change')();
assert.equal(bodyClasses.has('mobile-landscape'), true,
    'The orientation media query must update the gate when viewport events are missing.');

console.log('Mobile orientation gate follows viewport and screen orientation changes.');
