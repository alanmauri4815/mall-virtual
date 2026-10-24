const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

test('nginx 1.27 inherits security headers in cached asset locations', () => {
    const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
    const config = fs.readFileSync(path.join(root, 'nginx.conf'), 'utf8');
    const headers = fs.readFileSync(path.join(root, 'nginx/security-headers.inc'), 'utf8');

    assert.match(dockerfile, /^FROM nginx:1\.27-alpine/m);
    assert.match(dockerfile, /COPY nginx\/security-headers\.inc \/etc\/nginx\/security-headers\.inc/);
    assert.doesNotMatch(config, /add_header_inherit/);
    assert.equal((config.match(/include \/etc\/nginx\/security-headers\.inc;/g) || []).length, 7);
    assert.match(config, /location = \/ \{[\s\S]*?add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0" always;/);
    assert.match(config, /location = \/index\.html \{[\s\S]*?add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0" always;/);
    assert.match(headers, /Content-Security-Policy/);
    assert.match(headers, /X-Content-Type-Options/);
});
