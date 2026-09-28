const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const purchases = fs.readFileSync(path.join(root, 'js/mall/mall-purchases.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/store_payment_options_20260927.sql'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'js/mall/mall-ui.js'), 'utf8');

const optionBlock = purchases.match(/const PAYMENT_OPTIONS = Object\.freeze\(\[([\s\S]*?)\]\);/);
assert.ok(optionBlock, 'The checkout must declare its supported payment alternatives.');
const optionValues = [...optionBlock[1].matchAll(/value: '([^']+)'/g)].map((match) => match[1]);
assert.deepEqual(optionValues, ['cash_on_delivery', 'bank_transfer', 'deposit_50']);
for (const label of ['Contra entrega', 'Transferencia', 'Anticipo 50%']) {
    assert.ok(optionBlock[1].includes(`label: '${label}'`), `Missing the ${label} label.`);
}

const communeBlock = purchases.match(/const SANTIAGO_COMMUNES = Object\.freeze\(\[([\s\S]*?)\]\);/);
assert.ok(communeBlock, 'The commune list must be available to checkout and tenant shipping setup.');
const communes = [...communeBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
assert.equal(communes.length, 52);
assert.equal(new Set(communes).size, 52);
assert.ok(communes.includes('Puente Alto') && communes.includes('Vitacura'));

const helperStart = purchases.indexOf('function calculatePaymentAmounts(');
const helperEnd = purchases.indexOf('\n    function getSelectedPaymentMethod()', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'Payment calculation helper must remain available.');
const context = {};
vm.runInNewContext(`${purchases.slice(helperStart, helperEnd)}\nglobalThis.calculatePaymentAmounts = calculatePaymentAmounts;`, context);
assert.deepEqual(JSON.parse(JSON.stringify(context.calculatePaymentAmounts('cash_on_delivery', 20000, 2, 5000))), {
    productSubtotal: 40000, totalWithShipping: 45000, amountDueNow: 0, balanceDue: 45000
});
assert.deepEqual(JSON.parse(JSON.stringify(context.calculatePaymentAmounts('bank_transfer', 20000, 2, 5000))), {
    productSubtotal: 40000, totalWithShipping: 45000, amountDueNow: 45000, balanceDue: 0
});
assert.deepEqual(JSON.parse(JSON.stringify(context.calculatePaymentAmounts('deposit_50', 101, 1, 5000))), {
    productSubtotal: 101, totalWithShipping: 5101, amountDueNow: 51, balanceDue: 5050
});

assert.match(migration, /add column if not exists payment_methods text\[\]/i);
assert.match(migration, /payment_method = any\(product_row\.payment_methods\)/i);
assert.match(migration, /create table if not exists public\.store_payment_details/i);
assert.match(migration, /create policy "Owners manage store payment details"/i);
assert.match(ui, /payment_methods: paymentMethods/);
assert.match(purchases, /payment_method: paymentMethod/);

function makeElement(tagName) {
    const element = {
        tagName,
        className: '',
        textContent: '',
        value: '',
        disabled: false,
        children: [],
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        append(...children) {
            this.children.push(...children);
        },
        set innerHTML(value) {
            this.children = [];
            this._innerHTML = value;
        },
        get innerHTML() {
            return this._innerHTML || '';
        },
        get firstElementChild() {
            return this.children[0] || null;
        }
    };
    return element;
}

const shippingTable = makeElement('div');
const communeSelect = makeElement('select');
const purchaseButton = makeElement('button');
const shippingElements = {
    'purchase-shipping-table': shippingTable,
    'purchase-delivery-commune': communeSelect,
    'purchase-submit': purchaseButton
};
const renderContext = {
    document: {
        createElement: makeElement,
        getElementById: (id) => shippingElements[id]
    },
    SANTIAGO_COMMUNES: communes,
    createElement: (tag, text = '', className = '') => {
        const element = makeElement(tag);
        element.textContent = text == null ? '' : String(text);
        element.className = className;
        return element;
    },
    formatCurrency: (value) => `$${value}`
};
const renderStart = purchases.indexOf('    function renderShippingRates(');
const renderEnd = purchases.indexOf('\n    function updatePurchaseShippingSummary(', renderStart);
assert.ok(renderStart >= 0 && renderEnd > renderStart, 'Shipping-rate renderer must remain available.');
vm.runInNewContext(`${purchases.slice(renderStart, renderEnd)}\nglobalThis.renderShippingRates = renderShippingRates;`, renderContext);
renderContext.renderShippingRates([]);
assert.equal(communeSelect.disabled, false, 'The commune selector stays enabled when the tenant has no rates yet.');
assert.equal(communeSelect.children.length, 53, 'All 52 communes remain available beside the placeholder.');
assert.ok(communeSelect.children.slice(1).every((option) => !option.disabled), 'No-rate communes remain selectable.');
assert.equal(purchaseButton.disabled, true, 'A purchase cannot be sent without a shipping price.');

renderContext.renderShippingRates([{commune: 'Providencia', shipping_cost: 2500}]);
assert.equal(communeSelect.disabled, false);
assert.ok(communeSelect.children.slice(1).every((option) => !option.disabled), 'Communes remain selectable while rates are partial.');
assert.match(communeSelect.children.find((option) => option.value === 'Vitacura').textContent, /Sin despacho configurado/);

const shippingSummary = makeElement('p');
const selectedCommune = makeElement('select');
selectedCommune.value = 'Vitacura';
const summaryButton = makeElement('button');
let paymentSummaryUpdated = false;
const summaryContext = {
    document: {
        getElementById: (id) => ({
            'purchase-delivery-commune': selectedCommune,
            'purchase-shipping-summary': shippingSummary,
            'purchase-submit': summaryButton
        })[id]
    },
    purchaseState: {rates: [{commune: 'Providencia', shipping_cost: 2500}]},
    updatePurchasePaymentSummary: () => { paymentSummaryUpdated = true; }
};
const summaryStart = purchases.indexOf('    function updatePurchaseShippingSummary(');
const summaryEnd = purchases.indexOf('\n    async function loadPurchaseRates(', summaryStart);
assert.ok(summaryStart >= 0 && summaryEnd > summaryStart, 'Shipping summary updater must remain available.');
vm.runInNewContext(`${purchases.slice(summaryStart, summaryEnd)}\nglobalThis.updatePurchaseShippingSummary = updatePurchaseShippingSummary;`, summaryContext);
summaryContext.updatePurchaseShippingSummary();
assert.match(shippingSummary.textContent, /no ha configurado el costo de despacho para Vitacura/i);
assert.equal(summaryButton.disabled, true);
assert.equal(paymentSummaryUpdated, true, 'Payment details refresh when the selected commune has no rate.');

const loadingTable = makeElement('div');
const loadingSelect = makeElement('select');
loadingSelect.disabled = true;
const loadingSubmit = makeElement('button');
loadingSubmit.disabled = false;
const pendingQuery = {
    select() { return this; },
    eq() { return this; },
    order() { return this; },
    then() {}
};
const loadingState = {requestId: 7, rates: [], ratesLoading: false};
const loadingContext = {
    document: {
        getElementById: (id) => ({
            'purchase-shipping-table': loadingTable,
            'purchase-delivery-commune': loadingSelect,
            'purchase-submit': loadingSubmit
        })[id]
    },
    purchaseState: loadingState,
    getClient: () => ({from: () => pendingQuery}),
    scopeQuery: (query) => query,
    renderShippingRates() {},
    setPurchaseStatus() {},
    console: {warn() {}}
};
const loadStart = purchases.indexOf('    async function loadPurchaseRates(');
const loadEnd = purchases.indexOf('\n    function applyDefaultDeliveryCommune(', loadStart);
assert.ok(loadStart >= 0 && loadEnd > loadStart, 'Purchase-rate loader must remain available.');
vm.runInNewContext(`${purchases.slice(loadStart, loadEnd)}\nglobalThis.loadPurchaseRates = loadPurchaseRates;`, loadingContext);
loadingContext.loadPurchaseRates({storeId: 'S-107'}, 7);
assert.equal(loadingSelect.disabled, false, 'The commune selector stays enabled while rates are loading.');
assert.equal(loadingSubmit.disabled, true, 'The purchase remains blocked until a shipping rate is known.');
assert.equal(loadingState.ratesLoading, true);

console.log('Product payment options, 52 RM communes, shipping selection during loading, payment amounts, bank details, and order validation are wired.');
