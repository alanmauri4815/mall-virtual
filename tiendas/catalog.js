(() => {
  'use strict';

  const SUPABASE_URL = 'https://kcfuixvrwbnizspgtmtr.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_-H23KD1xJafE_DFpBFZlyA_CL9sNlpG';
  const mall = window.mallContext;
  const client = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const state = {
    stores: [], products: [], mode: 'products', category: 'all', query: '', sort: 'recommended',
    priceMin: null, priceMax: null, storeCode: '', productFacetsAvailable: false,
    originType: '', availability: '', deliveryOptions: [], focusBeforeDialog: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const codeKey = (value) => String(value || '').trim().toUpperCase();
  const readPriceAmounts = (value) => Array.from(String(value ?? '').matchAll(/\d[\d.,]*/g), (match) => {
    const amount = Number(match[0].replace(/\D/g, ''));
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  }).filter(Boolean);
  const readPriceBound = (value) => value === '' || !Number.isFinite(Number(value)) ? null : Math.max(0, Math.floor(Number(value)));
  const formatClp = (amount) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);
  const formatPrice = (value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const amounts = readPriceAmounts(raw);
    if (!amounts.length) return raw;
    const prefix = raw.match(/^\s*(desde(?:\s+los)?)\b/i)?.[1] || '';
    const suffix = raw
      .replace(/^\s*desde(?:\s+los)?\b/i, '')
      .replace(/\d[\d.,]*/g, '')
      .replace(/[$€–—-]/g, '')
      .replace(/[.:]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const priceLabel = amounts.slice(0, 2).map(formatClp).join(' – ');
    const prefixLabel = prefix ? `${prefix[0].toUpperCase()}${prefix.slice(1).toLowerCase()} ` : '';
    return `${prefixLabel}${priceLabel}${suffix ? ` · ${suffix}` : ''}`;
  };
  const safeImage = (value) => {
    try {
      const url = new URL(String(value || ''), window.location.href);
      return url.protocol === 'https:' ? url.href : '';
    } catch (_) { return ''; }
  };
  const getStoreName = (store) => {
    const name = String(store?.name || '').trim();
    const code = String(store?.local_code || '').trim();
    return name && normalize(name) !== normalize(code) ? name : `Local ${code || 'del mall'}`;
  };
  const getCategory = (store, product = null) => {
    const explicitCategory = String(product?.product_category || '').trim();
    if (explicitCategory) return explicitCategory;
    const source = normalize([store?.category, product?.name, product?.description].filter(Boolean).join(' '));
    if (/alimento|bebida|comida|cafe|cafeteria|dulce|pastel|panader|snack|gastronom/.test(source)) return 'Alimentos';
    if (/tecnolog|electron|parlante|audio|computador|celular|cable|cargador|gadget/.test(source)) return 'Tecnología';
    if (/belleza|cosmetic|maquill|peluquer|perfume|piel|cabello|estetica|aromatizador|aroma/.test(source)) return 'Belleza y cuidado';
    if (/ropa|vestuario|confeccion|zapato|calzado|lenceria|tejido|joya|joyeria|bisuter|accesorio|bolso|cartera/.test(source)) return 'Ropa y accesorios';
    if (/hogar|cocina|mueble|decor|cortina|vajilla|iluminacion/.test(source)) return 'Hogar';
    if (/terapia|coaching|servicio|asesoria|consulta|reparacion|masaje/.test(source)) return 'Servicios';
    if (/arte|artesan|pintad|figura|regalo|manualidad|orgone|gema/.test(source)) return 'Arte y regalos';
    const category = String(store?.category || '').trim();
    return category && !['por definir', 'comercio'].includes(normalize(category)) ? category : 'Otros';
  };
  const getWhatsappNumber = (value) => {
    const match = String(value || '').match(/\+?\d{8,15}/);
    if (!match) return '';
    let number = match[0].replace(/\D/g, '');
    if (number.length === 9 && number.startsWith('9')) number = `56${number}`;
    return number;
  };
  const getContact = (store, text) => {
    const phone = getWhatsappNumber(store?.whatsapp);
    if (phone) return { href: `https://wa.me/${phone}?text=${encodeURIComponent(text)}`, label: 'Consultar por WhatsApp', external: true };
    const contact = String(store?.contact_phone || '').replace(/[^+\d]/g, '');
    if (contact) return { href: `tel:${contact}`, label: 'Llamar al local', external: false };
    const email = String(store?.contact_email || '').trim();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { href: `mailto:${email}?subject=${encodeURIComponent('Consulta desde Mall Providencia')}`, label: 'Escribir al local', external: false };
    }
    return null;
  };
  function setCount(selector, value) {
    const element = $(selector);
    if (element) element.textContent = new Intl.NumberFormat('es-CL').format(value);
  }

  function renderCounts() {
    setCount('[data-store-count]', state.stores.length);
    setCount('[data-product-count]', state.products.length);
    setCount('[data-tab-product-count]', state.products.length);
    setCount('[data-tab-store-count]', state.stores.length);
  }

  function currentCategories() {
    const values = state.mode === 'products'
      ? state.products.map((item) => item.category)
      : state.stores.map((item) => item.catalogCategory);
    return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'es'));
  }

  function renderCategories() {
    const container = $('[data-categories]');
    const categories = currentCategories();
    if (state.category !== 'all' && !categories.includes(state.category)) state.category = 'all';
    const chips = [{ id: 'all', label: 'Todo' }, ...categories.map((name) => ({ id: name, label: name }))];
    container.innerHTML = chips.map(({ id, label }) => `<button class="category-chip${state.category === id ? ' is-active' : ''}" type="button" data-category="${escapeHtml(id)}" aria-pressed="${state.category === id}">${escapeHtml(label)}</button>`).join('');
  }

  function renderStoreOptions() {
    const select = $('[data-store-filter]');
    const storesWithProducts = state.stores.filter((store) => store.products.length);
    if (state.storeCode && !storesWithProducts.some((store) => codeKey(store.local_code || store.id) === state.storeCode)) state.storeCode = '';
    select.innerHTML = `<option value="">Todas las tiendas</option>${storesWithProducts.map((store) => {
      const code = codeKey(store.local_code || store.id);
      return `<option value="${escapeHtml(code)}">${escapeHtml(store.displayName)}</option>`;
    }).join('')}`;
    select.value = state.storeCode;
  }

  function matchesQuery(item, mode) {
    if (!state.query) return true;
    if (mode === 'products') {
      return normalize([item.name, item.description, item.storeName, item.storeCode, item.category].join(' ')).includes(state.query);
    }
    return normalize([item.displayName, item.local_code, item.category, ...item.products.map((product) => product.name)].join(' ')).includes(state.query);
  }

  function getVisibleItems() {
    if (state.mode === 'stores') {
      return state.stores.filter((store) => (state.category === 'all' || store.catalogCategory === state.category) && matchesQuery(store, 'stores'));
    }
    const invalidPriceRange = state.priceMin !== null && state.priceMax !== null && state.priceMin > state.priceMax;
    const priceFilterActive = state.priceMin !== null || state.priceMax !== null;
    const items = state.products.filter((product) => {
      if (state.category !== 'all' && product.category !== state.category) return false;
      if (state.storeCode && product.storeKey !== state.storeCode) return false;
      if (state.originType && product.origin_type !== state.originType) return false;
      if (state.availability && product.availability_status !== state.availability) return false;
      if (state.deliveryOptions.length && !state.deliveryOptions.some((option) => (product.delivery_options || []).includes(option))) return false;
      if (!matchesQuery(product, 'products') || invalidPriceRange) return false;
      if (!priceFilterActive) return true;
      if (product.priceMin === null) return false;
      return (state.priceMax === null || product.priceMin <= state.priceMax)
        && (state.priceMin === null || product.priceMax >= state.priceMin);
    });
    if (state.sort === 'newest') {
      return items.sort((a, b) => {
        const dateA = Date.parse(a.created_at);
        const dateB = Date.parse(b.created_at);
        const timeA = Number.isFinite(dateA) ? dateA : -Infinity;
        const timeB = Number.isFinite(dateB) ? dateB : -Infinity;
        return (timeB - timeA) || ((a.sort_order || 0) - (b.sort_order || 0));
      });
    }
    if (state.sort === 'price-asc' || state.sort === 'price-desc') {
      const direction = state.sort === 'price-asc' ? 1 : -1;
      return items.sort((a, b) => (a.priceValue == null ? 1 : b.priceValue == null ? -1 : (a.priceValue - b.priceValue) * direction));
    }
    if (state.sort === 'name') return items.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return items;
  }

  function productCard(product) {
    const image = safeImage(product.image_url);
    const price = formatPrice(product.price);
    return `<button class="product-card" type="button" data-open-product="${escapeHtml(product.id)}" aria-label="Ver ${escapeHtml(product.name)} de ${escapeHtml(product.storeName)}">
      <span class="product-image-wrap${image ? '' : ' is-missing'}">
        ${image ? `<img class="product-image" src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy" data-image-fallback>` : ''}
        <span class="product-image-fallback" aria-hidden="true"><span>M</span></span>
        <span class="product-shop-tag">${escapeHtml(product.storeName)}</span>
      </span>
      <span class="product-info">
        <span class="product-category">${escapeHtml(product.category)}</span>
        <span class="product-name">${escapeHtml(product.name)}</span>
        <span class="product-price${price ? '' : ' is-query'}">${price || 'Consultar precio'}</span>
      </span>
    </button>`;
  }

  function storeCard(store) {
    const logo = safeImage(store.logo_url);
    const initials = getStoreName(store).split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
    const count = store.products.length;
    return `<article class="store-card">
      <span class="store-logo-wrap">
        ${logo ? `<img class="store-logo" src="${escapeHtml(logo)}" alt="" loading="lazy" data-image-fallback>` : `<span class="store-logo-fallback" aria-hidden="true">${escapeHtml(initials || 'M')}</span>`}
      </span>
      <div class="store-copy">
        <span class="store-code">Local ${escapeHtml(store.local_code || 'Mall')}</span>
        <span class="store-name">${escapeHtml(store.displayName)}</span>
        <span class="store-category">${escapeHtml(store.category || store.catalogCategory)}</span>
        <span class="store-actions"><span class="store-product-count">${count ? `${count} ${count === 1 ? 'producto' : 'productos'}` : 'Catálogo en preparación'}</span><button type="button" class="store-open" data-open-store="${escapeHtml(store.local_code || store.id)}">Ver tienda &#8594;</button></span>
      </div>
    </article>`;
  }

  function render() {
    renderCategories();
    renderStoreOptions();
    const grid = $('[data-grid]');
    const empty = $('[data-empty]');
    const items = getVisibleItems();
    const isProducts = state.mode === 'products';
    $('[data-category-label]').textContent = isProducts ? 'Tipo de producto' : 'Tipo de tienda';
    $('[data-categories]').setAttribute('aria-label', isProducts ? 'Filtrar por tipo de producto' : 'Filtrar por tipo de tienda');
    grid.classList.toggle('product-grid', isProducts);
    grid.classList.toggle('store-grid', !isProducts);
    grid.innerHTML = items.map((item) => isProducts ? productCard(item) : storeCard(item)).join('');
    grid.hidden = !items.length;
    empty.hidden = Boolean(items.length);
    $('[data-results-count]').textContent = isProducts
      ? `${items.length} ${items.length === 1 ? 'producto' : 'productos'}`
      : `${items.length} ${items.length === 1 ? 'tienda' : 'tiendas'}`;
    const invalidPriceRange = state.priceMin !== null && state.priceMax !== null && state.priceMin > state.priceMax;
    const hasFilters = state.query || state.category !== 'all' || state.priceMin !== null || state.priceMax !== null || state.storeCode || state.originType || state.availability || state.deliveryOptions.length;
    $('[data-clear]').hidden = !hasFilters;
    $('[data-catalog-title]').textContent = isProducts ? 'Productos para explorar' : 'Tiendas del mall';
    $('[data-catalog-kicker]').textContent = isProducts ? 'DESCUBRE EL MALL' : 'COMPRA LOCAL';
    $('[data-sort-wrap]').hidden = !isProducts;
    $('[data-product-filters]').hidden = !isProducts;
    $('[data-structured-filter-panel]').hidden = !isProducts || !state.productFacetsAvailable;
    $('[data-origin-filter]').value = state.originType;
    $('[data-availability-filter]').value = state.availability;
    $$('[data-delivery-filter]').forEach((input) => { input.checked = state.deliveryOptions.includes(input.value); });
    $('[data-price-error]').hidden = !invalidPriceRange;
    $('[data-price-error]').textContent = invalidPriceRange ? 'El precio mínimo debe ser menor o igual al máximo.' : '';
    $('[data-empty-title]').textContent = state.query || hasFilters ? 'No encontramos resultados' : 'Todavía no hay productos aquí';
    $('[data-empty-copy]').textContent = invalidPriceRange
      ? 'Corrige el rango de precio seleccionado.'
      : state.priceMin !== null || state.priceMax !== null
        ? 'No hay productos con precio dentro de ese rango.'
        : state.storeCode
          ? 'Esta tienda todavía no tiene productos que coincidan con los filtros.'
          : state.originType || state.availability || state.deliveryOptions.length
            ? 'No hay productos que coincidan con estas opciones. Prueba con otro filtro.'
          : state.query || state.category !== 'all'
            ? 'Prueba con otra búsqueda o cambia los filtros seleccionados.'
            : 'Esta categoría no tiene publicaciones por ahora.';
    $$('[data-price-range]').forEach((button) => {
      const [minValue, maxValue] = button.dataset.priceRange.split(':');
      const min = readPriceBound(minValue);
      const max = readPriceBound(maxValue);
      const active = state.priceMin === min && state.priceMax === max && (min !== null || max !== null);
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $$('[data-mode]').forEach((button) => {
      const active = button.dataset.mode === state.mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    $$('[data-mode-link]').forEach((button) => button.classList.toggle('is-current', button.dataset.modeLink === state.mode));
    $('[data-grid]').setAttribute('aria-busy', 'false');
    $('[data-load-state]').hidden = true;
  }

  function applyImageFallback(root = document) {
    $$('[data-image-fallback]', root).forEach((image) => {
      image.addEventListener('error', () => {
        image.hidden = true;
        image.closest('.product-image-wrap, .store-logo-wrap, .dialog-image-wrap')?.classList.add('is-missing');
      }, { once: true });
      if (image.complete && image.naturalWidth === 0) image.dispatchEvent(new Event('error'));
    });
  }

  function findProduct(id) { return state.products.find((product) => String(product.id) === String(id)); }
  function findStore(code) { return state.stores.find((store) => codeKey(store.local_code || store.id) === codeKey(code)); }

  function showDialog(content) {
    const backdrop = $('[data-dialog-backdrop]');
    state.focusBeforeDialog = document.activeElement;
    $('[data-dialog-content]').innerHTML = content;
    backdrop.hidden = false;
    document.body.classList.add('dialog-open');
    $('[data-dialog]').focus();
    applyImageFallback(backdrop);
  }

  function closeDialog() {
    $('[data-dialog-backdrop]').hidden = true;
    document.body.classList.remove('dialog-open');
    state.focusBeforeDialog?.focus?.();
  }

  function openProduct(product) {
    if (!product) return;
    const image = safeImage(product.image_url);
    const price = formatPrice(product.price);
    const contact = getContact(product.store, `Hola, vi ${product.name} en la vitrina de Mall Providencia. ¿Me puedes contar más?`);
    const contactAction = contact
      ? `<a class="action-primary" href="${escapeHtml(contact.href)}"${contact.external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(contact.label)}</a>`
      : '<span class="action-secondary">Contacto del local no disponible</span>';
    const originLabels = { own_made: 'Elaboración propia', commercialized: 'Comercialización' };
    const availabilityLabels = { in_stock: 'En stock', made_to_order: 'Por encargo', contact: 'Consultar disponibilidad' };
    const deliveryLabels = { mall_pickup: 'Retiro en mall', local_delivery: 'Despacho local', nationwide_shipping: 'Envíos nacionales' };
    const facts = [
      originLabels[product.origin_type],
      availabilityLabels[product.availability_status],
      ...(Array.isArray(product.delivery_options) ? product.delivery_options.map((option) => deliveryLabels[option]).filter(Boolean) : [])
    ].filter(Boolean);
    showDialog(`<div class="dialog-image-wrap${image ? '' : ' is-missing'}">
      ${image ? `<img class="dialog-image" src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" data-image-fallback>` : ''}
      <span class="dialog-image-fallback" aria-hidden="true">M</span>
    </div>
    <div class="dialog-copy">
      <p class="dialog-kicker">${escapeHtml(product.category)} · ${escapeHtml(product.storeName)}</p>
      <h2 id="detail-title">${escapeHtml(product.name)}</h2>
      <p class="dialog-price${price ? '' : ' product-price is-query'}">${price || 'Consultar precio'}</p>
      ${product.description ? `<p class="dialog-description">${escapeHtml(product.description)}</p>` : '<p class="dialog-description">Consulta los detalles y disponibilidad directamente con la tienda.</p>'}
      ${facts.length ? `<ul class="product-facts" aria-label="Información del producto">${facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join('')}</ul>` : ''}
      <button class="dialog-store-link" type="button" data-open-store="${escapeHtml(product.storeCode)}">Ver todos los productos de ${escapeHtml(product.storeName)} &#8594;</button>
      <div class="dialog-actions">${contactAction}</div>
    </div>`);
  }

  function openStore(store) {
    if (!store) return;
    const logo = safeImage(store.logo_url);
    const contact = getContact(store, `Hola, encontré ${store.displayName} en la vitrina de Mall Providencia. ¿Me pueden ayudar?`);
    const contactAction = contact
      ? `<a class="action-primary" href="${escapeHtml(contact.href)}"${contact.external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(contact.label)}</a>`
      : '<span class="action-secondary">Contacto del local no disponible</span>';
    const related = store.products.length
      ? `<div class="store-related"><h3>Productos de este local</h3><div class="related-grid">${store.products.slice(0, 8).map((product) => `<button type="button" class="related-product" data-open-product="${escapeHtml(product.id)}">${safeImage(product.image_url) ? `<img src="${escapeHtml(safeImage(product.image_url))}" alt="" loading="lazy">` : '<span class="store-logo-fallback">M</span>'}<span>${escapeHtml(product.name)}</span></button>`).join('')}</div></div>`
      : `<div class="store-related"><h3>Catálogo en preparación</h3><p class="store-description">Este local todavía no tiene productos publicados en la vitrina.</p></div>`;
    showDialog(`<div class="detail-store">
      <span class="store-logo-wrap">${logo ? `<img class="store-logo" src="${escapeHtml(logo)}" alt="" data-image-fallback>` : `<span class="store-logo-fallback" aria-hidden="true">${escapeHtml(store.displayName.split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase())}</span>`}</span>
      <div class="store-copy">
        <p class="dialog-kicker">Local ${escapeHtml(store.local_code || 'Mall')}</p>
        <h2 class="store-name" id="detail-title">${escapeHtml(store.displayName)}</h2>
        <p class="store-category">${escapeHtml(store.category || store.catalogCategory)}</p>
        ${store.address ? `<p class="store-description">${escapeHtml(store.address)}</p>` : ''}
        <div class="dialog-actions">${contactAction}</div>
      </div>
      ${related}
    </div>`);
  }

  function clearFilters() {
    state.query = '';
    state.category = 'all';
    state.priceMin = null;
    state.priceMax = null;
    state.storeCode = '';
    state.originType = '';
    state.availability = '';
    state.deliveryOptions = [];
    $('#catalog-search').value = '';
    $('[data-price-min]').value = '';
    $('[data-price-max]').value = '';
    $('[data-origin-filter]').value = '';
    $('[data-availability-filter]').value = '';
    render();
  }

  function updateMode(mode) {
    state.mode = mode === 'stores' ? 'stores' : 'products';
    state.category = 'all';
    render();
  }

  function attachEvents() {
    $('[data-search-form]').addEventListener('submit', (event) => {
      event.preventDefault();
      state.query = normalize($('#catalog-search').value);
      render();
      $('#catalog').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('#catalog-search').addEventListener('input', (event) => {
      state.query = normalize(event.target.value);
      render();
    });
    $('[data-sort]').addEventListener('change', (event) => { state.sort = event.target.value; render(); });
    $('[data-price-min]').addEventListener('input', (event) => { state.priceMin = readPriceBound(event.target.value); render(); });
    $('[data-price-max]').addEventListener('input', (event) => { state.priceMax = readPriceBound(event.target.value); render(); });
    $('[data-store-filter]').addEventListener('change', (event) => { state.storeCode = codeKey(event.target.value); render(); });
    $('[data-origin-filter]').addEventListener('change', (event) => { state.originType = event.target.value; render(); });
    $('[data-availability-filter]').addEventListener('change', (event) => { state.availability = event.target.value; render(); });
    $$('[data-delivery-filter]').forEach((input) => input.addEventListener('change', () => {
      state.deliveryOptions = $$('[data-delivery-filter]:checked').map((option) => option.value);
      render();
    }));
    document.addEventListener('click', (event) => {
      const modeButton = event.target.closest('[data-mode], [data-mode-link]');
      if (modeButton) { updateMode(modeButton.dataset.mode || modeButton.dataset.modeLink); return; }
      const categoryButton = event.target.closest('[data-category]');
      if (categoryButton) { state.category = categoryButton.dataset.category; render(); return; }
      const priceRangeButton = event.target.closest('[data-price-range]');
      if (priceRangeButton) {
        const [min, max] = priceRangeButton.dataset.priceRange.split(':');
        state.priceMin = readPriceBound(min);
        state.priceMax = readPriceBound(max);
        $('[data-price-min]').value = min;
        $('[data-price-max]').value = max;
        render();
        return;
      }
      const productButton = event.target.closest('[data-open-product]');
      if (productButton) { openProduct(findProduct(productButton.dataset.openProduct)); return; }
      const storeButton = event.target.closest('[data-open-store]');
      if (storeButton) { openStore(findStore(storeButton.dataset.openStore)); return; }
      if (event.target.closest('[data-clear], [data-clear-empty]')) { clearFilters(); return; }
      if (event.target.closest('[data-dialog-close]') || event.target === $('[data-dialog-backdrop]')) closeDialog();
    });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('[data-dialog-backdrop]').hidden) closeDialog(); });
  }

  async function loadCatalog() {
    const loadState = $('[data-load-state]');
    if (!client || !mall) {
      loadState.textContent = 'No pudimos conectar con el catálogo.';
      loadState.classList.add('is-error');
      return;
    }
    try {
      const storesQuery = mall.scopeQuery(client.from('stores').select('*'));
      const productsQuery = mall.scopeQuery(client.from('store_products').select('*').order('sort_order', { ascending: true }));
      const facetsQuery = mall.scopeQuery(client.from('store_products')
        .select('product_category, origin_type, availability_status, delivery_options')
        .limit(1));
      const [storesResult, productsResult, facetsResult] = await Promise.all([storesQuery, productsQuery, facetsQuery]);
      if (storesResult.error) throw storesResult.error;
      if (productsResult.error) throw productsResult.error;
      state.productFacetsAvailable = !facetsResult.error;

      const stores = (storesResult.data || []).filter((store) => {
        const status = normalize(store.service_status);
        const name = normalize(store.name);
        return store.local_code && status !== 'suspended' && status !== 'inactive' && !name.startsWith('ancla ');
      });
      const storeByCode = new Map();
      stores.forEach((store) => {
        storeByCode.set(codeKey(store.local_code), store);
        if (store.id) storeByCode.set(codeKey(store.id), store);
      });
      const mappedStores = stores.map((store) => ({
        ...store,
        displayName: getStoreName(store),
        products: [],
        catalogCategory: getCategory(store)
      }));
      const mappedById = new Map(mappedStores.map((store) => [codeKey(store.local_code || store.id), store]));
      const products = (productsResult.data || []).map((product) => {
        const store = storeByCode.get(codeKey(product.local_code)) || storeByCode.get(codeKey(product.store_id));
        if (!store) return null;
        const mappedStore = mappedById.get(codeKey(store.local_code || store.id));
        if (!mappedStore) return null;
        const priceAmounts = readPriceAmounts(product.price);
        const priceMin = priceAmounts.length ? Math.min(...priceAmounts) : null;
        const priceMax = priceAmounts.length ? Math.max(...priceAmounts) : null;
        return {
          ...product,
          store,
          storeCode: store.local_code || store.id,
          storeKey: codeKey(store.local_code || store.id),
          storeName: getStoreName(store),
          category: getCategory(store, product),
          priceMin,
          priceMax,
          priceValue: priceMin
        };
      }).filter(Boolean);
      products.forEach((product) => mappedById.get(product.storeKey)?.products.push(product));
      mappedStores.forEach((store) => {
        if (!store.category || normalize(store.category) === 'por definir') {
          const categoryCount = store.products.map((product) => product.category).reduce((counts, category) => {
            counts[category] = (counts[category] || 0) + 1;
            return counts;
          }, {});
          const bestCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0]?.[0];
          if (bestCategory) store.catalogCategory = bestCategory;
        } else {
          store.catalogCategory = getCategory(store);
        }
      });
      state.stores = mappedStores.sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));
      state.products = products;
      renderCounts();
      render();
      applyImageFallback();
    } catch (error) {
      console.error('No se pudo cargar la vitrina del mall.', error);
      loadState.textContent = 'No se pudo cargar el catálogo. Actualiza la página para intentarlo nuevamente.';
      loadState.classList.add('is-error');
      $('[data-grid]').setAttribute('aria-busy', 'false');
    }
  }

  attachEvents();
  loadCatalog();
})();
