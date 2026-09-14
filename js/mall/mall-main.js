        // --- VÍNCULOS DE CIERRE (MÉTODO ROBUSTO) ---
        const mallMainScopeQuery = (query) => window.mallContext?.scopeQuery
            ? window.mallContext.scopeQuery(query)
            : query;

        function restoreTenantPreviewContext() {
            if (!window.tenantPreviewContext?.active) return;
            const tenantAdminModal = document.getElementById('tenant-admin-modal');
            const overlay = document.getElementById('modal-overlay');
            const storeModal = document.getElementById('store-modal');
            const previewReturnBtn = document.getElementById('btn-return-tenant-preview');
            const manageBtn = document.getElementById('btn-manage-store');

            if (tenantAdminModal) tenantAdminModal.style.display = 'block';
            if (overlay) {
                overlay.style.display = 'block';
                overlay.classList.remove('is-tenant-preview');
            }
            if (storeModal) storeModal.classList.remove('is-tenant-preview');
            if (previewReturnBtn) previewReturnBtn.style.display = 'none';
            if (manageBtn && window.tenantPreviewContext.previousManageDisplay !== undefined) {
                manageBtn.style.display = window.tenantPreviewContext.previousManageDisplay;
            }
            window.tenantPreviewContext = { active: false };
        }

        function closeModal() {
            if (typeof closeProductDetail === 'function') closeProductDetail();
            document.getElementById('modal-overlay').style.display = 'none';
            document.getElementById('store-modal').style.display = 'none';
            document.getElementById('search-modal').style.display = 'none';
            const introModal = document.getElementById('mall-intro-modal');
            if (introModal) introModal.style.display = 'none';
            restoreTenantPreviewContext();
        }
        window.closeModal = closeModal;

        document.getElementById('modal-close-btn-fixed').addEventListener('click', closeModal);
        document.getElementById('modal-overlay').addEventListener('click', closeModal);
        document.getElementById('search-close-btn').addEventListener('click', closeModal);
        document.getElementById('btn-return-tenant-preview')?.addEventListener('click', closeModal);

        // --- INICIALIZACIÓN ---
        precalculateInventory();
        animate();

        function getCatalogCodeCandidates(code) {
            const raw = String(code || "").trim();
            if (!raw) return [];
            const compact = raw.replace(/-/g, "");
            const hyphenated = compact.replace(/^([A-Z]+)(\d+)$/i, "$1-$2").toUpperCase();
            return [...new Set([raw, raw.toUpperCase(), compact, compact.toUpperCase(), hyphenated].filter(Boolean))];
        }

        const tenantApplicationSocialCache = new Map();

        async function loadTenantApplicationForStore(storeRecord = {}, data = {}) {
            if (!supabaseClient) return null;
            const cacheKey = String(storeRecord.id || data.storeId || data.shopCode || "").toLowerCase();
            if (cacheKey && tenantApplicationSocialCache.has(cacheKey)) return tenantApplicationSocialCache.get(cacheKey);

            const queries = [];
            if (storeRecord.owner_id) {
                queries.push(() => supabaseClient
                    .from('tenant_applications')
                    .select('brand_name,email,phone,social_link,status,applicant_auth_user_id')
                    .eq('applicant_auth_user_id', storeRecord.owner_id)
                    .order('created_at', { ascending: false })
                    .limit(1));
            }
            if (storeRecord.name || data.name) {
                queries.push(() => supabaseClient
                    .from('tenant_applications')
                    .select('brand_name,email,phone,social_link,status,applicant_auth_user_id')
                    .ilike('brand_name', storeRecord.name || data.name)
                    .order('created_at', { ascending: false })
                    .limit(1));
            }
            if (storeRecord.contact_email || data.contactEmail) {
                queries.push(() => supabaseClient
                    .from('tenant_applications')
                    .select('brand_name,email,phone,social_link,status,applicant_auth_user_id')
                    .ilike('email', storeRecord.contact_email || data.contactEmail)
                    .order('created_at', { ascending: false })
                    .limit(1));
            }

            for (const runQuery of queries) {
                const result = await runQuery();
                if (!result.error && result.data?.length) {
                    const application = result.data.find(app => String(app.status || "").toLowerCase() === "approved") || result.data[0];
                    if (cacheKey) tenantApplicationSocialCache.set(cacheKey, application);
                    return application;
                }
            }

            if (cacheKey) tenantApplicationSocialCache.set(cacheKey, null);
            return null;
        }

        async function enrichStoreTenantApplication(data = {}) {
            if (!data || data.tenantApplication) return data;
            try {
                const application = await loadTenantApplicationForStore(data.storeRecord || {}, data);
                if (application) {
                    data.tenantApplication = application;
                    data.socialLink = application.social_link || "";
                }
            } catch (error) {
                console.warn("No pude cargar redes sociales de la postulación:", error);
            }
            return data;
        }

        async function getStoreData(code) {
            if (supabaseClient) {
                let dbStore = null;
                const codeCandidates = getCatalogCodeCandidates(code);
                if (codeCandidates.length) {
                    if (window.supabaseStoresCache) {
                        const searchCodes = codeCandidates.map(candidate => String(candidate).toLowerCase());
                        dbStore = window.supabaseStoresCache.find(s => 
                            searchCodes.includes(String(s.id).toLowerCase()) ||
                            searchCodes.includes(String(s.local_code || "").toLowerCase())
                        ) || null;
                    } else {
                        for (const candidate of codeCandidates) {
                            const byId = await mallMainScopeQuery(supabaseClient.from('stores').select('*').eq('id', candidate)).maybeSingle();
                            if (byId.data) {
                                dbStore = byId.data;
                                break;
                            }
                        }
                    }
                }
                if (!dbStore && codeCandidates.length && !window.supabaseStoresCache) {
                    for (const candidate of codeCandidates) {
                        const byLocalCode = await mallMainScopeQuery(supabaseClient.from('stores').select('*').ilike('local_code', candidate)).maybeSingle();
                        if (!byLocalCode.error && byLocalCode.data) {
                            dbStore = byLocalCode.data;
                            break;
                        }
                    }
                }
                if (dbStore) {
                    const storeCode = getStoreCode(dbStore) || code;
                    let productsResult = await loadStoreProducts(storeCode);
                    if ((!productsResult.products || !productsResult.products.length) && dbStore.id && dbStore.id !== storeCode) {
                        productsResult = await loadStoreProducts(dbStore.id);
                    }
                    const productLimit = getFallbackProductLimitForStore(dbStore);
                    const dbProducts = (productsResult.products || []).slice(0, productLimit);
                    const mappedProducts = dbProducts.map(p => ({ 
                        id: p.id || null,
                        n: p.name || p.n || "Producto", 
                        p: p.price || p.p || "-", 
                        image_url: p.image_url || p.img || "",
                        description: p.description || ""
                    }));
                    
                    return {
                        shopCode: storeCode,
                        name: dbStore.name || "Local Sin Nombre",
                        category: dbStore.category || "Comercio",
                        products: mappedProducts.length > 0 ? mappedProducts : [{ n: "Consultar catálogo", p: "-" }],
                        contactEmail: dbStore.contact_email || dbStore.email || "",
                        contactPhone: dbStore.contact_phone || dbStore.phone || "",
                        storeId: dbStore.id || storeCode,
                        logo_url: dbStore.logo_url || "",
                        catalog_memory: dbStore.catalog_memory || "",
                        catalog_theme: window.normalizeMallCatalogTheme?.(dbStore.catalog_theme) || "elegant",
                        storeRecord: dbStore,
                        product_tier: dbStore.product_tier || getFallbackProductTierForStore(dbStore),
                        product_limit: getFallbackProductLimitForStore(dbStore)
                    };
                }
            }
            const hash = code.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
            const categories = Object.keys(categoryData);
            const catKey = categories[hash % categories.length];
            const data = categoryData[catKey];
            let name = "Boutique " + (code.length > 2 ? code.substring(0, 2) : "Premium");
            if (code === "N") name = "Nordic Emporium";
            if (code === "S") name = "Southern Luxury";
            if (code === "E") name = "Eastern Gate Mall";
            if (code === "O") name = "Occidental Center";
            return { shopCode: code, name: name, category: data.giro, products: data.products };
        }

        function getCachedStoreData(code) {
            if (!code) return null;
            const searchCodes = getCatalogCodeCandidates(code).map(candidate => String(candidate).toLowerCase());
            let dbStore = null;
            if (window.supabaseStoresCache) {
                dbStore = window.supabaseStoresCache.find(s => 
                    searchCodes.includes(String(s.id).toLowerCase()) ||
                    searchCodes.includes(String(s.local_code || "").toLowerCase())
                ) || null;
            }
            if (dbStore) {
                return {
                    shopCode: getStoreCode(dbStore) || code,
                    name: dbStore.name || "Local Sin Nombre",
                    category: dbStore.category || "Comercio",
                    contactEmail: dbStore.contact_email || dbStore.email || "",
                    contactPhone: dbStore.contact_phone || dbStore.phone || "",
                    storeId: dbStore.id || code,
                    logo_url: dbStore.logo_url || "",
                    catalog_memory: dbStore.catalog_memory || "",
                    catalog_theme: window.normalizeMallCatalogTheme?.(dbStore.catalog_theme) || "elegant",
                    storeRecord: dbStore,
                    service_status: dbStore.service_status || 'active',
                    service_status_note: dbStore.service_status_note || '',
                    product_tier: dbStore.product_tier || getFallbackProductTierForStore(dbStore),
                    product_limit: getFallbackProductLimitForStore(dbStore)
                };
            }
            return null;
        }

        async function openPublicStoreCatalog(storeRef) {
            try {
                const shopCode = typeof storeRef === 'string' ? storeRef : storeRef?.userData?.shopCode;
                if (!shopCode) return;
                
                // Intentar obtener datos base de la caché de forma síncrona
                let data = getCachedStoreData(shopCode);
                if (!data) {
                    // Fallback si no está en la caché aún
                    data = await getStoreData(shopCode);
                }
                
                if (storeRef?.userData?.isAnchor && data) {
                    data.name = storeRef.userData.name;
                }
                if (data) {
                    await enrichStoreTenantApplication(data);
                }
                
                if (data) {
                    // Si los productos ya están en la caché global de productos
                    const cachedProducts = window.storeProductsCache?.get(data.shopCode) || window.storeProductsCache?.get(data.storeId);
                    if (cachedProducts) {
                        const productLimit = getFallbackProductLimitForStore(data);
                        const mapped = cachedProducts.slice(0, productLimit).map(p => ({
                            id: p.id || null,
                            n: p.name || p.n || "Producto", 
                            p: p.price || p.p || "-", 
                            image_url: p.image_url || p.img || "",
                            description: p.description || ""
                        }));
                        data.products = mapped.length > 0 ? mapped : [{ n: "Consultar catálogo", p: "-" }];
                        data.isLoadingProducts = false;
                        openModal(data);
                    } else {
                        // Si no están en la caché de productos, abrimos el modal mostrando cargando
                        data.products = [];
                        data.isLoadingProducts = true;
                        openModal(data);
                        
                        // Cargamos los productos asíncronamente en segundo plano
                        const storeCode = data.shopCode;
                        loadStoreProducts(storeCode).then(async (productsResult) => {
                            if ((!productsResult.products || !productsResult.products.length) && data.storeId && data.storeId !== storeCode) {
                                productsResult = await loadStoreProducts(data.storeId);
                            }
                            const productLimit = getFallbackProductLimitForStore(data);
                            const dbProducts = (productsResult.products || []).slice(0, productLimit);
                            const mappedProducts = dbProducts.map(p => ({ 
                                id: p.id || null,
                                n: p.name || p.n || "Producto", 
                                p: p.price || p.p || "-", 
                                image_url: p.image_url || p.img || "",
                                description: p.description || ""
                            }));
                            data.products = mappedProducts.length > 0 ? mappedProducts : [{ n: "Consultar catálogo", p: "-" }];
                            data.isLoadingProducts = false;
                            
                            // Si el modal sigue abierto para este mismo local, refrescarlo
                            if (document.getElementById('store-modal').style.display === 'block' && currentModalStoreCode === storeCode) {
                                updateModalProductsOnly(data);
                            }
                        }).catch(err => {
                            console.warn("Error cargando productos en segundo plano:", err);
                        });
                    }
                }
                
                // Cargar visuales en segundo plano para no bloquear la apertura
                if (data) {
                    hydrateStoreVisualsFromCatalogData(data).catch(e => console.warn("Error hidratando visuales:", e));
                }
            } catch (err) {
                console.error("Error abriendo catálogo:", err);
                showInteractionFeedback("Error al abrir catálogo");
            }
        }
        window.openPublicStoreCatalog = openPublicStoreCatalog;

        function appendProductRow(tbody, product) {
            const tr = document.createElement('tr');
            const nameTd = document.createElement('td');
            const priceTd = document.createElement('td');
            priceTd.className = 'price';
            nameTd.textContent = product?.n || 'Producto';
            priceTd.textContent = product?.p || '-';
            if (product?.description || safeImageUrl(product?.image_url || "")) {
                tr.className = 'store-product-row-clickable';
                tr.tabIndex = 0;
                tr.title = 'Ver detalle del producto';
                tr.addEventListener('click', () => openProductDetail(product));
                tr.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openProductDetail(product);
                    }
                });
            }
            tr.append(nameTd, priceTd);
            tbody.appendChild(tr);
        }

        function appendGalleryCard(gallery, product) {
            const imageUrl = safeImageUrl(product?.image_url || "");
            if (!imageUrl) return;
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'store-gallery-card';
            card.addEventListener('click', () => openProductDetail(product));
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = product?.n || 'Producto';
            const meta = document.createElement('div');
            meta.className = 'store-gallery-meta';
            const name = document.createElement('div');
            name.className = 'store-gallery-name';
            name.textContent = product?.n || 'Producto';
            const price = document.createElement('div');
            price.className = 'store-gallery-price';
            price.textContent = product?.p || 'Consultar';
            meta.append(name, price);
            card.append(img, meta);
            gallery.appendChild(card);
        }

        function ensureProductDetailModal() {
            let detail = document.getElementById('product-detail-modal');
            if (detail) return detail;

            detail = document.createElement('div');
            detail.id = 'product-detail-modal';
            detail.innerHTML = `
                <button type="button" class="product-detail-close" aria-label="Cerrar detalle">&times;</button>
                <div class="product-detail-grid">
                    <div class="product-detail-image-wrap">
                        <img id="product-detail-image" alt="">
                    </div>
                    <div class="product-detail-copy">
                        <div id="product-detail-name"></div>
                        <div id="product-detail-price"></div>
                        <p id="product-detail-description"></p>
                    </div>
                </div>
            `;
            document.body.appendChild(detail);
            detail.querySelector('.product-detail-close')?.addEventListener('click', closeProductDetail);
            return detail;
        }

        function closeProductDetail() {
            const detail = document.getElementById('product-detail-modal');
            if (detail) detail.style.display = 'none';
        }
        window.closeProductDetail = closeProductDetail;

        function openProductDetail(product = {}) {
            const imageUrl = safeImageUrl(product?.image_url || "");
            const detail = ensureProductDetailModal();
            window.applyMallCatalogTheme?.(detail, document.getElementById('store-modal')?.dataset.catalogTheme || "elegant");
            const image = detail.querySelector('#product-detail-image');
            const imageWrap = detail.querySelector('.product-detail-image-wrap');
            const name = detail.querySelector('#product-detail-name');
            const price = detail.querySelector('#product-detail-price');
            const description = detail.querySelector('#product-detail-description');

            if (imageUrl) {
                image.src = imageUrl;
                image.alt = product?.n || 'Producto';
                imageWrap.style.display = 'block';
            } else {
                image.removeAttribute('src');
                imageWrap.style.display = 'none';
            }

            name.textContent = product?.n || 'Producto';
            price.textContent = product?.p || 'Consultar precio';
            description.textContent = product?.description || 'Este producto aún no tiene una descripción publicada.';
            detail.style.display = 'block';
            window.mallAnalytics?.track('product_viewed', {
                storeCode: currentModalStoreCode,
                productId: product?.id,
                itemLabel: product?.n || product?.name || 'Producto',
                source: 'catalog'
            });
        }
        window.openProductDetail = openProductDetail;

        function firstAvailableField(record = {}, fields = []) {
            for (const field of fields) {
                const value = record[field];
                if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
            }
            return "";
        }

        function normalizeSocialUrl(value = "", service = "") {
            const raw = String(value || "").trim();
            if (!raw) return "";
            if (/^https?:\/\//i.test(raw)) return safeHttpUrl(raw);
            const handle = raw.replace(/^@/, "");
            if (service === "instagram") return safeHttpUrl(`https://instagram.com/${handle}`);
            if (service === "facebook") return safeHttpUrl(`https://facebook.com/${handle}`);
            if (service === "tiktok") return safeHttpUrl(`https://tiktok.com/@${handle}`);
            return safeHttpUrl(`https://${raw}`);
        }

        function formatSocialDisplay(value = "") {
            const raw = String(value || "").trim();
            if (!raw) return "";
            const withoutProtocol = raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
            const path = withoutProtocol.split(/[?#]/)[0].replace(/\/$/, "");
            const lastSegment = path.split("/").filter(Boolean).pop() || raw;
            const clean = lastSegment.replace(/^@/, "");
            return clean ? `@${clean}` : raw;
        }

        function getSocialLabel(value = "") {
            const social = String(value || "").toLowerCase();
            if (social.includes("instagram")) return "Instagram";
            if (social.includes("facebook")) return "Facebook";
            if (social.includes("tiktok")) return "TikTok";
            if (social.includes("linkedin")) return "LinkedIn";
            if (social.includes("youtube")) return "YouTube";
            return "Red social";
        }

        function buildGoogleMapsHref(address = "", mapsUrl = "") {
            const directUrl = safeHttpUrl(String(mapsUrl || "").trim());
            if (directUrl) return directUrl;
            const cleanAddress = String(address || "").trim();
            return cleanAddress
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanAddress)}`
                : "";
        }

        function buildStorePublicInfoRows(data = {}) {
            const record = data.storeRecord || {};
            const phone = firstAvailableField(record, ["contact_phone", "phone", "telefono", "celular"]) || data.contactPhone || "";
            const whatsapp = firstAvailableField(record, ["whatsapp"]);
            const email = firstAvailableField(record, ["contact_email", "email", "mail"]) || data.contactEmail || "";
            const socialUrl = firstAvailableField(record, ["social_url", "instagram", "instagram_url", "instagram_handle", "ig"]);
            const website = firstAvailableField(record, ["website", "web", "site_url", "page_url", "url", "pagina_web"]);
            const facebook = firstAvailableField(record, ["facebook", "facebook_url"]);
            const tiktok = firstAvailableField(record, ["tiktok", "tiktok_url"]);
            const address = firstAvailableField(record, ["address", "direccion", "location", "ubicacion"]);
            const mapsUrl = firstAvailableField(record, ["maps_url", "google_maps_url", "map_url"]);
            const description = firstAvailableField(record, ["description", "public_description", "short_description", "bio", "about", "catalog_description"]);
            const catalogMemory = firstAvailableField(record, ["catalog_memory", "public_updates", "store_memory"]) || data.catalogMemory || data.catalog_memory || "";
            const checkoutMode = firstAvailableField(record, ["checkout_mode"]);
            const serviceStatus = firstAvailableField(record, ["service_status"]);
            const socialLink = data.socialLink || data.tenantApplication?.social_link || "";

            const rows = [];
            if (description) rows.push({ label: "Descripción", value: description });
            if (catalogMemory) rows.push({ label: "Novedades", value: catalogMemory, kind: "memory", icon: "campaign" });
            if (phone) rows.push({ label: "Teléfono", value: phone, href: buildSafeTelHref(phone), kind: "phone", icon: "call" });
            if (whatsapp) rows.push({ label: "WhatsApp", value: whatsapp, href: buildSafeWhatsAppHref(normalizePhone(whatsapp), `Hola, vengo desde el Mall y quiero consultar por el local ${data.shopCode}.`), kind: "whatsapp", icon: "chat" });
            if (email) rows.push({ label: "Correo", value: email, href: buildSafeMailtoHref(email, `Consulta Mall - Local ${data.shopCode}`), kind: "email", icon: "mail" });
            if (socialUrl) {
                const handleOnly = /^@?[a-z0-9._]+$/i.test(socialUrl);
                rows.push({ label: getSocialLabel(socialUrl), value: formatSocialDisplay(socialUrl), href: normalizeSocialUrl(socialUrl, handleOnly ? "instagram" : ""), kind: "social", icon: "share" });
            }
            if (facebook) rows.push({ label: "Facebook", value: facebook, href: normalizeSocialUrl(facebook, "facebook") });
            if (tiktok) rows.push({ label: "TikTok", value: tiktok, href: normalizeSocialUrl(tiktok, "tiktok") });
            if (website) rows.push({ label: "Página web", value: website, href: normalizeSocialUrl(website), kind: "website", icon: "language" });
            if (address || mapsUrl) rows.push({ label: "Dirección", value: address || "Ver ubicación en el mapa", href: buildGoogleMapsHref(address, mapsUrl), kind: "maps", icon: "location_on" });
            if (checkoutMode) rows.push({ label: "Atención/venta", value: checkoutMode });
            if (serviceStatus) rows.push({ label: "Estado", value: serviceStatus });
            if (socialLink && !socialUrl) rows.push({ label: getSocialLabel(socialLink), value: formatSocialDisplay(socialLink), href: normalizeSocialUrl(socialLink, "instagram"), kind: "social", icon: "share" });
            return rows;
        }

        function renderStorePublicInfo(container, data = {}) {
            if (!container) return;
            const rows = buildStorePublicInfoRows(data);
            container.innerHTML = "";
            if (!rows.length) {
                container.textContent = "Cuando el locatario publique contacto directo, aparecerá aquí.";
                return;
            }

            const title = document.createElement("div");
            title.className = "store-public-info-title";
            title.textContent = "Información comercial";
            container.appendChild(title);

            rows.forEach((row) => {
                const item = document.createElement(row.href ? "a" : "div");
                item.className = "store-public-info-row";
                if (row.kind) item.classList.add(`store-public-info-row--${row.kind}`);
                if (row.href) {
                    item.classList.add("store-public-info-row--action", `store-public-info-row--${row.kind || "link"}`);
                    item.href = row.href;
                    item.setAttribute("aria-label", `${row.label}: ${row.value}`);
                    if (!row.href.startsWith("mailto:") && !row.href.startsWith("tel:")) {
                        item.target = "_blank";
                        item.rel = "noopener";
                    }
                }
                const label = document.createElement("span");
                label.className = "store-public-info-label";
                if (row.icon) {
                    const icon = document.createElement("span");
                    icon.className = "material-symbols-outlined store-public-info-icon";
                    icon.setAttribute("aria-hidden", "true");
                    icon.textContent = row.icon;
                    label.appendChild(icon);
                }
                const labelText = document.createElement("span");
                labelText.textContent = row.label;
                label.appendChild(labelText);
                const value = document.createElement("span");
                value.className = "store-public-info-value";
                if (row.kind === "memory") value.classList.add("store-public-info-value--memory");
                value.textContent = row.value;
                if (/whatsapp|tel[eé]fono|instagram|facebook|tiktok|redes sociales/i.test(row.label || "")) {
                    value.classList.add("store-public-info-value--nowrap");
                }
                item.append(label, value);
                container.appendChild(item);
            });
        }

        function openModal(data) {
            currentModalStoreCode = data.shopCode;
            currentModalStoreId = data.storeId || data.shopCode;
            const storeModal = document.getElementById('store-modal');
            const overlay = document.getElementById('modal-overlay');
            const previewReturnBtn = document.getElementById('btn-return-tenant-preview');
            const manageBtn = document.getElementById('btn-manage-store');
            const isTenantPreview = !!data.previewMode;
            if (!isTenantPreview) {
                window.mallAnalytics?.track('store_opened', {
                    storeCode: data.shopCode,
                    source: 'catalog'
                });
            }
            if (storeModal) storeModal.classList.toggle('is-tenant-preview', isTenantPreview);
            window.applyMallCatalogTheme?.(storeModal, data);
            if (overlay) overlay.classList.toggle('is-tenant-preview', isTenantPreview);
            if (previewReturnBtn) previewReturnBtn.style.display = isTenantPreview ? 'block' : 'none';
            document.getElementById('modal-title').innerText = data.name;
            document.getElementById('modal-code').innerText = `LOCAL ${data.shopCode}`;
            document.getElementById('modal-category').innerText = `Giro Comercial: ${data.category}`;
            const logoBox = document.getElementById('modal-store-logo-box');
            const logoImg = document.getElementById('modal-store-logo');
            const summary = document.getElementById('modal-store-summary');
            const links = document.getElementById('modal-store-links');
            const gallery = document.getElementById('modal-store-gallery');
            const tbody = document.getElementById('modal-products');
            const products = Array.isArray(data.products) ? data.products : [];
            const serviceSuspended = String(data.service_status || 'active').toLowerCase() === 'suspended';
            tbody.innerHTML = '';
            if (gallery) gallery.innerHTML = '';

            if (data.isLoadingProducts) {
                // Mostrar un spinner de carga o mensaje elegante
                const tr = document.createElement('tr');
                tr.innerHTML = `<td colspan="2" style="text-align:center; color:#c5a059; padding: 15px 0;"><span class="loading-products-text">Cargando productos...</span></td>`;
                tbody.appendChild(tr);
                if (gallery) {
                    gallery.style.display = 'block';
                    gallery.innerHTML = `<div style="text-align:center; width:100%; color:#888; padding:20px 0;">Cargando catálogo visual...</div>`;
                }
            } else {
                products.forEach(p => {
                    appendProductRow(tbody, p);
                });
                const productsWithImages = products.filter(p => p && safeImageUrl(p.image_url));
                if (gallery) {
                    if (productsWithImages.length) {
                        gallery.style.display = 'grid';
                        productsWithImages.forEach(p => {
                            appendGalleryCard(gallery, p);
                        });
                    } else {
                        gallery.style.display = 'none';
                    }
                }
            }

            if (logoBox && logoImg) {
                const logoUrl = safeImageUrl(data.logo_url || "");
                if (logoUrl) {
                    logoImg.src = logoUrl;
                    logoImg.alt = `Logo de ${data.name}`;
                    logoBox.style.display = 'flex';
                } else {
                    logoImg.removeAttribute('src');
                    logoBox.style.display = 'none';
                }
            }
            if (summary) {
                if (data.isLoadingProducts) {
                    summary.innerText = "Cargando el inventario público de este local...";
                } else {
                    const realProductsCount = products.filter(p => p.n !== "Consultar catálogo").length;
                    const productsWithImages = products.filter(p => p && safeImageUrl(p.image_url));
                    if (isTenantPreview) {
                        summary.innerText = realProductsCount > 0
                            ? `Vista previa de tu catálogo: así lo verán tus visitantes con ${realProductsCount} producto(s), precios${productsWithImages.length ? ', imágenes' : ''}${data.logo_url ? ', logo' : ''}. Revisa que cada foto y descripción se entiendan bien.`
                            : 'Vista previa de tu catálogo: aún no hay productos públicos cargados. Agrega nombre, precio, imagen y descripción para revisar cómo se verá.';
                    } else {
                        summary.innerText = realProductsCount > 0 ? `Contenido público visible para visitantes: ${realProductsCount} producto(s), precios${productsWithImages.length ? ', imágenes' : ''}${data.logo_url ? ', logo' : ''}.` : 'Este local aún no tiene productos públicos cargados.';
                    }
                }
            }
            renderStorePublicInfo(links, data);
            if (manageBtn) {
                const modalCode = String(data.shopCode || "").trim().toUpperCase();
                const canManageThisStore = myOwnedStores.some(s => {
                    const legacyCode = String(getStoreCode(s) || "").trim().toUpperCase();
                    const visibleCode = String(getAdminStoreDisplayCode(s) || "").trim().toUpperCase();
                    return legacyCode === modalCode || visibleCode === modalCode;
                });
                manageBtn.style.display = isTenantPreview ? 'none' : (canManageThisStore ? 'block' : 'none');
            }
            const mailtoBtn = document.getElementById('store-mailto-btn');
            const mailtoHref = buildSafeMailtoHref(data.contactEmail, `Consulta Mall - Local ${data.shopCode}`);
            if (mailtoHref) {
                mailtoBtn.href = mailtoHref;
                mailtoBtn.style.display = 'block';
            } else {
                mailtoBtn.removeAttribute('href');
                mailtoBtn.style.display = 'none';
            }
            const whatsappBtn = document.getElementById('store-whatsapp-btn');
            const phone = normalizePhone(firstAvailableField(data.storeRecord || {}, ["whatsapp"]) || data.contactPhone || "");
            const whatsappHref = buildSafeWhatsAppHref(phone, 'Hola, vengo desde el Mall y quiero consultar por el local ' + data.shopCode + '.');
            if (whatsappHref) {
                whatsappBtn.href = whatsappHref;
                whatsappBtn.style.display = 'block';
            } else {
                whatsappBtn.removeAttribute('href');
                whatsappBtn.style.display = 'none';
            }
            if (serviceSuspended) {
                if (summary) {
                    summary.innerText = `Servicio suspendido temporalmente${data.service_status_note ? ': ' + data.service_status_note : '. Este local no está operando para visitantes por el momento.'}`;
                }
                if (links) {
                    links.textContent = 'El servicio de este local está suspendido y el contacto comercial ha sido deshabilitado temporalmente.';
                }
                mailtoBtn.style.display = 'none';
                whatsappBtn.style.display = 'none';
            }
            document.getElementById('modal-overlay').style.display = 'block';
            document.getElementById('store-modal').style.display = 'block';
        }

        function updateModalProductsOnly(data) {
            const tbody = document.getElementById('modal-products');
            const gallery = document.getElementById('modal-store-gallery');
            const products = Array.isArray(data.products) ? data.products : [];
            tbody.innerHTML = '';
            if (gallery) gallery.innerHTML = '';
            
            products.forEach(p => {
                appendProductRow(tbody, p);
            });
            const productsWithImages = products.filter(p => p && safeImageUrl(p.image_url));
            if (gallery) {
                if (productsWithImages.length) {
                    gallery.style.display = 'grid';
                    productsWithImages.forEach(p => {
                        appendGalleryCard(gallery, p);
                    });
                } else {
                    gallery.style.display = 'none';
                }
            }
            
            const summary = document.getElementById('modal-store-summary');
            if (summary) {
                const realProductsCount = products.filter(p => p.n !== "Consultar catálogo").length;
                summary.innerText = realProductsCount > 0 ? `Contenido público visible para visitantes: ${realProductsCount} producto(s), precios${productsWithImages.length ? ', imágenes' : ''}${data.logo_url ? ', logo' : ''}.` : 'Este local aún no tiene productos públicos cargados.';
            }
        }

        async function loadStoreVisualsOnDemand(shRef) {
            if (!shRef || shRef.userData.isLoadingVisuals) return;
            if (shRef.userData.storeVisualPayload) {
                const notFoundAt = Number(shRef.userData.storeVisualPayload.notFoundAt || 0);
                const canRetryNotFound = shRef.userData.storeVisualPayload.notFound && performance.now() - notFoundAt > 8000;
                if (!canRetryNotFound) return;
                shRef.userData.storeVisualPayload = null;
            }
            const code = shRef.userData.shopCode;
            if (!code || !supabaseClient) return;

            shRef.userData.isLoadingVisuals = true;
            window.mallRuntimeMonitor?.enter('store-visual-load', { storeCode: code }, true);
            try {
                let storeData = null;

                if (window.supabaseStoresCache) {
                    const searchCode = String(code).toLowerCase();
                    storeData = window.supabaseStoresCache.find(s => 
                        String(s.id).toLowerCase() === searchCode || 
                        String(s.local_code || "").toLowerCase() === searchCode
                    ) || null;
                } else {
                    const byId = await mallMainScopeQuery(supabaseClient.from('stores').select('*').eq('id', code)).maybeSingle();
                    if (!byId.error) {
                        storeData = byId.data || null;
                    }

                    if (!storeData) {
                        const byLocalCode = await mallMainScopeQuery(supabaseClient.from('stores').select('*').ilike('local_code', code)).maybeSingle();
                        if (!byLocalCode.error) {
                            storeData = byLocalCode.data || null;
                        }
                    }
                }

                if (storeData) {
                    const resolvedCode = getStoreCode(storeData) || code;
                    let productsResult = await loadStoreProducts(resolvedCode);
                    if ((!productsResult.products || !productsResult.products.length) && storeData.id && storeData.id !== resolvedCode) {
                        productsResult = await loadStoreProducts(storeData.id);
                    }
                    window.mallRuntimeMonitor?.enter('store-visual-apply', { storeCode: resolvedCode }, true);
                    await updateStoreVisuals(resolvedCode, storeData, productsResult.products || []);
                } else {
                    // Marcar como cargado (no encontrado) en todos los grupos asociados al código
                    // para evitar consultas repetitivas a Supabase en cada frame.
                    getStoreGroupCollection(code).forEach((group) => {
                        group.userData.storeVisualPayload = { notFound: true, notFoundAt: performance.now() };
                    });
                }
            } catch (e) {
                console.warn("Error en carga on-demand para " + code, e);
            } finally {
                shRef.userData.isLoadingVisuals = false;
            }
        }

        async function hydrateStoreVisualsFromCatalogData(data) {
            const shopCode = data?.shopCode;
            if (!shopCode || !getStoreGroupCollection(shopCode).length) return;
            const products = (Array.isArray(data.products) ? data.products : [])
                .filter(product => product && product.image_url)
                .map(product => ({
                    name: product.n || product.name || "Producto",
                    price: product.p || product.price || "",
                    image_url: product.image_url || "",
                    description: product.description || ""
                }));
            await updateStoreVisuals(shopCode, {
                id: data.storeId || shopCode,
                name: data.name,
                category: data.category,
                contact_email: data.contactEmail || "",
                contact_phone: data.contactPhone || "",
                logo_url: data.logo_url || "",
                shelf_style: data.shelf_style || "madera"
            }, products);
        }

        async function preloadStoreContent(code) {
            if (!code || !supabaseClient || !getStoreGroupCollection(code).length) return;
            try {
                const data = await getStoreData(code);
                await hydrateStoreVisualsFromCatalogData(data);
                getStoreGroupCollection(code).forEach((group) => {
                    group.userData.catalogPreloaded = true;
                });
            } catch (error) {
                console.warn("No pude precargar contenido del local " + code, error);
            }
        }

        preloadStoreContent(renameStoreCode('O101'));

        setTimeout(() => { if (document.getElementById('loader')) document.getElementById('loader').remove(); }, 1500);
