        // --- SISTEMA DE BÚSQUEDA Y MAPAS ---
        let fullStoreInventory = [];
        window.supabaseStoresCache = null;
        async function precalculateInventory() {
            if (!supabaseClient) return;
            // Optimización: Una sola petición para obtener todos los locales activos
            const { data: allStores } = await supabaseClient.from('stores').select('*');
            if (!allStores) return;

            window.supabaseStoresCache = allStores;

            fullStoreInventory = allStores.map(s => ({
                shopCode: getStoreCode(s),
                name: s.name || "Local Disponible",
                category: s.category || "Comercio",
                products: [] // Los productos se cargarán on-demand o al filtrar si es necesario
            }));

            // Precargar todos los productos en caché en segundo plano
            if (typeof window.preloadAllProducts === 'function') {
                window.preloadAllProducts();
            }
        }
        precalculateInventory();

        window.filterStores = function () {
            const q = document.getElementById('search-input').value.toLowerCase();
            const results = document.getElementById('search-results');
            results.innerHTML = '';
            if (!q) return;
            const matches = fullStoreInventory.filter(s => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.products.some(p => p.n.toLowerCase().includes(q))).slice(0, 8);
            matches.forEach(m => {
                const div = document.createElement('div'); div.className = 'search-item';
                const label = document.createElement('span');
                const strong = document.createElement('strong');
                strong.textContent = m.name;
                label.appendChild(strong);
                label.appendChild(document.createTextNode(` (${m.category})`));
                const small = document.createElement('small');
                small.textContent = m.shopCode;
                div.append(label, small);
                div.onclick = async () => {
                    const fullData = await getStoreData(m.shopCode);
                    showInMap(fullData);
                };
                results.appendChild(div);
            });
        };

        function showInMap(store) {
            const floor = store.shopCode.includes('2') ? 2 : 1;
            document.getElementById('f-btn-1').className = floor === 1 ? 'floor-btn active' : 'floor-btn';
            document.getElementById('f-btn-2').className = floor === 2 ? 'floor-btn active' : 'floor-btn';

            const mapTarget = document.getElementById('map-target-pos');
            mapTarget.innerHTML = '';

            // Decodificar código para mapa 2D (esquemático)
            let x = 50, y = 50;
            const wing = store.shopCode[0];
            const val = parseInt(store.shopCode.substring(2)) || 50; // Para anclas
            const offset = 10 + (val / 2); // Escala para el SVG de 100x100

            if (wing === 'N') y = 50 - offset;
            if (wing === 'S') y = 50 + offset;
            if (wing === 'E') x = 50 - offset;
            if (wing === 'O') x = 50 + offset;

            if (store.shopCode.length === 1) { // Ancla
                if (wing === 'N') y = 5; if (wing === 'S') y = 95; if (wing === 'E') x = 5; if (wing === 'O') x = 95;
            }

            const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            dot.setAttribute("cx", x); dot.setAttribute("cy", y); dot.setAttribute("r", 4);
            dot.setAttribute("fill", "#ff0000");
            const animate = document.createElementNS("http://www.w3.org/2000/svg", "animate");
            animate.setAttribute("attributeName", "r"); animate.setAttribute("values", "2;5;2"); animate.setAttribute("dur", "1s"); animate.setAttribute("repeatCount", "indefinite");
            dot.appendChild(animate);
            mapTarget.appendChild(dot);

            const locationText = document.getElementById('location-text');
            locationText.textContent = "";
            const label = document.createElement('b');
            label.style.color = '#c5a059';
            label.textContent = 'Ubicación:';
            locationText.append(label, document.createTextNode(` Ala ${wing}, Planta ${floor}. Local ${store.shopCode}`));
        }

        window.openSearch = function () { document.getElementById('search-modal').style.display = 'block'; document.getElementById('modal-overlay').style.display = 'block'; };
        document.getElementById('search-close-btn').onclick = () => { document.getElementById('search-modal').style.display = 'none'; document.getElementById('modal-overlay').style.display = 'none'; };

        let lastMallInteractionSignature = "";
        let lastMallInteractionAt = 0;
        let pendingTouchCanvasTap = null;
        let suppressSyntheticMallClickUntil = 0;
        const TOUCH_MALL_TAP_MAX_DISTANCE = 18;
        const TOUCH_MALL_TAP_MAX_DURATION_MS = 320;

        async function handleMallInteractionPointer(event) {
            if (
                event.type === 'click' &&
                event.pointerType !== 'mouse' &&
                Date.now() < suppressSyntheticMallClickUntil
            ) {
                return;
            }
            // Mostrar pequeño feedback visual de interacción
            showInteractionFeedback("Procesando clic...");
            if (
                canvasContainer &&
                event.target.closest &&
                event.target.closest('#canvas-container, canvas') &&
                !event.target.closest('#login-overlay, #store-modal, #search-modal, #tenant-login-modal, #tenant-apply-modal, #super-admin-modal, #tenant-admin-modal, #password-recovery-modal, #tenant-password-setup-modal, #controls-menu, input, textarea, button, select, a, label')
            ) {
                focusMallCanvas();
            }
            if (event.target.closest && event.target.closest('#controls-menu')) return;
            closeControlsMenu();
            // No interactuar con el mall si el login o el modal de búsqueda están abiertos
            if (isElementActuallyVisible(document.getElementById('login-overlay')) ||
                isElementActuallyVisible(document.getElementById('search-modal'))) return;

            const rect = renderer.domElement.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;

            const interactionSignature = `${Math.round(event.clientX)}:${Math.round(event.clientY)}`;
            const now = Date.now();
            // Debounce más permisivo para asegurar que se capture el clic, pero evitar ráfagas
            if (interactionSignature === lastMallInteractionSignature && now - lastMallInteractionAt < 150) return;
            lastMallInteractionSignature = interactionSignature;
            lastMallInteractionAt = now;

            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
            raycaster.setFromCamera(mouse, camera);

            // 1. Detección directa de disparadores de catálogo (Placas, Letreros, Logos)
            const directCatalogIntersects = raycaster.intersectObjects(catalogClickTargets, true);
            if (directCatalogIntersects.length > 0) {
                const hitObj = directCatalogIntersects[0].object;
                const directCatalogTarget = findShopRoot(hitObj) || hitObj;
                
                // Asegurarnos que tenemos un shopCode válido
                const shopCode = directCatalogTarget.userData?.shopCode || hitObj.userData?.shopCode;
                if (shopCode) {
                    showInteractionFeedback(`Local detectado: ${shopCode}`);
                    openPublicStoreCatalog(directCatalogTarget);
                    return;
                }
            }

            // 2. Detección general en la escena (Paredes, Totems, Jugadores)
            const intersects = raycaster.intersectObjects(scene.children, true);
            if (OBJECT_INSPECTOR_ENABLED) updateObjectInspector(intersects[0] || null);
            if (intersects.length > 0) {
                let foundStore = null, foundTotem = null, foundPlayer = null;
                let firstStoreHit = null;

                for (const hit of intersects) {
                    let obj = hit.object;
                    let hitCatalogTrigger = false;
                    let hitStore = null;
                    let hitPlaque = false;

                    while (obj) {
                        if (obj.userData?.isSign || obj.userData?.isStoreCodeSign || obj.userData?.isLogoBanner || obj.userData?.isCatalogTrigger) {
                            hitCatalogTrigger = true;
                        }
                        if (obj.userData?.isStoreCodeSign || obj.userData?.isPlaqueHitbox) {
                            hitPlaque = true;
                        }
                        if (obj.userData?.shopCode && !hitStore) hitStore = obj;
                        if (obj.userData?.isTotem && !foundTotem) foundTotem = obj;
                        if (obj.userData?.playerId && !foundPlayer) foundPlayer = obj.userData.playerId;
                        obj = obj.parent;
                    }

                    if (hitStore && !firstStoreHit) {
                        firstStoreHit = findShopRoot(hitStore) || hitStore;
                    }
                    if (hitStore && (hitPlaque || hitCatalogTrigger)) {
                        foundStore = findShopRoot(hitStore) || hitStore;
                        break;
                    }
                }

                if (foundPlayer) {
                    setChatTarget(foundPlayer);
                } else if (foundTotem) {
                    openSearch();
                } else if (foundStore || firstStoreHit) {
                    openPublicStoreCatalog(foundStore || firstStoreHit);
                }
            }
        }

        renderer.domElement.addEventListener('click', handleMallInteractionPointer);
        renderer.domElement.addEventListener('pointerdown', (event) => {
            if (event.pointerType !== 'touch') return;
            pendingTouchCanvasTap = {
                pointerId: event.pointerId,
                clientX: event.clientX,
                clientY: event.clientY,
                startedAt: Date.now()
            };
        }, { passive: true });
        renderer.domElement.addEventListener('pointerup', (event) => {
            if (event.pointerType !== 'touch' || !pendingTouchCanvasTap) return;
            if (pendingTouchCanvasTap.pointerId !== event.pointerId) {
                pendingTouchCanvasTap = null;
                return;
            }
            const elapsed = Date.now() - pendingTouchCanvasTap.startedAt;
            const moved = Math.hypot(
                event.clientX - pendingTouchCanvasTap.clientX,
                event.clientY - pendingTouchCanvasTap.clientY
            );
            const isTap = elapsed <= TOUCH_MALL_TAP_MAX_DURATION_MS && moved <= TOUCH_MALL_TAP_MAX_DISTANCE;
            pendingTouchCanvasTap = null;
            if (!isTap) return;
            suppressSyntheticMallClickUntil = Date.now() + 700;
            handleMallInteractionPointer(event);
        }, { passive: true });
        renderer.domElement.addEventListener('pointercancel', () => {
            pendingTouchCanvasTap = null;
        }, { passive: true });

        function showInteractionFeedback(msg) {
            let el = document.getElementById('interaction-feedback');
            if (!el) {
                el = document.createElement('div');
                el.id = 'interaction-feedback';
                el.style = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:#c5a059; padding:8px 16px; border:1px solid #c5a059; border-radius:20px; font-size:11px; z-index:10002; pointer-events:none; transition:opacity 0.3s;';
                document.body.appendChild(el);
            }
            el.innerText = msg;
            el.style.opacity = '1';
            setTimeout(() => { if(el) el.style.opacity = '0'; }, 2000);
        }

        // supabaseClient ya inicializado arriba (antes de getStoreData)
        let myNickname = "";
        let myAvatarBody = "male";
        let myAvatarOutfit = "formal";
        let myAvatarStyle = "male-formal";
        let currentAccessRole = "guest";
        let currentMemberProfile = null;
        let currentUserProfile = null;
        let currentUserRole = "guest";
        let hasEnteredMall = false;
        let pendingMemberPhone = "";
        let pendingMemberEmail = "";
        let pendingMemberPhoneOtpType = "phone_change";

        function getSelectedAvatarStyleCode() {
            return `${myAvatarBody}-${myAvatarOutfit}`;
        }

        function parseAvatarStyleCode(styleCode = "1") {
            const raw = String(styleCode || "1").trim().toLowerCase();
            if (raw === "1") return { body: "male", outfit: "formal" };
            if (raw === "2") return { body: "male", outfit: "sport" };
            if (raw === "3") return { body: "female", outfit: "urban" };

            const parts = raw.split("-");
            const body = ["male", "female", "neutral"].includes(parts[0]) ? parts[0] : "neutral";
            const outfit = ["formal", "sport", "urban"].includes(parts[1]) ? parts[1] : "formal";
            return { body, outfit };
        }

        function syncAvatarSelectionUi() {
            document.querySelectorAll('#avatar-selection .avatar-opt').forEach((btn) => {
                const kind = btn.dataset.avatarKind;
                const isSelected = (kind === 'body' && btn.textContent.trim() === ({
                    male: 'Hombre',
                    female: 'Mujer',
                    neutral: 'Otro'
                })[myAvatarBody]) || (kind === 'outfit' && btn.textContent.trim() === ({
                    formal: 'Formal',
                    sport: 'Deportivo',
                    urban: 'Urbano'
                })[myAvatarOutfit]);
                btn.classList.toggle('selected', !!isSelected);
            });
        }

        function normalizeAvatarSelectionPanels() {
            const avatarPanels = document.querySelectorAll('#avatar-selection');
            if (avatarPanels.length > 1) {
                avatarPanels.forEach((panel, index) => {
                    panel.style.display = index === avatarPanels.length - 1 ? 'block' : 'none';
                });
            }
            return avatarPanels.length ? avatarPanels[avatarPanels.length - 1] : null;
        }

        window.selectAvatarBody = function (body, el) {
            myAvatarBody = ["male", "female", "neutral"].includes(body) ? body : "neutral";
            myAvatarStyle = getSelectedAvatarStyleCode();
            document.querySelectorAll('#avatar-selection .avatar-opt[data-avatar-kind=\"body\"]').forEach(btn => btn.classList.remove('selected'));
            if (el) el.classList.add('selected');
        };

        window.selectAvatarOutfit = function (outfit, el) {
            myAvatarOutfit = ["formal", "sport", "urban"].includes(outfit) ? outfit : "formal";
            myAvatarStyle = getSelectedAvatarStyleCode();
            document.querySelectorAll('#avatar-selection .avatar-opt[data-avatar-kind=\"outfit\"]').forEach(btn => btn.classList.remove('selected'));
            if (el) el.classList.add('selected');
        };

        window.selectAvatar = function (legacyStyleCode, el) {
            const parsed = parseAvatarStyleCode(legacyStyleCode);
            myAvatarBody = parsed.body;
            myAvatarOutfit = parsed.outfit;
            myAvatarStyle = getSelectedAvatarStyleCode();
            syncAvatarSelectionUi();
            if (el) el.classList.add('selected');
        };

        window.setEntryMode = function(mode) {
            currentAccessRole = mode;
            const guestPanel = document.getElementById('guest-entry-panel');
            const memberPanel = document.getElementById('member-entry-panel');
            const tenantPanel = document.getElementById('tenant-entry-panel');
            const guestButton = document.getElementById('guest-entry-button');
            const avatarSelection = normalizeAvatarSelectionPanels();
            const secondaryActions = document.getElementById('entry-secondary-actions');
            syncAvatarSelectionUi();

            // Reset visibilities
            if (guestPanel) guestPanel.style.display = (mode === 'guest') ? 'block' : 'none';
            if (memberPanel) memberPanel.style.display = (mode === 'member') ? 'flex' : 'none';
            if (tenantPanel) tenantPanel.style.display = (mode === 'tenant') ? 'flex' : 'none';
            
            const isGuest = (mode === 'guest');
            if (guestButton) guestButton.style.display = isGuest ? 'inline-block' : 'none';
            if (avatarSelection) avatarSelection.style.display = isGuest ? 'block' : 'none';
            if (secondaryActions) secondaryActions.style.display = isGuest ? 'flex' : 'none';
        }
        setTimeout(() => {
            normalizeAvatarSelectionPanels();
            syncAvatarSelectionUi();
        }, 0);

        function setMemberStatus(message, isError = false) {
            const el = document.getElementById('member-entry-status');
            if (el) {
                el.innerText = message;
                el.style.color = isError ? '#ff8866' : '#888';
            }
            const visitorEl = document.getElementById('visitor-login-status');
            if (visitorEl) {
                visitorEl.innerText = message;
                visitorEl.style.color = isError ? '#ff8866' : '#888';
            }
        }

        function normalizePhone(phone) {
            return phone.replace(/[^\d+]/g, '').trim();
        }

        function getMemberDisplayName(user, fallbackEmail = "") {
            return (user?.user_metadata?.nickname || currentMemberProfile?.nickname || fallbackEmail.split('@')[0] || "Socio").trim();
        }

        function buildGuestNickname() {
            const value = Math.floor(1000 + Math.random() * 9000);
            return `Visitante${value}`;
        }

        function buildNpcDisplayName(index = 0) {
            if (Math.random() < 0.38) return buildGuestNickname();
            return CHILEAN_NAMES[index % CHILEAN_NAMES.length];
        }

        function buildRandomAvatarStyle() {
            const bodies = ["male", "female", "neutral"];
            const outfits = ["formal", "sport", "urban"];
            return `${bodies[Math.floor(Math.random() * bodies.length)]}-${outfits[Math.floor(Math.random() * outfits.length)]}`;
        }

        async function upsertUserProfile(user, role = "registered_visitor", displayName = "") {
            if (!supabaseClient || !user) return null;
            const payload = {
                auth_user_id: user.id,
                email: user.email,
                display_name: displayName || user.user_metadata?.nickname || user.email?.split('@')[0] || "",
                role,
                updated_at: new Date().toISOString()
            };
            
            // Si ya tenemos una posición, la preservamos en el upsert
            if (currentUserProfile?.last_pos) {
                payload.last_pos = currentUserProfile.last_pos;
            }
            const { data, error } = await supabaseClient
                .from('user_profiles')
                .upsert(payload, { onConflict: 'auth_user_id' })
                .select()
                .maybeSingle();
            if (error) {
                console.warn("No se pudo guardar perfil de usuario:", error);
                return payload;
            }
            return data || payload;
        }

        async function loadUserProfile(user) {
            if (!supabaseClient || !user) return null;
            const { data, error } = await supabaseClient
                .from('user_profiles')
                .select('*')
                .eq('auth_user_id', user.id)
                .maybeSingle();
            if (error) {
                console.warn("No se pudo leer perfil de usuario:", error);
                return null;
            }
            return data;
        }

        const MALL_ADMIN_EMAILS = new Set([
            "alanmauri4815@gmail.com"
        ]);

        function userHasAdminAccess(profile = null, user = null) {
            const profileEmail = String(profile?.email || "").trim().toLowerCase();
            const userEmail = String(user?.email || "").trim().toLowerCase();
            return profile?.role === "admin" || MALL_ADMIN_EMAILS.has(profileEmail) || MALL_ADMIN_EMAILS.has(userEmail);
        }

        function applyUserRole(profile, user = null) {
            currentUserProfile = profile;
            currentUserRole = profile?.role || "guest";
            const isMallAdmin = userHasAdminAccess(profile, user);
            const btn = document.getElementById('super-admin-btn');
            const btnP = document.getElementById('super-admin-btn-persistent');
            const adminMenuItem = document.getElementById('admin-manage-menu-item');
            const debugPanel = document.getElementById('object-debug-panel');
            const gpsDisplay = document.getElementById('gps-display');
            const adminModal = document.getElementById('super-admin-modal');
            const canShowAdmin = OBJECT_INSPECTOR_ENABLED && isMallAdmin && hasEnteredMall && hasPrivilegedMallSession;
            if (btn) btn.style.display = canShowAdmin ? 'block' : 'none';
            if (btnP) btnP.style.display = canShowAdmin ? 'block' : 'none';
            if (adminMenuItem) adminMenuItem.style.display = canShowAdmin ? 'block' : 'none';
            isAdmin = canShowAdmin;
             
            const axisRef = document.getElementById('axis-reference');
            const compassToggle = document.getElementById('admin-toggle-compass');
            const inspectorToggle = document.getElementById('admin-toggle-inspector');
            const gpsToggle = document.getElementById('admin-toggle-gps');

            // Por defecto ocultas, el admin las activa desde su panel
            if (axisRef) axisRef.style.display = 'none';
            if (debugPanel) debugPanel.style.display = 'none';
            if (gpsDisplay) gpsDisplay.style.display = 'none';
            if (compassToggle) compassToggle.checked = false;
            if (inspectorToggle) inspectorToggle.checked = false;
            if (gpsToggle) gpsToggle.checked = false;
            if (!canShowAdmin && adminModal) adminModal.style.display = 'none';
        }

        window.toggleAdminTool = function(tool, isVisible) {
            if (tool === 'compass') {
                const axisRef = document.getElementById('axis-reference');
                if (axisRef) axisRef.style.display = isVisible ? 'block' : 'none';
            } else if (tool === 'inspector') {
                const debugPanel = document.getElementById('object-debug-panel');
                if (debugPanel) debugPanel.style.display = isVisible ? 'block' : 'none';
            } else if (tool === 'gps') {
                const gpsDisplay = document.getElementById('gps-display');
                if (gpsDisplay) gpsDisplay.style.display = isVisible ? 'block' : 'none';
            }
        }

        const ADMIN_NAV_EYE_HEIGHT_GROUND = 1.7;
        const ADMIN_NAV_EYE_HEIGHT_UPPER = 7.1;
        const ADMIN_NAV_HOTSPOTS = {
            center_p1: {
                label: 'Centro del mall · Planta 1',
                position: { x: -12, y: ADMIN_NAV_EYE_HEIGHT_GROUND, z: -14 },
                target: { x: 0, y: 1.8, z: 8 }
            },
            center_p2: {
                label: 'Centro del mall · Planta 2',
                position: { x: -14, y: ADMIN_NAV_EYE_HEIGHT_UPPER, z: -18 },
                target: { x: 0, y: 6.8, z: 6 }
            },
            south_anchor_p1: {
                label: 'Extremo Sur · Tienda ancla · Planta 1',
                position: { x: 0, y: ADMIN_NAV_EYE_HEIGHT_GROUND, z: -82 },
                target: { x: 0, y: 1.8, z: -98 }
            },
            south_anchor_p2: {
                label: 'Extremo Sur · Tienda ancla · Planta 2',
                position: { x: 0, y: ADMIN_NAV_EYE_HEIGHT_UPPER, z: -84 },
                target: { x: 0, y: 6.8, z: -96 }
            },
            north_anchor_p1: {
                label: 'Extremo Norte · Tienda ancla · Planta 1',
                position: { x: 0, y: ADMIN_NAV_EYE_HEIGHT_GROUND, z: 82 },
                target: { x: 0, y: 1.8, z: 98 }
            },
            north_anchor_p2: {
                label: 'Extremo Norte · Tienda ancla · Planta 2',
                position: { x: 0, y: ADMIN_NAV_EYE_HEIGHT_UPPER, z: 84 },
                target: { x: 0, y: 6.8, z: 96 }
            },
            east_anchor_p1: {
                label: 'Extremo Este · Tienda ancla · Planta 1',
                position: { x: 82, y: ADMIN_NAV_EYE_HEIGHT_GROUND, z: 0 },
                target: { x: 98, y: 1.8, z: 0 }
            },
            east_anchor_p2: {
                label: 'Extremo Este · Tienda ancla · Planta 2',
                position: { x: 84, y: ADMIN_NAV_EYE_HEIGHT_UPPER, z: 0 },
                target: { x: 96, y: 6.8, z: 0 }
            },
            west_anchor_p1: {
                label: 'Extremo Oeste · Tienda ancla · Planta 1',
                position: { x: -82, y: ADMIN_NAV_EYE_HEIGHT_GROUND, z: 0 },
                target: { x: -98, y: 1.8, z: 0 }
            },
            west_anchor_p2: {
                label: 'Extremo Oeste · Tienda ancla · Planta 2',
                position: { x: -84, y: ADMIN_NAV_EYE_HEIGHT_UPPER, z: 0 },
                target: { x: -96, y: 6.8, z: 0 }
            }
        };

        function setAdminHotspotStatus(message = "", tone = "muted") {
            const el = document.getElementById('admin-hotspot-status');
            if (!el) return;
            const palette = {
                muted: '#888',
                error: '#ff8866',
                success: '#7fcf8d',
                warn: '#c5a059'
            };
            el.style.color = palette[tone] || palette.muted;
            el.textContent = message;
        }

        async function persistAdminTeleportState() {
            const state = {
                px: camera.position.x, py: camera.position.y, pz: camera.position.z,
                tx: controls.target.x, ty: controls.target.y, tz: controls.target.z
            };
            localStorage.setItem('mall_admin_last_pos', JSON.stringify(state));
            if (!supabaseClient || !currentUserProfile?.auth_user_id) return;
            try {
                await supabaseClient
                    .from('user_profiles')
                    .update({ last_pos: state })
                    .eq('auth_user_id', currentUserProfile.auth_user_id);
            } catch (_) {}
        }

        window.teleportAdminToHotspot = async function(hotspotKey) {
            if (!isAdmin) {
                setAdminHotspotStatus("Solo el administrador del mall puede usar este desplazamiento.", "error");
                return;
            }
            const hotspot = ADMIN_NAV_HOTSPOTS[hotspotKey];
            if (!hotspot) {
                setAdminHotspotStatus("No encontré ese punto de desplazamiento.", "error");
                return;
            }

            if (!hasEnteredMall) {
                setAdminHotspotStatus("Primero entra al mall con tu sesión administradora.", "warn");
                return;
            }

            if (!isWalking) {
                window.toggleWalkMode();
            }

            currentEscalatorState = null;
            escalatorExitCooldown = null;
            lockWalkModePreference = true;
            camera.position.set(hotspot.position.x, hotspot.position.y, hotspot.position.z);
            controls.target.set(hotspot.target.x, hotspot.target.y, hotspot.target.z);
            controls.update();
            focusMallCanvas();
            broadcastMyPosition();
            await persistAdminTeleportState();
            setAdminHotspotStatus(`Desplazado a ${hotspot.label}.`, "success");
        };

        window.teleportAdminToSelectedHotspot = async function() {
            const select = document.getElementById('admin-hotspot-select');
            const hotspotKey = select?.value || 'center_p1';
            await window.teleportAdminToHotspot(hotspotKey);
        };

        // Administradores y Chat
        const ADMINS = ['javier', 'javi', 'mauri', 'admin'];
        let chatTarget = "";
        let isAdmin = false;
        let isChatOpen = false;
        let unreadCount = 0;

        window.toggleChat = function () {
            isChatOpen = !isChatOpen;
            document.getElementById('mall-chat').style.display = isChatOpen ? 'flex' : 'none';
            document.getElementById('chat-minimized-btn').style.display = isChatOpen ? 'none' : 'flex';
            if (isChatOpen) {
                unreadCount = 0;
                document.getElementById('chat-badge').style.display = 'none';
                const msgs = document.getElementById('chat-messages');
                msgs.scrollTop = msgs.scrollHeight;
            }
        };

        window.setChatTarget = function (user) {
            if (user === myNickname) return;
            chatTarget = user;
            document.getElementById('chat-target-text').innerText = `Privado con: ${user}`;
            document.getElementById('chat-reset-btn').style.display = isAdmin ? 'inline-block' : 'none';
        }

        window.resetChatTarget = function () {
            if (!isAdmin) return;
            chatTarget = "Todos";
            document.getElementById('chat-target-text').innerText = "HABLANDO A: TODOS";
            document.getElementById('chat-reset-btn').style.display = 'none';
        }

        // --- SISTEMA DE GESTIÓN DE LOCATARIOS ---
        let currentTenantUser = null;
        let myOwnedStore = null; // Información de la tienda del locatario logueado
        let myOwnedStores = [];
        let hasPrivilegedMallSession = false;

        function syncTenantManagementAccess() {
            const tenantAccessItem = document.getElementById('tenant-access-btn');
            const hasTenantSession = hasPrivilegedMallSession && !!currentTenantUser && myOwnedStores.length > 0;
            if (tenantAccessItem) tenantAccessItem.innerText = 'Panel Locatario';
        }

        window.toggleTenantLogin = function() {
            closeControlsMenu();
            if (hasPrivilegedMallSession && currentTenantUser) {
                openTenantAdminFromMenu();
                return;
            }
            const modal = document.getElementById('tenant-login-modal');
            modal.style.display = modal.style.display === 'none' ? 'block' : 'none';
        }

        // --- DETECTOR AUTOMÁTICO DE SESIÓN ADMIN ---
        document.addEventListener('DOMContentLoaded', async () => {
            setTimeout(async () => {
                if (!supabaseClient) return;
                const { data: { user } } = await supabaseClient.auth.getUser();
                
                if (user) {
                    currentTenantUser = user;
                    hasPrivilegedMallSession = true;
                    let profile = await loadUserProfile(user);
                    if (!profile) {
                        profile = {
                            auth_user_id: user.id,
                            email: user.email,
                            display_name: user.user_metadata?.brand_name || user.email?.split('@')[0] || "",
                            role: userHasAdminAccess(null, user) ? "admin" : "registered_visitor"
                        };
                    }
                    applyUserRole(profile, user);
                    try {
                        await refreshMyOwnedStoresFromSupabase();
                    } catch (error) {
                        console.warn("No pude restaurar locales de la sesión activa:", error);
                        myOwnedStores = [];
                        myOwnedStore = null;
                    }
                    syncTenantManagementAccess();
                } else {
                    currentTenantUser = null;
                    hasPrivilegedMallSession = false;
                    currentUserProfile = null;
                    currentUserRole = "guest";
                    myOwnedStores = [];
                    myOwnedStore = null;
                    applyUserRole(null, null);
                    syncTenantManagementAccess();
                }
                
                // Nota: Los visuales de las tiendas ahora se cargan "On-Demand" al acercarse
                // para maximizar la velocidad de carga inicial del mall.
            }, 1500);
        });

        window.adminLogout = async function() {
            if (supabaseClient) {
                await supabaseClient.auth.signOut();
                hasEnteredMall = false;
                hasPrivilegedMallSession = false;
                currentTenantUser = null;
                myOwnedStores = [];
                myOwnedStore = null;
                applyUserRole(null, null);
                syncTenantManagementAccess();
                alert("Sesión cerrada correctamente.");
                location.reload(); // Recargar para limpiar estado
            }
        }

        window.submitTenantApplication = async function() {
            if (!supabaseClient) return alert("Error de conexión con el mall.");
            
            const brand = document.getElementById('apply-brand').value.trim();
            const category = document.getElementById('apply-category').value.trim();
            const email = document.getElementById('apply-email').value.trim();
            const phone = document.getElementById('apply-phone').value.trim();
            const social = document.getElementById('apply-social').value.trim();
            
            if(!brand || !email || !phone) return alert("Por favor completa los campos obligatorios.");

            // 1. Guardar en Supabase (Registro histórico)
            const { error } = await supabaseClient.from('tenant_applications').insert([
                { 
                    brand_name: brand, 
                    category: category, 
                    email: email, 
                    phone: phone, 
                    social_link: social,
                    applicant_auth_user_id: currentMemberProfile?.auth_user_id || currentTenantUser?.id || null,
                    status: 'pending'
                }
            ]);
            
            if (error) {
                console.error(error);
                return alert("Error al registrar en la base de datos: " + error.message);
            }

            // 2. Enviar Notificación por Email (vía FormSubmit - Sin claves, directo a tu mail)
            try {
                const response = await fetch("https://formsubmit.co/ajax/8cc3291a2642b51af330138fe38da667", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Accept": "application/json" },
                    body: JSON.stringify({
                        subject: "NUEVA POSTULACIÓN MALL: " + brand,
                        Marca: brand,
                        Giro: category,
                        Email: email,
                        Telefono: phone,
                        Redes: social,
                        _replyto: email
                    })
                });

                if (response.ok) {
                    alert("¡Postulación enviada con éxito! Revisa tu email para activar el sistema (solo la primera vez).");
                    toggleTenantApply();
                } else {
                    alert("Postulación guardada en Supabase. (Notificación vía mail pendiente de activación)");
                    toggleTenantApply();
                }
            } catch (e) {
                console.error("Error envío mail:", e);
                alert("Postulación recibida en base de datos.");
                toggleTenantApply();
            }
        }

        window.toggleTenantApply = function() {
            const modal = document.getElementById('tenant-apply-modal');
            modal.style.display = modal.style.display === 'none' ? 'block' : 'none';
        }

        function setTenantLoginStatus(message, isError = false) {
            const el = document.getElementById('tenant-login-status');
            if (!el) return;
            el.innerText = message;
            el.style.color = isError ? '#ff8866' : '#888';
        }

        async function enterMallWithIdentity({ nickname, role = "guest", user = null, profile = null }) {
            myNickname = nickname;
            currentAccessRole = role;
            currentMemberProfile = role === "member" ? profile : currentMemberProfile;
            hasEnteredMall = true;
            if (window.mallMobileViewport) {
                window.mallMobileViewport.activate();
            }
            applyUserRole(currentUserProfile, currentTenantUser || user);

            if (isAdmin) {
                resetChatTarget();
            } else {
                chatTarget = "";
                document.getElementById('chat-target-text').innerText = "Clickea un jugador para hablarle";
            }

            document.getElementById('login-overlay').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('login-overlay').style.display = 'none';
                document.getElementById('main-header').style.display = 'flex';
                
                let restored = false;
                /* 
                if (isAdmin) {
                    const savedState = currentUserProfile?.last_pos || JSON.parse(localStorage.getItem('mall_admin_last_pos') || "null");
                    if (savedState && typeof savedState.px === 'number') {
                        try {
                            const s = savedState;
                            if (Math.abs(s.px) > 2 || Math.abs(s.pz) > 2) {
                                const safeY = Math.max(s.py || 0, 1.2);
                                camera.position.set(s.px, safeY, s.pz);
                                controls.target.set(s.tx, s.ty, s.tz);
                                restored = true;
                            }
                        } catch(e) { console.warn("Error al restaurar posición admin:", e); }
                    }
                }
                */

                if (!isWalking) {
                    window.toggleWalkMode();
                } 
                if (window.mallMobileViewport) {
                    window.mallMobileViewport.requestLandscape();
                }
                if (role === "guest" || role === "member" || role === "registered_visitor") {
                    preloadStoreContent(renameStoreCode('O101'));
                }
                
                if (!restored) {
                    forceEntrySpawn();
                    requestAnimationFrame(() => {
                        forceEntrySpawn();
                    });
                }
                controls.update();
                focusMallCanvas();
            }, 500);

            initPresence();
        }

        async function resolveTenantEmail(identifier) {
            const clean = String(identifier || "").trim();
            if (!clean) return "";
            if (clean.includes('@')) return clean;
            console.warn("Login de locatario por marca/local deshabilitado para evitar exposicion de correos.");
            return "";
        }

        window.tenantLogin = async function(source = 'modal') {
            const emailInput = source === 'main' ? document.getElementById('tenant-login-email-main') : document.getElementById('tenant-email');
            const passInput = source === 'main' ? document.getElementById('tenant-login-pass-main') : document.getElementById('tenant-pass');
            const identifier = emailInput.value.trim();
            const pass = passInput.value;
            
            if (!supabaseClient) {
                if (window.location.protocol === 'file:') {
                    const msg = window.__mallFileProtocolWarning || "La app esta abierta como archivo. Abre http://localhost:8080/ para entrar como locatario.";
                    if (source === 'main') return setTenantLoginStatus(msg, true);
                    return alert(msg);
                }
                const msg = "Error de conexión con Supabase.";
                if (source === 'main') return setTenantLoginStatus(msg, true);
                return alert(msg);
            }
            if (!identifier || !pass) {
                const msg = "Ingresa el correo y la contraseña de locatario.";
                if (source === 'main') return setTenantLoginStatus(msg, true);
                return alert(msg);
            }

            const email = await resolveTenantEmail(identifier);
            if (!email || !email.includes('@')) {
                const msg = "Por seguridad, el ingreso de locatario ahora requiere correo directo.";
                if (source === 'main') return setTenantLoginStatus(msg, true);
                return alert(msg);
            }
            
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
            if (error) {
                const msg = error.message === "Invalid API key"
                    ? "La clave pública de Supabase no es válida. Revisa que el proyecto use la publishable key correcta."
                    : `No se pudo entrar con "${identifier}" (${email}): ` + error.message;
                if (source === 'main') return setTenantLoginStatus(msg, true);
                return alert(msg);
            }
            
            currentTenantUser = data.user;
            hasPrivilegedMallSession = true;
            let profile = await loadUserProfile(data.user);
            if (!profile) {
                profile = { auth_user_id: data.user.id, email, display_name: data.user.user_metadata?.brand_name || email.split('@')[0], role: "registered_visitor" };
            }
            applyUserRole(profile, data.user);
            
            if (source !== 'main') {
                const modal = document.getElementById('tenant-login-modal');
                if (modal) modal.style.display = 'none';
            }
            
            // Buscar la tienda del dueño
            const { data: storeData } = await supabaseClient.from('stores').select('*').eq('owner_id', data.user.id).limit(20);
            myOwnedStores = storeData || [];
            myOwnedStore = myOwnedStores[0] || null;
            syncTenantManagementAccess();

            if (source === 'main') {
                if (tenantHasDismissedPasswordSetup(data.user)) {
                    const tenantName = myOwnedStore?.name || data.user.user_metadata?.brand_name || email.split('@')[0];
                    setTenantLoginStatus("Sesión iniciada. Entrando al mall...", false);
                    await enterMallWithIdentity({ nickname: `Locatario ${tenantName}`, role: "tenant", user: data.user });
                    applyUserRole(currentUserProfile, data.user);
                    return;
                }
                setTenantLoginStatus("Acceso validado. Puedes cambiar tu clave ahora sin correo o continuar al mall.", false);
                openTenantPasswordSetup({ continueToMall: true });
                return;
            }
            
            if (source === 'main') setTenantLoginStatus("Sesión iniciada. Entrando al mall...");
            else alert("Sesión iniciada con éxito.");
            
        }

        window.openTenantAdminFromMenu = async function() {
            closeControlsMenu();
            if (!currentTenantUser) return alert("Primero inicia sesión como locatario.");
            try {
                await refreshMyOwnedStoresFromSupabase();
            } catch (error) {
                console.error("No pude refrescar los locales del locatario:", error);
            }
            if (!myOwnedStores.length) return alert("Tu cuenta aún no tiene locales asignados.");
            await refreshAdminStoreDisplayCodes();

            if (myOwnedStores.length > 1) {
                const options = myOwnedStores.map(s => `${getAdminStoreDisplayCode(s) || getStoreCode(s)}: ${s.name || 'Local sin nombre'}`).join('\n');
                const selectedCode = prompt(`Tienes más de un local. Escribe el código que quieres gestionar:\n\n${options}`, getAdminStoreDisplayCode(myOwnedStore) || getStoreCode(myOwnedStore) || getAdminStoreDisplayCode(myOwnedStores[0]) || getStoreCode(myOwnedStores[0]));
                if (!selectedCode) return;
                const normalizedSelectedCode = selectedCode.trim().toLowerCase();
                const selected = myOwnedStores.find(s => {
                    const visibleCode = (getAdminStoreDisplayCode(s) || "").toLowerCase();
                    const legacyCode = (getStoreCode(s) || "").toLowerCase();
                    return visibleCode === normalizedSelectedCode || legacyCode === normalizedSelectedCode;
                });
                let currentModalStoreCode = "";
                let currentModalStoreId = "";
                let currentModalStoreData = null;
                if (!selected) return alert("No encontré ese código entre tus locales asignados.");
                myOwnedStore = selected;
            } else {
                myOwnedStore = myOwnedStores[0];
            }

            currentModalStoreCode = getStoreCode(myOwnedStore);
            await openTenantAdmin();
        }

        window.openSuperAdmin = async function() {
            if (!hasEnteredMall) {
                return alert("Primero entra al mall con tu cuenta administradora.");
            }

            let sessionUser = currentTenantUser || null;
            if (supabaseClient && !sessionUser) {
                const { data } = await supabaseClient.auth.getUser();
                sessionUser = data?.user || null;
            }

            let freshProfile = currentUserProfile;
            if (supabaseClient && sessionUser) {
                const loadedProfile = await loadUserProfile(sessionUser);
                if (loadedProfile) {
                    freshProfile = loadedProfile;
                }
                applyUserRole(freshProfile, sessionUser);
            }

            if (!userHasAdminAccess(freshProfile, sessionUser)) {
                return alert("Esta sección es solo para administradores del mall.");
            }
            const modal = document.getElementById('super-admin-modal');
            if (modal) {
                modal.style.display = 'block';
                loadAdminData();
            } else {
                alert("Error: Modal de administración no encontrado.");
            }
        }

        function escapeHtml(value = "") {
            return String(value)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
        }

        function safeHttpUrl(value = "") {
            const raw = String(value || "").trim();
            if (!raw) return "";
            try {
                const url = new URL(raw, window.location.origin);
                if (url.protocol !== "https:" && url.protocol !== "http:") return "";
                return url.href;
            } catch (_) {
                return "";
            }
        }

        function safeImageUrl(value = "") {
            return safeHttpUrl(value);
        }

        function buildSafeMailtoHref(email = "", subject = "") {
            const clean = String(email || "").trim();
            if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(clean)) return "";
            return `mailto:${clean}?subject=${encodeURIComponent(String(subject || ""))}`;
        }

        function buildSafeWhatsAppHref(phone = "", text = "") {
            const digits = String(phone || "").replace(/[^\d]/g, "");
            if (digits.length < 8 || digits.length > 15) return "";
            return `https://wa.me/${digits}?text=${encodeURIComponent(String(text || ""))}`;
        }

        function parseLocalCodes(raw = "") {
            return [...new Set(
                raw
                    .split(',')
                    .map(x => x.trim().toUpperCase())
                    .filter(Boolean)
            )];
        }

        let adminApplicationsCache = [];
        let selectedAdminApplicationId = null;
        let adminManagedStore = null;
        let adminManagedLease = null;
        let adminRentalLoadTimer = null;
        let adminAssignableStoresCache = [];
        let adminStoreDisplayCodeMap = new Map();
        let adminLegacyStoreCodeMap = new Map();
        let adminStoreDisplayCodesLoadedAt = 0;
        const ADMIN_STORE_DISPLAY_CODES_TTL_MS = 5 * 60 * 1000;
        const tenantAdminProductsCache = new Map();
        const tenantAdminProductDrafts = new Map();
        let tenantAdminOpenRequestId = 0;
        const ADMIN_FALLBACK_DISPLAY_CODE_MAP = {
            S101: 'OS-10',
            S102: 'O-107',
            S103: 'O-105',
            S104: 'O-103',
            S105: 'O-101',
            E101: 'SE-10',
            E102: 'S-107',
            E103: 'S-105',
            E104: 'S-103',
            E105: 'S-101',
            N101: 'N101',
            N102: 'O-108',
            N103: 'O-106',
            N104: 'O-104',
            N105: 'O-102',
            O101: 'OS-10',
            O102: 'S-108',
            O103: 'S-106',
            O104: 'S-104',
            O105: 'S-102',
            S201: 'S201',
            S202: 'S202',
            S203: 'S203',
            S204: 'S204',
            S205: 'S205',
            S206: 'S206',
            S207: 'S207',
            E201: 'E201',
            E202: 'E202',
            E203: 'E203',
            E204: 'E204',
            E205: 'E205',
            E206: 'E206',
            E207: 'E207',
            N201: 'N201',
            N202: 'N202',
            N203: 'N203',
            N204: 'N204',
            N205: 'N205',
            N206: 'N206',
            N207: 'N207',
            O201: 'O201',
            O202: 'O202',
            O203: 'O203',
            O204: 'O204',
            O205: 'O205',
            O206: 'O206',
            O207: 'O207'
        };

        function setFieldValue(id, value = "") {
            const el = document.getElementById(id);
            if (!el) return;
            if (el.type === 'checkbox') el.checked = !!value;
            else el.value = value ?? "";
        }

        async function refreshAdminStoreDisplayCodes(force = false) {
            if (
                !force
                && adminStoreDisplayCodesLoadedAt
                && (Date.now() - adminStoreDisplayCodesLoadedAt) < ADMIN_STORE_DISPLAY_CODES_TTL_MS
            ) {
                return;
            }
            adminStoreDisplayCodeMap = new Map();
            adminLegacyStoreCodeMap = new Map();
            Object.entries(ADMIN_FALLBACK_DISPLAY_CODE_MAP).forEach(([sourceCode, displayCode]) => {
                if (sourceCode && displayCode) {
                    adminLegacyStoreCodeMap.set(String(sourceCode).trim().toUpperCase(), String(displayCode).trim());
                }
            });
            if (!supabaseClient) return;

            try {
                let spaces = [];
                const spacesPlural = await supabaseClient
                    .from('physical_spaces')
                    .select('id, source_code, display_code');
                if (!spacesPlural.error && spacesPlural.data?.length) {
                    spaces = spacesPlural.data;
                } else {
                    const spacesSingular = await supabaseClient
                        .from('physical_space')
                        .select('physical_space_id, source_code, display_code');
                    if (!spacesSingular.error && spacesSingular.data?.length) {
                        spaces = spacesSingular.data.map(row => ({
                            id: row.physical_space_id,
                            source_code: row.source_code,
                            display_code: row.display_code
                        }));
                    }
                }

                if (spaces.length) {
                    spaces.forEach((space) => {
                        const displayCode = String(space?.display_code || "").trim();
                        const sourceCode = String(space?.source_code || "").trim().toUpperCase();
                        const spaceId = String(space?.id || "").trim();
                        if (sourceCode && displayCode) {
                            adminLegacyStoreCodeMap.set(sourceCode, displayCode);
                        }
                        if (spaceId && displayCode) {
                            adminLegacyStoreCodeMap.set(spaceId.toUpperCase(), displayCode);
                        }
                    });
                }

                const links = await supabaseClient
                    .from('store_physical_links')
                    .select('store_id, physical_space_id');
                if (links.error || !links.data?.length || !spaces.length) return;

                const spaceCodeById = new Map(
                    spaces
                        .filter(space => (space?.id || '') && (space?.display_code || ''))
                        .map(space => [String(space.id).trim(), String(space.display_code).trim()])
                );

                (links.data || []).forEach((link) => {
                    const storeId = String(link?.store_id || "").trim();
                    const displayCode = spaceCodeById.get(String(link?.physical_space_id || "").trim());
                    if (storeId && displayCode) {
                        adminStoreDisplayCodeMap.set(storeId, displayCode);
                    }
                });
                adminStoreDisplayCodesLoadedAt = Date.now();
            } catch (_) {}
        }

        function getAdminStoreDisplayCode(store) {
            if (!store) return "";
            const byStoreId = adminStoreDisplayCodeMap.get(String(store?.id || "").trim());
            if (byStoreId) return byStoreId;
            const candidates = getStoreCodeCandidates(store).map(value => String(value || "").trim().toUpperCase()).filter(Boolean);
            for (const candidate of candidates) {
                const mapped = adminLegacyStoreCodeMap.get(candidate);
                if (mapped) return mapped;
            }
            return getStoreCode(store);
        }

        function compareAdminStoreCodes(a = "", b = "") {
            return String(a || "").localeCompare(String(b || ""), undefined, { numeric: true, sensitivity: 'base' });
        }

        function getTrimmedValue(id) {
            return String(document.getElementById(id)?.value || "").trim();
        }

        function setAdminStoreSelectOptions(stores = []) {
            const select = document.getElementById('admin-store-select');
            if (!select) return;
            const previousValue = select.value;
            select.innerHTML = '';

            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = stores.length ? 'Selecciona un local disponible' : 'No hay locales disponibles';
            select.appendChild(placeholder);

            [...stores]
                .sort((a, b) => compareAdminStoreCodes(getAdminStoreDisplayCode(a), getAdminStoreDisplayCode(b)))
                .forEach((store) => {
                const option = document.createElement('option');
                const code = getAdminStoreDisplayCode(store) || store.id || 'Sin código';
                const label = store.name ? `${code} · ${store.name}` : code;
                option.value = code;
                option.textContent = label;
                select.appendChild(option);
            });

            if (previousValue && stores.some(store => (getAdminStoreDisplayCode(store) || getStoreCode(store) || store.id || '').toUpperCase() === previousValue.toUpperCase())) {
                select.value = previousValue;
            } else {
                select.value = '';
            }
        }

        function getSelectedAdminStoreCodes() {
            return parseLocalCodes(document.getElementById('admin-local-codes')?.value || "");
        }

        function setSelectedAdminStoreCodes(codes = [], shouldQueueLoad = true) {
            const input = document.getElementById('admin-local-codes');
            if (!input) return;
            input.value = parseLocalCodes((codes || []).join(', ')).join(', ');
            renderSelectedAdminStoreCodes();
            if (shouldQueueLoad) queueAdminRentalLoad();
        }

        window.renderSelectedAdminStoreCodes = function() {
            const container = document.getElementById('admin-selected-store-chips');
            if (!container) return;
            const codes = getSelectedAdminStoreCodes();
            container.innerHTML = '';
            if (!codes.length) return;

            codes.forEach((code) => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.style.display = 'inline-flex';
                chip.style.alignItems = 'center';
                chip.style.gap = '8px';
                chip.style.background = 'rgba(197,160,89,0.14)';
                chip.style.color = '#f2d28a';
                chip.style.border = '1px solid rgba(197,160,89,0.45)';
                chip.style.borderRadius = '999px';
                chip.style.padding = '6px 10px';
                chip.style.cursor = 'pointer';
                chip.style.fontSize = '10px';
                chip.title = `Quitar ${code} de la reasignación`;
                chip.innerHTML = `<span>${escapeHtml(code)}</span><span style="font-weight:700; color:#fff;">×</span>`;
                chip.addEventListener('click', () => removeSelectedAdminStoreCode(code));
                container.appendChild(chip);
            });
        };

        window.removeSelectedAdminStoreCode = function(codeToRemove = "") {
            const normalized = String(codeToRemove || "").trim().toUpperCase();
            if (!normalized) return;
            const nextCodes = getSelectedAdminStoreCodes().filter(code => code !== normalized);
            setSelectedAdminStoreCodes(nextCodes);
            setAdminAssignmentStatus(`Local quitado de la reasignación: ${normalized}.`, "muted");
        };

        function getNullableIntegerValue(id) {
            const raw = getTrimmedValue(id);
            if (!raw) return null;
            const parsed = Number(raw);
            return Number.isFinite(parsed) ? Math.round(parsed) : null;
        }

        function getRequiredIntegerValue(id, fallback = 0) {
            const value = getNullableIntegerValue(id);
            return value === null ? fallback : value;
        }

        function getNullableDateValue(id) {
            const value = getTrimmedValue(id);
            return value || null;
        }

        function getNullableDateTimeValue(id) {
            const value = getTrimmedValue(id);
            if (!value) return null;
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? null : date.toISOString();
        }

        function toDateInputValue(value) {
            if (!value) return "";
            const text = String(value);
            return text.length >= 10 ? text.slice(0, 10) : text;
        }

        function toDateTimeInputValue(value) {
            if (!value) return "";
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return "";
            const offset = date.getTimezoneOffset();
            const local = new Date(date.getTime() - offset * 60000);
            return local.toISOString().slice(0, 16);
        }

        function setAdminRentalStatus(message = "", tone = "muted") {
            const statusEl = document.getElementById('admin-rental-status');
            if (!statusEl) return;
            const palette = {
                muted: '#888',
                error: '#ff8866',
                success: '#7fcf8d',
                warn: '#c5a059'
            };
            statusEl.style.color = palette[tone] || palette.muted;
            statusEl.textContent = message;
        }

        function clearAdminRentalFormState() {
            adminManagedStore = null;
            adminManagedLease = null;
            const rentalEmpty = document.getElementById('admin-rental-empty');
            const rentalContent = document.getElementById('admin-rental-content');
            if (rentalEmpty) rentalEmpty.style.display = 'block';
            if (rentalContent) rentalContent.style.display = 'none';
        }

        function resetAdminRentalForms() {
            [
                'admin-rate-floor',
                'admin-rate-products',
                'admin-rate-monthly',
                'admin-rate-quarterly-total',
                'admin-rate-quarterly-eq',
                'admin-rate-semiannual-total',
                'admin-rate-semiannual-eq',
                'admin-rate-annual-total',
                'admin-rate-annual-eq',
                'admin-rate-notes',
                'admin-lease-status',
                'admin-lease-cycle',
                'admin-lease-monthly-amount',
                'admin-lease-billing-amount',
                'admin-lease-discount',
                'admin-lease-deposit',
                'admin-lease-start-date',
                'admin-lease-end-date',
                'admin-lease-due-day',
                'admin-lease-notes',
                'admin-payment-period-start',
                'admin-payment-period-end',
                'admin-payment-due-date',
                'admin-payment-paid-at',
                'admin-payment-amount-due',
                'admin-payment-amount-paid',
                'admin-payment-late-fee',
                'admin-payment-discount',
                'admin-payment-method',
                'admin-payment-reference',
                'admin-payment-status',
                'admin-payment-notes',
                'admin-note-category',
                'admin-note-visibility',
                'admin-note-text',
                'admin-service-note'
            ].forEach(id => setFieldValue(id, ""));
            setFieldValue('admin-lease-status', 'active');
            setFieldValue('admin-lease-cycle', 'monthly');
            setFieldValue('admin-payment-status', 'pending');
            setFieldValue('admin-note-category', 'general');
            setFieldValue('admin-note-visibility', 'private');
            setFieldValue('admin-note-pinned', false);
            const summary = document.getElementById('admin-rental-store-summary');
            if (summary) summary.textContent = 'Sin local seleccionado.';
            const balanceSummary = document.getElementById('admin-rental-balance-summary');
            if (balanceSummary) balanceSummary.innerHTML = '';
            const leaseHistory = document.getElementById('admin-lease-history');
            if (leaseHistory) leaseHistory.textContent = 'Sin historial cargado.';
            const paymentsHistory = document.getElementById('admin-payments-history');
            if (paymentsHistory) paymentsHistory.textContent = 'Sin pagos registrados.';
            const notesHistory = document.getElementById('admin-notes-history');
            if (notesHistory) notesHistory.textContent = 'Sin observaciones registradas.';
            setAdminRentalStatus("", "muted");
        }

        function fillAdminRateForm(rate = null, store = null) {
            setFieldValue('admin-rate-floor', rate?.floor ?? "");
            setFieldValue('admin-rate-products', rate?.included_products ?? "");
            setFieldValue('admin-rate-monthly', rate?.monthly_amount ?? "");
            setFieldValue('admin-rate-quarterly-total', rate?.quarterly_total ?? "");
            setFieldValue('admin-rate-quarterly-eq', rate?.quarterly_monthly_equivalent ?? "");
            setFieldValue('admin-rate-semiannual-total', rate?.semiannual_total ?? "");
            setFieldValue('admin-rate-semiannual-eq', rate?.semiannual_monthly_equivalent ?? "");
            setFieldValue('admin-rate-annual-total', rate?.annual_total ?? "");
            setFieldValue('admin-rate-annual-eq', rate?.annual_monthly_equivalent ?? "");
            setFieldValue('admin-rate-notes', rate?.notes ?? "");
            if (!rate && store) {
                setFieldValue('admin-rate-floor', store.id?.match(/\d/) ? String(store.id).charAt(0) : "");
            }
        }

        function fillAdminLeaseForm(lease = null, app = null, rate = null) {
            setFieldValue('admin-lease-status', lease?.status || 'active');
            setFieldValue('admin-lease-cycle', lease?.billing_cycle || 'monthly');
            setFieldValue('admin-lease-monthly-amount', lease?.monthly_amount ?? rate?.monthly_amount ?? "");
            setFieldValue('admin-lease-billing-amount', lease?.billing_amount ?? rate?.monthly_amount ?? "");
            setFieldValue('admin-lease-discount', lease?.discount_amount ?? 0);
            setFieldValue('admin-lease-deposit', lease?.deposit_amount ?? 0);
            setFieldValue('admin-lease-start-date', toDateInputValue(lease?.start_date));
            setFieldValue('admin-lease-end-date', toDateInputValue(lease?.end_date));
            setFieldValue('admin-lease-due-day', lease?.due_day ?? 5);
            setFieldValue('admin-lease-notes', lease?.admin_notes ?? "");
            const leaseHistory = document.getElementById('admin-lease-history');
            if (leaseHistory) {
                leaseHistory.textContent = lease
                    ? `Arriendo actual: ${lease.status} | Inicio ${toDateInputValue(lease.start_date) || '-'} | Cobro ${lease.billing_cycle || '-'}`
                    : `Se creará un arriendo nuevo para ${app?.brand_name || 'el locatario'} al guardar.`;
            }
        }

        function fillAdminPaymentForm(lease = null, rate = null) {
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
            setFieldValue('admin-payment-period-start', monthStart);
            setFieldValue('admin-payment-period-end', monthEnd);
            setFieldValue('admin-payment-due-date', monthStart);
            setFieldValue('admin-payment-paid-at', "");
            setFieldValue('admin-payment-amount-due', lease?.billing_amount ?? lease?.monthly_amount ?? rate?.monthly_amount ?? "");
            setFieldValue('admin-payment-amount-paid', lease?.billing_amount ?? lease?.monthly_amount ?? rate?.monthly_amount ?? "");
            setFieldValue('admin-payment-late-fee', 0);
            setFieldValue('admin-payment-discount', 0);
            setFieldValue('admin-payment-method', "");
            setFieldValue('admin-payment-reference', "");
            setFieldValue('admin-payment-status', 'pending');
            setFieldValue('admin-payment-notes', "");
        }

        function renderAdminPaymentsHistory(payments = []) {
            const el = document.getElementById('admin-payments-history');
            if (!el) return;
            if (!payments.length) {
                el.textContent = 'Sin pagos registrados.';
                return;
            }
            el.innerHTML = payments.slice(0, 4).map(payment => {
                const dueDate = toDateInputValue(payment.due_date) || '-';
                const amountDue = Number(payment.amount_due || 0) + Number(payment.late_fee || 0) - Number(payment.discount_amount || 0);
                const amountPaid = Number(payment.amount_paid || 0);
                const outstanding = Math.max(0, amountDue - amountPaid);
                const status = String(payment.status || 'pending').toLowerCase();
                const tone = outstanding > 0 && ['pending', 'partial', 'late'].includes(status) ? '#ffb3ad' : '#7fcf8d';
                return `
                    <div style="padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
                        <div style="display:flex; justify-content:space-between; gap:12px; color:#ddd;">
                            <span>${escapeHtml(dueDate)}</span>
                            <span style="text-transform:uppercase;">${escapeHtml(status)}</span>
                        </div>
                        <div style="display:flex; gap:10px; flex-wrap:wrap; color:#888; margin-top:2px;">
                            <span>Cobrado: $${escapeHtml(amountDue.toLocaleString('es-CL'))}</span>
                            <span>Pagado: $${escapeHtml(amountPaid.toLocaleString('es-CL'))}</span>
                            <span style="color:${tone};">Saldo: $${escapeHtml(outstanding.toLocaleString('es-CL'))}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function renderAdminBalanceSummary(store = null, payments = [], lease = null) {
            const el = document.getElementById('admin-rental-balance-summary');
            if (!el) return;
            if (!store) {
                el.innerHTML = '';
                return;
            }

            const rows = Array.isArray(payments) ? payments : [];
            const totalPaid = rows
                .filter(payment => !['cancelled', 'refunded'].includes(String(payment.status || '').toLowerCase()))
                .reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0);
            const totalBilled = rows
                .filter(payment => !['cancelled', 'refunded'].includes(String(payment.status || '').toLowerCase()))
                .reduce((sum, payment) => sum + Number(payment.amount_due || 0) + Number(payment.late_fee || 0) - Number(payment.discount_amount || 0), 0);
            const totalOutstanding = rows
                .filter(payment => !['cancelled', 'refunded'].includes(String(payment.status || '').toLowerCase()))
                .reduce((sum, payment) => {
                    const outstanding = Number(payment.amount_due || 0) + Number(payment.late_fee || 0) - Number(payment.discount_amount || 0) - Number(payment.amount_paid || 0);
                    return sum + Math.max(0, outstanding);
                }, 0);
            const today = new Date().toISOString().slice(0, 10);
            const overdueCount = rows.filter(payment => {
                const status = String(payment.status || '').toLowerCase();
                const outstanding = Number(payment.amount_due || 0) + Number(payment.late_fee || 0) - Number(payment.discount_amount || 0) - Number(payment.amount_paid || 0);
                return ['pending', 'partial', 'late'].includes(status) && outstanding > 0 && String(payment.due_date || '') < today;
            }).length;
            const serviceStatus = String(store.service_status || lease?.status || 'active').toLowerCase();

            const cards = [
                { label: 'Pagado', value: `$${Number(totalPaid).toLocaleString('es-CL')}`, color: '#7fcf8d' },
                { label: 'Pendiente', value: `$${Number(totalOutstanding).toLocaleString('es-CL')}`, color: totalOutstanding > 0 ? '#ffb3ad' : '#7fcf8d' },
                { label: 'Facturado', value: `$${Number(totalBilled).toLocaleString('es-CL')}`, color: '#c5a059' },
                { label: 'Mora / Servicio', value: `${overdueCount} | ${serviceStatus}`, color: overdueCount > 0 || serviceStatus === 'suspended' ? '#ff8866' : '#7fcf8d' }
            ];

            el.innerHTML = cards.map(card => `
                <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:8px;">
                    <div style="font-size:9px; color:#777; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">${escapeHtml(card.label)}</div>
                    <div style="font-size:13px; color:${card.color}; font-weight:700;">${escapeHtml(card.value)}</div>
                </div>
            `).join('');
        }

        function renderAdminNotesHistory(notes = []) {
            const el = document.getElementById('admin-notes-history');
            if (!el) return;
            if (!notes.length) {
                el.textContent = 'Sin observaciones registradas.';
                return;
            }
            el.innerHTML = notes.slice(0, 4).map(note => {
                const createdAt = note.created_at ? new Date(note.created_at).toLocaleDateString() : '-';
                return `<div>${escapeHtml(createdAt)} | ${escapeHtml(note.category || 'general')} | ${escapeHtml((note.note || '').slice(0, 48))}${(note.note || '').length > 48 ? '…' : ''}</div>`;
            }).join('');
        }

        async function resolveAdminStoreByCode(rawCode = "") {
            const code = String(rawCode || "").trim().toUpperCase();
            if (!code) return { store: null, error: null };

            const byLocalCode = await supabaseClient
                .from('stores')
                .select('*')
                .ilike('local_code', code)
                .maybeSingle();
            if (!byLocalCode.error && byLocalCode.data) return { store: byLocalCode.data, error: null };

            const byId = await supabaseClient
                .from('stores')
                .select('*')
                .eq('id', code)
                .maybeSingle();
            if (!byId.error && byId.data) return { store: byId.data, error: null };

            return { store: null, error: byLocalCode.error || byId.error || null };
        }

        async function resolveAdminStoreForApplication(app = null) {
            if (!app) return { store: null, error: null };
            const requestedCodes = parseLocalCodes(document.getElementById('admin-local-codes')?.value || "");
            for (const code of requestedCodes) {
                const lookup = await resolveAdminStoreByCode(code);
                if (lookup.store || lookup.error) return lookup;
            }

            const lookup = await findAssignableProfileForApplication(app);
            if (lookup.error) return { store: null, error: lookup.error };
            if (lookup.profile?.auth_user_id) {
                const owned = await supabaseClient
                    .from('stores')
                    .select('*')
                    .eq('owner_id', lookup.profile.auth_user_id)
                    .order('local_code', { ascending: true })
                    .limit(1)
                    .maybeSingle();
                if (!owned.error && owned.data) return { store: owned.data, error: null };
                if (owned.error && !isNoRowsError(owned.error)) return { store: null, error: owned.error };
            }

            return { store: null, error: null };
        }

        async function loadAdminRentalData(app = null) {
            const rentalEmpty = document.getElementById('admin-rental-empty');
            const rentalContent = document.getElementById('admin-rental-content');
            if (!rentalEmpty || !rentalContent || !supabaseClient) return;
            if (!app) {
                clearAdminRentalFormState();
                resetAdminRentalForms();
                return;
            }

            const storeLookup = await resolveAdminStoreForApplication(app);
            if (storeLookup.error) {
                clearAdminRentalFormState();
                resetAdminRentalForms();
                setAdminRentalStatus("No pude resolver el local: " + storeLookup.error.message, "error");
                return;
            }

            const store = storeLookup.store;
            if (!store) {
                clearAdminRentalFormState();
                resetAdminRentalForms();
                setAdminRentalStatus("Escribe un código de local o asigna uno para habilitar la gestión comercial.", "warn");
                return;
            }

            adminManagedStore = store;
            rentalEmpty.style.display = 'none';
            rentalContent.style.display = 'flex';

            const summary = document.getElementById('admin-rental-store-summary');
            if (summary) {
                summary.innerHTML = `
                    <strong style="color:#fff;">Local ${escapeHtml(getStoreCode(store) || store.id || 'Sin código')}</strong><br>
                    <span style="color:#aaa;">${escapeHtml(store.name || app.brand_name || 'Sin nombre')}</span><br>
                    <span style="color:#777;">Dueño actual: ${store.owner_id ? 'asignado' : 'disponible'} | Contacto: ${escapeHtml(store.contact_email || app.email || '-')} | Servicio: ${escapeHtml(store.service_status || 'active')}</span>
                `;
            }
            setFieldValue('admin-service-note', store.service_status_note || "");

            const rateRes = await supabaseClient
                .from('store_rent_rates')
                .select('*')
                .eq('store_id', store.id)
                .maybeSingle();
            const rate = !rateRes.error ? rateRes.data : null;
            fillAdminRateForm(rate, store);

            const leaseRes = await supabaseClient
                .from('tenant_leases')
                .select('*')
                .eq('store_id', store.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            adminManagedLease = !leaseRes.error ? leaseRes.data : null;
            fillAdminLeaseForm(adminManagedLease, app, rate);
            fillAdminPaymentForm(adminManagedLease, rate);

            const paymentsRes = await supabaseClient
                .from('tenant_payments')
                .select('*')
                .eq('store_id', store.id)
                .order('due_date', { ascending: false })
                .limit(8);
            const paymentRows = paymentsRes.data || [];
            renderAdminPaymentsHistory(paymentRows);
            renderAdminBalanceSummary(store, paymentRows, adminManagedLease);

            const notesRes = await supabaseClient
                .from('tenant_notes')
                .select('*')
                .eq('store_id', store.id)
                .order('created_at', { ascending: false })
                .limit(8);
            renderAdminNotesHistory(notesRes.data || []);

            setAdminRentalStatus(`Gestión comercial lista para ${getStoreCode(store) || store.id}.`, "success");
        }

        window.queueAdminRentalLoad = function() {
            if (adminRentalLoadTimer) clearTimeout(adminRentalLoadTimer);
            adminRentalLoadTimer = setTimeout(async () => {
                const app = getAdminApplicationById(selectedAdminApplicationId);
                await loadAdminRentalData(app);
            }, 350);
        };

        function isMissingUserProfilesError(error) {
            const message = String(error?.message || "");
            return message.includes("user_profiles") && (
                message.includes("Could not find the table") ||
                message.includes("relation") ||
                message.includes("does not exist")
            );
        }

        function isMissingDeleteAccountRpcError(error) {
            const message = String(error?.message || "");
            return message.includes("delete_mall_account") && (
                message.includes("Could not find the function") ||
                message.includes("does not exist") ||
                message.includes("PGRST")
            );
        }

        function normalizeAssignableProfile(record = {}) {
            if (!record || typeof record !== 'object') return null;
            const authUserId = record.auth_user_id || record.applicant_auth_user_id || record.user_id || record.member_user_id || record.id || null;
            const email = record.email || record.contact_email || "";
            const displayName = record.display_name || record.nickname || record.brand_name || (email ? email.split('@')[0] : "");
            const role = record.role || 'registered_visitor';
            if (!authUserId && !email) return null;
            return {
                auth_user_id: authUserId,
                email,
                display_name: displayName,
                role
            };
        }

        function buildFallbackProfileFromApplication(app = {}) {
            const authUserId = app?.applicant_auth_user_id || app?.auth_user_id || app?.user_id || null;
            const email = String(app?.email || "").trim();
            if (!authUserId || !email) return null;
            return {
                auth_user_id: authUserId,
                email,
                display_name: String(app?.brand_name || email.split('@')[0] || "Locatario").trim(),
                role: 'registered_visitor'
            };
        }

        async function findAssignableProfileByAuthId(authUserId = "") {
            if (!authUserId) {
                return { profile: null, source: 'none', missingUserProfilesTable: false, error: null };
            }

            const userProfileResponse = await supabaseClient
                .from('user_profiles')
                .select('*')
                .eq('auth_user_id', authUserId)
                .maybeSingle();

            if (!userProfileResponse.error) {
                return {
                    profile: normalizeAssignableProfile(userProfileResponse.data),
                    source: 'user_profiles',
                    missingUserProfilesTable: false,
                    error: null
                };
            }

            if (!isMissingUserProfilesError(userProfileResponse.error)) {
                return {
                    profile: null,
                    source: 'user_profiles',
                    missingUserProfilesTable: false,
                    error: userProfileResponse.error
                };
            }

            const memberResponse = await supabaseClient
                .from('mall_members')
                .select('*')
                .eq('auth_user_id', authUserId)
                .maybeSingle();

            if (memberResponse.error) {
                return {
                    profile: null,
                    source: 'mall_members',
                    missingUserProfilesTable: true,
                    error: memberResponse.error
                };
            }

            return {
                profile: normalizeAssignableProfile(memberResponse.data),
                source: 'mall_members',
                missingUserProfilesTable: true,
                error: null
            };
        }

        async function findAssignableProfileByEmail(email = "") {
            const userProfileResponse = await supabaseClient
                .from('user_profiles')
                .select('*')
                .ilike('email', email)
                .maybeSingle();

            if (!userProfileResponse.error) {
                return {
                    profile: normalizeAssignableProfile(userProfileResponse.data),
                    source: 'user_profiles',
                    missingUserProfilesTable: false,
                    error: null
                };
            }

            if (!isMissingUserProfilesError(userProfileResponse.error)) {
                return {
                    profile: null,
                    source: 'user_profiles',
                    missingUserProfilesTable: false,
                    error: userProfileResponse.error
                };
            }

            const memberResponse = await supabaseClient
                .from('mall_members')
                .select('*')
                .ilike('email', email)
                .maybeSingle();

            if (memberResponse.error) {
                return {
                    profile: null,
                    source: 'mall_members',
                    missingUserProfilesTable: true,
                    error: memberResponse.error
                };
            }

            return {
                profile: normalizeAssignableProfile(memberResponse.data),
                source: 'mall_members',
                missingUserProfilesTable: true,
                error: null
            };
        }

        async function findAssignableProfileForApplication(app) {
            const directAuthId = app?.applicant_auth_user_id || app?.auth_user_id || app?.user_id || null;
            if (directAuthId) {
                const byAuthId = await findAssignableProfileByAuthId(directAuthId);
                if (byAuthId.profile || byAuthId.error) return byAuthId;
            }
            const byEmail = await findAssignableProfileByEmail(app?.email || "");
            if (byEmail.profile || byEmail.error) return byEmail;

            const fallbackProfile = buildFallbackProfileFromApplication(app);
            return {
                profile: fallbackProfile,
                source: fallbackProfile ? 'tenant_application' : 'none',
                missingUserProfilesTable: false,
                error: null
            };
        }

        async function persistTenantRole(profile, brandName = "") {
            if (profile?.role === 'admin') {
                return { ok: true, fallback: false, skipped: true, error: null };
            }

            const payload = {
                auth_user_id: profile.auth_user_id,
                email: profile.email,
                display_name: profile.display_name || brandName || profile.email.split('@')[0],
                role: 'tenant',
                updated_at: new Date().toISOString()
            };

            const profileWrite = await supabaseClient
                .from('user_profiles')
                .upsert(payload, { onConflict: 'auth_user_id' });

            if (!profileWrite.error) {
                return { ok: true, fallback: false, error: null };
            }

            if (!isMissingUserProfilesError(profileWrite.error)) {
                return { ok: false, fallback: false, error: profileWrite.error };
            }

            const memberWrite = await supabaseClient
                .from('mall_members')
                .update({ updated_at: new Date().toISOString() })
                .or(`auth_user_id.eq.${profile.auth_user_id},id.eq.${profile.auth_user_id}`);

            return {
                ok: !memberWrite.error,
                fallback: true,
                error: memberWrite.error || null
            };
        }

        async function deleteMallAccountForApplication(appId) {
            const app = getAdminApplicationById(appId);
            if (!app?.email) {
                setAdminAssignmentStatus("No encontré la postulación seleccionada.", "error");
                return;
            }

            const lookup = await findAssignableProfileForApplication(app);
            if (lookup.error) {
                setAdminAssignmentStatus("No pude buscar la cuenta a eliminar: " + lookup.error.message, "error");
                return;
            }

            const profile = lookup.profile;
            const targetEmail = String(app.email || profile?.email || "").trim().toLowerCase();
            const targetAuthUserId = profile?.auth_user_id || app?.applicant_auth_user_id || null;
            const protectedAdmin = String(profile?.role || "").toLowerCase() === 'admin';

            if (!targetEmail && !targetAuthUserId) {
                setAdminAssignmentStatus("No pude identificar la cuenta a eliminar.", "error");
                return;
            }

            if (protectedAdmin) {
                setAdminAssignmentStatus("Esa cuenta es administradora y no puede eliminarse desde este panel.", "warn");
                return;
            }

            const confirmationLabel = targetEmail || targetAuthUserId;
            const confirmed = confirm(`Se eliminará la cuenta ${confirmationLabel}, se liberarán sus locales y se limpiarán sus perfiles. Esta acción no se puede deshacer.\n\n¿Continuar?`);
            if (!confirmed) return;

            setAdminAssignmentStatus("Eliminando cuenta y liberando locales...", "muted");

            const { data, error } = await supabaseClient.rpc('delete_mall_account', {
                target_auth_user_id: targetAuthUserId,
                target_email: targetEmail || null
            });

            if (error) {
                if (isMissingDeleteAccountRpcError(error)) {
                    setAdminAssignmentStatus("Falta instalar la función SQL delete_mall_account en Supabase. Ejecuta el archivo supabase/admin_delete_accounts.sql.", "error");
                    return;
                }
                setAdminAssignmentStatus("No pude eliminar la cuenta: " + error.message, "error");
                return;
            }

            const result = Array.isArray(data) ? data[0] : data;
            const releasedStores = Number(result?.released_stores || 0);
            const deletedApplications = Number(result?.deleted_applications || 0);
            const deletedProfiles = Number(result?.deleted_profiles || 0);
            const deletedMembers = Number(result?.deleted_members || 0);
            const deletedAuthUsers = Number(result?.deleted_auth_users || 0);

            await loadAdminData();

            const brandEl = document.getElementById('admin-selected-brand');
            const categoryEl = document.getElementById('admin-selected-category');
            const contactEl = document.getElementById('admin-selected-contact');
            const statusEl = document.getElementById('admin-selected-status');
            const profileStatusEl = document.getElementById('admin-selected-profile-status');
            const assignedStoresEl = document.getElementById('admin-assigned-stores');
            if (brandEl) brandEl.textContent = "Cuenta eliminada";
            if (categoryEl) categoryEl.textContent = "El acceso del postulante fue removido por administrador";
            if (contactEl) contactEl.textContent = targetEmail || "";
            if (statusEl) statusEl.textContent = "Estado: ELIMINADA";
            if (profileStatusEl) profileStatusEl.textContent = "";
            if (assignedStoresEl) assignedStoresEl.textContent = "Locales asignados: ninguno.";
            selectedAdminApplicationId = null;

            setAdminAssignmentStatus(
                `Cuenta eliminada. Locales liberados: ${releasedStores}. Postulaciones eliminadas: ${deletedApplications}. Perfiles borrados: ${deletedProfiles}. Miembros borrados: ${deletedMembers}. Usuarios Auth borrados: ${deletedAuthUsers}.`,
                "success"
            );
        }

        function setAdminAssignmentStatus(message = "", tone = "muted") {
            const statusEl = document.getElementById('admin-assignment-status');
            if (!statusEl) return;
            const palette = {
                muted: '#888',
                error: '#ff8866',
                success: '#7fcf8d',
                warn: '#c5a059'
            };
            statusEl.style.color = palette[tone] || palette.muted;
            statusEl.textContent = message;
        }

        function getAdminApplicationById(appId) {
            return adminApplicationsCache.find(app => String(app.id) === String(appId)) || null;
        }

        async function refreshAdminProfileIndicator(email = "") {
            const target = document.getElementById('admin-selected-profile-status');
            if (!target) return;
            target.textContent = "";
            if (!email) return;

            const app = getAdminApplicationById(selectedAdminApplicationId);
            const lookup = app ? await findAssignableProfileForApplication(app) : await findAssignableProfileByEmail(email);

            if (lookup.error) {
                target.style.color = '#ff8866';
                target.textContent = "No pude verificar si ya tiene cuenta creada.";
                return;
            }

            const profile = lookup.profile;
            if (profile?.auth_user_id) {
                target.style.color = '#7fcf8d';
                target.textContent = lookup.missingUserProfilesTable
                    ? `Cuenta encontrada en mall_members. Falta aplicar user_profiles; continuaré con compatibilidad temporal.`
                    : `Cuenta encontrada. Rol actual: ${profile.role || 'sin rol'}.`;
            } else {
                target.style.color = '#c5a059';
                target.textContent = lookup.missingUserProfilesTable
                    ? "No encontré al usuario en mall_members. Puedes reservar locales ahora y vincularlos cuando se registre."
                    : "Todavía no tiene cuenta creada. Puedes reservar locales ahora y vincularlos cuando se registre.";
            }
        }

        async function refreshAdminAssignedStores(app = null) {
            const target = document.getElementById('admin-assigned-stores');
            if (!target) return [];
            target.textContent = "";
            if (!app) return [];
            await refreshAdminStoreDisplayCodes();

            const lookup = await findAssignableProfileForApplication(app);
            if (lookup.error) {
                target.style.color = '#ff8866';
                target.textContent = "No pude verificar los locales asignados.";
                return [];
            }

            const profile = lookup.profile;
            if (!profile?.auth_user_id) {
                const { data: reservedStores, error: reservedError } = await supabaseClient
                    .from('stores')
                    .select('id, local_code, name, owner_id, contact_email')
                    .ilike('contact_email', app.email)
                    .order('local_code', { ascending: true });

                if (reservedError) {
                    target.style.color = '#ff8866';
                    target.textContent = "No pude leer locales reservados: " + reservedError.message;
                    return [];
                }

                const labels = (reservedStores || []).map(store => {
                    const code = getAdminStoreDisplayCode(store) || 'Sin código';
                    const name = store.name ? ` (${store.name})` : '';
                    return `${code}${name}`;
                });

                target.style.color = labels.length ? '#c5a059' : '#777';
                target.textContent = labels.length
                    ? `Locales reservados para este correo: ${labels.join(', ')}`
                    : "Locales asignados: sin cuenta vinculada.";
                return reservedStores || [];
            }

            const { data: ownedStores, error } = await supabaseClient
                .from('stores')
                .select('id, local_code, name, owner_id')
                .eq('owner_id', profile.auth_user_id)
                .order('local_code', { ascending: true });

            if (error) {
                target.style.color = '#ff8866';
                target.textContent = "No pude leer los locales asignados: " + error.message;
                return [];
            }

            const labels = (ownedStores || []).map(store => {
                const code = getAdminStoreDisplayCode(store) || 'Sin código';
                const name = store.name ? ` (${store.name})` : '';
                return `${code}${name}`;
            });

            target.style.color = labels.length ? '#7fcf8d' : '#888';
            target.textContent = labels.length
                ? `Locales asignados: ${labels.join(', ')}`
                : "Locales asignados: ninguno.";
            return ownedStores || [];
        }

        async function refreshAdminAvailableStores(app = null) {
            const target = document.getElementById('admin-available-stores');
            if (!target || !supabaseClient) return;
            await refreshAdminStoreDisplayCodes();

            const { data: stores, error } = await supabaseClient
                .from('stores')
                .select('id, local_code, name, owner_id, contact_email')
                .order('local_code', { ascending: true });

            if (error) {
                adminAssignableStoresCache = [];
                setAdminStoreSelectOptions([]);
                target.style.color = '#ff8866';
                target.textContent = "No pude cargar los locales disponibles: " + error.message;
                return;
            }

            let allowedOwnerId = null;
            let allowedReservationEmail = "";
            if (app) {
                const lookup = await findAssignableProfileForApplication(app);
                if (lookup.profile?.auth_user_id) {
                    allowedOwnerId = lookup.profile.auth_user_id;
                }
                allowedReservationEmail = String(app.email || "").trim().toLowerCase();
            }

            const assignableStores = (stores || [])
                .filter(store => {
                    const reservedEmail = String(store.contact_email || "").trim().toLowerCase();
                    const availableByOwner = !store.owner_id || (allowedOwnerId && store.owner_id === allowedOwnerId);
                    const availableByReservation = !reservedEmail || (allowedReservationEmail && reservedEmail === allowedReservationEmail);
                    return availableByOwner && availableByReservation;
                })
                .filter(store => {
                    const code = getAdminStoreDisplayCode(store);
                    return !!code && code.includes('-');
                });
            adminAssignableStoresCache = assignableStores;
            setAdminStoreSelectOptions(assignableStores);

            if (!assignableStores.length) {
                target.style.color = '#c5a059';
                target.textContent = "No hay locales nuevos con guión disponibles para asignar en este momento.";
                return;
            }

            const labels = assignableStores.slice(0, 12).map(store => {
                const code = getAdminStoreDisplayCode(store) || store.id || 'Sin código';
                return store.name ? `${code} (${store.name})` : code;
            });
            const extraCount = Math.max(0, assignableStores.length - labels.length);

            target.style.color = '#7fcf8d';
            target.textContent = `Disponibles para asignar: ${labels.join(', ')}${extraCount ? ` y ${extraCount} más.` : '.'}`;
        }

        window.appendSelectedAdminStoreCode = function() {
            const select = document.getElementById('admin-store-select');
            if (!select) return;
            const selectedCode = String(select.value || "").trim().toUpperCase();
            if (!selectedCode) {
                setAdminAssignmentStatus("Selecciona un local en la lista desplegable.", "warn");
                return;
            }
            const currentCodes = getSelectedAdminStoreCodes();
            if (!currentCodes.includes(selectedCode)) {
                currentCodes.push(selectedCode);
            }
            setSelectedAdminStoreCodes(currentCodes);
            setAdminAssignmentStatus(`Local agregado a la asignación: ${selectedCode}.`, "muted");
        };

        window.clearSelectedAdminStoreCodes = function() {
            setSelectedAdminStoreCodes([]);
            setAdminAssignmentStatus("Selección de locales limpiada.", "muted");
        };

        window.openTenantApproval = async function(appId) {
            const app = getAdminApplicationById(appId);
            const emptyState = document.getElementById('admin-selection-empty');
            const content = document.getElementById('admin-selection-content');
            if (!app || !emptyState || !content) return;

            selectedAdminApplicationId = app.id;
            emptyState.style.display = 'none';
            content.style.display = 'flex';
            document.getElementById('admin-selected-brand').textContent = app.brand_name || 'Sin marca';
            document.getElementById('admin-selected-category').textContent = app.category || 'Sin categoria';
            document.getElementById('admin-selected-contact').textContent = `${app.email || ''}${app.phone ? ' | ' + app.phone : ''}`;
            document.getElementById('admin-selected-status').textContent = `Estado: ${(app.status || 'pending').toUpperCase()}`;
            setSelectedAdminStoreCodes([], false);
            setAdminStoreSelectOptions([]);
            setAdminAssignmentStatus("Selecciona los locales que debe conservar esta cuenta. La asignación reemplaza los locales anteriores.", "muted");
            await refreshAdminProfileIndicator(app.email || "");
            const ownedStores = await refreshAdminAssignedStores(app);
            const ownedCodes = (ownedStores || []).map(store => getAdminStoreDisplayCode(store)).filter(Boolean);
            setSelectedAdminStoreCodes(ownedCodes, false);
            await refreshAdminAvailableStores(app);
            await loadAdminRentalData(app);
        }

        async function assignStoresToApplicant(appId) {
            const app = getAdminApplicationById(appId);
            if (!app?.email) {
                setAdminAssignmentStatus("No encontré la postulación seleccionada.", "error");
                return;
            }
            await refreshAdminStoreDisplayCodes();

            const rawCodes = document.getElementById('admin-local-codes')?.value || "";
            const requestedCodes = parseLocalCodes(rawCodes);
            if (!requestedCodes.length) {
                setAdminAssignmentStatus("Ingresa al menos un código de local válido.", "error");
                return;
            }

            const lookup = await findAssignableProfileForApplication(app);
            const profile = lookup.profile;
            if (lookup.error) {
                setAdminAssignmentStatus("No pude buscar el usuario: " + lookup.error.message, "error");
                return;
            }
            const fallbackProfile = !profile?.auth_user_id && currentTenantUser && currentTenantUser.email && currentTenantUser.email.toLowerCase() === String(app.email || "").toLowerCase()
                ? {
                    auth_user_id: currentTenantUser.id,
                    email: currentTenantUser.email,
                    display_name: currentTenantUser.user_metadata?.nickname || currentTenantUser.email.split('@')[0],
                    role: currentUserRole || 'registered_visitor'
                }
                : null;
            const effectiveProfile = profile?.auth_user_id ? profile : fallbackProfile;
            const hasLinkedAccount = !!effectiveProfile?.auth_user_id;

            const { data: allStores, error: storesErr } = await supabaseClient
                .from('stores')
                .select('*');
            if (storesErr) {
                setAdminAssignmentStatus("No pude leer locales: " + storesErr.message, "error");
                return;
            }

            const byCode = new Map();
            (allStores || []).forEach(s => {
                const displayCode = getAdminStoreDisplayCode(s);
                if (displayCode) byCode.set(String(displayCode).toUpperCase(), s);
                if (s.local_code) byCode.set(String(s.local_code).toUpperCase(), s);
                if (s.id) byCode.set(String(s.id).toUpperCase(), s);
            });

            const resolved = requestedCodes.map(c => ({ requested: c, store: byCode.get(c) || null }));
            const missing = resolved.filter(x => !x.store).map(x => x.requested);
            if (missing.length) {
                setAdminAssignmentStatus("Estos códigos no existen: " + missing.join(', '), "error");
                return;
            }

            const applicantEmail = String(app.email || "").trim().toLowerCase();
            const alreadyTaken = resolved
                .filter(x => {
                    const ownerTaken = x.store.owner_id && (!hasLinkedAccount || x.store.owner_id !== effectiveProfile.auth_user_id);
                    const reservedByOther = !x.store.owner_id
                        && x.store.contact_email
                        && String(x.store.contact_email || "").trim().toLowerCase() !== applicantEmail;
                    return ownerTaken || reservedByOther;
                })
                .map(x => getStoreCode(x.store));
            if (alreadyTaken.length) {
                setAdminAssignmentStatus("Estos locales ya tienen otro locatario o reserva: " + alreadyTaken.join(', '), "error");
                return;
            }

            const storesToAssign = [...new Map(
                resolved
                    .filter(x => x.store?.id)
                    .map(x => [String(x.store.id), x.store])
            ).values()];
            const storeIdsToAssign = storesToAssign.map(store => store.id);
            const storeCodesToAssign = storesToAssign.map(store => getAdminStoreDisplayCode(store)).filter(Boolean);
            if (!storeIdsToAssign.length) {
                setAdminAssignmentStatus("No hay locales válidos para asignar.", "error");
                return;
            }

            if (!hasLinkedAccount) {
                const reservationPayload = {
                    contact_email: app.email,
                    contact_phone: app.phone || null,
                    whatsapp: app.phone || null,
                    category: app.category || null,
                    name: app.brand_name || storesToAssign[0]?.name || 'Local reservado',
                    service_status: 'reserved',
                    service_status_note: 'Reserva creada desde postulación pendiente de cuenta.',
                    updated_at: new Date().toISOString()
                };

                const { error: reserveErr } = await supabaseClient
                    .from('stores')
                    .update(reservationPayload)
                    .in('id', storeIdsToAssign);
                if (reserveErr) {
                    setAdminAssignmentStatus("No pude reservar los locales: " + reserveErr.message, "error");
                    return;
                }

                if (app.id) {
                    await supabaseClient
                        .from('tenant_applications')
                        .update({ status: 'approved' })
                        .eq('id', app.id);
                } else {
                    await supabaseClient
                        .from('tenant_applications')
                        .update({ status: 'approved' })
                        .eq('email', app.email);
                }

                await loadAdminData();
                await openTenantApproval(app.id);
                document.getElementById('admin-local-codes').value = storeCodesToAssign.join(', ');
                setAdminAssignmentStatus(
                    `Locales reservados para ${app.email}: ${storeCodesToAssign.join(', ')}. Cuando la postulante cree su cuenta con ese correo, podrás vincular la propiedad definitiva.`,
                    "warn"
                );
                return;
            }

            const currentlyOwnedStores = (allStores || []).filter(store => store.owner_id === effectiveProfile.auth_user_id);
            const selectedStoreIds = new Set(storeIdsToAssign.map(id => String(id)));
            const storeIdsToRelease = currentlyOwnedStores
                .filter(store => !selectedStoreIds.has(String(store.id)))
                .map(store => store.id);

            if (storeIdsToRelease.length) {
                const { error: releaseErr } = await supabaseClient
                    .from('stores')
                    .update({ owner_id: null })
                    .in('id', storeIdsToRelease);
                if (releaseErr) {
                    setAdminAssignmentStatus("No pude liberar los locales anteriores: " + releaseErr.message, "error");
                    return;
                }
            }

            const { error: assignErr } = await supabaseClient
                .from('stores')
                .update({ owner_id: effectiveProfile.auth_user_id })
                .in('id', storeIdsToAssign);
            if (assignErr) {
                setAdminAssignmentStatus("Error al asignar locales: " + assignErr.message, "error");
                return;
            }

            const { data: verificationRows, error: verificationErr } = await supabaseClient
                .from('stores')
                .select('id, owner_id')
                .in('id', storeIdsToAssign);
            if (verificationErr) {
                setAdminAssignmentStatus("No pude verificar la asignación: " + verificationErr.message, "error");
                return;
            }
            const notAssigned = (verificationRows || [])
                .filter(row => row.owner_id !== effectiveProfile.auth_user_id)
                .map(row => row.id);
            if (notAssigned.length || !verificationRows || verificationRows.length !== storeIdsToAssign.length) {
                setAdminAssignmentStatus("La base no permitió asignar estos locales: " + (notAssigned.length ? notAssigned.join(', ') : storeIdsToAssign.join(', ')) + ". Revisa las políticas RLS en Supabase.", "error");
                return;
            }

            const roleWrite = await persistTenantRole(effectiveProfile, app.brand_name || "");
            const roleWarningMessage = !roleWrite.ok
                ? "El local quedó asignado, pero no pude registrar el rol de locatario: " + roleWrite.error.message
                : null;

            if (app.id) {
                await supabaseClient
                    .from('tenant_applications')
                    .update({ status: 'approved' })
                    .eq('id', app.id);
            } else {
                await supabaseClient
                    .from('tenant_applications')
                    .update({ status: 'approved' })
                    .eq('email', app.email);
            }

            await loadAdminData();
            await openTenantApproval(app.id);
            document.getElementById('admin-local-codes').value = storeCodesToAssign.join(', ');
            setAdminAssignmentStatus(
                roleWarningMessage
                    ? roleWarningMessage
                : roleWrite.skipped
                    ? "Locales asignados. La cuenta mantuvo su rol de administrador."
                : roleWrite.fallback
                    ? "Locales asignados con compatibilidad temporal. Falta crear user_profiles en Supabase."
                    : `Locales asignados: ${storeCodesToAssign.join(', ')}${storeIdsToRelease.length ? ` | liberados: ${storeIdsToRelease.length}` : ''}.`,
                roleWarningMessage || roleWrite.fallback ? "warn" : "success"
            );
        }

        window.rejectTenantApplication = async function(appId) {
            const { error } = await supabaseClient
                .from('tenant_applications')
                .update({ status: 'rejected' })
                .eq('id', appId);
            if (error) {
                setAdminAssignmentStatus("No se pudo rechazar: " + error.message, "error");
                return;
            }
            await loadAdminData();
            await openTenantApproval(appId);
            setAdminAssignmentStatus("Postulación marcada como rechazada.", "warn");
        }

        window.cancelTenantApplication = async function(appId) {
            const app = getAdminApplicationById(appId);
            if (!app) {
                setAdminAssignmentStatus("Selecciona una postulación primero.", "error");
                return;
            }

            const label = app.brand_name || app.email || "esta postulación";
            const confirmed = confirm(`Se marcará "${label}" como cancelada y dejará de aparecer en la lista principal. No se borrará de Supabase.\n\n¿Continuar?`);
            if (!confirmed) return;

            const { error } = await supabaseClient
                .from('tenant_applications')
                .update({ status: 'cancelled' })
                .eq('id', appId);
            if (error) {
                setAdminAssignmentStatus("No se pudo cancelar: " + error.message, "error");
                return;
            }

            selectedAdminApplicationId = null;
            clearAdminRentalFormState();
            resetAdminRentalForms();
            await loadAdminData();
            setAdminAssignmentStatus("Postulación cancelada y archivada.", "warn");
        }

        window.approveSelectedTenantApplication = async function() {
            if (!selectedAdminApplicationId) {
                setAdminAssignmentStatus("Selecciona una postulación primero.", "error");
                return;
            }
            await assignStoresToApplicant(selectedAdminApplicationId);
        }

        window.rejectSelectedTenantApplication = async function() {
            if (!selectedAdminApplicationId) {
                setAdminAssignmentStatus("Selecciona una postulación primero.", "error");
                return;
            }
            await rejectTenantApplication(selectedAdminApplicationId);
        }

        window.cancelSelectedTenantApplication = async function() {
            if (!selectedAdminApplicationId) {
                setAdminAssignmentStatus("Selecciona una postulación primero.", "error");
                return;
            }
            await cancelTenantApplication(selectedAdminApplicationId);
        }

        window.saveAdminRentRate = async function() {
            const app = getAdminApplicationById(selectedAdminApplicationId);
            if (!adminManagedStore || !app) {
                setAdminRentalStatus("Selecciona un local primero.", "error");
                return;
            }

            const payload = {
                store_id: adminManagedStore.id,
                local_code: getStoreCode(adminManagedStore) || adminManagedStore.id,
                floor: getNullableIntegerValue('admin-rate-floor'),
                included_products: getNullableIntegerValue('admin-rate-products'),
                monthly_amount: getRequiredIntegerValue('admin-rate-monthly', 0),
                quarterly_total: getNullableIntegerValue('admin-rate-quarterly-total'),
                quarterly_monthly_equivalent: getNullableIntegerValue('admin-rate-quarterly-eq'),
                semiannual_total: getNullableIntegerValue('admin-rate-semiannual-total'),
                semiannual_monthly_equivalent: getNullableIntegerValue('admin-rate-semiannual-eq'),
                annual_total: getNullableIntegerValue('admin-rate-annual-total'),
                annual_monthly_equivalent: getNullableIntegerValue('admin-rate-annual-eq'),
                notes: getTrimmedValue('admin-rate-notes') || null,
                active: true,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabaseClient
                .from('store_rent_rates')
                .upsert(payload, { onConflict: 'store_id' });
            if (error) {
                setAdminRentalStatus("No pude guardar la tarifa: " + error.message, "error");
                return;
            }

            await loadAdminRentalData(app);
            setAdminRentalStatus("Tarifa del local guardada correctamente.", "success");
        };

        window.saveAdminLease = async function() {
            const app = getAdminApplicationById(selectedAdminApplicationId);
            if (!adminManagedStore || !app) {
                setAdminRentalStatus("Selecciona un local primero.", "error");
                return;
            }

            const lookup = await findAssignableProfileForApplication(app);
            if (lookup.error) {
                setAdminRentalStatus("No pude resolver el locatario del arriendo: " + lookup.error.message, "error");
                return;
            }
            const profile = lookup.profile || buildFallbackProfileFromApplication(app);
            if (!profile?.auth_user_id) {
                setAdminRentalStatus("El locatario aún no tiene cuenta vinculada.", "error");
                return;
            }

            const payload = {
                store_id: adminManagedStore.id,
                local_code: getStoreCode(adminManagedStore) || adminManagedStore.id,
                tenant_auth_user_id: profile.auth_user_id,
                tenant_application_id: app.id ? String(app.id) : null,
                tenant_name_snapshot: app.brand_name || profile.display_name || null,
                tenant_email_snapshot: app.email || profile.email || null,
                tenant_phone_snapshot: app.phone || null,
                status: getTrimmedValue('admin-lease-status') || 'active',
                billing_cycle: getTrimmedValue('admin-lease-cycle') || 'monthly',
                monthly_amount: getRequiredIntegerValue('admin-lease-monthly-amount', 0),
                billing_amount: getNullableIntegerValue('admin-lease-billing-amount'),
                discount_amount: getRequiredIntegerValue('admin-lease-discount', 0),
                deposit_amount: getRequiredIntegerValue('admin-lease-deposit', 0),
                start_date: getNullableDateValue('admin-lease-start-date') || new Date().toISOString().slice(0, 10),
                end_date: getNullableDateValue('admin-lease-end-date'),
                due_day: getRequiredIntegerValue('admin-lease-due-day', 5),
                contract_signed_at: adminManagedLease?.contract_signed_at || new Date().toISOString(),
                admin_notes: getTrimmedValue('admin-lease-notes') || null,
                created_by: currentTenantUser?.id || null,
                updated_at: new Date().toISOString()
            };

            let response;
            if (adminManagedLease?.id) {
                response = await supabaseClient
                    .from('tenant_leases')
                    .update(payload)
                    .eq('id', adminManagedLease.id);
            } else {
                response = await supabaseClient
                    .from('tenant_leases')
                    .insert([payload]);
            }

            if (response.error) {
                setAdminRentalStatus("No pude guardar el arriendo: " + response.error.message, "error");
                return;
            }

            await loadAdminRentalData(app);
            setAdminRentalStatus("Arriendo guardado correctamente.", "success");
        };

        window.saveAdminPayment = async function() {
            const app = getAdminApplicationById(selectedAdminApplicationId);
            if (!adminManagedStore || !app) {
                setAdminRentalStatus("Selecciona un local primero.", "error");
                return;
            }
            if (!adminManagedLease?.id) {
                setAdminRentalStatus("Primero guarda un arriendo para este local.", "error");
                return;
            }

            const payload = {
                lease_id: adminManagedLease.id,
                store_id: adminManagedStore.id,
                local_code: getStoreCode(adminManagedStore) || adminManagedStore.id,
                tenant_auth_user_id: adminManagedLease.tenant_auth_user_id || app.applicant_auth_user_id || null,
                period_start: getNullableDateValue('admin-payment-period-start'),
                period_end: getNullableDateValue('admin-payment-period-end'),
                due_date: getNullableDateValue('admin-payment-due-date') || new Date().toISOString().slice(0, 10),
                paid_at: getNullableDateTimeValue('admin-payment-paid-at'),
                amount_due: getRequiredIntegerValue('admin-payment-amount-due', 0),
                amount_paid: getRequiredIntegerValue('admin-payment-amount-paid', 0),
                late_fee: getRequiredIntegerValue('admin-payment-late-fee', 0),
                discount_amount: getRequiredIntegerValue('admin-payment-discount', 0),
                payment_method: getTrimmedValue('admin-payment-method') || null,
                payment_reference: getTrimmedValue('admin-payment-reference') || null,
                status: getTrimmedValue('admin-payment-status') || 'pending',
                notes: getTrimmedValue('admin-payment-notes') || null,
                recorded_by: currentTenantUser?.id || null,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabaseClient
                .from('tenant_payments')
                .insert([payload]);
            if (error) {
                setAdminRentalStatus("No pude registrar el pago: " + error.message, "error");
                return;
            }

            await loadAdminRentalData(app);
            setAdminRentalStatus("Pago registrado correctamente.", "success");
        };

        window.saveAdminServiceStatus = async function(nextStatus = 'active') {
            const app = getAdminApplicationById(selectedAdminApplicationId);
            if (!adminManagedStore || !app) {
                setAdminRentalStatus("Selecciona un local primero.", "error");
                return;
            }

            const payload = {
                service_status: nextStatus,
                service_status_note: getTrimmedValue('admin-service-note') || null,
                service_suspended_at: nextStatus === 'suspended' ? new Date().toISOString() : null,
                updated_at: new Date().toISOString()
            };

            const { data, error } = await updateStoreByCode(adminManagedStore, payload);
            if (error) {
                setAdminRentalStatus("No pude actualizar el estado del servicio: " + error.message, "error");
                return;
            }

            adminManagedStore = { ...adminManagedStore, ...(data || {}), ...payload };
            await loadAdminRentalData(app);
            setAdminRentalStatus(
                nextStatus === 'suspended'
                    ? "Servicio suspendido. El local quedará marcado por mora o restricción."
                    : "Servicio reactivado correctamente.",
                nextStatus === 'suspended' ? "warn" : "success"
            );
        };

        window.saveAdminNote = async function() {
            const app = getAdminApplicationById(selectedAdminApplicationId);
            if (!adminManagedStore || !app) {
                setAdminRentalStatus("Selecciona un local primero.", "error");
                return;
            }

            const noteText = getTrimmedValue('admin-note-text');
            if (!noteText) {
                setAdminRentalStatus("Escribe una observación antes de guardar.", "error");
                return;
            }

            const payload = {
                store_id: adminManagedStore.id,
                local_code: getStoreCode(adminManagedStore) || adminManagedStore.id,
                tenant_auth_user_id: adminManagedLease?.tenant_auth_user_id || app.applicant_auth_user_id || null,
                lease_id: adminManagedLease?.id || null,
                category: getTrimmedValue('admin-note-category') || 'general',
                visibility: getTrimmedValue('admin-note-visibility') || 'private',
                pinned: !!document.getElementById('admin-note-pinned')?.checked,
                note: noteText,
                created_by: currentTenantUser?.id || null,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabaseClient
                .from('tenant_notes')
                .insert([payload]);
            if (error) {
                setAdminRentalStatus("No pude guardar la observación: " + error.message, "error");
                return;
            }

            await loadAdminRentalData(app);
            setAdminRentalStatus("Observación guardada correctamente.", "success");
        };

        window.loadAdminData = async function() {
            const { data: apps, error: appsErr } = await supabaseClient
                .from('tenant_applications')
                .select('*')
                .order('created_at', { ascending: false });
            const listDiv = document.getElementById('admin-apps-list');
            listDiv.innerHTML = "";
            const visibleApps = (apps || []).filter(app => {
                const status = String(app.status || 'pending').toLowerCase();
                return !['cancelled', 'canceled', 'rejected'].includes(status);
            });
            adminApplicationsCache = visibleApps;

            if (appsErr) {
                listDiv.innerHTML = `<p style="color:#ff8866; font-size:12px;">Error cargando postulaciones: ${escapeHtml(appsErr.message)}</p>`;
                return;
            }

            if (!visibleApps.length) {
                listDiv.innerHTML = `<p style="color:#888; font-size:12px;">No hay postulaciones por revisar.</p>`;
            } else {
                visibleApps.forEach(app => {
                    const status = (app.status || 'pending').toLowerCase();
                    const statusColor = status === 'approved' ? '#4CAF50' : '#c5a059';
                    const div = document.createElement('div');
                    div.style.background = "rgba(255,255,255,0.03)";
                    div.style.padding = "15px";
                    div.style.borderRadius = "8px";
                    div.style.marginBottom = "10px";
                    div.style.borderLeft = `4px solid ${statusColor}`;
                    div.style.cursor = 'pointer';
                    div.addEventListener('click', () => openTenantApproval(app.id));

                    const row = document.createElement('div');
                    row.style.display = 'flex';
                    row.style.justifyContent = 'space-between';
                    row.style.gap = '12px';
                    row.style.alignItems = 'flex-start';

                    const info = document.createElement('div');
                    info.innerHTML = `
                        <strong style="color:#fff;">${escapeHtml(app.brand_name || 'Sin marca')}</strong>
                        <span style="font-size:10px; color:#888;">(${escapeHtml(app.category || 'Sin categoria')})</span>
                        <div style="font-size:11px; color:#666;">${escapeHtml(app.email || '')} | ${escapeHtml(app.phone || '')}</div>
                        <div style="font-size:10px; color:${statusColor}; text-transform:uppercase; letter-spacing:1px; margin-top:4px;">Estado: ${escapeHtml(status)}</div>
                    `;

                    const actions = document.createElement('div');
                    actions.style.display = 'flex';
                    actions.style.flexDirection = 'column';
                    actions.style.gap = '6px';
                    actions.style.alignItems = 'flex-end';

                    const reviewBtn = document.createElement('button');
                    reviewBtn.type = 'button';
                    reviewBtn.textContent = 'Revisar';
                    reviewBtn.style.background = '#c5a059';
                    reviewBtn.style.color = 'black';
                    reviewBtn.style.border = 'none';
                    reviewBtn.style.padding = '5px 10px';
                    reviewBtn.style.borderRadius = '3px';
                    reviewBtn.style.fontSize = '10px';
                    reviewBtn.style.cursor = 'pointer';
                    reviewBtn.addEventListener('click', (event) => {
                        event.stopPropagation();
                        openTenantApproval(app.id);
                    });

                    actions.appendChild(reviewBtn);
                    row.appendChild(info);
                    row.appendChild(actions);
                    div.appendChild(row);
                    listDiv.appendChild(div);
                });
            }

            if (!selectedAdminApplicationId && visibleApps.length) {
                const preferred = visibleApps.find(app => (app.status || 'pending').toLowerCase() === 'pending') || visibleApps[0];
                selectedAdminApplicationId = preferred.id;
            }

            if (selectedAdminApplicationId) {
                const stillExists = getAdminApplicationById(selectedAdminApplicationId);
                if (stillExists) {
                    await openTenantApproval(selectedAdminApplicationId);
                } else {
                    selectedAdminApplicationId = null;
                    document.getElementById('admin-selection-empty').style.display = 'block';
                    document.getElementById('admin-selection-content').style.display = 'none';
                    clearAdminRentalFormState();
                    resetAdminRentalForms();
                }
            }

            const { data: stores, error: storesErr } = await supabaseClient.from('stores').select('id, owner_id');
            if (storesErr) {
                document.getElementById('stat-total-stores').innerText = '-';
                document.getElementById('stat-occupied-stores').innerText = '-';
                document.getElementById('stat-free-stores').innerText = '-';
                const versionEl = document.getElementById('stat-app-version');
                if (versionEl) versionEl.innerText = "Actualización 20:00 - Ronda 1 Completa + Fix Piso Blanco (Elevación 0.15)";
                const updatedEl = document.getElementById('stat-last-update');
                if (updatedEl) updatedEl.innerText = "03-06-2026 21:45";
                return;
            }
            const total = stores.length;
            const occupied = stores.filter(s => s.owner_id).length;
            const free = total - occupied;

            document.getElementById('stat-total-stores').innerText = total;
            document.getElementById('stat-occupied-stores').innerText = occupied;
            document.getElementById('stat-free-stores').innerText = free;
            const versionEl = document.getElementById('stat-app-version');
            if (versionEl) versionEl.innerText = "Actualización 20:00 - Ronda 1 Completa + Fix Piso Blanco (Elevación 0.15)";
            const updatedEl = document.getElementById('stat-last-update');
            if (updatedEl) updatedEl.innerText = "03-06-2026 21:45";
        }

        function generateTenantTelegramLinkCode() {
            return Math.random().toString(36).slice(2, 8).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
        }

        function buildTenantTelegramBotUrl(storeRef = myOwnedStore) {
            const storeCode = getStoreCode(storeRef);
            const linkCode = String(document.getElementById('edit-store-telegram-link-code')?.value || storeRef?.telegram_link_code || "").trim();
            if (!storeCode || !linkCode || !TELEGRAM_BOT_USERNAME || TELEGRAM_BOT_USERNAME === 'TU_BOT_TELEGRAM') return "";
            const payload = `mall_${storeCode}_${linkCode}`;
            return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(payload)}`;
        }

        function refreshTenantTelegramUi(storeRef = myOwnedStore) {
            const enabled = !!document.getElementById('edit-store-telegram-enabled')?.checked;
            const linkInput = document.getElementById('edit-store-telegram-link');
            const statusEl = document.getElementById('edit-store-telegram-status');
            const linkCodeInput = document.getElementById('edit-store-telegram-link-code');
            if (!linkCodeInput) return;

            const currentCode = String(linkCodeInput.value || storeRef?.telegram_link_code || "").trim();
            if (!currentCode && enabled) {
                linkCodeInput.value = generateTenantTelegramLinkCode();
            } else if (currentCode) {
                linkCodeInput.value = currentCode;
            }

            const botUrl = buildTenantTelegramBotUrl(storeRef);
            if (linkInput) {
                linkInput.value = botUrl || "";
                linkInput.placeholder = TELEGRAM_BOT_USERNAME === 'TU_BOT_TELEGRAM'
                    ? "Configura el usuario del bot en el código"
                    : "Abre el bot y presiona iniciar";
            }

            if (!statusEl) return;
            if (!enabled) {
                statusEl.textContent = "Telegram está desactivado para este local.";
                statusEl.style.color = '#8ba2bf';
                return;
            }
            if (storeRef?.telegram_chat_id) {
                const username = storeRef.telegram_chat_username ? ` @${storeRef.telegram_chat_username}` : "";
                statusEl.textContent = `Telegram conectado${username}. Los mensajes nuevos también podrán llegar al bot.`;
                statusEl.style.color = '#7fcf8d';
                return;
            }
            if (TELEGRAM_BOT_USERNAME === 'TU_BOT_TELEGRAM') {
                statusEl.textContent = "Falta configurar el usuario público del bot de Telegram en el sistema.";
                statusEl.style.color = '#c5a059';
                return;
            }
            statusEl.textContent = "Abre el bot con este enlace y presiona iniciar para vincular el local a Telegram.";
            statusEl.style.color = '#8dc0ff';
        }

        window.regenerateTenantTelegramLinkCode = function() {
            const target = document.getElementById('edit-store-telegram-link-code');
            if (!target) return;
            target.value = generateTenantTelegramLinkCode();
            refreshTenantTelegramUi(myOwnedStore);
        };

        window.openTenantTelegramBotLink = function() {
            const url = buildTenantTelegramBotUrl(myOwnedStore);
            if (!url) {
                if (TELEGRAM_BOT_USERNAME === 'TU_BOT_TELEGRAM') {
                    alert("Aún falta configurar el usuario público del bot de Telegram.");
                } else {
                    alert("Activa Telegram para este local y guarda un código de vinculación.");
                }
                return;
            }
            window.open(url, '_blank', 'noopener');
        };

        async function notifyTelegramForStoreMessage(payload = {}) {
            console.info("Notificacion directa a Telegram deshabilitada hasta mover el disparo a backend seguro.", payload?.store_id || payload?.local_code || "");
        }

        async function loadStoreMessages(storeCode) {
            const list = document.getElementById('tenant-messages-list');
            const countEl = document.getElementById('tenant-msg-count');
            if (!list || !supabaseClient) return;

            list.innerHTML = '<p style="color: #888; font-size: 11px; text-align: center; padding: 20px;">Cargando mensajes...</p>';

            const storeId = myOwnedStore.id || storeCode;
            
            // Intentar cargar de mall_messages (Nueva tabla)
            let { data, error } = await supabaseClient
                .from('mall_messages')
                .select('*')
                .or(`store_id.eq.${storeId},local_code.eq.${storeCode}`)
                .order('created_at', { ascending: false });

            // Si mall_messages no existe o falla, intentar fallback a contact_messages (Sin local_code)
            if (error) {
                console.warn("mall_messages no disponible, usando fallback:", error.message);
                const fallback = await supabaseClient
                    .from('contact_messages')
                    .select('*')
                    .eq('store_id', storeId)
                    .order('created_at', { ascending: false });
                data = fallback.data;
                error = fallback.error;
            }

            if (error) {
                list.textContent = "";
                const errorEl = document.createElement('p');
                errorEl.style.color = "#ff4444";
                errorEl.style.fontSize = "11px";
                errorEl.style.textAlign = "center";
                errorEl.style.padding = "20px";
                errorEl.textContent = `Error al cargar: ${error.message}`;
                list.appendChild(errorEl);
                return;
            }

            const msgs = data || [];
            countEl.textContent = msgs.length;

            if (msgs.length === 0) {
                list.innerHTML = '<p style="color: #555; font-size: 11px; text-align: center; padding: 20px;">No tienes mensajes en el buzón.</p>';
                return;
            }

            list.innerHTML = '';
            msgs.forEach(m => {
                const date = new Date(m.created_at).toLocaleDateString();
                const name = m.sender_name || m.name || 'Anónimo';
                const email = m.sender_email || m.email || '';
                const content = m.message || m.requirement || '';
                
                const div = document.createElement('div');
                div.style.padding = "12px";
                div.style.borderBottom = "1px solid #222";
                div.style.marginBottom = "5px";
                const header = document.createElement('div');
                header.style.display = "flex";
                header.style.justifyContent = "space-between";
                header.style.marginBottom = "5px";
                const sender = document.createElement('strong');
                sender.style.color = "#c5a059";
                sender.style.fontSize = "12px";
                sender.textContent = name;
                const dateEl = document.createElement('span');
                dateEl.style.fontSize = "10px";
                dateEl.style.color = "#555";
                dateEl.textContent = date;
                header.append(sender, dateEl);

                const body = document.createElement('div');
                body.style.fontSize = "11px";
                body.style.color = "#aaa";
                body.style.marginBottom = "8px";
                body.style.lineHeight = "1.4";
                body.textContent = content;

                const footer = document.createElement('div');
                footer.style.display = "flex";
                footer.style.gap = "10px";
                footer.style.alignItems = "center";
                const emailEl = document.createElement('span');
                emailEl.style.fontSize = "10px";
                emailEl.style.color = "#666";
                emailEl.textContent = email;
                footer.appendChild(emailEl);

                const replyHref = buildSafeMailtoHref(email, `Respuesta Mall - Local ${storeCode}`);
                if (replyHref) {
                    const reply = document.createElement('a');
                    reply.href = replyHref;
                    reply.style.color = "#c5a059";
                    reply.style.fontSize = "10px";
                    reply.style.textDecoration = "none";
                    reply.style.border = "1px solid rgba(197,160,89,0.3)";
                    reply.style.padding = "2px 8px";
                    reply.style.borderRadius = "4px";
                    reply.textContent = "Responder";
                    footer.appendChild(reply);
                }

                div.append(header, body, footer);
                list.appendChild(div);
            });
        }



        async function loadStoreProductsFast(storeCode) {
            if (!storeCode) return { products: [], skipped: false, error: null };

            const selectColumns = 'id, store_id, local_code, name, price, image_url';
            const [byStoreId, byLocalCode] = await Promise.all([
                supabaseClient
                    .from('store_products')
                    .select(selectColumns)
                    .eq('store_id', storeCode),
                supabaseClient
                    .from('store_products')
                    .select(selectColumns)
                    .ilike('local_code', storeCode)
            ]);

            if (!byStoreId.error && (byStoreId.data || []).length > 0) {
                return { products: byStoreId.data || [], skipped: false, error: null };
            }

            if (!byLocalCode.error && (byLocalCode.data || []).length > 0) {
                return { products: byLocalCode.data || [], skipped: false, error: null };
            }

            return {
                products: byStoreId.data || byLocalCode.data || [],
                skipped: false,
                error: byStoreId.error || byLocalCode.error || null
            };
        }

        function renderTenantProductSlots(products = [], loading = false) {
            const list = document.getElementById('edit-products-list');
            if (!list) return;

            const normalizedProducts = (products || []).slice(0, 10);
            list.innerHTML = "";
            for (let i = 0; i < 10; i++) {
                const p = normalizedProducts[i] || { name: "", price: "", image_url: "" };
                const slot = document.createElement('div');
                slot.className = "p-slot";
                slot.style.padding = "10px";
                slot.style.background = "#111";
                slot.style.borderRadius = "8px";
                slot.innerHTML = `
                    <input type="text" placeholder="Nombre" value="${escapeHtml(p.name || '')}" class="p-name" style="width:100%; background:#000; border:1px solid #333; color:#fff; font-size:11px; padding:5px; margin-bottom:5px;">
                    <div style="display:flex; gap:5px;">
                        <input type="text" placeholder="Precio" value="${escapeHtml(p.price || '')}" class="p-price" style="flex:1; background:#000; border:1px solid #333; color:#fff; font-size:11px; padding:5px;">
                        <input type="text" placeholder="URL Foto" value="${escapeHtml(p.image_url || '')}" class="p-image" style="flex:2; background:#000; border:1px solid #333; color:#fff; font-size:11px; padding:5px;">
                    </div>
                    <div style="display:flex; gap:8px; align-items:center; margin-top:7px;">
                        <input type="file" accept="image/*" style="display:none;" onchange="uploadTenantProductImage(this, ${i})">
                        <button type="button" onclick="this.previousElementSibling.click()" style="background:rgba(197,160,89,0.10); border:1px solid rgba(197,160,89,0.25); color:#c5a059; padding:6px 8px; border-radius:5px; cursor:pointer; font-size:9px; text-transform:uppercase;">Subir foto</button>
                        <span class="p-upload-status" style="font-size:9px; color:#666; line-height:1.2;">${loading ? 'Cargando catálogo...' : (p.image_url ? 'Foto actual cargada.' : 'Opcional')}</span>
                    </div>
                `;
                list.appendChild(slot);
            }

            list.querySelectorAll('.p-slot').forEach((slot) => {
                ['.p-name', '.p-price', '.p-image'].forEach((selector) => {
                    const input = slot.querySelector(selector);
                    if (input) {
                        input.addEventListener('input', () => {
                            if (typeof window.syncTenantProductDraftsFromDom === 'function') {
                                window.syncTenantProductDraftsFromDom();
                            }
                        });
                    }
                });
            });
        }

        function collectTenantProductDraftsFromDom() {
            const storeCode = getStoreCode(myOwnedStore);
            if (!storeCode) return [];
            const slots = document.querySelectorAll('.p-slot');
            const drafts = [];
            slots.forEach((slot) => {
                drafts.push({
                    name: String(slot.querySelector('.p-name')?.value || '').trim(),
                    price: String(slot.querySelector('.p-price')?.value || '').trim(),
                    image_url: String(slot.querySelector('.p-image')?.value || '').trim()
                });
            });
            tenantAdminProductDrafts.set(storeCode, drafts);
            return drafts;
        }

        window.syncTenantProductDraftsFromDom = function() {
            return collectTenantProductDraftsFromDom();
        };

        window.clearTenantProductDrafts = function(storeCode = '') {
            const code = String(storeCode || getStoreCode(myOwnedStore) || '').trim();
            if (code) tenantAdminProductDrafts.delete(code);
        };

        function mergeProductsWithDrafts(storeCode, products = []) {
            const drafts = tenantAdminProductDrafts.get(String(storeCode || '').trim());
            if (!drafts?.length) return (products || []).slice(0, 10);

            const base = Array.from({ length: 10 }, (_, index) => {
                const product = (products || [])[index] || { name: '', price: '', image_url: '' };
                const draft = drafts[index] || {};
                return {
                    ...product,
                    name: draft.name !== undefined ? draft.name : (product.name || ''),
                    price: draft.price !== undefined ? draft.price : (product.price || ''),
                    image_url: draft.image_url !== undefined ? draft.image_url : (product.image_url || '')
                };
            });
            return base;
        }

        function populateTenantAdminForm(store) {
            if (!store) return;
            const storeCode = getStoreCode(store);
            const visibleStoreCode = getAdminStoreDisplayCode(store) || storeCode;
            document.getElementById('tenant-store-code-display').textContent = visibleStoreCode || "Sin código";
            document.getElementById('edit-store-name').value = store.name || "";
            document.getElementById('edit-store-category').value = store.category || "";
            document.getElementById('edit-store-email').value = store.contact_email || "";
            document.getElementById('edit-store-phone').value = store.contact_phone || store.whatsapp || "";
            document.getElementById('edit-store-telegram-enabled').checked = !!store.telegram_notifications_enabled;
            document.getElementById('edit-store-telegram-link-code').value = store.telegram_link_code || "";
            document.getElementById('edit-store-logo').value = store.logo_url || "";
            setTenantUploadStatus('edit-store-logo-status', store.logo_url ? "Logo actual cargado." : "Puedes pegar una URL o subir un logo optimizado.", "muted");
            document.getElementById('edit-store-shelf-style').value = store.shelf_style || "madera";
            refreshTenantTelegramUi(store);
        }

        window.closeTenantAdmin = function() {
            tenantAdminOpenRequestId++;
            document.getElementById('tenant-admin-modal').style.display = 'none';
            document.getElementById('modal-overlay').style.display = 'none';
        }

        window.openTenantAdmin = async function() {
            if (!myOwnedStores.length && !myOwnedStore) {
                try {
                    await refreshMyOwnedStoresFromSupabase();
                } catch (error) {
                    console.error("No pude refrescar el local antes de abrir el panel:", error);
                }
            }
            if (!myOwnedStores.length && myOwnedStore) myOwnedStores = [myOwnedStore];

            const selectedStore = myOwnedStores.find(s => {
                const visibleCode = getAdminStoreDisplayCode(s);
                const legacyCode = getStoreCode(s);
                return visibleCode === currentModalStoreCode || legacyCode === currentModalStoreCode;
            }) || myOwnedStore;
            if (!selectedStore) return alert("No tienes un local asignado.");

            myOwnedStore = selectedStore;
            const storeCode = getStoreCode(myOwnedStore);

            document.getElementById('tenant-admin-modal').style.display = 'block';
            document.getElementById('modal-overlay').style.display = 'block';

            populateTenantAdminForm(myOwnedStore);
            renderTenantProductSlots(
                mergeProductsWithDrafts(storeCode, tenantAdminProductsCache.get(storeCode) || []),
                !tenantAdminProductsCache.has(storeCode)
            );
            loadStoreMessages(storeCode);

            const requestId = ++tenantAdminOpenRequestId;
            Promise.allSettled([
                refreshMyOwnedStoresFromSupabase(),
                refreshAdminStoreDisplayCodes()
            ]).then(async () => {
                if (requestId !== tenantAdminOpenRequestId) return;
                const modal = document.getElementById('tenant-admin-modal');
                if (!modal || modal.style.display === 'none') return;

                const refreshedSelection = myOwnedStores.find(s => {
                    const visibleCode = getAdminStoreDisplayCode(s);
                    const legacyCode = getStoreCode(s);
                    return (
                        visibleCode === currentModalStoreCode
                        || legacyCode === currentModalStoreCode
                        || String(s?.id || "") === String(myOwnedStore?.id || "")
                    );
                }) || myOwnedStore;

                myOwnedStore = refreshedSelection;
                populateTenantAdminForm(myOwnedStore);

                const latestStoreCode = getStoreCode(myOwnedStore);
                const productsResult = await loadStoreProductsFast(latestStoreCode);
                if (requestId !== tenantAdminOpenRequestId) return;

                if (productsResult.error) {
                    console.warn("No pude cargar productos del locatario:", productsResult.error.message);
                }
                if (productsResult.skipped) {
                    console.warn("Falta store_products.local_code. Ejecuta supabase/store_products_local_code_fix.sql para activar inventario por local.");
                }

                const products = (productsResult.products || []).slice(0, 10);
                tenantAdminProductsCache.set(latestStoreCode, products);
                renderTenantProductSlots(mergeProductsWithDrafts(latestStoreCode, products), false);
            });
        }

        window.previewTenantStore = function() {
            const storeCode = getStoreCode(myOwnedStore);
            const data = {
                name: document.getElementById('edit-store-name').value,
                shopCode: storeCode,
                category: document.getElementById('edit-store-category').value,
                contactEmail: document.getElementById('edit-store-email').value,
                contactPhone: document.getElementById('edit-store-phone').value,
                products: []
            };
            
            const slots = document.querySelectorAll('.p-slot');
            slots.forEach(slot => {
                const n = slot.querySelector('.p-name').value;
                const p = slot.querySelector('.p-price').value;
                if(n) data.products.push({ n: n, p: p });
            });
            
            openModal(data);
        }

        window.saveTenantData = async function() {
            if (!myOwnedStore || !currentTenantUser) return;
            const storeCode = getStoreCode(myOwnedStore);
            
            const newName = document.getElementById('edit-store-name').value;
            const newCat = document.getElementById('edit-store-category').value;
            const newEmail = document.getElementById('edit-store-email').value;
            const newPhone = normalizePhone(document.getElementById('edit-store-phone').value);
            const telegramEnabled = !!document.getElementById('edit-store-telegram-enabled')?.checked;
            const telegramLinkCode = telegramEnabled
                ? (document.getElementById('edit-store-telegram-link-code')?.value || myOwnedStore.telegram_link_code || generateTenantTelegramLinkCode())
                : null;
            const newLogo = document.getElementById('edit-store-logo').value;
            const newStyle = document.getElementById('edit-store-shelf-style').value;
            
            // 1. Actualizar tienda (Asegurar owner_id si somos admins)
            let storeUpdatePayload = {
                name: newName,
                category: newCat,
                contact_email: newEmail,
                telegram_notifications_enabled: telegramEnabled,
                telegram_link_code: telegramLinkCode,
                whatsapp: newPhone,
                logo_url: newLogo,
                shelf_style: newStyle
            };
            
            // Reclamar propiedad si el local no tiene dueño o somos el super-admin
            if (!myOwnedStore.owner_id && currentTenantUser) {
                storeUpdatePayload.owner_id = currentTenantUser.id;
            }

            let { data: updatedStore, error: storeUpdateError } = await updateStoreByCode(myOwnedStore, storeUpdatePayload);
            if (storeUpdateError && /schema cache|column|contact_phone|whatsapp|shelf_style|logo_url|contact_email|telegram_notifications_enabled|telegram_link_code|telegram_chat_id|telegram_chat_username/i.test(storeUpdateError.message || "")) {
                const fallbackPayload = {
                    name: newName,
                    category: newCat,
                    logo_url: newLogo
                };
                const fallbackResult = await updateStoreByCode(myOwnedStore, fallbackPayload);
                storeUpdateError = fallbackResult.error;
                updatedStore = fallbackResult.data;
                if (!storeUpdateError) {
                    console.warn("Guardado parcial de tienda: algunas columnas opcionales no existen en stores.", storeUpdatePayload);
                }
            }
            if (storeUpdateError) {
                alert("No pude guardar los datos del local: " + storeUpdateError.message);
                return;
            }
            
            // 2. Actualizar productos (limpiar y re-insertar)
            const productsToInsert = [];
            const slots = document.querySelectorAll('.p-slot');
            slots.forEach(slot => {
                const n = slot.querySelector('.p-name').value;
                const p = slot.querySelector('.p-price').value;
                const img = slot.querySelector('.p-image').value;
                if(n.trim()) productsToInsert.push({ local_code: storeCode, name: n, price: p, image_url: img });
            });

            const productsWrite = await replaceStoreProducts(myOwnedStore, productsToInsert);
            if (!productsWrite.ok) {
                alert("No pude guardar productos: " + productsWrite.error.message);
                return;
            }

            if (typeof window.clearTenantProductDrafts === 'function') {
                window.clearTenantProductDrafts(storeCode);
            }
            
            // Actualizar localmente
            myOwnedStore = {
                ...myOwnedStore,
                ...(updatedStore || {}),
                name: newName,
                category: newCat,
                contact_email: newEmail,
                contact_phone: newPhone,
                telegram_notifications_enabled: telegramEnabled,
                telegram_link_code: telegramLinkCode,
                whatsapp: newPhone,
                logo_url: newLogo,
                shelf_style: newStyle
            };

            // 4. Actualizar visuales 3D inmediatamente
            const updatedProductsResult = await loadStoreProducts(storeCode);
            updateStoreVisuals(storeCode, myOwnedStore, updatedProductsResult.products || []);
            
            if (productsWrite.ok) {
                alert(productsWrite.skipped 
                    ? "¡Cambios guardados con éxito! (Nota: Se usó el modo de compatibilidad para el inventario)" 
                    : "¡Cambios guardados con éxito!");
            } else {
                alert("Error al guardar productos: " + productsWrite.error.message);
            }
            closeTenantAdmin();
        }

        window.updateTenantPassword = async function() {
            const newPass = document.getElementById('new-tenant-pass').value;
            if (newPass.length < 6) return alert("La contraseña debe tener al menos 6 caracteres.");
            
            const { error } = await supabaseClient.auth.updateUser({ password: newPass });
            if (error) alert("Error: " + error.message);
            else {
                alert("Contraseña actualizada con éxito.");
                document.getElementById('new-tenant-pass').value = "";
            }
        }

        window.sendStoreMessage = async function() {
            const name = document.getElementById('store-contact-name').value;
            const email = document.getElementById('store-contact-email').value;
            const msg = document.getElementById('store-contact-msg').value;
            
            if(!supabaseClient) return;
            
            const targetId = typeof currentModalStoreId !== 'undefined' ? currentModalStoreId : currentModalStoreCode;

            const messagePayload = {
                sender_name: name,
                sender_email: email,
                message: msg,
                store_id: (String(targetId).includes('-') ? targetId : null),
                local_code: currentModalStoreCode,
                status: 'unread'
            };

            // Enviar a la nueva tabla dedicada mall_messages
            const { error } = await supabaseClient.from('mall_messages').insert([messagePayload]);
            
            if(error) {
                console.error("Error mall_messages:", error);
                // Fallback a contact_messages si la nueva tabla no existe aún
                await supabaseClient.from('contact_messages').insert([{
                    name: name,
                    email: email,
                    requirement: msg,
                    store_id: targetId
                }]);
                alert("¡Mensaje enviado con éxito!");
            } else {
                alert("¡Mensaje enviado con éxito! El dueño del local lo recibirá en su panel.");
            }
            if (!error) notifyTelegramForStoreMessage(messagePayload);
            document.getElementById('store-contact-form').reset();
        }
        let otherPlayers = {}; // { sessionId: { mesh, label, targetPos, targetRot } }
        let presenceChannel = null;

        // Variables de optimización (ahorro de datos)
        let lastSentPos = new THREE.Vector3();
        let lastSentRot = 0;
        const POS_THRESHOLD = 0.2; // Sensibilidad de movimiento (20cm)
        const ROT_THRESHOLD = 0.05; // Sensibilidad de giro mucho más alta (~3 grados)
        // Supabase ya inicializado arriba - no sobreescribir

        async function upsertMemberProfile(user, extra = {}) {
            if (!supabaseClient || !user) return null;
            const profile = {
                auth_user_id: user.id,
                nickname: extra.nickname || user.user_metadata?.nickname || user.email?.split('@')[0] || "Socio",
                email: user.email,
                phone: extra.phone || user.user_metadata?.phone || "",
                email_verified: !!user.email_confirmed_at,
                phone_verified: !!extra.phoneVerified,
                marketing_opt_in: true,
                role: "member",
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabaseClient
                .from('mall_members')
                .upsert(profile, { onConflict: 'auth_user_id' })
                .select()
                .maybeSingle();
            await upsertUserProfile(user, "registered_visitor", profile.nickname);

            if (error) {
                console.error("Error guardando socio:", error);
                setMemberStatus("No se pudo guardar el perfil de inscrito: " + error.message, true);
                return profile;
            }
            return data || profile;
        }

        window.memberRegister = async function() {
            if (!supabaseClient) return setMemberStatus("No hay conexión con Supabase.", true);
            const email = document.getElementById('member-login-email').value.trim();
            const password = document.getElementById('member-login-pass').value;
            const passwordConfirm = document.getElementById('member-register-pass-confirm').value;
            const nickname = document.getElementById('member-register-nick').value.trim();
            const phone = normalizePhone(document.getElementById('member-register-phone').value);

            if (!email || !password || !nickname || !phone) {
                return setMemberStatus("Para crear cuenta inscrita debes completar nick, correo, celular y contraseña.", true);
            }
            if (password.length < 6) return setMemberStatus("La contraseña debe tener al menos 6 caracteres.", true);
            if (password !== passwordConfirm) return setMemberStatus("Las contraseñas no coinciden. Revisa ambas antes de crear la cuenta.", true);
            if (!phone.startsWith('+') || phone.length < 10) return setMemberStatus("Ingresa el celular en formato internacional, por ejemplo +56912345678.", true);

            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: { nickname, phone, role: "member" },
                    emailRedirectTo: window.location.href
                }
            });
            if (error) return setMemberStatus("No se pudo crear la cuenta: " + error.message, true);

            pendingMemberPhone = phone;
            pendingMemberEmail = email;
            if (data.session && data.user) {
                await upsertMemberProfile(data.user, { nickname, phone, phoneVerified: false });
                setMemberStatus("Cuenta creada. Revisa tu correo y valida el código SMS para activar beneficios.");
                await sendMemberPhoneOtp();
            } else {
                setMemberStatus("Cuenta creada. Revisa tu correo para confirmar propiedad. Luego inicia sesión aquí para validar tu celular por SMS.");
            }
        }

        window.sendMemberPhoneOtp = async function() {
            if (!supabaseClient || !pendingMemberPhone) return;
            const { data: { user } } = await supabaseClient.auth.getUser();
            let error = null;
            if (user) {
                pendingMemberPhoneOtpType = "phone_change";
                ({ error } = await supabaseClient.auth.updateUser({ phone: pendingMemberPhone }));
            } else {
                pendingMemberPhoneOtpType = "sms";
                ({ error } = await supabaseClient.auth.signInWithOtp({ phone: pendingMemberPhone }));
            }
            const panel = document.getElementById('member-phone-verify-panel');
            if (panel) panel.style.display = 'grid';
            if (error) {
                console.warn("Phone OTP no disponible:", error);
                setMemberStatus("Cuenta guardada. Supabase Phone Auth no pudo enviar SMS: " + error.message, true);
                return;
            }
            setMemberStatus("Te enviamos un código SMS. Ingrésalo para dejar el celular verificado.");
        }

        window.verifyMemberPhoneOtp = async function() {
            if (!supabaseClient || !pendingMemberPhone) return setMemberStatus("Primero crea la cuenta o indica un celular.", true);
            const token = document.getElementById('member-phone-code').value.trim();
            if (!token) return setMemberStatus("Ingresa el código recibido por SMS.", true);
            const { error } = await supabaseClient.auth.verifyOtp({ phone: pendingMemberPhone, token, type: pendingMemberPhoneOtpType });
            if (error) return setMemberStatus("No se pudo verificar el celular: " + error.message, true);

            const { data: { user } } = await supabaseClient.auth.getUser();
            if (user && user.email) {
                currentMemberProfile = await upsertMemberProfile(user, {
                    nickname: user.user_metadata?.nickname,
                    phone: pendingMemberPhone,
                    phoneVerified: true
                });
            } else if (pendingMemberPhoneOtpType === "sms") {
                setMemberStatus("Celular validado por SMS. Para vincularlo a beneficios, inicia sesión con correo y contraseña.", true);
                return;
            }
            setMemberStatus("Celular verificado. Ya puedes entrar como visitante inscrito.");
        }

        async function resolveMemberEmail(identifier) {
            const clean = identifier.trim();
            if (clean.includes('@')) return clean;
            console.warn("Login de visitante inscrito por nick deshabilitado para evitar exposicion de correos.");
            return "";
        }

        window.memberLogin = async function(identifierOverride = null, passwordOverride = null) {
            if (!supabaseClient) return setMemberStatus("No hay conexión con Supabase.", true);
            const identifier = (identifierOverride || document.getElementById('member-login-email').value).trim();
            const password = passwordOverride || document.getElementById('member-login-pass').value;
            if (!identifier || !password) return setMemberStatus("Ingresa correo y contraseña.", true);

            const email = await resolveMemberEmail(identifier);
            if (!email || !email.includes('@')) return setMemberStatus("Por seguridad, el ingreso con contraseña ahora requiere correo directo.", true);
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) return setMemberStatus("No se pudo iniciar sesión: " + error.message, true);

            const user = data.user;
            const { data: profile } = await supabaseClient
                .from('mall_members')
                .select('*')
                .eq('auth_user_id', user.id)
                .maybeSingle();
            currentMemberProfile = profile || await upsertMemberProfile(user, {
                nickname: user.user_metadata?.nickname,
                phone: user.user_metadata?.phone || normalizePhone(document.getElementById('member-register-phone').value),
                phoneVerified: false
            });

            if (!user.email_confirmed_at) {
                setMemberStatus("Tu correo aún no aparece confirmado. Revisa el email de Supabase antes de usar beneficios.", true);
                return;
            }
            if (!currentMemberProfile?.phone_verified) {
                pendingMemberPhone = currentMemberProfile?.phone || user.user_metadata?.phone || normalizePhone(document.getElementById('member-register-phone').value);
                const panel = document.getElementById('member-phone-verify-panel');
                if (panel) panel.style.display = 'grid';
                setMemberStatus("Tu celular aún no está verificado. Valida el código SMS para activar beneficios.", true);
                if (pendingMemberPhone) await sendMemberPhoneOtp();
                return;
            }

            await enterMallWithIdentity({
                nickname: getMemberDisplayName(user, email),
                role: "member",
                user,
                profile: currentMemberProfile
            });
        }

        window.startMallExperience = async function () {
            const nicknameInput = document.getElementById('nickname-input');
            const nick = nicknameInput.value.trim();
            const password = document.getElementById('visitor-password-input').value;
            if (password) {
                if (!nick) return alert("Para entrar con contraseña, ingresa tu correo.");
                setMemberStatus("Validando cuenta inscrita...");
                await window.memberLogin(nick, password);
                return;
            }
            const effectiveNick = nick || buildGuestNickname();
            if (!nick && nicknameInput) nicknameInput.value = effectiveNick;
            await enterMallWithIdentity({ nickname: effectiveNick, role: "guest" });
        };

        const HEARTBEAT_LIMIT = 4000; // Enviar cada 4 seg aunque esté quieto
        let lastUpdateTime = 0;

        function initPresence() {
            if (!supabaseClient) {
                console.warn("Supabase no disponible: el usuario entra sin presencia multijugador.");
                return;
            }
            if (presenceChannel) return;
            presenceChannel = supabaseClient.channel('mall_presence', {
                config: {
                    presence: { key: myNickname },
                    broadcast: { self: true }
                }
            });

            presenceChannel
                .on('presence', { event: 'sync' }, () => {
                    const state = presenceChannel.presenceState();
                    Object.keys(state).forEach(id => {
                        if (id === myNickname) return;
                        if (!otherPlayers[id]) otherPlayers[id] = createAvatar(id);
                    });
                })
                .on('presence', { event: 'leave' }, ({ key }) => {
                    removePlayer(key);
                    addChatMessage("Sistema", `${key} ha salido del mall.`);
                })
                .on('presence', { event: 'join' }, ({ key }) => {
                    if (key !== myNickname) {
                        addChatMessage("Sistema", `${key} ha entrado al mall.`);
                        broadcastMyPosition(); // Responder inmediatamente al que acaba de entrar
                    }
                })
                .on('broadcast', { event: 'chat_msg' }, payload => {
                    const { user, text, to } = payload.payload;
                    if (to !== "Todos" && to !== myNickname && user !== myNickname) return; // Filtrar mensajes que no son para ti
                    addChatMessage(user, text, to);
                })
                .on('broadcast', { event: 'pos_update' }, payload => {
                    const id = payload.payload.user;
                    if (id === myNickname) return;
                    // Pasamos también el estilo en el payload por si no lo teníamos en presence inicial
                    if (!otherPlayers[id]) otherPlayers[id] = createAvatar(id, payload.payload.style || "1");
                    const p = otherPlayers[id];
                    const pData = payload.payload;
                    if (typeof pData.escId === 'number' && typeof pData.escT === 'number' && escalatorList[pData.escId]) {
                        const escalator = escalatorList[pData.escId];
                        const escProgress = THREE.MathUtils.clamp(pData.escT, 0, 1) * escalator.pathLenZ;
                        p.targetPos.copy(getEscalatorRidePosition(escalator, escProgress, AVATAR_FLOOR_OFFSET));
                        p.targetRot = escalator.travelDir > 0 ? 0 : Math.PI;
                        p.escalatorState = { id: escalator.id, t: pData.escT };
                    } else {
                        p.targetPos.set(pData.x, pData.y - PLAYER_EYE_HEIGHT + AVATAR_FLOOR_OFFSET, pData.z);
                        p.targetRot = pData.r;
                        p.escalatorState = null;
                    }
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        await trackMySelf();
                        document.getElementById('chat-minimized-btn').style.display = 'flex';
                        // window.toggleChat(); // El chat ahora comienza cerrado por defecto
                        addChatMessage("Sistema", `¡Hola ${myNickname}! Presiona Enter para enviar mensajes.`);
                        broadcastMyPosition();
                    }
                });

            // Intervalo de Broadcast en lugar de Presence Track
            setInterval(() => {
                if (!presenceChannel) return;

                const dir = new THREE.Vector3();
                camera.getWorldDirection(dir);
                const realRot = Math.atan2(dir.x, dir.z);

                const dist = camera.position.distanceTo(lastSentPos);
                const rotDiff = Math.abs(realRot - lastSentRot);
                const now = Date.now();

                // LÓGICA DE OPTIMIZACIÓN: Solo enviar si hubo cambio o pasó el tiempo límite
                if (dist > POS_THRESHOLD || rotDiff > ROT_THRESHOLD || (now - lastUpdateTime) > HEARTBEAT_LIMIT) {
                    broadcastMyPosition();
                    lastSentPos.copy(camera.position);
                    lastSentRot = realRot;
                    lastUpdateTime = now;
                }
            }, 100);
        }

        async function trackMySelf() {
            if (!presenceChannel) return;
            // Solo registrar presencia física y qué avatar escogimos
            await presenceChannel.track({ nickname: myNickname, style: myAvatarStyle, role: currentAccessRole });
        }

        function broadcastMyPosition() {
            if (!presenceChannel) return;
            
            // Calcular la rotación real basada en hacia dónde mira la cámara
            const dir = new THREE.Vector3();
            camera.getWorldDirection(dir);
            const realRot = Math.atan2(dir.x, dir.z);

            presenceChannel.send({
                type: 'broadcast',
                event: 'pos_update',
                payload: {
                    user: myNickname,
                    style: myAvatarStyle,
                    role: currentAccessRole,
                    x: camera.position.x,
                    y: camera.position.y,
                    z: camera.position.z,
                    r: realRot,
                    escId: currentEscalatorState ? currentEscalatorState.id : null,
                    escT: currentEscalatorState ? currentEscalatorState.t : null
                }
            });
        }

        function addChatMessage(user, text, to = "Todos") {
            const container = document.getElementById('chat-messages');
            const p = document.createElement('p');
            p.style.margin = '0'; p.style.fontSize = '12px'; p.style.color = '#fff'; p.style.lineHeight = '1.4'; p.style.wordWrap = 'break-word';
            const label = document.createElement('strong');
            label.style.color = to === "Todos" ? '#c5a059' : '#6dbcdb';
            label.textContent = to === "Todos" ? user : `[Privado] ${user}`;
            p.append(label, document.createTextNode(`: ${text}`));
            container.appendChild(p);
            container.scrollTop = container.scrollHeight;

            if (!isChatOpen && user !== "Sistema" && user !== myNickname) {
                unreadCount++;
                const badge = document.getElementById('chat-badge');
                badge.innerText = unreadCount;
                badge.style.display = 'flex';
            }
        }

        const chatInput = document.getElementById('chat-input');
        const chatSend = document.getElementById('chat-send');

        function sendChat() {
            const text = chatInput.value.trim();
            if (!text || !presenceChannel) return;

            if (!isAdmin && chatTarget === "") {
                return alert("Para conversar, debes acercarte y darle clic a otro avatar en el Mall primero.");
            }

            presenceChannel.send({
                type: 'broadcast',
                event: 'chat_msg',
                payload: { user: myNickname, text: text, to: chatTarget }
            });
            chatInput.value = '';
            chatInput.blur(); // Quitar el foco para devolver el control a la cámara/teclado del mall
            focusMallCanvas();
        }

        chatSend.onclick = sendChat;
        chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendChat(); e.stopPropagation(); };
        chatInput.addEventListener('keydown', e => e.stopPropagation());
        chatInput.addEventListener('keyup', e => e.stopPropagation());

        const GAME_READY_AVATAR_URL = "assets/avatars/model.glb";
        const gameReadyAvatarState = {
            loader: null,
            promise: null,
            gltf: null,
            error: null
        };

        function ensureGameReadyAvatarModel() {
            if (gameReadyAvatarState.gltf) return Promise.resolve(gameReadyAvatarState.gltf);
            if (gameReadyAvatarState.error) return Promise.reject(gameReadyAvatarState.error);
            if (gameReadyAvatarState.promise) return gameReadyAvatarState.promise;
            if (!THREE.GLTFLoader || !THREE.SkeletonUtils) {
                gameReadyAvatarState.error = new Error("GLTFLoader o SkeletonUtils no disponibles.");
                return Promise.reject(gameReadyAvatarState.error);
            }

            gameReadyAvatarState.loader = gameReadyAvatarState.loader || new THREE.GLTFLoader();
            gameReadyAvatarState.promise = new Promise((resolve, reject) => {
                gameReadyAvatarState.loader.load(
                    GAME_READY_AVATAR_URL,
                    (gltf) => {
                        gameReadyAvatarState.gltf = gltf;
                        resolve(gltf);
                    },
                    undefined,
                    (error) => {
                        console.warn("No se pudo cargar avatar game-ready:", error);
                        gameReadyAvatarState.error = error;
                        reject(error);
                    }
                );
            });
            return gameReadyAvatarState.promise;
        }

        function findBoneByTokens(root, tokens) {
            let match = null;
            root.traverse((node) => {
                if (match || !node.isBone) return;
                const normalized = String(node.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                if (tokens.some((token) => normalized.includes(token))) match = node;
            });
            return match;
        }

        function captureBoneEulerMap(rig) {
            const map = {};
            Object.entries(rig).forEach(([key, bone]) => {
                if (bone?.rotation) map[key] = bone.rotation.clone();
            });
            return map;
        }

        function findAnimationByTokens(animations, tokens) {
            return (animations || []).find((clip) => {
                const normalized = String(clip?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                return tokens.some((token) => normalized.includes(token));
            }) || null;
        }

        function extractGameReadyRig(root) {
            const rig = {
                hips: findBoneByTokens(root, ['hips', 'pelvis']),
                spine: findBoneByTokens(root, ['spine', 'spine1']),
                chest: findBoneByTokens(root, ['spine2', 'chest', 'spine3']),
                neck: findBoneByTokens(root, ['neck']),
                head: findBoneByTokens(root, ['head']),
                upperArmL: findBoneByTokens(root, ['leftarm', 'leftupperarm', 'upperarml']),
                lowerArmL: findBoneByTokens(root, ['leftforearm', 'leftlowerarm', 'lowerarml']),
                handL: findBoneByTokens(root, ['lefthand', 'handl']),
                upperArmR: findBoneByTokens(root, ['rightarm', 'rightupperarm', 'upperarmr']),
                lowerArmR: findBoneByTokens(root, ['rightforearm', 'rightlowerarm', 'lowerarmr']),
                handR: findBoneByTokens(root, ['righthand', 'handr']),
                upperLegL: findBoneByTokens(root, ['leftupleg', 'leftthigh', 'uplegl']),
                lowerLegL: findBoneByTokens(root, ['leftleg', 'leftcalf', 'lowerlegl']),
                footL: findBoneByTokens(root, ['leftfoot', 'footl']),
                upperLegR: findBoneByTokens(root, ['rightupleg', 'rightthigh', 'uplegr']),
                lowerLegR: findBoneByTokens(root, ['rightleg', 'rightcalf', 'lowerlegr']),
                footR: findBoneByTokens(root, ['rightfoot', 'footr'])
            };
            rig.base = captureBoneEulerMap(rig);
            return rig;
        }

        function setBoneFromBase(baseMap, boneKey, rig, x = 0, y = 0, z = 0) {
            const bone = rig[boneKey];
            const base = baseMap?.[boneKey];
            if (!bone || !base) return;
            bone.rotation.set(base.x + x, base.y + y, base.z + z);
        }

        function applyGameReadyRestPose(rig) {
            if (!rig?.base) return;
            const base = rig.base;
            setBoneFromBase(base, 'spine', rig, -0.08, 0, 0);
            setBoneFromBase(base, 'chest', rig, 0.06, 0, 0);
            setBoneFromBase(base, 'neck', rig, 0.03, 0, 0);
            setBoneFromBase(base, 'head', rig, -0.01, 0, 0);

            setBoneFromBase(base, 'upperArmL', rig, -0.48, 0, 0.28);
            setBoneFromBase(base, 'upperArmR', rig, -0.48, 0, -0.28);
            setBoneFromBase(base, 'lowerArmL', rig, -0.2, 0, -0.08);
            setBoneFromBase(base, 'lowerArmR', rig, -0.2, 0, 0.08);
            setBoneFromBase(base, 'handL', rig, 0.04, 0, 0);
            setBoneFromBase(base, 'handR', rig, 0.04, 0, 0);

            setBoneFromBase(base, 'upperLegL', rig, 0.03, 0, 0.02);
            setBoneFromBase(base, 'upperLegR', rig, 0.03, 0, -0.02);
            setBoneFromBase(base, 'lowerLegL', rig, -0.05, 0, 0);
            setBoneFromBase(base, 'lowerLegR', rig, -0.05, 0, 0);
            setBoneFromBase(base, 'footL', rig, 0.04, 0, 0);
            setBoneFromBase(base, 'footR', rig, 0.04, 0, 0);
        }

        function applyGameReadyAvatarStyle(root, styleCode = "1") {
            root.traverse((node) => {
                if (!node.isMesh || !node.material) return;
                node.castShadow = true;
                node.receiveShadow = true;
                const materials = Array.isArray(node.material) ? node.material : [node.material];
                materials.forEach((material) => {
                    if (!material) return;
                    material.roughness = Math.min(1, (material.roughness ?? 0.7) + 0.08);
                    material.metalness = Math.min(1, material.metalness ?? 0.05);
                });
            });
        }

        function createGameReadyAvatar(nickname, styleCode = "1") {
            const group = new THREE.Group();
            group.position.y = AVATAR_FLOOR_OFFSET;
            group.userData.playerId = nickname;
            group.userData.avatarKind = "gltf";
            group.userData.avatarLoading = true;
            setActorCollisionProfile(group);
            scene.add(group);

            const label = document.createElement('div');
            label.className = 'avatar-label';
            label.innerText = nickname;
            document.body.appendChild(label);

            const actor = {
                mesh: group,
                label,
                targetPos: new THREE.Vector3(),
                targetRot: 0,
                motionPhase: Math.random() * Math.PI * 2,
                idlePhase: Math.random() * Math.PI * 2,
                avatarKind: "gltf",
                gltfRoot: null,
                gameReadyRig: null,
                mixer: null,
                actions: {},
                walkBlend: 0,
                proceduralLocomotion: false,
                gltfBaseY: -0.02,
                ready: false,
                rig: null
            };

            ensureGameReadyAvatarModel()
                .then((gltf) => {
                    const clonedScene = THREE.SkeletonUtils.clone(gltf.scene);
                    clonedScene.scale.setScalar(1.08);
                    clonedScene.position.set(0, actor.gltfBaseY, 0);
                    clonedScene.rotation.y = Math.PI;
                    applyGameReadyAvatarStyle(clonedScene, styleCode);
                    clonedScene.traverse((node) => {
                        node.userData.playerId = nickname;
                    });
                    group.add(clonedScene);
                    actor.gltfRoot = clonedScene;
                    actor.gameReadyRig = extractGameReadyRig(clonedScene);
                    applyGameReadyRestPose(actor.gameReadyRig);
                    const mixer = new THREE.AnimationMixer(clonedScene);
                    const idleClip = THREE.AnimationClip.findByName(gltf.animations, 'Idle')
                        || findAnimationByTokens(gltf.animations, ['idle'])
                        || gltf.animations?.[0]
                        || null;
                    const walkClip = THREE.AnimationClip.findByName(gltf.animations, 'Walk')
                        || findAnimationByTokens(gltf.animations, ['walk', 'locomotion', 'jog']);
                    const runClip = THREE.AnimationClip.findByName(gltf.animations, 'Run')
                        || findAnimationByTokens(gltf.animations, ['run', 'sprint']);
                    actor.proceduralLocomotion = !walkClip && !runClip && !!actor.gameReadyRig;

                    if (idleClip) {
                        const idleAction = mixer.clipAction(idleClip, clonedScene);
                        idleAction.enabled = true;
                        idleAction.play();
                        idleAction.setEffectiveWeight(1);
                        actor.actions.idle = idleAction;
                    }
                    if (walkClip) {
                        const walkAction = mixer.clipAction(walkClip, clonedScene);
                        walkAction.enabled = true;
                        walkAction.play();
                        walkAction.setEffectiveWeight(0);
                        actor.actions.walk = walkAction;
                    }
                    if (runClip) {
                        const runAction = mixer.clipAction(runClip, clonedScene);
                        runAction.enabled = true;
                        runAction.play();
                        runAction.setEffectiveWeight(0);
                        actor.actions.run = runAction;
                    }

                    actor.mixer = actor.proceduralLocomotion ? null : (Object.keys(actor.actions).length ? mixer : null);
                    actor.ready = true;
                    group.userData.avatarLoading = false;
                })
                .catch(() => {
                    label.remove();
                    scene.remove(group);
                    const fallback = createProceduralAvatar(nickname, styleCode);
                    Object.assign(actor, fallback);
                    actor.avatarKind = "procedural";
                });

            return actor;
        }

        function createProceduralAvatar(nickname, styleCode = "1") {
            const group = new THREE.Group();
            // Keep the shoe soles flush with the mall floor.
            group.position.y = AVATAR_FLOOR_OFFSET;
            setActorCollisionProfile(group);
            const appearance = parseAvatarStyleCode(styleCode);
            const bodyType = appearance.body;
            const outfitType = appearance.outfit;
            const isFeminine = bodyType === "female";
            const isNeutral = bodyType === "neutral";

            let skinColor = 0xffdbac;
            let clothColor = 0x333333;
            let accentColor = 0x555555;
            let hairColor = 0x221100;

            const skinTones = [0xffdbac, 0xf1c27d, 0xe0ac69, 0x8d5524];
            skinColor = skinTones[Math.abs(nickname.split("").reduce((a, b) => a + b.charCodeAt(0), 0)) % skinTones.length];

            if (outfitType === "formal") {
                clothColor = 0x1a1a1a;
                accentColor = 0xc5a059;
                hairColor = 0x111111;
            } else if (outfitType === "sport") {
                clothColor = 0x0066cc;
                accentColor = 0xf2f2f2;
                hairColor = 0x442211;
            } else if (outfitType === "urban") {
                clothColor = 0xaa4455;
                accentColor = 0x2f3136;
                hairColor = 0x221100;
            }

            const clothColorObj = new THREE.Color(clothColor);
            const layeredClothColor = clothColorObj.clone().offsetHSL(0, 0, -0.12);
            const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.56, metalness: 0.02 });
            const clothMat = new THREE.MeshStandardMaterial({ color: clothColor, roughness: 0.68, metalness: 0.04 });
            const layerMat = new THREE.MeshStandardMaterial({ color: layeredClothColor, roughness: 0.76, metalness: 0.03 });
            const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.48, metalness: outfitType === "formal" ? 0.24 : 0.08 });
            const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.78, metalness: 0.03 });
            const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.45 });
            const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
            const soleMat = new THREE.MeshStandardMaterial({ color: 0xe6e1d6, roughness: 0.55 });
            const shoeGeom = new THREE.BoxGeometry(0.16, 0.08, 0.29);
            shoeGeom.translate(0, 0, 0.01);
            const toeGeom = new THREE.SphereGeometry(0.07, 12, 10);
            const shoulderSpan = isFeminine ? 0.235 : (isNeutral ? 0.248 : 0.26);
            const armRootX = isFeminine ? 0.265 : (isNeutral ? 0.283 : 0.3);
            const armRootY = isFeminine ? 1.38 : (isNeutral ? 1.39 : 1.4);
            const legRootX = isFeminine ? 0.125 : (isNeutral ? 0.12 : 0.115);
            const shoulderBaseY = isFeminine ? 1.41 : (isNeutral ? 1.42 : 1.43);
            const torsoBaseY = isFeminine ? 1.16 : (isNeutral ? 1.17 : 1.18);
            const waistBaseY = isFeminine ? 0.89 : (isNeutral ? 0.895 : 0.9);
            const neckBaseY = isFeminine ? 1.53 : (isNeutral ? 1.535 : 1.54);
            const headBaseY = isFeminine ? 1.71 : (isNeutral ? 1.725 : 1.74);

            const addTagged = (parent, mesh, name) => {
                if (name) mesh.name = name;
                mesh.userData.playerId = nickname;
                parent.add(mesh);
                return mesh;
            };

            const createLimb = (topRadius, bottomRadius, height, material, name) => {
                const root = new THREE.Group();
                root.name = name;

                const upperH = height * 0.47;
                const lowerH = height * 0.53;

                const upperGeom = new THREE.CylinderGeometry(topRadius, topRadius * 0.88, upperH, 12);
                upperGeom.translate(0, -upperH / 2, 0);
                const upper = addTagged(root, new THREE.Mesh(upperGeom, material), `${name}_upper`);

                const joint = addTagged(upper, new THREE.Mesh(new THREE.SphereGeometry(Math.max(topRadius, bottomRadius) * 0.82, 10, 10), material), `${name}_joint`);
                joint.position.set(0, -upperH, 0);

                const lowerGeom = new THREE.CylinderGeometry(topRadius * 0.78, bottomRadius, lowerH, 12);
                lowerGeom.translate(0, -lowerH / 2, 0);
                const lower = addTagged(upper, new THREE.Mesh(lowerGeom, material), `${name}_lower`);
                lower.position.set(0, -upperH, 0);

                return { root, upper, lower };
            };

            const shoulders = addTagged(group, new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, isFeminine ? 0.5 : 0.56, 10), accentMat), "shoulders");
            shoulders.position.set(0, shoulderBaseY, 0.01);
            shoulders.rotation.z = Math.PI / 2;

            const shoulderL = addTagged(group, new THREE.Mesh(new THREE.SphereGeometry(isFeminine ? 0.06 : 0.068, 12, 12), accentMat), "shoulderL");
            shoulderL.position.set(-shoulderSpan, shoulderBaseY - 0.02, 0.01);
            const shoulderR = addTagged(group, new THREE.Mesh(new THREE.SphereGeometry(isFeminine ? 0.06 : 0.068, 12, 12), accentMat), "shoulderR");
            shoulderR.position.set(shoulderSpan, shoulderBaseY - 0.02, 0.01);

            const torso = addTagged(group, new THREE.Mesh(new THREE.CylinderGeometry(isFeminine ? 0.17 : 0.205, isFeminine ? 0.23 : 0.24, 0.5, 12), clothMat), "torso");
            torso.position.set(0, torsoBaseY, 0.01);

            const ribcage = addTagged(group, new THREE.Mesh(new THREE.SphereGeometry(isFeminine ? 0.205 : 0.215, 12, 12), clothMat), "ribcage");
            ribcage.position.set(0, isFeminine ? 1.27 : 1.29, 0.02);
            ribcage.scale.set(isFeminine ? 0.96 : 1.05, 0.9, isFeminine ? 0.88 : 0.92);

            const waist = addTagged(group, new THREE.Mesh(new THREE.CylinderGeometry(isFeminine ? 0.21 : 0.185, isFeminine ? 0.125 : 0.155, 0.22, 12), layerMat), "waist");
            waist.position.set(0, waistBaseY, 0.01);

            const pelvis = addTagged(group, new THREE.Mesh(new THREE.SphereGeometry(isFeminine ? 0.185 : 0.17, 12, 12), layerMat), "pelvis");
            pelvis.position.set(0, isFeminine ? 0.75 : 0.76, 0);
            pelvis.scale.set(isFeminine ? 1.34 : 1.16, isFeminine ? 0.78 : 0.72, isFeminine ? 0.92 : 0.88);

            const chestPanel = addTagged(group, new THREE.Mesh(new THREE.BoxGeometry(isFeminine ? 0.24 : 0.26, isFeminine ? 0.3 : 0.34, 0.07), layerMat), "chestPanel");
            chestPanel.position.set(0, isFeminine ? 1.18 : 1.19, 0.13);
            chestPanel.rotation.x = -0.03;

            const hipPanel = addTagged(group, new THREE.Mesh(new THREE.BoxGeometry(isFeminine ? 0.34 : 0.3, 0.12, 0.08), layerMat), "hipPanel");
            hipPanel.position.set(0, isFeminine ? 0.8 : 0.82, 0.11);
            hipPanel.rotation.x = -0.04;

            if (isFeminine) {
                const bustL = addTagged(group, new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), clothMat), "bustL");
                bustL.position.set(-0.075, 1.15, 0.12);
                bustL.scale.set(0.82, 0.7, 0.58);
                const bustR = addTagged(group, new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), clothMat), "bustR");
                bustR.position.set(0.075, 1.15, 0.12);
                bustR.scale.set(0.82, 0.7, 0.58);
            }

            if (outfitType === "formal") {
                const lapelL = addTagged(group, new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.03), accentMat), "lapelL");
                lapelL.position.set(-0.07, 1.18, 0.19);
                lapelL.rotation.z = 0.22;
                const lapelR = addTagged(group, new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.03), accentMat), "lapelR");
                lapelR.position.set(0.07, 1.18, 0.19);
                lapelR.rotation.z = -0.22;
                const tie = addTagged(group, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.31, 0.03), accentMat), "tie");
                tie.position.set(0, 1.08, 0.18);
                const jacketSkirtL = addTagged(group, new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.18, 0.05), layerMat), "jacketSkirtL");
                jacketSkirtL.position.set(-0.07, 0.91, 0.12);
                jacketSkirtL.rotation.x = -0.08;
                const jacketSkirtR = addTagged(group, new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.18, 0.05), layerMat), "jacketSkirtR");
                jacketSkirtR.position.set(0.07, 0.91, 0.12);
                jacketSkirtR.rotation.x = -0.08;
            } else if (outfitType === "sport") {
                const hoodie = addTagged(group, new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 10, 18, Math.PI), accentMat), "hoodie");
                hoodie.position.set(0, 1.43, -0.07);
                hoodie.rotation.x = Math.PI;
                const stripe = addTagged(group, new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.22), accentMat), "stripe");
                stripe.position.set(0, 1.16, 0.13);
                const pouch = addTagged(group, new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.12, 0.06), layerMat), "pouch");
                pouch.position.set(0, 0.99, 0.15);
            } else {
                const blouse = addTagged(group, new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.36, 0.2), accentMat), "blouse");
                blouse.position.set(0, 1.19, 0.03);
                const waistBand = addTagged(group, new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.07), accentMat), "waistBand");
                waistBand.position.set(0, 0.98, 0.13);
                const tee = addTagged(group, new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.24, 0.05), clothMat), "tee");
                tee.position.set(0, 1.13, 0.14);
                const skirtFront = addTagged(group, new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.07), accentMat), "skirtFront");
                skirtFront.position.set(0, 0.73, 0.12);
                skirtFront.rotation.x = -0.12;
                const skirtL = addTagged(group, new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.18, 0.06), accentMat), "skirtL");
                skirtL.position.set(-0.11, 0.73, 0.09);
                skirtL.rotation.set(-0.08, 0.08, 0.04);
                const skirtR = addTagged(group, new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.18, 0.06), accentMat), "skirtR");
                skirtR.position.set(0.11, 0.73, 0.09);
                skirtR.rotation.set(-0.08, -0.08, -0.04);
            }

            const neck = addTagged(group, new THREE.Mesh(new THREE.CylinderGeometry(isFeminine ? 0.043 : 0.055, isFeminine ? 0.054 : 0.065, isFeminine ? 0.11 : 0.14, 10), skinMat), "neck");
            neck.position.set(0, neckBaseY, 0.01);

            const headPivot = new THREE.Group();
            headPivot.name = "headPivot";
            headPivot.position.set(0, headBaseY, 0.01);
            group.add(headPivot);

            const head = addTagged(headPivot, new THREE.Mesh(new THREE.SphereGeometry(isFeminine ? 0.168 : 0.19, 18, 18), skinMat), "head");
            head.scale.set(isFeminine ? 0.84 : 0.9, isFeminine ? 1.03 : 1.06, 0.9);

            const jaw = addTagged(headPivot, new THREE.Mesh(new THREE.SphereGeometry(isFeminine ? 0.126 : 0.15, 12, 12), skinMat), "jaw");
            jaw.position.set(0, isFeminine ? -0.1 : -0.105, 0.02);
            jaw.scale.set(isFeminine ? 0.84 : 0.98, 0.66, 0.78);

            const nose = addTagged(headPivot, new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.075, 8), skinMat), "nose");
            nose.position.set(0, -0.012, 0.162);
            nose.rotation.x = Math.PI / 2;

            const eyeL = new THREE.Group();
            eyeL.name = "eyeL";
            eyeL.position.set(-0.075, 0.04, 0.155);
            addTagged(eyeL, new THREE.Mesh(new THREE.SphereGeometry(0.034, 10, 10), whiteMat), "eyeL_ball");
            const pupilL = addTagged(eyeL, new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 10), blackMat), "eyeL_pupil");
            pupilL.position.z = 0.025;
            headPivot.add(eyeL);

            const eyeR = new THREE.Group();
            eyeR.name = "eyeR";
            eyeR.position.set(0.075, 0.04, 0.155);
            addTagged(eyeR, new THREE.Mesh(new THREE.SphereGeometry(0.034, 10, 10), whiteMat), "eyeR_ball");
            const pupilR = addTagged(eyeR, new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 10), blackMat), "eyeR_pupil");
            pupilR.position.z = 0.025;
            headPivot.add(eyeR);

            const browL = addTagged(headPivot, new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.028), hairMat), "browL");
            browL.position.set(-0.075, 0.1, 0.165);
            browL.rotation.z = -0.12;
            const browR = addTagged(headPivot, new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.028), hairMat), "browR");
            browR.position.set(0.075, 0.1, 0.165);
            browR.rotation.z = 0.12;
            const mouth = addTagged(headPivot, new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.01, 0.02), blackMat), "mouth");
            mouth.position.set(0, -0.118, 0.145);

            const earL = addTagged(headPivot, new THREE.Mesh(new THREE.SphereGeometry(0.033, 10, 10), skinMat), "earL");
            earL.position.set(-0.17, 0, 0);
            earL.scale.set(0.62, 0.95, 0.45);
            const earR = addTagged(headPivot, new THREE.Mesh(new THREE.SphereGeometry(0.033, 10, 10), skinMat), "earR");
            earR.position.set(0.17, 0, 0);
            earR.scale.set(0.62, 0.95, 0.45);

            let hairGeom;
            if (outfitType === "formal") hairGeom = new THREE.SphereGeometry(0.208, 16, 14, 0, Math.PI * 2, 0, Math.PI / 1.86);
            else if (outfitType === "sport") hairGeom = new THREE.BoxGeometry(0.24, 0.095, 0.34);
            else hairGeom = new THREE.SphereGeometry(0.212, 16, 14, 0, Math.PI * 2, 0, Math.PI / 1.6);

            const hair = addTagged(headPivot, new THREE.Mesh(hairGeom, hairMat), "hair");
            hair.position.set(0, isFeminine ? 0.07 : 0.085, outfitType === "sport" ? 0.02 : 0);

            const backHair = addTagged(headPivot, new THREE.Mesh(new THREE.BoxGeometry(isFeminine ? 0.22 : 0.24, isFeminine ? 0.26 : 0.16, isFeminine ? 0.16 : 0.14), hairMat), "backHair");
            backHair.position.set(0, isFeminine ? -0.01 : 0.02, isFeminine ? -0.1 : -0.11);
            backHair.scale.set(outfitType === "sport" ? 0.8 : 1, isFeminine ? 1.25 : 0.92, 1);
            if (outfitType === "sport") backHair.visible = false;

            const sideHairL = addTagged(headPivot, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.13), hairMat), "sideHairL");
            sideHairL.position.set(-0.145, 0.025, 0.02);
            const sideHairR = addTagged(headPivot, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.13), hairMat), "sideHairR");
            sideHairR.position.set(0.145, 0.025, 0.02);
            if (outfitType === "sport") {
                sideHairL.visible = false;
                sideHairR.visible = false;
            }

            if (outfitType === "sport") {
                const visor = addTagged(headPivot, new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.1), hairMat), "visor");
                visor.position.set(0, 0.03, 0.2);
            } else if (outfitType === "urban") {
                const fringe = addTagged(headPivot, new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.08), hairMat), "fringe");
                fringe.position.set(0, 0.07, 0.18);
                fringe.rotation.x = -0.16;
            }

            const armL = createLimb(isFeminine ? 0.052 : 0.06, isFeminine ? 0.041 : 0.046, 0.68, clothMat, "armL");
            armL.root.position.set(-armRootX, armRootY, 0.01);
            armL.root.rotation.z = isFeminine ? 0.1 : 0.16;
            const handL = addTagged(armL.lower, new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.12, 0.065), skinMat), "handL");
            handL.position.set(0, -0.35, 0.015);
            handL.rotation.z = 0.12;
            const cuffL = addTagged(armL.lower, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.048, 0.065, 10), layerMat), "cuffL");
            cuffL.position.set(0, -0.295, 0.01);
            group.add(armL.root);

            const armR = createLimb(isFeminine ? 0.052 : 0.06, isFeminine ? 0.041 : 0.046, 0.68, clothMat, "armR");
            armR.root.position.set(armRootX, armRootY, 0.01);
            armR.root.rotation.z = isFeminine ? -0.1 : -0.16;
            const handR = addTagged(armR.lower, new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.12, 0.065), skinMat), "handR");
            handR.position.set(0, -0.35, 0.015);
            handR.rotation.z = -0.12;
            const cuffR = addTagged(armR.lower, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.048, 0.065, 10), layerMat), "cuffR");
            cuffR.position.set(0, -0.295, 0.01);
            group.add(armR.root);

            const legL = createLimb(isFeminine ? 0.078 : 0.085, isFeminine ? 0.048 : 0.055, 0.86, outfitType === "formal" ? blackMat : layerMat, "legL");
            legL.root.position.set(-legRootX, 0.77, 0);
            const footL = addTagged(legL.lower, new THREE.Mesh(shoeGeom, blackMat), "footL");
            footL.position.set(0, -0.395, 0.085);
            const toeL = addTagged(footL, new THREE.Mesh(toeGeom, blackMat), "toeL");
            toeL.position.set(0, -0.004, 0.135);
            toeL.scale.set(1, 0.54, 1.28);
            const heelL = addTagged(footL, new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.065, 0.09), blackMat), "heelL");
            heelL.position.set(0, -0.002, -0.085);
            const soleL = addTagged(footL, new THREE.Mesh(new THREE.BoxGeometry(0.148, 0.016, 0.245), soleMat), "soleL");
            soleL.position.set(0, -0.044, 0.02);
            group.add(legL.root);

            const legR = createLimb(isFeminine ? 0.078 : 0.085, isFeminine ? 0.048 : 0.055, 0.86, outfitType === "formal" ? blackMat : layerMat, "legR");
            legR.root.position.set(legRootX, 0.77, 0);
            const footR = addTagged(legR.lower, new THREE.Mesh(shoeGeom, blackMat), "footR");
            footR.position.set(0, -0.395, 0.085);
            const toeR = addTagged(footR, new THREE.Mesh(toeGeom, blackMat), "toeR");
            toeR.position.set(0, -0.004, 0.135);
            toeR.scale.set(1, 0.54, 1.28);
            const heelR = addTagged(footR, new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.065, 0.09), blackMat), "heelR");
            heelR.position.set(0, -0.002, -0.085);
            const soleR = addTagged(footR, new THREE.Mesh(new THREE.BoxGeometry(0.148, 0.016, 0.245), soleMat), "soleR");
            soleR.position.set(0, -0.044, 0.02);
            group.add(legR.root);

            group.traverse((obj) => {
                obj.userData.playerId = nickname;
            });

            scene.add(group);

            const label = document.createElement('div');
            label.className = 'avatar-label';
            label.innerText = nickname;
            document.body.appendChild(label);

            return {
                mesh: group,
                label: label,
                targetPos: new THREE.Vector3(),
                targetRot: 0,
                motionPhase: Math.random() * Math.PI * 2,
                idlePhase: Math.random() * Math.PI * 2,
                rig: {
                    shoulders,
                    torso,
                    waist,
                    neck,
                    headPivot,
                    head,
                    hair,
                    armL,
                    armR,
                    legL,
                    legR,
                    footL,
                    footR,
                    base: {
                        shouldersY: shoulderBaseY,
                        torsoY: torsoBaseY,
                        waistY: waistBaseY,
                        neckY: neckBaseY,
                        headY: headBaseY,
                        armLRotZ: isFeminine ? 0.1 : 0.16,
                        armRRotZ: isFeminine ? -0.1 : -0.16
                    }
                }
            };
        }

        function createAvatar(nickname, styleCode = "1") {
            return createProceduralAvatar(nickname, styleCode);
        }

        function updateAvatarLabelPosition(actor, labelOffsetY, farDistanceOverride = null) {
            if (!actor?.mesh || !actor?.label) return;
            const tempVec = actor.mesh.position.clone();
            tempVec.y += labelOffsetY;
            tempVec.project(camera);
            const x = (tempVec.x * 0.5 + 0.5) * window.innerWidth;
            const y = (tempVec.y * -0.5 + 0.5) * window.innerHeight;
            actor.label.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
            actor.label.style.display = (actor.mesh.visible && shouldShowAvatarLabel(actor.mesh.position, tempVec, farDistanceOverride ?? AVATAR_LABEL_FAR_DISTANCE)) ? 'block' : 'none';
        }

        function applyAvatarPose(actor, movementAmount = 0, nowMs = performance.now()) {
            if (!actor) return;

            if (actor.avatarKind === "gltf") {
                const moving = movementAmount > 0.0015;
                const deltaSec = actor.lastPoseTime
                    ? THREE.MathUtils.clamp((nowMs - actor.lastPoseTime) / 1000, 1 / 120, 1 / 20)
                    : 1 / 60;
                actor.lastPoseTime = nowMs;

                if (actor.mixer && !actor.proceduralLocomotion) {
                    actor.mixer.update(deltaSec);

                    const targetBlend = moving ? 1 : 0;
                    actor.walkBlend = THREE.MathUtils.lerp(actor.walkBlend || 0, targetBlend, moving ? 0.22 : 0.14);

                    if (actor.actions.idle) actor.actions.idle.setEffectiveWeight(1 - actor.walkBlend);

                    const locomotionAction = actor.actions.walk || actor.actions.run || null;
                    if (locomotionAction) {
                        locomotionAction.setEffectiveWeight(actor.walkBlend);
                        locomotionAction.timeScale = THREE.MathUtils.clamp(0.78 + movementAmount * 34, 0.78, 1.22);
                    }

                    if (actor.gltfRoot) {
                        const idleBob = moving ? Math.abs(Math.sin((actor.motionPhase || 0))) * 0.012 : Math.sin((actor.idlePhase || 0) + nowMs * 0.0018) * 0.006;
                        actor.gltfRoot.position.y = actor.gltfBaseY + idleBob;
                    }

                    if (moving) actor.motionPhase = (actor.motionPhase || 0) + Math.max(0.03, movementAmount * 9.5);
                    return;
                }

                if (actor.mixer && actor.proceduralLocomotion && actor.actions.idle) {
                    actor.actions.idle.paused = moving;
                    actor.actions.idle.enabled = !moving;
                    actor.actions.idle.setEffectiveWeight(moving ? 0 : 1);
                    if (!moving) {
                        actor.mixer.update(deltaSec);
                        if (actor.gltfRoot) {
                            const idleBob = Math.sin((actor.idlePhase || 0) + nowMs * 0.0018) * 0.004;
                            actor.gltfRoot.position.y = actor.gltfBaseY + idleBob;
                        }
                        return;
                    }
                }

                if (!actor.gameReadyRig || !actor.gltfRoot) return;
                const rig = actor.gameReadyRig;
                const base = rig.base;

                if (typeof actor.motionPhase !== "number") actor.motionPhase = Math.random() * Math.PI * 2;
                if (typeof actor.idlePhase !== "number") actor.idlePhase = Math.random() * Math.PI * 2;
                if (moving) actor.motionPhase += Math.max(0.03, movementAmount * 9.5);

                const walkPhase = actor.motionPhase;
                const idlePhase = nowMs * 0.0018 + actor.idlePhase;
                const breath = Math.sin(idlePhase) * 0.012;
                const bob = moving ? Math.abs(Math.sin(walkPhase)) * 0.045 : breath;
                const sway = moving ? Math.sin(walkPhase) : Math.sin(idlePhase * 0.75) * 0.06;
                const twist = moving ? Math.sin(walkPhase) * 0.05 : Math.sin(idlePhase * 0.6) * 0.014;
                const stride = moving ? THREE.MathUtils.clamp(0.18 + movementAmount * 14, 0.18, 0.62) : 0;
                const armSwingL = moving ? Math.sin(walkPhase + Math.PI) * 0.56 * stride : -0.08 + breath * 0.28;
                const armSwingR = moving ? Math.sin(walkPhase) * 0.56 * stride : 0.08 - breath * 0.28;
                const legSwingL = moving ? Math.sin(walkPhase) * 0.52 * stride : -0.012;
                const legSwingR = moving ? Math.sin(walkPhase + Math.PI) * 0.52 * stride : 0.012;

                actor.gltfRoot.position.y = actor.gltfBaseY + bob * 0.45;

                setBoneFromBase(base, 'spine', rig, moving ? -0.03 + Math.abs(Math.sin(walkPhase)) * 0.012 : breath * 0.18, twist * 0.2, sway * 0.05);
                setBoneFromBase(base, 'chest', rig, moving ? -0.02 + Math.abs(Math.sin(walkPhase + 0.3)) * 0.018 : breath * 0.22, twist * 0.5, sway * 0.08);
                setBoneFromBase(base, 'neck', rig, breath * 0.16, -twist * 0.12, -sway * 0.05);
                setBoneFromBase(base, 'head', rig, moving ? -Math.abs(Math.sin(walkPhase + 0.6)) * 0.02 : breath * 0.2, -twist * 0.18, -sway * 0.04);

                setBoneFromBase(base, 'upperArmL', rig, armSwingL, 0, sway * 0.08);
                setBoneFromBase(base, 'upperArmR', rig, armSwingR, 0, -sway * 0.08);
                setBoneFromBase(base, 'lowerArmL', rig, moving ? (armSwingL > 0 ? -armSwingL * 0.4 : -0.08) : -0.16);
                setBoneFromBase(base, 'lowerArmR', rig, moving ? (armSwingR > 0 ? -armSwingR * 0.4 : -0.08) : -0.16);
                setBoneFromBase(base, 'handL', rig, moving ? Math.max(0, armSwingL) * -0.08 : 0);
                setBoneFromBase(base, 'handR', rig, moving ? Math.max(0, armSwingR) * -0.08 : 0);

                setBoneFromBase(base, 'upperLegL', rig, legSwingL, 0, sway * 0.02);
                setBoneFromBase(base, 'upperLegR', rig, legSwingR, 0, -sway * 0.02);
                setBoneFromBase(base, 'lowerLegL', rig, moving ? Math.max(0, -legSwingL) * 0.52 : -0.04);
                setBoneFromBase(base, 'lowerLegR', rig, moving ? Math.max(0, -legSwingR) * 0.52 : -0.04);
                setBoneFromBase(base, 'footL', rig, moving ? Math.max(0, legSwingL) * -0.16 : 0);
                setBoneFromBase(base, 'footR', rig, moving ? Math.max(0, legSwingR) * -0.16 : 0);
                return;
            }

            if (!actor.rig) return;

            const rig = actor.rig;
            const base = rig.base;
            const moving = movementAmount > 0.0015;

            if (typeof actor.motionPhase !== "number") actor.motionPhase = Math.random() * Math.PI * 2;
            if (typeof actor.idlePhase !== "number") actor.idlePhase = Math.random() * Math.PI * 2;

            if (moving) {
                actor.motionPhase += Math.max(0.03, movementAmount * 11.5);
            }

            const walkPhase = actor.motionPhase;
            const idlePhase = nowMs * 0.0018 + actor.idlePhase;
            const breath = Math.sin(idlePhase) * 0.016;
            const bob = moving ? Math.abs(Math.sin(walkPhase)) * 0.065 : breath;
            const sway = moving ? Math.sin(walkPhase) : Math.sin(idlePhase * 0.75) * 0.09;
            const twist = moving ? Math.sin(walkPhase) * 0.07 : Math.sin(idlePhase * 0.6) * 0.018;
            const stride = moving ? THREE.MathUtils.clamp(0.18 + movementAmount * 15, 0.18, 0.7) : 0;

            rig.shoulders.position.y = base.shouldersY + bob * 0.52;
            rig.torso.position.y = base.torsoY + bob * 0.42;
            rig.waist.position.y = base.waistY + bob * 0.18;
            rig.neck.position.y = base.neckY + bob * 0.72;
            rig.headPivot.position.y = base.headY + bob * 0.9 + Math.sin(idlePhase * 1.4) * 0.006;

            rig.shoulders.rotation.x = moving ? -0.03 + Math.abs(Math.sin(walkPhase)) * 0.018 : 0.01;
            rig.shoulders.rotation.y = twist * 0.78;
            rig.shoulders.rotation.z = -sway * 0.035;
            rig.torso.rotation.x = moving ? -0.035 + Math.abs(Math.sin(walkPhase)) * 0.028 : 0.012 + breath * 0.22;
            rig.torso.rotation.y = twist;
            rig.torso.rotation.z = sway * 0.04;
            rig.waist.rotation.y = -twist * 0.5;
            rig.waist.rotation.z = sway * 0.026;
            rig.headPivot.rotation.x = moving ? -Math.abs(Math.sin(walkPhase + 0.5)) * 0.03 : breath * 0.28;
            rig.headPivot.rotation.y = -twist * 0.35;
            rig.headPivot.rotation.z = -sway * 0.024;

            const armSwingL = moving ? Math.sin(walkPhase + Math.PI) * 0.66 * stride : -0.1 + breath * 0.36;
            const armSwingR = moving ? Math.sin(walkPhase) * 0.66 * stride : 0.07 - breath * 0.36;
            const legSwingL = moving ? Math.sin(walkPhase) * 0.54 * stride : -0.018;
            const legSwingR = moving ? Math.sin(walkPhase + Math.PI) * 0.54 * stride : 0.018;

            rig.armL.root.rotation.z = base.armLRotZ - sway * 0.055;
            rig.armR.root.rotation.z = base.armRRotZ + sway * 0.055;
            rig.armL.root.rotation.x = armSwingL;
            rig.armR.root.rotation.x = armSwingR;
            rig.armL.root.rotation.y = moving ? -0.06 : -0.03;
            rig.armR.root.rotation.y = moving ? 0.06 : 0.03;
            rig.armL.lower.rotation.x = moving ? (armSwingL > 0 ? -armSwingL * 0.52 : -0.07) : -0.18;
            rig.armR.lower.rotation.x = moving ? (armSwingR > 0 ? -armSwingR * 0.52 : -0.07) : -0.14;

            rig.legL.root.rotation.x = legSwingL;
            rig.legR.root.rotation.x = legSwingR;
            rig.legL.root.rotation.z = sway * 0.028;
            rig.legR.root.rotation.z = -sway * 0.028;
            rig.legL.lower.rotation.x = moving ? 0.12 + Math.max(0, -legSwingL) * 1.04 : 0.07;
            rig.legR.lower.rotation.x = moving ? 0.12 + Math.max(0, -legSwingR) * 1.04 : 0.07;
            rig.footL.rotation.x = moving ? Math.max(0, legSwingL) * -0.22 : -0.01;
            rig.footR.rotation.x = moving ? Math.max(0, legSwingR) * -0.22 : -0.01;
        }

        function syncPlayers(state) {
            Object.keys(state).forEach(id => {
                if (id === myNickname) return;
                let remoteStyle = "1";
                if (state[id] && state[id][0] && state[id][0].style) remoteStyle = state[id][0].style;
                if (!otherPlayers[id]) otherPlayers[id] = createAvatar(id, remoteStyle);
                // No configuramos posiciones iniciales aquí porque vendrán vía Broadcast
            });
        }

        function removePlayer(id) {
            if (otherPlayers[id]) {
                scene.remove(otherPlayers[id].mesh);
                otherPlayers[id].label.remove();
                delete otherPlayers[id];
            }
        }

        function updateOtherPlayers(nowMs = performance.now(), updateLabels = true) {
            Object.values(otherPlayers).forEach(p => {
                if (p.mesh) {
                    const prevPos = p.mesh.position.clone();
                    p.mesh.position.lerp(p.targetPos, 0.1);
                    let targetRot = p.targetRot; // El valor ya viene corregido desde el emisor
                    let rotDiff = targetRot - p.mesh.rotation.y;
                    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
                    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
                    p.mesh.rotation.y += rotDiff * 0.35; // Giro más rápido y reactivo

                    const stepDistance = prevPos.distanceTo(p.mesh.position);
                    applyAvatarPose(p, stepDistance, nowMs);
                    const distToCam = camera.position.distanceTo(p.mesh.position);
                    p.mesh.visible = true;
                    if (updateLabels) updateAvatarLabelPosition(p, 2.15);
                }
            });
        }

        (function syncBuildStamp() {
            const stampEl = document.getElementById('debug-build-stamp');
            if (stampEl) {
                stampEl.innerText = "Actualización 20:00 - Ronda 1 Completa + Fix Piso Blanco (Elevación 0.15) · 03-06-2026 21:45";
            }
        })();
