const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');

const localScripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1].split('?')[0])
    .filter((source) => !/^https?:\/\//i.test(source));
const localStyles = [...html.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1].split('?')[0])
    .filter((source) => !/^https?:\/\//i.test(source));

[...localScripts, ...localStyles].forEach((relativePath) => {
    assert.ok(
        fs.existsSync(path.join(projectRoot, relativePath)),
        `index.html references a missing local asset: ${relativePath}`
    );
});

const expectedMallModules = [
    'js/mall/mall-context.js',
    'js/mall/mall-boot.js',
    'js/mall/mall-physics.js',
    'js/mall/mall-furniture.js',
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

let previousIndex = -1;
expectedMallModules.forEach((modulePath) => {
    const moduleIndex = localScripts.indexOf(modulePath);
    assert.notEqual(moduleIndex, -1, `Missing required mall module: ${modulePath}`);
    assert.ok(moduleIndex > previousIndex, `${modulePath} is loaded out of the required order`);
    previousIndex = moduleIndex;
});

assert.equal(
    localScripts.at(-1),
    'js/mall/mall-main.js',
    'mall-main.js must remain the final script because it starts the application'
);

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
assert.deepEqual(duplicateIds, [], `Duplicate HTML ids found: ${duplicateIds.join(', ')}`);

assert.match(html, /<meta\s+name=["']viewport["'][^>]*viewport-fit=cover/i);
assert.match(html, /id=["']login-overlay["']/i);
assert.match(html, /id=["']loader["']/i);

console.log(`Entrypoint contract verified: ${localScripts.length} scripts, ${localStyles.length} styles, ${ids.length} unique ids.`);
