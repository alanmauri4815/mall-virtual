const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(projectRoot, 'css', 'mall.css'), 'utf8');

const toolbarStart = html.indexOf('<div id="mall-quick-tools"');
const toolbarEnd = html.indexOf('<aside id="compact-route-map"', toolbarStart);
const pedometerIndex = html.indexOf('<button id="member-pedometer"');
assert.ok(toolbarStart >= 0 && toolbarEnd > toolbarStart);
assert.ok(
    pedometerIndex > toolbarStart && pedometerIndex < toolbarEnd,
    'The member pedometer must stay in the quick-tools toolbar beside the quick navigator.'
);

assert.match(css, /\.mall-quick-tools\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;/s);
assert.match(css, /#member-pedometer\s*\{[^}]*position:\s*static;[^}]*transform:\s*none;/s);
assert.match(
    css,
    /@media\s*\(max-width:\s*460px\)\s*\{\s*\.mall-quick-tools\s*\{\s*flex-direction:\s*column;/
);

console.log('Member pedometer shares the quick-tools toolbar and stacks below 460px.');
