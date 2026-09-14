const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-ui.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-main.js'), 'utf8');
const themes = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-catalog-themes.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'mall.css'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase', 'catalog_color_themes_20260830.sql'), 'utf8');

assert.match(index, /id="edit-store-catalog-theme"/);
['elegant', 'vibrant', 'modern', 'professional', 'joyful'].forEach((theme) => {
    assert.match(index, new RegExp(`value="${theme}"`));
    assert.match(themes, new RegExp(`^\\s*${theme}:`, 'm'));
    if (theme !== 'elegant') assert.match(css, new RegExp(`catalog-theme-${theme}`));
});
assert.match(ui, /catalog_theme/);
assert.match(main, /applyMallCatalogTheme/);
assert.match(migration, /add column if not exists catalog_theme/i);
assert.match(migration, /default 'elegant'/i);
assert.match(migration, /stores_catalog_theme_check/i);

console.log('Catalog color themes are wired into the tenant panel, public catalog, CSS, and migration.');
