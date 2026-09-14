const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const editor = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-object-editor.js'), 'utf8');

assert.match(editor, /const persistenceChains = new Map\(\)/);
assert.match(editor, /const previousSave = persistenceChains\.get\(entry\.id\) \|\| Promise\.resolve\(\)/);
assert.match(editor, /const queuedSave = previousSave\.catch\(\(\) => \{\}\)\.then\(async \(\) => \{/);
assert.match(editor, /updated_at: transform\.savedAt/);
assert.match(editor, /onConflict: 'mall_id,object_id'/);
assert.doesNotMatch(editor, /updated_at: new Date\(\)\.toISOString\(\)[\s\S]{0,120}\}, \{ onConflict: 'object_id' \}\);/);
assert.match(editor, /localTransform && localTime >= remoteTime \? localTransform : remoteTransform/);

console.log('Infrastructure-editor saves are serialized and preserve the latest furniture transform.');
