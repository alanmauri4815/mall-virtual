const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const page = fs.readFileSync(path.join(root, 'tiendas', 'index.html'), 'utf8');
const catalog = fs.readFileSync(path.join(root, 'tiendas', 'catalog.js'), 'utf8');
const nginx = fs.readFileSync(path.join(root, 'nginx.conf'), 'utf8');
const mallContextSource = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-context.js'), 'utf8');

const browserWindow = { location: { hostname: 'mallvirtual.maucore.cl', search: '' } };
const browserDocument = { documentElement: { dataset: {} }, querySelectorAll: () => [] };
vm.runInNewContext(mallContextSource, {
  URLSearchParams,
  window: browserWindow,
  document: browserDocument,
  console,
});

assert.equal(browserWindow.mallContext.slug, 'providencia');
assert.match(page, /mall-supabase-config\.js[^\n]+/);
assert.match(page, /href="https:\/\/mallcreaciones\.maucore\.cl\/">Visitar el mall 3D/);
assert.match(page, /catalog\.js\?v=20261015-mallvirtual-catalog-v1/);
assert.match(catalog, /window\.supabase\?\.createClient\(supabaseConfig\.url, supabaseConfig\.publishableKey\)/);
assert.doesNotMatch(catalog, /https:\/\/[^'"\s]+\.supabase\.co/);
assert.match(nginx, /location = \/ \{[\s\S]*?if \(\$host = mallvirtual\.maucore\.cl\) \{\s*return 302 \/tiendas\//);
assert.match(nginx, /try_files \/index\.html =404;/);

console.log('mallvirtual.maucore.cl serves the catalog with Hostinger Supabase configuration and preserves the 3D mall entrypoint.');
