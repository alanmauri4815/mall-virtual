const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const editor = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-object-editor.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase', 'mall_picture_frames_20260821.sql'), 'utf8');

[
    'pictureFrameSmall',
    'pictureFrameMedium',
    'pictureFrameLarge'
].forEach((kind) => {
    assert.match(editor, new RegExp(`${kind}:`), `Missing furniture option ${kind}`);
});

assert.match(editor, /PICTURE_FRAME_BUCKET\s*=\s*'mall-public-media'/);
assert.match(editor, /pictureImageUrl:\s*entry\.pictureImageUrl/);
assert.match(editor, /data-picture-frame-file/);
assert.match(editor, /uploadSelectedPictureFrameImage/);
assert.match(migration, /'mall-public-media'/);
assert.match(migration, /public\.is_mall_admin\(\)/);
assert.match(migration, /for select\s+to public/i);

console.log('Picture-frame furniture options and secure public-media storage are configured.');

