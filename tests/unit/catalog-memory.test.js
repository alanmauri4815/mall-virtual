const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const index = read('index.html');
const ui = read('js/mall/mall-ui.js');
const main = read('js/mall/mall-main.js');
const css = read('css/mall.css');
const migration = read('supabase/catalog_memory_20260904.sql');

assert.match(index, /id="edit-store-catalog-memory"/);
assert.match(index, /maxlength="3000"/);
assert.match(ui, /catalog_memory/);
assert.match(ui, /memoryMatch/);
assert.match(main, /catalog_memory/);
assert.match(main, /store-public-info-value--memory/);
assert.match(css, /store-public-info-row--memory/);
assert.match(migration, /add column if not exists catalog_memory/i);
assert.match(migration, /alter column catalog_memory set default ''/i);
assert.match(migration, /char_length\(catalog_memory\) <= 3000/i);

console.log('Catalog memory wiring and migration checks passed.');
