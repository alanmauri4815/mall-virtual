const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const boot = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-boot.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'css', 'mall.css'), 'utf8');

assert.match(html, /id="store-catalog-picker-menu-item"[^>]*data-mall-action="openStoreCatalogPicker"/);
assert.match(boot, /openStoreCatalogPicker:\s*\(\)\s*=>\s*callGlobal\('openQuickSearch',\s*'store'\)/);
assert.match(styles, /\.search-results\s*\{[^}]*overflow-x:\s*hidden/s);
assert.match(styles, /\.search-item\s*\{[^}]*box-sizing:\s*border-box/s);

class Element {
    constructor(tag = 'div') {
        this.tagName = tag;
        this.children = [];
        this.listeners = {};
        this.style = {};
        this.attributes = {};
        this.hidden = false;
        this.value = '';
        this.textContent = '';
    }

    set innerHTML(value) {
        this._innerHTML = value;
        this.children = [];
    }

    get innerHTML() {
        return this._innerHTML || '';
    }

    append(...nodes) {
        this.children.push(...nodes);
    }

    appendChild(node) {
        this.children.push(node);
    }

    addEventListener(type, listener) {
        this.listeners[type] = listener;
    }

    setAttribute(name, value) {
        this.attributes[name] = value;
    }

    focus() {}
}

async function main() {
    const nodeIds = [
        'quick-navigator-panel', 'quick-navigator-toggle', 'search-input',
        'search-modal', 'modal-overlay', 'search-results'
    ];
    const nodes = Object.fromEntries(nodeIds.map((id) => [id, new Element()]));
    nodes['quick-navigator-panel'].hidden = true;
    nodes['search-modal'].style.display = 'none';
    nodes['modal-overlay'].style.display = 'none';

    const openedCatalogs = [];
    const testStores = [
        { local_code: 'S-107', name: 'Ross Confecciones', category: 'Vestuario' },
        { local_code: 'S-105', name: 'Caraloka Artesanías', category: 'Artesanía' },
        ...Array.from({ length: 13 }, (_, index) => ({
            local_code: `S-${200 + index}`,
            name: `Local de prueba ${index + 1}`,
            category: 'Comercio'
        }))
    ];
    let originalQuickSearchCalls = 0;
    let originalFilterCalls = 0;
    let controlsMenuCloseCalls = 0;
    const document = {
        getElementById: (id) => nodes[id] || null,
        createElement: (tag) => new Element(tag),
        createTextNode: (text) => Object.assign(new Element('#text'), { textContent: text })
    };
    const window = {
        document,
        mallCatalogRequests: {
            getStores: async () => testStores
        },
        mallAnalytics: { track() {} },
        filterStores: async () => { originalFilterCalls += 1; },
        openSearch() {},
        closeSearchModal() {},
        openQuickSearch() { originalQuickSearchCalls += 1; },
        openPublicStoreCatalog: (code) => openedCatalogs.push(code),
        closeControlsMenu: () => { controlsMenuCloseCalls += 1; },
        isMallThirdPersonView: () => true,
        dismissMallQuickStart() {},
        closeCompactRouteMap() {}
    };
    document.defaultView = window;

    const sourcePath = path.join(root, 'js/mall/mall-quick-store-picker.js');
    vm.runInNewContext(fs.readFileSync(sourcePath, 'utf8'), { window, document, console });

    window.openQuickSearch('store');
    await window.filterStores();
    assert.equal(window.isMallThirdPersonView(), true);
    assert.equal(controlsMenuCloseCalls, 1);
    assert.equal(nodes['search-modal'].style.display, 'block');
    assert.equal(nodes['modal-overlay'].style.display, 'block');
    assert.equal(nodes['search-results'].children.length, 15);

    nodes['search-input'].value = 's-212';
    await window.filterStores();
    assert.equal(nodes['search-results'].children.length, 1);
    assert.equal(nodes['search-results'].children[0].children[1].textContent, 'S-212');

    nodes['search-input'].value = 's-105';
    await window.filterStores();
    const result = nodes['search-results'].children[0];
    assert.match(result.children[0].children[0].textContent, /Caraloka Artesanías/);
    result.children[2].listeners.click();
    assert.deepEqual(openedCatalogs, ['S-105']);
    assert.equal(nodes['search-modal'].style.display, 'none');
    assert.equal(nodes['modal-overlay'].style.display, 'none');

    window.openQuickSearch('product');
    await window.filterStores();
    assert.equal(originalQuickSearchCalls, 1);
    assert.equal(originalFilterCalls, 1);
}

main().then(() => {
    console.log('Quick store picker shows all stores and opens catalogs independently of camera mode.');
}).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
