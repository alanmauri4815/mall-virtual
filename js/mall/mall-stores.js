        // --- LÓGICA DE GESTIÓN COMERCIAL (BASE DE DATOS DINÁMICA) ---
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

        async function resizeTenantImage(file, maxSide = 1200, quality = 0.82) {
            if (!file || !file.type?.startsWith('image/')) {
                throw new Error("Selecciona un archivo de imagen válido.");
            }
            if (file.size > TENANT_IMAGE_MAX_BYTES) {
                throw new Error("La imagen supera 8 MB. Usa una imagen más liviana.");
            }

            const bitmap = await createImageBitmap(file);
            const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
            const width = Math.max(1, Math.round(bitmap.width * scale));
            const height = Math.max(1, Math.round(bitmap.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0, width, height);

            const type = file.type.includes('png') ? 'image/png' : 'image/webp';
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

            const canRepairOwnership = userHasAdminAccess(currentUserProfile, currentTenantUser) || !store.owner_id;
            if (!canRepairOwnership) return store;

            const { data: updatedStore, error } = await updateStoreByCode(store, { owner_id: currentTenantUser.id });
            if (error) throw error;
            return { ...store, ...(updatedStore || {}), owner_id: currentTenantUser.id };
        }

        async function uploadTenantImage(file, kind = 'asset', index = '') {
            if (!supabaseClient) throw new Error("No hay conexión con Supabase.");
            const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
            if (sessionError) throw sessionError;
            if (!sessionData?.session?.access_token) {
                throw new Error("No hay sesión activa para subir imágenes. Cierra sesión, vuelve a entrar como locatario/admin y prueba otra vez.");
            }
            if (!myOwnedStore?.id && !getStoreCode(myOwnedStore)) {
                throw new Error("No hay local seleccionado.");
            }

            myOwnedStore = await ensureTenantStoreUploadAccess(myOwnedStore);

            const maxSide = kind === 'logo' ? 800 : 1200;
            const blob = await resizeTenantImage(file, maxSide, 0.82);
            const ext = getFileExtensionFromType(blob.type);
            const safeKind = String(kind || 'asset').replace(/[^a-z0-9_-]/gi, '').toLowerCase();
            const suffix = index === '' || index === null ? '' : `-${index}`;
            const folderCandidates = [
                String(getStoreCode(myOwnedStore) || "").trim(),
                String(myOwnedStore?.local_code || "").trim(),
                String(myOwnedStore?.id || "").trim()
            ].filter(Boolean);

            let lastError = null;
            for (const folder of [...new Set(folderCandidates)]) {
                const path = `${folder}/${safeKind}${suffix}-${Date.now()}.${ext}`;
                const { error } = await supabaseClient.storage
                    .from(TENANT_ASSET_BUCKET)
                    .upload(path, blob, {
                        contentType: blob.type,
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

            const { data: ownedByUserId, error: ownerError } = await supabaseClient
                .from('stores')
                .select('*')
                .eq('owner_id', currentTenantUser.id)
                .limit(20);
            if (ownerError) throw ownerError;

            let resolvedStores = ownedByUserId || [];

            if (!resolvedStores.length && userEmail) {
                const { data: ownedByEmail, error: emailError } = await supabaseClient
                    .from('stores')
                    .select('*')
                    .ilike('contact_email', currentTenantUser.email)
                    .limit(20);
                if (emailError) throw emailError;
                resolvedStores = ownedByEmail || [];
            }

            if (!resolvedStores.length && userHasAdminAccess(currentUserProfile, currentTenantUser)) {
                const { data: adminStoreByCode, error: adminCodeError } = await supabaseClient
                    .from('stores')
                    .select('*')
                    .ilike('local_code', 'SE-10')
                    .limit(1);
                if (adminCodeError && !isMissingColumnError(adminCodeError, 'local_code')) throw adminCodeError;
                resolvedStores = adminStoreByCode || [];

                if (!resolvedStores.length) {
                    const { data: adminStoreByName, error: adminNameError } = await supabaseClient
                        .from('stores')
                        .select('*')
                        .ilike('name', 'AM Store')
                        .limit(1);
                    if (adminNameError) throw adminNameError;
                    resolvedStores = adminStoreByName || [];
                }
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

        async function preloadAllProducts() {
            if (!supabaseClient) return;
            try {
                const { data: allProducts, error } = await supabaseClient
                    .from('store_products')
                    .select('*')
                    .order('sort_order', { ascending: true });
                
                if (error) throw error;
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
                    window.storeProductsCache.set(sid, prods);
                });
                Object.entries(byLocalCode).forEach(([lc, prods]) => {
                    window.storeProductsCache.set(lc, prods);
                    window.storeProductsCache.set(lc.toLowerCase(), prods);
                });

                console.log(`[Cache] Precargados ${allProducts.length} productos para todos los locales.`);
            } catch (err) {
                console.warn("[Cache] No se pudieron precargar todos los productos en segundo plano:", err);
            }
        }
        window.preloadAllProducts = preloadAllProducts;

        async function loadStoreProducts(storeCode) {
            if (!storeCode) return { products: [], skipped: false, error: null };
            
            if (window.storeProductsCache.has(storeCode)) {
                return { products: window.storeProductsCache.get(storeCode), skipped: false, error: null };
            }

            // Intentar por store_id (UUID o código)
            const byStoreId = await supabaseClient
                .from('store_products')
                .select('*')
                .eq('store_id', storeCode);
            
            if (!byStoreId.error && (byStoreId.data || []).length > 0) {
                window.storeProductsCache.set(storeCode, byStoreId.data || []);
                return { products: byStoreId.data || [], skipped: false, error: null };
            }

            // Intentar por local_code
            const { data, error } = await supabaseClient
                .from('store_products')
                .select('*')
                .ilike('local_code', storeCode);
            
            if (!error && (data || []).length > 0) {
                window.storeProductsCache.set(storeCode, data || []);
                return { products: data || [], skipped: false, error: null };
            }

            const finalProducts = byStoreId.data || data || [];
            if (!byStoreId.error || !error) {
                window.storeProductsCache.set(storeCode, finalProducts);
            }

            // Si fallan ambos, devolver lo que tengamos del primer intento si no hubo error crítico
            return { products: finalProducts, skipped: false, error: byStoreId.error || error };
        }

        async function replaceStoreProducts(storeRef, productsToInsert = []) {
            const storeId = (typeof storeRef === 'object' ? storeRef.id : null) || storeRef;
            const localCode = (typeof storeRef === 'object' ? storeRef.local_code : null) || (String(storeId).length < 10 ? storeId : null);
            
            if (!storeId) return { ok: false, skipped: false, error: new Error("No hay local seleccionado.") };

            if (window.storeProductsCache) {
                window.storeProductsCache.delete(storeId);
                if (localCode) window.storeProductsCache.delete(localCode);
            }

            const normalizedProducts = productsToInsert
                .map((product, index) => ({
                    store_id: storeId,
                    local_code: localCode,
                    name: String(product.name || "").trim(),
                    price: String(product.price || "").trim(),
                    image_url: String(product.image_url || "").trim(),
                    sort_order: index
                }))
                .filter(product => product.name);

            // 1. Intentar borrar registros previos (con manejo de errores suave)
            try {
                let deleteOp = supabaseClient.from('store_products').delete();
                if (String(storeId).includes('-')) deleteOp = deleteOp.eq('store_id', storeId);
                else deleteOp = deleteOp.eq('local_code', storeId);
                await deleteOp;
            } catch (e) { console.warn("Error no crítico en borrado:", e); }

            if (!normalizedProducts.length) return { ok: true, skipped: false, error: null };

            // 2. Intentar inserción masiva (Modo Resiliente)
            // Probar diferentes esquemas si falla el principal
            const schemas = [
                normalizedProducts, // Intento 1: Full (store_id + local_code + sort_order)
                normalizedProducts.map(({store_id, local_code, name, price, image_url}) => ({store_id, local_code, name, price, image_url})), // Intento 2: Sin sort_order
                normalizedProducts.map(({store_id, name, price, image_url}) => ({store_id, name, price, image_url})), // Intento 3: Solo store_id
                normalizedProducts.map(({local_code, name, price, image_url}) => ({local_code, name, price, image_url}))  // Intento 4: Solo local_code
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
                setTenantUploadStatus(statusEl, "Subiendo imagen optimizada...", "warn");
                const publicUrl = await uploadTenantImage(file, 'product', index);
                const imageInput = slot?.querySelector('.p-image');
                if (imageInput) imageInput.value = publicUrl;
                if (typeof window.syncTenantProductDraftsFromDom === 'function') {
                    window.syncTenantProductDraftsFromDom();
                }
                setTenantUploadStatus(statusEl, "Imagen subida. Guarda cambios.", "success");
            } catch (error) {
                console.error("Error subiendo producto:", error);
                setTenantUploadStatus(statusEl, "No pude subir: " + error.message, "error");
            } finally {
                input.value = "";
            }
        };

