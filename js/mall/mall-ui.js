        // --- SISTEMA DE BÚSQUEDA Y MAPAS ---
        const mallUiScopeQuery = (query) => window.mallContext?.scopeQuery
            ? window.mallContext.scopeQuery(query)
            : query;
        const mallUiScopePayload = (payload) => window.mallContext?.scopePayload
            ? window.mallContext.scopePayload(payload)
            : payload;
        let fullStoreInventory = [];
        window.supabaseStoresCache = null;
        async function precalculateInventory() {
            if (!supabaseClient) return;
            // Optimización: Una sola petición para obtener todos los locales activos
            const allStores = await window.mallCatalogRequests.getStores();
            if (!allStores) return;

            window.supabaseStoresCache = allStores;

            fullStoreInventory = allStores.map(s => ({
                shopCode: getStoreCode(s),
                name: s.name || "Local Disponible",
                category: s.category || "Comercio",
                catalogMemory: s.catalog_memory || "",
                description: s.catalog_memory || "",
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

        let selectedSearchStoreCode = "";
        let searchProductsLoaded = false;
        const SEARCH_STOP_WORDS = new Set([
            "aqui", "para", "por", "con", "sin", "del", "las", "los", "una", "uno", "unos", "unas",
            "que", "como", "donde", "local", "producto", "productos", "tienda", "busco", "buscar",
            "quiero", "necesito", "hay", "tiene", "tienen", "algo", "todo", "toda", "todos", "todas",
            "mas", "muy", "este", "esta", "estos", "estas", "ese", "esa", "esos", "esas"
        ]);

        function normalizeSearchText(value = "") {
            return String(value || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]+/g, " ")
                .trim();
        }

        function getSearchCodeCandidates(code = "") {
            const raw = String(code || "").trim();
            if (!raw) return [];
            const compact = raw.replace(/-/g, "");
            const hyphenated = compact.replace(/^([A-Z]+)(\d+)$/i, "$1-$2").toUpperCase();
            return [...new Set([raw, raw.toUpperCase(), compact, compact.toUpperCase(), hyphenated].filter(Boolean))];
        }

        function extractSearchTerms(value = "") {
            return normalizeSearchText(value)
                .split(" ")
                .filter(term => term && (term.length >= 3 || /\d/.test(term)) && !SEARCH_STOP_WORDS.has(term))
                .slice(0, 8);
        }

        function compactSearchText(value = "") {
            return normalizeSearchText(value).replace(/\s+/g, "");
        }

        function extractHashKeywords(...values) {
            const found = [];
            values.filter(Boolean).forEach(value => {
                String(value).replace(/#([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_-]{2,40})/g, (_match, tag) => {
                    const normalized = normalizeSearchText(tag);
                    if (normalized) found.push(normalized);
                    return _match;
                });
            });
            return [...new Set(found)];
        }

        function getKeywordText(source = {}) {
            const rawTags = Array.isArray(source.tags) ? source.tags.join(" ") : source.tags;
            return [
                source.search_keywords,
                source.keywords,
                source.keyword_tags,
                rawTags
            ].filter(Boolean).join(" ");
        }

        function matchesEveryTerm(text, terms) {
            if (!terms.length) return false;
            const normalized = normalizeSearchText(text);
            return terms.every(term => normalized.includes(term));
        }

        function clampMapCoord(value, min = 6, max = 94) {
            return Math.max(min, Math.min(max, value));
        }

        function productName(product) {
            return product?.name || product?.n || "Producto";
        }

        function productSearchText(product) {
            return normalizeSearchText([
                product?.name,
                product?.n,
                product?.description,
                product?.category,
                getKeywordText(product),
                extractHashKeywords(product?.description, getKeywordText(product)).join(" "),
                product?.price,
                product?.p
            ].filter(Boolean).join(" "));
        }

        function syncStoreSearchText(store) {
            store.searchText = normalizeSearchText([
                store.shopCode,
                store.name,
                store.category,
                store.description,
                store.catalogMemory,
                store.keywords,
                store.hashKeywords?.join(" "),
                (store.products || []).map(product => `${productName(product)} ${product?.description || ""}`).join(" ")
            ].join(" "));
        }

        async function loadSearchProductsForStores() {
            if (searchProductsLoaded || !supabaseClient || !fullStoreInventory.length) return;
            searchProductsLoaded = true;

            try {
                if (typeof window.preloadAllProducts === 'function') {
                    await window.preloadAllProducts();
                }

                if (!window.storeProductsCache) return;
                fullStoreInventory.forEach(store => {
                    const productKeys = [
                        store.storeId,
                        store.shopCode,
                        ...getSearchCodeCandidates(store.shopCode),
                        ...getSearchCodeCandidates(store.storeId)
                    ].filter(Boolean);

                    for (const key of productKeys) {
                        const cached = window.storeProductsCache.get(key) || window.storeProductsCache.get(String(key).toLowerCase());
                        if (cached && cached.length) {
                            store.products = cached;
                            break;
                        }
                    }
                    syncStoreSearchText(store);
                });
            } catch (err) {
                console.warn("[Search] No se pudieron cargar productos para el tótem:", err);
            }
        }

        async function rebuildTotemSearchInventory() {
            if (!supabaseClient) return;
            try {
                const { data: allStores, error } = await mallUiScopeQuery(supabaseClient.from('stores').select('*'));
                if (error) throw error;
                if (!allStores) return;

                window.supabaseStoresCache = allStores;
                fullStoreInventory = allStores.map(store => {
                    const item = {
                        storeRef: store,
                        storeId: store.id || "",
                        shopCode: getStoreCode(store),
                        name: store.name || "Local Disponible",
                        category: store.category || "Comercio",
                        catalogMemory: store.catalog_memory || "",
                        description: [
                            store.description,
                            store.public_description,
                            store.short_description,
                            store.bio,
                            store.about,
                            store.catalog_description,
                            store.specialty,
                            store.notes,
                            store.catalog_memory
                        ].filter(Boolean).join(" "),
                        keywords: getKeywordText(store),
                        hashKeywords: extractHashKeywords(
                            store.description,
                            store.public_description,
                            store.short_description,
                            store.bio,
                            store.about,
                            store.catalog_description,
                            store.specialty,
                            store.catalog_memory,
                            getKeywordText(store)
                        ),
                        products: []
                    };
                    syncStoreSearchText(item);
                    return item;
                });

                searchProductsLoaded = false;
                await loadSearchProductsForStores();
            } catch (err) {
                console.warn("[Search] No se pudo preparar el inventario de búsqueda:", err);
            }
        }
        window.refreshTotemSearchInventory = rebuildTotemSearchInventory;
        rebuildTotemSearchInventory();

        function getCurrentUserMapLocation() {
            if (typeof camera === "undefined" || !camera?.position) {
                return { x: 50, y: 50, floor: 1, label: "Ubicación actual: no disponible todavía" };
            }
            const floor = camera.position.y > 3 ? 2 : 1;
            return {
                x: clampMapCoord(50 - (camera.position.x / 90) * 40),
                y: clampMapCoord(50 - (camera.position.z / 90) * 40),
                floor,
                label: `Ubicación actual: Planta ${floor}, X ${camera.position.x.toFixed(1)}, Z ${camera.position.z.toFixed(1)}`
            };
        }

        const PLAN_STORE_MAP = {
            N101: [42, 18], N103: [42, 24], N105: [42, 32], N107: [42, 38], N01: [42, 44], NO1: [42, 44], NO10: [42, 44],
            N102: [58, 18], N104: [58, 24], N106: [58, 32], N108: [58, 38], EN1: [58, 44], EN10: [58, 44],
            S108: [42, 62], S106: [42, 68], S104: [42, 76], S102: [42, 82], OS1: [42, 56], OS10: [42, 56],
            SE1: [58, 56], SE10: [58, 56], S107: [58, 62], S105: [58, 68], S103: [58, 76], S101: [58, 82],
            O102: [20, 42], O104: [27, 42], O105: [34, 42], O108: [39, 42],
            O101: [20, 58], O103: [27, 58], O107: [39, 58],
            E107: [61, 42], E105: [68, 42], E103: [75, 42], E101: [82, 42],
            E108: [61, 58], E106: [68, 58], E104: [75, 58], E002: [82, 58],

            N201: [42, 16], N203: [42, 21], N205: [42, 27], N207: [42, 33], N209: [42, 39], NO2: [42, 45],
            N202: [58, 16], N204: [58, 21], N206: [58, 27], N208: [58, 33], N210: [58, 39], EN2: [58, 45],
            S210: [42, 55], S208: [42, 61], S206: [42, 67], S204: [42, 73], S202: [42, 79], OS2: [42, 49],
            SE2: [58, 49], S209: [58, 55], S207: [58, 61], S205: [58, 67], S203: [58, 73], S201: [58, 79],
            O202: [22, 42], O204: [28, 42], O206: [34, 42], O208: [40, 42], O210: [46, 42],
            O201: [22, 58], O203: [28, 58], O205: [34, 58], O207: [40, 58], O209: [46, 58],
            E209: [54, 42], E207: [60, 42], E205: [66, 42], E203: [72, 42], E201: [78, 42],
            E210: [54, 58], E208: [60, 58], E206: [66, 58], E204: [72, 58], E202: [78, 58],

            N: [50, 7], S: [50, 93], E: [93, 50], O: [7, 50]
        };

        function normalizePlanStoreCode(code = "") {
            return String(code || "").trim().toUpperCase().replace(/-/g, "");
        }

        function getSearchSelectedStoreCode(store = {}) {
            return String(
                store.teleportCode ||
                store.searchSelectedCode ||
                store.selectedShopCode ||
                store.shopCode ||
                getStoreCode(store) ||
                ""
            ).trim();
        }

        function getGroupCodeMatchScore(group, selectedCode = "") {
            const selectedCompact = normalizePlanStoreCode(selectedCode);
            if (!group || !selectedCompact) return 100;
            const meta = group.userData?.physicalSpaceMeta || {};
            const visibleCodes = [
                group.userData?.plateCode,
                group.userData?.displayCode,
                meta.displayCode,
                group.userData?.shopCode
            ].map(normalizePlanStoreCode).filter(Boolean);
            if (visibleCodes.includes(selectedCompact)) return 0;
            return 10;
        }

        function getPlanWingLabel(compactCode = "") {
            const corner = compactCode.match(/^(NO|EN|OS|SE)/);
            return corner ? corner[1] : compactCode.charAt(0);
        }

        function getStoreMapLocation(store) {
            const code = getSearchSelectedStoreCode(store).toUpperCase();
            const compact = normalizePlanStoreCode(code);
            const planPoint = PLAN_STORE_MAP[compact];
            const wing = getPlanWingLabel(compact);
            const numeric = parseInt(compact.replace(/^[A-Z]+/, ""), 10);
            const floor = /2\d\d/.test(compact) ? 2 : 1;
            if (planPoint) {
                return { x: planPoint[0], y: planPoint[1], floor, wing, code };
            }
            const slot = Number.isFinite(numeric) ? Math.max(1, Math.min(10, numeric % 100 || 10)) : 5;
            const along = 14 + ((slot - 1) / 9) * 72;
            let x = 50;
            let y = 50;

            if (compact.length <= 2) {
                if (wing === "N") y = 7;
                else if (wing === "S") y = 93;
                else if (wing === "E") x = 7;
                else if (wing === "O") x = 93;
            } else if (wing === "N") {
                x = along; y = 20;
            } else if (wing === "S") {
                x = along; y = 80;
            } else if (wing === "E") {
                x = 80; y = along;
            } else if (wing === "O") {
                x = 20; y = along;
            }

            return { x: clampMapCoord(x), y: clampMapCoord(y), floor, wing, code };
        }

        function clearSvgGroup(id) {
            const group = document.getElementById(id);
            if (group) group.innerHTML = "";
            return group;
        }

        function drawMapMarker(groupId, location, color, label) {
            const group = clearSvgGroup(groupId);
            if (!group) return;

            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", location.x);
            circle.setAttribute("cy", location.y);
            circle.setAttribute("r", 3.6);
            circle.setAttribute("fill", color);
            circle.setAttribute("stroke", "#ffffff");
            circle.setAttribute("stroke-width", "1.2");
            group.appendChild(circle);

            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", clampMapCoord(location.x + 4, 8, 88));
            text.setAttribute("y", clampMapCoord(location.y - 4, 8, 96));
            text.setAttribute("fill", color);
            text.setAttribute("font-size", "4");
            text.setAttribute("font-weight", "700");
            text.textContent = label;
            group.appendChild(text);
        }

        function drawRouteOnMap(userLocation, targetLocation) {
            const group = clearSvgGroup("map-route-path");
            if (!group) return;

            const route = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
            route.setAttribute("points", `${userLocation.x},${userLocation.y} ${targetLocation.x},${userLocation.y} ${targetLocation.x},${targetLocation.y}`);
            route.setAttribute("fill", "none");
            route.setAttribute("stroke", "#c5a059");
            route.setAttribute("stroke-width", "2.2");
            route.setAttribute("stroke-linecap", "round");
            route.setAttribute("stroke-linejoin", "round");
            route.setAttribute("stroke-dasharray", "3 2");
            group.appendChild(route);
        }

        let activeCompactRouteStore = null;

        function drawCompactRouteMarker(groupId, location, color, label) {
            const group = clearSvgGroup(groupId);
            if (!group) return;
            const marker = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            marker.setAttribute("cx", location.x);
            marker.setAttribute("cy", location.y);
            marker.setAttribute("r", 3.4);
            marker.setAttribute("fill", color);
            marker.setAttribute("stroke", "#ffffff");
            marker.setAttribute("stroke-width", "1.1");
            group.appendChild(marker);
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", clampMapCoord(location.x + 4, 8, 88));
            text.setAttribute("y", clampMapCoord(location.y - 4, 8, 96));
            text.setAttribute("fill", color);
            text.setAttribute("font-size", "4");
            text.setAttribute("font-weight", "700");
            text.textContent = label;
            group.appendChild(text);
        }

        function showCompactRouteMap(store, userLocation, targetLocation, selectedCode) {
            if (!window.matchMedia('(min-width: 701px)').matches) return false;
            const card = document.getElementById('compact-route-map');
            const title = document.getElementById('compact-route-map-title');
            const floor = document.getElementById('compact-route-map-floor');
            const copy = document.getElementById('compact-route-map-copy');
            const routeGroup = clearSvgGroup('compact-route-path');
            const teleport = document.getElementById('compact-route-map-teleport');
            if (!card || !title || !floor || !copy || !routeGroup || !teleport) return false;

            const route = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
            route.setAttribute("points", `${userLocation.x},${userLocation.y} ${targetLocation.x},${userLocation.y} ${targetLocation.x},${targetLocation.y}`);
            route.setAttribute("fill", "none");
            route.setAttribute("stroke", "#d7b25f");
            route.setAttribute("stroke-width", "2.2");
            route.setAttribute("stroke-linecap", "round");
            route.setAttribute("stroke-linejoin", "round");
            route.setAttribute("stroke-dasharray", "3 2");
            routeGroup.appendChild(route);
            drawCompactRouteMarker('compact-route-user', userLocation, '#48a6ed', 'Tú');
            drawCompactRouteMarker('compact-route-target', targetLocation, '#e46957', selectedCode || 'Local');

            title.textContent = store?.name || `Local ${selectedCode}`;
            floor.textContent = `Planta ${targetLocation.floor} · Ala ${targetLocation.wing || '-'}`;
            copy.textContent = `Sigue la ruta hacia ${selectedCode || targetLocation.code}.`;
            activeCompactRouteStore = store;
            teleport.hidden = !hasMemberBenefitAccess();
            card.hidden = false;
            return true;
        }

        window.closeCompactRouteMap = function () {
            const card = document.getElementById('compact-route-map');
            if (card) card.hidden = true;
            activeCompactRouteStore = null;
        };

        window.teleportFromCompactRoute = function () {
            if (!activeCompactRouteStore) return;
            if (!hasMemberBenefitAccess()) {
                window.showMemberBenefitRequired('el teletransporte desde el mapa');
                return;
            }
            window.mallAnalytics?.track('route_requested', {
                storeCode: getSearchSelectedStoreCode(activeCompactRouteStore),
                source: 'compact_map'
            });
            window.teleportVisitorToSearchStore(activeCompactRouteStore);
            window.closeCompactRouteMap();
        };

        function refreshSearchUserLocation() {
            const userLocation = getCurrentUserMapLocation();
            const userLocationText = document.getElementById("user-location-text");
            if (userLocationText) userLocationText.textContent = userLocation.label;
            drawMapMarker("map-user-pos", userLocation, "#1f7ae0", "Tú");
            return userLocation;
        }

        function getStoreGroupsForTeleport(code = "") {
            const groups = [];
            const addGroup = (group) => {
                if (group && !groups.includes(group)) groups.push(group);
            };
            getSearchCodeCandidates(code).forEach((candidate) => {
                if (typeof getStoreGroupCollection === "function") {
                    getStoreGroupCollection(candidate).forEach(addGroup);
                }
                if (typeof storeGroups !== "undefined") addGroup(storeGroups[candidate]);
            });
            return groups;
        }

        function getTeleportFloorY(floor = 1) {
            return floor === 2 ? 5.5 : 0;
        }

        function getTeleportGroundY(floor = 1) {
            return floor === 2 ? 5.4 : 0.1;
        }

        function alignTeleportCandidateToFloor(candidate, floor = 1, targetHeight = 3.05) {
            if (!candidate?.position || !candidate?.target) return candidate;
            const eyeHeight = typeof PLAYER_EYE_HEIGHT !== "undefined" ? PLAYER_EYE_HEIGHT : 1.7;
            const groundY = getTeleportGroundY(floor);
            candidate.position.y = groundY + eyeHeight;
            candidate.target.y = groundY + targetHeight;
            return candidate;
        }

        function getTeleportValidationFloor(position) {
            const y = Number(position?.y);
            if (!Number.isFinite(y)) return 1;
            return y >= 5 ? 2 : 1;
        }

        function getTeleportClearanceChecks(position) {
            const floor = getTeleportValidationFloor(position);
            const clearance = floor === 2 ? 0.28 : 0.45;
            return [
                [0, 0],
                [clearance, 0],
                [-clearance, 0],
                [0, clearance],
                [0, -clearance]
            ];
        }

        function getTeleportCollisionRadius(position) {
            return getTeleportValidationFloor(position) === 2 ? 0.24 : 0.4;
        }

        function isInSecondFloorArrivalEnvelope(position) {
            if (getTeleportValidationFloor(position) !== 2) return false;
            const x = Number(position?.x);
            const z = Number(position?.z);
            if (!Number.isFinite(x) || !Number.isFinite(z)) return false;

            const absX = Math.abs(x);
            const absZ = Math.abs(z);
            const outerLimit = 96;
            const innerArmHalfWidth = 17.5;

            if (absX > outerLimit || absZ > outerLimit) return false;

            const northSouthArm = absX <= innerArmHalfWidth && absZ >= 9 && absZ <= outerLimit;
            const eastWestArm = absZ <= innerArmHalfWidth && absX >= 9 && absX <= outerLimit;
            const centralRing = absX <= innerArmHalfWidth && absZ <= innerArmHalfWidth;
            return northSouthArm || eastWestArm || centralRing;
        }

        function isWalkableTeleportPosition(position) {
            if (!position) return false;
            if (typeof checkCollision !== "function") return true;
            if (isInSecondFloorArrivalEnvelope(position)) {
                return true;
            }
            const clearanceChecks = getTeleportClearanceChecks(position);
            const collisionRadius = getTeleportCollisionRadius(position);
            return clearanceChecks.every(([dx, dz]) => (
                !checkCollision(position.x + dx, position.y, position.z + dz, {
                    ignoreActorId: "__local__",
                    includeActors: false,
                    collisionRadius
                })
            ));
        }

        function makeStorefrontTeleportCandidate(group, localX, localZ, targetLocalZ, targetLocalY = null) {
            const eyeHeight = typeof PLAYER_EYE_HEIGHT !== "undefined" ? PLAYER_EYE_HEIGHT : 1.7;
            const localPosition = new THREE.Vector3(localX, eyeHeight, localZ);
            const localTarget = new THREE.Vector3(0, targetLocalY ?? (eyeHeight + 0.8), targetLocalZ);
            return {
                position: group.localToWorld(localPosition.clone()),
                target: group.localToWorld(localTarget.clone())
            };
        }

        function getTeleportGroupFloor(group) {
            const metaFloor = Number(group?.userData?.physicalSpaceMeta?.floor);
            if (Number.isFinite(metaFloor) && metaFloor > 0) return metaFloor;
            const y = Number(group?.position?.y || 0);
            return y >= 5 ? 2 : 1;
        }

        async function resolveStorefrontTeleportTarget(store) {
            const storeCode = getSearchSelectedStoreCode(store);
            const targetLocation = getStoreMapLocation(store);
            const savedDestination = await resolveSavedStorefrontTeleportTarget(storeCode, targetLocation.floor);
            if (savedDestination?.blocked) return null;
            if (savedDestination) return savedDestination;

            const targetFloorY = getTeleportFloorY(targetLocation.floor);
            const groups = getStoreGroupsForTeleport(storeCode)
                .filter(group => {
                    if (!group) return false;
                    if (group.userData?.isAnchor) return true;
                    if (!group.userData?.isBoutique) return true;
                    return getTeleportGroupFloor(group) === targetLocation.floor;
                })
                .sort((a, b) => {
                    const aCodeScore = getGroupCodeMatchScore(a, storeCode);
                    const bCodeScore = getGroupCodeMatchScore(b, storeCode);
                    if (aCodeScore !== bCodeScore) return aCodeScore - bCodeScore;
                    const aFloorDelta = Math.abs((a?.position?.y || 0) - targetFloorY);
                    const bFloorDelta = Math.abs((b?.position?.y || 0) - targetFloorY);
                    if (aFloorDelta !== bFloorDelta) return aFloorDelta - bFloorDelta;
                    return camera.position.distanceTo(a.getWorldPosition(new THREE.Vector3())) - camera.position.distanceTo(b.getWorldPosition(new THREE.Vector3()));
                });

            const group = groups[0];
            if (!group) return null;

            const isAnchor = !!group.userData?.isAnchor;
            const doorFrontZ = isAnchor ? 9.05 : 9.02;
            const outsideOffsets = isAnchor ? [4.2, 3.6, 4.8, 3.0, 5.4] : [4.0, 3.4, 4.6, 2.8, 5.2];
            const localXOptions = isAnchor ? [0, -4.5, 4.5, -8, 8] : [0, -1.2, 1.2, -2.2, 2.2];
            const targetLocalZ = doorFrontZ;
            const targetLocalY = isAnchor ? 2.9 : 2.65;

            for (const outsideOffset of outsideOffsets) {
                const localZ = doorFrontZ + outsideOffset;
                for (const localX of localXOptions) {
                    const candidate = alignTeleportCandidateToFloor(
                        makeStorefrontTeleportCandidate(group, localX, localZ, targetLocalZ, targetLocalY),
                        targetLocation.floor,
                        targetLocalY
                    );
                    if (isWalkableTeleportPosition(candidate.position)) {
                        window.mallLastTeleportDebug = {
                            selectedCode: storeCode,
                            resolvedGroupCode: group.userData?.shopCode || "",
                            resolvedPlateCode: group.userData?.plateCode || group.userData?.physicalSpaceMeta?.displayCode || "",
                            resolvedSourceCode: group.userData?.sourceShopCode || group.userData?.generatedShopCode || "",
                            targetFloor: targetLocation.floor,
                            entranceBased: true,
                            doorFrontZ,
                            outsideOffset,
                            localX,
                            localZ,
                            worldPosition: {
                                x: Number(candidate.position.x.toFixed(2)),
                                y: Number(candidate.position.y.toFixed(2)),
                                z: Number(candidate.position.z.toFixed(2))
                            }
                        };
                        return { ...candidate, group };
                    }
                }
            }

            window.mallLastTeleportDebug = {
                selectedCode: storeCode,
                resolvedGroupCode: group.userData?.shopCode || "",
                resolvedPlateCode: group.userData?.plateCode || group.userData?.physicalSpaceMeta?.displayCode || "",
                resolvedSourceCode: group.userData?.sourceShopCode || group.userData?.generatedShopCode || "",
                targetFloor: targetLocation.floor,
                entranceBased: true,
                blocked: true,
                doorFrontZ
            };
            return null;
        }

        function showMagicTeleportFlash() {
            let flash = document.getElementById("magic-teleport-flash");
            if (!flash) {
                flash = document.createElement("div");
                flash.id = "magic-teleport-flash";
                document.body.appendChild(flash);
            }
            flash.classList.remove("is-active");
            void flash.offsetWidth;
            flash.classList.add("is-active");
        }

        function resetLocalMovementInputs() {
            if (typeof window.resetMallNavigationInputs === "function") {
                window.resetMallNavigationInputs(900);
                return;
            }
            try {
                Object.keys(keys).forEach((key) => { keys[key] = false; });
            } catch (_) {}
            try {
                currentMoveVelocityX = 0;
                currentMoveVelocityZ = 0;
                currentYawVelocity = 0;
                currentPitchVelocity = 0;
            } catch (_) {}
        }

        function getControlsTargetForLookPoint(position, lookPoint) {
            if (!position || !lookPoint) return lookPoint;
            const direction = lookPoint.clone().sub(position);
            if (direction.lengthSq() < 0.000001) return lookPoint.clone();
            direction.normalize();

            const minDistance = Number.isFinite(controls?.minDistance) ? controls.minDistance : 0.01;
            const maxDistance = Number.isFinite(controls?.maxDistance) ? controls.maxDistance : 0.05;
            if (isWalking && maxDistance <= 0.2) {
                const targetDistance = THREE.MathUtils.clamp(maxDistance * 0.8, minDistance + 0.005, maxDistance);
                return position.clone().add(direction.multiplyScalar(targetDistance));
            }
            return lookPoint.clone();
        }

        function applyTeleportPose(destination, holdMs = 0) {
            if (!destination?.position || !destination?.target) return;
            const controlTarget = getControlsTargetForLookPoint(destination.position, destination.target);
            controls.target.copy(controlTarget);
            camera.position.copy(destination.position);
            controls.update();
            camera.position.copy(destination.position);
            controls.target.copy(controlTarget);
            if (holdMs > 0) {
                window.mallTeleportHoldPose = {
                    px: Number(destination.position.x),
                    py: Number(destination.position.y),
                    pz: Number(destination.position.z),
                    tx: Number(controlTarget.x),
                    ty: Number(controlTarget.y),
                    tz: Number(controlTarget.z)
                };
                window.mallTeleportHoldUntil = Date.now() + holdMs;
                window.mallMovementLockedUntil = Date.now() + holdMs;
            }
            window.mallLastTeleportFinal = {
                camera: {
                    x: Number(camera.position.x.toFixed(2)),
                    y: Number(camera.position.y.toFixed(2)),
                    z: Number(camera.position.z.toFixed(2))
                },
                target: {
                    x: Number(destination.target.x.toFixed(2)),
                    y: Number(destination.target.y.toFixed(2)),
                    z: Number(destination.target.z.toFixed(2))
                },
                controlTarget: {
                    x: Number(controls.target.x.toFixed(2)),
                    y: Number(controls.target.y.toFixed(2)),
                    z: Number(controls.target.z.toFixed(2))
                }
            };
        }

        function animateCameraTeleport(destination, durationMs = 680) {
            return new Promise((resolve) => {
                const startPosition = camera.position.clone();
                const startTarget = controls.target.clone();
                const endPosition = destination.position.clone();
                const endLookTarget = destination.target.clone();
                const startedAt = performance.now();
                const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

                function step(now) {
                    const t = Math.min(1, (now - startedAt) / durationMs);
                    const k = ease(t);
                    const framePosition = new THREE.Vector3().lerpVectors(startPosition, endPosition, k);
                    const frameControlTarget = getControlsTargetForLookPoint(framePosition, endLookTarget);
                    camera.position.copy(framePosition);
                    controls.target.lerpVectors(startTarget, frameControlTarget, k);
                    controls.update();
                    camera.position.copy(framePosition);
                    controls.target.copy(frameControlTarget);
                    if (t < 1) {
                        requestAnimationFrame(step);
                    } else {
                        applyTeleportPose({ position: endPosition, target: endLookTarget }, 1200);
                        resolve();
                    }
                }

                requestAnimationFrame(step);
            });
        }

        window.teleportVisitorToSearchStore = async function (store) {
            if (!hasMemberBenefitAccess()) {
                window.showMemberBenefitRequired('el teletransporte desde el tótem');
                return;
            }
            const storeCode = getSearchSelectedStoreCode(store);
            if (!storeCode) {
                showInteractionFeedback("Selecciona un local primero.");
                return;
            }

            const destination = await resolveStorefrontTeleportTarget(store);
            if (!destination) {
                showInteractionFeedback(`No encontré una posición segura para ${storeCode}.`);
                return;
            }

            const searchModal = document.getElementById('search-modal');
            const modalOverlay = document.getElementById('modal-overlay');
            if (searchModal) searchModal.style.display = 'none';
            if (modalOverlay) modalOverlay.style.display = 'none';

            if (!isWalking && typeof window.toggleWalkMode === "function") {
                window.toggleWalkMode();
            }
            currentEscalatorState = null;
            escalatorExitCooldown = null;
            lockWalkModePreference = true;
            resetLocalMovementInputs();
            window.mallMovementLockedUntil = Date.now() + 1200;
            showMagicTeleportFlash();
            showInteractionFeedback(`Llevándote al local ${storeCode}...`);

            await animateCameraTeleport(destination);
            if (destination?.position && destination?.target) {
                resetLocalMovementInputs();
                applyTeleportPose(destination, 1500);
            }
            focusMallCanvas();
            if (typeof broadcastMyPosition === "function") broadcastMyPosition();
            showInteractionFeedback(`Llegaste al local ${storeCode}.`);
        };

        let tenantAutoArrivalSequence = 0;
        let tenantAutoArrivalUserId = "";

        async function getTenantAutoArrivalStore(user, { queryActiveLease = true } = {}) {
            const userId = String(user?.id || currentTenantUser?.id || "").trim();
            const normalize = value => String(value || "").trim().toLowerCase();
            const userEmail = normalize(user?.email || currentTenantUser?.email);
            const selectedStoreCode = String(getStoreCode(myOwnedStore) || "").trim().toUpperCase();
            const eligibleStores = myOwnedStores.filter(store => {
                const ownerId = String(store?.owner_id || "").trim();
                const contactEmail = normalize(store?.contact_email);
                return ownerId === userId || (!ownerId && userEmail && contactEmail === userEmail);
            });

            if (queryActiveLease && supabaseClient && userId) {
                try {
                    const { data: activeLeases, error: leaseError } = await withRequestTimeout(
                        mallUiScopeQuery(
                            supabaseClient
                                .from('tenant_leases')
                                .select('store_id,local_code,updated_at')
                        )
                            .eq('tenant_auth_user_id', userId)
                            .eq('status', 'active')
                            .order('updated_at', { ascending: false })
                            .limit(5),
                        3000,
                        'La consulta del local tardó demasiado.'
                    );
                    if (leaseError) throw leaseError;
                    const activeLeaseCodes = (activeLeases || []).flatMap(lease => [lease.store_id, lease.local_code])
                        .map(value => String(value || "").trim().toUpperCase())
                        .filter(Boolean);
                    const leasedStore = eligibleStores.find(store => {
                        const id = String(store?.id || "").trim().toUpperCase();
                        const code = String(getStoreCode(store) || "").trim().toUpperCase();
                        return activeLeaseCodes.includes(id) || activeLeaseCodes.includes(code);
                    });
                    if (leasedStore) return leasedStore;
                } catch (error) {
                    console.warn('No se pudo consultar el arriendo activo para la llegada del locatario:', error);
                }
            }

            const brandNames = [
                user?.user_metadata?.brand_name,
                user?.user_metadata?.store_name,
                currentTenantUser?.user_metadata?.brand_name,
                currentTenantUser?.user_metadata?.store_name
            ].map(normalize).filter(Boolean);
            const brandedStore = eligibleStores.find(store => brandNames.includes(normalize(store?.name)));
            if (brandedStore) return brandedStore;

            const selectedStore = eligibleStores.find(store => (
                String(getStoreCode(store) || "").trim().toUpperCase() === selectedStoreCode
            ));
            if (selectedStore) return selectedStore;

            return eligibleStores.find(store => normalize(store?.contact_email) === userEmail)
                || eligibleStores[0]
                || myOwnedStore
                || null;
        }

        function scheduleTenantAutoArrival(user) {
            const userId = String(user?.id || "").trim();
            if (!userId) return Promise.resolve(false);

            const sequence = ++tenantAutoArrivalSequence;
            const startedAt = Date.now();
            let shouldQueryActiveLease = true;
            return new Promise(resolve => {
                const runTryArrival = () => {
                    void tryArrival().catch(error => {
                        console.warn('No se pudo completar la llegada automática al local:', error);
                        resolve(false);
                    });
                };
                const tryArrival = async () => {
                    if (sequence !== tenantAutoArrivalSequence || !hasEnteredMall || currentAccessRole !== "tenant") {
                        resolve(false);
                        return;
                    }
                    if (String(currentTenantUser?.id || "").trim() !== userId) {
                        resolve(false);
                        return;
                    }
                    if (tenantAutoArrivalUserId === userId) {
                        resolve(true);
                        return;
                    }

                    const store = await getTenantAutoArrivalStore(user, {
                        queryActiveLease: shouldQueryActiveLease
                    });
                    shouldQueryActiveLease = false;
                    if (!store && Date.now() - startedAt < 6000) {
                        setTimeout(runTryArrival, 350);
                        return;
                    }
                    if (!store) {
                        console.warn("No se pudo ubicar automáticamente el local del locatario.");
                        resolve(false);
                        return;
                    }

                    tenantAutoArrivalUserId = userId;
                    const storeCode = getStoreCode(store);
                    window.mallAnalytics?.track("route_requested", {
                        source: "tenant_auto_entry",
                        store_code: storeCode
                    });
                    await window.teleportVisitorToSearchStore(store);
                    resolve(true);
                };

                setTimeout(runTryArrival, 0);
            });
        }

        function renderSearchResults(matches) {
            const results = document.getElementById('search-results');
            if (!results) return;
            results.innerHTML = "";

            if (!matches.length) {
                const empty = document.createElement("div");
                empty.className = "search-empty";
                empty.textContent = "No encontré locales con esa búsqueda.";
                results.appendChild(empty);
                return;
            }

            matches.forEach(match => {
                const button = document.createElement('button');
                button.type = "button";
                button.className = `search-item${selectedSearchStoreCode === match.shopCode ? " is-selected" : ""}`;

                const label = document.createElement('span');
                const strong = document.createElement('strong');
                strong.textContent = match.name;
                label.appendChild(strong);

                const detail = document.createElement('span');
                const matchedProducts = match.matchedProducts || [];
                const memoryText = String(match.catalogMemory || "").replace(/\s+/g, " ").trim();
                const memoryDetail = match.memoryMatch && memoryText
                    ? `Novedades: ${memoryText.length > 96 ? `${memoryText.slice(0, 93)}...` : memoryText}`
                    : "";
                detail.textContent = matchedProducts.length
                    ? `Productos: ${matchedProducts.slice(0, 3).map(productName).join(", ")}`
                    : memoryDetail || match.category;
                label.appendChild(detail);

                const small = document.createElement('small');
                small.textContent = match.shopCode || "-";

                button.append(label, small);
                button.addEventListener("click", async () => {
                    selectedSearchStoreCode = match.shopCode;
                    window.mallAnalytics?.track('search_result_clicked', {
                        storeCode: match.shopCode,
                        searchTerm: document.getElementById('search-input')?.value || '',
                        source: 'search'
                    });
                    [...results.querySelectorAll(".search-item")].forEach(item => item.classList.remove("is-selected"));
                    button.classList.add("is-selected");
                    const fullData = await getStoreData(match.shopCode);
                    showInMap({
                        ...fullData,
                        matchedProducts,
                        searchSelectedCode: match.shopCode,
                        selectedShopCode: match.shopCode,
                        teleportCode: match.shopCode
                    });
                });
                results.appendChild(button);
            });
        }

        window.filterStores = async function () {
            await loadSearchProductsForStores();
            refreshSearchUserLocation();

            const input = document.getElementById('search-input');
            const rawQuery = input?.value || "";
            const query = normalizeSearchText(rawQuery);
            const queryTerms = extractSearchTerms(rawQuery);
            const compactQuery = compactSearchText(rawQuery);
            if (!query || !queryTerms.length) {
                const results = document.getElementById('search-results');
                if (results) {
                    results.innerHTML = '<div class="search-empty">Escribe un producto, local, categoría o palabra clave como #regalo.</div>';
                }
                return;
            }

            const matches = fullStoreInventory
                .map(store => {
                    const codeMatch = compactSearchText(store.shopCode).includes(compactQuery) || normalizeSearchText(store.shopCode).includes(query);
                    const nameMatch = matchesEveryTerm(store.name, queryTerms);
                    const categoryMatch = matchesEveryTerm(store.category, queryTerms);
                    const descriptionMatch = matchesEveryTerm(store.description, queryTerms);
                    const memoryMatch = matchesEveryTerm(store.catalogMemory, queryTerms);
                    const keywordMatch = matchesEveryTerm(`${store.keywords || ""} ${(store.hashKeywords || []).join(" ")}`, queryTerms);
                    const matchedProducts = (store.products || []).filter(product => matchesEveryTerm(productSearchText(product), queryTerms));
                    const storeTextMatch = matchesEveryTerm(store.searchText, queryTerms);
                    const matchScore = [
                        codeMatch ? 6 : 0,
                        nameMatch ? 5 : 0,
                        keywordMatch ? 4 : 0,
                        memoryMatch ? 4 : 0,
                        matchedProducts.length ? 3 : 0,
                        categoryMatch ? 2 : 0,
                        descriptionMatch ? 1 : 0,
                        storeTextMatch ? 1 : 0
                    ].reduce((sum, value) => sum + value, 0);
                    return matchScore ? { ...store, matchedProducts, memoryMatch, matchScore } : null;
                })
                .filter(Boolean)
                .sort((a, b) => b.matchScore - a.matchScore || a.name.localeCompare(b.name))
                .slice(0, 12);

            renderSearchResults(matches);
            window.mallAnalytics?.trackSearch(rawQuery, matches.length);
        };

        showInMap = function (store) {
            if (!store) return;
            const userLocation = refreshSearchUserLocation();
            const selectedCode = getSearchSelectedStoreCode(store);
            const targetLocation = getStoreMapLocation(store);
            const floor = targetLocation.floor;

            document.getElementById('f-btn-1').className = floor === 1 ? 'floor-btn active' : 'floor-btn';
            document.getElementById('f-btn-2').className = floor === 2 ? 'floor-btn active' : 'floor-btn';

            drawRouteOnMap(userLocation, targetLocation);
            drawMapMarker("map-target-pos", targetLocation, "#d71920", selectedCode || "Local");

            const locationText = document.getElementById('location-text');
            if (!locationText) return;
            locationText.textContent = "";
            const label = document.createElement('b');
            label.style.color = '#8a6b2f';
            label.textContent = 'Ruta:';
            locationText.append(
                label,
                document.createTextNode(` desde tu ubicación actual hasta Local ${selectedCode || targetLocation.code}, Ala ${targetLocation.wing || "-"}, Planta ${floor}.`)
            );

            const teleportBtn = document.createElement("button");
            teleportBtn.type = "button";
            const canTeleport = hasMemberBenefitAccess();
            teleportBtn.className = `search-teleport-btn${canTeleport ? '' : ' is-member-locked'}`;
            teleportBtn.textContent = canTeleport ? "Llévame al local" : "Teletransporte · solo inscritos";
            teleportBtn.setAttribute('aria-disabled', canTeleport ? 'false' : 'true');
            teleportBtn.addEventListener("click", () => {
                if (!hasMemberBenefitAccess()) {
                    window.showMemberBenefitRequired('el teletransporte desde el tótem');
                    return;
                }
                window.mallAnalytics?.track('route_requested', {
                    storeCode: selectedCode || targetLocation.code,
                    searchTerm: document.getElementById('search-input')?.value || '',
                    channel: 'map',
                    source: 'search'
                });
                window.teleportVisitorToSearchStore(store);
            });
            locationText.appendChild(teleportBtn);

            if (window.__quickNavigatorSearch === true && showCompactRouteMap(store, userLocation, targetLocation, selectedCode)) {
                window.__quickNavigatorSearch = false;
                window.closeSearchModal?.();
            }
        };

        window.openSearch = function () {
            document.getElementById('search-modal').style.display = 'block';
            document.getElementById('modal-overlay').style.display = 'block';
            window.mallAnalytics?.track('search_opened', { source: 'totem' });
            refreshSearchUserLocation();
            const input = document.getElementById('search-input');
            if (input) {
                input.focus();
                window.filterStores();
            }
        };

        let mallQuickStartTimer = null;

        function closeQuickNavigator() {
            const panel = document.getElementById('quick-navigator-panel');
            const toggle = document.getElementById('quick-navigator-toggle');
            if (panel) panel.hidden = true;
            if (toggle) toggle.setAttribute('aria-expanded', 'false');
        }

        window.toggleQuickNavigator = function () {
            const panel = document.getElementById('quick-navigator-panel');
            const toggle = document.getElementById('quick-navigator-toggle');
            if (!panel || !toggle) return;
            const willOpen = panel.hidden;
            panel.hidden = !willOpen;
            toggle.setAttribute('aria-expanded', String(willOpen));
            if (willOpen) window.dismissMallQuickStart?.();
        };

        window.dismissMallQuickStart = function () {
            const card = document.getElementById('mall-quick-start');
            if (card) card.hidden = true;
            if (mallQuickStartTimer) window.clearTimeout(mallQuickStartTimer);
            try { window.sessionStorage.setItem('mallQuickStartSeen', '1'); } catch (_) {}
        };

        function showMallQuickStart() {
            const card = document.getElementById('mall-quick-start');
            if (!card) return;
            try {
                if (window.sessionStorage.getItem('mallQuickStartSeen')) return;
            } catch (_) {}
            card.hidden = false;
            mallQuickStartTimer = window.setTimeout(() => window.dismissMallQuickStart?.(), 12000);
        }

        window.openQuickSearch = function (kind = 'product') {
            closeQuickNavigator();
            window.dismissMallQuickStart?.();
            window.__quickNavigatorSearch = true;
            window.closeCompactRouteMap?.();
            window.openSearch?.();
            const input = document.getElementById('search-input');
            if (!input) return;
            const category = ['Moda', 'Hogar', 'Belleza', 'Tecnología'].includes(kind) ? kind : '';
            input.value = category;
            input.placeholder = kind === 'store'
                ? 'Nombre o número del local...'
                : category ? `Explora ${category}...` : 'Producto, local, categoría, oferta o evento...';
            window.filterStores?.();
            input.focus();
        };

        window.openMallOrientation = function () {
            closeQuickNavigator();
            window.dismissMallQuickStart?.();
            if (typeof window.openMallAssistant === 'function') {
                window.openMallAssistant();
                return;
            }
            window.showInteractionFeedback?.('El asistente de Informaciones se está preparando. Intenta nuevamente en un momento.');
        };

        let activeProximityContext = null;
        let proximityContextTimer = null;
        const proximityVector = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;

        function setProximityContext(context = null) {
            const bar = document.getElementById('proximity-context');
            const icon = document.getElementById('proximity-context-icon');
            const title = document.getElementById('proximity-context-title');
            const description = document.getElementById('proximity-context-description');
            const action = document.getElementById('proximity-context-action');
            activeProximityContext = context;
            if (!bar || !icon || !title || !description || !action) return;
            if (!context) {
                bar.hidden = true;
                action.hidden = true;
                return;
            }
            icon.textContent = context.icon;
            title.textContent = context.title;
            description.textContent = context.description;
            action.textContent = context.actionLabel || '';
            action.hidden = !context.action;
            bar.hidden = false;
        }

        function getTargetDistance(target) {
            if (!target || !camera || !proximityVector || typeof target.getWorldPosition !== 'function') return Infinity;
            target.getWorldPosition(proximityVector);
            if (Math.abs(proximityVector.y - camera.position.y) > 4.5) return Infinity;
            return Math.hypot(proximityVector.x - camera.position.x, proximityVector.z - camera.position.z);
        }

        function findNearbyContext() {
            if (!hasEnteredMall || !camera || typeof THREE === 'undefined') return null;
            let best = null;
            const consider = (target, context, radius) => {
                const distance = getTargetDistance(target);
                if (distance > radius || (best && distance >= best.distance)) return;
                best = { ...context, distance };
            };

            (window.mallInformationModuleTargets || []).forEach((target) => {
                consider(target, {
                    icon: 'support_agent',
                    title: 'Informaciones cerca',
                    description: 'Pregunta por locales, productos o cómo orientarte.',
                    action: 'mall-assistant',
                    actionLabel: 'Preguntar'
                }, 8);
            });

            (window.mallStoreAttendantTargets || []).forEach((target) => {
                const storeCode = target?.userData?.storeCode || '';
                const assistantName = target?.userData?.assistantName || 'Asistente';
                if (!storeCode) return;
                consider(target, {
                    icon: 'support_agent',
                    title: `${assistantName} está disponible`,
                    description: 'Puedes hacer una pregunta breve sobre esta tienda.',
                    action: 'store-assistant',
                    storeCode,
                    actionLabel: 'Hablar'
                }, 6);
            });

            if (typeof catalogClickTargets !== 'undefined' && Array.isArray(catalogClickTargets)) {
                catalogClickTargets.forEach((target) => {
                    const storeCode = target?.userData?.shopCode || target?.userData?.sourceShopCode || '';
                    if (!storeCode) return;
                    consider(target, {
                        icon: 'storefront',
                        title: `Local ${storeCode}`,
                        description: 'Toca la placa dorada para ver su ficha comercial.',
                        action: null
                    }, 5.5);
                });
            }

            return best;
        }

        function updateProximityContext() {
            const next = findNearbyContext();
            const currentKey = activeProximityContext
                ? `${activeProximityContext.action || 'plaque'}:${activeProximityContext.storeCode || activeProximityContext.title}`
                : '';
            const nextKey = next ? `${next.action || 'plaque'}:${next.storeCode || next.title}` : '';
            if (currentKey !== nextKey) setProximityContext(next);
        }

        function startProximityContext() {
            if (proximityContextTimer) window.clearInterval(proximityContextTimer);
            updateProximityContext();
            proximityContextTimer = window.setInterval(updateProximityContext, 650);
        }

        window.openProximityContextAction = function () {
            const context = activeProximityContext;
            if (!context?.action) return;
            if (context.action === 'mall-assistant') window.openMallOrientation?.();
            if (context.action === 'store-assistant') window.openStoreAssistant?.(context.storeCode);
        };

        window.openMallIntro = function () {
            const introModal = document.getElementById('mall-intro-modal');
            const modalOverlay = document.getElementById('modal-overlay');
            if (!introModal || !modalOverlay) return;
            const searchModal = document.getElementById('search-modal');
            const storeModal = document.getElementById('store-modal');
            if (searchModal) searchModal.style.display = 'none';
            if (storeModal) storeModal.style.display = 'none';
            introModal.style.display = 'block';
            modalOverlay.style.display = 'block';
        };

        function closeMallIntro(event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            const introModal = document.getElementById('mall-intro-modal');
            const modalOverlay = document.getElementById('modal-overlay');
            if (introModal) introModal.style.display = 'none';
            if (modalOverlay) modalOverlay.style.display = 'none';
            if (typeof focusMallCanvas === 'function') focusMallCanvas();
        }
        window.closeMallIntro = closeMallIntro;
        const introCloseBtn = document.getElementById('mall-intro-close-btn');
        if (introCloseBtn) {
            introCloseBtn.onclick = closeMallIntro;
            introCloseBtn.addEventListener('pointerdown', closeMallIntro);
        }

        function closeSearchModal(event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            const searchModal = document.getElementById('search-modal');
            const modalOverlay = document.getElementById('modal-overlay');
            if (searchModal) searchModal.style.display = 'none';
            if (modalOverlay) modalOverlay.style.display = 'none';
            window.__quickNavigatorSearch = false;
            if (typeof focusMallCanvas === 'function') focusMallCanvas();
        }
        window.closeSearchModal = closeSearchModal;
        document.getElementById('search-close-btn').onclick = closeSearchModal;
        document.getElementById('search-close-btn').addEventListener('pointerdown', closeSearchModal);
        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            const searchModal = document.getElementById('search-modal');
            const introModal = document.getElementById('mall-intro-modal');
            const benefitsModal = document.getElementById('member-benefits-modal');
            if (introModal && introModal.style.display !== 'none') closeMallIntro(event);
            if (searchModal && searchModal.style.display !== 'none') closeSearchModal(event);
            if (benefitsModal && benefitsModal.style.display !== 'none') window.closeMemberBenefits();
        });

        let lastMallInteractionSignature = "";
        let lastMallInteractionAt = 0;
        let pendingTouchCanvasTap = null;
        let pendingTouchCanvasTapTimer = null;
        let suppressSyntheticMallClickUntil = 0;
        const TOUCH_MALL_TAP_MAX_DISTANCE = 18;
        const TOUCH_MALL_TAP_MAX_DURATION_MS = 320;

        function getMallInteractionRoots() {
            const roots = [];
            const addRoot = (obj) => {
                if (obj && !roots.includes(obj)) roots.push(obj);
            };
            if (Array.isArray(catalogClickTargets)) {
                catalogClickTargets.forEach(addRoot);
            }
            if (Array.isArray(window.mallTotemTargets)) {
                window.mallTotemTargets.forEach(addRoot);
            }
            if (Array.isArray(window.mallIntroTargets)) {
                window.mallIntroTargets.forEach(addRoot);
            }
            if (Array.isArray(window.mallPromotionTargets)) {
                window.mallPromotionTargets.forEach(addRoot);
            }
            if (Array.isArray(window.mallStoreAttendantTargets)) {
                window.mallStoreAttendantTargets.forEach(addRoot);
            }
            if (Array.isArray(window.mallInformationModuleTargets)) {
                window.mallInformationModuleTargets.forEach(addRoot);
            }
            if (typeof allStoreGroups !== "undefined" && Array.isArray(allStoreGroups)) {
                allStoreGroups.forEach(addRoot);
            }
            return roots;
        }

        function getRemotePlayerInteractionTargets() {
            if (typeof otherPlayers === 'undefined' || !otherPlayers) return [];
            return Object.values(otherPlayers)
                .filter((player) => player?.mesh?.visible && player.hasReceivedPose)
                .map((player) => player.mesh);
        }

        function getPlayerIdFromObject(object) {
            let current = object;
            while (current) {
                if (current.userData?.playerId) return current.userData.playerId;
                current = current.parent;
            }
            return '';
        }

        function isUpperStorefrontCatalogTarget(object) {
            let current = object;
            while (current) {
                if (
                    current.userData?.isCatalogTrigger
                    && (
                        current.userData?.isStoreCodeSign
                        || current.userData?.isPlaqueHitbox
                        || current.userData?.isUpperStorefrontHitbox
                    )
                ) return true;
                current = current.parent;
            }
            return false;
        }

        async function handleMallInteractionPointer(event) {
            if (Date.now() < Number(window.mallSuppressCanvasTapUntil || 0)) return;
            if (
                event.type === 'click' &&
                event.pointerType !== 'mouse' &&
                Date.now() < suppressSyntheticMallClickUntil
            ) {
                return;
            }
            if (
                canvasContainer &&
                event.target.closest &&
                event.target.closest('#canvas-container, canvas') &&
                !event.target.closest('#login-overlay, #store-modal, #search-modal, #mall-intro-modal, #store-assistant-modal, #tenant-login-modal, #tenant-apply-modal, #super-admin-modal, #tenant-admin-modal, #password-recovery-modal, #tenant-password-setup-modal, #avatar-customizer-modal, #controls-menu, #mall-quick-tools, #mall-quick-start, #guest-account-actions, input, textarea, button, select, a, label')
            ) {
                focusMallCanvas();
            }
            if (event.target.closest && event.target.closest('#avatar-customizer-modal, #controls-menu, #mall-quick-tools, #mall-quick-start, #guest-account-actions')) return;
            closeControlsMenu();
            // No interactuar con el mall si el login o el modal de búsqueda están abiertos
            if (isElementActuallyVisible(document.getElementById('login-overlay')) ||
                isElementActuallyVisible(document.getElementById('search-modal')) ||
                isElementActuallyVisible(document.getElementById('mall-intro-modal')) ||
                isElementActuallyVisible(document.getElementById('store-assistant-modal'))) return;

            window.mallMobileControls?.stopAutoForward();

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
            raycaster.near = 0;
            raycaster.far = IS_COARSE_POINTER ? 170 : Infinity;
            raycaster.setFromCamera(mouse, camera);

            // En modo edición, el clic pertenece exclusivamente al editor. Se recorre
            // toda la profundidad del rayo para no quedar bloqueado por vidrios u overlays.
            if (window.mallInfrastructureEditorEnabled === true) {
                const editorIntersections = raycaster.intersectObjects(scene.children, true);
                const editableIntersection = window.mallObjectEditor?.findIntersection?.(editorIntersections) || null;
                updateObjectInspector(editableIntersection || editorIntersections[0] || null);
                if (!editableIntersection) {
                    window.mallObjectEditor?.render?.('Ese elemento no es editable. Selecciona un mueble, banca o muro de tabiquería registrado.');
                }
                return;
            }

            // Los avatares deben ganar sobre vitrinas, placas o muros que estén detrás.
            const remotePlayerTargets = getRemotePlayerInteractionTargets();
            const directPlayerIntersects = remotePlayerTargets.length
                ? raycaster.intersectObjects(remotePlayerTargets, true)
                : [];
            if (directPlayerIntersects.length > 0) {
                const playerId = getPlayerIdFromObject(directPlayerIntersects[0].object);
                if (playerId) {
                    setChatTarget(playerId);
                    return;
                }
            }

            // El catálogo se abre desde la franja superior: placa, logo o vidrio alto.
            const upperStorefrontCatalogTargets = catalogClickTargets.filter(isUpperStorefrontCatalogTarget);
            const directCatalogIntersects = raycaster.intersectObjects(upperStorefrontCatalogTargets, true);
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
            const interactionRoots = getMallInteractionRoots();
            let intersects = interactionRoots.length
                ? raycaster.intersectObjects(interactionRoots, true)
                : raycaster.intersectObjects(scene.children, true);
            if (!intersects.length && !IS_COARSE_POINTER) {
                intersects = raycaster.intersectObjects(scene.children, true);
            }
            if (OBJECT_INSPECTOR_ENABLED) updateObjectInspector(intersects[0] || null);
            if (intersects.length > 0) {
                let foundStore = null, foundStoreSurface = null, foundTotem = null, foundPlayer = null, foundIntro = null, foundPromotion = null, foundAttendant = null, foundMallAssistant = null;

                for (const hit of intersects) {
                    let obj = hit.object;
                    let hitStore = null;
                    let hitCatalogTrigger = false;

                    while (obj) {
                        if (obj.userData?.isCatalogTrigger && (
                            obj.userData?.isStoreCodeSign
                            || obj.userData?.isPlaqueHitbox
                            || obj.userData?.isUpperStorefrontHitbox
                        )) {
                            hitCatalogTrigger = true;
                        }
                        if (obj.userData?.shopCode && !hitStore) hitStore = obj;
                        if (obj.userData?.isMallIntroTrigger && !foundIntro) foundIntro = obj;
                        if (obj.userData?.isTotem && !foundTotem) foundTotem = obj;
                        if (obj.userData?.playerId && !foundPlayer) foundPlayer = obj.userData.playerId;
                        if (obj.userData?.isPromotionCollectible && !foundPromotion) foundPromotion = obj;
                        if (obj.userData?.isStoreAttendant && !foundAttendant) foundAttendant = obj;
                        if (obj.userData?.isMallInformationAssistant && !foundMallAssistant) foundMallAssistant = obj;
                        obj = obj.parent;
                    }

                    if (hitStore && hitCatalogTrigger) {
                        foundStore = findShopRoot(hitStore) || hitStore;
                        break;
                    }
                    if (hitStore && !foundStoreSurface) {
                        foundStoreSurface = findShopRoot(hitStore) || hitStore;
                    }
                }

                if (foundMallAssistant) {
                    window.openMallAssistant?.();
                } else if (foundAttendant) {
                    window.openStoreAssistant?.(foundAttendant.userData?.storeCode);
                } else if (foundPromotion) {
                    const promotionId = foundPromotion.userData?.promotionId;
                    if (!hasMemberBenefitAccess()) {
                        window.showMemberBenefitRequired('los concursos y promociones');
                    } else if (promotionId) {
                        window.claimMemberPromotion(promotionId, {
                            source: 'golden_balloon',
                            x: Number(camera.position.x.toFixed(2)),
                            y: Number(camera.position.y.toFixed(2)),
                            z: Number(camera.position.z.toFixed(2))
                        });
                    }
                } else if (foundIntro) {
                    openMallIntro();
                } else if (foundPlayer) {
                    setChatTarget(foundPlayer);
                } else if (foundTotem) {
                    openSearch();
                } else if (foundStore) {
                    openPublicStoreCatalog(foundStore);
                } else if (foundStoreSurface) {
                    const storeCode = foundStoreSurface.userData?.plateCode || foundStoreSurface.userData?.shopCode;
                    const storeReference = storeCode ? ` de ${storeCode}` : '';
                    showInteractionFeedback(
                        `Para ver el catálogo${storeReference}, toca la placa, el logo o el vidrio superior.`,
                        { duration: 3200, kind: 'guidance' }
                    );
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
            if (Date.now() < Number(window.mallSuppressCanvasTapUntil || 0)) return;
            const tapEvent = {
                type: event.type,
                pointerType: event.pointerType,
                target: event.target,
                clientX: event.clientX,
                clientY: event.clientY
            };
            if (pendingTouchCanvasTapTimer) clearTimeout(pendingTouchCanvasTapTimer);
            pendingTouchCanvasTapTimer = setTimeout(() => {
                pendingTouchCanvasTapTimer = null;
                if (Date.now() < Number(window.mallTouchDoubleTapUntil || 0)) return;
                if (Date.now() < Number(window.mallSuppressCanvasTapUntil || 0)) return;
                suppressSyntheticMallClickUntil = Date.now() + 700;
                handleMallInteractionPointer(tapEvent);
            }, 360);
        }, { passive: true });
        renderer.domElement.addEventListener('pointercancel', () => {
            pendingTouchCanvasTap = null;
        }, { passive: true });

        let interactionFeedbackTimer = null;
        function showInteractionFeedback(msg, options = {}) {
            let el = document.getElementById('interaction-feedback');
            if (!el) {
                el = document.createElement('div');
                el.id = 'interaction-feedback';
                el.setAttribute('role', 'status');
                el.setAttribute('aria-live', 'polite');
                document.body.appendChild(el);
            }
            el.innerText = msg;
            el.className = options.kind === 'guidance'
                ? 'interaction-feedback interaction-feedback--guidance is-visible'
                : 'interaction-feedback is-visible';
            if (interactionFeedbackTimer) clearTimeout(interactionFeedbackTimer);
            interactionFeedbackTimer = setTimeout(() => {
                el.classList.remove('is-visible');
            }, Number(options.duration) || 2000);
        }

        // supabaseClient ya inicializado arriba (antes de getStoreData)
        let myNickname = "";
        const myPresenceId = window.crypto?.randomUUID
            ? window.crypto.randomUUID()
            : `mall-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        let myAvatarBody = "male";
        let myAvatarOutfit = "formal";
        let myAvatarSkinTone = "medium";
        let myAvatarHairColor = "brown";
        let myAvatarHeight = 175;
        let myAvatarStyle = "av2.male.formal.medium.brown.175";
        let currentAccessRole = "guest";
        let currentMemberProfile = null;
        let currentUserProfile = null;
        let currentUserRole = "guest";
        let currentUserIsAuthoritativeAdmin = false;
        let isChatOpen = false;
        let presenceReady = false;
        let authoritativeAdminUserId = "";
        let authoritativeAdminVerificationUserId = "";
        let authoritativeAdminVerificationPromise = null;
        let tenantLoginInFlight = false;
        let memberLoginInFlight = false;
        let hasEnteredMall = false;
        let mallEntryInFlight = false;
        let mallEntryCompleted = false;
        let mallEntryPromise = null;
        let mallEntrySequence = 0;
        let pendingMemberPhone = "";
        let pendingMemberEmail = "";
        let pendingMemberPhoneOtpType = "phone_change";
        window.mallMazePlayerName = "Jugador local";

        const MEMBER_BENEFIT_ROLES = new Set(['member', 'registered_visitor', 'tenant', 'admin']);
        // Campaign switch: set to false to restore membership-only visitor benefits.
        const TEMPORARY_GUEST_BENEFITS_ENABLED = true;

        function getEffectiveBenefitRole() {
            if (hasEnteredMall && currentAccessRole === 'guest') return 'guest';
            if (currentUserRole === 'admin') return 'admin';
            if (currentAccessRole === 'tenant' || currentUserRole === 'tenant') return 'tenant';
            if (currentAccessRole === 'member' || currentUserRole === 'registered_visitor' || currentUserRole === 'member') return 'member';
            return 'guest';
        }

        function hasMemberBenefitAccess() {
            const effectiveRole = getEffectiveBenefitRole();
            return MEMBER_BENEFIT_ROLES.has(effectiveRole)
                || (TEMPORARY_GUEST_BENEFITS_ENABLED && effectiveRole === 'guest');
        }

        window.mallCanUseBenefit = function () {
            return hasMemberBenefitAccess();
        };

        window.showMemberBenefitRequired = function (benefitLabel = 'esta función') {
            showInteractionFeedback(
                `Inscríbete gratis para usar ${benefitLabel} y acceder a los beneficios del mall.`,
                { duration: 3400, kind: 'guidance' }
            );
        };

        function syncMemberBenefitAccess() {
            const allowed = hasMemberBenefitAccess();
            document.body.dataset.memberBenefits = allowed ? 'enabled' : 'guest';
            const benefitsKicker = document.getElementById('member-benefits-kicker');
            if (benefitsKicker) {
                benefitsKicker.textContent = TEMPORARY_GUEST_BENEFITS_ENABLED
                    && getEffectiveBenefitRole() === 'guest'
                    ? 'Beneficios de bienvenida'
                    : 'Cuenta inscrita';
            }
            const chatButton = document.getElementById('chat-minimized-btn');
            const chatPanel = document.getElementById('mall-chat');
            const pedometer = document.getElementById('member-pedometer');
            if (!allowed) {
                if (chatButton) chatButton.style.display = 'none';
                if (chatPanel) chatPanel.style.display = 'none';
                if (pedometer) pedometer.style.display = 'none';
                if (typeof isChatOpen !== 'undefined') isChatOpen = false;
            } else if (presenceReady && !isChatOpen && chatButton) {
                chatButton.style.display = 'flex';
            }
            if (allowed && hasEnteredMall && pedometer) pedometer.style.display = 'flex';
            syncWalkModeButton();
        }

        function syncGuestAccountActions() {
            const isAnonymousGuest = hasEnteredMall && currentAccessRole === 'guest';
            const controlsMenu = document.getElementById('controls-menu');
            const accountActions = document.getElementById('guest-account-actions');
            const tenantAccessItem = document.getElementById('tenant-access-btn');
            const adminMenuItem = document.getElementById('admin-manage-menu-item');
            const adminButton = document.getElementById('super-admin-btn');
            const persistentAdminButton = document.getElementById('super-admin-btn-persistent');
            if (controlsMenu) {
                controlsMenu.style.display = '';
                controlsMenu.classList.toggle('is-guest-controls', isAnonymousGuest);
            }
            if (isAnonymousGuest) {
                clearAuthoritativeAdminAccess();
                isAdmin = false;
                if (tenantAccessItem) tenantAccessItem.style.display = 'none';
                if (adminMenuItem) adminMenuItem.style.display = 'none';
                if (adminButton) adminButton.style.display = 'none';
                if (persistentAdminButton) persistentAdminButton.style.display = 'none';
            } else {
                if (tenantAccessItem) tenantAccessItem.style.display = '';
            }
            if (accountActions) {
                accountActions.hidden = !isAnonymousGuest;
                accountActions.style.display = isAnonymousGuest ? 'flex' : 'none';
            }
        }

        const memberPedometerState = {
            monthKey: new Date().toISOString().slice(0, 7),
            totalMeters: 0,
            pendingMeters: 0,
            lastPosition: null,
            lastUiAt: 0,
            lastFlushAt: 0,
            initialized: false,
            flushing: false
        };
        let activeMemberPromotions = [];

        function formatMemberMeters(value) {
            const meters = Math.max(0, Number(value) || 0);
            if (meters >= 1000) return `${(meters / 1000).toFixed(meters >= 10000 ? 1 : 2)} km`;
            return `${Math.round(meters)} m`;
        }

        function getMemberPedometerStorageKey() {
            const identity = String(currentTenantUser?.id || currentUserProfile?.auth_user_id || myNickname || 'member');
            return `mall_member_meters:${memberPedometerState.monthKey}:${identity}`;
        }

        function updateMemberPedometerUi() {
            const formatted = formatMemberMeters(memberPedometerState.totalMeters);
            const compactValue = document.getElementById('member-pedometer-value');
            const modalValue = document.getElementById('member-benefits-distance-value');
            if (compactValue) compactValue.textContent = formatted;
            if (modalValue) modalValue.textContent = formatted;

            const nextReward = [...activeMemberPromotions]
                .filter(promotion => Number(promotion.min_monthly_meters) > memberPedometerState.totalMeters)
                .sort((a, b) => Number(a.min_monthly_meters) - Number(b.min_monthly_meters))[0];
            const nextCopy = document.getElementById('member-benefits-distance-next');
            if (nextCopy) {
                nextCopy.textContent = nextReward
                    ? `Te faltan ${formatMemberMeters(Number(nextReward.min_monthly_meters) - memberPedometerState.totalMeters)} para ${nextReward.reward_label || nextReward.title}.`
                    : 'Tus metros del mes están listos para promociones y regalías activas.';
            }
        }

        function setMemberBenefitsStatus(message = '', tone = 'muted') {
            const status = document.getElementById('member-benefits-status');
            if (!status) return;
            status.textContent = message;
            status.dataset.tone = tone;
        }

        function renderMemberPromotions() {
            const container = document.getElementById('member-promotions-list');
            if (!container) return;
            container.innerHTML = '';
            if (!activeMemberPromotions.length) {
                const empty = document.createElement('p');
                empty.textContent = 'No hay promociones activas en este momento.';
                container.appendChild(empty);
                return;
            }

            activeMemberPromotions.forEach((promotion) => {
                const item = document.createElement('article');
                item.className = 'member-promotion-item';
                const title = document.createElement('strong');
                title.textContent = promotion.title || 'Promoción del mall';
                const detail = document.createElement('span');
                detail.textContent = promotion.description || promotion.reward_label || '';
                item.append(title, detail);

                const button = document.createElement('button');
                button.type = 'button';
                const isClaimed = Boolean(promotion.claimed_at);
                const requiredMeters = Number(promotion.min_monthly_meters) || 0;
                const hasRequiredMeters = memberPedometerState.totalMeters >= requiredMeters;
                if (isClaimed) {
                    button.textContent = 'Beneficio obtenido';
                    button.disabled = true;
                } else if (promotion.promotion_type === 'golden_balloon') {
                    button.textContent = 'Buscar el Globo Dorado';
                    button.addEventListener('click', () => window.activateMemberPromotion(promotion.id));
                } else {
                    button.textContent = requiredMeters && !hasRequiredMeters
                        ? `Requiere ${formatMemberMeters(requiredMeters)}`
                        : 'Participar';
                    button.disabled = requiredMeters > 0 && !hasRequiredMeters;
                    if (!button.disabled) {
                        button.addEventListener('click', () => window.claimMemberPromotion(promotion.id, { source: 'benefits_panel' }));
                    }
                }
                item.appendChild(button);
                container.appendChild(item);
            });
        }

        async function loadMemberBenefitsSummary() {
            if (!hasMemberBenefitAccess()) return;
            const localMeters = Number(localStorage.getItem(getMemberPedometerStorageKey()) || 0);
            memberPedometerState.totalMeters = Number.isFinite(localMeters) ? Math.max(0, localMeters) : 0;
            activeMemberPromotions = [];

            if (supabaseClient && currentTenantUser) {
                const { data, error } = await supabaseClient.rpc('get_member_benefits_summary');
                if (!error && data) {
                    const summary = Array.isArray(data) ? data[0] : data;
                    memberPedometerState.totalMeters = Math.max(
                        memberPedometerState.totalMeters,
                        Number(summary?.monthly_meters) || 0
                    );
                    activeMemberPromotions = Array.isArray(summary?.promotions) ? summary.promotions : [];
                    window.mallActivePromotions = activeMemberPromotions;
                    setMemberBenefitsStatus('Beneficios sincronizados con tu cuenta.', 'success');
                } else if (error) {
                    setMemberBenefitsStatus('El podómetro funciona localmente. Falta activar el módulo de beneficios en Supabase.', 'warn');
                }
            }

            localStorage.setItem(getMemberPedometerStorageKey(), String(memberPedometerState.totalMeters));
            memberPedometerState.lastPosition = camera.position.clone();
            memberPedometerState.initialized = true;
            updateMemberPedometerUi();
            renderMemberPromotions();
            window.mallObjectEditor?.configurePromotionCollectibles?.(activeMemberPromotions);
            window.configureMallPromotionCollectibles?.(activeMemberPromotions);
        }

        async function triggerPendingPromotionAnnouncements() {
            if (currentUserRole !== 'admin' || !supabaseClient || !currentTenantUser) return;
            try {
                await supabaseClient.functions.invoke('member-promotion-email', {
                    body: { mode: 'announce-active' }
                });
            } catch (_) {}
        }

        async function flushMemberPedometer() {
            if (
                memberPedometerState.flushing
                || memberPedometerState.pendingMeters < 0.5
                || !supabaseClient
                || !currentTenantUser
            ) return;
            const metersToFlush = Number(memberPedometerState.pendingMeters.toFixed(2));
            memberPedometerState.flushing = true;
            const { data, error } = await supabaseClient.rpc('add_member_walk_distance', { p_meters: metersToFlush });
            memberPedometerState.flushing = false;
            memberPedometerState.lastFlushAt = performance.now();
            if (error) return;
            memberPedometerState.pendingMeters = Math.max(0, memberPedometerState.pendingMeters - metersToFlush);
            const serverTotal = Number(data?.monthly_meters ?? data);
            if (Number.isFinite(serverTotal)) memberPedometerState.totalMeters = Math.max(memberPedometerState.totalMeters, serverTotal);
            localStorage.setItem(getMemberPedometerStorageKey(), String(memberPedometerState.totalMeters));
            updateMemberPedometerUi();
        }

        function updateMemberPedometer(nowMs = performance.now()) {
            if (!memberPedometerState.initialized || !hasMemberBenefitAccess() || !hasEnteredMall) return;
            const currentPosition = camera.position;
            if (!memberPedometerState.lastPosition) {
                memberPedometerState.lastPosition = currentPosition.clone();
                return;
            }
            const dx = currentPosition.x - memberPedometerState.lastPosition.x;
            const dz = currentPosition.z - memberPedometerState.lastPosition.z;
            const horizontalDistance = Math.hypot(dx, dz);
            memberPedometerState.lastPosition.copy(currentPosition);

            const movementLocked = Date.now() < Number(window.mallMovementLockedUntil || 0);
            if (isWalking && !movementLocked && horizontalDistance > 0.002 && horizontalDistance <= 1.25) {
                memberPedometerState.totalMeters += horizontalDistance;
                memberPedometerState.pendingMeters += horizontalDistance;
                localStorage.setItem(getMemberPedometerStorageKey(), String(memberPedometerState.totalMeters));
            }
            if (nowMs - memberPedometerState.lastUiAt > 500) {
                memberPedometerState.lastUiAt = nowMs;
                updateMemberPedometerUi();
            }
            if (memberPedometerState.pendingMeters >= 10 || nowMs - memberPedometerState.lastFlushAt > 30000) {
                void flushMemberPedometer();
            }
        }
        window.updateMemberPedometer = updateMemberPedometer;

        window.openMemberBenefits = function () {
            if (!hasMemberBenefitAccess()) {
                window.showMemberBenefitRequired('el podómetro, concursos y promociones');
                return;
            }
            resetLocalMovementInputs();
            document.getElementById('member-benefits-backdrop').style.display = 'block';
            document.getElementById('member-benefits-modal').style.display = 'block';
            updateMemberPedometerUi();
            renderMemberPromotions();
        };

        window.closeMemberBenefits = function () {
            document.getElementById('member-benefits-backdrop').style.display = 'none';
            document.getElementById('member-benefits-modal').style.display = 'none';
            focusMallCanvas();
        };

        window.openDiscountReward = function (discountCode, rewardLabel = '') {
            const modal = document.getElementById('discount-reward-modal');
            const backdrop = document.getElementById('discount-reward-backdrop');
            const code = document.getElementById('discount-reward-code');
            const copy = document.getElementById('discount-reward-copy');
            const status = document.getElementById('discount-reward-status');
            if (!modal || !backdrop || !code) return;
            code.textContent = String(discountCode || '');
            if (copy) copy.textContent = rewardLabel
                ? `${rewardLabel}. Guárdalo y preséntalo según las condiciones de la promoción.`
                : 'Guárdalo y preséntalo según las condiciones de la promoción.';
            if (status) status.textContent = '';
            backdrop.style.display = 'block';
            modal.hidden = false;
            modal.style.display = 'block';
        };

        window.closeDiscountReward = function () {
            const modal = document.getElementById('discount-reward-modal');
            const backdrop = document.getElementById('discount-reward-backdrop');
            if (backdrop) backdrop.style.display = 'none';
            if (modal) {
                modal.hidden = true;
                modal.style.display = 'none';
            }
            focusMallCanvas();
        };

        window.copyDiscountCode = async function () {
            const code = document.getElementById('discount-reward-code')?.textContent || '';
            const status = document.getElementById('discount-reward-status');
            try {
                await navigator.clipboard.writeText(code);
                if (status) status.textContent = 'Código copiado.';
            } catch (_) {
                if (status) status.textContent = 'Selecciona el código para copiarlo manualmente.';
            }
        };

        window.activateMemberPromotion = function (promotionId) {
            const promotion = activeMemberPromotions.find(item => String(item.id) === String(promotionId));
            if (!promotion || promotion.claimed_at) return;
            window.configureMallPromotionCollectibles?.([promotion]);
            window.closeMemberBenefits();
            showInteractionFeedback('El Globo Dorado está oculto en el mall. Encuéntralo y tócalo para participar.', {
                duration: 4200,
                kind: 'guidance'
            });
        };

        window.claimMemberPromotion = async function (promotionId, evidence = {}) {
            if (!hasMemberBenefitAccess() || !supabaseClient || !currentTenantUser) {
                window.showMemberBenefitRequired('los concursos y promociones');
                return;
            }
            setMemberBenefitsStatus('Registrando tu participación...', 'muted');
            const { data, error } = await supabaseClient.rpc('claim_member_promotion', {
                p_promotion_id: promotionId,
                p_evidence: evidence
            });
            if (error) {
                setMemberBenefitsStatus(`No se pudo registrar la promoción: ${error.message}`, 'error');
                showInteractionFeedback('No pudimos registrar el beneficio. Intenta nuevamente.', { duration: 3000, kind: 'guidance' });
                return;
            }
            const promotion = activeMemberPromotions.find(item => String(item.id) === String(promotionId));
            if (promotion) promotion.claimed_at = new Date().toISOString();
            window.mallObjectEditor?.hidePromotionCollectible?.(promotionId);
            window.hideMallPromotionCollectible?.(promotionId);
            renderMemberPromotions();
            setMemberBenefitsStatus(data?.message || 'Beneficio registrado. Enviaremos la confirmación a tu correo.', 'success');
            showInteractionFeedback('¡Promoción obtenida! Revisa el correo de tu cuenta.', { duration: 3600 });
            if (data?.discount_code) {
                window.openDiscountReward(data.discount_code, data.reward_label);
            }
            try {
                await supabaseClient.functions.invoke('member-promotion-email', {
                    body: { promotion_id: promotionId, claim_id: data?.claim_id || null }
                });
            } catch (_) {}
        };

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) void flushMemberPedometer();
        });

        function getSelectedAvatarStyleCode() {
            return `av2.${myAvatarBody}.${myAvatarOutfit}.${myAvatarSkinTone}.${myAvatarHairColor}.${myAvatarHeight}`;
        }

        function parseAvatarStyleCode(styleCode = "1") {
            const raw = String(styleCode || "1").trim().toLowerCase();
            if (raw === "1") return { body: "male", outfit: "formal" };
            if (raw === "2") return { body: "male", outfit: "sport" };
            if (raw === "3") return { body: "female", outfit: "urban" };

            if (raw.startsWith("av2.")) {
                const [, body, outfit, skinTone, hairColor, height] = raw.split(".");
                return {
                    body: ["male", "female"].includes(body) ? body : "male",
                    outfit: ["formal", "casual", "sport"].includes(outfit) ? outfit : "formal",
                    skinTone: ["fair", "light", "medium", "deep"].includes(skinTone) ? skinTone : "medium",
                    hairColor: ["black", "brown", "blonde", "auburn"].includes(hairColor) ? hairColor : "brown",
                    height: [155, 160, 165, 170, 175, 180, 185, 190].includes(Number(height)) ? Number(height) : 175
                };
            }

            const parts = raw.split("-");
            const body = ["male", "female", "neutral"].includes(parts[0]) ? parts[0] : "neutral";
            const outfit = ["formal", "sport", "urban"].includes(parts[1]) ? parts[1] : "formal";
            return { body, outfit, skinTone: "medium", hairColor: "brown", height: 175 };
        }

        function updateAvatarSelection(kind, value) {
            if (kind === 'body') myAvatarBody = value === 'female' ? 'female' : 'male';
            if (kind === 'outfit') myAvatarOutfit = ["formal", "casual", "sport"].includes(value) ? value : 'formal';
            if (kind === 'skinTone') myAvatarSkinTone = ["fair", "light", "medium", "deep"].includes(value) ? value : 'medium';
            if (kind === 'hairColor') myAvatarHairColor = ["black", "brown", "blonde", "auburn"].includes(value) ? value : 'brown';
            if (kind === 'height') myAvatarHeight = [155, 160, 165, 170, 175, 180, 185, 190].includes(Number(value)) ? Number(value) : 175;
            myAvatarStyle = getSelectedAvatarStyleCode();
            localStorage.setItem('mall-avatar-profile-v2', myAvatarStyle);
            syncAvatarSelectionUi();
            if (hasEnteredMall) {
                trackMySelf();
                broadcastMyPosition();
            }
        }

        const savedAvatarStyle = localStorage.getItem('mall-avatar-profile-v2');
        if (savedAvatarStyle) {
            const savedAvatar = parseAvatarStyleCode(savedAvatarStyle);
            myAvatarBody = savedAvatar.body;
            myAvatarOutfit = savedAvatar.outfit;
            myAvatarSkinTone = savedAvatar.skinTone;
            myAvatarHairColor = savedAvatar.hairColor;
            myAvatarHeight = savedAvatar.height;
            myAvatarStyle = getSelectedAvatarStyleCode();
        }

        function syncAvatarSelectionUi() {
            document.querySelectorAll('.avatar-selection .avatar-opt').forEach((btn) => {
                const kind = btn.dataset.avatarKind;
                const selected = { body: myAvatarBody, outfit: myAvatarOutfit, skinTone: myAvatarSkinTone, hairColor: myAvatarHairColor, height: String(myAvatarHeight) };
                const isSelected = btn.dataset.avatarValue === String(selected[kind]);
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
            updateAvatarSelection('body', body);
        };

        window.selectAvatarOutfit = function (outfit, el) {
            updateAvatarSelection('outfit', outfit);
        };

        window.selectAvatarTrait = function (kind, value) {
            updateAvatarSelection(kind, value);
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
            const loginChoicePanel = document.getElementById('login-choice-panel');
            const memberPanel = document.getElementById('member-entry-panel');
            const tenantPanel = document.getElementById('tenant-entry-panel');
            const guestButton = document.getElementById('guest-entry-button');
            const avatarSelection = normalizeAvatarSelectionPanels();
            const secondaryActions = document.getElementById('entry-secondary-actions');
            const accountCard = document.getElementById('entry-account-card');
            const accountTitle = document.getElementById('welcome-access-title');
            const accountCopy = document.getElementById('welcome-access-copy');
            syncAvatarSelectionUi();

            // Reset visibilities
            if (guestPanel) guestPanel.style.display = (mode === 'guest') ? 'block' : 'none';
            if (loginChoicePanel) loginChoicePanel.style.display = (mode === 'login-choice') ? 'grid' : 'none';
            if (memberPanel) memberPanel.style.display = (mode === 'member') ? 'flex' : 'none';
            if (memberPanel && mode === 'member') memberPanel.dataset.entryFlow = 'login';
            if (tenantPanel) tenantPanel.style.display = (mode === 'tenant') ? 'flex' : 'none';
            
            const isGuest = (mode === 'guest');
            if (accountCard) accountCard.hidden = isGuest;
            if (guestButton) guestButton.style.display = isGuest ? 'inline-block' : 'none';
            if (avatarSelection) avatarSelection.style.display = isGuest ? 'block' : 'none';
            if (secondaryActions) secondaryActions.style.display = isGuest ? 'flex' : 'none';
            if (accountTitle) accountTitle.textContent = mode === 'login-choice'
                ? '¿Cómo quieres ingresar?'
                : mode === 'tenant' ? 'Acceso locatario' : mode === 'member' ? 'Acceso visitante' : 'Tu cuenta';
            if (accountCopy) accountCopy.textContent = mode === 'login-choice'
                ? 'Elige el tipo de cuenta con que deseas acceder.'
                : mode === 'tenant' ? 'Ingresa con tus datos de locatario aprobado.'
                : mode === 'member' ? 'Ingresa con tu cuenta de visitante registrado.'
                : 'Ingresa o crea una cuenta para acceder a beneficios.';
            if (isGuest && hasEnteredMall) window.closeMallAccountAccess?.();
        }

        window.openLoginChooser = function() {
            window.openMallAccountAccess?.();
            window.setEntryMode('login-choice');
        };

        window.openAvatarCustomizer = function() {
            const modal = document.getElementById('avatar-customizer-modal');
            if (!modal) return;
            modal.hidden = false;
            syncAvatarSelectionUi();
            closeControlsMenu();
        };

        window.closeAvatarCustomizer = function() {
            const modal = document.getElementById('avatar-customizer-modal');
            if (modal) modal.hidden = true;
            focusMallCanvas();
        };

        window.openMemberRegistration = function() {
            window.openMallAccountAccess?.();
            window.setEntryMode('member');
            const memberPanel = document.getElementById('member-entry-panel');
            const title = document.getElementById('welcome-access-title');
            const copy = document.getElementById('welcome-access-copy');
            if (memberPanel) memberPanel.dataset.entryFlow = 'register';
            if (title) title.textContent = 'Crear una cuenta';
            if (copy) copy.textContent = 'Regístrate para acceder a beneficios y promociones del mall.';
            setTimeout(() => document.getElementById('member-login-email')?.focus(), 0);
        };

        window.openMallAccountAccess = function() {
            if (!hasEnteredMall) return;
            const overlay = document.getElementById('login-overlay');
            if (!overlay) return;
            overlay.classList.add('mall-account-access');
            overlay.style.opacity = '1';
            overlay.style.display = 'flex';
        };

        window.closeMallAccountAccess = function() {
            if (!hasEnteredMall) return;
            const overlay = document.getElementById('login-overlay');
            if (!overlay) return;
            overlay.classList.remove('mall-account-access');
            overlay.style.opacity = '0';
            overlay.style.display = 'none';
            focusMallCanvas();
        };
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
            // En un mall abierto predominan los accesos anónimos. Los nombres
            // registrados se combinan para que la multitud no repita identidades.
            if (Math.random() < 0.58) return buildGuestNickname();
            const sourceNames = Array.isArray(CHILEAN_NAMES) && CHILEAN_NAMES.length
                ? CHILEAN_NAMES
                : ["Alex Rivera", "Camila Soto", "Diego Muñoz", "Sofía Pérez"];
            const nameParts = sourceNames.map(fullName => {
                const parts = String(fullName).trim().split(/\s+/);
                return {
                    first: parts[0] || "Visitante",
                    last: parts.slice(1).join(" ") || "Mall"
                };
            });
            const size = nameParts.length;
            const first = nameParts[(index * 7 + Math.floor(Math.random() * size)) % size].first;
            const last = nameParts[(index * 11 + Math.floor(Math.random() * size)) % size].last;
            return `${first} ${last}`;
        }

        function buildRandomAvatarStyle() {
            const bodies = ["male", "female", "neutral"];
            const outfits = ["formal", "sport", "urban"];
            return `${bodies[Math.floor(Math.random() * bodies.length)]}-${outfits[Math.floor(Math.random() * outfits.length)]}`;
        }

        async function upsertUserProfile(user, role = "registered_visitor", displayName = "") {
            if (!supabaseClient || !user) return null;
            const protectedRole = userHasAdminAccess(currentUserProfile, user) ? "admin" : role;
            const payload = {
                auth_user_id: user.id,
                email: user.email,
                display_name: displayName || user.user_metadata?.nickname || user.email?.split('@')[0] || "",
                role: protectedRole,
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

        function userHasAdminAccess(profile = null, user = null) {
            if (!currentUserIsAuthoritativeAdmin || !currentTenantUser?.id) return false;
            const candidateId = String(user?.id || profile?.auth_user_id || currentTenantUser.id || "").trim();
            const currentUserId = String(currentTenantUser.id || "").trim();
            return !!currentUserId
                && authoritativeAdminUserId === currentUserId
                && (!candidateId || candidateId === currentUserId);
        }

        function clearAuthoritativeAdminAccess() {
            currentUserIsAuthoritativeAdmin = false;
            authoritativeAdminUserId = "";
            authoritativeAdminVerificationUserId = "";
            authoritativeAdminVerificationPromise = null;
        }

        async function refreshAuthoritativeAdminAccess(user = null, options = {}) {
            const userId = String(user?.id || "").trim();
            if (!supabaseClient || !userId) {
                clearAuthoritativeAdminAccess();
                return false;
            }

            if (authoritativeAdminUserId && authoritativeAdminUserId !== userId) {
                clearAuthoritativeAdminAccess();
            }

            if (!options.force && currentUserIsAuthoritativeAdmin && authoritativeAdminUserId === userId) {
                return true;
            }

            if (
                authoritativeAdminVerificationPromise
                && authoritativeAdminVerificationUserId === userId
            ) {
                return authoritativeAdminVerificationPromise;
            }

            authoritativeAdminVerificationUserId = userId;
            const verificationPromise = (async () => {
                if (!options.sessionAlreadyVerified) {
                    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
                    const verifiedUser = authData?.user || null;
                    if (authError || !verifiedUser || String(verifiedUser.id) !== userId) {
                        if (authError) console.warn("No se pudo verificar la sesión administrativa:", authError.message);
                        clearAuthoritativeAdminAccess();
                        return false;
                    }
                }

                const { data, error } = await supabaseClient.rpc('is_mall_admin');
                if (error) {
                    console.warn("No se pudo verificar el rol administrativo en Supabase:", error.message);
                    clearAuthoritativeAdminAccess();
                    return false;
                }

                if (String(currentTenantUser?.id || "") !== userId) return false;
                if (data === true) {
                    authoritativeAdminUserId = userId;
                    currentUserIsAuthoritativeAdmin = true;
                    return true;
                }

                clearAuthoritativeAdminAccess();
                return false;
            })();

            authoritativeAdminVerificationPromise = verificationPromise;
            try {
                return await verificationPromise;
            } finally {
                if (authoritativeAdminVerificationPromise === verificationPromise) {
                    authoritativeAdminVerificationPromise = null;
                    authoritativeAdminVerificationUserId = "";
                }
            }
        }

        function applyUserRole(profile, user = null) {
            const isExplicitGuest = hasEnteredMall && currentAccessRole === 'guest';
            currentUserProfile = isExplicitGuest ? null : profile;
            const isMallAdmin = !isExplicitGuest && userHasAdminAccess(profile, user);
            const profileRole = isExplicitGuest
                ? "guest"
                : (profile?.role === "admin" ? "registered_visitor" : (profile?.role || "guest"));
            currentUserRole = isMallAdmin ? "admin" : profileRole;
            const btn = document.getElementById('super-admin-btn');
            const btnP = document.getElementById('super-admin-btn-persistent');
            const adminMenuItem = document.getElementById('admin-manage-menu-item');
            const debugPanel = document.getElementById('object-debug-panel');
            const gpsDisplay = document.getElementById('gps-display');
            const adminModal = document.getElementById('super-admin-modal');
            const canShowAdmin = OBJECT_INSPECTOR_ENABLED
                && currentAccessRole !== 'guest'
                && isMallAdmin
                && hasEnteredMall
                && hasPrivilegedMallSession;
            if (btn) btn.style.display = canShowAdmin ? 'block' : 'none';
            if (btnP) btnP.style.display = canShowAdmin ? 'block' : 'none';
            if (adminMenuItem) adminMenuItem.style.display = canShowAdmin ? 'block' : 'none';
            isAdmin = canShowAdmin;
            window.mallCanEditInfrastructure = () => Boolean(
                isAdmin
                && currentUserIsAuthoritativeAdmin
                && window.mallInfrastructureEditorEnabled === true
            );
            window.mallCanUseAdminTools = () => Boolean(
                isAdmin
                && currentUserIsAuthoritativeAdmin
                && currentAccessRole !== 'guest'
                && hasPrivilegedMallSession
            );
            window.dispatchEvent(new Event('mall:admin-access-changed'));
             
            const axisRef = document.getElementById('axis-reference');
            const compassToggle = document.getElementById('admin-toggle-compass');
            const inspectorToggle = document.getElementById('admin-toggle-inspector');
            const infrastructureEditorToggle = document.getElementById('admin-toggle-infrastructure-editor');
            const gpsToggle = document.getElementById('admin-toggle-gps');

            // Por defecto ocultas, el admin las activa desde su panel
            if (axisRef) axisRef.style.display = 'none';
            if (debugPanel) debugPanel.style.display = 'none';
            if (gpsDisplay) gpsDisplay.style.display = 'none';
            if (compassToggle) compassToggle.checked = false;
            if (inspectorToggle) inspectorToggle.checked = false;
            if (infrastructureEditorToggle) infrastructureEditorToggle.checked = false;
            window.mallInfrastructureEditorEnabled = false;
            if (gpsToggle) gpsToggle.checked = false;
            if (!canShowAdmin && adminModal) adminModal.style.display = 'none';
            syncMemberBenefitAccess();
            syncGuestAccountActions();
        }

        window.toggleAdminTool = function(tool, isVisible) {
            if (!isAdmin || !currentUserIsAuthoritativeAdmin) return;
            if (tool === 'compass') {
                const axisRef = document.getElementById('axis-reference');
                if (axisRef) axisRef.style.display = isVisible ? 'block' : 'none';
            } else if (tool === 'inspector') {
                const debugPanel = document.getElementById('object-debug-panel');
                if (debugPanel) debugPanel.style.display = isVisible ? 'block' : 'none';
                if (isVisible) setTimeout(() => window.mallObjectEditor?.render?.(), 0);
                if (!isVisible) {
                    window.mallInfrastructureEditorEnabled = false;
                    const editorToggle = document.getElementById('admin-toggle-infrastructure-editor');
                    if (editorToggle) editorToggle.checked = false;
                    document.getElementById('mall-object-editor')?.remove();
                }
            } else if (tool === 'infrastructure-editor') {
                window.mallInfrastructureEditorEnabled = isVisible;
                const debugPanel = document.getElementById('object-debug-panel');
                const inspectorToggle = document.getElementById('admin-toggle-inspector');
                if (isVisible) {
                    if (inspectorToggle) inspectorToggle.checked = true;
                    if (debugPanel) debugPanel.style.display = 'block';
                    setTimeout(() => window.mallObjectEditor?.render?.('Selecciona un objeto registrado para modificarlo.'), 0);
                    const adminModal = document.getElementById('super-admin-modal');
                    if (adminModal) adminModal.style.display = 'none';
                    const overlay = document.getElementById('modal-overlay');
                    if (overlay) overlay.style.display = 'none';
                    showInteractionFeedback('Editor activo: haz clic en un mueble, banca o muro de tabiquería.');
                } else {
                    document.getElementById('mall-object-editor')?.remove();
                }
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
            const adminUser = await requireAuthoritativeAdminAccess({ showAlert: false });
            if (!adminUser || !isAdmin) {
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
        window.mallCanManagePublicDisplays = () => Boolean(isAdmin && currentUserIsAuthoritativeAdmin);
        let unreadCount = 0;

        window.toggleChat = function () {
            if (!hasMemberBenefitAccess()) {
                window.showMemberBenefitRequired('el chat interno');
                return;
            }
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
            if (!hasMemberBenefitAccess()) {
                window.showMemberBenefitRequired('el chat interno');
                return;
            }
            if (user === myPresenceId) return;
            chatTarget = user;
            const displayName = otherPlayers[user]?.nickname || user;
            document.getElementById('chat-target-text').innerText = `Privado con: ${displayName}`;
            document.getElementById('chat-reset-btn').style.display = isAdmin ? 'inline-block' : 'none';
            if (!isChatOpen) window.toggleChat();
            showInteractionFeedback(`Conversación privada con ${displayName}.`, { duration: 1800 });
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

        if (supabaseClient?.auth?.onAuthStateChange) {
            supabaseClient.auth.onAuthStateChange((event, session) => {
                const sessionUserId = String(session?.user?.id || "").trim();
                const currentUserId = String(currentTenantUser?.id || "").trim();
                const sessionEnded = event === 'SIGNED_OUT' || !sessionUserId;
                const accountChanged = !!currentUserId && !!sessionUserId && currentUserId !== sessionUserId;

                if (!sessionEnded && !accountChanged) return;
                clearAuthoritativeAdminAccess();

                currentTenantUser = null;
                hasPrivilegedMallSession = false;
                currentUserProfile = null;
                currentUserRole = "guest";
                myOwnedStores = [];
                myOwnedStore = null;
                applyUserRole(null, null);
                resetPrivilegedClientState();
                syncTenantManagementAccess();
            });
        }

        async function getVerifiedTenantSessionUser(options = {}) {
            if (!supabaseClient) return null;
            const { data, error } = await supabaseClient.auth.getUser();
            const user = data?.user || null;
            if (error || !user) {
                currentTenantUser = null;
                hasPrivilegedMallSession = false;
                clearAuthoritativeAdminAccess();
                currentUserProfile = null;
                currentUserRole = "guest";
                myOwnedStores = [];
                myOwnedStore = null;
                applyUserRole(null, null);
                resetPrivilegedClientState();
                syncTenantManagementAccess();
                return null;
            }
            if (currentTenantUser?.id && String(currentTenantUser.id) !== String(user.id)) {
                clearAuthoritativeAdminAccess();
            }
            currentTenantUser = user;
            hasPrivilegedMallSession = true;
            await refreshAuthoritativeAdminAccess(user, {
                sessionAlreadyVerified: true,
                force: options.forceAdminRefresh === true
            });
            return user;
        }

        async function verifyTenantStoreAccess(store) {
            const user = await getVerifiedTenantSessionUser({ forceAdminRefresh: true });
            if (!user || !store) return { allowed: false, user: null, store: null };
            if (userHasAdminAccess(currentUserProfile, user)) return { allowed: true, user, store };

            const storeId = String(store.id || "").trim();
            const localCode = String(getStoreCode(store) || "").trim();
            let query = supabaseClient.from('stores').select('*');
            if (storeId) query = query.eq('id', storeId);
            else if (localCode) query = query.eq('local_code', localCode);
            else return { allowed: false, user, store: null };

            const { data: verifiedStore, error } = await query.maybeSingle();
            if (error || !verifiedStore) {
                if (error) console.warn("No se pudo verificar la propiedad del local:", error.message);
                return { allowed: false, user, store: null };
            }

            const ownerId = String(verifiedStore.owner_id || "").trim();
            const userId = String(user.id || "").trim();
            const storeEmail = String(verifiedStore.contact_email || "").trim().toLowerCase();
            const userEmail = String(user.email || "").trim().toLowerCase();
            const isOwner = ownerId && ownerId === userId;
            const isReservedForUser = !ownerId && !!userEmail && storeEmail === userEmail;
            return { allowed: isOwner || isReservedForUser, user, store: verifiedStore };
        }

        window.verifyTenantStoreAccess = verifyTenantStoreAccess;

        function syncTenantManagementAccess() {
            const tenantAccessItem = document.getElementById('tenant-access-btn');
            const hasTenantSession = currentAccessRole !== 'guest'
                && hasPrivilegedMallSession
                && !!currentTenantUser
                && myOwnedStores.length > 0;
            if (tenantAccessItem) tenantAccessItem.innerText = 'Panel Locatario';
        }

        window.toggleTenantLogin = function() {
            closeControlsMenu();
            if (currentAccessRole !== 'guest' && hasPrivilegedMallSession && currentTenantUser) {
                openTenantAdminFromMenu();
                return;
            }
            const modal = document.getElementById('tenant-login-modal');
            if (!modal) return;
            const isHidden = getComputedStyle(modal).display === 'none';
            modal.style.display = isHidden ? 'block' : 'none';
        }

        // --- DETECTOR AUTOMÁTICO DE SESIÓN ADMIN ---
        document.addEventListener('DOMContentLoaded', async () => {
            setTimeout(async () => {
                if (!supabaseClient) return;
                const { data: { user } } = await supabaseClient.auth.getUser();
                if (hasEnteredMall && currentAccessRole === 'guest') return;
                
                if (user) {
                    currentTenantUser = user;
                    hasPrivilegedMallSession = true;
                    await refreshAuthoritativeAdminAccess(user, { sessionAlreadyVerified: true });
                    let profile = await loadUserProfile(user);
                    if (!profile) {
                        profile = {
                            auth_user_id: user.id,
                            email: user.email,
                            display_name: user.user_metadata?.brand_name || user.email?.split('@')[0] || "",
                            role: currentUserIsAuthoritativeAdmin ? "admin" : "registered_visitor"
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
                    clearAuthoritativeAdminAccess();
                    currentUserProfile = null;
                    currentUserRole = "guest";
                    myOwnedStores = [];
                    myOwnedStore = null;
                    applyUserRole(null, null);
                    resetPrivilegedClientState();
                    syncTenantManagementAccess();
                }
                
                // Nota: Los visuales de las tiendas ahora se cargan "On-Demand" al acercarse
                // para maximizar la velocidad de carga inicial del mall.
            }, 1500);
        });

        window.adminLogout = async function() {
            if (supabaseClient) await supabaseClient.auth.signOut();
            hasEnteredMall = false;
            mallEntryInFlight = false;
            mallEntryCompleted = false;
            mallEntryPromise = null;
            mallEntrySequence++;
            resetMallEntrySpawnPoint();
            window.resetMallGuidedVisitorArrival?.();
            hasPrivilegedMallSession = false;
            clearAuthoritativeAdminAccess();
            currentTenantUser = null;
            myOwnedStores = [];
            myOwnedStore = null;
            applyUserRole(null, null);
            resetPrivilegedClientState();
            syncTenantManagementAccess();
            alert("Sesión cerrada correctamente.");
            location.reload(); // Recargar para limpiar estado
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
                    mall_id: window.mallContext?.id,
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

        function setTenantLoginBusy(isBusy) {
            tenantLoginInFlight = isBusy;
            document.querySelectorAll('[data-mall-action="tenantLoginMain"], [data-mall-action="tenantLoginDefault"]').forEach(button => {
                if (!button.dataset.idleLabel) button.dataset.idleLabel = button.textContent.trim();
                button.disabled = isBusy;
                button.setAttribute('aria-busy', isBusy ? 'true' : 'false');
                button.textContent = isBusy ? 'Verificando acceso...' : button.dataset.idleLabel;
            });
        }

        function withRequestTimeout(request, timeoutMs, message) {
            let timeoutId = null;
            const timeout = new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
            });
            return Promise.race([Promise.resolve(request), timeout])
                .finally(() => clearTimeout(timeoutId));
        }

        async function hydrateTenantSessionAfterLogin(user, email, options = {}) {
            const userId = String(user?.id || '');
            if (!userId) return;

            const fallbackProfile = {
                auth_user_id: user.id,
                email,
                display_name: user.user_metadata?.brand_name || email.split('@')[0],
                role: 'registered_visitor'
            };

            // La autoridad administrativa no se descarta por timeout. Cuando Supabase
            // responde, se reaplican los controles y se cargan todos los locales.
            const adminAccessPromise = options.adminAccessPromise
                || refreshAuthoritativeAdminAccess(user, { sessionAlreadyVerified: true });
            void adminAccessPromise
                .then(async isAuthorized => {
                    if (!isAuthorized || String(currentTenantUser?.id || '') !== userId) return;
                    applyUserRole(currentUserProfile || fallbackProfile, user);
                    try {
                        await refreshMyOwnedStoresFromSupabase();
                        syncTenantManagementAccess();
                    } catch (error) {
                        console.warn('No se pudieron cargar todos los locales del administrador:', error);
                    }
                })
                .catch(error => {
                    console.warn('No se pudo completar la verificación administrativa:', error);
                });

            const [profileResult, storesResult] = await Promise.allSettled([
                withRequestTimeout(
                    loadUserProfile(user),
                    8000,
                    'La carga del perfil tardó demasiado.'
                ),
                withRequestTimeout(
                    mallUiScopeQuery(
                        supabaseClient.from('stores').select('*').eq('owner_id', user.id)
                    ).limit(20),
                    8000,
                    'La carga de locales tardó demasiado.'
                )
            ]);

            if (String(currentTenantUser?.id || '') !== userId) return;

            const profile = profileResult.status === 'fulfilled' && profileResult.value
                ? profileResult.value
                : fallbackProfile;
            applyUserRole(profile, user);

            const storesResponse = storesResult.status === 'fulfilled' ? storesResult.value : null;
            if (storesResult.status === 'rejected' || storesResponse?.error) {
                console.warn(storesResult.reason?.message || storesResponse?.error?.message || 'No se pudieron cargar los locales.');
            } else {
                myOwnedStores = storesResponse?.data || [];
                myOwnedStore = myOwnedStores[0] || null;
            }
            syncTenantManagementAccess();

            try {
                await refreshMyOwnedStoresFromSupabase();
                syncTenantManagementAccess();
            } catch (error) {
                console.warn('No se pudieron refrescar los locales vinculados al usuario:', error);
            }
        }

        async function clearLocalSupabaseSessionStorage() {
            const auth = supabaseClient?.auth;
            const storageKey = auth?.storageKey;
            if (!storageKey) return;

            try {
                if (auth.storage?.removeItem) {
                    await auth.storage.removeItem(storageKey);
                } else {
                    window.localStorage?.removeItem(storageKey);
                }
            } catch (error) {
                console.warn('No se pudo limpiar el almacenamiento local de autenticación:', error);
            }
        }

        async function clearAuthenticatedSessionForGuestEntry() {
            if (supabaseClient?.auth) {
                const hasKnownAuthenticatedSession = Boolean(currentTenantUser || hasPrivilegedMallSession);
                // El almacenamiento local se limpia sin pasar por el lock de getSession,
                // que puede quedar pendiente tras un login interrumpido.
                await clearLocalSupabaseSessionStorage();

                if (hasKnownAuthenticatedSession) {
                    try {
                        const { error: signOutError } = await withRequestTimeout(
                            supabaseClient.auth.signOut({ scope: 'local' }),
                            900,
                            'El cierre de la sesión anterior tardó demasiado.'
                        );
                        if (signOutError) {
                            console.warn('La sesión local se limpió, pero signOut informó un error no bloqueante:', signOutError);
                        }
                    } catch (error) {
                        // La sesión persistida ya fue retirada. No dejamos que un lock
                        // antiguo de Auth bloquee la entrada visual del visitante.
                        console.warn('El cierre de sesión anterior continúa en segundo plano:', error);
                    }
                }
            }

            currentTenantUser = null;
            currentMemberProfile = null;
            currentUserProfile = null;
            currentUserRole = "guest";
            hasPrivilegedMallSession = false;
            myOwnedStores = [];
            myOwnedStore = null;
            clearAuthoritativeAdminAccess();
            resetPrivilegedClientState();
            syncTenantManagementAccess();
            return true;
        }

        function finalizeMallEntryUi() {
            const loginOverlay = document.getElementById('login-overlay');
            if (loginOverlay) {
                loginOverlay.style.opacity = '0';
                loginOverlay.style.display = 'none';
            }
            const mainHeader = document.getElementById('main-header');
            if (mainHeader) mainHeader.style.display = 'flex';
            const brandOverlay = document.getElementById('ui-overlay');
            if (brandOverlay) brandOverlay.style.display = 'none';
            controls.update();
            focusMallCanvas();
            showMallQuickStart();
            startProximityContext();
        }

        async function performMallEntry({
            nickname,
            role = "guest",
            user = null,
            profile = null,
            skipTenantAutoArrival = false
        }) {
            mallEntryInFlight = true;
            const entrySequence = ++mallEntrySequence;

            try {
                if (role === "guest") {
                    // Set the public role first so delayed auth hydration cannot expose
                    // controls from the previous signed-in session.
                    currentAccessRole = "guest";
                    currentUserRole = "guest";
                    currentUserProfile = null;
                    currentMemberProfile = null;
                    if (!(await clearAuthenticatedSessionForGuestEntry())) {
                        mallEntryInFlight = false;
                        return false;
                    }
                }
                if (entrySequence !== mallEntrySequence) return false;

                tenantAutoArrivalSequence++;
                if (role === "tenant") tenantAutoArrivalUserId = "";
                resetMallEntrySpawnPoint();
                myNickname = nickname;
                window.mallMazePlayerName = String(nickname || "Jugador local").trim() || "Jugador local";
                currentAccessRole = role;
                currentMemberProfile = role === "member" ? profile : currentMemberProfile;
                hasEnteredMall = true;
                const analyticsIdentity = { role, source: 'entry' };
                if (window.mallAnalytics?.startMallSession) {
                    window.mallAnalytics.startMallSession(analyticsIdentity);
                } else {
                    window.__pendingMallAnalyticsIdentity = analyticsIdentity;
                }
                if (window.mallMobileViewport) {
                    window.mallMobileViewport.activate();
                }
                applyUserRole(currentUserProfile, currentTenantUser || user);
                if (hasMemberBenefitAccess()) void loadMemberBenefitsSummary();
                if (currentUserRole === 'admin') void triggerPendingPromotionAnnouncements();

                if (isAdmin) {
                    resetChatTarget();
                } else {
                    chatTarget = "";
                    document.getElementById('chat-target-text').innerText = "Clickea un jugador para hablarle";
                }

                if (!isWalking) window.toggleWalkMode({ preservePosition: true });
                if (window.mallMobileViewport) window.mallMobileViewport.requestLandscape();
                if (role === "guest" || role === "member" || role === "registered_visitor") {
                    preloadStoreContent(renameStoreCode('O101'));
                }
                const isVisitorEntry = role === "guest"
                    || role === "member"
                    || role === "registered_visitor";

                let placementCompleted = true;
                // El locatario aparece primero en un punto seguro. La resolución de su local
                // continúa en segundo plano para que una consulta lenta no bloquee el ingreso.
                if (role === "tenant" && user && currentUserRole !== "admin" && !skipTenantAutoArrival) {
                    forceEntrySpawn();
                    showInteractionFeedback('Entrando al mall. Ubicaré tu local en unos segundos.', { duration: 3200 });
                    void scheduleTenantAutoArrival(user).catch(error => {
                        console.warn('No se pudo ubicar automáticamente el local del locatario:', error);
                    });
                } else if (isVisitorEntry) {
                    forceInformationDeskVisitorSpawn();
                } else {
                    forceEntrySpawn();
                }
                if (!placementCompleted || entrySequence !== mallEntrySequence || !hasEnteredMall) return false;

                const loginOverlay = document.getElementById('login-overlay');
                if (loginOverlay) loginOverlay.style.opacity = '0';
                await new Promise(resolve => setTimeout(resolve, 160));
                if (entrySequence !== mallEntrySequence || !hasEnteredMall) return false;

                finalizeMallEntryUi();
                mallEntryCompleted = true;
                document.body.dataset.mallEntryState = "complete";
                document.body.dataset.mallEntryRole = role;
                document.body.dataset.mallEntryPlacements = "1";
                document.body.dataset.mallEntrySequence = String(entrySequence);
                try {
                    initPresence();
                } catch (presenceError) {
                    console.warn('El ingreso termino correctamente, pero no se pudo iniciar presencia:', presenceError);
                }
                return true;
            } catch (error) {
                if (entrySequence === mallEntrySequence) {
                    mallEntryInFlight = false;
                    mallEntryCompleted = false;
                    hasEnteredMall = false;
                }
                console.error('No se pudo completar el ingreso unico al mall:', error);
                showInteractionFeedback('No fue posible completar el ingreso. Intenta nuevamente.');
                return false;
            } finally {
                if (entrySequence === mallEntrySequence) mallEntryInFlight = false;
            }
        }

        async function enterMallWithIdentity(options) {
            if (mallEntryCompleted) {
                finalizeMallEntryUi();
                return true;
            }
            if (mallEntryPromise) return mallEntryPromise;

            mallEntryPromise = performMallEntry(options);
            try {
                return await mallEntryPromise;
            } finally {
                mallEntryPromise = null;
            }
        }

        async function resolveTenantEmail(identifier) {
            const clean = String(identifier || "").trim();
            if (!clean) return "";
            if (clean.includes('@')) return clean;
            console.warn("Login de locatario por marca/local deshabilitado para evitar exposicion de correos.");
            return "";
        }

        window.tenantLogin = async function(source = 'modal') {
            if (tenantLoginInFlight) return;
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

            setTenantLoginBusy(true);
            if (source === 'main') setTenantLoginStatus('Verificando credenciales...', false);

            try {
                const { data, error } = await withRequestTimeout(
                    supabaseClient.auth.signInWithPassword({ email, password: pass }),
                    15000,
                    'La autenticación está tardando demasiado. Revisa tu conexión e intenta nuevamente.'
                );
                if (error) {
                    const msg = error.message === "Invalid API key"
                        ? "La clave pública de Supabase no es válida. Revisa que el proyecto use la publishable key correcta."
                        : `No se pudo entrar con "${identifier}" (${email}): ` + error.message;
                    if (source === 'main') return setTenantLoginStatus(msg, true);
                    return alert(msg);
                }

                currentTenantUser = data.user;
                hasPrivilegedMallSession = true;
                if (authoritativeAdminUserId !== String(data.user.id)) {
                    clearAuthoritativeAdminAccess();
                }
                const fallbackProfile = {
                    auth_user_id: data.user.id,
                    email,
                    display_name: data.user.user_metadata?.brand_name || email.split('@')[0],
                    role: 'registered_visitor'
                };
                applyUserRole(fallbackProfile, data.user);

                const adminAccessPromise = refreshAuthoritativeAdminAccess(data.user, {
                    sessionAlreadyVerified: true
                });

                // Perfil, permisos y locales se hidratan en paralelo. Ninguno bloquea la entrada al mall.
                void hydrateTenantSessionAfterLogin(data.user, email, { adminAccessPromise }).catch(error => {
                    console.warn('No se pudo completar la carga posterior al ingreso:', error);
                });

                if (source !== 'main') {
                    const modal = document.getElementById('tenant-login-modal');
                    if (modal) modal.style.display = 'none';
                    alert("Sesión iniciada con éxito.");
                    return;
                }

                if (tenantHasDismissedPasswordSetup(data.user)) {
                    const tenantName = data.user.user_metadata?.brand_name || email.split('@')[0];
                    setTenantLoginStatus("Sesión iniciada. Validando permisos...", false);
                    let adminValidationTimedOut = false;
                    let hasAdminAccess = false;
                    try {
                        hasAdminAccess = Boolean(await withRequestTimeout(
                            adminAccessPromise,
                            1800,
                            'La validación de permisos continúa en segundo plano.'
                        ));
                    } catch (adminError) {
                        adminValidationTimedOut = true;
                        console.warn(adminError?.message || 'La validación administrativa continúa en segundo plano.');
                    }
                    applyUserRole(currentUserProfile || fallbackProfile, data.user);
                    const enterAsAdmin = hasAdminAccess || currentUserRole === 'admin';
                    setTenantLoginStatus("Acceso validado. Entrando al mall...", false);
                    const entered = await enterMallWithIdentity({
                        nickname: `${enterAsAdmin ? 'Administrador' : 'Locatario'} ${tenantName}`,
                        role: enterAsAdmin ? "admin" : "tenant",
                        user: data.user,
                        // Si el permiso administrativo tarda, no encadenamos otra espera de
                        // local. El ingreso usa el punto seguro y la hidratación continúa aparte.
                        skipTenantAutoArrival: adminValidationTimedOut || enterAsAdmin
                    });
                    if (!entered) throw new Error('No se pudo completar la transición de entrada al mall.');
                    return;
                }

                setTenantLoginStatus("Acceso validado. Puedes cambiar tu clave ahora sin correo o continuar al mall.", false);
                openTenantPasswordSetup({ continueToMall: true });
            } catch (error) {
                const msg = error?.message || 'No se pudo completar el ingreso.';
                if (source === 'main') setTenantLoginStatus(msg, true);
                else alert(msg);
            } finally {
                setTenantLoginBusy(false);
            }
        }

        window.openTenantAdminFromMenu = async function() {
            closeControlsMenu();
            if (hasEnteredMall && currentAccessRole === 'guest') {
                return alert("Inicia sesión como locatario para administrar un local.");
            }
            const sessionUser = await getVerifiedTenantSessionUser({ forceAdminRefresh: true });
            if (!sessionUser) return alert("Primero inicia sesión como locatario.");
            try {
                await refreshMyOwnedStoresFromSupabase();
            } catch (error) {
                console.error("No pude refrescar los locales del locatario:", error);
            }
            if (!myOwnedStores.length) return alert("Tu cuenta aún no tiene locales asignados.");
            await refreshAdminStoreDisplayCodes();

            const selectedStoreStillOwned = myOwnedStores.find(store => String(store.id) === String(myOwnedStore?.id));
            myOwnedStore = selectedStoreStillOwned || myOwnedStores[0];

            const access = await verifyTenantStoreAccess(myOwnedStore);
            if (!access.allowed) return alert("No tienes autorización para administrar este local.");
            myOwnedStore = { ...myOwnedStore, ...(access.store || {}) };

            currentModalStoreCode = getStoreCode(myOwnedStore);
            currentModalStoreId = myOwnedStore.id || currentModalStoreCode;
            currentModalStoreData = myOwnedStore;
            await openTenantAdmin();
        }

        function ensureAdminSectionButton(section) {
            return Array.from(document.querySelectorAll('.admin-section-tab'))
                .find(button => button.dataset.mallSection === section);
        }

        window.setAdminPanelSection = function(section = 'tenants') {
            const target = String(section || 'tenants').trim() || 'tenants';
            document.querySelectorAll('[data-admin-section]').forEach(panel => {
                const isActive = panel.dataset.adminSection === target;
                panel.hidden = !isActive;
                panel.classList.toggle('is-active', isActive);
            });
            document.querySelectorAll('.admin-section-tab').forEach(button => {
                const isActive = button.dataset.mallSection === target;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
        };

        function setupAdminPanelLayout() {
            const modal = document.getElementById('super-admin-modal');
            if (!modal) return;

            const header = modal.querySelector('.admin-modal-header');
            const legacyGrid = modal.querySelector('.admin-overview-grid');
            if (!header || !legacyGrid) return;

            let switcher = modal.querySelector('.admin-section-switcher');
            let sectionStack = modal.querySelector('.admin-section-stack');
            if (switcher && sectionStack) return;

            const applicationsCard = legacyGrid.querySelector(':scope > .admin-card');
            const sideStack = legacyGrid.querySelector(':scope > .admin-side-stack');
            if (!applicationsCard || !sideStack) return;

            const sideCards = Array.from(sideStack.children).filter(node => node.classList?.contains('admin-card'));
            const summaryCard = sideCards[0] || null;
            const analyticsCard = sideCards[1] || null;
            const toolsCard = sideCards[2] || null;
            const assignmentCard = sideCards[3] || null;
            const rentalCard = sideCards[4] || null;
            const mallAssistantCard = sideCards[5] || null;
            if (!summaryCard || !analyticsCard || !toolsCard || !assignmentCard || !rentalCard) return;

            switcher = document.createElement('div');
            switcher.className = 'admin-section-switcher';
            switcher.setAttribute('role', 'tablist');
            switcher.setAttribute('aria-label', 'Secciones del panel administrador');
            switcher.innerHTML = [
                ['tenants', 'Gestion de locatarios'],
                ['stats', 'Estadisticas'],
                ['tools', 'Herramientas'],
                ['assistant', 'Asistente del Mall']
            ].map(([section, label], index) => `
                <button type="button" class="admin-section-tab${index === 0 ? ' is-active' : ''}" data-mall-section="${section}" aria-pressed="${index === 0 ? 'true' : 'false'}">${label}</button>
            `).join('');

            sectionStack = document.createElement('div');
            sectionStack.className = 'admin-section-stack';

            const tenantsSection = document.createElement('section');
            tenantsSection.id = 'admin-section-tenants';
            tenantsSection.dataset.adminSection = 'tenants';
            tenantsSection.className = 'admin-section-view is-active';

            const statsSection = document.createElement('section');
            statsSection.id = 'admin-section-stats';
            statsSection.dataset.adminSection = 'stats';
            statsSection.className = 'admin-section-view';
            statsSection.hidden = true;

            const toolsSection = document.createElement('section');
            toolsSection.id = 'admin-section-tools';
            toolsSection.dataset.adminSection = 'tools';
            toolsSection.className = 'admin-section-view';
            toolsSection.hidden = true;

            const assistantSection = document.createElement('section');
            assistantSection.id = 'admin-section-assistant';
            assistantSection.dataset.adminSection = 'assistant';
            assistantSection.className = 'admin-section-view';
            assistantSection.hidden = true;

            const tenantsGrid = document.createElement('div');
            tenantsGrid.className = 'admin-overview-grid admin-overview-grid--tenants';
            const tenantsSideStack = document.createElement('div');
            tenantsSideStack.className = 'admin-side-stack';

            const statsStack = document.createElement('div');
            statsStack.className = 'admin-overview-grid--stats';

            const applicationsTitle = applicationsCard.querySelector('.admin-card-title');
            if (applicationsTitle && !applicationsCard.querySelector('.admin-card-heading')) {
                const heading = document.createElement('div');
                heading.className = 'admin-card-heading';
                applicationsTitle.parentNode.insertBefore(heading, applicationsTitle);
                heading.appendChild(applicationsTitle);
                const subtitle = document.createElement('p');
                subtitle.className = 'admin-card-subtitle';
                subtitle.textContent = 'Revisa solicitudes, crea accesos y asigna locales.';
                heading.appendChild(subtitle);
            }

            const toolsTitle = toolsCard.querySelector('.admin-card-title');
            if (toolsTitle && !toolsCard.querySelector('.admin-card-heading')) {
                const heading = document.createElement('div');
                heading.className = 'admin-card-heading';
                toolsTitle.parentNode.insertBefore(heading, toolsTitle);
                heading.appendChild(toolsTitle);
                const subtitle = document.createElement('p');
                subtitle.className = 'admin-card-subtitle';
                subtitle.textContent = 'Instrumentos tecnicos y desplazamiento rapido para revisar el mall.';
                heading.appendChild(subtitle);
            }

            tenantsGrid.appendChild(applicationsCard);
            tenantsSideStack.appendChild(assignmentCard);
            tenantsSideStack.appendChild(rentalCard);
            tenantsGrid.appendChild(tenantsSideStack);
            tenantsSection.appendChild(tenantsGrid);

            statsStack.appendChild(summaryCard);
            statsStack.appendChild(analyticsCard);
            statsSection.appendChild(statsStack);

            toolsSection.appendChild(toolsCard);

            if (mallAssistantCard) assistantSection.appendChild(mallAssistantCard);

            sectionStack.appendChild(tenantsSection);
            sectionStack.appendChild(statsSection);
            sectionStack.appendChild(toolsSection);
            if (mallAssistantCard) sectionStack.appendChild(assistantSection);

            legacyGrid.replaceWith(sectionStack);
            header.insertAdjacentElement('afterend', switcher);

            switcher.addEventListener('click', (event) => {
                const button = event.target.closest('.admin-section-tab');
                if (!button) return;
                window.setAdminPanelSection(button.dataset.mallSection || 'tenants');
            });
        }

        window.openSuperAdmin = async function() {
            if (!hasEnteredMall) {
                return alert("Primero entra al mall con tu cuenta administradora.");
            }

            const sessionUser = await requireAuthoritativeAdminAccess();
            if (!sessionUser) return;

            let freshProfile = currentUserProfile;
            if (supabaseClient && sessionUser) {
                const loadedProfile = await loadUserProfile(sessionUser);
                if (loadedProfile) {
                    freshProfile = loadedProfile;
                }
                applyUserRole(freshProfile, sessionUser);
            }

            const modal = document.getElementById('super-admin-modal');
            if (modal) {
                setupAdminPanelLayout();
                modal.style.display = 'block';
                window.setAdminPanelSection('tenants');
                await window.loadAdminMallAssistantPanel?.();
                await loadAdminData();
            } else {
                alert("Error: Modal de administración no encontrado.");
            }
        }

        function escapeHtml(value = "") {
            return window.mallSecurity.escapeHtml(value);
        }

        function safeHttpUrl(value = "") {
            return window.mallSecurity.safeHttpUrl(value, window.location.origin);
        }

        function safeImageUrl(value = "") {
            return window.mallSecurity.safeImageUrl(value, window.location.origin);
        }

        function buildSafeMailtoHref(email = "", subject = "") {
            return window.mallSecurity.buildSafeMailtoHref(email, subject);
        }

        function buildSafeWhatsAppHref(phone = "", text = "") {
            return window.mallSecurity.buildSafeWhatsAppHref(phone, text);
        }

        function buildSafeTelHref(phone = "") {
            return window.mallSecurity.buildSafeTelHref(phone);
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
        let selectedAdminAccountExists = false;
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
        let currentTenantProductLimit = 10;
        let tenantAdminHasUnsavedChanges = false;
        let tenantAdminDirtyTrackingBound = false;
        let physicalTeleportRowsCache = [];
        let physicalTeleportRowsLoadedAt = 0;
        const PHYSICAL_TELEPORT_ROWS_TTL_MS = 60 * 1000;

        function resetPrivilegedClientState() {
            const adminModal = document.getElementById('super-admin-modal');
            const tenantModal = document.getElementById('tenant-admin-modal');
            const privilegedPanelWasOpen = [adminModal, tenantModal]
                .some(modal => modal && modal.style.display !== 'none' && getComputedStyle(modal).display !== 'none');

            if (adminModal) adminModal.style.display = 'none';
            if (tenantModal) tenantModal.style.display = 'none';
            if (privilegedPanelWasOpen) {
                const overlay = document.getElementById('modal-overlay');
                if (overlay) overlay.style.display = 'none';
            }

            tenantAdminOpenRequestId++;
            tenantAdminProductsCache.clear();
            tenantAdminProductDrafts.clear();
            tenantAdminHasUnsavedChanges = false;
            currentTenantProductLimit = 10;

            adminApplicationsCache = [];
            selectedAdminApplicationId = null;
            selectedAdminAccountExists = false;
            adminManagedStore = null;
            adminManagedLease = null;
            adminAssignableStoresCache = [];
            physicalTeleportRowsCache = [];
            if (adminRentalLoadTimer) {
                clearTimeout(adminRentalLoadTimer);
                adminRentalLoadTimer = null;
            }

            const adminList = document.getElementById('admin-apps-list');
            if (adminList) adminList.replaceChildren();
            const adminSelection = document.getElementById('admin-selection-content');
            if (adminSelection) adminSelection.style.display = 'none';
            const adminEmpty = document.getElementById('admin-selection-empty');
            if (adminEmpty) adminEmpty.style.display = '';

            const tenantStoreSelect = document.getElementById('tenant-store-select');
            if (tenantStoreSelect) tenantStoreSelect.replaceChildren();
            const tenantProducts = document.getElementById('edit-products-list');
            if (tenantProducts) tenantProducts.replaceChildren();
            const tenantMessages = document.getElementById('tenant-messages-list');
            if (tenantMessages) tenantMessages.replaceChildren();

            document.querySelectorAll('#tenant-admin-modal input, #tenant-admin-modal textarea').forEach(field => {
                if (field.type === 'checkbox' || field.type === 'radio') field.checked = false;
                else field.value = '';
            });
            document.querySelectorAll('#tenant-admin-modal [id^="tenant-metric-"]').forEach(metric => {
                metric.textContent = metric.id === 'tenant-metric-conversion' ? '0%' : '0';
            });
        }

        async function requireAuthoritativeAdminAccess(options = {}) {
            if (hasEnteredMall && currentAccessRole === 'guest') {
                clearAuthoritativeAdminAccess();
                applyUserRole(null, null);
                resetPrivilegedClientState();
                if (options.showAlert !== false) {
                    alert("Debes cerrar la entrada anónima e iniciar sesión con la cuenta administradora.");
                }
                return null;
            }
            const sessionUser = await getVerifiedTenantSessionUser({ forceAdminRefresh: true });
            const allowed = !!sessionUser && userHasAdminAccess(currentUserProfile, sessionUser);
            if (allowed) return sessionUser;

            clearAuthoritativeAdminAccess();
            applyUserRole(currentUserProfile, sessionUser);
            resetPrivilegedClientState();
            if (options.showAlert !== false) {
                alert("Esta sección es solo para el administrador autorizado del mall.");
            }
            return null;
        }

        window.closeSuperAdmin = function() {
            resetPrivilegedClientState();
        };
        const PHYSICAL_TELEPORT_SELECT_COLUMNS = [
            'physical_space_id',
            'display_code',
            'floor_label',
            'teleport_x',
            'teleport_y',
            'teleport_z',
            'teleport_target_x',
            'teleport_target_y',
            'teleport_target_z'
        ].join(',');
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
                const spacesResult = await mallUiScopeQuery(
                    supabaseClient
                        .from('physical_spaces')
                        .select('physical_space_id, display_code')
                );
                const spaces = spacesResult.error ? [] : (spacesResult.data || []);

                if (spaces.length) {
                    spaces.forEach((space) => {
                        const displayCode = String(space?.display_code || "").trim();
                        const spaceId = String(space?.physical_space_id || "").trim();
                        if (spaceId && displayCode) {
                            adminLegacyStoreCodeMap.set(spaceId.toUpperCase(), displayCode);
                        }
                    });
                }

                const links = await mallUiScopeQuery(
                    supabaseClient
                        .from('store_physical_links')
                        .select('store_id, physical_space_id')
                );
                if (links.error || !links.data?.length || !spaces.length) return;

                const spaceCodeById = new Map(
                    spaces
                        .filter(space => (space?.physical_space_id || '') && (space?.display_code || ''))
                        .map(space => [String(space.physical_space_id).trim(), String(space.display_code).trim()])
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

        function setAdminTeleportStatus(message = "", tone = "muted") {
            const statusEl = document.getElementById('admin-teleport-status');
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

        function isMissingPhysicalTeleportColumnsError(error) {
            const message = String(error?.message || "").toLowerCase();
            return error?.code === '42703'
                || message.includes('teleport_x')
                || message.includes('teleport_target_x')
                || message.includes('column');
        }

        function isMissingPhysicalTeleportRpcError(error) {
            const message = String(error?.message || "").toLowerCase();
            return error?.code === 'PGRST202'
                || error?.code === '42883'
                || message.includes('get_physical_space_teleport_points')
                || message.includes('could not find the function')
                || message.includes('function') && message.includes('not found');
        }

        function normalizePhysicalTeleportCode(value = "") {
            return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
        }

        async function loadPhysicalTeleportRows(force = false) {
            if (!supabaseClient) return physicalTeleportRowsCache;
            if (
                !force
                && physicalTeleportRowsLoadedAt
                && (Date.now() - physicalTeleportRowsLoadedAt) < PHYSICAL_TELEPORT_ROWS_TTL_MS
            ) {
                return physicalTeleportRowsCache;
            }

            let data = null;
            let error = null;
            const rpcResult = await supabaseClient.rpc('get_physical_space_teleport_points', {
                p_mall_id: window.mallContext?.id || null
            });
            if (!rpcResult.error) {
                data = rpcResult.data;
            } else if (isMissingPhysicalTeleportRpcError(rpcResult.error)) {
                const tableResult = await mallUiScopeQuery(
                    supabaseClient
                        .from('physical_spaces')
                        .select(PHYSICAL_TELEPORT_SELECT_COLUMNS)
                );
                data = tableResult.data;
                error = tableResult.error;
            } else {
                error = rpcResult.error;
            }

            if (error) {
                if (isMissingPhysicalTeleportColumnsError(error)) {
                    console.warn("[Teleport] Faltan columnas teleport_* en physical_spaces:", error.message);
                } else {
                    console.warn("[Teleport] No pude cargar puntos guardados:", error.message);
                }
                return physicalTeleportRowsCache;
            }

            physicalTeleportRowsCache = data || [];
            physicalTeleportRowsLoadedAt = Date.now();
            return physicalTeleportRowsCache;
        }

        async function loadAdminPhysicalTeleportRowsForRegistration() {
            if (!supabaseClient) return { rows: [], error: new Error("Supabase no disponible") };
            const result = await mallUiScopeQuery(
                supabaseClient
                    .from('physical_spaces')
                    .select(PHYSICAL_TELEPORT_SELECT_COLUMNS)
            );
            if (result.error) return { rows: [], error: result.error };
            return { rows: result.data || [], error: null };
        }

        function getPhysicalTeleportRowsForCode(code = "") {
            const wanted = normalizePhysicalTeleportCode(code);
            if (!wanted) return [];
            return (physicalTeleportRowsCache || []).filter((row) => {
                const candidates = [
                    row?.display_code,
                    row?.physical_space_id
                ].map(normalizePhysicalTeleportCode).filter(Boolean);
                return candidates.includes(wanted);
            });
        }

        function getAdminPhysicalTeleportRowsForDisplayCode(code = "", rows = physicalTeleportRowsCache) {
            const wanted = normalizePhysicalTeleportCode(code);
            if (!wanted) return [];
            return (rows || []).filter((row) => (
                normalizePhysicalTeleportCode(row?.display_code) === wanted
            ));
        }

        function getRenderedPhysicalSpaceIdsForCode(code = "", targetFloor = 1) {
            const ids = [];
            const addId = (value) => {
                const id = String(value || "").trim();
                if (id && !ids.includes(id)) ids.push(id);
            };
            getStoreGroupsForTeleport(code)
                .filter(group => {
                    if (!group) return false;
                    if (group.userData?.isAnchor) return true;
                    if (!group.userData?.isBoutique) return true;
                    return getTeleportGroupFloor(group) === targetFloor;
                })
                .sort((a, b) => getGroupCodeMatchScore(a, code) - getGroupCodeMatchScore(b, code))
                .forEach(group => {
                    addId(group.userData?.physicalSpaceId);
                    addId(group.userData?.physicalSpaceMeta?.id);
                });
            return ids;
        }

        function getRenderedPhysicalGroupById(physicalSpaceId = "", code = "", targetFloor = 1) {
            const wantedId = String(physicalSpaceId || "").trim();
            if (!wantedId) return null;
            return getStoreGroupsForTeleport(code).find(group => {
                if (!group || getTeleportGroupFloor(group) !== targetFloor) return false;
                const groupIds = [
                    group.userData?.physicalSpaceId,
                    group.userData?.physicalSpaceMeta?.id
                ].map(value => String(value || "").trim()).filter(Boolean);
                return groupIds.includes(wantedId);
            }) || null;
        }

        function savedTeleportMatchesRenderedGeometry(row, storeCode = "", targetFloor = 1) {
            if (!row || !hasUsableTeleportPoint(row)) return false;
            const group = getRenderedPhysicalGroupById(row.physical_space_id, storeCode, targetFloor);
            if (!group) return false;

            const groupPosition = group.getWorldPosition(new THREE.Vector3());
            const cameraCoords = getTeleportCameraCoords(row);
            const lookCoords = getTeleportLookCoords(row);
            const cameraDistance = groupPosition.distanceTo(new THREE.Vector3(
                cameraCoords.x,
                groupPosition.y,
                cameraCoords.z
            ));
            const lookDistance = groupPosition.distanceTo(new THREE.Vector3(
                lookCoords.x,
                groupPosition.y,
                lookCoords.z
            ));

            // Una fachada puede tener su camara varios metros fuera del local, pero
            // nunca en el cuadrante opuesto. Esto descarta coordenadas heredadas de
            // otro local aunque el physical_space_id haya quedado bien rotulado.
            return cameraDistance <= 22 && lookDistance <= 18;
        }

        function getTeleportCameraCoords(row = {}) {
            return {
                x: Number(row.camera_x ?? row.teleport_x),
                y: Number(row.camera_y ?? row.teleport_y),
                z: Number(row.camera_z ?? row.teleport_z)
            };
        }

        function getTeleportLookCoords(row = {}) {
            return {
                x: Number(row.look_x ?? row.teleport_target_x),
                y: Number(row.look_y ?? row.teleport_target_y),
                z: Number(row.look_z ?? row.teleport_target_z)
            };
        }

        function hasUsableTeleportPoint(row) {
            const cameraCoords = getTeleportCameraCoords(row);
            const lookCoords = getTeleportLookCoords(row);
            return [
                cameraCoords.x,
                cameraCoords.y,
                cameraCoords.z,
                lookCoords.x,
                lookCoords.y,
                lookCoords.z
            ].every(Number.isFinite);
        }

        function floorMatchesTeleportRow(row, targetFloor = 1) {
            const label = String(row?.floor_label || "").trim();
            if (!label) return true;
            return label === String(targetFloor);
        }

        async function resolveSavedStorefrontTeleportTarget(storeCode = "", targetFloor = 1) {
            if (!storeCode || !supabaseClient) return null;
            await loadPhysicalTeleportRows(false);
            const matches = getPhysicalTeleportRowsForCode(storeCode);
            const renderedPhysicalIds = getRenderedPhysicalSpaceIdsForCode(storeCode, targetFloor);
            // Si la geometria activa identifica los componentes del local, una fila
            // guardada con el mismo display_code pero perteneciente a otro espacio
            // fisico es obsoleta y nunca debe decidir el destino del visitante.
            const eligibleMatches = renderedPhysicalIds.length
                ? matches.filter(row => renderedPhysicalIds.includes(String(row?.physical_space_id || "").trim()))
                : matches;
            const scoreSavedRow = (row) => {
                if (!hasUsableTeleportPoint(row)) return 10000;
                let score = floorMatchesTeleportRow(row, targetFloor) ? 0 : 500;
                const rowPhysicalId = String(row?.physical_space_id || "").trim();
                const rowDisplayCode = normalizePhysicalTeleportCode(row?.display_code);
                const rowPhysicalCode = normalizePhysicalTeleportCode(rowPhysicalId);
                const wantedCode = normalizePhysicalTeleportCode(storeCode);
                const renderedIndex = renderedPhysicalIds.indexOf(rowPhysicalId);
                if (renderedIndex >= 0) score -= 1000 - renderedIndex;
                if (rowPhysicalCode === wantedCode) score -= 120;
                if (rowDisplayCode === wantedCode) score -= 80;
                return score;
            };
            const savedRow = eligibleMatches
                .filter(hasUsableTeleportPoint)
                .filter(row => savedTeleportMatchesRenderedGeometry(row, storeCode, targetFloor))
                .sort((a, b) => scoreSavedRow(a) - scoreSavedRow(b))[0] || null;
            if (!savedRow) return null;

            const cameraCoords = getTeleportCameraCoords(savedRow);
            const lookCoords = getTeleportLookCoords(savedRow);
            const candidate = {
                position: new THREE.Vector3(
                    cameraCoords.x,
                    cameraCoords.y,
                    cameraCoords.z
                ),
                target: new THREE.Vector3(
                    lookCoords.x,
                    lookCoords.y,
                    lookCoords.z
                )
            };

            if (!isWalkableTeleportPosition(candidate.position)) {
                window.mallLastTeleportDebug = {
                    selectedCode: storeCode,
                    resolvedPhysicalSpaceId: savedRow.physical_space_id || "",
                    savedTeleport: true,
                    blocked: true,
                    worldPosition: {
                        x: Number(candidate.position.x.toFixed(2)),
                        y: Number(candidate.position.y.toFixed(2)),
                        z: Number(candidate.position.z.toFixed(2))
                    }
                };
                return { blocked: true };
            }

            window.mallLastTeleportDebug = {
                selectedCode: storeCode,
                resolvedPhysicalSpaceId: savedRow.physical_space_id || "",
                resolvedDisplayCode: savedRow.display_code || "",
                savedTeleport: true,
                savedTeleportSource: 'supabase',
                renderedPhysicalIds,
                targetFloor,
                rawCameraColumns: {
                    camera_x: savedRow.camera_x ?? null,
                    camera_y: savedRow.camera_y ?? null,
                    camera_z: savedRow.camera_z ?? null,
                    teleport_x: savedRow.teleport_x ?? null,
                    teleport_y: savedRow.teleport_y ?? null,
                    teleport_z: savedRow.teleport_z ?? null
                },
                rawLookColumns: {
                    look_x: savedRow.look_x ?? null,
                    look_y: savedRow.look_y ?? null,
                    look_z: savedRow.look_z ?? null,
                    teleport_target_x: savedRow.teleport_target_x ?? null,
                    teleport_target_y: savedRow.teleport_target_y ?? null,
                    teleport_target_z: savedRow.teleport_target_z ?? null
                },
                worldPosition: {
                    x: Number(candidate.position.x.toFixed(2)),
                    y: Number(candidate.position.y.toFixed(2)),
                    z: Number(candidate.position.z.toFixed(2))
                },
                worldTarget: {
                    x: Number(candidate.target.x.toFixed(2)),
                    y: Number(candidate.target.y.toFixed(2)),
                    z: Number(candidate.target.z.toFixed(2))
                }
            };
            return { ...candidate, savedPhysicalSpace: savedRow };
        }

        function getCurrentAdminTeleportPose() {
            if (typeof camera === "undefined" || typeof controls === "undefined") return null;
            const position = camera.position.clone();
            let target = controls.target.clone();
            if (!target || target.distanceTo(position) < 0.4) {
                const direction = new THREE.Vector3();
                camera.getWorldDirection(direction);
                target = position.clone().add(direction.multiplyScalar(8));
            }
            const round = value => Number(Number(value).toFixed(2));
            return {
                teleport_x: round(position.x),
                teleport_y: round(position.y),
                teleport_z: round(position.z),
                teleport_target_x: round(target.x),
                teleport_target_y: round(target.y),
                teleport_target_z: round(target.z)
            };
        }

        function renderAdminTeleportPosePreview(pose = null) {
            const preview = document.getElementById('admin-teleport-current-preview');
            if (!preview) return;
            if (!pose) {
                preview.textContent = "Posicion actual: sin capturar.";
                return;
            }
            preview.textContent = `Camara X ${pose.teleport_x}, Y ${pose.teleport_y}, Z ${pose.teleport_z} - Mira hacia X ${pose.teleport_target_x}, Y ${pose.teleport_target_y}, Z ${pose.teleport_target_z}`;
        }

        window.registerAdminTeleportPosition = async function() {
            const adminUser = await requireAuthoritativeAdminAccess({ showAlert: false });
            if (!adminUser) {
                setAdminTeleportStatus("Esta herramienta es solo para administradores del mall.", "error");
                return;
            }
            if (!supabaseClient) {
                setAdminTeleportStatus("Supabase no está disponible. Abre la app desde el servidor local.", "error");
                return;
            }

            const localCode = getTrimmedValue('admin-teleport-local-code').toUpperCase();
            if (!localCode) {
                setAdminTeleportStatus("Ingresa el codigo visible del local, por ejemplo O-101.", "warn");
                return;
            }

            const pose = getCurrentAdminTeleportPose();
            if (!pose) {
                setAdminTeleportStatus("No pude leer la posicion actual de la camara.", "error");
                return;
            }
            if (pose.teleport_y > 11) {
                setAdminTeleportStatus("Estas en una altura de vista aerea. Baja a modo paseo frente al local antes de registrar.", "warn");
                return;
            }
            const posePosition = new THREE.Vector3(pose.teleport_x, pose.teleport_y, pose.teleport_z);
            if (!isWalkableTeleportPosition(posePosition)) {
                setAdminTeleportStatus("La posicion actual no parece transitable. Muevete un poco fuera de muros, vitrinas o mobiliario y vuelve a registrar.", "error");
                return;
            }
            renderAdminTeleportPosePreview(pose);

            setAdminTeleportStatus("Buscando el local fisico en Supabase...", "muted");
            const adminRowsResult = await loadAdminPhysicalTeleportRowsForRegistration();
            if (adminRowsResult.error) {
                if (isMissingPhysicalTeleportColumnsError(adminRowsResult.error)) {
                    setAdminTeleportStatus("Faltan columnas teleport_* en Supabase. Ejecuta supabase/add_physical_space_teleport_points_20260718.sql y vuelve a registrar.", "error");
                } else {
                    setAdminTeleportStatus("No pude leer physical_spaces: " + adminRowsResult.error.message, "error");
                }
                return;
            }
            physicalTeleportRowsCache = adminRowsResult.rows;
            physicalTeleportRowsLoadedAt = Date.now();
            const rows = adminRowsResult.rows;
            const matches = getAdminPhysicalTeleportRowsForDisplayCode(localCode, rows);
            if (!rows.length) {
                setAdminTeleportStatus("physical_spaces no tiene registros para buscar locales fisicos.", "error");
                return;
            }
            if (!matches.length) {
                setAdminTeleportStatus(`No encontre un espacio fisico con display_code ${localCode}. Revisa el codigo visible del local.`, "error");
                return;
            }

            const ids = matches
                .map(row => String(row.physical_space_id || "").trim())
                .filter(Boolean);
            if (!ids.length) {
                setAdminTeleportStatus("El espacio encontrado no tiene physical_space_id válido.", "error");
                return;
            }

            const payload = {
                ...pose,
                updated_at: new Date().toISOString()
            };
            const { error } = await mallUiScopeQuery(
                supabaseClient
                    .from('physical_spaces')
                    .update(payload)
                    .in('physical_space_id', ids)
            );

            if (error) {
                if (isMissingPhysicalTeleportColumnsError(error)) {
                    setAdminTeleportStatus("Faltan columnas teleport_* en Supabase. Ejecuta supabase/add_physical_space_teleport_points_20260718.sql y vuelve a registrar.", "error");
                } else {
                    setAdminTeleportStatus("No pude guardar la posicion: " + error.message, "error");
                }
                return;
            }

            const idSet = new Set(ids);
            physicalTeleportRowsCache = (physicalTeleportRowsCache || []).map(row => (
                idSet.has(String(row.physical_space_id || "").trim())
                    ? { ...row, ...payload }
                    : row
            ));
            physicalTeleportRowsLoadedAt = 0;
            await loadPhysicalTeleportRows(true);
            setAdminTeleportStatus(`Posicion registrada para ${localCode}. Espacios actualizados: ${ids.length}.`, "success");
            showInteractionFeedback(`Posicion de llegada guardada para ${localCode}.`);
        };

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

            const byLocalCode = await mallUiScopeQuery(
                supabaseClient
                    .from('stores')
                    .select('*')
            )
                .ilike('local_code', code)
                .maybeSingle();
            if (!byLocalCode.error && byLocalCode.data) return { store: byLocalCode.data, error: null };

            const byId = await mallUiScopeQuery(
                supabaseClient
                    .from('stores')
                    .select('*')
            )
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
                const owned = await mallUiScopeQuery(
                    supabaseClient
                        .from('stores')
                        .select('*')
                )
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

            const leaseRes = await mallUiScopeQuery(
                supabaseClient
                    .from('tenant_leases')
                    .select('*')
            )
                .eq('store_id', store.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            adminManagedLease = !leaseRes.error ? leaseRes.data : null;
            fillAdminLeaseForm(adminManagedLease, app, rate);
            fillAdminPaymentForm(adminManagedLease, rate);

            const paymentsRes = await mallUiScopeQuery(
                supabaseClient
                    .from('tenant_payments')
                    .select('*')
            )
                .eq('store_id', store.id)
                .order('due_date', { ascending: false })
                .limit(8);
            const paymentRows = paymentsRes.data || [];
            renderAdminPaymentsHistory(paymentRows);
            renderAdminBalanceSummary(store, paymentRows, adminManagedLease);

            const notesRes = await mallUiScopeQuery(
                supabaseClient
                    .from('tenant_notes')
                    .select('*')
            )
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
            const applicationEmail = String(app?.email || "").trim().toLowerCase();
            const directAuthId = app?.applicant_auth_user_id || app?.auth_user_id || app?.user_id || null;
            let directLookup = null;
            if (directAuthId) {
                directLookup = await findAssignableProfileByAuthId(directAuthId);
                if (directLookup.error) return directLookup;
                const directEmail = String(directLookup.profile?.email || "").trim().toLowerCase();
                if (directLookup.profile && (!applicationEmail || directEmail === applicationEmail)) return directLookup;
            }
            const byEmail = await findAssignableProfileByEmail(app?.email || "");
            if (byEmail.profile || byEmail.error) return byEmail;
            if (directLookup?.profile) return directLookup;

            const fallbackProfile = buildFallbackProfileFromApplication(app);
            return {
                profile: fallbackProfile,
                source: fallbackProfile ? 'tenant_application' : 'none',
                missingUserProfilesTable: false,
                error: null
            };
        }

        async function persistTenantRole(profile, brandName = "") {
            const mustRemainAdmin = userHasAdminAccess(profile, null);

            const payload = {
                auth_user_id: profile.auth_user_id,
                email: profile.email,
                display_name: profile.display_name || brandName || profile.email.split('@')[0],
                role: mustRemainAdmin ? 'admin' : 'tenant',
                updated_at: new Date().toISOString()
            };

            const profileWrite = await supabaseClient
                .from('user_profiles')
                .upsert(payload, { onConflict: 'auth_user_id' });

            if (!profileWrite.error) {
                return { ok: true, fallback: false, skipped: mustRemainAdmin, error: null };
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
                skipped: mustRemainAdmin,
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

        function setAdminTenantAuthStatus(message = "", tone = "muted") {
            const statusEl = document.getElementById('admin-tenant-auth-status');
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

        function buildTemporaryPassword(length = 16) {
            const groups = [
                'ABCDEFGHJKLMNPQRSTUVWXYZ',
                'abcdefghijkmnopqrstuvwxyz',
                '23456789',
                '!@#$%*-_'
            ];
            const allCharacters = groups.join('');
            const randomIndex = (max) => {
                const value = new Uint32Array(1);
                crypto.getRandomValues(value);
                return value[0] % max;
            };
            const characters = groups.map(group => group[randomIndex(group.length)]);
            while (characters.length < length) {
                characters.push(allCharacters[randomIndex(allCharacters.length)]);
            }
            for (let index = characters.length - 1; index > 0; index--) {
                const target = randomIndex(index + 1);
                [characters[index], characters[target]] = [characters[target], characters[index]];
            }
            return characters.join('');
        }

        function populateAdminTenantAuthForm(app = null) {
            const emailInput = document.getElementById('admin-tenant-auth-email');
            const nameInput = document.getElementById('admin-tenant-auth-name');
            const passwordInput = document.getElementById('admin-tenant-temp-password');
            const createButton = document.getElementById('admin-create-tenant-access-btn');
            const resetButton = document.getElementById('admin-reset-tenant-password-btn');
            if (emailInput) emailInput.value = String(app?.email || '').trim().toLowerCase();
            if (nameInput) nameInput.value = String(app?.brand_name || '').trim();
            if (passwordInput) passwordInput.value = buildTemporaryPassword();
            if (createButton) {
                createButton.disabled = false;
                createButton.textContent = 'Crear acceso';
            }
            if (resetButton) {
                resetButton.disabled = true;
                resetButton.textContent = 'Restablecer clave';
            }
            selectedAdminAccountExists = false;
            setAdminTenantAuthStatus('', 'muted');
        }

        function setAdminTenantAuthEmail(email = '') {
            const emailInput = document.getElementById('admin-tenant-auth-email');
            if (!emailInput) return;
            emailInput.value = String(email || '').trim().toLowerCase();
        }

        window.generateTenantTemporaryPassword = function() {
            const passwordInput = document.getElementById('admin-tenant-temp-password');
            if (!passwordInput) return;
            passwordInput.value = buildTemporaryPassword();
            passwordInput.focus();
            passwordInput.select();
            setAdminTenantAuthStatus('Clave temporal nueva generada.', 'success');
        };

        window.copyTenantTemporaryPassword = async function() {
            const passwordInput = document.getElementById('admin-tenant-temp-password');
            const password = String(passwordInput?.value || '');
            if (!password) {
                setAdminTenantAuthStatus('Primero genera una clave temporal.', 'warn');
                return;
            }
            try {
                await navigator.clipboard.writeText(password);
                setAdminTenantAuthStatus('Clave temporal copiada.', 'success');
            } catch (_) {
                passwordInput.focus();
                passwordInput.select();
                setAdminTenantAuthStatus('La clave quedó seleccionada para copiar.', 'warn');
            }
        };

        async function getFunctionsInvokeErrorMessage(error) {
            const fallback = String(error?.message || 'No se pudo crear el acceso.');
            const response = error?.context;
            if (!response || typeof response.clone !== 'function') return fallback;
            try {
                const body = await response.clone().json();
                return String(body?.error || body?.message || fallback);
            } catch (_) {
                return fallback;
            }
        }

        window.resetTenantAccessPassword = async function() {
            if (!await requireAuthoritativeAdminAccess()) return;
            const app = getAdminApplicationById(selectedAdminApplicationId);
            if (!app) {
                setAdminTenantAuthStatus('Selecciona una postulación primero.', 'error');
                return;
            }

            const email = String(document.getElementById('admin-tenant-auth-email')?.value || '').trim().toLowerCase();
            const password = String(document.getElementById('admin-tenant-temp-password')?.value || '');
            const resetButton = document.getElementById('admin-reset-tenant-password-btn');

            if (!email) {
                setAdminTenantAuthStatus('No encontre un correo de acceso valido para esta cuenta.', 'error');
                return;
            }
            if (password.length < 6 || password.length > 72) {
                setAdminTenantAuthStatus('La nueva clave debe tener entre 6 y 72 caracteres.', 'error');
                return;
            }
            if (!selectedAdminAccountExists) {
                setAdminTenantAuthStatus('Primero crea o vincula la cuenta del locatario.', 'warn');
                return;
            }

            const confirmed = confirm(`Se reemplazará la clave actual de ${email} por la clave temporal mostrada.\n\n¿Continuar?`);
            if (!confirmed) return;

            if (resetButton) resetButton.disabled = true;
            setAdminTenantAuthStatus('Restableciendo clave temporal...', 'muted');

            try {
                const { data, error } = await supabaseClient.functions.invoke('admin-reset-tenant-password', {
                    body: {
                        email,
                        password,
                        must_change_password: true
                    }
                });
                if (error) {
                    setAdminTenantAuthStatus(await getFunctionsInvokeErrorMessage(error), 'error');
                    return;
                }
                if (!data?.ok) {
                    setAdminTenantAuthStatus(data?.error || 'Supabase no confirmó el restablecimiento.', 'error');
                    return;
                }

                setAdminTenantAuthStatus(
                    `Clave restablecida. UID: ${data.user_id}. Entrega al locatario el correo y la clave temporal mostrada.`,
                    'success'
                );
            } catch (error) {
                setAdminTenantAuthStatus('No se pudo contactar la función segura: ' + String(error?.message || error), 'error');
            } finally {
                if (resetButton) resetButton.disabled = !selectedAdminAccountExists;
            }
        };

        window.createTenantAccess = async function() {
            if (!await requireAuthoritativeAdminAccess()) return;
            const app = getAdminApplicationById(selectedAdminApplicationId);
            if (!app) {
                setAdminTenantAuthStatus('Selecciona una postulación primero.', 'error');
                return;
            }

            const email = String(document.getElementById('admin-tenant-auth-email')?.value || '').trim().toLowerCase();
            const displayName = String(document.getElementById('admin-tenant-auth-name')?.value || '').trim();
            const password = String(document.getElementById('admin-tenant-temp-password')?.value || '');
            const createButton = document.getElementById('admin-create-tenant-access-btn');

            if (!email) {
                setAdminTenantAuthStatus('No encontre un correo de acceso valido para esta cuenta.', 'error');
                return;
            }
            if (password.length < 12 || password.length > 72) {
                setAdminTenantAuthStatus('La clave temporal debe tener entre 12 y 72 caracteres.', 'error');
                return;
            }

            const resetExistingPassword = selectedAdminAccountExists;
            if (resetExistingPassword) {
                const confirmed = confirm(`La cuenta ${email} ya existe. Se reemplazará su clave actual por la clave temporal mostrada.\n\n¿Continuar?`);
                if (!confirmed) return;
            }

            if (createButton) createButton.disabled = true;
            setAdminTenantAuthStatus('Validando al administrador y creando el acceso...', 'muted');

            try {
                const { data, error } = await supabaseClient.functions.invoke('admin-create-tenant', {
                    body: {
                        email,
                        password,
                        display_name: displayName || app.brand_name || email.split('@')[0],
                        application_id: app.id,
                        reset_existing_password: resetExistingPassword
                    }
                });
                if (error) {
                    setAdminTenantAuthStatus(await getFunctionsInvokeErrorMessage(error), 'error');
                    return;
                }
                if (!data?.ok) {
                    setAdminTenantAuthStatus(data?.error || 'Supabase no confirmó la creación.', 'error');
                    return;
                }

                await loadAdminData();
                if (selectedAdminApplicationId) await openTenantApproval(selectedAdminApplicationId);
                const passwordInputAfterRefresh = document.getElementById('admin-tenant-temp-password');
                if (passwordInputAfterRefresh) passwordInputAfterRefresh.value = password;
                const linkedStores = Number(data.linked_stores || 0);
                const actionLabel = data.created
                    ? 'Acceso creado'
                    : data.password_reset
                        ? 'Cuenta vinculada y clave restablecida'
                        : 'Cuenta existente vinculada';
                setAdminTenantAuthStatus(
                    `${actionLabel}. UID: ${data.user_id}. Locales vinculados: ${linkedStores}. Entrega al locatario el correo y la clave temporal mostrada.`,
                    'success'
                );
                const createButtonAfterRefresh = document.getElementById('admin-create-tenant-access-btn');
                if (createButtonAfterRefresh) createButtonAfterRefresh.textContent = 'Vincular nuevamente';
                const resetButtonAfterRefresh = document.getElementById('admin-reset-tenant-password-btn');
                if (resetButtonAfterRefresh) resetButtonAfterRefresh.disabled = false;
            } catch (error) {
                setAdminTenantAuthStatus('No se pudo contactar la función segura: ' + String(error?.message || error), 'error');
            } finally {
                if (createButton) createButton.disabled = false;
            }
        };

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
                selectedAdminAccountExists = true;
                const effectiveRole = userHasAdminAccess(profile, null) ? 'admin' : (profile.role || 'sin rol');
                target.style.color = '#7fcf8d';
                target.textContent = lookup.missingUserProfilesTable
                    ? `Cuenta encontrada en mall_members. Falta aplicar user_profiles; continuaré con compatibilidad temporal.`
                    : `Cuenta encontrada. Rol efectivo: ${effectiveRole}.`;
                setAdminTenantAuthEmail(profile.email || email || app?.email || '');
                const createButton = document.getElementById('admin-create-tenant-access-btn');
                if (createButton) createButton.textContent = 'Vincular cuenta existente';
                const resetButton = document.getElementById('admin-reset-tenant-password-btn');
                if (resetButton) resetButton.disabled = false;
            } else {
                selectedAdminAccountExists = false;
                target.style.color = '#c5a059';
                target.textContent = lookup.missingUserProfilesTable
                    ? "No encontré al usuario en mall_members. Puedes reservar locales ahora y vincularlos cuando se registre."
                    : "Todavía no tiene cuenta creada. Puedes reservar locales ahora y vincularlos cuando se registre.";
                const resetButton = document.getElementById('admin-reset-tenant-password-btn');
                if (resetButton) resetButton.disabled = true;
            }
        }

        function storeBelongsToTenantAccount(store, profile = null, email = "") {
            const ownerId = String(profile?.auth_user_id || "").trim();
            const accountEmail = String(profile?.email || email || "").trim().toLowerCase();
            const storeOwnerId = String(store?.owner_id || "").trim();
            const storeEmail = String(store?.contact_email || "").trim().toLowerCase();
            const ownedById = !!ownerId && storeOwnerId === ownerId;
            const pendingLinkByEmail = !storeOwnerId && !!accountEmail && storeEmail === accountEmail;
            return ownedById || pendingLinkByEmail;
        }

        function getStoresForTenantAccount(stores = [], profile = null, email = "") {
            return (stores || []).filter(store => storeBelongsToTenantAccount(store, profile, email));
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
                const { data: reservedStores, error: reservedError } = await mallUiScopeQuery(
                    supabaseClient
                        .from('stores')
                        .select('id, local_code, name, owner_id, contact_email')
                )
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

            const { data: allStores, error } = await mallUiScopeQuery(
                supabaseClient
                    .from('stores')
                    .select('id, local_code, name, owner_id, contact_email')
            )
                .order('local_code', { ascending: true });

            if (error) {
                target.style.color = '#ff8866';
                target.textContent = "No pude leer los locales asignados: " + error.message;
                return [];
            }

            const ownedStores = getStoresForTenantAccount(allStores, profile, app.email);

            const labels = ownedStores.map(store => {
                const code = getAdminStoreDisplayCode(store) || 'Sin código';
                const name = store.name ? ` (${store.name})` : '';
                const pendingLink = !store.owner_id ? ' [pendiente de vincular]' : '';
                return `${code}${name}${pendingLink}`;
            });

            target.style.color = labels.length ? '#7fcf8d' : '#888';
            target.textContent = labels.length
                ? `Locales asignados: ${labels.join(', ')}`
                : "Locales asignados: ninguno.";
            return ownedStores;
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
            if (!await requireAuthoritativeAdminAccess()) return;
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
            populateAdminTenantAuthForm(app);
            setSelectedAdminStoreCodes([], false);
            setAdminStoreSelectOptions([]);
            setAdminAssignmentStatus("Selecciona uno o varios locales. Los nuevos se agregarán a la cuenta y los locales anteriores se mantendrán.", "muted");
            await refreshAdminProfileIndicator(app.email || "");
            const ownedStores = await refreshAdminAssignedStores(app);
            const ownedCodes = (ownedStores || []).map(store => getAdminStoreDisplayCode(store)).filter(Boolean);
            setSelectedAdminStoreCodes(ownedCodes, false);
            await refreshAdminAvailableStores(app);
            await loadAdminRentalData(app);
        }

        async function assignStoresToApplicant(appId) {
            if (!await requireAuthoritativeAdminAccess()) return;
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

            const { data: allStores, error: storesErr } = await mallUiScopeQuery(
                supabaseClient
                    .from('stores')
                    .select('*')
            );
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

            const previouslyLinkedStores = hasLinkedAccount
                ? getStoresForTenantAccount(allStores, effectiveProfile, app.email)
                : [];
            const storesToAssign = [...new Map(
                [
                    ...previouslyLinkedStores,
                    ...resolved.filter(x => x.store?.id).map(x => x.store)
                ].map(store => [String(store.id), store])
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
                        .eq('id', app.id)
                        .eq('mall_id', window.mallContext?.id || '');
                } else {
                    await supabaseClient
                        .from('tenant_applications')
                        .update({ status: 'approved' })
                        .eq('email', app.email)
                        .eq('mall_id', window.mallContext?.id || '');
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

            const { error: assignErr } = await supabaseClient
                .from('stores')
                .update({ owner_id: effectiveProfile.auth_user_id })
                .in('id', storeIdsToAssign);
            if (assignErr) {
                setAdminAssignmentStatus("Error al asignar locales: " + assignErr.message, "error");
                return;
            }

            const { data: verificationRows, error: verificationErr } = await mallUiScopeQuery(
                supabaseClient
                    .from('stores')
                    .select('id, owner_id')
            )
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
                ? "Los locales quedaron asignados, pero no pude registrar el rol de locatario: " + roleWrite.error.message
                : null;

            if (app.id) {
                await supabaseClient
                    .from('tenant_applications')
                    .update({ status: 'approved' })
                    .eq('id', app.id)
                    .eq('mall_id', window.mallContext?.id || '');
            } else {
                await supabaseClient
                    .from('tenant_applications')
                    .update({ status: 'approved' })
                    .eq('email', app.email)
                    .eq('mall_id', window.mallContext?.id || '');
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
                    : `Locales agregados a la cuenta: ${storeCodesToAssign.join(', ')}. Los locales anteriores se mantuvieron.`,
                roleWarningMessage || roleWrite.fallback ? "warn" : "success"
            );
        }

        window.rejectTenantApplication = async function(appId) {
            if (!await requireAuthoritativeAdminAccess()) return;
            const { error } = await supabaseClient
                .from('tenant_applications')
                .update({ status: 'rejected' })
                .eq('id', appId)
                .eq('mall_id', window.mallContext?.id || '');
            if (error) {
                setAdminAssignmentStatus("No se pudo rechazar: " + error.message, "error");
                return;
            }
            await loadAdminData();
            await openTenantApproval(appId);
            setAdminAssignmentStatus("Postulación marcada como rechazada.", "warn");
        }

        window.cancelTenantApplication = async function(appId) {
            if (!await requireAuthoritativeAdminAccess()) return;
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
                .eq('id', appId)
                .eq('mall_id', window.mallContext?.id || '');
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
            if (!await requireAuthoritativeAdminAccess()) return;
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
            if (!await requireAuthoritativeAdminAccess()) return;
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
                mall_id: window.mallContext?.id || null,
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
                    .eq('id', adminManagedLease.id)
                    .eq('mall_id', window.mallContext?.id || '');
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
            if (!await requireAuthoritativeAdminAccess()) return;
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
                mall_id: window.mallContext?.id || null,
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
            if (!await requireAuthoritativeAdminAccess()) return;
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
            if (!await requireAuthoritativeAdminAccess()) return;
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
                mall_id: window.mallContext?.id || null,
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
            if (!await requireAuthoritativeAdminAccess()) return;
            void window.mallAnalytics?.loadAdminDashboard();
            void window.mallAnalytics?.loadAdminOperationsDashboard();
            const { data: apps, error: appsErr } = await mallUiScopeQuery(
                supabaseClient
                    .from('tenant_applications')
                    .select('*')
            )
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

            const { data: stores, error: storesErr } = await mallUiScopeQuery(
                supabaseClient.from('stores').select('id, owner_id')
            );
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
            let { data, error } = await mallUiScopeQuery(supabaseClient
                .from('mall_messages')
                .select('*')
                .or(`store_id.eq.${storeId},local_code.eq.${storeCode}`)
                .order('created_at', { ascending: false }));

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

            const queryWithColumns = async (selectColumns) => Promise.all([
                mallUiScopeQuery(supabaseClient
                    .from('store_products')
                    .select(selectColumns)
                    .eq('store_id', storeCode)
                    .order('sort_order', { ascending: true })),
                mallUiScopeQuery(supabaseClient
                    .from('store_products')
                    .select(selectColumns)
                    .ilike('local_code', storeCode)
                    .order('sort_order', { ascending: true }))
            ]);

            let [byStoreId, byLocalCode] = await queryWithColumns('id, store_id, local_code, name, price, image_url, description, slot_index, sort_order');
            if ((byStoreId.error && isMissingColumnError(byStoreId.error, 'slot_index')) || (byLocalCode.error && isMissingColumnError(byLocalCode.error, 'slot_index'))) {
                [byStoreId, byLocalCode] = await queryWithColumns('id, store_id, local_code, name, price, image_url, description, sort_order');
            }
            if ((byStoreId.error && isMissingColumnError(byStoreId.error, 'description')) || (byLocalCode.error && isMissingColumnError(byLocalCode.error, 'description'))) {
                [byStoreId, byLocalCode] = await queryWithColumns('id, store_id, local_code, name, price, image_url, sort_order');
            }

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

            const slotCount = Math.max(1, Math.min(50, Number(currentTenantProductLimit) || 10));
            const normalizedProducts = typeof window.arrangeStoreProductsBySlot === 'function'
                ? window.arrangeStoreProductsBySlot(products, slotCount)
                : (products || []).slice(0, slotCount);
            list.innerHTML = "";
            for (let i = 0; i < slotCount; i++) {
                const p = normalizedProducts[i] || { name: "", price: "", image_url: "", description: "" };
                const slot = document.createElement('div');
                slot.className = "p-slot";
                slot.dataset.slotIndex = String(i + 1);
                slot.style.padding = "10px";
                slot.style.background = "#0c0c0c";
                slot.style.borderRadius = "8px";
                slot.innerHTML = `
                    <div style="color:#c5a059; font-size:10px; letter-spacing:1.2px; margin-bottom:7px; text-transform:uppercase;">Casillero ${i + 1}</div>
                    <input type="text" placeholder="Nombre" value="${escapeHtml(p.name || '')}" class="p-name tenant-product-field" style="width:100%; margin-bottom:5px;">
                    <div style="display:flex; gap:5px;">
                        <input type="text" placeholder="Precio" value="${escapeHtml(p.price || '')}" class="p-price tenant-product-field" style="flex:1;">
                        <input type="text" placeholder="URL Foto" value="${escapeHtml(p.image_url || '')}" class="p-image tenant-product-field" style="flex:2;">
                    </div>
                    <textarea placeholder="Descripción del producto (máx. 500 caracteres)" maxlength="${window.PRODUCT_DESCRIPTION_MAX_LENGTH || 500}" class="p-description tenant-product-field tenant-product-description" style="width:100%; min-height:66px; margin-top:6px; resize:vertical; line-height:1.35;">${escapeHtml(p.description || '')}</textarea>
                    <div style="display:flex; gap:8px; align-items:center; margin-top:7px;">
                        <input type="file" accept="image/*" class="p-file" hidden aria-hidden="true" tabindex="-1">
                        <button type="button" class="p-upload-btn" style="background:rgba(197,160,89,0.10); border:1px solid rgba(197,160,89,0.25); color:#c5a059; padding:6px 10px; border-radius:5px; cursor:pointer; font-size:9px; text-transform:uppercase;">Subir foto</button>
                        <span class="p-upload-status" style="font-size:9px; color:#666; line-height:1.2;">${loading ? 'Cargando catálogo...' : (p.image_url ? 'Foto actual cargada.' : 'Opcional')}</span>
                    </div>
                `;
                list.appendChild(slot);
                const fileInput = slot.querySelector('.p-file');
                slot.querySelector('.p-upload-btn')?.addEventListener('click', () => fileInput?.click());
                fileInput?.addEventListener('change', () => uploadTenantProductImage(fileInput, i));
            }

            list.querySelectorAll('.p-slot').forEach((slot) => {
                ['.p-name', '.p-price', '.p-image', '.p-description'].forEach((selector) => {
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
            slots.forEach((slot, index) => {
                drafts.push({
                    slot_index: Number(slot.dataset.slotIndex) || index + 1,
                    sort_order: (Number(slot.dataset.slotIndex) || index + 1) - 1,
                    name: String(slot.querySelector('.p-name')?.value || '').trim(),
                    price: String(slot.querySelector('.p-price')?.value || '').trim(),
                    image_url: String(slot.querySelector('.p-image')?.value || '').trim(),
                    description: String(slot.querySelector('.p-description')?.value || '').trim().slice(0, window.PRODUCT_DESCRIPTION_MAX_LENGTH || 500)
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
            const slotCount = Math.max(1, Math.min(50, Number(currentTenantProductLimit) || 10));
            const arrangedProducts = typeof window.arrangeStoreProductsBySlot === 'function'
                ? window.arrangeStoreProductsBySlot(products, slotCount)
                : (products || []).slice(0, slotCount);
            if (!drafts?.length) return arrangedProducts;

            const base = Array.from({ length: slotCount }, (_, index) => {
                const product = arrangedProducts[index] || { name: '', price: '', image_url: '', description: '' };
                const draft = drafts[index] || {};
                return {
                    ...product,
                    slot_index: index + 1,
                    sort_order: index,
                    name: draft.name !== undefined ? draft.name : (product.name || ''),
                    price: draft.price !== undefined ? draft.price : (product.price || ''),
                    image_url: draft.image_url !== undefined ? draft.image_url : (product.image_url || ''),
                    description: draft.description !== undefined ? draft.description : (product.description || '')
                };
            });
            return base;
        }

        function getTenantInventoryTitle(store) {
            const productLimit = currentTenantProductLimit || getFallbackProductLimitForStore(store);
            const tier = getFallbackProductTierForStore(store);
            return `Gestión de Inventario (Plan ${tier}, ${productLimit} producto${productLimit === 1 ? '' : 's'} habilitado${productLimit === 1 ? '' : 's'})`;
        }

        function setTenantAdminDirty(isDirty) {
            tenantAdminHasUnsavedChanges = !!isDirty;
            document.getElementById('tenant-admin-modal')?.classList.toggle('tenant-admin-dirty', tenantAdminHasUnsavedChanges);
        }

        const TENANT_CATALOG_MEMORY_MAX_LENGTH = 3000;

        function updateTenantCatalogMemoryCounter() {
            const input = document.getElementById('edit-store-catalog-memory');
            const counter = document.getElementById('edit-store-catalog-memory-count');
            if (!input || !counter) return;
            counter.textContent = `${input.value.length}/${TENANT_CATALOG_MEMORY_MAX_LENGTH}`;
        }

        function bindTenantAdminDirtyTracking() {
            if (tenantAdminDirtyTrackingBound) return;
            const modal = document.getElementById('tenant-admin-modal');
            if (!modal) return;

            const marksStoreAsDirty = (target) => target.matches(
                '.tenant-admin-input, .tenant-telegram-checkbox, .tenant-bot-input, .p-name, .p-price, .p-image, .p-description, #edit-store-logo-file, .p-file'
            );
            const markFromEvent = (event) => {
                if (marksStoreAsDirty(event.target)) setTenantAdminDirty(true);
                if (event.target.id === 'edit-store-catalog-memory') updateTenantCatalogMemoryCounter();
            };

            modal.addEventListener('input', markFromEvent);
            modal.addEventListener('change', markFromEvent);
            tenantAdminDirtyTrackingBound = true;
        }

        function renderTenantStoreSelector() {
            const select = document.getElementById('tenant-store-select');
            const count = document.getElementById('tenant-store-count');
            const label = document.getElementById('tenant-store-switcher-label');
            if (!select) return;

            const hasAdminAccess = userHasAdminAccess(currentUserProfile, currentTenantUser);
            if (label) label.textContent = hasAdminAccess ? 'Todos los locales' : 'Mis locales';

            const selectedStoreId = String(myOwnedStore?.id || getStoreCode(myOwnedStore) || '');
            const sortedStores = [...myOwnedStores].sort((a, b) => {
                const aCode = getAdminStoreDisplayCode(a) || getStoreCode(a) || a.id || '';
                const bCode = getAdminStoreDisplayCode(b) || getStoreCode(b) || b.id || '';
                return String(aCode).localeCompare(String(bCode), 'es', { numeric: true });
            });

            select.innerHTML = '';
            sortedStores.forEach((store) => {
                const option = document.createElement('option');
                option.value = String(store.id || getStoreCode(store));
                const code = getAdminStoreDisplayCode(store) || getStoreCode(store) || store.id || 'Sin código';
                const availability = hasAdminAccess && !store.owner_id ? ' · disponible' : '';
                option.textContent = `${code} · ${store.name || 'Local sin nombre'}${availability}`;
                option.selected = String(store.id || getStoreCode(store)) === selectedStoreId;
                select.appendChild(option);
            });

            select.disabled = sortedStores.length < 2;
            if (count) count.textContent = `${sortedStores.length} local${sortedStores.length === 1 ? '' : 'es'}`;
        }

        window.switchTenantStore = async function(selectElement) {
            const nextStore = myOwnedStores.find(store => String(store.id || getStoreCode(store)) === String(selectElement?.value || ''));
            if (!nextStore || String(nextStore.id) === String(myOwnedStore?.id)) return;

            if (tenantAdminHasUnsavedChanges) {
                const shouldDiscard = confirm('Hay cambios sin guardar en este local. ¿Quieres descartarlos y cambiar de local?');
                if (!shouldDiscard) {
                    renderTenantStoreSelector();
                    return;
                }
                window.clearTenantProductDrafts?.(getStoreCode(myOwnedStore));
            }

            tenantAdminOpenRequestId++;
            setTenantAdminDirty(false);
            myOwnedStore = nextStore;
            currentModalStoreCode = getStoreCode(nextStore);
            currentModalStoreId = nextStore.id || currentModalStoreCode;
            currentModalStoreData = nextStore;
            await openTenantAdmin();
        };

        function populateTenantAdminForm(store) {
            if (!store) return;
            const storeCode = getStoreCode(store);
            const visibleStoreCode = getAdminStoreDisplayCode(store) || storeCode;
            document.getElementById('tenant-store-code-display').textContent = visibleStoreCode || "Sin código";
            const title = document.getElementById('tenant-products-title');
            if (title) title.textContent = getTenantInventoryTitle(store);
            document.getElementById('edit-store-name').value = store.name || "";
            document.getElementById('edit-store-category').value = store.category || "";
            document.getElementById('edit-store-email').value = store.contact_email || "";
            document.getElementById('edit-store-phone').value = store.contact_phone || "";
            document.getElementById('edit-store-whatsapp').value = store.whatsapp || store.contact_phone || "";
            document.getElementById('edit-store-social-url').value = store.social_url || "";
            document.getElementById('edit-store-address').value = store.address || "";
            document.getElementById('edit-store-maps-url').value = store.maps_url || "";
            document.getElementById('edit-store-telegram-enabled').checked = !!store.telegram_notifications_enabled;
            document.getElementById('edit-store-telegram-link-code').value = store.telegram_link_code || "";
            document.getElementById('edit-store-logo').value = store.logo_url || "";
            setTenantUploadStatus('edit-store-logo-status', store.logo_url ? "Logo actual cargado." : "Puedes pegar una URL o subir un logo optimizado.", "muted");
            document.getElementById('edit-store-shelf-style').value = store.shelf_style || "madera";
            document.getElementById('edit-store-catalog-theme').value = window.normalizeMallCatalogTheme?.(store.catalog_theme) || "elegant";
            const memoryInput = document.getElementById('edit-store-catalog-memory');
            if (memoryInput) memoryInput.value = String(store.catalog_memory || "").slice(0, TENANT_CATALOG_MEMORY_MAX_LENGTH);
            updateTenantCatalogMemoryCounter();
            refreshTenantTelegramUi(store);
        }

        window.closeTenantAdmin = function() {
            if (tenantAdminHasUnsavedChanges) {
                const shouldDiscard = confirm('Hay cambios sin guardar. ¿Quieres cerrar el panel y descartarlos?');
                if (!shouldDiscard) return;
                window.clearTenantProductDrafts?.(getStoreCode(myOwnedStore));
            }
            tenantAdminOpenRequestId++;
            setTenantAdminDirty(false);
            document.getElementById('tenant-admin-modal').style.display = 'none';
            document.getElementById('modal-overlay').style.display = 'none';
        }

        window.openTenantAdmin = async function() {
            const sessionUser = await getVerifiedTenantSessionUser({ forceAdminRefresh: true });
            if (!sessionUser) return alert("Primero inicia sesión como locatario.");

            try {
                await refreshMyOwnedStoresFromSupabase();
            } catch (error) {
                console.error("No pude verificar los locales autorizados:", error);
                return alert("No se pudo verificar tu acceso a los locales.");
            }
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

            const access = await verifyTenantStoreAccess(selectedStore);
            if (!access.allowed) return alert("No tienes autorización para administrar este local.");

            myOwnedStore = { ...selectedStore, ...(access.store || {}) };
            currentModalStoreCode = getStoreCode(myOwnedStore);
            currentModalStoreId = myOwnedStore.id || currentModalStoreCode;
            currentModalStoreData = myOwnedStore;
            currentTenantProductLimit = await resolveStoreProductLimit(myOwnedStore);
            myOwnedStore = {
                ...myOwnedStore,
                product_limit: currentTenantProductLimit
            };
            const storeCode = getStoreCode(myOwnedStore);

            document.getElementById('tenant-admin-modal').style.display = 'block';
            document.getElementById('modal-overlay').style.display = 'block';
            void window.mallAnalytics?.loadTenantDashboard(myOwnedStore.id || storeCode);

            bindTenantAdminDirtyTracking();
            renderTenantStoreSelector();
            populateTenantAdminForm(myOwnedStore);
            renderTenantProductSlots(
                mergeProductsWithDrafts(storeCode, tenantAdminProductsCache.get(storeCode) || []),
                !tenantAdminProductsCache.has(storeCode)
            );
            loadStoreMessages(storeCode);
            void window.loadTenantStoreAssistantPanel?.(myOwnedStore);

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
                currentModalStoreCode = getStoreCode(myOwnedStore);
                currentModalStoreId = myOwnedStore.id || currentModalStoreCode;
                currentModalStoreData = myOwnedStore;
                currentTenantProductLimit = await resolveStoreProductLimit(myOwnedStore);
                myOwnedStore = {
                    ...myOwnedStore,
                    product_limit: currentTenantProductLimit
                };
                renderTenantStoreSelector();
                populateTenantAdminForm(myOwnedStore);
                void window.loadTenantStoreAssistantPanel?.(myOwnedStore);

                const latestStoreCode = getStoreCode(myOwnedStore);
                void window.mallAnalytics?.loadTenantDashboard(myOwnedStore.id || latestStoreCode);
                const productsResult = await loadStoreProductsFast(latestStoreCode);
                if (requestId !== tenantAdminOpenRequestId) return;

                if (productsResult.error) {
                    console.warn("No pude cargar productos del locatario:", productsResult.error.message);
                }
                if (productsResult.skipped) {
                    console.warn("Falta store_products.local_code. Ejecuta supabase/store_products_local_code_fix.sql para activar inventario por local.");
                }

                const products = (productsResult.products || []).slice(0, currentTenantProductLimit);
                tenantAdminProductsCache.set(latestStoreCode, products);
                renderTenantProductSlots(mergeProductsWithDrafts(latestStoreCode, products), false);
            });
        }

        window.previewTenantStore = function() {
            const tenantAdminModal = document.getElementById('tenant-admin-modal');
            const manageBtn = document.getElementById('btn-manage-store');
            window.tenantPreviewContext = {
                active: true,
                previousManageDisplay: manageBtn?.style.display || ''
            };
            if (tenantAdminModal) tenantAdminModal.style.display = 'none';

            const storeCode = getStoreCode(myOwnedStore);
            const data = {
                name: document.getElementById('edit-store-name').value,
                shopCode: storeCode,
                category: document.getElementById('edit-store-category').value,
                contactEmail: document.getElementById('edit-store-email').value,
                contactPhone: document.getElementById('edit-store-phone').value,
                catalogMemory: document.getElementById('edit-store-catalog-memory').value,
                catalog_theme: window.normalizeMallCatalogTheme?.(document.getElementById('edit-store-catalog-theme').value) || "elegant",
                storeRecord: {
                    ...myOwnedStore,
                    contact_email: document.getElementById('edit-store-email').value,
                    contact_phone: document.getElementById('edit-store-phone').value,
                    whatsapp: document.getElementById('edit-store-whatsapp').value,
                    social_url: document.getElementById('edit-store-social-url').value,
                    address: document.getElementById('edit-store-address').value,
                    maps_url: document.getElementById('edit-store-maps-url').value,
                    catalog_memory: document.getElementById('edit-store-catalog-memory').value,
                    catalog_theme: window.normalizeMallCatalogTheme?.(document.getElementById('edit-store-catalog-theme').value) || "elegant"
                },
                logo_url: document.getElementById('edit-store-logo')?.value || myOwnedStore?.logo_url || "",
                products: [],
                previewMode: true
            };
            
            const slots = Array.from(document.querySelectorAll('.p-slot')).slice(0, currentTenantProductLimit);
            slots.forEach((slot, index) => {
                const n = slot.querySelector('.p-name').value;
                const p = slot.querySelector('.p-price').value;
                const img = slot.querySelector('.p-image')?.value || "";
                const description = slot.querySelector('.p-description')?.value || "";
                if(n) data.products.push({ n: n, p: p, image_url: img, description: description, slot_index: Number(slot.dataset.slotIndex) || index + 1 });
            });
            
            openModal(data);
        }

        window.saveTenantData = async function() {
            if (!myOwnedStore || !currentTenantUser) return;
            const access = await verifyTenantStoreAccess(myOwnedStore);
            if (!access.allowed) {
                alert("Tu sesión no tiene autorización para modificar este local.");
                return;
            }
            myOwnedStore = { ...myOwnedStore, ...(access.store || {}) };
            const storeCode = getStoreCode(myOwnedStore);
            
            const newName = document.getElementById('edit-store-name').value;
            const newCat = document.getElementById('edit-store-category').value;
            const newEmail = document.getElementById('edit-store-email').value;
            const newPhone = normalizePhone(document.getElementById('edit-store-phone').value);
            const newWhatsApp = normalizePhone(document.getElementById('edit-store-whatsapp').value);
            const newSocialUrl = document.getElementById('edit-store-social-url').value.trim();
            const newAddress = document.getElementById('edit-store-address').value.trim();
            const newMapsUrl = document.getElementById('edit-store-maps-url').value.trim();
            const telegramEnabled = !!document.getElementById('edit-store-telegram-enabled')?.checked;
            const telegramLinkCode = telegramEnabled
                ? (document.getElementById('edit-store-telegram-link-code')?.value || myOwnedStore.telegram_link_code || generateTenantTelegramLinkCode())
                : null;
            const newLogo = document.getElementById('edit-store-logo').value;
            const newStyle = document.getElementById('edit-store-shelf-style').value;
            const newCatalogTheme = window.normalizeMallCatalogTheme?.(document.getElementById('edit-store-catalog-theme').value) || "elegant";
            const newCatalogMemory = document.getElementById('edit-store-catalog-memory').value.trim().slice(0, TENANT_CATALOG_MEMORY_MAX_LENGTH);
            
            // 1. Actualizar los datos del local seleccionado.
            let storeUpdatePayload = {
                name: newName,
                category: newCat,
                contact_email: newEmail,
                contact_phone: newPhone,
                telegram_notifications_enabled: telegramEnabled,
                telegram_link_code: telegramLinkCode,
                whatsapp: newWhatsApp,
                social_url: newSocialUrl || null,
                address: newAddress || null,
                maps_url: newMapsUrl || null,
                logo_url: newLogo,
                shelf_style: newStyle,
                catalog_theme: newCatalogTheme,
                catalog_memory: newCatalogMemory
            };
            
            // Un locatario puede completar un local sin dueño; el administrador nunca altera owner_id desde este panel.
            if (!myOwnedStore.owner_id && currentTenantUser && !userHasAdminAccess(currentUserProfile, currentTenantUser)) {
                storeUpdatePayload.owner_id = currentTenantUser.id;
            }

            let { data: updatedStore, error: storeUpdateError } = await updateStoreByCode(myOwnedStore, storeUpdatePayload);
            if (storeUpdateError && /schema cache|column|contact_phone|whatsapp|social_url|address|maps_url|shelf_style|catalog_theme|catalog_memory|logo_url|contact_email|telegram_notifications_enabled|telegram_link_code|telegram_chat_id|telegram_chat_username/i.test(storeUpdateError.message || "")) {
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
            const slots = Array.from(document.querySelectorAll('.p-slot')).slice(0, currentTenantProductLimit);
            slots.forEach((slot, index) => {
                const n = slot.querySelector('.p-name').value;
                const p = slot.querySelector('.p-price').value;
                const img = slot.querySelector('.p-image').value;
                const description = slot.querySelector('.p-description')?.value || "";
                if(n.trim()) {
                    const slotIndex = Number(slot.dataset.slotIndex) || index + 1;
                    productsToInsert.push({
                        local_code: storeCode,
                        name: n,
                        price: p,
                        image_url: img,
                        description,
                        slot_index: slotIndex,
                        sort_order: slotIndex - 1
                    });
                }
            });

            const productsWrite = await replaceStoreProducts(myOwnedStore, productsToInsert);
            if (!productsWrite.ok) {
                alert("No pude guardar productos: " + productsWrite.error.message);
                return;
            }

            const botWrite = await window.saveTenantStoreAssistantSettings?.(myOwnedStore);
            if (botWrite?.error) {
                alert("No pude guardar el asistente de tienda: " + botWrite.error.message);
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
                whatsapp: newWhatsApp,
                social_url: newSocialUrl,
                address: newAddress,
                maps_url: newMapsUrl,
                logo_url: newLogo,
                shelf_style: newStyle,
                catalog_theme: newCatalogTheme,
                catalog_memory: newCatalogMemory
            };
            myOwnedStores = myOwnedStores.map(store => String(store.id) === String(myOwnedStore.id) ? myOwnedStore : store);
            currentModalStoreData = myOwnedStore;
            renderTenantStoreSelector();

            // 4. Actualizar visuales 3D inmediatamente
            const updatedProductsResult = await loadStoreProducts(storeCode);
            updateStoreVisuals(storeCode, myOwnedStore, updatedProductsResult.products || []);
            await window.refreshTotemSearchInventory?.();
            
            if (productsWrite.ok) {
                alert(productsWrite.skipped 
                    ? "¡Cambios guardados con éxito! (Nota: Se usó el modo de compatibilidad para el inventario)" 
                    : "¡Cambios guardados con éxito!");
            } else {
                alert("Error al guardar productos: " + productsWrite.error.message);
            }
            setTenantAdminDirty(false);
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
            const { error } = await supabaseClient.from('mall_messages').insert([
                mallUiScopePayload(messagePayload)
            ]);
            let messageDelivered = !error;

            if(error) {
                console.error("Error mall_messages:", error);
                // Fallback a contact_messages si la nueva tabla no existe aún
                const { error: fallbackError } = await supabaseClient.from('contact_messages').insert([{
                    name: name,
                    email: email,
                    requirement: msg,
                    store_id: targetId
                }]);
                messageDelivered = !fallbackError;
                if (fallbackError) {
                    console.error("Error contact_messages:", fallbackError);
                    alert("No se pudo enviar el mensaje. Intenta nuevamente.");
                } else {
                    alert("¡Mensaje enviado con éxito!");
                }
            } else {
                alert("¡Mensaje enviado con éxito! El dueño del local lo recibirá en su panel.");
            }
            if (messageDelivered) {
                window.mallAnalytics?.track('message_sent', {
                    storeCode: currentModalStoreCode,
                    channel: 'form',
                    source: 'store_modal'
                });
                if (!error) notifyTelegramForStoreMessage(messagePayload);
                document.getElementById('store-contact-form').reset();
            }
        }
        let otherPlayers = {}; // { sessionId: { mesh, label, targetPos, targetRot } }
        let presenceChannel = null;

        // Variables de optimización (ahorro de datos)
        let lastSentPos = new THREE.Vector3();
        let lastSentRot = 0;
        let lastMovementSamplePos = new THREE.Vector3();
        let lastMovementSampleAt = performance.now();
        let myIsMoving = false;
        let myMoveSpeed = 0;
        const POS_THRESHOLD = 0.2; // Sensibilidad de movimiento (20cm)
        const ROT_THRESHOLD = 0.05; // Sensibilidad de giro mucho más alta (~3 grados)
        const MOVEMENT_SPEED_THRESHOLD = 0.08;
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

        async function refreshMemberProfileAfterPasswordLogin(user, existingProfile = null, fallback = {}) {
            if (!supabaseClient || !user) return existingProfile;
            if (!existingProfile) {
                return upsertMemberProfile(user, {
                    nickname: user.user_metadata?.nickname || fallback.nickname,
                    phone: user.user_metadata?.phone || fallback.phone,
                    phoneVerified: false
                });
            }

            const updates = {
                updated_at: new Date().toISOString()
            };
            const emailVerified = !!user.email_confirmed_at;
            if (existingProfile.email_verified !== emailVerified) updates.email_verified = emailVerified;
            if (!existingProfile.email && user.email) updates.email = user.email;
            if (!existingProfile.phone && (user.user_metadata?.phone || fallback.phone)) {
                updates.phone = user.user_metadata?.phone || fallback.phone;
            }

            if (Object.keys(updates).length <= 1) return existingProfile;

            const { data, error } = await supabaseClient
                .from('mall_members')
                .update(updates)
                .eq('auth_user_id', user.id)
                .select()
                .maybeSingle();
            if (error) {
                console.warn("No se pudo actualizar estado de visitante inscrito:", error.message);
                return { ...existingProfile, ...updates };
            }
            return data || { ...existingProfile, ...updates };
        }

        function getMemberLoginNotice(user, profile = null) {
            const pending = [];
            if (!user?.email_confirmed_at) pending.push("correo");
            if (!profile?.phone_verified) pending.push("celular");
            if (!pending.length) return "";
            return `Ingresaste como visitante inscrito. Tienes pendiente verificar ${pending.join(" y ")} para activar todos los beneficios.`;
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
                currentTenantUser = data.user;
                hasPrivilegedMallSession = true;
                currentMemberProfile = await upsertMemberProfile(data.user, { nickname, phone, phoneVerified: false });
                currentUserProfile = await upsertUserProfile(data.user, "registered_visitor", currentMemberProfile?.nickname || nickname);
                setMemberStatus("Cuenta creada. Entrando como visitante inscrito. Verifica correo y celular para activar beneficios.");
                await enterMallWithIdentity({
                    nickname: getMemberDisplayName(data.user, email),
                    role: "member",
                    user: data.user,
                    profile: currentMemberProfile
                });
            } else {
                setMemberStatus("Cuenta creada. Revisa tu correo para confirmar propiedad. Luego podrás entrar aquí con tu correo y contraseña.");
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

        async function hydrateMemberSessionAfterLogin(user, email) {
            const userId = String(user?.id || '').trim();
            if (!userId || !supabaseClient) return;

            const fallbackPhone = normalizePhone(document.getElementById('member-register-phone')?.value || '');
            try {
                const { data: profile, error: profileError } = await withRequestTimeout(
                    supabaseClient
                        .from('mall_members')
                        .select('*')
                        .eq('auth_user_id', user.id)
                        .maybeSingle(),
                    5000,
                    'La carga del perfil de visitante tardó demasiado.'
                );
                if (profileError) console.warn("No se pudo leer perfil de visitante inscrito:", profileError.message);
                if (String(currentTenantUser?.id || '').trim() !== userId) return;

                const memberProfile = await withRequestTimeout(
                    refreshMemberProfileAfterPasswordLogin(user, profile, {
                        nickname: user.user_metadata?.nickname,
                        phone: fallbackPhone
                    }),
                    5000,
                    'La actualización del perfil de visitante tardó demasiado.'
                );
                if (String(currentTenantUser?.id || '').trim() !== userId) return;
                currentMemberProfile = memberProfile;
                currentUserProfile = await withRequestTimeout(
                    upsertUserProfile(user, "registered_visitor", currentMemberProfile?.nickname || getMemberDisplayName(user, email)),
                    5000,
                    'La sincronización del perfil tardó demasiado.'
                );
                if (String(currentTenantUser?.id || '').trim() !== userId) return;

                const notice = getMemberLoginNotice(user, currentMemberProfile);
                if (notice) {
                    pendingMemberPhone = currentMemberProfile?.phone || user.user_metadata?.phone || fallbackPhone;
                    const panel = document.getElementById('member-phone-verify-panel');
                    if (panel) panel.style.display = 'grid';
                    setMemberStatus(notice, false);
                }
            } catch (error) {
                console.warn('La entrada continúa, pero no se pudo completar la carga del perfil de visitante:', error);
            }
        }

        window.memberLogin = async function(identifierOverride = null, passwordOverride = null) {
            if (memberLoginInFlight) return;
            if (!supabaseClient) return setMemberStatus("No hay conexión con Supabase.", true);
            const identifier = (identifierOverride || document.getElementById('member-login-email').value).trim();
            const password = passwordOverride || document.getElementById('member-login-pass').value;
            if (!identifier || !password) return setMemberStatus("Ingresa correo y contraseña.", true);

            const email = await resolveMemberEmail(identifier);
            if (!email || !email.includes('@')) return setMemberStatus("Por seguridad, el ingreso con contraseña ahora requiere correo directo.", true);

            memberLoginInFlight = true;
            try {
                const { data, error } = await withRequestTimeout(
                    supabaseClient.auth.signInWithPassword({ email, password }),
                    15000,
                    'La autenticación está tardando demasiado. Revisa tu conexión e intenta nuevamente.'
                );
                if (error) {
                    const message = String(error.message || "");
                    if (message.toLowerCase().includes("email not confirmed")) {
                        return setMemberStatus("Tu cuenta existe, pero Supabase exige confirmar el correo antes de aceptar la contraseña. Revisa el email de confirmación o usa recuperación de contraseña.", true);
                    }
                    return setMemberStatus("No se pudo iniciar sesión: " + message, true);
                }

                const user = data.user;
                currentTenantUser = user;
                hasPrivilegedMallSession = true;
                currentMemberProfile = null;
                currentUserProfile = null;
                if (authoritativeAdminUserId !== String(user.id)) {
                    clearAuthoritativeAdminAccess();
                }

                // La entrada no espera perfil, beneficios ni sincronizaciones secundarias.
                void hydrateMemberSessionAfterLogin(user, email);

                const entered = await enterMallWithIdentity({
                    nickname: getMemberDisplayName(user, email),
                    role: "member",
                    user,
                    profile: null
                });
                if (!entered) throw new Error('No se pudo completar la transición de entrada al mall.');
            } catch (error) {
                setMemberStatus(error?.message || 'No se pudo completar el ingreso.', true);
            } finally {
                memberLoginInFlight = false;
            }
        }

        window.startMallExperience = async function () {
            const nicknameInput = document.getElementById('nickname-input');
            const nick = nicknameInput.value.trim();

            // El boton principal es siempre anonimo. El acceso inscrito se inicia
            // exclusivamente desde Login > Visitante registrado.
            const effectiveNick = nick || buildGuestNickname();
            if (!nick && nicknameInput) nicknameInput.value = effectiveNick;
            await enterMallWithIdentity({ nickname: effectiveNick, role: "guest" });
        };

        window.toggleEntryPreferences = function () {
            const panel = document.getElementById('entry-preferences-panel');
            const trigger = document.getElementById('entry-preferences-toggle');
            const chevron = document.getElementById('entry-preferences-chevron');
            if (!panel || !trigger) return;
            const willOpen = panel.hidden;
            panel.hidden = !willOpen;
            trigger.setAttribute('aria-expanded', String(willOpen));
            if (chevron) chevron.textContent = willOpen ? '▴' : '▾';
        };

        window.setEntryShoppingPreference = function (value) {
            const selectedValue = ['makers', 'retail', 'surprise'].includes(value) ? value : '';
            document.querySelectorAll('[data-entry-preference]').forEach((button) => {
                const selected = button.dataset.entryPreference === selectedValue;
                button.classList.toggle('selected', selected);
                button.setAttribute('aria-pressed', String(selected));
            });
            window.setMallEntryShoppingPreference?.(selectedValue);
        };

        const HEARTBEAT_LIMIT = 30000; // Respaldo de pose en reposo; Presence mantiene la conexion.
        let lastUpdateTime = 0;

        function initPresence() {
            if (!supabaseClient) {
                console.warn("Supabase no disponible: el usuario entra sin presencia multijugador.");
                return;
            }
            if (presenceChannel) return;
            const presenceChannelName = window.mallContext?.channelName('mall_presence') || 'mall_presence:providencia';
            presenceChannel = supabaseClient.channel(presenceChannelName, {
                config: {
                    presence: { key: myPresenceId },
                    broadcast: { self: true }
                }
            });

            presenceChannel
                .on('presence', { event: 'sync' }, () => {
                    syncPlayers(presenceChannel.presenceState());
                })
                .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                    const displayName = otherPlayers[key]?.nickname
                        || leftPresences?.[0]?.nickname
                        || key;
                    removePlayer(key);
                    if (key !== myPresenceId) addChatMessage("Sistema", `${displayName} ha salido del mall.`);
                })
                .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                    if (key !== myPresenceId) {
                        const displayName = newPresences?.[0]?.nickname || key;
                        addChatMessage("Sistema", `${displayName} ha entrado al mall.`);
                        broadcastMyPosition(); // Responder inmediatamente al que acaba de entrar
                    }
                })
                .on('broadcast', { event: 'chat_msg' }, payload => {
                    if (!hasMemberBenefitAccess()) return;
                    const { user, text, to, toId, senderId } = payload.payload;
                    if (
                        to !== "Todos"
                        && toId !== myPresenceId
                        && to !== myNickname
                        && senderId !== myPresenceId
                        && user !== myNickname
                    ) return;
                    addChatMessage(user, text, to);
                })
                .on('broadcast', { event: 'pos_update' }, payload => {
                    const pData = payload.payload || {};
                    const id = String(pData.playerId || pData.user || "");
                    if (!id || id === myPresenceId || (!pData.playerId && pData.user === myNickname)) return;
                    const displayName = String(pData.nickname || pData.user || "Visitante");
                    const remoteStyle = pData.style || "1";
                    if (!otherPlayers[id]) otherPlayers[id] = createAvatar(id, displayName, remoteStyle);
                    else updateRemoteAvatarStyle(otherPlayers[id], remoteStyle);
                    const p = otherPlayers[id];
                    updateRemotePlayerIdentity(p, displayName);
                    p.remoteMoving = Boolean(pData.moving);
                    p.remoteSpeed = Number.isFinite(pData.speed) ? Math.max(0, pData.speed) : 0;
                    p.lastPoseReceivedAt = performance.now();
                    if (typeof pData.escId === 'number' && typeof pData.escT === 'number' && escalatorList[pData.escId]) {
                        const escalator = escalatorList[pData.escId];
                        const escProgress = THREE.MathUtils.clamp(pData.escT, 0, 1) * escalator.pathLenZ;
                        p.targetPos.copy(getEscalatorRidePosition(escalator, escProgress, AVATAR_FLOOR_OFFSET));
                        p.targetRot = escalator.travelDir > 0 ? 0 : Math.PI;
                        p.escalatorState = { id: escalator.id, t: pData.escT };
                        p.remoteMoving = true;
                    } else {
                        const remoteGroundY = pData.y - PLAYER_EYE_HEIGHT + AVATAR_FLOOR_OFFSET;
                        p.targetPos.set(pData.x, remoteGroundY, pData.z);
                        p.targetRot = pData.r;
                        p.escalatorState = null;
                        if (Math.abs(p.mesh.position.y - remoteGroundY) > 0.75) {
                            p.mesh.position.y = remoteGroundY;
                        }
                    }
                    if (!p.hasReceivedPose) {
                        p.mesh.position.copy(p.targetPos);
                        p.mesh.rotation.y = p.targetRot;
                        p.hasReceivedPose = true;
                    } else if (!p.remoteMoving && !p.escalatorState) {
                        p.mesh.position.copy(p.targetPos);
                    }
                    p.mesh.visible = true;
                })
                .subscribe(async (status) => {
                    presenceReady = status === 'SUBSCRIBED';
                    document.documentElement.dataset.mallPresenceReady = presenceReady ? 'true' : 'false';
                    if (status === 'SUBSCRIBED') {
                        await trackMySelf();
                        if (hasMemberBenefitAccess()) {
                            document.getElementById('chat-minimized-btn').style.display = 'flex';
                        }
                        // window.toggleChat(); // El chat ahora comienza cerrado por defecto
                        addChatMessage("Sistema", `¡Hola ${myNickname}! Presiona Enter para enviar mensajes.`);
                        broadcastMyPosition();
                    }
                });

            // Intervalo de Broadcast en lugar de Presence Track
            lastSentPos.copy(camera.position);
            lastMovementSamplePos.copy(camera.position);
            lastMovementSampleAt = performance.now();
            setInterval(() => {
                if (!presenceChannel) return;

                const dir = new THREE.Vector3();
                camera.getWorldDirection(dir);
                const realRot = Math.atan2(dir.x, dir.z);

                const dist = camera.position.distanceTo(lastSentPos);
                const rotDiff = Math.abs(realRot - lastSentRot);
                const now = Date.now();
                const sampleNow = performance.now();
                const sampleSeconds = Math.max(0.016, (sampleNow - lastMovementSampleAt) / 1000);
                const sampleDistance = Math.hypot(
                    camera.position.x - lastMovementSamplePos.x,
                    camera.position.z - lastMovementSamplePos.z
                );
                const sampledSpeed = sampleDistance / sampleSeconds;
                const nextMoving = Boolean(currentEscalatorState) || sampledSpeed > MOVEMENT_SPEED_THRESHOLD;
                const movementChanged = nextMoving !== myIsMoving;
                myIsMoving = nextMoving;
                myMoveSpeed = nextMoving ? sampledSpeed : 0;
                lastMovementSamplePos.copy(camera.position);
                lastMovementSampleAt = sampleNow;

                // LÓGICA DE OPTIMIZACIÓN: Solo enviar si hubo cambio o pasó el tiempo límite
                if (movementChanged || dist > POS_THRESHOLD || rotDiff > ROT_THRESHOLD || (now - lastUpdateTime) > HEARTBEAT_LIMIT) {
                    broadcastMyPosition();
                    lastSentPos.copy(camera.position);
                    lastSentRot = realRot;
                    lastUpdateTime = now;
                }
            }, 100);
        }

        async function trackMySelf() {
            if (!presenceChannel || !presenceReady) return;
            // Solo registrar presencia física y qué avatar escogimos
            await presenceChannel.track({
                playerId: myPresenceId,
                nickname: myNickname,
                style: myAvatarStyle,
                role: currentAccessRole
            });
        }

        function broadcastMyPosition() {
            if (!presenceChannel || !presenceReady) return;
            
            // Calcular la rotación real basada en hacia dónde mira la cámara
            const dir = new THREE.Vector3();
            camera.getWorldDirection(dir);
            const realRot = Math.atan2(dir.x, dir.z);

            presenceChannel.send({
                type: 'broadcast',
                event: 'pos_update',
                payload: {
                    playerId: myPresenceId,
                    nickname: myNickname,
                    user: myNickname,
                    style: myAvatarStyle,
                    role: currentAccessRole,
                    x: camera.position.x,
                    y: camera.position.y,
                    z: camera.position.z,
                    r: realRot,
                    moving: myIsMoving,
                    speed: Number(myMoveSpeed.toFixed(3)),
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
            if (!text) return;
            if (!hasMemberBenefitAccess()) {
                window.showMemberBenefitRequired('el chat interno');
                return;
            }
            if (!presenceChannel || !presenceReady) {
                showInteractionFeedback('El chat se está conectando. Intenta nuevamente en un momento.', {
                    duration: 2600,
                    kind: 'guidance'
                });
                return;
            }

            if (!isAdmin && chatTarget === "") {
                return alert("Para conversar, debes acercarte y darle clic a otro avatar en el Mall primero.");
            }

            presenceChannel.send({
                type: 'broadcast',
                event: 'chat_msg',
                payload: {
                    senderId: myPresenceId,
                    user: myNickname,
                    text: text,
                    to: chatTarget === "Todos" ? "Todos" : (otherPlayers[chatTarget]?.nickname || chatTarget),
                    toId: chatTarget === "Todos" ? null : chatTarget
                }
            });
            chatInput.value = '';
            chatInput.blur(); // Quitar el foco para devolver el control a la cámara/teclado del mall
            focusMallCanvas();
        }

        chatSend.onclick = sendChat;
        chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendChat(); e.stopPropagation(); };
        chatInput.addEventListener('keydown', e => e.stopPropagation());
        chatInput.addEventListener('keyup', e => e.stopPropagation());

        // Versión optimizada del archivo fuente de Blender: se descarga una vez y
        // se clona con SkeletonUtils para cada jugador remoto.
        // Mall Persona is the lightweight, branded visitor avatar. It replaces the
        // photorealistic source for multiplayer visitors while keeping Idle/Walk.
        const GAME_READY_AVATAR_URLS = {
            male: "assets/avatars/mall-persona-masculino-v2.glb?v=20260914-mixamo-walk-v2",
            female: "assets/avatars/mall-persona-femenino-v1.glb?v=20260912-mpfb-walk-v1"
        };
        // The final MPFB GLB is exported in meter-sized scene units, matching the mall.
        const GAME_READY_AVATAR_BASE_SCALE = 1;
        const GAME_READY_AVATAR_YAW_OFFSET = 0;
        const gameReadyAvatarState = {
            loader: null,
            promises: {},
            gltfs: {},
            errors: {}
        };

        function getGameReadyAvatarModelKey(styleCode = "1") {
            return parseAvatarStyleCode(styleCode).body === "female" ? "female" : "male";
        }

        function ensureGameReadyAvatarModel(modelKey = "male") {
            const key = GAME_READY_AVATAR_URLS[modelKey] ? modelKey : "male";
            if (gameReadyAvatarState.gltfs[key]) return Promise.resolve(gameReadyAvatarState.gltfs[key]);
            if (gameReadyAvatarState.errors[key]) return Promise.reject(gameReadyAvatarState.errors[key]);
            if (gameReadyAvatarState.promises[key]) return gameReadyAvatarState.promises[key];
            if (!THREE.GLTFLoader || !THREE.SkeletonUtils) {
                gameReadyAvatarState.errors[key] = new Error("GLTFLoader o SkeletonUtils no disponibles.");
                return Promise.reject(gameReadyAvatarState.errors[key]);
            }

            gameReadyAvatarState.loader = gameReadyAvatarState.loader || new THREE.GLTFLoader();
            gameReadyAvatarState.promises[key] = new Promise((resolve, reject) => {
                gameReadyAvatarState.loader.load(
                    GAME_READY_AVATAR_URLS[key],
                    (gltf) => {
                        gameReadyAvatarState.gltfs[key] = gltf;
                        resolve(gltf);
                    },
                    undefined,
                    (error) => {
                        console.warn("No se pudo cargar avatar game-ready:", error);
                        gameReadyAvatarState.errors[key] = error;
                        reject(error);
                    }
                );
            });
            return gameReadyAvatarState.promises[key];
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
                spine: findBoneByTokens(root, ['spine01', 'spine1', 'spine']),
                chest: findBoneByTokens(root, ['spine03', 'spine3', 'spine02', 'spine2', 'chest']),
                neck: findBoneByTokens(root, ['neck01', 'neck']),
                head: findBoneByTokens(root, ['head']),
                upperArmL: findBoneByTokens(root, ['leftarm', 'leftupperarm', 'upperarm01l', 'upperarml']),
                lowerArmL: findBoneByTokens(root, ['leftforearm', 'leftlowerarm', 'lowerarm01l', 'lowerarml']),
                handL: findBoneByTokens(root, ['lefthand', 'handl']),
                upperArmR: findBoneByTokens(root, ['rightarm', 'rightupperarm', 'upperarm01r', 'upperarmr']),
                lowerArmR: findBoneByTokens(root, ['rightforearm', 'rightlowerarm', 'lowerarm01r', 'lowerarmr']),
                handR: findBoneByTokens(root, ['righthand', 'handr']),
                upperLegL: findBoneByTokens(root, ['leftupleg', 'leftthigh', 'upperleg01l', 'uplegl', 'thighl']),
                lowerLegL: findBoneByTokens(root, ['leftleg', 'leftcalf', 'lowerleg01l', 'lowerlegl', 'calfl']),
                footL: findBoneByTokens(root, ['leftfoot', 'footl']),
                upperLegR: findBoneByTokens(root, ['rightupleg', 'rightthigh', 'upperleg01r', 'uplegr', 'thighr']),
                lowerLegR: findBoneByTokens(root, ['rightleg', 'rightcalf', 'lowerleg01r', 'lowerlegr', 'calfr']),
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
            const appearance = parseAvatarStyleCode(styleCode);
            const skinTones = { fair: 0xf2cfb5, light: 0xe2b08b, medium: 0xbd7a58, deep: 0x70442f };
            const hairColors = { black: 0x181414, brown: 0x4a2b20, blonde: 0xb88a48, auburn: 0x783522 };
            const outfitColors = { formal: 0x353333, casual: 0x526b7f, sport: 0x2e6f9e };
            root.traverse((node) => {
                if (!node.isMesh || !node.material) return;
                node.castShadow = true;
                node.receiveShadow = true;
                const materials = (Array.isArray(node.material) ? node.material : [node.material]).map((material) => material?.clone?.() || material);
                node.material = Array.isArray(node.material) ? materials : materials[0];
                materials.forEach((material) => {
                    if (!material) return;
                    // MPFB exports legacy vertex colors intended for Blender's
                    // material graph. They tint the WebGL materials into patches.
                    material.vertexColors = false;
                    material.roughness = Math.min(1, (material.roughness ?? 0.7) + 0.08);
                    material.metalness = Math.min(1, material.metalness ?? 0.05);
                    const materialName = String(material.name || '');
                    if (/body|skin/i.test(`${node.name} ${materialName}`)) material.color.setHex(skinTones[appearance.skinTone] || skinTones.medium);
                    if (/hair/i.test(`${node.name} ${materialName}`)) material.color.setHex(hairColors[appearance.hairColor] || hairColors.brown);
                    if (/look|outfit|jacket|sleeve|pants|casualsuit|shoes/i.test(`${node.name} ${materialName}`)) material.color.setHex(outfitColors[appearance.outfit] || outfitColors.formal);
                    material.needsUpdate = true;
                });
            });
        }

        function attachGameReadyAvatarModel(actor, nickname, gltf) {
            if (actor.gltfRoot) actor.mesh.remove(actor.gltfRoot);
            const clonedScene = THREE.SkeletonUtils.clone(gltf.scene);
            const appearance = parseAvatarStyleCode(actor.styleCode);
            clonedScene.scale.setScalar(GAME_READY_AVATAR_BASE_SCALE * (appearance.height || 175) / 175);
            clonedScene.position.set(0, actor.gltfBaseY, 0);
            // Keep this visual correction separate from the synchronized actor yaw.
            clonedScene.rotation.y = GAME_READY_AVATAR_YAW_OFFSET;
            applyGameReadyAvatarStyle(clonedScene, actor.styleCode);
            clonedScene.traverse((node) => {
                node.userData.playerId = nickname;
            });
            actor.mesh.add(clonedScene);
            actor.gltfRoot = clonedScene;
            actor.gameReadyRig = extractGameReadyRig(clonedScene);
            applyGameReadyRestPose(actor.gameReadyRig);
            actor.actions = {};
            actor.proceduralLocomotion = false;

            const mixer = new THREE.AnimationMixer(clonedScene);
            const idleClip = THREE.AnimationClip.findByName(gltf.animations, 'Idle')
                || findAnimationByTokens(gltf.animations, ['idle']);
            const walkClip = THREE.AnimationClip.findByName(gltf.animations, 'Walk')
                || findAnimationByTokens(gltf.animations, ['walk', 'locomotion', 'jog'])
                || ((gltf.animations?.length === 1) ? gltf.animations[0] : null);
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
            actor.mesh.userData.avatarLoading = false;
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
                styleCode,
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
                modelKey: getGameReadyAvatarModelKey(styleCode),
                ready: false,
                rig: null
            };

            const initialModelKey = actor.modelKey;
            ensureGameReadyAvatarModel(initialModelKey)
                .then((gltf) => {
                    if (actor.modelKey !== initialModelKey) return;
                    attachGameReadyAvatarModel(actor, nickname, gltf);
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

        function createAvatar(playerId, nickname = playerId, styleCode = "1") {
            const actor = createGameReadyAvatar(nickname, styleCode);
            actor.playerId = playerId;
            actor.nickname = nickname;
            actor.styleCode = styleCode;
            actor.isRemotePlayer = true;
            actor.hasReceivedPose = false;
            actor.remoteMoving = false;
            actor.remoteSpeed = 0;
            actor.lastPoseReceivedAt = 0;
            actor.mesh.visible = false;
            actor.label.style.display = 'none';
            actor.mesh.traverse((obj) => {
                obj.userData.playerId = playerId;
            });
            return actor;
        }

        function updateRemoteAvatarStyle(actor, styleCode) {
            if (!actor || actor.styleCode === styleCode) return;
            actor.styleCode = styleCode;
            const appearance = parseAvatarStyleCode(styleCode);
            const nextModelKey = getGameReadyAvatarModelKey(styleCode);
            if (actor.modelKey !== nextModelKey) {
                actor.modelKey = nextModelKey;
                // Leave the current model visible until its replacement is ready.
                ensureGameReadyAvatarModel(nextModelKey)
                    .then((gltf) => attachGameReadyAvatarModel(actor, actor.nickname, gltf))
                    .catch((error) => console.warn("No se pudo cambiar el modelo de avatar:", error));
                return;
            }
            if (!actor.gltfRoot) return;
            actor.gltfRoot.scale.setScalar(GAME_READY_AVATAR_BASE_SCALE * (appearance.height || 175) / 175);
            applyGameReadyAvatarStyle(actor.gltfRoot, styleCode);
        }

        function updateRemotePlayerIdentity(actor, nickname) {
            if (!actor || !nickname || actor.nickname === nickname) return;
            actor.nickname = nickname;
            if (actor.label) actor.label.innerText = nickname;
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

            if (!moving && actor.isRemotePlayer) {
                rig.shoulders.position.y = base.shouldersY;
                rig.torso.position.y = base.torsoY;
                rig.waist.position.y = base.waistY;
                rig.neck.position.y = base.neckY;
                rig.headPivot.position.y = base.headY;

                rig.shoulders.rotation.set(0.01, 0, 0);
                rig.torso.rotation.set(0.012, 0, 0);
                rig.waist.rotation.set(0, 0, 0);
                rig.headPivot.rotation.set(0, 0, 0);

                rig.armL.root.rotation.set(-0.1, 0, base.armLRotZ);
                rig.armR.root.rotation.set(0.07, 0, base.armRRotZ);
                rig.armL.lower.rotation.x = -0.18;
                rig.armR.lower.rotation.x = -0.14;
                rig.legL.root.rotation.set(-0.018, 0, 0);
                rig.legR.root.rotation.set(0.018, 0, 0);
                rig.legL.lower.rotation.x = 0.07;
                rig.legR.lower.rotation.x = 0.07;
                rig.footL.rotation.x = -0.01;
                rig.footR.rotation.x = -0.01;
                return;
            }

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
            const activeIds = new Set();
            Object.entries(state || {}).forEach(([id, presences]) => {
                if (id === myPresenceId) return;
                activeIds.add(id);
                const presence = presences?.[presences.length - 1] || {};
                let remoteStyle = "1";
                if (presence.style) remoteStyle = presence.style;
                const displayName = String(presence.nickname || id);
                if (!otherPlayers[id]) otherPlayers[id] = createAvatar(id, displayName, remoteStyle);
                else updateRemoteAvatarStyle(otherPlayers[id], remoteStyle);
                updateRemotePlayerIdentity(otherPlayers[id], displayName);
            });
            Object.keys(otherPlayers).forEach((id) => {
                if (!activeIds.has(id)) removePlayer(id);
            });
            document.documentElement.dataset.mallPresenceCount = String(activeIds.size + 1);
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
                    if (!p.hasReceivedPose) {
                        p.mesh.visible = false;
                        if (p.label) p.label.style.display = 'none';
                        return;
                    }
                    const prevPos = p.mesh.position.clone();
                    if (p.escalatorState) {
                        p.mesh.position.lerp(p.targetPos, 0.1);
                    } else if (!p.remoteMoving) {
                        p.mesh.position.copy(p.targetPos);
                    } else {
                        p.mesh.position.x = THREE.MathUtils.lerp(p.mesh.position.x, p.targetPos.x, 0.1);
                        p.mesh.position.z = THREE.MathUtils.lerp(p.mesh.position.z, p.targetPos.z, 0.1);
                        p.mesh.position.y = p.targetPos.y;
                    }
                    let targetRot = p.targetRot; // El valor ya viene corregido desde el emisor
                    let rotDiff = targetRot - p.mesh.rotation.y;
                    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
                    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
                    p.mesh.rotation.y += rotDiff * 0.35; // Giro más rápido y reactivo

                    const stepDistance = p.remoteMoving ? prevPos.distanceTo(p.mesh.position) : 0;
                    const poseMovement = p.remoteMoving
                        ? Math.max(stepDistance, THREE.MathUtils.clamp((p.remoteSpeed || 0) / 60, 0.002, 0.08))
                        : 0;
                    applyAvatarPose(p, poseMovement, nowMs);
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
