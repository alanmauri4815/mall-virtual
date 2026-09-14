(function () {
    const themes = Object.freeze({
        elegant: {
            label: "Elegante",
            description: "Sobrio, cálido y refinado. Es la opción predeterminada."
        },
        vibrant: {
            label: "Vistoso",
            description: "Colores intensos para destacar productos y promociones."
        },
        modern: {
            label: "Moderno",
            description: "Claro, limpio y contemporáneo."
        },
        professional: {
            label: "Profesional",
            description: "Serio, ordenado y enfocado en la confianza."
        },
        joyful: {
            label: "Alegre",
            description: "Cálido y luminoso para una experiencia cercana."
        }
    });

    const aliases = Object.freeze({
        alegre: "joyful",
        elegante: "elegant",
        moderno: "modern",
        profesional: "professional",
        vistoso: "vibrant"
    });

    function normalizeMallCatalogTheme(value) {
        const raw = String(value || "").trim().toLowerCase();
        const normalized = aliases[raw] || raw;
        return Object.prototype.hasOwnProperty.call(themes, normalized) ? normalized : "elegant";
    }

    function getMallCatalogTheme(source = {}) {
        if (typeof source === "string") return normalizeMallCatalogTheme(source);
        return normalizeMallCatalogTheme(
            source?.catalog_theme
            || source?.storeRecord?.catalog_theme
            || source?.store?.catalog_theme
        );
    }

    function applyMallCatalogTheme(element, source = {}) {
        const theme = getMallCatalogTheme(source);
        if (!element) return theme;

        Object.keys(themes).forEach((key) => {
            element.classList.remove(`catalog-theme-${key}`);
        });
        element.classList.add(`catalog-theme-${theme}`);
        element.dataset.catalogTheme = theme;
        return theme;
    }

    window.MALL_CATALOG_THEMES = themes;
    window.normalizeMallCatalogTheme = normalizeMallCatalogTheme;
    window.getMallCatalogTheme = getMallCatalogTheme;
    window.applyMallCatalogTheme = applyMallCatalogTheme;
})();
