const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const stores = fs.readFileSync(path.resolve(__dirname, '../../js/mall/mall-stores.js'), 'utf8');
const editor = fs.readFileSync(path.resolve(__dirname, '../../js/mall/mall-object-editor.js'), 'utf8');
assert.match(stores, /contentType: blob\.type,[\s\S]*cacheControl: '31536000',[\s\S]*upsert: false/,
    'Timestamped tenant assets must be cacheable for one year.');
assert.match(editor, /contentType: 'image\/webp',[\s\S]*cacheControl: '31536000',[\s\S]*upsert: true/,
    'Versioned picture-frame assets must be cacheable for one year.');
console.log('storage-cache-control.test.js: ok');
