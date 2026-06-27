(function redirectFileProtocolToLocalhost() {
    const localAppUrl = 'http://localhost:8080/';
    if (window.location.protocol !== 'file:') return;
    window.__mallFileProtocolWarning = 'La app esta abierta como archivo. Para usar Supabase y entrar como locatario abre ' + localAppUrl;
    fetch(localAppUrl, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' })
        .then(() => window.location.replace(localAppUrl))
        .catch(() => console.warn(window.__mallFileProtocolWarning));
})();

window.mallMobileViewport = (() => {
    const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    const isLandscape = () => window.innerWidth > window.innerHeight;
    let mallSessionActive = false;

    const updateState = () => {
        const active = mallSessionActive && isTouchDevice();
        document.body.classList.toggle('mobile-session-active', active);
        document.body.classList.toggle('mobile-landscape', active && isLandscape());
        document.body.classList.toggle('mobile-portrait', active && !isLandscape());
    };

    const requestLandscape = async () => {
        if (!isTouchDevice()) return false;
        updateState();
        try {
            if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
            }
        } catch (_) {}

        try {
            if (screen.orientation && screen.orientation.lock) {
                await screen.orientation.lock('landscape');
                updateState();
                return true;
            }
        } catch (_) {}

        updateState();
        return isLandscape();
    };

    const activate = () => {
        mallSessionActive = true;
        updateState();
        requestLandscape();
    };

    window.addEventListener('resize', updateState);
    window.addEventListener('orientationchange', () => {
        updateState();
        setTimeout(updateState, 350);
    });
    window.addEventListener('pointerdown', () => {
        if (mallSessionActive) requestLandscape();
    }, { passive: true });

    return { activate, requestLandscape, updateState, isTouchDevice, isLandscape };
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
        requestLandscape: () => window.mallMobileViewport && window.mallMobileViewport.requestLandscape(),
        recoverMember: () => callGlobal('openPasswordRecovery', 'member'),
        recoverTenant: () => callGlobal('openPasswordRecovery', 'tenant'),
        memberLogin: () => callGlobal('memberLogin'),
        memberRegister: () => callGlobal('memberRegister'),
        verifyMemberPhoneOtp: () => callGlobal('verifyMemberPhoneOtp'),
        entryGuest: () => callGlobal('setEntryMode', 'guest'),
        entryMember: () => callGlobal('setEntryMode', 'member'),
        entryTenant: () => callGlobal('setEntryMode', 'tenant'),
        tenantLoginMain: () => callGlobal('tenantLogin', 'main'),
        startMallExperience: () => callGlobal('startMallExperience'),
        toggleTenantApply: () => callGlobal('toggleTenantApply'),
        openSuperAdmin: () => callGlobal('openSuperAdmin'),
        toggleChat: () => callGlobal('toggleChat'),
        resetChatTarget: () => callGlobal('resetChatTarget'),
        toggleControlsMenu: () => callGlobal('toggleControlsMenu'),
        toggleWalkMode: () => callGlobal('toggleWalkMode'),
        toggleAvatarLabelMode: () => callGlobal('toggleAvatarLabelMode'),
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
        refreshTenantTelegramUi: () => callGlobal('refreshTenantTelegramUi'),
        regenerateTenantTelegramLinkCode: () => callGlobal('regenerateTenantTelegramLinkCode'),
        openTenantTelegramBotLink: () => callGlobal('openTenantTelegramBotLink'),
        uploadTenantLogo: (element) => callGlobal('uploadTenantLogo', element),
        clickTenantLogoFile: () => document.getElementById('edit-store-logo-file')?.click(),
        updateTenantPassword: () => callGlobal('updateTenantPassword'),
        previewTenantStore: () => callGlobal('previewTenantStore'),
        saveTenantData: () => callGlobal('saveTenantData'),
        filterStores: () => callGlobal('filterStores'),
        adminLogout: () => callGlobal('adminLogout'),
        closeSuperAdmin: () => {
            const modal = document.getElementById('super-admin-modal');
            if (modal) modal.style.display = 'none';
        },
        toggleAdminTool: (element) => callGlobal('toggleAdminTool', element.dataset.mallTool, element.checked),
        teleportAdminToSelectedHotspot: () => callGlobal('teleportAdminToSelectedHotspot'),
        appendSelectedAdminStoreCode: () => callGlobal('appendSelectedAdminStoreCode'),
        clearSelectedAdminStoreCodes: () => callGlobal('clearSelectedAdminStoreCodes'),
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

    setTimeout(showMobileEntry, 2400);
    window.addEventListener('orientationchange', () => {
        setTimeout(showMobileEntry, 600);
    });
});
