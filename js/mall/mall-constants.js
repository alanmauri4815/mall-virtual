        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xaabbcc);
        const catalogClickTargets = [];
        const MALL_PEDESTRIAN_WALK_SPEED = 0.22 * 60;
        const IS_COARSE_POINTER = window.matchMedia('(pointer: coarse)').matches;
        const DEVICE_MEMORY_GB = Number(navigator.deviceMemory) || null;
        const CPU_CORE_COUNT = Number(navigator.hardwareConcurrency) || null;
        const ANDROID_VERSION_MATCH = String(navigator.userAgent || '').match(/Android\s+(\d+)/i);
        const ANDROID_VERSION_MAJOR = ANDROID_VERSION_MATCH ? Number(ANDROID_VERSION_MATCH[1]) : null;
        const IS_LEGACY_ANDROID = ANDROID_VERSION_MAJOR !== null && ANDROID_VERSION_MAJOR <= 11;
        const IS_LOW_END_MOBILE = IS_COARSE_POINTER && (
            (DEVICE_MEMORY_GB !== null && DEVICE_MEMORY_GB <= 4)
            || (CPU_CORE_COUNT !== null && CPU_CORE_COUNT <= 4)
            || (DEVICE_MEMORY_GB === null && CPU_CORE_COUNT === null)
            || IS_LEGACY_ANDROID
        );
        const MALL_PERFORMANCE_PROFILE = Object.freeze({
            isMobile: IS_COARSE_POINTER,
            isLowEndMobile: IS_LOW_END_MOBILE,
            pixelRatioCap: IS_LOW_END_MOBILE ? 0.6 : (IS_COARSE_POINTER ? 1.0 : 1.3),
            targetFrameIntervalMs: IS_LOW_END_MOBILE ? (1000 / 24) : 0,
            npcCount: IS_LOW_END_MOBILE ? 4 : (IS_COARSE_POINTER ? 30 : 40),
            textureScale: IS_LOW_END_MOBILE ? 0.5 : 1
        });
        window.mallPerformanceProfile = MALL_PERFORMANCE_PROFILE;
        document.documentElement.classList.toggle('mall-low-end-device', IS_LOW_END_MOBILE);
        const mallBoxGeometryCache = new Map();
        const mallPlaneGeometryCache = new Map();
        function getMallBoxGeometry(width, height, depth) {
            const key = [width, height, depth].map(value => Number(value).toFixed(3)).join('|');
            if (!mallBoxGeometryCache.has(key)) {
                const geometry = new THREE.BoxGeometry(width, height, depth);
                geometry.userData.mallSharedGeometry = true;
                mallBoxGeometryCache.set(key, geometry);
            }
            return mallBoxGeometryCache.get(key);
        }
        function getMallPlaneGeometry(width, height) {
            const key = [width, height].map(value => Number(value).toFixed(3)).join('|');
            if (!mallPlaneGeometryCache.has(key)) {
                const geometry = new THREE.PlaneGeometry(width, height);
                geometry.userData.mallSharedGeometry = true;
                mallPlaneGeometryCache.set(key, geometry);
            }
            return mallPlaneGeometryCache.get(key);
        }
        window.getMallGeometryCacheStats = () => ({ boxes: mallBoxGeometryCache.size, planes: mallPlaneGeometryCache.size });
        const FOG_PROFILE_OUTSIDE = { near: IS_COARSE_POINTER ? 16 : 22, far: IS_COARSE_POINTER ? 130 : 190 };
        const FOG_PROFILE_STORE_INSIDE = { near: IS_COARSE_POINTER ? 34 : 42, far: IS_COARSE_POINTER ? 220 : 320 };
        scene.fog = new THREE.Fog(0xaabbcc, FOG_PROFILE_OUTSIDE.near, FOG_PROFILE_OUTSIDE.far);

        const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1500);
        camera.position.set(45, 45, 45);

        const renderer = new THREE.WebGLRenderer({
            antialias: !IS_LOW_END_MOBILE,
            powerPreference: IS_LOW_END_MOBILE ? 'low-power' : 'high-performance',
            preserveDrawingBuffer: false
        });
        window.mallPublicDisplayRuntime = { scene, camera, renderer };
        const getPreferredPixelRatio = () => {
            return Math.min(window.devicePixelRatio || 1, MALL_PERFORMANCE_PROFILE.pixelRatioCap);
        };
        const syncRendererViewport = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(getPreferredPixelRatio());
        };
        // A filmic response preserves the bright roof while retaining contrast in the mall interior.
        if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping || THREE.ReinhardToneMapping;
        renderer.toneMappingExposure = 0.94;
        renderer.shadowMap.enabled = !IS_LOW_END_MOBILE;
        if (renderer.shadowMap.enabled && THREE.PCFSoftShadowMap) {
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        window.setMallShadowMode = (root, { cast = true, receive = false } = {}) => {
            if (!root?.traverse || !renderer.shadowMap.enabled) return;
            root.traverse((object) => {
                if (!object?.isMesh) return;
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                const isTransparent = materials.some((material) => material?.transparent && material.opacity < 0.96);
                object.castShadow = Boolean(cast && !isTransparent);
                object.receiveShadow = Boolean(receive);
            });
        };
        syncRendererViewport();
        document.getElementById('canvas-container').appendChild(renderer.domElement);
        renderer.domElement.setAttribute('tabindex', '0');
        renderer.domElement.style.outline = 'none';
        let mallWebGLContextLost = false;
        renderer.domElement.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            mallWebGLContextLost = true;
            document.documentElement.classList.add('mall-webgl-context-lost');
            console.warn('El contexto WebGL se perdió. El mall pausó el render mientras el navegador recupera la GPU.');
        }, false);
        renderer.domElement.addEventListener('webglcontextrestored', () => {
            mallWebGLContextLost = false;
            document.documentElement.classList.remove('mall-webgl-context-lost');
            renderer.resetState?.();
            syncRendererViewport();
            console.info('Contexto WebGL recuperado.');
        }, false);
        window.isMallWebGLContextLost = () => mallWebGLContextLost;

        const MALL_RUNTIME_CHECKPOINT_KEY = window.mallContext?.storageKey('mall-runtime-checkpoint-v1') || 'mall-runtime-checkpoint-v1';
        const runtimeStageLabels = Object.freeze({
            startup: 'inicio del mall',
            idle: 'recorrido general',
            render: 'dibujo de la escena 3D',
            'boutique-streaming': 'carga o descarga de locales cercanos',
            'anchor-streaming': 'carga de tiendas ancla',
            'store-attendants': 'carga de asistentes de tiendas',
            'store-visual-load': 'consulta del contenido de una tienda',
            'store-visual-apply': 'carga de fotos y vitrinas de una tienda',
            npcs: 'actualización de visitantes virtuales',
            'other-players': 'actualización multijugador'
        });
        let runtimeStage = 'startup';
        let runtimeDetail = null;
        let runtimeLastAction = null;
        let lastRuntimeCheckpointAt = 0;

        function readRuntimeCheckpoint() {
            try {
                return JSON.parse(localStorage.getItem(MALL_RUNTIME_CHECKPOINT_KEY) || 'null');
            } catch (_) {
                return null;
            }
        }

        const previousRuntimeCheckpoint = readRuntimeCheckpoint();

        function writeRuntimeCheckpoint(now = Date.now(), force = false) {
            if (!MALL_PERFORMANCE_PROFILE.isMobile) return;
            if (!force && now - lastRuntimeCheckpointAt < 1200) return;
            lastRuntimeCheckpointAt = now;
            const rendererInfo = renderer.info || {};
            try {
                localStorage.setItem(MALL_RUNTIME_CHECKPOINT_KEY, JSON.stringify({
                    active: true,
                    timestamp: now,
                    stage: runtimeStage,
                    detail: runtimeDetail,
                    lastAction: runtimeLastAction,
                    camera: {
                        x: Number(camera.position.x.toFixed(1)),
                        y: Number(camera.position.y.toFixed(1)),
                        z: Number(camera.position.z.toFixed(1))
                    },
                    memory: {
                        geometries: Number(rendererInfo.memory?.geometries || 0),
                        textures: Number(rendererInfo.memory?.textures || 0)
                    },
                    render: {
                        calls: Number(rendererInfo.render?.calls || 0),
                        triangles: Number(rendererInfo.render?.triangles || 0)
                    },
                    profile: MALL_PERFORMANCE_PROFILE.isLowEndMobile ? 'low-end-mobile' : 'mobile'
                }));
            } catch (_) {}
        }

        function markRuntimeCheckpointClean() {
            const checkpoint = readRuntimeCheckpoint();
            if (!checkpoint) return;
            checkpoint.active = false;
            checkpoint.timestamp = Date.now();
            try { localStorage.setItem(MALL_RUNTIME_CHECKPOINT_KEY, JSON.stringify(checkpoint)); } catch (_) {}
        }

        window.mallRuntimeMonitor = Object.freeze({
            enter(stage, detail = null, force = false) {
                runtimeStage = stage || 'idle';
                runtimeDetail = detail;
                if (force) runtimeLastAction = { stage: runtimeStage, detail, timestamp: Date.now() };
                writeRuntimeCheckpoint(Date.now(), force);
            },
            heartbeat(now = Date.now()) {
                writeRuntimeCheckpoint(now);
            },
            getLastCheckpoint: readRuntimeCheckpoint
        });
        window.addEventListener('pagehide', markRuntimeCheckpointClean);
        window.addEventListener('beforeunload', markRuntimeCheckpointClean);
        writeRuntimeCheckpoint(Date.now(), true);

        if (
            MALL_PERFORMANCE_PROFILE.isMobile
            && previousRuntimeCheckpoint?.active
            && Date.now() - Number(previousRuntimeCheckpoint.timestamp || 0) > 2500
            && Date.now() - Number(previousRuntimeCheckpoint.timestamp || 0) < 12 * 60 * 60 * 1000
        ) {
            setTimeout(() => {
                const notice = document.createElement('div');
                notice.className = 'mall-runtime-diagnostic';
                notice.setAttribute('role', 'status');
                const priorAction = previousRuntimeCheckpoint.lastAction;
                const diagnosticStage = priorAction?.stage || previousRuntimeCheckpoint.stage;
                const diagnosticDetail = priorAction?.detail || previousRuntimeCheckpoint.detail;
                const stageLabel = runtimeStageLabels[diagnosticStage] || diagnosticStage || 'proceso no identificado';
                const storeCode = diagnosticDetail?.storeCode ? ` (${diagnosticDetail.storeCode})` : '';
                const message = document.createElement('span');
                message.textContent = `El recorrido anterior se interrumpió después de: ${stageLabel}${storeCode}. Diagnóstico guardado.`;
                const closeButton = document.createElement('button');
                closeButton.type = 'button';
                closeButton.setAttribute('aria-label', 'Cerrar diagnóstico');
                closeButton.textContent = '×';
                closeButton.addEventListener('click', () => notice.remove());
                notice.append(message, closeButton);
                document.body.appendChild(notice);
                setTimeout(() => notice.remove(), 12000);
            }, 800);
        }
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
        const WALK_SPAWN = new THREE.Vector3(11.93, 1.95, -0.12);
        const WALK_LOOK_TARGET = new THREE.Vector3(11.913, 1.95, -0.144);
        // Calibrated from the administrator locator: a similar viewpoint keeps
        // the complete information module visible without entering the fountain.
        const INFORMATION_DESK_VISITOR_SPAWN = new THREE.Vector3(-9.90, 1.95, -0.22);
        // The target remains on the information module, so the lateral safety
        // offset does not leave the visitor looking away from Mauricio.
        const INFORMATION_DESK_VISITOR_TARGET = new THREE.Vector3(-16.75, 1.82, 0.00);
        const FIRST_FLOOR_LATERAL_ENTRANCES = Object.freeze([
            {
                position: [-23.80, 1.8, 88.80],
                releasePosition: [-15.00, 1.8, 88.80],
                target: [0.00, 1.8, 88.80],
                signPosition: [-35.00, 4.55, 86.95],
                signRotationY: Math.PI / 2,
                exact: true
            },
            { position: [23.94, 1.8, 85.33], target: [23.94, 1.8, 74], signPosition: [35.00, 4.55, 86.85], signRotationY: Math.PI / 2, exact: true },
            { position: [88.21, 1.8, 24.04], target: [76, 1.8, 24.04], signPosition: [86.95, 4.55, 34.90], signRotationY: 0, exact: true },
            { position: [85.33, 1.8, -24.04], target: [74, 1.8, -24.04], signPosition: [86.95, 4.55, -34.90], signRotationY: 0, exact: true },
            { position: [24.17, 1.8, -88.43], target: [24.17, 1.8, -76], signPosition: [34.50, 4.55, -86.85], signRotationY: Math.PI / 2, exact: true },
            { position: [-24.09, 1.8, -85.25], target: [-24.09, 1.8, -74], signPosition: [-35.00, 4.55, -86.95], signRotationY: Math.PI / 2, exact: true },
            { position: [-88.18, 1.8, -24.09], target: [-76, 1.8, -24.09], signPosition: [-86.95, 4.55, -34.90], signRotationY: 0, exact: true },
            { position: [-84.94, 1.8, 24.27], target: [-74, 1.8, 24.27], signPosition: [-86.95, 4.55, 34.90], signRotationY: 0, exact: true }
        ]);
        const ENTRY_SPAWN_POINTS = Object.freeze({
            makers: [
                // Validacion controlada: incorporaremos los accesos restantes uno a uno.
                FIRST_FLOOR_LATERAL_ENTRANCES[0]
            ],
            retail: [
                { position: [-14, 7.1, -18], target: [0, 6.8, 6] },
                { position: [-13, 7.1, 72], target: [-13, 6.8, 52] },
                { position: [13, 7.1, 72], target: [13, 6.8, 52] },
                { position: [-13, 7.1, -72], target: [-13, 6.8, -52] },
                { position: [13, 7.1, -72], target: [13, 6.8, -52] },
                { position: [72, 7.1, -13], target: [52, 6.8, -13] },
                { position: [72, 7.1, 13], target: [52, 6.8, 13] },
                { position: [-72, 7.1, -13], target: [-52, 6.8, -13] },
                { position: [-72, 7.1, 13], target: [-52, 6.8, 13] }
            ]
        });
        let entryShoppingPreference = '';
        function isSupportedVisitorSpawnPosition(position) {
            const x = Number(position?.x);
            const y = Number(position?.y);
            const z = Number(position?.z);
            if (![x, y, z].every(Number.isFinite)) return false;

            // En planta baja no existen vacios de atrio; las colisiones deciden
            // si el punto concreto es utilizable. En planta alta exigimos losa.
            if (y < 5) return true;

            const absX = Math.abs(x);
            const absZ = Math.abs(z);
            const atriumEdge = 9;
            const storefrontEdge = 17;
            const anchorAccessStart = 83;
            const anchorAccessEnd = 95;
            const safetyMargin = 0.35;
            const walkwayInner = atriumEdge + safetyMargin;
            const walkwayOuter = storefrontEdge - safetyMargin;

            const onNorthSouthWalkway = absX >= walkwayInner
                && absX <= walkwayOuter
                && absZ <= anchorAccessEnd;
            const onEastWestWalkway = absZ >= walkwayInner
                && absZ <= walkwayOuter
                && absX <= anchorAccessEnd;
            const inNorthSouthAnchorVestibule = absZ >= anchorAccessStart
                && absZ <= anchorAccessEnd
                && absX <= walkwayOuter;
            const inEastWestAnchorVestibule = absX >= anchorAccessStart
                && absX <= anchorAccessEnd
                && absZ <= walkwayOuter;

            return onNorthSouthWalkway
                || onEastWestWalkway
                || inNorthSouthAnchorVestibule
                || inEastWestAnchorVestibule;
        }

        function resolveWalkableSpawnPosition(basePosition) {
            const radii = [0, 0.9, 1.8, 2.8, 4.0, 5.5];
            const directions = 16;
            for (const radius of radii) {
                if (radius === 0) {
                    if (isSupportedVisitorSpawnPosition(basePosition)
                        && !checkCollision(basePosition.x, basePosition.y, basePosition.z, { ignoreActorId: '__local__' })) {
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
                    if (isSupportedVisitorSpawnPosition(candidate)
                        && !checkCollision(candidate.x, candidate.y, candidate.z, { ignoreActorId: '__local__' })) {
                        return candidate;
                    }
                }
            }
            if (isSupportedVisitorSpawnPosition(basePosition)) return basePosition.clone();
            return WALK_SPAWN.clone();
        }
        function getEntryControlsTarget(position, lookPoint) {
            if (!position || !lookPoint) return lookPoint?.clone?.() || lookPoint;
            const direction = lookPoint.clone().sub(position);
            if (direction.lengthSq() < 0.000001) return lookPoint.clone();

            // OrbitControls clamps the camera to maxDistance in walk mode. Use
            // a short target in the desired direction instead of the distant
            // visual target, otherwise update() moves the camera into Mauricio.
            const minDistance = Number.isFinite(controls?.minDistance) ? controls.minDistance : 0.01;
            const maxDistance = Number.isFinite(controls?.maxDistance) ? controls.maxDistance : 0.05;
            if (isWalking && maxDistance <= 0.2) {
                const targetDistance = THREE.MathUtils.clamp(maxDistance * 0.8, minDistance + 0.005, maxDistance);
                return position.clone().add(direction.normalize().multiplyScalar(targetDistance));
            }
            return lookPoint.clone();
        }
        const chooseEntrySpawnPoint = () => {
            // Validacion controlada: hasta aprobar cada acceso, todo ingreso no
            // locatario usa exclusivamente el primer punto indicado por admin.
            return ENTRY_SPAWN_POINTS.makers[0];
        };
        let activeEntrySpawnPoint = null;
        function resetMallEntrySpawnPoint() {
            activeEntrySpawnPoint = null;
        }
        const forceEntrySpawn = () => {
            if (!activeEntrySpawnPoint) activeEntrySpawnPoint = chooseEntrySpawnPoint();
            const point = activeEntrySpawnPoint;
            // `position` identifies the physical portal. `releasePosition` is a
            // verified walkable point where control can safely pass to the user.
            const requestedPosition = new THREE.Vector3(...(point.releasePosition || point.position));
            const spawnPos = point.exact
                ? requestedPosition
                : resolveWalkableSpawnPosition(requestedPosition);
            const lookTarget = new THREE.Vector3(...point.target);
            if (point.exact && Number.isFinite(controls.maxPolarAngle) && controls.maxPolarAngle < Math.PI / 2) {
                const horizontalLookDistance = Math.hypot(lookTarget.x - spawnPos.x, lookTarget.z - spawnPos.z);
                lookTarget.y = spawnPos.y - horizontalLookDistance / Math.tan(controls.maxPolarAngle);
            }
            const controlTarget = getEntryControlsTarget(spawnPos, lookTarget);
            camera.position.copy(spawnPos);
            controls.target.copy(controlTarget);
            controls.update();
            camera.position.copy(spawnPos);
            controls.target.copy(controlTarget);
            document.body.dataset.mallEntryDestination = 'assigned-entry';
            document.body.dataset.mallEntryX = spawnPos.x.toFixed(2);
            document.body.dataset.mallEntryY = spawnPos.y.toFixed(2);
            document.body.dataset.mallEntryZ = spawnPos.z.toFixed(2);
        };
        const forceInformationDeskVisitorSpawn = () => {
            const spawnPos = resolveWalkableSpawnPosition(INFORMATION_DESK_VISITOR_SPAWN);
            const controlTarget = getEntryControlsTarget(spawnPos, INFORMATION_DESK_VISITOR_TARGET);
            camera.position.copy(spawnPos);
            controls.target.copy(controlTarget);
            controls.update();
            camera.position.copy(spawnPos);
            controls.target.copy(controlTarget);
            document.body.dataset.mallEntryDestination = 'information-desk';
            document.body.dataset.mallEntryX = spawnPos.x.toFixed(2);
            document.body.dataset.mallEntryY = spawnPos.y.toFixed(2);
            document.body.dataset.mallEntryZ = spawnPos.z.toFixed(2);
        };
        window.setMallEntryShoppingPreference = (value = '') => {
            entryShoppingPreference = ['makers', 'retail', 'surprise'].includes(value) ? value : '';
            activeEntrySpawnPoint = null;
        };
        window.hasExplicitMallEntryPreference = () => Boolean(entryShoppingPreference);

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
            const canUseAerialView = typeof window.mallCanUseBenefit !== 'function'
                || window.mallCanUseBenefit('aerial');
            btn.innerText = isWalking
                ? (canUseAerialView ? "Cambiar a Modo Aéreo" : "Vista aérea · solo inscritos")
                : "Cambiar a Modo Paseo";
            btn.setAttribute('aria-disabled', isWalking && !canUseAerialView ? 'true' : 'false');
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
            if (isElementActuallyVisible(document.getElementById('member-benefits-modal'))) return false;
            if (isElementActuallyVisible(document.getElementById('password-recovery-modal'))) return false;
            if (isElementActuallyVisible(document.getElementById('tenant-password-setup-modal'))) return false;
            return true;
        }

        function ensureWalkModeActive() {
            if (!hasEnteredMall || !lockWalkModePreference) return;
            if (isWalking) return;
            window.toggleWalkMode();
        }

        window.toggleWalkMode = function (options = {}) {
            const preservePosition = options?.preservePosition === true;
            if (
                isWalking
                && typeof window.mallCanUseBenefit === 'function'
                && !window.mallCanUseBenefit('aerial')
            ) {
                window.showMemberBenefitRequired?.('vista aérea');
                closeControlsMenu();
                return;
            }
            isWalking = !isWalking;
            lockWalkModePreference = isWalking;
            if (isWalking) {
                scene.fog = new THREE.Fog(0xaabbcc, FOG_PROFILE_OUTSIDE.near, FOG_PROFILE_OUTSIDE.far);
                if (!preservePosition) {
                    camera.position.copy(resolveWalkableSpawnPosition(WALK_SPAWN));
                    controls.target.copy(WALK_LOOK_TARGET);
                }
                controls.enablePan = false;
                controls.enableRotate = !IS_COARSE_POINTER;
                controls.enableZoom = !IS_COARSE_POINTER;
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
                controls.enableRotate = true;
                controls.enableZoom = true;
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
        controls.dampingFactor = IS_COARSE_POINTER ? 0.24 : 0.2;
        controls.rotateSpeed = IS_COARSE_POINTER ? -0.75 : 1.0;
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = Math.PI / 2 - 0.05;

        const ambientLight = new THREE.AmbientLight(0xfff7eb, 0.5);
        scene.add(ambientLight);
        const hemisphereLight = new THREE.HemisphereLight(0xdcecff, 0x5c554b, 0.84);
        scene.add(hemisphereLight);
        const sun = new THREE.DirectionalLight(0xffedd2, 1.55);
        sun.position.set(105, 180, 80);
        sun.castShadow = renderer.shadowMap.enabled;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.near = 15;
        sun.shadow.camera.far = 420;
        sun.shadow.camera.left = -115;
        sun.shadow.camera.right = 115;
        sun.shadow.camera.top = 115;
        sun.shadow.camera.bottom = -115;
        sun.shadow.bias = -0.00035;
        sun.shadow.normalBias = 0.035;
        scene.add(sun);
        scene.add(sun.target);
        const roofGlassMeshes = [];

        const glassMat = new THREE.MeshPhysicalMaterial({
            color: 0xdcecff,
            transmission: 0.42,
            transparent: true,
            opacity: 0.58,
            metalness: 0.02,
            roughness: 0.12,
            clearcoat: 0.32,
            clearcoatRoughness: 0.16
        });
        const roofGlassMat = new THREE.MeshPhysicalMaterial({
            color: 0xc9def3,
            transmission: 0.62,
            transparent: true,
            opacity: 0.38,
            metalness: 0.02,
            roughness: 0.16,
            clearcoat: 0.28,
            clearcoatRoughness: 0.2
        });
        const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf3f0ea, roughness: 0.72, metalness: 0.01 });
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xb58b47, metalness: 0.72, roughness: 0.3 });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.28, metalness: 0.68 });
        const DARK_METAL_DAY = 0x111111;
        const DARK_METAL_NIGHT = 0x05080f;

        var storeGroups = {}; // Registro global principal por codigo visible
        const allStoreGroups = []; // Incluye duplicados visuales que comparten codigo
        const storeGroupCollections = {};
        const physicalSpaceInventory = [];
        const physicalSpaceById = {};

        function registerStoreGroup(code, group) {
            if (!group) return;
            if (!allStoreGroups.includes(group)) allStoreGroups.push(group);
            const rawCode = String(code || "").trim();
            if (!rawCode) return;
            const compactCode = rawCode.replace(/-/g, "");
            const hyphenatedCode = compactCode.replace(/^([A-Z]+)(\d+)$/i, "$1-$2").toUpperCase();
            const aliases = [...new Set([
                rawCode,
                rawCode.toUpperCase(),
                compactCode,
                compactCode.toUpperCase(),
                hyphenatedCode
            ].filter(Boolean))];
            aliases.forEach((alias) => {
                if (!storeGroupCollections[alias]) storeGroupCollections[alias] = [];
                if (!storeGroupCollections[alias].includes(group)) storeGroupCollections[alias].push(group);
                if (!storeGroups[alias]) storeGroups[alias] = group;
            });
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
            // Esquina sur-este: ambos paños físicos forman un único local.
            // Evita que el paño horizontal herede el antiguo código OS-10.
            phys_b_f1_xn_zn_horizontal_01: 'SE-10',
            phys_b_f1_xn_zn_vertical_01: 'SE-10',
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




        function createSignTexture(text, isID = false, style = 'default') {
            const textureScale = MALL_PERFORMANCE_PROFILE.textureScale;
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(1024 * textureScale);
            canvas.height = Math.round(256 * textureScale);
            const ctx = canvas.getContext('2d');
            if (style === 'anchor') {
                ctx.fillStyle = '#0b0b0b';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.strokeStyle = '#d2ae62';
                ctx.lineWidth = 12 * textureScale;
                ctx.strokeRect(16 * textureScale, 16 * textureScale, canvas.width - 32 * textureScale, canvas.height - 32 * textureScale);
                ctx.shadowColor = 'rgba(245, 217, 149, 0.8)';
                ctx.shadowBlur = 18 * textureScale;
                ctx.fillStyle = '#f5d995';
                ctx.font = `bold ${Math.round(154 * textureScale)}px Arial, sans-serif`;
                while (ctx.measureText(text).width > canvas.width - 120 * textureScale) {
                    const currentSize = parseInt(ctx.font.match(/\d+/)?.[0] || '154', 10);
                    ctx.font = `bold ${Math.max(Math.round(92 * textureScale), currentSize - Math.max(4, Math.round(8 * textureScale)))}px Arial, sans-serif`;
                }
            } else if (isID) {
                ctx.fillStyle = '#000000'; ctx.font = `bold ${Math.round(200 * textureScale)}px "Inter"`;
            } else {
                ctx.fillStyle = '#c9a66b'; ctx.font = `bold ${Math.round(120 * textureScale)}px "Cormorant Garamond"`;
            }
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(text, canvas.width / 2, canvas.height / 2);
            return new THREE.CanvasTexture(canvas);
        }

