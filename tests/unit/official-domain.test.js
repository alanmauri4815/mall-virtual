const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const officialHost = 'mallcreaciones.maucore.cl';
const contextSource = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-context.js'), 'utf8');
const pageSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const browserWindow = {
  location: { hostname: officialHost, search: '' },
};
const browserDocument = {
  documentElement: { dataset: {} },
  querySelectorAll: () => [],
};

vm.runInNewContext(contextSource, {
  URLSearchParams,
  window: browserWindow,
  document: browserDocument,
  console,
});

assert.equal(browserWindow.mallContext.slug, 'providencia');
assert.equal(browserWindow.mallContext.id, '713c1740-0621-4fd7-98e6-fac2a93e4781');
assert.match(pageSource, /mall-context\.js\?v=20261004-official-mall-domain-v1/);

for (const functionName of [
  'admin-create-tenant',
  'admin-reset-tenant-password',
  'member-promotion-email',
  'store-attendant',
]) {
  const source = fs.readFileSync(
    path.join(root, 'supabase', 'functions', functionName, 'index.ts'),
    'utf8',
  );
  assert.ok(
    source.includes(`"https://${officialHost}"`),
    `${functionName} must allow browser requests from the official mall domain.`,
  );
}

console.log('Official mall domain routes to Providencia and is allowed by the browser-facing edge functions.');
