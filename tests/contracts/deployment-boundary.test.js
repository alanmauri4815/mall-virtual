const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..', '..');
const readIgnoreLines = (filename) => fs
    .readFileSync(path.join(projectRoot, filename), 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));

const vercelIgnore = new Set(readIgnoreLines('.vercelignore'));
const gitIgnore = new Set(readIgnoreLines('.gitignore'));

const requiredVercelExclusions = [
    '.git',
    '.vercel',
    '.env*',
    'backups',
    'edge-test',
    'edge_test.png',
    'node_modules',
    'pc-optimization-backup-*',
    'supabase',
    'tests',
    'tools',
    '.codex-*.png',
    'preview_*.png',
    'physical_space_inventory_*',
    'furniture_outside_store_spaces_*'
];

requiredVercelExclusions.forEach((entry) => {
    assert.ok(vercelIgnore.has(entry), `.vercelignore must exclude ${entry}`);
});

['edge-test/', 'edge_test.png', 'backups/', 'pc-optimization-backup-*/', '.codex-*.png'].forEach((entry) => {
    assert.ok(gitIgnore.has(entry), `.gitignore must exclude ${entry}`);
});

const runtimeFiles = [
    'index.html',
    'css/mall.css',
    'js/mall/mall-boot.js',
    'js/mall/mall-constants.js',
    'js/mall/mall-world.js',
    'js/mall/mall-maze-game.js',
    'js/mall/mall-mobile-controls.js',
    'js/mall/mall-navigation.js',
    'js/mall/mall-multiplayer.js',
    'js/mall/commerce/product-capacity.js',
    'js/mall/mall-stores.js',
    'js/mall/mall-interaction.js',
    'js/mall/security/url-safety.js',
    'js/mall/mall-ui.js',
    'js/mall/mall-analytics.js',
    'js/mall/mall-store-assistant.js',
    'js/mall/mall-npc.js',
    'js/mall/mall-main.js'
];

runtimeFiles.forEach((relativePath) => {
    assert.ok(fs.existsSync(path.join(projectRoot, relativePath)), `Missing runtime file: ${relativePath}`);
});

console.log('Deployment boundary excludes sensitive and development-only artifacts.');
