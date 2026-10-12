(() => {
    const originalFilterStores = window.filterStores;
    const originalOpenSearch = window.openSearch;
    const originalOpenQuickSearch = window.openQuickSearch;
    const originalCloseSearch = window.closeSearchModal;
    let pickerOpen = false;
    let storesLoaded = false;
    let storesRequest = null;
    let stores = [];
    let renderSequence = 0;

    const normalize = (value) => String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    function closeQuickNavigator() {
        const panel = document.getElementById("quick-navigator-panel");
        const toggle = document.getElementById("quick-navigator-toggle");
        if (panel) panel.hidden = true;
        toggle?.setAttribute("aria-expanded", "false");
    }

    function closePicker() {
        pickerOpen = false;
        renderSequence += 1;
        const modal = document.getElementById("search-modal");
        const overlay = document.getElementById("modal-overlay");
        if (modal) modal.style.display = "none";
        if (overlay) overlay.style.display = "none";
    }

    async function loadStores() {
        if (storesLoaded) return stores;
        if (storesRequest) return storesRequest;

        storesRequest = window.mallCatalogRequests.getStores()
            .then((data) => {
                stores = (Array.isArray(data) ? data : [])
                    .map((store) => ({
                        shopCode: String(store.local_code || store.shopCode || store.shop_code || store.code || store.id || "").trim(),
                        name: String(store.name || "Local disponible").trim(),
                        category: String(store.category || "Comercio").trim()
                    }))
                    .filter((store) => store.shopCode)
                    .sort((a, b) => a.name.localeCompare(b.name, "es"));
                storesLoaded = true;
                return stores;
            })
            .finally(() => {
                storesRequest = null;
            });
        return storesRequest;
    }

    function showMessage(results, message, retry = false) {
        const item = document.createElement("div");
        item.className = "search-empty";
        item.textContent = message;
        results.appendChild(item);
        if (retry) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "search-item-catalog";
            button.textContent = "Reintentar";
            button.addEventListener("click", () => {
                storesLoaded = false;
                void renderStorePicker();
            });
            results.appendChild(button);
        }
    }

    async function renderStorePicker() {
        const results = document.getElementById("search-results");
        const input = document.getElementById("search-input");
        if (!results || !input) return;

        const sequence = ++renderSequence;
        results.innerHTML = "";
        if (!storesLoaded) showMessage(results, "Cargando locales...");

        try {
            await loadStores();
        } catch (error) {
            if (pickerOpen && sequence === renderSequence) {
                results.innerHTML = "";
                showMessage(results, "No se pudo cargar la lista de locales.", true);
            }
            console.warn("No se pudo cargar la lista de locales:", error);
            return;
        }

        if (!pickerOpen || sequence !== renderSequence) return;

        const query = normalize(input.value);
        const matches = stores
            .filter((store) => !query || normalize(`${store.name} ${store.category} ${store.shopCode}`).includes(query))
            .slice(0, 12);
        results.innerHTML = "";

        if (!matches.length) {
            showMessage(results, stores.length
                ? "No encontramos locales con ese nombre o código."
                : "No hay locales disponibles.");
            return;
        }

        matches.forEach((store) => {
            const item = document.createElement("div");
            item.className = "search-item";

            const label = document.createElement("span");
            const name = document.createElement("strong");
            name.textContent = store.name;
            label.appendChild(name);
            label.appendChild(document.createTextNode(store.category));

            const code = document.createElement("small");
            code.textContent = store.shopCode;

            const button = document.createElement("button");
            button.type = "button";
            button.className = "search-item-catalog";
            button.textContent = "Ver catálogo";
            button.setAttribute("aria-label", `Ver catálogo de ${store.name}`);
            button.addEventListener("click", () => {
                closePicker();
                window.openPublicStoreCatalog?.(store.shopCode);
            });

            item.append(label, code, button);
            results.appendChild(item);
        });
    }

    window.filterStores = function (...args) {
        if (pickerOpen) return renderStorePicker();
        return originalFilterStores?.apply(this, args);
    };

    window.openSearch = function (...args) {
        pickerOpen = false;
        return originalOpenSearch?.apply(this, args);
    };

    window.closeSearchModal = function (...args) {
        pickerOpen = false;
        renderSequence += 1;
        return originalCloseSearch?.apply(this, args);
    };

    window.openQuickSearch = function (kind = "product") {
        if (kind !== "store") {
            pickerOpen = false;
            return originalOpenQuickSearch?.call(this, kind);
        }

        closeQuickNavigator();
        window.dismissMallQuickStart?.();
        window.closeCompactRouteMap?.();

        const input = document.getElementById("search-input");
        const modal = document.getElementById("search-modal");
        const overlay = document.getElementById("modal-overlay");
        if (!input || !modal || !overlay) return;

        pickerOpen = true;
        input.value = "";
        input.placeholder = "Escribe el nombre o código del local...";
        modal.style.display = "block";
        overlay.style.display = "block";
        window.mallAnalytics?.track("search_opened", { source: "quick_store_picker" });
        void renderStorePicker();
        try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); }
    };
})();
