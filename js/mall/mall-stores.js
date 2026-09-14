        // --- LÓGICA DE GESTIÓN COMERCIAL (BASE DE DATOS DINÁMICA) ---
        const mallStoresScopeQuery = (query) => window.mallContext?.scopeQuery
            ? window.mallContext.scopeQuery(query)
            : query;
        const mallStoresScopePayload = (payload) => window.mallContext?.scopePayload
            ? window.mallContext.scopePayload(payload)
            : payload;

        const categoryData = {
            MODA: { giro: "Boutique de Alta Costura", products: [{ n: "Vestido Gala", p: "$1.850" }, { n: "Bolso de Cuero", p: "$2.200" }, { n: "Perfume Signature", p: "$450" }] },
            TECH: { giro: "Tecnología e Innovación", products: [{ n: "Smartphone PRO Max", p: "$1.299" }, { n: "Laptop Ultraliviana", p: "$2.450" }, { n: "Reloj Inteligente", p: "$590" }] },
            JOYERIA: { giro: "Alta Joyería y Relojería", products: [{ n: "Anillo Diamante", p: "$12.500" }, { n: "Collar Oro 18K", p: "$7.200" }, { n: "Reloj Platino", p: "$18.900" }] },
            CAFE: { giro: "Café de Especialidad y Bistro", products: [{ n: "Pack Café de Origen", p: "$28" }, { n: "Taza Cerámica Autor", p: "$35" }, { n: "Degustación Gourmet", p: "$65" }] },
            DEPORTES: { giro: "Equipamiento Deportivo Pro", products: [{ n: "Zapatillas Carbono", p: "$280" }, { n: "Camiseta Técnica", p: "$85" }, { n: "Bolso Gym Premium", p: "$145" }] }
        };

        function getStoreCode(store) {
            if (!store) return "";
            if (typeof store === 'string') return String(store || "").trim();
            return store.local_code || store.shopCode || store.shop_code || store.code || store.id || "";
        }

        function getStoreCodeCandidates(store) {
            const values = [
                getStoreCode(store),
                store?.local_code,
                store?.id,
                store?.shopCode,
                store?.shop_code,
                store?.code
            ];
            return [...new Set(values.map(value => String(value || "").trim()).filter(Boolean))];
        }

        function getStoreCodeFormatCandidates(code) {
            const raw = String(code || "").trim();
            if (!raw) return [];
            const compact = raw.replace(/-/g, "");
            const hyphenated = compact.replace(/^([A-Z]+)(\d+)$/i, "$1-$2").toUpperCase();
            return [...new Set([raw, raw.toUpperCase(), compact, compact.toUpperCase(), hyphenated].filter(Boolean))];
        }

        const {
            PRODUCT_DESCRIPTION_MAX_LENGTH,
            clampStoreProductLimit,
            getFallbackProductTierForStore,
            getFallbackProductLimitForStore
        } = window.mallProductCapacity;

        async function resolveStoreProductLimit(store) {
            const fallbackLimit = getFallbackProductLimitForStore(store);
            if (!supabaseClient || !store) return fallbackLimit;

            const explicitLimit = store?.product_limit || store?.max_products || store?.included_products;
            if (explicitLimit !== undefined && explicitLimit !== null && explicitLimit !== "") {
                return clampStoreProductLimit(explicitLimit, fallbackLimit);
            }

            const candidates = getStoreCodeCandidates(store);
            const storeId = String(store?.id || "").trim();
            try {
                if (storeId) {
                    const byStore = await mallStoresScopeQuery(supabaseClient
                        .from('stores')
                        .select('product_limit')
                        .eq('id', storeId))
                        .maybeSingle();
                    if (!byStore.error && byStore.data?.product_limit) {
                        return clampStoreProductLimit(byStore.data.product_limit, fallbackLimit);
                    }
                }

                for (const code of candidates) {
                    const byLocalCode = await mallStoresScopeQuery(supabaseClient
                        .from('stores')
                        .select('product_limit')
                        .ilike('local_code', code))
                        .maybeSingle();
                    if (!byLocalCode.error && byLocalCode.data?.product_limit) {
                        return clampStoreProductLimit(byLocalCode.data.product_limit, fallbackLimit);
                    }
                }

                if (storeId) {
                    const byRateStoreId = await supabaseClient
                        .from('store_rent_rates')
                        .select('included_products')
                        .eq('store_id', storeId)
                        .limit(1)
                        .maybeSingle();
                    if (!byRateStoreId.error && byRateStoreId.data?.included_products) {
                        return clampStoreProductLimit(byRateStoreId.data.included_products, fallbackLimit);
                    }
                }

                for (const code of candidates) {
                    const byRateLocalCode = await supabaseClient
                        .from('store_rent_rates')
                        .select('included_products')
                        .ilike('local_code', code)
                        .limit(1)
                        .maybeSingle();
                    if (!byRateLocalCode.error && byRateLocalCode.data?.included_products) {
                        return clampStoreProductLimit(byRateLocalCode.data.included_products, fallbackLimit);
                    }
                }
            } catch (error) {
                console.warn("No pude resolver capacidad de productos:", error);
            }
            return fallbackLimit;
        }

        window.PRODUCT_DESCRIPTION_MAX_LENGTH = PRODUCT_DESCRIPTION_MAX_LENGTH;
        window.getFallbackProductTierForStore = getFallbackProductTierForStore;
        window.getFallbackProductLimitForStore = getFallbackProductLimitForStore;
        window.resolveStoreProductLimit = resolveStoreProductLimit;

        const TENANT_ASSET_BUCKET = 'store-assets';
        const TENANT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

        function setTenantUploadStatus(target, message = "", tone = "muted") {
            const el = typeof target === 'string' ? document.getElementById(target) : target;
            if (!el) return;
            const palette = {
                muted: '#777',
                success: '#7fcf8d',
                error: '#ff8866',
                warn: '#c5a059'
            };
            el.textContent = message;
            el.style.color = palette[tone] || palette.muted;
        }

        function getFileExtensionFromType(type = "") {
            if (type.includes('png')) return 'png';
            if (type.includes('webp')) return 'webp';
            return 'jpg';
        }

        async function resizeTenantImage(file, options = {}, legacyQuality = 0.82) {
            if (!file || !file.type?.startsWith('image/')) {
                throw new Error("Selecciona un archivo de imagen válido.");
            }
            if (file.size > TENANT_IMAGE_MAX_BYTES) {
                throw new Error("La imagen supera 8 MB. Usa una imagen más liviana.");
            }

            const {
                maxSide = 1200,
                quality = 0.82,
                outputType = "",
                preserveTransparency = false
            } = typeof options === 'number' ? { maxSide: options, quality: legacyQuality } : options;
            const bitmap = await createImageBitmap(file);
            const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
            const width = Math.max(1, Math.round(bitmap.width * scale));
            const height = Math.max(1, Math.round(bitmap.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!preserveTransparency) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
            }
            ctx.drawImage(bitmap, 0, 0, width, height);
            if (typeof bitmap.close === 'function') bitmap.close();

            const type = outputType || (preserveTransparency && file.type.includes('png') ? 'image/png' : 'image/webp');
            const blob = await new Promise((resolve) => {
                canvas.toBlob((result) => resolve(result), type, quality);
            }) || await new Promise((resolve) => {
                canvas.toBlob((result) => resolve(result), 'image/jpeg', quality);
            });
            if (!blob) throw new Error("No pude optimizar la imagen en este navegador.");
            return blob;
        }

        async function ensureTenantStoreUploadAccess(store) {
            if (!store || !currentTenantUser?.id) return store;
            const alreadyOwnedByUser = String(store.owner_id || "").trim() === String(currentTenantUser.id || "").trim();
            if (alreadyOwnedByUser) return store;

            // La politica RLS permite al administrador subir archivos sin apropiarse del local.
            if (userHasAdminAccess(currentUserProfile, currentTenantUser) || store.owner_id) return store;

            const { data: updatedStore, error } = await updateStoreByCode(store, { owner_id: currentTenantUser.id });
            if (error) throw error;
            return { ...store, ...(updatedStore || {}), owner_id: currentTenantUser.id };
        }

        async function prepareTenantImageUpload() {
            if (!supabaseClient) throw new Error("No hay conexión con Supabase.");
            const { data: userData, error: sessionError } = await supabaseClient.auth.getUser();
            if (sessionError) throw sessionError;
            if (!userData?.user) {
                throw new Error("No hay sesión activa para subir imágenes. Cierra sesión, vuelve a entrar como locatario/admin y prueba otra vez.");
            }
            if (!myOwnedStore?.id && !getStoreCode(myOwnedStore)) {
                throw new Error("No hay local seleccionado.");
            }

            if (typeof window.verifyTenantStoreAccess !== 'function') {
                throw new Error("No se pudo verificar el permiso del local.");
            }
            const access = await window.verifyTenantStoreAccess(myOwnedStore);
            if (!access?.allowed) {
                throw new Error("Tu sesión no tiene autorización para subir archivos a este local.");
            }
            myOwnedStore = { ...myOwnedStore, ...(access.store || {}) };

            myOwnedStore = await ensureTenantStoreUploadAccess(myOwnedStore);
            const folderCandidates = [
                String(getStoreCode(myOwnedStore) || "").trim(),
                String(myOwnedStore?.local_code || "").trim(),
                String(myOwnedStore?.id || "").trim()
            ].filter(Boolean);
            return [...new Set(folderCandidates)];
        }

        async function uploadTenantBlob(blob, kind = 'asset', index = '', variant = '', timestamp = Date.now(), folderCandidates = []) {
            const ext = getFileExtensionFromType(blob.type);
            const safeKind = String(kind || 'asset').replace(/[^a-z0-9_-]/gi, '').toLowerCase();
            const suffix = index === '' || index === null ? '' : `-${index}`;
            const variantSuffix = variant ? `-${String(variant).replace(/[^a-z0-9_-]/gi, '').toLowerCase()}` : '';

            let lastError = null;
            for (const folder of folderCandidates) {
                const path = `${folder}/${safeKind}${suffix}${variantSuffix}-${timestamp}.${ext}`;
                const { error } = await supabaseClient.storage
                    .from(TENANT_ASSET_BUCKET)
                    .upload(path, blob, {
                        contentType: blob.type,
                        // Paths include a timestamp and are never overwritten.
                        // Let the CDN/browser reuse immutable tenant assets.
                        cacheControl: '31536000',
                        upsert: false
                    });
                if (!error) {
                    const { data } = supabaseClient.storage.from(TENANT_ASSET_BUCKET).getPublicUrl(path);
                    return data.publicUrl;
                }
                lastError = error;
            }

            throw lastError || new Error("No pude subir la imagen al bucket.");
        }

        async function uploadTenantImage(file, kind = 'asset', index = '') {
            const folderCandidates = await prepareTenantImageUpload();
            const blob = await resizeTenantImage(file, {
                maxSide: kind === 'logo' ? 1024 : 1200,
                quality: 0.82,
                preserveTransparency: kind === 'logo'
            });
            return uploadTenantBlob(blob, kind, index, '', Date.now(), folderCandidates);
        }

        async function uploadTenantProductImageSet(file, index = '') {
            const folderCandidates = await prepareTenantImageUpload();
            const timestamp = Date.now();
            const displayBlob = await resizeTenantImage(file, {
                maxSide: 1024,
                quality: 0.74,
                outputType: 'image/webp',
                preserveTransparency: false
            });
            const catalogBlob = await resizeTenantImage(file, {
                maxSide: 1920,
                quality: 0.86,
                outputType: 'image/webp',
                preserveTransparency: false
            });
            const displayUrl = await uploadTenantBlob(displayBlob, 'product', index, 'display', timestamp, folderCandidates);
            const catalogUrl = await uploadTenantBlob(catalogBlob, 'product', index, 'catalog', timestamp, folderCandidates);
            return { displayUrl, catalogUrl };
        }

        function isMissingColumnError(error, columnName = "") {
            const message = String(error?.message || "");
            return message.includes("schema cache")
                || message.includes("does not exist")
                || (columnName && message.includes(columnName));
        }

        function isNoRowsError(error) {
            return String(error?.code || "") === "PGRST116" || /multiple \(or no\) rows returned|0 rows/i.test(String(error?.message || ""));
        }

        async function refreshMyOwnedStoresFromSupabase() {
            if (!supabaseClient || !currentTenantUser?.id) return;
            const normalize = (value = "") => String(value || "").trim().toLowerCase();
            const userEmail = normalize(currentTenantUser.email);

            if (userHasAdminAccess(currentUserProfile, currentTenantUser)) {
                const { data: allStores, error: allStoresError } = await mallStoresScopeQuery(supabaseClient
                    .from('stores')
                    .select('*')
                    .order('local_code', { ascending: true }))
                    .limit(500);
                if (allStoresError) throw allStoresError;

                myOwnedStores = [...new Map(
                    (allStores || [])
                        .filter(store => store?.id)
                        .map(store => [String(store.id), store])
                ).values()];
                if (!myOwnedStores.length) {
                    myOwnedStore = null;
                    return;
                }

                const currentStoreId = String(myOwnedStore?.id || "").trim();
                const currentStoreCode = String(getStoreCode(myOwnedStore) || "").trim().toUpperCase();
                const isCurrentStore = (store) => {
                    const storeId = String(store?.id || "").trim();
                    const storeCode = String(getStoreCode(store) || "").trim().toUpperCase();
                    return (currentStoreId && storeId === currentStoreId) || (currentStoreCode && storeCode === currentStoreCode);
                };
                const belongsToAdmin = (store) => String(store?.owner_id || "").trim() === String(currentTenantUser.id);
                const matchesAdminEmail = (store) => normalize(store?.contact_email) === userEmail;
                myOwnedStore = myOwnedStores.find(isCurrentStore)
                    || myOwnedStores.find(belongsToAdmin)
                    || myOwnedStores.find(matchesAdminEmail)
                    || myOwnedStores[0];
                return;
            }

            const { data: ownedByUserId, error: ownerError } = await mallStoresScopeQuery(supabaseClient
                .from('stores')
                .select('*')
                .eq('owner_id', currentTenantUser.id))
                .limit(20);
            if (ownerError) throw ownerError;

            let resolvedStores = ownedByUserId || [];

            if (userEmail) {
                const { data: ownedByEmail, error: emailError } = await mallStoresScopeQuery(supabaseClient
                    .from('stores')
                    .select('*')
                    .ilike('contact_email', currentTenantUser.email))
                    .limit(20);
                if (emailError) throw emailError;
                const safelyLinkedByEmail = (ownedByEmail || []).filter(store => {
                    const storeOwnerId = String(store?.owner_id || "").trim();
                    return !storeOwnerId || storeOwnerId === String(currentTenantUser.id);
                });
                resolvedStores = [...resolvedStores, ...safelyLinkedByEmail];
            }

            myOwnedStores = [...new Map(
                resolvedStores
                    .filter(store => store?.id)
                    .map(store => [String(store.id), store])
            ).values()];
            if (!myOwnedStores.length) {
                myOwnedStore = null;
                return;
            }

            const currentStoreId = String(myOwnedStore?.id || "").trim();
            const currentStoreCode = String(getStoreCode(myOwnedStore) || "").trim().toUpperCase();
            myOwnedStore = myOwnedStores.find(store => {
                const storeId = String(store?.id || "").trim();
                const storeCode = String(getStoreCode(store) || "").trim().toUpperCase();
                return (currentStoreId && storeId === currentStoreId) || (currentStoreCode && storeCode === currentStoreCode);
            }) || myOwnedStores[0];
        }

        function updateLocalStoresCache(updatedStore) {
            if (!updatedStore || !window.supabaseStoresCache) return;
            const idx = window.supabaseStoresCache.findIndex(s => String(s.id).toLowerCase() === String(updatedStore.id).toLowerCase());
            if (idx !== -1) {
                window.supabaseStoresCache[idx] = updatedStore;
            } else {
                window.supabaseStoresCache.push(updatedStore);
            }
        }

        async function updateStoreByCode(store, payload) {
            const candidates = getStoreCodeCandidates(store);
            if (!candidates.length) {
                return { data: null, error: new Error("No hay codigo de local para actualizar.") };
            }

            let lastError = null;
            for (const code of candidates) {
                const byId = await supabaseClient
                    .from('stores')
                    .update(payload)
                    .eq('id', code)
                    .select('*')
                    .maybeSingle();
                if (!byId.error && byId.data) {
                    updateLocalStoresCache(byId.data);
                    return byId;
                }
                if (byId.error && !isNoRowsError(byId.error)) lastError = byId.error;

                const byLocalCode = await supabaseClient
                    .from('stores')
                    .update(payload)
                    .eq('local_code', code)
                    .select('*')
                    .maybeSingle();
                if (!byLocalCode.error && byLocalCode.data) {
                    updateLocalStoresCache(byLocalCode.data);
                    return byLocalCode;
                }
                if (byLocalCode.error && !isMissingColumnError(byLocalCode.error, 'local_code') && !isNoRowsError(byLocalCode.error)) {
                    lastError = byLocalCode.error;
                }
            }

            return { data: null, error: lastError || new Error("No encontre el local en stores.") };
        }

        if (!window.storeProductsCache) {
            window.storeProductsCache = new Map();
        }

        function getProductSlotIndex(product = {}, fallbackIndex = 0) {
            if (!product || typeof product !== 'object') {
                return Math.max(1, Number(fallbackIndex) + 1);
            }
            const explicitSlot = Number(product.slot_index);
            if (Number.isInteger(explicitSlot) && explicitSlot > 0) return explicitSlot;

            const sortOrder = Number(product.sort_order);
            if (Number.isInteger(sortOrder) && sortOrder >= 0) return sortOrder + 1;
            return Math.max(1, Number(fallbackIndex) + 1);
        }

        function sortStoreProductsBySlot(products = []) {
            return [...(products || [])]
                .filter(product => product && typeof product === 'object')
                .sort((left, right) => {
                const leftSlot = getProductSlotIndex(left, 0);
                const rightSlot = getProductSlotIndex(right, 0);
                if (leftSlot !== rightSlot) return leftSlot - rightSlot;
                return Number(left?.id || 0) - Number(right?.id || 0);
                });
        }

        function arrangeStoreProductsBySlot(products = [], slotCount = 50) {
            const count = Math.max(1, Math.min(50, Number(slotCount) || 50));
            const slots = Array(count).fill(null);
            sortStoreProductsBySlot(products).forEach((product, fallbackIndex) => {
                const desiredSlot = getProductSlotIndex(product, fallbackIndex);
                if (desiredSlot > count) return;
                let targetIndex = desiredSlot - 1;
                if (slots[targetIndex]) {
                    const nextFree = slots.findIndex((value, index) => !value && index >= targetIndex);
                    targetIndex = nextFree >= 0 ? nextFree : slots.findIndex(value => !value);
                }
                if (targetIndex < 0) return;
                slots[targetIndex] = {
                    ...product,
                    slot_index: targetIndex + 1,
                    sort_order: targetIndex
                };
            });
            return slots;
        }

        window.getProductSlotIndex = getProductSlotIndex;
        window.sortStoreProductsBySlot = sortStoreProductsBySlot;
        window.arrangeStoreProductsBySlot = arrangeStoreProductsBySlot;

        async function preloadAllProducts() {
            if (!supabaseClient) return;
            try {
                const allProducts = await window.mallCatalogRequests.getProducts();
                if (!allProducts || !allProducts.length) return;

                const byStoreId = {};
                const byLocalCode = {};

                allProducts.forEach(p => {
                    if (p.store_id) {
                        const sid = String(p.store_id);
                        if (!byStoreId[sid]) byStoreId[sid] = [];
                        byStoreId[sid].push(p);
                    }
                    if (p.local_code) {
                        const lc = String(p.local_code).toUpperCase();
                        if (!byLocalCode[lc]) byLocalCode[lc] = [];
                        byLocalCode[lc].push(p);
                    }
                });

                Object.entries(byStoreId).forEach(([sid, prods]) => {
                    window.storeProductsCache.set(sid, sortStoreProductsBySlot(prods));
                });
                Object.entries(byLocalCode).forEach(([lc, prods]) => {
                    const sortedProducts = sortStoreProductsBySlot(prods);
                    window.storeProductsCache.set(lc, sortedProducts);
                    window.storeProductsCache.set(lc.toLowerCase(), sortedProducts);
                });

                console.log(`[Cache] Precargados ${allProducts.length} productos para todos los locales.`);
            } catch (err) {
                console.warn("[Cache] No se pudieron precargar todos los productos en segundo plano:", err);
            }
        }
        window.preloadAllProducts = preloadAllProducts;

        async function loadStoreProducts(storeCode) {
            if (!storeCode) return { products: [], skipped: false, error: null };
            const codeCandidates = getStoreCodeFormatCandidates(storeCode);
            const candidateSet = new Set(codeCandidates.map(value => String(value || "").trim().toUpperCase()));
            const hasDatabaseIdCandidate = codeCandidates.some(value => {
                const candidate = String(value || "").trim();
                return candidate.length > 20 || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(candidate);
            });
            const productBelongsToStore = (product) => {
                if (!product) return false;
                const storeId = String(product.store_id || "").trim();
                const localCode = String(product.local_code || "").trim();
                if (localCode) {
                    const localMatches = getStoreCodeFormatCandidates(localCode)
                        .some(candidate => candidateSet.has(String(candidate || "").trim().toUpperCase()));
                    if (localMatches) return true;
                    return hasDatabaseIdCandidate && storeId && getStoreCodeFormatCandidates(storeId)
                        .some(candidate => candidateSet.has(String(candidate || "").trim().toUpperCase()));
                }
                if (storeId) {
                    return getStoreCodeFormatCandidates(storeId)
                        .some(candidate => candidateSet.has(String(candidate || "").trim().toUpperCase()));
                }
                return false;
            };
            const filterProductsForStore = (products = []) => sortStoreProductsBySlot((products || []).filter(productBelongsToStore));

            for (const candidate of codeCandidates) {
                if (window.storeProductsCache.has(candidate)) {
                    return { products: filterProductsForStore(window.storeProductsCache.get(candidate)), skipped: false, error: null };
                }
            }

            // Intentar por store_id (UUID o código)
            let firstStoreIdResult = { data: [], error: null };
            for (const candidate of codeCandidates) {
                const byStoreId = await mallStoresScopeQuery(supabaseClient
                    .from('store_products')
                    .select('*')
                    .eq('store_id', candidate));

                if (!firstStoreIdResult.error && !firstStoreIdResult.data?.length) firstStoreIdResult = byStoreId;
                if (!byStoreId.error && (byStoreId.data || []).length > 0) {
                    const filteredProducts = filterProductsForStore(byStoreId.data || []);
                    codeCandidates.forEach(cacheKey => window.storeProductsCache.set(cacheKey, filteredProducts));
                    if (filteredProducts.length > 0) return { products: filteredProducts, skipped: false, error: null };
                }
            }

            // Intentar por local_code
            let firstLocalCodeResult = { data: [], error: null };
            for (const candidate of codeCandidates) {
                const result = await mallStoresScopeQuery(supabaseClient
                    .from('store_products')
                    .select('*')
                    .ilike('local_code', candidate));

                if (!firstLocalCodeResult.error && !firstLocalCodeResult.data?.length) firstLocalCodeResult = result;
                if (!result.error && (result.data || []).length > 0) {
                    const filteredProducts = filterProductsForStore(result.data || []);
                    codeCandidates.forEach(cacheKey => window.storeProductsCache.set(cacheKey, filteredProducts));
                    return { products: filteredProducts, skipped: false, error: null };
                }
            }

            const finalProducts = filterProductsForStore(firstStoreIdResult.data || firstLocalCodeResult.data || []);
            if (!firstStoreIdResult.error || !firstLocalCodeResult.error) {
                codeCandidates.forEach(cacheKey => window.storeProductsCache.set(cacheKey, finalProducts));
            }

            // Si fallan ambos, devolver lo que tengamos del primer intento si no hubo error crítico
            return { products: finalProducts, skipped: false, error: firstStoreIdResult.error || firstLocalCodeResult.error };
        }

        async function replaceStoreProducts(storeRef, productsToInsert = []) {
            const storeId = (typeof storeRef === 'object' ? storeRef.id : null) || storeRef;
            const localCode = (typeof storeRef === 'object' ? storeRef.local_code : null) || (String(storeId).length < 10 ? storeId : null);
            
            if (!storeId) return { ok: false, skipped: false, error: new Error("No hay local seleccionado.") };

            if (window.storeProductsCache) {
                window.storeProductsCache.delete(storeId);
                if (localCode) window.storeProductsCache.delete(localCode);
            }
            window.mallCatalogRequests?.invalidate({ products: true });

            const normalizedProducts = productsToInsert
                .map((product, index) => {
                    const slotIndex = getProductSlotIndex(product, index);
                    return {
                    mall_id: window.mallContext?.id,
                    store_id: storeId,
                    local_code: localCode,
                    name: String(product.name || "").trim(),
                    price: String(product.price || "").trim(),
                    image_url: String(product.image_url || "").trim(),
                    description: String(product.description || "").trim().slice(0, PRODUCT_DESCRIPTION_MAX_LENGTH),
                    slot_index: slotIndex,
                    sort_order: slotIndex - 1
                    };
                })
                .filter(product => product.name);

            // 1. Intentar borrar registros previos (con manejo de errores suave)
            try {
                let deleteOp = mallStoresScopeQuery(supabaseClient.from('store_products').delete());
                if (String(storeId).includes('-')) deleteOp = deleteOp.eq('store_id', storeId);
                else deleteOp = deleteOp.eq('local_code', storeId);
                await deleteOp;
            } catch (e) { console.warn("Error no crítico en borrado:", e); }

            if (!normalizedProducts.length) return { ok: true, skipped: false, error: null };

            // 2. Intentar inserción masiva (Modo Resiliente)
            // Probar diferentes esquemas si falla el principal
            const schemas = [
                normalizedProducts, // Esquema nuevo: slot_index es la posicion estable.
                normalizedProducts.map(({slot_index, ...product}) => product), // Compatibilidad previa a la migracion: sort_order conserva el casillero.
                normalizedProducts.map(({slot_index, description, ...product}) => product),
                normalizedProducts.map(({slot_index, local_code, description, ...product}) => product),
                normalizedProducts.map(({slot_index, store_id, description, ...product}) => product)
            ];

            let lastErr = null;
            for (const schema of schemas) {
                // Eliminar nulos o undefined para evitar errores de tipo
                const cleanSchema = schema.map(obj => {
                    const newObj = {};
                    for (const k in obj) if (obj[k] !== null && obj[k] !== undefined) newObj[k] = obj[k];
                    return newObj;
                });

                const { error } = await supabaseClient.from('store_products').insert(cleanSchema);
                if (!error) return { ok: true, skipped: schema !== schemas[0], error: null };
                lastErr = error;
                if (!/column|violate|security/i.test(error.message)) break; // Si es un error de otro tipo, no seguir probando esquemas
            }

            return { ok: false, skipped: false, error: lastErr };
        }

        window.uploadTenantLogo = async function(input) {
            const file = input?.files?.[0];
            if (!file) return;
            const statusId = 'edit-store-logo-status';
            try {
                await refreshMyOwnedStoresFromSupabase();
                setTenantUploadStatus(statusId, "Subiendo logo optimizado...", "warn");
                const publicUrl = await uploadTenantImage(file, 'logo');
                const storeCode = getStoreCode(myOwnedStore);
                const { data: updatedStore, error: updateError } = await updateStoreByCode(myOwnedStore, { logo_url: publicUrl });
                if (updateError) throw updateError;

                document.getElementById('edit-store-logo').value = publicUrl;
                myOwnedStore = { ...myOwnedStore, ...(updatedStore || {}), logo_url: publicUrl };
                const currentProductsResult = await loadStoreProducts(storeCode);
                updateStoreVisuals(storeCode, myOwnedStore, currentProductsResult.products || []);
                setTenantUploadStatus(statusId, "Logo subido y guardado.", "success");
            } catch (error) {
                console.error("Error subiendo logo:", error);
                setTenantUploadStatus(statusId, "No pude subir el logo: " + error.message, "error");
            } finally {
                input.value = "";
            }
        };

        window.uploadTenantProductImage = async function(input, index) {
            const file = input?.files?.[0];
            if (!file) return;
            const slot = input.closest('.p-slot');
            const statusEl = slot?.querySelector('.p-upload-status');
            try {
                await refreshMyOwnedStoresFromSupabase();
                setTenantUploadStatus(statusEl, "Generando vitrina y catálogo optimizados...", "warn");
                const { catalogUrl } = await uploadTenantProductImageSet(file, index);
                const imageInput = slot?.querySelector('.p-image');
                if (imageInput) imageInput.value = catalogUrl;
                if (typeof window.syncTenantProductDraftsFromDom === 'function') {
                    window.syncTenantProductDraftsFromDom();
                }
                setTenantUploadStatus(statusEl, "Imagen optimizada. Guarda cambios.", "success");
            } catch (error) {
                console.error("Error subiendo producto:", error);
                setTenantUploadStatus(statusEl, "No pude subir: " + error.message, "error");
            } finally {
                input.value = "";
            }
        };

