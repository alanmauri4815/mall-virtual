const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const functionSource = fs.readFileSync(
    path.join(projectRoot, 'supabase', 'functions', 'telegram-bot', 'index.ts'),
    'utf8'
);
const webhookSql = fs.readFileSync(
    path.join(projectRoot, 'supabase', 'telegram_store_orders_webhook_20260927.sql'),
    'utf8'
);

assert.match(functionSource, /function isStoreOrderInsertWebhook/);
assert.match(functionSource, /String\(payload\.table \|\| ""\) === "store_orders"/);
assert.match(functionSource, /isStoreOrderInsertWebhook\(body as Record<string, unknown>\)/);
assert.match(functionSource, /validateInternalNotifySecret\(request\)/);
assert.match(functionSource, /\.eq\("mall_id", mallId\)/);
assert.match(functionSource, /telegram_notifications_enabled/);

const orderHandlerStart = functionSource.indexOf('async function handleStoreOrderInsertWebhook');
const orderHandlerEnd = functionSource.indexOf('\nfunction isMessageInsertWebhook', orderHandlerStart);
assert.notEqual(orderHandlerStart, -1, 'Telegram bot must format store order notifications');
assert.notEqual(orderHandlerEnd, -1, 'Telegram order handler must end before webhook routing');
const orderHandler = functionSource.slice(orderHandlerStart, orderHandlerEnd);
assert.doesNotMatch(orderHandler, /record\.(?:buyer_(?:name|email|phone)|delivery_address)/,
    'Buyer contact details stay in the tenant panel instead of Telegram');
assert.match(orderHandler, /Total referencial/);
assert.match(orderHandler, /Solicitudes de compra/);

assert.match(webhookSql, /after insert on public\.store_orders/);
assert.match(webhookSql, /new\.status = 'pending_store_confirmation'/);
assert.match(webhookSql, /x-mall-notify-secret/);
assert.match(webhookSql, /<MALL_INTERNAL_NOTIFY_SECRET>/);

console.log('Store purchase request Telegram notices use the connected tenant chat and keep buyer contact data in the panel.');
