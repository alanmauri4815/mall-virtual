(function installMallContext() {
    const PROVIDENCIA_MALL_ID = '713c1740-0621-4fd7-98e6-fac2a93e4781';
    const ENSAYO_MALL_ID = '4a5ed5cf-6f03-4e7d-8fbb-3d01e151586d';
    const configuredMalls = Object.freeze({
        providencia: Object.freeze({
            id: PROVIDENCIA_MALL_ID,
            slug: 'providencia',
            displayName: 'Mall Providencia',
            commune: 'Providencia',
            status: 'draft',
            templateVersion: 'mall-shared-v1'
        }),
        ensayo: Object.freeze({
            id: ENSAYO_MALL_ID,
            slug: 'ensayo',
            displayName: 'Mall de Ensayo',
            commune: 'Entorno de pruebas',
            status: 'testing',
            templateVersion: 'mall-shared-v1'
        })
    });
    const hostMallSlugs = Object.freeze({
        'maucore.cl': 'providencia',
        'www.maucore.cl': 'providencia',
        'mall-virtual-one-mu.vercel.app': 'ensayo'
    });

    const normalizeSlug = (value) => String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 80);

    const requestedSlug = normalizeSlug(new URLSearchParams(window.location.search).get('mall'));
    const hostSlug = hostMallSlugs[String(window.location.hostname || '').toLowerCase()] || '';
    const activeMall = configuredMalls[requestedSlug] || configuredMalls[hostSlug] || configuredMalls.providencia;
    const ignoredMallRequest = Boolean(requestedSlug && !configuredMalls[requestedSlug]);

    const context = Object.freeze({
        id: activeMall.id,
        slug: activeMall.slug,
        displayName: activeMall.displayName,
        commune: activeMall.commune,
        status: activeMall.status,
        templateVersion: activeMall.templateVersion,
        key: `mall:${activeMall.id}`,
        isDefault: activeMall.slug === 'providencia',
        storageKey(name) {
            return `${this.key}:${String(name || '').replace(/^mall:/, '')}`;
        },
        channelName(name) {
            const prefix = String(name || 'mall').replace(/[^a-zA-Z0-9_-]/g, '_');
            return `${prefix}:${activeMall.slug}`;
        },
        scopeQuery(query) {
            return query.eq('mall_id', this.id);
        },
        scopePayload(payload) {
            return { ...payload, mall_id: this.id };
        },
        toJSON() {
            return {
                id: this.id,
                slug: this.slug,
                displayName: this.displayName,
                commune: this.commune,
                status: this.status,
                templateVersion: this.templateVersion
            };
        }
    });

    window.mallContext = context;
    window.mallContextRegistry = configuredMalls;
    // Temporary safety pause while bench seating is being validated.
    // Flip this back to true to restore visitor and NPC sitting without removing its implementation.
    window.mallFeatureFlags = Object.freeze({ benchSeatingEnabled: false });
    document.documentElement.dataset.mallSlug = context.slug;
    document.documentElement.dataset.mallContextReady = 'true';
    document.querySelectorAll('[data-mall-context-name]').forEach((element) => {
        element.textContent = context.displayName;
    });
    window.mallContextReady = Promise.resolve(context);

    if (ignoredMallRequest) {
        console.warn(`Mall no configurado: ${requestedSlug}. Se usara ${context.slug}.`);
    }
})();
