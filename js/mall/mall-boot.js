(function redirectFileProtocolToLocalhost() {
    const localAppUrl = 'http://localhost:8080/';
    if (window.location.protocol !== 'file:') return;
    window.__mallFileProtocolWarning = 'La app esta abierta como archivo. Para usar Supabase y entrar como locatario abre ' + localAppUrl;
    fetch(localAppUrl, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' })
        .then(() => window.location.replace(localAppUrl))
        .catch(() => console.warn(window.__mallFileProtocolWarning));
})();

window.mallMobileViewport = (() => {
    document.getElementById('mobile-orientation-helper')?.remove();
    const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    const isIOS = () => /iPad|iPhone|iPod/i.test(navigator.userAgent || '')
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isIOSStandalone = () => isIOS() && (
        navigator.standalone === true
        || window.matchMedia?.('(display-mode: standalone)')?.matches === true
    );
    const getFullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
    const requestFullscreenFromGesture = () => {
        if (!isTouchDevice() || getFullscreenElement()) return Promise.resolve(false);
        const root = document.documentElement;
        if (typeof root?.requestFullscreen === 'function') {
            try {
                return root.requestFullscreen({ navigationUI: 'hide' })
                    .then(() => true)
                    .catch(() => false);
            } catch {
                return Promise.resolve(false);
            }
        }
        if (typeof root?.webkitRequestFullscreen === 'function') {
            try {
                return Promise.resolve(root.webkitRequestFullscreen()).then(() => true).catch(() => false);
            } catch {
                return Promise.resolve(false);
            }
        }
        return Promise.resolve(false);
    };
    const exitFullscreen = () => {
        if (!getFullscreenElement()) return Promise.resolve(false);
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (typeof exit !== 'function') return Promise.resolve(false);
        try {
            return Promise.resolve(exit.call(document)).then(() => true).catch(() => false);
        } catch {
            return Promise.resolve(false);
        }
    };
    const fullscreenButton = document.getElementById('mobile-fullscreen-toggle');
    const fullscreenStatus = document.getElementById('mobile-fullscreen-status');
    const fullscreenIcon = fullscreenButton?.querySelector('.material-symbols-outlined');
    let fullscreenStatusTimer = null;
    let fullscreenTransitionPending = false;

    const showFullscreenStatus = (message, duration = 6500) => {
        if (!fullscreenStatus) return;
        if (fullscreenStatusTimer) clearTimeout(fullscreenStatusTimer);
        fullscreenStatus.textContent = message;
        fullscreenStatus.hidden = false;
        fullscreenStatusTimer = setTimeout(() => {
            fullscreenStatus.hidden = true;
            fullscreenStatusTimer = null;
        }, duration);
    };

    const syncFullscreenButton = () => {
        if (!fullscreenButton) return;
        const active = Boolean(getFullscreenElement());
        const hidden = !isTouchDevice() || isIOSStandalone();
        const label = active ? 'Salir de pantalla completa' : 'Activar pantalla completa';
        fullscreenButton.hidden = hidden;
        fullscreenButton.classList.toggle('is-active', active);
        fullscreenButton.setAttribute('aria-hidden', String(hidden));
        fullscreenButton.setAttribute('aria-pressed', String(active));
        fullscreenButton.setAttribute('aria-label', label);
        fullscreenButton.title = label;
        if (fullscreenIcon) fullscreenIcon.textContent = active ? 'fullscreen_exit' : 'fullscreen';
    };

    const toggleFullscreen = async () => {
        if (!isTouchDevice() || fullscreenTransitionPending) return false;

        if (!getFullscreenElement() && /iPhone|iPod/i.test(navigator.userAgent || '') && !isIOSStandalone()) {
            showFullscreenStatus('En iPhone, abre el Mall en Safari, elige Compartir y luego “Añadir a pantalla de inicio”. Al abrirlo desde ese icono tendrás una vista sin las barras del navegador.');
            return false;
        }

        fullscreenTransitionPending = true;
        if (fullscreenButton) fullscreenButton.disabled = true;
        try {
            if (getFullscreenElement()) {
                const exited = await exitFullscreen();
                if (!exited) {
                    showFullscreenStatus('El navegador no permitió salir de pantalla completa.');
                    return false;
                }
                syncFullscreenButton();
                showFullscreenStatus('Pantalla completa desactivada.', 2200);
                return true;
            }

            if (
                typeof document.documentElement?.requestFullscreen !== 'function'
                && typeof document.documentElement?.webkitRequestFullscreen !== 'function'
            ) {
                showFullscreenStatus('Este navegador no admite pantalla completa para el Mall.');
                return false;
            }

            // Invoke the browser API directly in the tap's activation window.
            const entered = await requestFullscreenFromGesture();
            if (!entered) {
                showFullscreenStatus('El navegador no permitió activar pantalla completa. Vuelve a intentarlo o revisa sus permisos.');
                return false;
            }
            syncFullscreenButton();
            showFullscreenStatus('Pantalla completa activada.', 2200);
            return true;
        } finally {
            fullscreenTransitionPending = false;
            if (fullscreenButton) fullscreenButton.disabled = false;
            syncFullscreenButton();
        }
    };

    window.toggleMobileFullscreen = toggleFullscreen;
    document.addEventListener?.('fullscreenchange', syncFullscreenButton);
    document.addEventListener?.('webkitfullscreenchange', syncFullscreenButton);
    syncFullscreenButton();
    const getViewportSize = () => {
        const viewport = window.visualViewport;
        return {
            width: Number(viewport?.width) || window.innerWidth,
            height: Number(viewport?.height) || window.innerHeight
        };
    };
    const isLandscape = () => {
        const orientationType = window.screen?.orientation?.type || '';
        if (orientationType.startsWith('landscape')) return true;
        if (window.matchMedia?.('(orientation: landscape)').matches) return true;
        const viewport = getViewportSize();
        return viewport.width > viewport.height;
    };
    let mallSessionActive = false;
    let orientationSyncTimer = null;

    const updateState = () => {
        const active = mallSessionActive && isTouchDevice();
        document.body.classList.toggle('mobile-session-active', active);
        document.body.classList.toggle('mobile-landscape', active && isLandscape());
        document.body.classList.toggle('mobile-portrait', active && !isLandscape());
    };

    const activate = () => {
        mallSessionActive = true;
        updateState();
    };

    const syncOrientation = () => {
        updateState();
        syncFullscreenButton();
        if (orientationSyncTimer) clearTimeout(orientationSyncTimer);
        orientationSyncTimer = setTimeout(updateState, 250);
    };

    window.addEventListener('resize', syncOrientation, { passive: true });
    window.visualViewport?.addEventListener('resize', syncOrientation, { passive: true });
    window.addEventListener('orientationchange', () => {
        syncOrientation();
        setTimeout(updateState, 500);
    }, { passive: true });
    window.screen?.orientation?.addEventListener?.('change', syncOrientation);
    const orientationMedia = window.matchMedia?.('(orientation: landscape)');
    if (orientationMedia?.addEventListener) {
        orientationMedia.addEventListener('change', syncOrientation);
    } else {
        orientationMedia?.addListener?.(syncOrientation);
    }

    return { activate, updateState, isTouchDevice, isLandscape, requestFullscreenFromGesture, exitFullscreen, toggleFullscreen, syncFullscreenButton };
})();

// One page load needs the public catalog in several features. Share the
// in-flight requests so search, storefronts and central displays do not each
// download the same full dataset.
window.mallCatalogRequests = (() => {
    let storesRequest = null;
    let productsRequest = null;
    let requestContextKey = null;

    const getClient = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    const getContextKey = () => window.mallContext?.key || 'mall:unscoped';
    const scopeQuery = (query) => window.mallContext?.scopeQuery
        ? window.mallContext.scopeQuery(query)
        : query;
    const syncContext = () => {
        const nextContextKey = getContextKey();
        if (requestContextKey === nextContextKey) return;
        requestContextKey = nextContextKey;
        storesRequest = null;
        productsRequest = null;
    };
    const request = (current, select, clear) => {
        syncContext();
        if (current) return current;
        const client = getClient();
        if (!client) return Promise.reject(new Error('Supabase no disponible para el catálogo.'));
        const pending = select(client)
            .then(({ data, error }) => {
                if (error) throw error;
                return data || [];
            })
            .catch((error) => {
                clear();
                throw error;
            });
        return pending;
    };

    const getStores = () => {
        syncContext();
        storesRequest = request(storesRequest,
            (client) => scopeQuery(client.from('stores').select('*')),
            () => { storesRequest = null; });
        return storesRequest;
    };
    const getProducts = () => {
        syncContext();
        productsRequest = request(productsRequest,
            (client) => scopeQuery(client.from('store_products').select('*').order('sort_order', { ascending: true })),
            () => { productsRequest = null; });
        return productsRequest;
    };

    return {
        getStores,
        getProducts,
        async getData() {
            const [stores, products] = await Promise.all([getStores(), getProducts()]);
            return { stores, products };
        },
        invalidate({ stores = false, products = false } = {}) {
            syncContext();
            if (stores) storesRequest = null;
            if (products) productsRequest = null;
        }
    };
})();

window.addEventListener('DOMContentLoaded', () => {
    const callGlobal = (name, ...args) => {
        const fn = window[name];
        if (typeof fn !== 'function') {
            console.warn(`Accion del mall no disponible: ${name}`);
            return;
        }
        fn(...args);
    };

    const entryActions = {
        recoverMember: () => callGlobal('openPasswordRecovery', 'member'),
        recoverTenant: () => callGlobal('openPasswordRecovery', 'tenant'),
        memberLogin: () => callGlobal('memberLogin'),
        memberRegister: () => callGlobal('memberRegister'),
        verifyMemberPhoneOtp: () => callGlobal('verifyMemberPhoneOtp'),
        entryGuest: () => callGlobal('setEntryMode', 'guest'),
        openAvatarCustomizer: () => callGlobal('openAvatarCustomizer'),
        closeAvatarCustomizer: () => callGlobal('closeAvatarCustomizer'),
        openLoginChooser: () => callGlobal('openLoginChooser'),
        exitMallExperience: () => callGlobal('exitMallExperience'),
        toggleMobileFullscreen: () => callGlobal('toggleMobileFullscreen'),
        entryMember: () => callGlobal('setEntryMode', 'member'),
        entryMemberRegister: () => callGlobal('openMemberRegistration'),
        entryTenant: () => callGlobal('setEntryMode', 'tenant'),
        tenantLoginMain: () => callGlobal('tenantLogin', 'main'),
        toggleEntryPreferences: () => callGlobal('toggleEntryPreferences'),
        entryShoppingPreference: (element) => callGlobal('setEntryShoppingPreference', element.dataset.mallValue),
        startMallExperience: () => callGlobal('startMallExperience'),
        startMallGuidedExperience: () => callGlobal('startMallGuidedExperience'),
        cancelMallGuidedExperience: () => callGlobal('cancelMallGuidedExperience'),
        confirmMallGuidedExperience: () => callGlobal('confirmMallGuidedExperience'),
        skipMallGuidedTour: () => callGlobal('skipMallGuidedTour'),
        advanceMallGuidedTour: () => callGlobal('advanceMallGuidedTour'),
        toggleMallGuidedVoice: () => callGlobal('toggleMallGuidedVoice'),
        toggleTenantApply: () => callGlobal('toggleTenantApply'),
        openSuperAdmin: () => callGlobal('openSuperAdmin'),
        toggleChat: () => callGlobal('toggleChat'),
        resetChatTarget: () => callGlobal('resetChatTarget'),
        toggleControlsMenu: () => callGlobal('toggleControlsMenu'),
        toggleQuickNavigator: () => callGlobal('toggleQuickNavigator'),
        openQuickSearch: (element) => callGlobal('openQuickSearch', element.dataset.mallValue),
        openStoreCatalogPicker: () => callGlobal('openQuickSearch', 'store'),
        openMallOrientation: () => callGlobal('openMallOrientation'),
        openMallFeedback: () => callGlobal('openMallFeedback'),
        dismissMallQuickStart: () => callGlobal('dismissMallQuickStart'),
        openProximityContextAction: () => callGlobal('openProximityContextAction'),
        dismissProximityContext: () => callGlobal('dismissProximityContext'),
        closeCompactRouteMap: () => callGlobal('closeCompactRouteMap'),
        teleportFromCompactRoute: () => callGlobal('teleportFromCompactRoute'),
        toggleWalkMode: () => callGlobal('toggleWalkMode'),
        toggleThirdPersonView: () => callGlobal('toggleThirdPersonView'),
        toggleAvatarLabelMode: () => callGlobal('toggleAvatarLabelMode'),
        openMemberBenefits: () => callGlobal('openMemberBenefits'),
        closeMemberBenefits: () => callGlobal('closeMemberBenefits'),
        toggleTenantLogin: () => callGlobal('toggleTenantLogin'),
        openTenantAdminFromMenu: () => callGlobal('openTenantAdminFromMenu'),
        storeContactSubmit: () => callGlobal('sendStoreMessage'),
        tenantLoginDefault: () => callGlobal('tenantLogin'),
        skipTenantPasswordSetup: () => callGlobal('skipTenantPasswordSetup'),
        submitTenantPasswordSetup: () => callGlobal('submitTenantPasswordSetup'),
        closePasswordRecovery: () => callGlobal('closePasswordRecovery'),
        sendPasswordRecovery: () => callGlobal('sendPasswordRecovery'),
        submitRecoveredPassword: () => callGlobal('submitRecoveredPassword'),
        submitTenantApplication: () => callGlobal('submitTenantApplication'),
        closeTenantAdmin: () => callGlobal('closeTenantAdmin'),
        switchTenantStore: (element) => callGlobal('switchTenantStore', element),
        refreshTenantTelegramUi: () => callGlobal('refreshTenantTelegramUi'),
        regenerateTenantTelegramLinkCode: () => callGlobal('regenerateTenantTelegramLinkCode'),
        openTenantTelegramBotLink: () => callGlobal('openTenantTelegramBotLink'),
        uploadTenantLogo: (element) => callGlobal('uploadTenantLogo', element),
        clickTenantLogoFile: () => document.getElementById('edit-store-logo-file')?.click(),
        updateTenantPassword: () => callGlobal('updateTenantPassword'),
        addTenantShippingRate: () => callGlobal('addTenantShippingRate'),
        saveTenantShippingRates: () => callGlobal('saveTenantShippingRates'),
        saveTenantPaymentDetails: () => callGlobal('saveTenantPaymentDetails'),
        removeTenantShippingRate: (element) => callGlobal('removeTenantShippingRate', Number(element.dataset.rateIndex)),
        previewTenantStore: () => callGlobal('previewTenantStore'),
        saveTenantData: () => callGlobal('saveTenantData'),
        filterStores: () => callGlobal('filterStores'),
        adminLogout: () => callGlobal('adminLogout'),
        closeSuperAdmin: () => callGlobal('closeSuperAdmin'),
        toggleAdminTool: (element) => callGlobal('toggleAdminTool', element.dataset.mallTool, element.checked),
        teleportAdminToSelectedHotspot: () => callGlobal('teleportAdminToSelectedHotspot'),
        registerAdminTeleportPosition: () => callGlobal('registerAdminTeleportPosition'),
        appendSelectedAdminStoreCode: () => callGlobal('appendSelectedAdminStoreCode'),
        clearSelectedAdminStoreCodes: () => callGlobal('clearSelectedAdminStoreCodes'),
        generateTenantTemporaryPassword: () => callGlobal('generateTenantTemporaryPassword'),
        copyTenantTemporaryPassword: () => callGlobal('copyTenantTemporaryPassword'),
        createTenantAccess: () => callGlobal('createTenantAccess'),
        resetTenantAccessPassword: () => callGlobal('resetTenantAccessPassword'),
        refreshAdminLocalCodes: () => {
            callGlobal('renderSelectedAdminStoreCodes');
            callGlobal('queueAdminRentalLoad');
        },
        approveSelectedTenantApplication: () => callGlobal('approveSelectedTenantApplication'),
        rejectSelectedTenantApplication: () => callGlobal('rejectSelectedTenantApplication'),
        cancelSelectedTenantApplication: () => callGlobal('cancelSelectedTenantApplication'),
        saveAdminServiceStatus: (element) => callGlobal('saveAdminServiceStatus', element.dataset.mallStatus),
        saveAdminRentRate: () => callGlobal('saveAdminRentRate'),
        saveAdminLease: () => callGlobal('saveAdminLease'),
         saveAdminPayment: () => callGlobal('saveAdminPayment'),
         saveAdminNote: () => callGlobal('saveAdminNote'),
         saveAdminMallAssistantSettings: () => callGlobal('saveAdminMallAssistantSettings'),
         avatarBody: (element) => callGlobal('selectAvatarBody', element.dataset.mallValue, element),
        avatarOutfit: (element) => callGlobal('selectAvatarOutfit', element.dataset.mallValue, element)
    };

    document.addEventListener('click', (event) => {
        if (event.target.closest('[data-stop-propagation="true"]')) {
            event.stopPropagation();
        }
        const actionElement = event.target.closest('[data-mall-action]');
        if (!actionElement) return;
        const action = entryActions[actionElement.dataset.mallAction];
        if (!action) return;
        action(actionElement, event);
    });

    document.addEventListener('submit', (event) => {
        const actionElement = event.target.closest('[data-mall-submit]');
        if (!actionElement) return;
        event.preventDefault();
        const action = entryActions[actionElement.dataset.mallSubmit];
        if (!action) return;
        action(actionElement, event);
    });

    document.addEventListener('input', (event) => {
        const actionElement = event.target.closest('[data-mall-input]');
        if (!actionElement) return;
        const action = entryActions[actionElement.dataset.mallInput];
        if (!action) return;
        action(actionElement, event);
    });

    document.addEventListener('change', (event) => {
        const actionElement = event.target.closest('[data-mall-change]');
        if (!actionElement) return;
        const action = entryActions[actionElement.dataset.mallChange];
        if (!action) return;
        action(actionElement, event);
    });

    setTimeout(() => {
        const loader = document.getElementById('loader');
        if (loader) loader.remove();
    }, 4500);

    const overlay = document.getElementById('login-overlay');
    const stage = document.querySelector('.welcome-stage');
    const loginCard = document.querySelector('.login-card');
    const isSmallTouchScreen = () => (
        (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0) &&
        window.matchMedia('(max-width: 900px)').matches
    );
    const showMobileEntry = () => {
        if (!overlay || !loginCard || !isSmallTouchScreen()) return;
        if (getComputedStyle(overlay).display === 'none') return;
        loginCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    if (stage) {
        stage.addEventListener('click', () => {
            if (isSmallTouchScreen()) showMobileEntry();
        });
    }

    let lastEntryLandscape = window.mallMobileViewport?.isLandscape?.() ?? window.innerWidth > window.innerHeight;
    let entryResizeTimer = null;
    const syncEntryAfterOrientationChange = () => {
        const nextLandscape = window.mallMobileViewport?.isLandscape?.() ?? window.innerWidth > window.innerHeight;
        if (nextLandscape === lastEntryLandscape) return;
        lastEntryLandscape = nextLandscape;
        if (entryResizeTimer) clearTimeout(entryResizeTimer);
        entryResizeTimer = setTimeout(showMobileEntry, 180);
    };

    setTimeout(showMobileEntry, 2400);
    window.addEventListener('resize', syncEntryAfterOrientationChange, { passive: true });
    window.visualViewport?.addEventListener('resize', syncEntryAfterOrientationChange, { passive: true });
    window.addEventListener('orientationchange', syncEntryAfterOrientationChange, { passive: true });
});
