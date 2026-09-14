(function registerMallSecurity(globalScope, factory) {
    const api = Object.freeze(factory(globalScope));

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (globalScope) {
        globalScope.mallSecurity = api;
    }
})(typeof window !== 'undefined' ? window : globalThis, function createMallSecurity(globalScope) {
    function escapeHtml(value = '') {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safeHttpUrl(value = '', baseUrl = '') {
        const raw = String(value || '').trim();
        if (!raw) return '';

        const resolvedBase = String(baseUrl || globalScope?.location?.origin || '').trim();
        try {
            const url = resolvedBase ? new URL(raw, resolvedBase) : new URL(raw);
            if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
            return url.href;
        } catch (_) {
            return '';
        }
    }

    function safeImageUrl(value = '', baseUrl = '') {
        return safeHttpUrl(value, baseUrl);
    }

    function buildSafeMailtoHref(email = '', subject = '') {
        const clean = String(email || '').trim();
        if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(clean)) return '';
        return `mailto:${clean}?subject=${encodeURIComponent(String(subject || ''))}`;
    }

    function buildSafeWhatsAppHref(phone = '', text = '') {
        const digits = String(phone || '').replace(/[^\d]/g, '');
        if (digits.length < 8 || digits.length > 15) return '';
        return `https://wa.me/${digits}?text=${encodeURIComponent(String(text || ''))}`;
    }

    function buildSafeTelHref(phone = '') {
        const raw = String(phone || '').trim();
        const digits = raw.replace(/[^\d]/g, '');
        if (digits.length < 8 || digits.length > 15) return '';
        return `tel:${raw.startsWith('+') ? '+' : ''}${digits}`;
    }

    return {
        escapeHtml,
        safeHttpUrl,
        safeImageUrl,
        buildSafeMailtoHref,
        buildSafeWhatsAppHref,
        buildSafeTelHref
    };
});
