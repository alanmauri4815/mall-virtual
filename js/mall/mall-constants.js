        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xaabbcc);
        const catalogClickTargets = [];
        const IS_COARSE_POINTER = window.matchMedia('(pointer: coarse)').matches;
        const FOG_PROFILE_OUTSIDE = { near: IS_COARSE_POINTER ? 16 : 22, far: IS_COARSE_POINTER ? 130 : 190 };
        const FOG_PROFILE_STORE_INSIDE = { near: IS_COARSE_POINTER ? 34 : 42, far: IS_COARSE_POINTER ? 220 : 320 };
        scene.fog = new THREE.Fog(0xaabbcc, FOG_PROFILE_OUTSIDE.near, FOG_PROFILE_OUTSIDE.far);

        const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1500);
        camera.position.set(45, 45, 45);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        const getPreferredPixelRatio = () => {
            return Math.min(window.devicePixelRatio || 1, IS_COARSE_POINTER ? 1.0 : 1.3);
        };
        const syncRendererViewport = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(getPreferredPixelRatio());
        };
        renderer.toneMapping = THREE.ReinhardToneMapping;
        syncRendererViewport();
        document.getElementById('canvas-container').appendChild(renderer.domElement);
        renderer.domElement.setAttribute('tabindex', '0');
        renderer.domElement.style.outline = 'none';
        window.addEventListener('resize', syncRendererViewport);
        window.addEventListener('orientationchange', () => {
            setTimeout(syncRendererViewport, 250);
            setTimeout(syncRendererViewport, 700);
        });

        let isWalking = false;
        let controlsMenuOpen = false;
        let currentModalStoreCode = "";
        let currentModalStoreId = "";
        let currentModalStoreData = null;
        let lockWalkModePreference = true;
        const WALK_SPAWN = new THREE.Vector3(11.93, 1.80, -0.12);
        const WALK_LOOK_TARGET = new THREE.Vector3(11.913, 1.80, -0.144);
        function resolveWalkableSpawnPosition(basePosition) {
            const radii = [0, 0.9, 1.8, 2.8, 4.0, 5.5];
            const directions = 16;
            for (const radius of radii) {
                if (radius === 0) {
                    if (!checkCollision(basePosition.x, basePosition.y, basePosition.z, { ignoreActorId: '__local__' })) {
                        return basePosition.clone();
                    }
                    continue;
                }
                for (let i = 0; i < directions; i++) {
                    const angle = (Math.PI * 2 * i) / directions;
                    const candidate = new THREE.Vector3(
                        basePosition.x + Math.cos(angle) * radius,
                        basePosition.y,
                        basePosition.z + Math.sin(angle) * radius
                    );
                    if (!checkCollision(candidate.x, candidate.y, candidate.z, { ignoreActorId: '__local__' })) {
                        return candidate;
                    }
                }
            }
            return basePosition.clone();
        }
        const forceEntrySpawn = () => {
            const spawnPos = resolveWalkableSpawnPosition(WALK_SPAWN);
            camera.position.set(spawnPos.x, spawnPos.y, spawnPos.z);
            controls.target.set(WALK_LOOK_TARGET.x, WALK_LOOK_TARGET.y, WALK_LOOK_TARGET.z);
            controls.update();
        };

        function syncControlsMenu() {
            const dropdown = document.getElementById('controls-dropdown');
            const chevron = document.getElementById('controls-menu-chevron');
            const trigger = document.getElementById('controls-menu-btn');
            if (dropdown) dropdown.style.display = controlsMenuOpen ? 'flex' : 'none';
            if (chevron) chevron.innerText = controlsMenuOpen ? '▴' : '▾';
            if (trigger) trigger.setAttribute('aria-expanded', controlsMenuOpen ? 'true' : 'false');
        }

        window.toggleControlsMenu = function(forceState) {
            controlsMenuOpen = typeof forceState === 'boolean' ? forceState : !controlsMenuOpen;
            syncControlsMenu();
        };

        window.closeControlsMenu = function() {
            if (!controlsMenuOpen) return;
            controlsMenuOpen = false;
            syncControlsMenu();
        };

        function syncWalkModeButton() {
            const btn = document.getElementById('walk-mode-menu-item');
            if (!btn) return;
            btn.innerText = isWalking ? "Cambiar a Modo Aéreo" : "Cambiar a Modo Paseo";
        }

        function isElementActuallyVisible(element) {
            if (!element) return false;
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0.01;
        }

        function shouldForceWalkMode() {
            if (!lockWalkModePreference) return false;
            if (!hasEnteredMall) return false;
            if (isElementActuallyVisible(document.getElementById('login-overlay'))) return false;
            if (isElementActuallyVisible(document.getElementById('store-modal'))) return false;
            if (isElementActuallyVisible(document.getElementById('search-modal'))) return false;
            if (isElementActuallyVisible(document.getElementById('tenant-login-modal'))) return false;
            if (isElementActuallyVisible(document.getElementById('tenant-apply-modal'))) return false;
            if (isElementActuallyVisible(document.getElementById('super-admin-modal'))) return false;
            if (isElementActuallyVisible(document.getElementById('tenant-admin-modal'))) return false;
            if (isElementActuallyVisible(document.getElementById('password-recovery-modal'))) return false;
            if (isElementActuallyVisible(document.getElementById('tenant-password-setup-modal'))) return false;
            return true;
        }

        function ensureWalkModeActive() {
            if (!hasEnteredMall || !lockWalkModePreference) return;
            if (isWalking) return;
            window.toggleWalkMode();
        }

        window.toggleWalkMode = function () {
            isWalking = !isWalking;
            lockWalkModePreference = isWalking;
            if (isWalking) {
                scene.fog = new THREE.Fog(0xaabbcc, FOG_PROFILE_OUTSIDE.near, FOG_PROFILE_OUTSIDE.far);
                camera.position.copy(resolveWalkableSpawnPosition(WALK_SPAWN)); // Spawn cercano al atrio para mejor orientación inicial
                controls.target.copy(WALK_LOOK_TARGET);
                controls.enablePan = false;
                controls.minPolarAngle = Math.PI / 2 - 0.7;
                controls.maxPolarAngle = Math.PI / 2 + 0.5;
                controls.minDistance = 0.01; controls.maxDistance = 0.05;

                if (IS_COARSE_POINTER) {
                    document.getElementById('mobile-controls-container').style.display = 'flex';
                }
                setTimeout(() => {
                    try {
                        renderer.domElement.focus({ preventScroll: true });
                    } catch (_) {
                        renderer.domElement.focus();
                    }
                }, 0);
            } else {
                scene.fog = null;
                camera.position.set(45, 45, 45);
                controls.target.set(0, 0, 0);
                controls.enablePan = true;
                controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI / 2 - 0.05;
                controls.minDistance = 1; controls.maxDistance = 500;
                document.getElementById('mobile-controls-container').style.display = 'none';
            }
            syncWalkModeButton();
            closeControlsMenu();
        };

        console.log("Controles de órbita...");
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = Math.PI / 2 - 0.05;

        const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
        scene.add(ambientLight);
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2.5);
        scene.add(hemisphereLight);
        const sun = new THREE.DirectionalLight(0xffffff, 3.0); sun.position.set(150, 200, 150); scene.add(sun);
        const roofGlassMeshes = [];

        const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.3, transparent: true, opacity: 0.7, metalness: 0.2, roughness: 0.05 });
        const roofGlassMat = new THREE.MeshPhysicalMaterial({ color: 0xf4f7fb, transmission: 0.68, transparent: true, opacity: 0.46, metalness: 0.14, roughness: 0.05 });
        const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xc9a66b, metalness: 0.9, roughness: 0.1 });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.5 });
        const DARK_METAL_DAY = 0x111111;
        const DARK_METAL_NIGHT = 0x05080f;

        var storeGroups = {}; // Registro global principal por codigo visible
        const allStoreGroups = []; // Incluye duplicados visuales que comparten codigo
        const storeGroupCollections = {};
        const physicalSpaceInventory = [];
        const physicalSpaceById = {};

        function registerStoreGroup(code, group) {
            if (!group) return;
            allStoreGroups.push(group);
            if (!code) return;
            if (!storeGroupCollections[code]) storeGroupCollections[code] = [];
            storeGroupCollections[code].push(group);
            if (!storeGroups[code]) storeGroups[code] = group;
        }

        function getStoreGroupCollection(code) {
            return storeGroupCollections[code] || [];
        }

        function getSignedSectorKey(sx, sz) {
            return `${sx > 0 ? 'xp' : 'xn'}_${sz > 0 ? 'zp' : 'zn'}`;
        }

        function buildBoutiquePhysicalSpaceId(floor, sx, sz, axis, slotIndex) {
            return `phys_b_f${floor}_${getSignedSectorKey(sx, sz)}_${axis}_${String(slotIndex).padStart(2, '0')}`;
        }

        function buildAnchorPhysicalSpaceId(posX, posZ) {
            if (Math.abs(posZ) > Math.abs(posX)) return `phys_anchor_${posZ > 0 ? 'zp' : 'zn'}`;
            return `phys_anchor_${posX > 0 ? 'xp' : 'xn'}`;
        }

        const PHYSICAL_SPACE_PLATE_OVERRIDES = {
            // Brazo norte, primer piso: laterales del brazo.
            // Impares en el costado derecho del brazo, pares al frente, excluyendo esquinas especiales.
            phys_b_f1_xp_zp_vertical_05: 'N-101',
            phys_b_f1_xn_zp_vertical_05: 'N-102',
            phys_b_f1_xp_zp_vertical_04: 'N-103',
            phys_b_f1_xn_zp_vertical_04: 'N-104',
            phys_b_f1_xp_zp_vertical_03: 'N-105',
            phys_b_f1_xn_zp_vertical_03: 'N-106',
            phys_b_f1_xp_zp_vertical_02: 'N-107',
            phys_b_f1_xn_zp_vertical_02: 'N-108',

            // Brazo este corregido, primer piso: laterales del brazo.
            // Impares en el costado norte del brazo, pares en el costado sur, excluyendo esquinas especiales.
            phys_b_f1_xn_zp_horizontal_01: 'EN-10',
            phys_b_f1_xn_zp_vertical_01: 'EN-10',
            phys_b_f1_xp_zp_horizontal_01: 'NO-10',
            phys_b_f1_xp_zp_vertical_01: 'NO-10',
            phys_b_f1_xn_zp_horizontal_05: 'E-101',
            phys_b_f1_xn_zn_horizontal_05: 'E-102',
            phys_b_f1_xn_zp_horizontal_04: 'E-103',
            phys_b_f1_xn_zn_horizontal_04: 'E-104',
            phys_b_f1_xn_zp_horizontal_03: 'E-105',
            phys_b_f1_xn_zn_horizontal_03: 'E-106',
            phys_b_f1_xn_zp_horizontal_02: 'E-107',
            phys_b_f1_xn_zn_horizontal_02: 'E-108',

            // Brazo sur, segundo piso: comenzamos la reasignacion del brazo completo.
            phys_b_f2_xn_zn_horizontal_01: 'SE-20',
            phys_b_f2_xn_zn_vertical_01: 'SE-20',
            phys_b_f2_xn_zn_vertical_02: 'S-209',
            phys_b_f2_xn_zn_vertical_03: 'S-207',
            phys_b_f2_xn_zn_vertical_04: 'S-205',
            phys_b_f2_xp_zn_horizontal_01: 'OS-20',
            phys_b_f2_xp_zn_vertical_01: 'OS-20',
            phys_b_f2_xp_zn_vertical_02: 'S-210',
            phys_b_f2_xp_zn_vertical_03: 'S-208',
            phys_b_f2_xp_zn_vertical_04: 'S-206',
            phys_b_f2_xp_zn_vertical_05: 'S-204',
            phys_b_f2_xn_zn_vertical_07: 'S-201',
            phys_b_f2_xn_zn_vertical_06: 'S-201',
            phys_b_f2_xn_zn_vertical_05: 'S-203',
            phys_b_f2_xp_zn_vertical_07: 'S-202',
            phys_b_f2_xp_zn_vertical_06: 'S-202',

            // Brazo este, segundo piso: misma logica del sur.
            // Costado superior con impares, costado inferior con pares, y fusion de los dos locales exteriores.
            phys_b_f2_xn_zp_horizontal_07: 'E-201',
            phys_b_f2_xn_zp_horizontal_06: 'E-201',
            phys_b_f2_xn_zp_horizontal_05: 'E-203',
            phys_b_f2_xn_zp_horizontal_04: 'E-205',
            phys_b_f2_xn_zp_horizontal_03: 'E-207',
            phys_b_f2_xn_zp_horizontal_02: 'E-209',
            phys_b_f2_xn_zp_horizontal_01: 'EN-20',
            phys_b_f2_xn_zp_vertical_01: 'EN-20',
            phys_b_f2_xn_zn_horizontal_07: 'E-202',
            phys_b_f2_xn_zn_horizontal_06: 'E-202',
            phys_b_f2_xn_zn_horizontal_05: 'E-204',
            phys_b_f2_xn_zn_horizontal_04: 'E-206',
            phys_b_f2_xn_zn_horizontal_03: 'E-208',
            phys_b_f2_xn_zn_horizontal_02: 'E-210',

            // Brazo norte, segundo piso: misma logica del sur.
            // Costado derecho con impares, costado izquierdo con pares, y fusion de los dos locales exteriores.
            phys_b_f2_xp_zp_horizontal_01: 'NO-20',
            phys_b_f2_xp_zp_vertical_01: 'NO-20',
            phys_b_f2_xp_zp_vertical_07: 'N-201',
            phys_b_f2_xp_zp_vertical_06: 'N-201',
            phys_b_f2_xp_zp_vertical_05: 'N-203',
            phys_b_f2_xp_zp_vertical_04: 'N-205',
            phys_b_f2_xp_zp_vertical_03: 'N-207',
            phys_b_f2_xp_zp_vertical_02: 'N-209',
            phys_b_f2_xn_zp_vertical_07: 'N-202',
            phys_b_f2_xn_zp_vertical_06: 'N-202',
            phys_b_f2_xn_zp_vertical_05: 'N-204',
            phys_b_f2_xn_zp_vertical_04: 'N-206',
            phys_b_f2_xn_zp_vertical_03: 'N-208',
            phys_b_f2_xn_zp_vertical_02: 'N-210',

            // Brazo oeste, segundo piso: espejo del brazo este.
            // Costado superior con pares, costado inferior con impares, y fusion de los dos locales exteriores.
            phys_b_f2_xp_zp_horizontal_07: 'O-202',
            phys_b_f2_xp_zp_horizontal_06: 'O-202',
            phys_b_f2_xp_zp_horizontal_05: 'O-204',
            phys_b_f2_xp_zp_horizontal_04: 'O-206',
            phys_b_f2_xp_zp_horizontal_03: 'O-208',
            phys_b_f2_xp_zp_horizontal_02: 'O-210',
            phys_b_f2_xp_zn_horizontal_07: 'O-201',
            phys_b_f2_xp_zn_horizontal_06: 'O-201',
            phys_b_f2_xp_zn_horizontal_05: 'O-203',
            phys_b_f2_xp_zn_horizontal_04: 'O-205',
            phys_b_f2_xp_zn_horizontal_03: 'O-207',
            phys_b_f2_xp_zn_horizontal_02: 'O-209'
        };

        function resolvePhysicalPlateCode(physicalSpaceId, fallbackCode) {
            return PHYSICAL_SPACE_PLATE_OVERRIDES[physicalSpaceId] || fallbackCode;
        }

        function registerPhysicalSpace(group, physicalMeta = {}) {
            if (!group) return;
            const requestedId = physicalMeta.id || `physical_space_${physicalSpaceInventory.length + 1}`;
            const id = physicalSpaceById[requestedId] ? `${requestedId}__dup${physicalSpaceInventory.length + 1}` : requestedId;
            const record = {
                id,
                kind: physicalMeta.kind || 'boutique',
                floor: physicalMeta.floor || 0,
                axis: physicalMeta.axis || '',
                quadrant: physicalMeta.quadrant || '',
                slotIndex: physicalMeta.slotIndex || 0,
                wing: physicalMeta.wing || '',
                generatedCode: physicalMeta.generatedCode || '',
                displayCode: physicalMeta.displayCode || physicalMeta.generatedCode || '',
                sizeClass: physicalMeta.sizeClass || '',
                width: physicalMeta.width || 0,
                depth: physicalMeta.depth || 0,
                height: physicalMeta.height || 0,
                posX: Number(group.position.x.toFixed(2)),
                posY: Number(group.position.y.toFixed(2)),
                posZ: Number(group.position.z.toFixed(2)),
                rotationY: Number(group.rotation.y.toFixed(4))
            };
            physicalSpaceInventory.push(record);
            physicalSpaceById[id] = record;
            group.userData.physicalSpaceId = id;
            group.userData.physicalSpaceMeta = record;
            refreshPhysicalInventoryExports();
        }

        function refreshPhysicalInventoryExports() {
            const summary = physicalSpaceInventory.reduce((acc, item) => {
                acc.total += 1;
                if (item.kind === 'anchor') acc.anchors += 1;
                if (item.kind === 'boutique') acc.boutiques += 1;
                if (item.floor === 1) acc.floor1 += 1;
                if (item.floor === 2) acc.floor2 += 1;
                acc.byKind[item.kind] = (acc.byKind[item.kind] || 0) + 1;
                acc.byFloor[item.floor] = (acc.byFloor[item.floor] || 0) + 1;
                if (item.axis) acc.byAxis[item.axis] = (acc.byAxis[item.axis] || 0) + 1;
                if (item.quadrant) acc.byQuadrant[item.quadrant] = (acc.byQuadrant[item.quadrant] || 0) + 1;
                return acc;
            }, { total: 0, anchors: 0, boutiques: 0, floor1: 0, floor2: 0, byKind: {}, byFloor: {}, byAxis: {}, byQuadrant: {} });
            window.__mallPhysicalInventory = physicalSpaceInventory;
            window.__mallPhysicalInventoryById = physicalSpaceById;
            window.__mallPhysicalInventorySummary = summary;
            window.getMallPhysicalInventorySummary = () => window.__mallPhysicalInventorySummary;
            window.getPhysicalSpaceById = (id) => window.__mallPhysicalInventoryById[id] || null;
            window.getPhysicalSpacesByDisplayCode = (displayCode) => window.__mallPhysicalInventory.filter((item) => item.displayCode === displayCode);
        }




        function createSignTexture(text, isID = false) {
            const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
            const ctx = canvas.getContext('2d');
            if (isID) {
                ctx.fillStyle = '#000000'; ctx.font = 'bold 200px "Inter"';
            } else {
                ctx.fillStyle = '#c9a66b'; ctx.font = 'bold 120px "Cormorant Garamond"';
            }
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(text, canvas.width / 2, canvas.height / 2);
            return new THREE.CanvasTexture(canvas);
        }

