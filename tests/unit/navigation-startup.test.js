const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../../js/mall/mall-navigation.js'), 'utf8');
const pointerIndex = source.indexOf("canvasContainer.addEventListener('pointerdown'");
const start = source.lastIndexOf('        }, true);', pointerIndex) + '        }, true);'.length;
const block = source.slice(start, source.indexOf('        // --- L', pointerIndex));

for (const readyState of ['loading', 'interactive', 'complete']) {
    let timer;
    let ready;
    let pointer;
    let calls = 0;
    const context = {
        document: { readyState, addEventListener(event, fn, options) {
            assert.equal(event, 'DOMContentLoaded');
            assert.equal(options.once, true);
            ready = fn;
        } },
        canvasContainer: { addEventListener(event, fn) { pointer = fn; } },
        setInterval(fn) { timer = fn; },
        ensureWalkModeActive() { calls++; }, shouldForceWalkMode: () => true,
        focusMallCanvas() {}
    };
    vm.runInNewContext(block, context);
    if (readyState !== 'complete') {
        assert.equal(timer, undefined, 'Do not start navigation while deferred dependencies are loading');
        assert.equal(pointer, undefined, 'Do not accept canvas movement before UI initialization');
        ready();
    }
    assert.equal(typeof timer, 'function');
    timer();
    assert.equal(calls, 1);
    pointer({ target: { closest: () => false } });
    assert.equal(calls, 2);
}
console.log('navigation-startup.test.js: ok');
