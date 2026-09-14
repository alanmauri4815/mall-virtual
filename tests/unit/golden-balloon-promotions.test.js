const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const editor = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-object-editor.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-ui.js'), 'utf8');
const world = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-world.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'mall.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase', 'golden_balloon_promotions_20260906.sql'), 'utf8');

assert.match(editor, /goldenBalloon:\s*['"]Globo dorado/);
assert.match(editor, /GOLDEN_BALLOON_FLOAT_HEIGHT = 2\.55/);
assert.match(editor, /normalizeGoldenBalloonPosition/);
assert.match(editor, /isPromotionCollectible\s*=\s*kind === ['"]goldenBalloon['"]/);
assert.match(editor, /from\(['"]mall_promotions['"]\)\.insert/);
assert.match(editor, /from\(['"]mall_promotion_codes['"]\)\.insert/);
assert.match(editor, /position_x:\s*position\.x/);
assert.match(editor, /promotionId:\s*entry\.promotionId/);
assert.match(editor, /configurePromotionCollectibles/);
assert.match(editor, /promotion\?\.id[\s\S]{0,180}entry\.promotionId[\s\S]{0,180}entry\.object\?\.userData\?\.promotionId/);
assert.match(css, /\.mall-object-editor__create > div:not\(\.mall-object-editor__promotion-fields\)/);

assert.match(ui, /openDiscountReward/);
assert.match(ui, /data:\s*data\?\.discount_code|data\?\.discount_code/);
assert.match(ui, /mallObjectEditor\?\.hidePromotionCollectible/);
assert.match(world, /promotion\.object_id/);
assert.match(world, /goldenBalloonGroup\.visible\s*=\s*false/);

assert.match(html, /id="discount-reward-modal"/);
assert.match(html, /data-mall-action="copyDiscountCode"/);

['status', 'max_claims', 'object_id', 'position_x', 'position_y', 'position_z', 'found_at', 'found_by', 'redeemed_at', 'redeemed_by', 'redemption_count']
    .forEach((field) => assert.match(migration, new RegExp(`add column if not exists ${field}`, 'i')));
assert.match(migration, /create table if not exists public\.mall_promotion_codes/i);
assert.match(migration, /using \(public\.is_mall_admin\(\)\)/i);
assert.match(migration, /discount_code\s+text/i);
assert.match(migration, /discount_code',\s*code_row\.discount_code/i);
assert.doesNotMatch(
    migration,
    /select[\s\S]{0,120}discount_code[\s\S]{0,120}from public\.mall_promotions/i,
    'The member summary must not expose the protected discount code.'
);
assert.match(migration, /then 'found'/i);
assert.match(migration, /status = 'redeemed'/i);

console.log('Golden balloon furniture, protected discount codes, lifecycle states, and claim UI are wired.');
