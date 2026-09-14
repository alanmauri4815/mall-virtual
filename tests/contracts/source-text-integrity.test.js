const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const runtimeFiles = [
    'index.html',
    'css/mall.css',
    'supabase/mall_current_setup.sql',
    ...fs.readdirSync(path.join(projectRoot, 'js', 'mall'))
        .filter((name) => name.endsWith('.js') && !name.includes('.backup-'))
        .map((name) => `js/mall/${name}`),
    'js/mall/commerce/product-capacity.js',
    'js/mall/security/url-safety.js',
    ...fs.readdirSync(path.join(projectRoot, 'supabase', 'functions'), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => `supabase/functions/${entry.name}/index.ts`)
        .filter((relativePath) => fs.existsSync(path.join(projectRoot, relativePath)))
];
const suspiciousSequences = [/\u00c3[\u0080-\u00bf]/u, /\u00c2[\u0080-\u00bf]/u, /\u00e2[\u0080-\u00bf]/u, /\ufffd/u];

runtimeFiles.forEach((relativePath) => {
    const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
    suspiciousSequences.forEach((pattern) => {
        assert.doesNotMatch(source, pattern, `Possible mojibake in ${relativePath}: ${pattern}`);
    });
});

console.log(`Text integrity verified in ${runtimeFiles.length} active source files.`);
