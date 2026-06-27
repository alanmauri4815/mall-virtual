        // --- VÍNCULOS DE CIERRE (MÉTODO ROBUSTO) ---
        function closeModal() {
            document.getElementById('modal-overlay').style.display = 'none';
            document.getElementById('store-modal').style.display = 'none';
            document.getElementById('search-modal').style.display = 'none';
        }
        window.closeModal = closeModal;

        document.getElementById('modal-close-btn-fixed').addEventListener('click', closeModal);
        document.getElementById('modal-overlay').addEventListener('click', closeModal);
        document.getElementById('search-close-btn').addEventListener('click', closeModal);

        // --- INICIALIZACIÓN ---
        precalculateInventory();
        animate();

        async function getStoreData(code) {
            if (supabaseClient) {
                let dbStore = null;
                if (code) {
                    if (window.supabaseStoresCache) {
                        const searchCode = String(code).toLowerCase();
                        dbStore = window.supabaseStoresCache.find(s => 
                            String(s.id).toLowerCase() === searchCode || 
                            String(s.local_code || "").toLowerCase() === searchCode
                        ) || null;
                    } else {
                        const byId = await supabaseClient.from('stores').select('*').eq('id', code).maybeSingle();
                        dbStore = byId.data || null;
                    }
                }
                if (!dbStore && code && !window.supabaseStoresCache) {
                    const byLocalCode = await supabaseClient.from('stores').select('*').ilike('local_code', code).maybeSingle();
                    if (!byLocalCode.error) dbStore = byLocalCode.data || null;
                }
                if (dbStore) {
                    const storeCode = getStoreCode(dbStore) || code;
                    let productsResult = await loadStoreProducts(storeCode);
                    if ((!productsResult.products || !productsResult.products.length) && dbStore.id && dbStore.id !== storeCode) {
                        productsResult = await loadStoreProducts(dbStore.id);
                    }
                    const dbProducts = (productsResult.products || []).slice(0, 10);
                    const mappedProducts = dbProducts.map(p => ({ 
                        n: p.name || p.n || "Producto", 
                        p: p.price || p.p || "-", 
                        image_url: p.image_url || p.img || "" 
                    }));
                    
                    return {
                        shopCode: storeCode,
                        name: dbStore.name || "Local Sin Nombre",
                        category: dbStore.category || "Comercio",
                        products: mappedProducts.length > 0 ? mappedProducts : [{ n: "Consultar catálogo", p: "-" }],
                        contactEmail: dbStore.contact_email || dbStore.email || "",
                        contactPhone: dbStore.contact_phone || dbStore.whatsapp || dbStore.phone || "",
                        storeId: dbStore.id || storeCode,
                        logo_url: dbStore.logo_url || ""
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
            const searchCode = String(code).toLowerCase();
            let dbStore = null;
            if (window.supabaseStoresCache) {
                dbStore = window.supabaseStoresCache.find(s => 
                    String(s.id).toLowerCase() === searchCode || 
                    String(s.local_code || "").toLowerCase() === searchCode
                ) || null;
            }
            if (dbStore) {
                return {
                    shopCode: getStoreCode(dbStore) || code,
                    name: dbStore.name || "Local Sin Nombre",
                    category: dbStore.category || "Comercio",
                    contactEmail: dbStore.contact_email || dbStore.email || "",
                    contactPhone: dbStore.contact_phone || dbStore.whatsapp || dbStore.phone || "",
                    storeId: dbStore.id || code,
                    logo_url: dbStore.logo_url || "",
                    service_status: dbStore.service_status || 'active',
                    service_status_note: dbStore.service_status_note || ''
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
                    // Si los productos ya están en la caché global de productos
                    const cachedProducts = window.storeProductsCache?.get(data.shopCode) || window.storeProductsCache?.get(data.storeId);
                    if (cachedProducts) {
                        const mapped = cachedProducts.map(p => ({
                            n: p.name || p.n || "Producto", 
                            p: p.price || p.p || "-", 
                            image_url: p.image_url || p.img || "" 
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
                            const dbProducts = (productsResult.products || []).slice(0, 10);
                            const mappedProducts = dbProducts.map(p => ({ 
                                n: p.name || p.n || "Producto", 
                                p: p.price || p.p || "-", 
                                image_url: p.image_url || p.img || "" 
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
            tr.append(nameTd, priceTd);
            tbody.appendChild(tr);
        }

        function appendGalleryCard(gallery, product) {
            const imageUrl = safeImageUrl(product?.image_url || "");
            if (!imageUrl) return;
            const card = document.createElement('div');
            card.className = 'store-gallery-card';
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

        function openModal(data) {
            currentModalStoreCode = data.shopCode;
            currentModalStoreId = data.storeId || data.shopCode;
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
                    summary.innerText = realProductsCount > 0 ? `Contenido público visible para visitantes: ${realProductsCount} producto(s), precios${productsWithImages.length ? ', imágenes' : ''}${data.logo_url ? ', logo' : ''}.` : 'Este local aún no tiene productos públicos cargados.';
                }
            }
            if (links) {
                links.innerText = data.contactEmail || data.contactPhone ? 'Puedes consultar o cotizar directamente desde esta ficha comercial.' : 'Cuando el locatario publique contacto directo, aparecerá aquí.';
            }
            const manageBtn = document.getElementById('btn-manage-store');
            if (manageBtn) {
                const modalCode = String(data.shopCode || "").trim().toUpperCase();
                const canManageThisStore = myOwnedStores.some(s => {
                    const legacyCode = String(getStoreCode(s) || "").trim().toUpperCase();
                    const visibleCode = String(getAdminStoreDisplayCode(s) || "").trim().toUpperCase();
                    return legacyCode === modalCode || visibleCode === modalCode;
                });
                manageBtn.style.display = canManageThisStore ? 'block' : 'none';
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
            const phone = normalizePhone(data.contactPhone || "");
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
                    links.innerText = 'El servicio de este local está suspendido y el contacto comercial ha sido deshabilitado temporalmente.';
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
            if (!shRef || shRef.userData.isLoadingVisuals || shRef.userData.storeVisualPayload) return;
            const code = shRef.userData.shopCode;
            if (!code || !supabaseClient) return;

            shRef.userData.isLoadingVisuals = true;
            try {
                let storeData = null;

                if (window.supabaseStoresCache) {
                    const searchCode = String(code).toLowerCase();
                    storeData = window.supabaseStoresCache.find(s => 
                        String(s.id).toLowerCase() === searchCode || 
                        String(s.local_code || "").toLowerCase() === searchCode
                    ) || null;
                } else {
                    const byId = await supabaseClient.from('stores').select('*').eq('id', code).maybeSingle();
                    if (!byId.error) {
                        storeData = byId.data || null;
                    }

                    if (!storeData) {
                        const byLocalCode = await supabaseClient.from('stores').select('*').ilike('local_code', code).maybeSingle();
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
                    await updateStoreVisuals(resolvedCode, storeData, productsResult.products || []);
                } else {
                    // Marcar como cargado (no encontrado) en todos los grupos asociados al código
                    // para evitar consultas repetitivas a Supabase en cada frame.
                    getStoreGroupCollection(code).forEach((group) => {
                        group.userData.storeVisualPayload = { notFound: true };
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
                    image_url: product.image_url || ""
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
