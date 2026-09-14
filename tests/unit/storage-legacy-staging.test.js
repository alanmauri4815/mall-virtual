const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'tools', 'prepare-storage-legacy-display.js'), 'utf8');

assert.match(source, /require\('sharp'\)/, 'Legacy image preparation must use sharp for local resizing.');
assert.match(source, /mode: 'local-staging-only'/, 'Legacy preparation must be explicitly local-only.');
assert.match(source, /uploaded: false/, 'Legacy preparation must not claim remote uploads.');
assert.match(source, /databaseUpdated: false/, 'Legacy preparation must not change the database.');
assert.match(source, /-display\.webp/, 'Legacy files must receive deterministic display paths.');
assert.doesNotMatch(source, /\.storage\s*\.from|\.upload\s*\(/, 'Staging must not upload to Supabase.');

console.log('storage-legacy-staging.test.js: ok');
