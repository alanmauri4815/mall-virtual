const assert = require('node:assert/strict');

const {
    escapeHtml,
    safeHttpUrl,
    safeImageUrl,
    buildSafeMailtoHref,
    buildSafeWhatsAppHref,
    buildSafeTelHref
} = require('../../js/mall/security/url-safety.js');

assert.equal(
    escapeHtml(`<img src=x onerror="alert('x')">`),
    '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;'
);
assert.equal(safeHttpUrl('https://example.com/catalogo', 'https://mall.example/'), 'https://example.com/catalogo');
assert.equal(safeHttpUrl('/catalogo', 'https://mall.example/'), 'https://mall.example/catalogo');
assert.equal(safeHttpUrl('javascript:alert(1)', 'https://mall.example/'), '');
assert.equal(safeHttpUrl('data:text/html,boom', 'https://mall.example/'), '');
assert.equal(safeImageUrl('https://cdn.example/foto.webp', 'https://mall.example/'), 'https://cdn.example/foto.webp');

assert.equal(
    buildSafeMailtoHref('ventas@example.com', 'Consulta local E-101'),
    'mailto:ventas@example.com?subject=Consulta%20local%20E-101'
);
assert.equal(buildSafeMailtoHref('bad\n@example.com', 'x'), '');
assert.equal(
    buildSafeWhatsAppHref('+56 9 1234 5678', 'Hola & consulta'),
    'https://wa.me/56912345678?text=Hola%20%26%20consulta'
);
assert.equal(buildSafeWhatsAppHref('123', 'Hola'), '');
assert.equal(buildSafeTelHref('+56 9 1234 5678'), 'tel:+56912345678');
assert.equal(buildSafeTelHref('123'), '');

console.log('Security URL helpers reject active schemes and encode external contact links.');
