const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const contracts = {
    'js/mall/mall-boot.js': ['mallMobileViewport', 'data-mall-action'],
    'js/mall/mall-physics.js': ['function registerCollider', 'function checkCollision'],
    'js/mall/mall-furniture.js': ['MALL_STORE_FURNITURE_LAYOUTS', "'OS-10'"],
    'js/mall/mall-constants.js': ['MALL_PERFORMANCE_PROFILE', 'mallRuntimeMonitor'],
    'js/mall/mall-world.js': ['function createAnchorStore', 'MALL_STORE_FURNITURE_LAYOUTS'],
    'js/mall/mall-maze-game.js': ['updateMallMazeGame', 'mallMazeGame'],
    'js/mall/mall-mobile-controls.js': ['mallMobileControls', 'pinchStartDistance'],
    'js/mall/mall-navigation.js': ['resetMallNavigationInputs', 'function updateKeyboardNavigation'],
    'js/mall/mall-multiplayer.js': ['openPasswordRecovery', 'submitTenantPasswordSetup'],
    'js/mall/commerce/product-capacity.js': ['mallProductCapacity', 'getFallbackProductLimitForStore'],
    'js/mall/mall-stores.js': ['refreshMyOwnedStoresFromSupabase', 'uploadTenantProductImage'],
    'js/mall/mall-interaction.js': ['new THREE.Raycaster', 'function updateObjectInspector'],
    'js/mall/security/url-safety.js': ['mallSecurity', 'buildSafeWhatsAppHref'],
    'js/mall/mall-ui.js': ['window.tenantLogin', 'requireAuthoritativeAdminAccess'],
    'js/mall/mall-analytics.js': ['window.mallAnalytics', 'buildRpcPayload'],
    'js/mall/mall-store-assistant.js': ['window.openStoreAssistant', 'window.openMallAssistant', 'mall_assistant_settings', 'mall_feedback'],
    'js/mall/mall-npc.js': ['function animate', 'function isNPCOnUpperFloor'],
    'js/mall/mall-main.js': ['function openProductDetail', 'window.openPublicStoreCatalog']
};

Object.entries(contracts).forEach(([relativePath, markers]) => {
    const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
    markers.forEach((marker) => {
        assert.ok(source.includes(marker), `${relativePath} lost its contract marker: ${marker}`);
    });
});

console.log(`Module surface verified for ${Object.keys(contracts).length} active JavaScript files.`);
