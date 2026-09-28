(function installMallPurchases() {
    const PAYMENT_OPTIONS = Object.freeze([
        { value: 'cash_on_delivery', label: 'Contra entrega' },
        { value: 'bank_transfer', label: 'Transferencia' },
        { value: 'deposit_50', label: 'Anticipo 50%' }
    ]);
    const PAYMENT_LABELS = Object.freeze(Object.fromEntries(PAYMENT_OPTIONS.map((option) => [option.value, option.label])));
    const DEFAULT_PAYMENT_METHODS = Object.freeze(['cash_on_delivery']);
    const SANTIAGO_COMMUNES = Object.freeze([
        'Alhué', 'Buin', 'Calera de Tango', 'Cerrillos', 'Cerro Navia', 'Colina', 'Conchalí', 'Curacaví',
        'El Bosque', 'El Monte', 'Estación Central', 'Huechuraba', 'Independencia', 'Isla de Maipo',
        'La Cisterna', 'La Florida', 'La Granja', 'La Pintana', 'La Reina', 'Lampa', 'Las Condes',
        'Lo Barnechea', 'Lo Espejo', 'Lo Prado', 'Macul', 'Maipú', 'María Pinto', 'Melipilla', 'Ñuñoa',
        'Padre Hurtado', 'Paine', 'Pedro Aguirre Cerda', 'Peñaflor', 'Peñalolén', 'Pirque', 'Providencia',
        'Pudahuel', 'Puente Alto', 'Quilicura', 'Quinta Normal', 'Recoleta', 'Renca', 'San Bernardo',
        'San Joaquín', 'San José de Maipo', 'San Miguel', 'San Pedro', 'San Ramón', 'Santiago',
        'Talagante', 'Tiltil', 'Vitacura'
    ]);
    const PAYMENT_METHOD_HELP = Object.freeze({
        cash_on_delivery: 'No pagas ahora. Coordinas el pago con el local al recibir el producto y el despacho.',
        bank_transfer: 'Transfieres el total del producto y el despacho. Los datos bancarios del local aparecerán abajo.',
        deposit_50: 'Transfieres ahora el 50% del valor de los productos. El saldo y el despacho se pagan al recibir.'
    });
    const ORDER_STATUS_LABELS = Object.freeze({
        pending_store_confirmation: 'Pendiente de confirmación',
        accepted: 'Aceptada',
        preparing: 'Preparando',
        out_for_delivery: 'En despacho',
        delivered: 'Entregada',
        cancelled: 'Cancelada'
    });

    const purchaseState = {
        requestId: 0,
        product: null,
        rates: [],
        ratesLoading: false,
        user: null,
        defaultDeliveryCommune: '',
        tenantStore: null,
        tenantShippingRates: [],
        tenantShippingOriginal: [],
        tenantPaymentDetails: null,
        paymentDetailsLoadedForStore: '',
        paymentDetailsRequestId: 0,
        tenantPaymentDetailsRequestId: 0
    };

    const getClient = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    const scopeQuery = (query) => window.mallContext?.scopeQuery
        ? window.mallContext.scopeQuery(query)
        : query;
    const scopePayload = (payload) => window.mallContext?.scopePayload
        ? window.mallContext.scopePayload(payload)
        : payload;

    function createElement(tag, text = '', className = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined && text !== null) element.textContent = String(text);
        return element;
    }

    function formatCurrency(value) {
        const amount = Number(value || 0);
        if (!Number.isFinite(amount) || amount <= 0) return 'Gratis';
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            maximumFractionDigits: 0
        }).format(amount);
    }

    function normalizePaymentMethods(methods) {
        if (!Array.isArray(methods)) return [...DEFAULT_PAYMENT_METHODS];
        const valid = PAYMENT_OPTIONS.map((option) => option.value).filter((value) => methods.includes(value));
        return valid.length ? valid : [...DEFAULT_PAYMENT_METHODS];
    }

    function parseClpAmount(value) {
        if (/\bUF\b/i.test(String(value ?? ''))) return null;
        const digits = String(value ?? '').replace(/[^0-9]/g, '');
        if (!digits) return null;
        const amount = Number(digits);
        return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
    }

    function calculatePaymentAmounts(method, unitPrice, quantity, shippingCost) {
        const safeQuantity = Math.min(20, Math.max(1, Number(quantity) || 1));
        const productSubtotal = (Number(unitPrice) || 0) * safeQuantity;
        const shipping = Math.max(0, Number(shippingCost) || 0);
        const totalWithShipping = productSubtotal + shipping;
        const amountDueNow = method === 'bank_transfer'
            ? totalWithShipping
            : method === 'deposit_50' ? Math.round(productSubtotal * 0.5) : 0;
        return {
            productSubtotal,
            totalWithShipping,
            amountDueNow,
            balanceDue: Math.max(0, totalWithShipping - amountDueNow)
        };
    }

    function getSelectedPaymentMethod() {
        return document.querySelector('input[name="payment_method"]:checked')?.value || '';
    }

    function renderPurchasePaymentOptions(product) {
        const container = document.getElementById('purchase-payment-methods');
        if (!container) return;
        const methods = normalizePaymentMethods(product?.paymentMethods || product?.payment_methods);
        container.innerHTML = '';
        methods.forEach((value, index) => {
            const option = PAYMENT_OPTIONS.find((entry) => entry.value === value);
            if (!option) return;
            const label = createElement('label', '', 'purchase-payment-option');
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'payment_method';
            input.value = option.value;
            input.required = true;
            input.checked = index === 0;
            const copy = createElement('span', option.label);
            label.append(input, copy);
            container.appendChild(label);
            input.addEventListener('change', updatePurchasePaymentSummary);
        });
        updatePurchasePaymentSummary();
    }

    function renderPurchaseBankDetails(details) {
        const container = document.getElementById('purchase-bank-details');
        if (!container) return;
        container.innerHTML = '';
        if (!details) {
            container.hidden = false;
            container.appendChild(createElement('p', 'Este local aún no ha registrado sus datos de transferencia. Elige otra alternativa o contacta al local.', 'purchase-muted'));
            return;
        }
        container.hidden = false;
        container.appendChild(createElement('strong', 'Datos de transferencia'));
        const fields = [
            ['Titular', details.account_holder_name],
            ['RUT', details.account_holder_rut],
            ['Banco', details.bank_name],
            ['Tipo de cuenta', details.account_type],
            ['Número de cuenta', details.account_number],
            ['Correo para comprobante', details.transfer_email]
        ];
        const grid = createElement('div', '', 'purchase-bank-details-grid');
        fields.filter(([, value]) => String(value || '').trim()).forEach(([label, value]) => {
            const row = createElement('p', '', 'purchase-bank-details-item');
            row.append(createElement('span', label), createElement('b', value));
            grid.appendChild(row);
        });
        container.appendChild(grid);
    }

    async function loadPurchaseBankDetails(product, requestId) {
        const container = document.getElementById('purchase-bank-details');
        const client = getClient();
        if (!container || !client || !product?.storeId) return;
        const detailRequestId = ++purchaseState.paymentDetailsRequestId;
        purchaseState.paymentDetailsLoadedForStore = String(product.storeId);
        container.hidden = false;
        container.textContent = 'Cargando datos de transferencia...';
        const result = await scopeQuery(client
            .from('store_payment_details')
            .select('account_holder_name, account_holder_rut, bank_name, account_type, account_number, transfer_email')
            .eq('store_id', String(product.storeId))
            .eq('is_active', true)
            .maybeSingle());
        if (requestId !== purchaseState.requestId || detailRequestId !== purchaseState.paymentDetailsRequestId) return;
        if (result.error) {
            renderPurchaseBankDetails(null);
            console.warn('No pude cargar los datos bancarios del local:', result.error.message);
            return;
        }
        purchaseState.tenantPaymentDetails = result.data || null;
        renderPurchaseBankDetails(purchaseState.tenantPaymentDetails);
    }

    function updatePurchasePaymentSummary() {
        const summary = document.getElementById('purchase-payment-summary');
        const details = document.getElementById('purchase-bank-details');
        if (!summary) return;
        const method = getSelectedPaymentMethod();
        const quantity = Math.min(20, Math.max(1, Number(document.getElementById('purchase-quantity')?.value || 1)));
        const unitPrice = parseClpAmount(purchaseState.product?.p);
        const selectedCommune = document.getElementById('purchase-delivery-commune')?.value || '';
        const selectedRate = purchaseState.rates.find((rate) => rate.commune === selectedCommune);
        const shipping = selectedRate?.shipping_cost;
        const amounts = calculatePaymentAmounts(method, unitPrice, quantity, Number.isFinite(shipping) ? shipping : 0);
        const label = PAYMENT_LABELS[method] || 'Selecciona un método de pago';
        let explanation = PAYMENT_METHOD_HELP[method] || 'Elige un método de pago habilitado por el local.';
        if (selectedCommune && !selectedRate) {
            explanation += purchaseState.ratesLoading
                ? ` Estamos consultando la tarifa de despacho para ${selectedCommune}. No podrás enviar la solicitud hasta confirmar el costo.`
                : ` El local aún no ha configurado una tarifa de despacho para ${selectedCommune}; no podrás enviar la solicitud hasta que lo haga.`;
        }
        if (unitPrice !== null && method === 'bank_transfer') {
            explanation += Number.isFinite(shipping)
                ? ' Total a transferir: ' + formatCurrency(amounts.amountDueNow) + '.'
                : ' El despacho se suma según la comuna elegida.';
        } else if (unitPrice !== null && method === 'deposit_50') {
            explanation += ' Anticipo estimado: ' + formatCurrency(amounts.amountDueNow) + '.';
            if (Number.isFinite(shipping)) explanation += ' Saldo más despacho al recibir: ' + formatCurrency(amounts.balanceDue) + '.';
        }
        summary.innerHTML = '';
        summary.append(createElement('strong', label), createElement('span', explanation));
        const needsBankDetails = method === 'bank_transfer' || method === 'deposit_50';
        if (details) details.hidden = !needsBankDetails;
        if (needsBankDetails && purchaseState.paymentDetailsLoadedForStore !== String(purchaseState.product?.storeId || '')) {
            loadPurchaseBankDetails(purchaseState.product, purchaseState.requestId);
        } else if (needsBankDetails) {
            renderPurchaseBankDetails(purchaseState.tenantPaymentDetails);
        }
    }

    function setPurchaseStatus(message, kind = '') {
        const status = document.getElementById('purchase-status');
        if (!status) return;
        status.textContent = message || '';
        status.dataset.kind = kind;
    }

    function ensurePurchaseModal() {
        let modal = document.getElementById('purchase-modal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'purchase-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'purchase-title');
        modal.innerHTML = `
            <button type="button" class="purchase-close" aria-label="Cerrar formulario de compra">&times;</button>
            <div class="purchase-header">
                <p class="purchase-kicker">Solicitud de compra</p>
                <h2 id="purchase-title">Completa tus datos de despacho</h2>
                <p id="purchase-store-name" class="purchase-store-name"></p>
            </div>
            <div class="purchase-product-summary">
                <div>
                    <span class="purchase-summary-label">Producto</span>
                    <strong id="purchase-product-name"></strong>
                </div>
                <div>
                    <span class="purchase-summary-label">Precio publicado</span>
                    <strong id="purchase-product-price"></strong>
                </div>
            </div>
            <section class="purchase-shipping-section" aria-labelledby="purchase-shipping-title">
                <h3 id="purchase-shipping-title">Costos de despacho de este local</h3>
                <div id="purchase-shipping-table" class="purchase-shipping-table-wrap">
                    <p class="purchase-muted">Cargando tarifas...</p>
                </div>
            </section>
            <form id="purchase-form" class="purchase-form">
                <div class="purchase-form-heading">
                    <h3>Datos del comprador y despacho</h3>
                    <p id="purchase-profile-hint">Puedes completar estos datos manualmente.</p>
                </div>
                <div class="purchase-form-grid">
                    <label>Nombre completo
                        <input id="purchase-buyer-name" name="buyer_name" type="text" maxlength="120" autocomplete="name" required>
                    </label>
                    <label>Correo electrónico
                        <input id="purchase-buyer-email" name="buyer_email" type="email" maxlength="160" autocomplete="email" required>
                    </label>
                    <label>Celular
                        <input id="purchase-buyer-phone" name="buyer_phone" type="tel" maxlength="30" autocomplete="tel" inputmode="tel" placeholder="Ej: +56912345678" required>
                    </label>
                    <label>Comuna de despacho
                        <select id="purchase-delivery-commune" name="delivery_commune" required disabled>
                            <option value="">Selecciona una comuna</option>
                        </select>
                    </label>
                    <label class="purchase-form-wide">Dirección de despacho
                        <input id="purchase-delivery-address" name="delivery_address" type="text" maxlength="240" autocomplete="street-address" placeholder="Calle, número, departamento o referencia" required>
                    </label>
                    <label class="purchase-form-wide">Observaciones para el despacho (opcional)
                        <textarea id="purchase-buyer-note" name="buyer_note" maxlength="600" rows="3" placeholder="Ej: entregar en conserjería, llamar antes de llegar..."></textarea>
                    </label>
                    <fieldset class="purchase-payment-options purchase-form-wide">
                        <legend>Elige una alternativa de pago</legend>
                        <div id="purchase-payment-methods" class="purchase-payment-method-list"></div>
                    </fieldset>
                    <div id="purchase-payment-summary" class="purchase-payment-notice purchase-form-wide" aria-live="polite"></div>
                    <div id="purchase-bank-details" class="purchase-bank-details purchase-form-wide" hidden></div>
                    <label>Cantidad
                        <input id="purchase-quantity" name="quantity" type="number" min="1" max="20" value="1" required>
                    </label>
                </div>
                <div id="purchase-shipping-summary" class="purchase-shipping-summary">Selecciona una comuna para ver el despacho.</div>
                <button type="submit" id="purchase-submit" class="purchase-submit" disabled>Solicitar compra</button>
                <p id="purchase-status" class="purchase-status" aria-live="polite"></p>
                <section id="purchase-receipt" class="purchase-receipt" aria-live="polite" hidden>
                    <h3>Comprobante de solicitud</h3>
                    <p class="purchase-receipt-reference">Referencia <strong id="purchase-receipt-reference"></strong></p>
                    <dl class="purchase-receipt-totals">
                        <div><dt>Producto</dt><dd id="purchase-receipt-product"></dd></div>
                        <div><dt id="purchase-receipt-product-price-label">Precio del producto</dt><dd id="purchase-receipt-product-price"></dd></div>
                        <div><dt>Precio de despacho</dt><dd id="purchase-receipt-shipping"></dd></div>
                        <div class="purchase-receipt-total"><dt>Total referencial</dt><dd id="purchase-receipt-total"></dd></div>
                    </dl>
                    <p class="purchase-receipt-note">La solicitud queda sujeta a confirmación del local. No se realizó ningún pago en el Mall. Este comprobante es informativo y no es un documento tributario.</p>
                </section>
            </form>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.purchase-close')?.addEventListener('click', closePurchaseForm);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closePurchaseForm();
        });
        modal.querySelector('#purchase-form')?.addEventListener('submit', submitPurchase);
        modal.querySelector('#purchase-delivery-commune')?.addEventListener('change', updatePurchaseShippingSummary);
        modal.querySelector('#purchase-quantity')?.addEventListener('input', updatePurchasePaymentSummary);
        return modal;
    }

    function closePurchaseForm() {
        const modal = document.getElementById('purchase-modal');
        if (modal) modal.style.display = 'none';
    }
    window.closePurchaseForm = closePurchaseForm;

    function renderShippingRates(rates = []) {
        const tableContainer = document.getElementById('purchase-shipping-table');
        const select = document.getElementById('purchase-delivery-commune');
        const submit = document.getElementById('purchase-submit');
        if (!tableContainer || !select || !submit) return;

        const selectedCommune = select.value;
        tableContainer.innerHTML = '';
        select.innerHTML = '';
        select.appendChild(createElement('option', 'Selecciona una comuna'));
        select.firstElementChild.value = '';

        if (!rates.length) {
            tableContainer.appendChild(createElement('p', 'Este local aún no ha configurado costos de despacho.', 'purchase-muted'));
            SANTIAGO_COMMUNES.forEach((commune) => {
                const option = createElement('option', commune);
                option.value = commune;
                select.appendChild(option);
            });
            if (SANTIAGO_COMMUNES.includes(selectedCommune)) select.value = selectedCommune;
            select.disabled = false;
            submit.disabled = true;
            return;
        }

        const table = document.createElement('table');
        table.className = 'purchase-shipping-table';
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.appendChild(createElement('th', 'Comuna'));
        headerRow.appendChild(createElement('th', 'Costo de despacho'));
        thead.appendChild(headerRow);
        const tbody = document.createElement('tbody');
        const ratesByCommune = new Map(rates.map((rate) => [rate.commune.toLocaleLowerCase('es-CL'), rate]));
        rates.forEach((rate) => {
            const row = document.createElement('tr');
            row.appendChild(createElement('td', rate.commune));
            row.appendChild(createElement('td', formatCurrency(rate.shipping_cost)));
            tbody.appendChild(row);
        });
        SANTIAGO_COMMUNES.forEach((commune) => {
            const rate = ratesByCommune.get(commune.toLocaleLowerCase('es-CL'));
            const option = createElement('option', rate
                ? `${commune} - ${formatCurrency(rate.shipping_cost)}`
                : `${commune} - Sin despacho configurado`);
            option.value = commune;
            select.appendChild(option);
        });
        if (SANTIAGO_COMMUNES.includes(selectedCommune)) select.value = selectedCommune;
        table.append(thead, tbody);
        tableContainer.appendChild(table);
        select.disabled = false;
        submit.disabled = true;
    }

    function updatePurchaseShippingSummary() {
        const select = document.getElementById('purchase-delivery-commune');
        const summary = document.getElementById('purchase-shipping-summary');
        const submit = document.getElementById('purchase-submit');
        if (!select || !summary || !submit) return;
        const commune = select.value;
        const rate = purchaseState.rates.find((entry) => entry.commune === commune);
        if (!rate) {
            summary.textContent = commune
                ? (purchaseState.ratesLoading
                    ? `Consultando el costo de despacho para ${commune}...`
                    : `El local aún no ha configurado el costo de despacho para ${commune}. Contacta al local para coordinar la entrega.`)
                : (purchaseState.ratesLoading
                    ? 'Elige una comuna mientras se cargan las tarifas de despacho.'
                    : purchaseState.rates.length
                    ? 'Selecciona una comuna para ver el costo de despacho.'
                    : 'Elige una comuna. Este local aún debe configurar sus tarifas de despacho.');
            submit.disabled = true;
            updatePurchasePaymentSummary();
            return;
        }
        summary.textContent = `Despacho a ${rate.commune}: ${formatCurrency(rate.shipping_cost)}.`;
        submit.disabled = false;
        updatePurchasePaymentSummary();
    }

    async function loadPurchaseRates(product, requestId) {
        const client = getClient();
        const table = document.getElementById('purchase-shipping-table');
        const select = document.getElementById('purchase-delivery-commune');
        const submit = document.getElementById('purchase-submit');
        if (!client || !product?.storeId) {
            purchaseState.rates = [];
            purchaseState.ratesLoading = false;
            renderShippingRates([]);
            setPurchaseStatus('No se pudo identificar el local para cargar sus tarifas.', 'error');
            return;
        }

        if (table) table.innerHTML = '<p class="purchase-muted">Cargando tarifas...</p>';
        if (select) select.disabled = false;
        if (submit) submit.disabled = true;
        purchaseState.ratesLoading = true;

        const result = await scopeQuery(client
            .from('store_shipping_rates')
            .select('id, commune, shipping_cost, is_active')
            .eq('store_id', String(product.storeId))
            .eq('is_active', true)
            .order('commune', { ascending: true }));
        if (requestId !== purchaseState.requestId) return;
        purchaseState.ratesLoading = false;
        if (result.error) {
            purchaseState.rates = [];
            renderShippingRates([]);
            setPurchaseStatus('No se pudieron cargar las tarifas. El local debe configurar su tabla de despacho.', 'error');
            console.warn('No pude cargar tarifas de despacho:', result.error.message);
            return;
        }

        purchaseState.rates = (result.data || []).map((rate) => ({
            id: rate.id,
            commune: String(rate.commune || '').trim(),
            shipping_cost: Number(rate.shipping_cost || 0)
        })).filter((rate) => rate.commune);
        purchaseState.rates = purchaseState.rates.filter((rate) => SANTIAGO_COMMUNES.some((commune) => commune.toLocaleLowerCase('es-CL') === rate.commune.toLocaleLowerCase('es-CL')));
        renderShippingRates(purchaseState.rates);
        applyDefaultDeliveryCommune();
        updatePurchaseShippingSummary();
        if (!purchaseState.rates.length) {
            setPurchaseStatus('Este local todavía no ha configurado comunas de despacho.', 'warning');
        } else {
            setPurchaseStatus('', '');
        }
    }

    function applyDefaultDeliveryCommune() {
        const select = document.getElementById('purchase-delivery-commune');
        if (!select || !purchaseState.defaultDeliveryCommune) return;
        const wanted = purchaseState.defaultDeliveryCommune.toLowerCase();
        const match = purchaseState.rates.find((rate) => rate.commune.toLowerCase() === wanted);
        if (!match) return;
        select.value = SANTIAGO_COMMUNES.find((commune) => commune.toLowerCase() === wanted) || '';
        updatePurchaseShippingSummary();
    }

    async function loadBuyerDefaults(requestId) {
        const client = getClient();
        if (!client) return;
        const { data: authData } = await client.auth.getUser();
        if (requestId !== purchaseState.requestId) return;
        const user = authData?.user || null;
        purchaseState.user = user;
        if (!user) {
            document.getElementById('purchase-profile-hint').textContent = 'Como visitante, completa tus datos para coordinar el despacho.';
            return;
        }

        const [memberResult, profileResult] = await Promise.all([
            client.from('mall_members').select('nickname, email, phone, default_delivery_address, default_delivery_commune').eq('auth_user_id', user.id).maybeSingle(),
            client.from('user_profiles').select('display_name, email').eq('auth_user_id', user.id).maybeSingle()
        ]);
        if (requestId !== purchaseState.requestId) return;
        const member = memberResult.data || {};
        const profile = profileResult.data || {};
        const metadata = user.user_metadata || {};
        const name = member.nickname || profile.display_name || metadata.nickname || '';
        const email = user.email || member.email || profile.email || '';
        const phone = member.phone || metadata.phone || '';
        purchaseState.defaultDeliveryCommune = member.default_delivery_commune || '';
        document.getElementById('purchase-buyer-name').value = name;
        document.getElementById('purchase-buyer-email').value = email;
        document.getElementById('purchase-buyer-phone').value = phone;
        document.getElementById('purchase-delivery-address').value = member.default_delivery_address || '';
        applyDefaultDeliveryCommune();
        document.getElementById('purchase-profile-hint').textContent = 'Completamos estos datos desde tu cuenta inscrita. Puedes corregirlos antes de enviar la solicitud.';
    }

    async function openPurchaseForm(product = {}) {
        const modal = ensurePurchaseModal();
        const form = document.getElementById('purchase-form');
        if (!modal || !form) return;

        purchaseState.requestId += 1;
        const requestId = purchaseState.requestId;
        purchaseState.product = product;
        purchaseState.rates = [];
        purchaseState.ratesLoading = false;
        purchaseState.user = null;
        purchaseState.defaultDeliveryCommune = '';
        purchaseState.tenantPaymentDetails = null;
        purchaseState.paymentDetailsLoadedForStore = '';
        purchaseState.paymentDetailsRequestId += 1;
        form.reset();
        document.getElementById('purchase-receipt').hidden = true;
        const submit = document.getElementById('purchase-submit');
        submit.disabled = true;
        submit.textContent = 'Solicitar compra';
        document.getElementById('purchase-store-name').textContent = product.storeName ? `Local: ${product.storeName}` : '';
        document.getElementById('purchase-product-name').textContent = product.n || 'Producto';
        document.getElementById('purchase-product-price').textContent = product.p || 'Consultar';
        document.getElementById('purchase-profile-hint').textContent = 'Puedes completar estos datos manualmente.';
        setPurchaseStatus('', '');
        renderPurchasePaymentOptions(product);
        renderShippingRates([]);
        modal.style.display = 'block';
        document.getElementById('purchase-buyer-name')?.focus();

        await Promise.all([
            loadPurchaseRates(product, requestId),
            loadBuyerDefaults(requestId)
        ]);
    }
    window.openPurchaseForm = openPurchaseForm;

    async function submitPurchase(event) {
        event.preventDefault();
        const client = getClient();
        const form = event.currentTarget;
        const product = purchaseState.product;
        const selectedRate = purchaseState.rates.find((rate) => rate.commune === document.getElementById('purchase-delivery-commune')?.value);
        const paymentMethod = getSelectedPaymentMethod();
        if (!client || !product?.storeId || !selectedRate) {
            setPurchaseStatus('Selecciona una comuna de despacho antes de continuar.', 'error');
            return;
        }
        if (!normalizePaymentMethods(product.paymentMethods || product.payment_methods).includes(paymentMethod)) {
            setPurchaseStatus('Ese método de pago no está habilitado para este producto.', 'error');
            return;
        }
        if (!form.reportValidity()) return;

        const { data: authData } = await client.auth.getUser();
        const user = authData?.user || purchaseState.user || null;
        const quantity = Math.min(20, Math.max(1, Number(document.getElementById('purchase-quantity')?.value || 1)));
        const unitPrice = parseClpAmount(product.p);
        if (paymentMethod !== 'cash_on_delivery' && unitPrice === null) {
            setPurchaseStatus('Este producto no tiene un precio numérico para calcular la transferencia. Contacta al local o elige contra entrega.', 'error');
            return;
        }
        if (paymentMethod !== 'cash_on_delivery' && !purchaseState.tenantPaymentDetails) {
            setPurchaseStatus('El local aún no ha registrado datos de transferencia. Elige contra entrega o contacta al local.', 'error');
            return;
        }
        const paymentAmounts = calculatePaymentAmounts(paymentMethod, unitPrice, quantity, selectedRate.shipping_cost);
        const orderId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const payload = scopePayload({
            id: orderId,
            store_id: String(product.storeId),
            product_id: product.id ?? null,
            buyer_auth_user_id: user?.id || null,
            buyer_name: document.getElementById('purchase-buyer-name').value.trim(),
            buyer_email: document.getElementById('purchase-buyer-email').value.trim(),
            buyer_phone: document.getElementById('purchase-buyer-phone').value.trim(),
            delivery_address: document.getElementById('purchase-delivery-address').value.trim(),
            delivery_commune: selectedRate.commune,
            product_name: String(product.n || 'Producto').trim(),
            product_price: String(product.p || '').trim(),
            quantity,
            shipping_cost: selectedRate.shipping_cost,
            buyer_note: document.getElementById('purchase-buyer-note').value.trim() || null,
            payment_method: paymentMethod,
            payment_amount_due_now: paymentAmounts.amountDueNow,
            payment_balance_due: paymentAmounts.balanceDue,
            status: 'pending_store_confirmation'
        });

        const submit = document.getElementById('purchase-submit');
        submit.disabled = true;
        submit.textContent = 'Enviando solicitud...';
        setPurchaseStatus('', '');
        const { error } = await client.from('store_orders').insert(payload);
        if (error) {
            submit.disabled = false;
            submit.textContent = 'Solicitar compra';
            setPurchaseStatus(`No se pudo enviar la solicitud: ${error.message}`, 'error');
            return;
        }

        if (user) {
            await client.from('mall_members').update({
                default_delivery_address: payload.delivery_address,
                default_delivery_commune: payload.delivery_commune,
                updated_at: new Date().toISOString()
            }).eq('auth_user_id', user.id);
        }

        submit.textContent = 'Solicitud enviada';
        submit.disabled = true;
        document.getElementById('purchase-receipt-reference').textContent = orderId.slice(0, 8);
        document.getElementById('purchase-receipt-product').textContent = String(product.n || 'Producto');
        document.getElementById('purchase-receipt-product-price-label').textContent = unitPrice === null
            ? `Precio del producto (${quantity} unidades)`
            : `Precio del producto (${quantity} × ${formatCurrency(unitPrice)})`;
        document.getElementById('purchase-receipt-product-price').textContent = unitPrice === null
            ? 'Por confirmar con el local'
            : formatCurrency(paymentAmounts.productSubtotal);
        document.getElementById('purchase-receipt-shipping').textContent = formatCurrency(selectedRate.shipping_cost);
        document.getElementById('purchase-receipt-total').textContent = unitPrice === null
            ? 'Por confirmar con el local'
            : formatCurrency(paymentAmounts.totalWithShipping);
        document.getElementById('purchase-receipt').hidden = false;
        setPurchaseStatus(`Solicitud ${orderId.slice(0, 8)} enviada. El local revisará el despacho y te contactará. Método: ${PAYMENT_LABELS[paymentMethod]}.`, 'success');
        window.mallAnalytics?.track('purchase_requested', {
            orderId,
            storeCode: product.storeCode,
            productId: product.id,
            source: 'product_detail',
            paymentMethod
        });
    }

    function setTenantShippingStatus(message, kind = '') {
        const status = document.getElementById('tenant-shipping-status');
        if (!status) return;
        status.textContent = message || '';
        status.dataset.kind = kind;
    }

    function setTenantPaymentDetailsStatus(message, kind = '') {
        const status = document.getElementById('tenant-payment-details-status');
        if (!status) return;
        status.textContent = message || '';
        status.dataset.kind = kind;
    }

    function readTenantPaymentDetailsFromDom() {
        return {
            account_holder_name: String(document.getElementById('tenant-payment-holder')?.value || '').trim(),
            account_holder_rut: String(document.getElementById('tenant-payment-rut')?.value || '').trim(),
            bank_name: String(document.getElementById('tenant-payment-bank')?.value || '').trim(),
            account_type: String(document.getElementById('tenant-payment-account-type')?.value || '').trim(),
            account_number: String(document.getElementById('tenant-payment-account-number')?.value || '').trim(),
            transfer_email: String(document.getElementById('tenant-payment-email')?.value || '').trim()
        };
    }

    async function loadTenantPaymentDetails(store) {
        const client = getClient();
        if (!client || !store?.id) return;
        const requestId = ++purchaseState.tenantPaymentDetailsRequestId;
        ['tenant-payment-holder', 'tenant-payment-rut', 'tenant-payment-bank', 'tenant-payment-account-type', 'tenant-payment-account-number', 'tenant-payment-email']
            .forEach((id) => { const input = document.getElementById(id); if (input) input.value = ''; });
        const result = await scopeQuery(client
            .from('store_payment_details')
            .select('account_holder_name, account_holder_rut, bank_name, account_type, account_number, transfer_email')
            .eq('store_id', String(store.id))
            .maybeSingle());
        if (requestId !== purchaseState.tenantPaymentDetailsRequestId) return;
        if (result.error) {
            setTenantPaymentDetailsStatus('No se pudieron cargar los datos. Ejecuta la migración de pagos en Supabase.', 'error');
            console.warn('No pude cargar los datos de transferencia:', result.error.message);
            return;
        }
        const details = result.data || {};
        const mapping = {
            account_holder_name: 'tenant-payment-holder',
            account_holder_rut: 'tenant-payment-rut',
            bank_name: 'tenant-payment-bank',
            account_type: 'tenant-payment-account-type',
            account_number: 'tenant-payment-account-number',
            transfer_email: 'tenant-payment-email'
        };
        Object.entries(mapping).forEach(([key, id]) => {
            const input = document.getElementById(id);
            if (input) input.value = details[key] || '';
        });
        setTenantPaymentDetailsStatus(result.data
            ? 'Datos guardados. Los compradores los verán al escoger Transferencia o Anticipo 50%.'
            : 'Aún no hay datos de transferencia guardados.', '');
    }
    window.loadTenantPaymentDetails = loadTenantPaymentDetails;

    window.saveTenantPaymentDetails = async function saveTenantPaymentDetails() {
        const client = getClient();
        const store = purchaseState.tenantStore;
        if (!client || !store?.id) return setTenantPaymentDetailsStatus('No pude identificar el local.', 'error');
        const details = readTenantPaymentDetailsFromDom();
        if (!details.account_holder_name || !details.bank_name || !details.account_type || !details.account_number) {
            return setTenantPaymentDetailsStatus('Completa titular, banco, tipo y número de cuenta.', 'error');
        }
        const payload = scopePayload({
            ...details,
            store_id: String(store.id),
            is_active: true,
            updated_at: new Date().toISOString()
        });
        setTenantPaymentDetailsStatus('Guardando datos bancarios...', '');
        const result = await client.from('store_payment_details')
            .upsert(payload, { onConflict: 'mall_id,store_id' })
            .select('store_id')
            .single();
        if (result.error) {
            setTenantPaymentDetailsStatus(`No se pudieron guardar los datos: ${result.error.message}`, 'error');
            return;
        }
        setTenantPaymentDetailsStatus('Datos bancarios guardados. Ya se mostrarán a los compradores que elijan transferencia o anticipo.', 'success');
    };

    function renderTenantShippingRates(rates = []) {
        const list = document.getElementById('tenant-shipping-rate-list');
        if (!list) return;
        list.innerHTML = '';
        if (!rates.length) {
            list.appendChild(createElement('p', 'Agrega las comunas a las que despachas y su costo.', 'tenant-empty-message'));
            return;
        }

        rates.forEach((rate, index) => {
            const row = createElement('div', '', 'tenant-shipping-row');
            row.dataset.rateIndex = String(index);
            const communeLabel = createElement('label', 'Comuna');
            const commune = document.createElement('select');
            commune.className = 'tenant-admin-input';
            commune.dataset.shippingField = 'commune';
            commune.appendChild(createElement('option', 'Selecciona comuna'));
            commune.firstElementChild.value = '';
            SANTIAGO_COMMUNES.forEach((name) => {
                const option = createElement('option', name);
                option.value = name;
                option.selected = name.toLocaleLowerCase('es-CL') === rate.commune.toLocaleLowerCase('es-CL');
                commune.appendChild(option);
            });
            commune.value = rate.commune || '';
            communeLabel.appendChild(commune);
            const costLabel = createElement('label', 'Costo CLP');
            const cost = document.createElement('input');
            cost.type = 'number';
            cost.min = '0';
            cost.step = '1';
            cost.inputMode = 'numeric';
            cost.className = 'tenant-admin-input';
            cost.dataset.shippingField = 'shipping_cost';
            cost.value = String(Number(rate.shipping_cost || 0));
            costLabel.appendChild(cost);
            const remove = createElement('button', 'Quitar', 'tenant-shipping-remove');
            remove.type = 'button';
            remove.dataset.mallAction = 'removeTenantShippingRate';
            remove.dataset.rateIndex = String(index);
            row.append(communeLabel, costLabel, remove);
            list.appendChild(row);
        });
    }

    function populateTenantCommunePicker() {
        const select = document.getElementById('tenant-shipping-commune');
        if (!select || select.options.length > 1) return;
        SANTIAGO_COMMUNES.forEach((commune) => {
            const option = createElement('option', commune);
            option.value = commune;
            select.appendChild(option);
        });
    }

    function readTenantShippingRatesFromDom() {
        return Array.from(document.querySelectorAll('.tenant-shipping-row')).map((row) => ({
            id: purchaseState.tenantShippingRates[Number(row.dataset.rateIndex)]?.id || null,
            commune: String(row.querySelector('[data-shipping-field="commune"]')?.value || '').trim(),
            shipping_cost: Number(row.querySelector('[data-shipping-field="shipping_cost"]')?.value || 0)
        }));
    }

    async function loadTenantShippingRates(store) {
        const list = document.getElementById('tenant-shipping-rate-list');
        const client = getClient();
        if (!list || !client || !store?.id) return;
        populateTenantCommunePicker();
        purchaseState.tenantStore = store;
        list.innerHTML = '<p class="tenant-empty-message">Cargando tarifas...</p>';
        const result = await scopeQuery(client
            .from('store_shipping_rates')
            .select('id, commune, shipping_cost, is_active')
            .eq('store_id', String(store.id))
            .order('commune', { ascending: true }));
        if (result.error) {
            purchaseState.tenantShippingRates = [];
            purchaseState.tenantShippingOriginal = [];
            renderTenantShippingRates([]);
            setTenantShippingStatus('No se pudieron cargar las tarifas. Ejecuta la migración del sistema de compras en Supabase.', 'error');
            console.warn('No pude cargar tarifas del locatario:', result.error.message);
            return;
        }
        purchaseState.tenantShippingRates = (result.data || []).map((rate) => ({
            id: rate.id,
            commune: String(rate.commune || '').trim(),
            shipping_cost: Number(rate.shipping_cost || 0),
            is_active: rate.is_active !== false
        }));
        purchaseState.tenantShippingOriginal = purchaseState.tenantShippingRates.map((rate) => ({ ...rate }));
        renderTenantShippingRates(purchaseState.tenantShippingRates);
        setTenantShippingStatus('Puedes agregar, editar o quitar comunas. Recuerda guardar las tarifas.', '');
    }
    window.loadTenantShippingRates = loadTenantShippingRates;

    window.addTenantShippingRate = function addTenantShippingRate() {
        const communeInput = document.getElementById('tenant-shipping-commune');
        const costInput = document.getElementById('tenant-shipping-cost');
        const commune = String(communeInput?.value || '').trim();
        const cost = Number(costInput?.value || 0);
        if (!SANTIAGO_COMMUNES.some((name) => name.toLocaleLowerCase('es-CL') === commune.toLocaleLowerCase('es-CL'))) {
            return setTenantShippingStatus('Selecciona una comuna de la Región Metropolitana.', 'error');
        }
        if (!Number.isFinite(cost) || cost < 0) return setTenantShippingStatus('Ingresa un costo válido igual o mayor que cero.', 'error');
        const duplicate = purchaseState.tenantShippingRates.some((rate) => String(rate.commune).toLowerCase() === commune.toLowerCase());
        if (duplicate) return setTenantShippingStatus('Esa comuna ya está en la tabla.', 'error');
        purchaseState.tenantShippingRates.push({ id: null, commune, shipping_cost: Math.round(cost), is_active: true });
        renderTenantShippingRates(purchaseState.tenantShippingRates);
        communeInput.value = '';
        costInput.value = '';
        setTenantShippingStatus('Comuna agregada en el borrador. Pulsa “Guardar tarifas”.', '');
    };

    window.removeTenantShippingRate = function removeTenantShippingRate(index) {
        if (!Number.isInteger(index) || index < 0) return;
        purchaseState.tenantShippingRates = readTenantShippingRatesFromDom();
        purchaseState.tenantShippingRates.splice(index, 1);
        renderTenantShippingRates(purchaseState.tenantShippingRates);
        setTenantShippingStatus('Cambio pendiente de guardar.', '');
    };

    window.saveTenantShippingRates = async function saveTenantShippingRates() {
        const client = getClient();
        const store = purchaseState.tenantStore;
        if (!client || !store?.id) return setTenantShippingStatus('No pude identificar el local.', 'error');
        const rates = readTenantShippingRatesFromDom()
            .map((rate) => ({ ...rate, commune: rate.commune.trim(), shipping_cost: Math.round(rate.shipping_cost) }));
        const duplicateSet = new Set();
        for (const rate of rates) {
            const key = rate.commune.toLowerCase();
            if (!SANTIAGO_COMMUNES.some((commune) => commune.toLocaleLowerCase('es-CL') === key)) {
                return setTenantShippingStatus('Selecciona una comuna válida de la Región Metropolitana para cada tarifa.', 'error');
            }
            if (!Number.isFinite(rate.shipping_cost) || rate.shipping_cost < 0) {
                return setTenantShippingStatus('Revisa los costos: deben ser números iguales o mayores que cero.', 'error');
            }
            if (duplicateSet.has(key)) return setTenantShippingStatus('No puedes repetir una comuna.', 'error');
            duplicateSet.add(key);
        }

        setTenantShippingStatus('Guardando tarifas...', '');
        if (!rates.length) {
            const deleted = await scopeQuery(client.from('store_shipping_rates').delete().eq('store_id', String(store.id)));
            if (deleted.error) return setTenantShippingStatus(`No se pudieron borrar las tarifas: ${deleted.error.message}`, 'error');
            purchaseState.tenantShippingRates = [];
            purchaseState.tenantShippingOriginal = [];
            renderTenantShippingRates([]);
            return setTenantShippingStatus('Tarifas eliminadas. El local deberá configurar al menos una para recibir compras.', 'success');
        }

        const payload = rates.map((rate) => scopePayload({
            ...(rate.id ? { id: rate.id } : {}),
            store_id: String(store.id),
            commune: rate.commune,
            shipping_cost: rate.shipping_cost,
            is_active: true,
            updated_at: new Date().toISOString()
        }));
        const saved = await client
            .from('store_shipping_rates')
            .upsert(payload, { onConflict: 'mall_id,store_id,commune' })
            .select('id, commune, shipping_cost, is_active');
        if (saved.error) return setTenantShippingStatus(`No se pudieron guardar las tarifas: ${saved.error.message}`, 'error');

        const retainedIds = new Set(rates.filter((rate) => rate.id).map((rate) => String(rate.id)));
        const removedIds = purchaseState.tenantShippingOriginal
            .filter((rate) => rate.id && !retainedIds.has(String(rate.id)))
            .map((rate) => rate.id);
        if (removedIds.length) {
            const removed = await scopeQuery(client.from('store_shipping_rates').delete().in('id', removedIds));
            if (removed.error) return setTenantShippingStatus(`Las tarifas se guardaron, pero no se pudieron quitar algunas filas: ${removed.error.message}`, 'error');
        }

        purchaseState.tenantShippingRates = (saved.data || []).map((rate) => ({
            id: rate.id,
            commune: rate.commune,
            shipping_cost: Number(rate.shipping_cost || 0),
            is_active: rate.is_active !== false
        }));
        purchaseState.tenantShippingOriginal = purchaseState.tenantShippingRates.map((rate) => ({ ...rate }));
        renderTenantShippingRates(purchaseState.tenantShippingRates);
        setTenantShippingStatus('Tarifas guardadas. Los visitantes ya podrán verlas al comprar.', 'success');
    };

    function appendOrderField(container, label, value) {
        const item = createElement('div', '', 'tenant-order-field');
        item.appendChild(createElement('span', label));
        item.appendChild(createElement('strong', value || '-'));
        container.appendChild(item);
    }

    function renderTenantOrders(orders = []) {
        const list = document.getElementById('tenant-orders-list');
        const count = document.getElementById('tenant-orders-count');
        if (!list) return;
        if (count) count.textContent = String(orders.length);
        list.innerHTML = '';
        if (!orders.length) {
            list.appendChild(createElement('p', 'No hay solicitudes de compra.', 'tenant-empty-message'));
            return;
        }

        orders.forEach((order) => {
            const card = createElement('article', '', 'tenant-order-card');
            const header = createElement('div', '', 'tenant-order-card-header');
            const title = createElement('strong', order.product_name || 'Producto');
            const date = order.created_at ? new Date(order.created_at).toLocaleString('es-CL') : '';
            header.append(title, createElement('time', date));
            const body = createElement('div', '', 'tenant-order-grid');
            appendOrderField(body, 'Comprador', order.buyer_name);
            appendOrderField(body, 'Correo', order.buyer_email);
            appendOrderField(body, 'Celular', order.buyer_phone);
            appendOrderField(body, 'Producto', `${order.product_name} x${order.quantity || 1}`);
            appendOrderField(body, 'Dirección', `${order.delivery_address}, ${order.delivery_commune}`);
            appendOrderField(body, 'Despacho', formatCurrency(order.shipping_cost));
            const paymentLabel = PAYMENT_LABELS[order.payment_method] || 'Método no registrado';
            const paymentDue = Number(order.payment_amount_due_now || 0);
            appendOrderField(body, 'Pago', paymentDue > 0
                ? `${paymentLabel} · transferir ${formatCurrency(paymentDue)} ahora`
                : paymentLabel);
            if (Number(order.payment_balance_due || 0) > 0 && order.payment_method === 'deposit_50') {
                appendOrderField(body, 'Saldo más despacho al recibir', formatCurrency(order.payment_balance_due));
            }
            if (order.buyer_note) appendOrderField(body, 'Observación', order.buyer_note);

            const footer = createElement('div', '', 'tenant-order-card-footer');
            const statusLabel = createElement('label', 'Estado');
            const statusSelect = document.createElement('select');
            statusSelect.className = 'tenant-order-status';
            Object.entries(ORDER_STATUS_LABELS).forEach(([value, label]) => {
                const option = createElement('option', label);
                option.value = value;
                option.selected = value === order.status;
                statusSelect.appendChild(option);
            });
            statusSelect.addEventListener('change', () => window.updateTenantOrderStatus?.(order.id, statusSelect.value));
            statusLabel.appendChild(statusSelect);
            footer.appendChild(statusLabel);
            card.append(header, body, footer);
            list.appendChild(card);
        });
    }

    async function loadTenantStoreOrders(store) {
        const list = document.getElementById('tenant-orders-list');
        const client = getClient();
        if (!list || !client || !store?.id) return;
        list.innerHTML = '<p class="tenant-empty-message">Cargando solicitudes...</p>';
        const result = await scopeQuery(client
            .from('store_orders')
            .select('*')
            .eq('store_id', String(store.id))
            .order('created_at', { ascending: false })
            .limit(50));
        if (result.error) {
            renderTenantOrders([]);
            const count = document.getElementById('tenant-orders-count');
            if (count) count.textContent = '!';
            list.innerHTML = '';
            list.appendChild(createElement('p', 'No se pudo cargar la bandeja. Ejecuta la migración del sistema de compras en Supabase.', 'tenant-empty-message'));
            console.warn('No pude cargar pedidos del locatario:', result.error.message);
            return;
        }
        renderTenantOrders(result.data || []);
    }
    window.loadTenantStoreOrders = loadTenantStoreOrders;

    window.updateTenantOrderStatus = async function updateTenantOrderStatus(orderId, status) {
        const client = getClient();
        const store = purchaseState.tenantStore;
        if (!client || !store?.id || !ORDER_STATUS_LABELS[status]) return;
        const result = await scopeQuery(client
            .from('store_orders')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', orderId)
            .eq('store_id', String(store.id)));
        if (result.error) {
            alert(`No se pudo actualizar el estado: ${result.error.message}`);
            return;
        }
        await loadTenantStoreOrders(store);
    };

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && document.getElementById('purchase-modal')?.style.display === 'block') {
            closePurchaseForm();
        }
    });
})();
