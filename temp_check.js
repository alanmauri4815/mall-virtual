
        // --- MOTOR DE COLISIONES PRO (CON ALTURA) ---
        const colliders = [];
        function registerCollider(x, z, w, d, minY = -5, maxY = 50) {
            colliders.push({
                minX: x - w / 2, maxX: x + w / 2,
                minZ: z - d / 2, maxZ: z + d / 2,
                minY, maxY
            });
        }
        function checkCollision(nx, ny, nz) {
            for (let c of colliders) {
                if (nx > c.minX && nx < c.maxX && nz > c.minZ && nz < c.maxZ && ny > c.minY && ny < c.maxY) return true;
            }
            return false;
        }

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

        let isWalking = false;
        let controlsMenuOpen = false;
        let currentModalStoreCode = "";
        let currentModalStoreId = "";
        let currentModalStoreData = null;
        let lockWalkModePreference = true;
        const WALK_SPAWN = new THREE.Vector3(0, 1.7, -8.5);
        const WALK_LOOK_TARGET = new THREE.Vector3(0, 1.8, -40.0);

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
                camera.position.copy(WALK_SPAWN); // Spawn cercano al atrio para mejor orientación inicial
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
                controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI;
                controls.minDistance = 1; controls.maxDistance = 500;
                document.getElementById('mobile-controls-container').style.display = 'none';
            }
            syncWalkModeButton();
            closeControlsMenu();
        };

        console.log("Controles de órbita...");
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        scene.add(new THREE.AmbientLight(0xffffff, 2.0));
        scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.5));
        const sun = new THREE.DirectionalLight(0xffffff, 3.0); sun.position.set(150, 200, 150); scene.add(sun);

        const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.3, transparent: true, opacity: 0.7, metalness: 0.2, roughness: 0.05 });
        const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xc9a66b, metalness: 0.9, roughness: 0.1 });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.5 });

        var storeGroups = {}; // Registro global de tiendas y anclas para mobiliario 3D




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

        // --- CENTRAL STRUCTURE PARAMETERS ---
        const VAULT_RADIUS = 17;
        const VAULT_LENGTH = 78;
        const VAULT_CENTER_OFFSET = 56.5;
        const DOME_CENTER_Y = 25.5; // Elevado para mayor lujo y espacio
        const CENTRAL_DOME_RADIUS = 28.0;
        const UPPER_MALL_ROOF_Y = 10.2;
        const LONGITUDINAL_BEAM_LEVELS = [-16, -13, -10, -7, -4, 0, 4, 7, 10, 13, 16]; // Añadido el 0 para el cenit
        const RING_FAMILY_LEVELS = [0, 4, 7, 10, 13, 16];

        function getVaultAngleForLevel(level) {
            return (level / VAULT_RADIUS) * (Math.PI / 2);
        }

        function getVaultHeightForLevel(level) {
            return DOME_CENTER_Y + Math.cos(getVaultAngleForLevel(level)) * VAULT_RADIUS;
        }

        function getDomeRingRadiusForHeight(height) {
            const verticalDelta = height - DOME_CENTER_Y;
            return Math.sqrt(Math.max((CENTRAL_DOME_RADIUS ** 2) - (verticalDelta ** 2), 0));
        }

        const DOME_RING_TARGETS = RING_FAMILY_LEVELS.map((level) => ({
            level,
            height: getVaultHeightForLevel(level),
            radius: getDomeRingRadiusForHeight(getVaultHeightForLevel(level))
        }));

        function addArchitecturalShell(group, r, l, wingLabel) {
            const innerSign = (wingLabel === 'N' || wingLabel === 'E') ? -1 : 1;
            const outerZ = -innerSign * (l / 2);

            const segments = 16;
            const geometry = new THREE.BufferGeometry();
            const vertices = [];
            const indices = [];

            // Generar vértices para el arco exterior (Z = outerZ, radio = 17) y el arco interior (conexión con domo)
            for (let i = 0; i <= segments; i++) {
                const anglePos = -16 + (32 * i / segments); // De -16 a 16 (niveles de fierros)
                const angle = (anglePos / r) * (Math.PI / 2);

                // Punto Exterior
                const xOut = Math.sin(angle) * r;
                const yOut = Math.cos(angle) * r;
                vertices.push(xOut, yOut, outerZ);

                // Punto Interior (Cierre con anillos del domo)
                const familyLevel = Math.abs(anglePos);
                const ringTarget = DOME_RING_TARGETS.find(t => t.level === Math.round(familyLevel)) || DOME_RING_TARGETS[0];
                const innerY = ringTarget.height - DOME_CENTER_Y;
                const innerAxisAbs = Math.sqrt(Math.max((CENTRAL_DOME_RADIUS ** 2) - (xOut ** 2) - (innerY ** 2), 0));
                const innerZ = innerSign * (VAULT_CENTER_OFFSET - innerAxisAbs);
                vertices.push(xOut, innerY, innerZ);
            }

            // Crear caras (Quads as Triangles)
            for (let i = 0; i < segments; i++) {
                const v0 = i * 2;
                const v1 = i * 2 + 1;
                const v2 = (i + 1) * 2;
                const v3 = (i + 1) * 2 + 1;
                indices.push(v0, v2, v1);
                indices.push(v1, v2, v3);
            }
            geometry.setIndex(indices);
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.computeVertexNormals();

            const mesh = new THREE.Mesh(geometry, glassMat);
            mesh.side = THREE.DoubleSide;
            group.add(mesh);
        }

        function addVaultShell(group, r, l) {
            const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 32, 1, true, 0, Math.PI), glassMat);
            m.rotation.x = Math.PI / 2; m.rotation.z = -Math.PI / 2; group.add(m);
        }
        function addTransverseRibs(group, r, l, wingLabel) {
            const pillarH = DOME_CENTER_Y - UPPER_MALL_ROOF_Y;
            for (let i = -l / 2; i <= l / 2; i += 4) {
                const rib = new THREE.Mesh(new THREE.TorusGeometry(r, 0.10, 16, 64, Math.PI), darkMat);
                let zPos = i;
                if (wingLabel === 'N' || wingLabel === 'E') zPos = i + 2;
                rib.position.z = zPos; group.add(rib);
                [r, -r].forEach(xSide => {
                    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, pillarH), darkMat);
                    p.position.set(xSide, -pillarH / 2, zPos);
                    group.add(p);
                });
            }
        }
        function addLongitudinalGirders(group, r, l, wingLabel) {
            const innerSign = (wingLabel === 'N' || wingLabel === 'E') ? -1 : 1;
            const outerLocalZ = -innerSign * (l / 2);
            LONGITUDINAL_BEAM_LEVELS.forEach((anglePos, index) => {
                const familyLevel = Math.abs(anglePos);
                const ringTarget = DOME_RING_TARGETS.find((target) => target.level === familyLevel);
                const actualRingHeight = ringTarget.height;
                const innerY = actualRingHeight - DOME_CENTER_Y;
                const angle = (anglePos / r) * (Math.PI / 2);
                const xLocal = Math.sin(angle) * r;
                const outerY = Math.cos(angle) * r;
                const innerAxisAbs = Math.sqrt(Math.max((CENTRAL_DOME_RADIUS ** 2) - (xLocal ** 2) - (innerY ** 2), 0));
                const innerLocalZ = innerSign * (VAULT_CENTER_OFFSET - innerAxisAbs);
                const start = new THREE.Vector3(xLocal, outerY, outerLocalZ);
                const end = new THREE.Vector3(xLocal, innerY, innerLocalZ);
                const direction = new THREE.Vector3().subVectors(end, start);
                const beamLen = direction.length();
                const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
                const beam = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, beamLen), darkMat);
                beam.position.copy(midPoint);
                beam.lookAt(end);
                group.add(beam);
            });
        }
        function addLowerLateralBracing(group, r, l, wingLabel) {
            const zOffset = (wingLabel === 'N' || wingLabel === 'E') ? 2 : 0;
            const bracingLevels = [UPPER_MALL_ROOF_Y + 2.4, UPPER_MALL_ROOF_Y + 5.6, UPPER_MALL_ROOF_Y + 8.8];
            const beamThickness = 0.08;
            const ribPositions = [];
            for (let z = -l / 2; z <= l / 2 + 0.001; z += 4) {
                ribPositions.push(z + zOffset);
            }
            bracingLevels.forEach((worldY, rowIndex) => {
                const localY = worldY - DOME_CENTER_Y;
                [r, -r].forEach((xSide) => {
                    for (let i = 0; i < ribPositions.length - 1; i++) {
                        const startZ = ribPositions[i];
                        const endZ = ribPositions[i + 1];
                        const beamLen = Math.abs(endZ - startZ) + beamThickness;
                        const beam = new THREE.Mesh(
                            new THREE.BoxGeometry(beamThickness, beamThickness, beamLen),
                            darkMat
                        );
                        beam.position.set(xSide, localY, (startZ + endZ) / 2);
                        group.add(beam);
                    }
                });
            });
        }
        function addEndCap(group, r, l, p, rx, ry, rz, wingLabel) {
            const capG = new THREE.Group();
            const innerSign = (wingLabel === 'N' || wingLabel === 'E') ? -1 : 1;
            const zStart = -innerSign * (l / 2);
            capG.position.set(0, 0, zStart);
            const convergeZ = -innerSign * 4.5;
            const convergeY = 16.5 - DOME_CENTER_Y; // Elevado para que quede sobre el techo de las tiendas (15m)
            const targetPoint = new THREE.Vector3(0, convergeY, convergeZ);
            const beamLevels = [-16, -13, -10, -7, -4, 0, 4, 7, 10, 13, 16];
            beamLevels.forEach(anglePos => {
                const angle = (anglePos / r) * (Math.PI / 2);
                const xLocal = Math.sin(angle) * r;
                const yLocal = Math.cos(angle) * r;
                const startPoint = new THREE.Vector3(xLocal, yLocal, 0);
                const controlPoint = new THREE.Vector3(xLocal, yLocal, convergeZ);
                const curve = new THREE.QuadraticBezierCurve3(startPoint, controlPoint, targetPoint);
                const points = curve.getPoints(20);
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const meridian = new THREE.Line(geometry, darkMat);
                capG.add(meridian);
                for (let j = 0; j < points.length - 1; j++) {
                    const segStart = points[j]; const segEnd = points[j + 1];
                    const dist = segStart.distanceTo(segEnd);
                    const beamSeg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, dist), darkMat);
                    beamSeg.position.copy(segStart).add(segEnd).multiplyScalar(0.5);
                    beamSeg.lookAt(segEnd);
                    capG.add(beamSeg);
                }
            });
            group.add(capG);
        }

        function createVaultedRoof(x, z, length, wingLabel, rot = false, capPos = 1, capX = 0, capY = 0, capZ = 0, showCap = true) {
            const vaultG = new THREE.Group(); vaultG.position.set(x, DOME_CENTER_Y, z);
            if (rot) vaultG.rotation.y = Math.PI / 2;
            addArchitecturalShell(vaultG, VAULT_RADIUS, length, wingLabel);
            addTransverseRibs(vaultG, VAULT_RADIUS, length, wingLabel);
            addLowerLateralBracing(vaultG, VAULT_RADIUS, length, wingLabel);
            addLongitudinalGirders(vaultG, VAULT_RADIUS, length, wingLabel);
            if (showCap) addEndCap(vaultG, 17, length, capPos, capX, capY, capZ, wingLabel);
            scene.add(vaultG);
        }

        const escalatorList = [];
        const ESCALATOR_FLAT_LEN = 4;
        const ESCALATOR_RIDE_Y_BOTTOM = 0.1;
        const ESCALATOR_RIDE_Y_TOP = 5.4;
        const PLAYER_EYE_HEIGHT = 1.7;
        const AVATAR_FLOOR_OFFSET = 0.115;
        const getAvatarGroundY = (floorY) => floorY + AVATAR_FLOOR_OFFSET;

        const boutiqueSlidingDoors = [];
        const boutiqueDoorPrevActors = new Map();
        const corridorSlidingDoors = [];
        const corridorDoorPrevActors = new Map();
        const BOUTIQUE_DOOR_FRONT_Z = 9.02;
        const BOUTIQUE_DOOR_TRIGGER_HALF_WIDTH = 3.2;
        const BOUTIQUE_DOOR_TRIGGER_DEPTH = 2.2;
        const BOUTIQUE_DOOR_OPEN_HOLD_MS = 950;
        const BOUTIQUE_DOOR_SLIDE_DISTANCE = 0.95;
        const BOUTIQUE_DOOR_LAYER_OFFSET = 0.14;
        const CORRIDOR_DOOR_FRONT_Z = 0;
        const CORRIDOR_DOOR_TRIGGER_DEPTH = 3.2;
        const CORRIDOR_DOOR_OPEN_HOLD_MS = 1050;
        const CORRIDOR_DOOR_LAYER_OFFSET = 0.16;
        const CORRIDOR_DOOR_SWING_ANGLE = Math.PI * 0.52;
        const BOUTIQUE_DOOR_COLLIDER_OFFSET_X = 4.5;
        const BOUTIQUE_DOOR_COLLIDER_WIDTH = 2.55;
        const BOUTIQUE_DETAIL_NEAR_DISTANCE = IS_COARSE_POINTER ? 24 : 30;
        const BOUTIQUE_DETAIL_FAR_DISTANCE = IS_COARSE_POINTER ? 34 : 42;
        const BOUTIQUE_DETAIL_FADE_EPSILON = 0.02;
        const BOUTIQUE_DETAIL_STREAM_BUILD_THRESHOLD = 0.01;
        const BOUTIQUE_DETAIL_FADE_SMOOTHING = 0.14;
        const ANCHOR_DETAIL_NEAR_DISTANCE = IS_COARSE_POINTER ? 42 : 56;
        const ANCHOR_DETAIL_FAR_DISTANCE = IS_COARSE_POINTER ? 58 : 76;
        const ANCHOR_DETAIL_STREAM_BUILD_THRESHOLD = 0.01;
        const ANCHOR_DETAIL_FADE_SMOOTHING = 0.12;
        const BOUTIQUE_SIGN_WIDTH = 5.4;
        const BOUTIQUE_SIGN_HEIGHT = 0.95;
        const interiorFogZones = [];

        function registerInteriorFogZone(group, minX, maxX, minZ, maxZ, minY, maxY) {
            interiorFogZones.push({ group, minX, maxX, minZ, maxZ, minY, maxY });
        }

        function prepareFadeMaterial(material) {
            if (!material || material.userData?.boutiqueFadeReady) return material;
            material.transparent = true;
            material.userData = material.userData || {};
            material.userData.boutiqueFadeReady = true;
            material.userData.baseOpacity = material.opacity ?? 1;
            return material;
        }

        function prepareGroupForDistanceFade(group) {
            if (!group) return;
            group.traverse((node) => {
                if (!node.isMesh) return;
                if (Array.isArray(node.material)) {
                    node.material = node.material.map((material) => prepareFadeMaterial(material?.clone ? material.clone() : material));
                } else if (node.material) {
                    node.material = prepareFadeMaterial(node.material.clone ? node.material.clone() : node.material);
                }
            });
        }

        function setGroupFade(group, fade) {
            if (!group) return;
            prepareGroupForDistanceFade(group);
            group.visible = fade > BOUTIQUE_DETAIL_FADE_EPSILON;
            if (!group.visible) return;

            group.traverse((node) => {
                if (!node.isMesh || !node.material) return;
                const materials = Array.isArray(node.material) ? node.material : [node.material];
                materials.forEach((material) => {
                    if (!material) return;
                    const baseOpacity = material.userData?.baseOpacity ?? 1;
                    material.opacity = baseOpacity * fade;
                });
            });
        }

        function getBoutiqueInteriorFade(distance) {
            const range = Math.max(0.001, BOUTIQUE_DETAIL_FAR_DISTANCE - BOUTIQUE_DETAIL_NEAR_DISTANCE);
            const t = THREE.MathUtils.clamp((BOUTIQUE_DETAIL_FAR_DISTANCE - distance) / range, 0, 1);
            return t * t * (3 - 2 * t);
        }

        function getDistanceToBoutiqueVolume(shop, worldPoint) {
            if (!shop) return Infinity;
            const localPoint = shop.worldToLocal(worldPoint.clone());
            const minX = -6.1, maxX = 6.1;
            const minY = 0.0, maxY = 5.2;
            const minZ = -9.1, maxZ = 9.1;
            const dx = localPoint.x < minX ? (minX - localPoint.x) : (localPoint.x > maxX ? localPoint.x - maxX : 0);
            const dy = localPoint.y < minY ? (minY - localPoint.y) : (localPoint.y > maxY ? localPoint.y - maxY : 0);
            const dz = localPoint.z < minZ ? (minZ - localPoint.z) : (localPoint.z > maxZ ? localPoint.z - maxZ : 0);
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
        }

        function getDistanceToBoutiqueFront(shop, worldPoint) {
            if (!shop) return Infinity;
            const localPoint = shop.worldToLocal(worldPoint.clone());
            const minX = -6.1, maxX = 6.1;
            const minY = 0.0, maxY = 5.2;
            const minZ = 7.6, maxZ = 9.4;
            const dx = localPoint.x < minX ? (minX - localPoint.x) : (localPoint.x > maxX ? localPoint.x - maxX : 0);
            const dy = localPoint.y < minY ? (minY - localPoint.y) : (localPoint.y > maxY ? localPoint.y - maxY : 0);
            const dz = localPoint.z < minZ ? (minZ - localPoint.z) : (localPoint.z > maxZ ? localPoint.z - maxZ : 0);
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
        }

        function getAnchorInteriorFade(distance) {
            const range = Math.max(0.001, ANCHOR_DETAIL_FAR_DISTANCE - ANCHOR_DETAIL_NEAR_DISTANCE);
            const t = THREE.MathUtils.clamp((ANCHOR_DETAIL_FAR_DISTANCE - distance) / range, 0, 1);
            return t * t * (3 - 2 * t);
        }

        function getDistanceToAnchorVolume(shop, worldPoint) {
            if (!shop?.userData?.isAnchor) return Infinity;
            const width = shop.userData.anchorWidth || 70;
            const height = shop.userData.anchorHeight || 15;
            const localPoint = shop.worldToLocal(worldPoint.clone());
            const minX = -width / 2 + 0.35;
            const maxX = width / 2 - 0.35;
            const minY = 0.0;
            const maxY = height - 0.05;
            const minZ = -24.8;
            const maxZ = 9.0;
            const dx = localPoint.x < minX ? (minX - localPoint.x) : (localPoint.x > maxX ? localPoint.x - maxX : 0);
            const dy = localPoint.y < minY ? (minY - localPoint.y) : (localPoint.y > maxY ? localPoint.y - maxY : 0);
            const dz = localPoint.z < minZ ? (minZ - localPoint.z) : (localPoint.z > maxZ ? localPoint.z - maxZ : 0);
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
        }

        function getDistanceToAnchorFront(shop, worldPoint) {
            if (!shop?.userData?.isAnchor) return Infinity;
            const width = shop.userData.anchorWidth || 70;
            const height = shop.userData.anchorHeight || 15;
            const localPoint = shop.worldToLocal(worldPoint.clone());
            const minX = -width / 2 + 0.35;
            const maxX = width / 2 - 0.35;
            const minY = 0.0;
            const maxY = Math.min(height, 6.2);
            const minZ = 5.9;
            const maxZ = 9.8;
            const dx = localPoint.x < minX ? (minX - localPoint.x) : (localPoint.x > maxX ? localPoint.x - maxX : 0);
            const dy = localPoint.y < minY ? (minY - localPoint.y) : (localPoint.y > maxY ? localPoint.y - maxY : 0);
            const dz = localPoint.z < minZ ? (minZ - localPoint.z) : (localPoint.z > maxZ ? localPoint.z - maxZ : 0);
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
        }

        function isCameraInsideInteriorFogZone() {
            for (const zone of interiorFogZones) {
                const local = zone.group.worldToLocal(camera.position.clone());
                if (
                    local.x >= zone.minX && local.x <= zone.maxX &&
                    local.z >= zone.minZ && local.z <= zone.maxZ &&
                    local.y >= zone.minY && local.y <= zone.maxY
                ) return true;
            }
            return false;
        }

        function updateAdaptiveFogProfile() {
            if (!isWalking) {
                if (scene.fog) scene.fog = null;
                return;
            }
            if (!scene.fog) {
                scene.fog = new THREE.Fog(0xaabbcc, FOG_PROFILE_OUTSIDE.near, FOG_PROFILE_OUTSIDE.far);
            }
            const targetFog = isCameraInsideInteriorFogZone() ? FOG_PROFILE_STORE_INSIDE : FOG_PROFILE_OUTSIDE;
            scene.fog.near = THREE.MathUtils.lerp(scene.fog.near, targetFog.near, 0.08);
            scene.fog.far = THREE.MathUtils.lerp(scene.fog.far, targetFog.far, 0.08);
        }

        // TIENDAS ANCLA E IDENTIFICADORES Giant N,S,E,O
        function createAnchorStore(posX, posZ, width, height, name = "ANCLA", idLetter = "", rotY = 0) {
            const g = new THREE.Group(); g.position.set(posX, 0, posZ); g.rotation.y = rotY;
            g.userData = { isAnchor: true, shopCode: idLetter, name: name, anchorWidth: width, anchorHeight: height };
            const detailedInterior = new THREE.Group();
            detailedInterior.name = "anchorDetailedInterior";
            detailedInterior.visible = false;
            g.add(detailedInterior);
            if (idLetter !== "") {
                const idTex = createSignTexture(idLetter, true);
                const idM = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), new THREE.MeshBasicMaterial({ map: idTex, transparent: true }));
                idM.userData.isSign = true; idM.userData.isAnchorSign = true; idM.userData.isCatalogTrigger = true; idM.userData.shopCode = idLetter; catalogClickTargets.push(idM);
                idM.position.set(0, height + 0.1, -14); idM.rotation.x = -Math.PI / 2; g.add(idM);

            }

            const m = (w, h, d, x, y, z, mat) => { const mw = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); mw.position.set(x, y, z); g.add(mw); };
            const anchorSlabTopY = 5.4;
            const anchorSlabThickness = 0.6;
            const anchorFloorMat = new THREE.MeshStandardMaterial({ color: 0xc8c8c2, roughness: 0.08, metalness: 0.03 });
            const anchorStripeMat = new THREE.MeshStandardMaterial({ color: 0x332211, roughness: 0.2, metalness: 0.08 });
            const anchorFrontWallZ = 9.05;
            const anchorFrontWallH = 5.4;
            const anchorUpperFrontWallZ = 4.88;
            const anchorEntryWidth = 12;
            const anchorEntryHeight = 5.4;
            const anchorEscalatorVoidLength = 6.5;
            const anchorEscalatorVoidWidth = 11.4;
            const anchorUpperEntryClearHeight = 4.0;
            const anchorUpperSideWallHeight = height - anchorSlabTopY;
            const anchorUpperSideWallCenterY = anchorSlabTopY + anchorUpperSideWallHeight / 2;
            const anchorUpperFrontWallHeight = height - (anchorSlabTopY + anchorUpperEntryClearHeight);
            const anchorUpperFrontWallCenterY = anchorSlabTopY + anchorUpperEntryClearHeight + anchorUpperFrontWallHeight / 2;
            const ensureDetailedInterior = () => {
                if (g.userData.detailedInteriorBuilt) return;
                const addDetail = (w, h, d, x, y, z, mat, parent = detailedInterior) => {
                    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
                    mesh.position.set(x, y, z);
                    parent.add(mesh);
                    return mesh;
                };
                const accentPalette = {
                    N: 0x6da9d6,
                    S: 0xc79a58,
                    E: 0x8fc27a,
                    O: 0xb485d9
                };
                const accentColor = accentPalette[idLetter] || 0xc9a66b;
                const displayMat = new THREE.MeshStandardMaterial({ color: 0xf3eee4, roughness: 0.22, metalness: 0.04 });
                const baseMat = new THREE.MeshStandardMaterial({ color: 0xefe8dc, roughness: 0.52, metalness: 0.02 });
                const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b6b43, roughness: 0.56, metalness: 0.08 });
                const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x4a3421, roughness: 0.58, metalness: 0.06 });
                const metalMat = new THREE.MeshStandardMaterial({ color: 0x565a60, roughness: 0.32, metalness: 0.78 });
                const accentShelfMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.38, metalness: 0.14 });
                const planterMat = new THREE.MeshStandardMaterial({ color: 0xd7d0c1, roughness: 0.62, metalness: 0.04 });
                const leafMat = new THREE.MeshStandardMaterial({ color: 0x6f9a63, roughness: 0.88, metalness: 0.0 });
                const railGlassMat = new THREE.MeshPhysicalMaterial({ color: 0xe9f6ff, transmission: 0.66, transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.08 });

                const createPlanter = (x, y, z, scale = 1) => {
                    const planter = new THREE.Group();
                    addDetail(1.1 * scale, 0.72 * scale, 1.1 * scale, x, y + 0.36 * scale, z, planterMat, planter);
                    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * scale, 0.12 * scale, 1.6 * scale, 8), woodMat);
                    trunk.position.set(x, y + 1.2 * scale, z);
                    planter.add(trunk);
                    for (let i = 0; i < 7; i++) {
                        const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.14 * scale, 1.05 * scale, 0.04 * scale), leafMat);
                        const angle = (Math.PI * 2 * i) / 7;
                        leaf.position.set(x + Math.cos(angle) * 0.2 * scale, y + 1.95 * scale, z + Math.sin(angle) * 0.2 * scale);
                        leaf.rotation.z = Math.cos(angle) * 0.65;
                        leaf.rotation.x = Math.sin(angle) * 0.3;
                        planter.add(leaf);
                    }
                    detailedInterior.add(planter);
                };

                const createDisplayIsland = (x, z, widthScale = 1, depthScale = 1) => {
                    const island = new THREE.Group();
                    addDetail(5.0 * widthScale, 0.95, 2.0 * depthScale, x, 0.48, z, baseMat, island);
                    addDetail(4.4 * widthScale, 0.14, 1.4 * depthScale, x, 1.02, z, accentShelfMat, island);
                    addDetail(4.0 * widthScale, 0.28, 0.52, x, 1.28, z - 0.35 * depthScale, displayMat, island);
                    addDetail(3.6 * widthScale, 0.22, 0.44, x, 1.58, z + 0.28 * depthScale, displayMat, island);
                    addDetail(1.2 * widthScale, 0.18, 1.2 * depthScale, x, 1.22, z, railGlassMat, island);
                    detailedInterior.add(island);
                };

                const createWallShelves = (x, z, length, rotationY = 0) => {
                    const shelf = new THREE.Group();
                    shelf.position.set(x, 0, z);
                    shelf.rotation.y = rotationY;
                    addDetail(length, 0.95, 1.15, 0, 0.48, 0, baseMat, shelf);
                    addDetail(length, 0.12, 0.4, 0, 1.08, -0.28, accentShelfMat, shelf);
                    addDetail(length, 0.12, 0.4, 0, 1.9, -0.18, displayMat, shelf);
                    addDetail(length, 0.12, 0.4, 0, 2.72, -0.08, displayMat, shelf);
                    addDetail(length, 0.16, 0.12, 0, 3.35, -0.02, darkWoodMat, shelf);
                    for (let i = -Math.floor(length / 3); i <= Math.floor(length / 3); i++) {
                        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.05, 0.12), metalMat);
                        post.position.set(i * 3, 1.7, -0.42);
                        shelf.add(post);
                    }
                    detailedInterior.add(shelf);
                };

                const createCashier = (x, z, rotationY = 0) => {
                    const cashier = new THREE.Group();
                    cashier.position.set(x, 0, z);
                    cashier.rotation.y = rotationY;
                    addDetail(6.6, 1.12, 2.2, 0, 0.56, 0, darkWoodMat, cashier);
                    addDetail(5.8, 0.14, 1.55, 0, 1.05, -0.1, accentShelfMat, cashier);
                    addDetail(1.1, 0.52, 0.12, -2.05, 1.46, -0.82, metalMat, cashier);
                    addDetail(1.1, 0.52, 0.12, 2.05, 1.46, -0.82, metalMat, cashier);
                    addDetail(1.2, 0.08, 0.95, 0, 1.18, 0.2, displayMat, cashier);
                    detailedInterior.add(cashier);
                };

                const createUpperLounge = (x, z) => {
                    const lounge = new THREE.Group();
                    addDetail(5.8, 0.55, 1.5, x, anchorSlabTopY + 0.28, z, baseMat, lounge);
                    addDetail(2.4, 0.72, 0.52, x - 1.5, anchorSlabTopY + 0.82, z - 0.42, accentShelfMat, lounge);
                    addDetail(2.4, 0.72, 0.52, x + 1.5, anchorSlabTopY + 0.82, z + 0.42, accentShelfMat, lounge);
                    addDetail(1.3, 0.4, 1.3, x, anchorSlabTopY + 0.22, z + 2.2, darkWoodMat, lounge);
                    detailedInterior.add(lounge);
                };

                const createPerimeterGlass = (x, z, widthSize, depthSize, y) => {
                    const rail = new THREE.Mesh(new THREE.BoxGeometry(widthSize, 1.0, depthSize), railGlassMat);
                    rail.position.set(x, y, z);
                    detailedInterior.add(rail);
                };

                createCashier(0, 3.2, 0);
                createDisplayIsland(-11.5, -1.8, 1.08, 1.0);
                createDisplayIsland(11.5, -1.8, 1.08, 1.0);
                createDisplayIsland(0, -7.0, 1.15, 1.0);
                createDisplayIsland(-11.0, -13.0, 0.92, 1.0);
                createDisplayIsland(11.0, -13.0, 0.92, 1.0);
                createWallShelves(-width / 2 + 2.4, -7.5, 14.0, Math.PI / 2);
                createWallShelves(width / 2 - 2.4, -7.5, 14.0, -Math.PI / 2);
                createWallShelves(0, -22.2, width - 11.0, 0);
                createPlanter(-width / 2 + 4.8, 0, 4.8, 1.05);
                createPlanter(width / 2 - 4.8, 0, 4.8, 1.05);
                createPlanter(-7.8, 0, -18.4, 0.95);
                createPlanter(7.8, 0, -18.4, 0.95);

                createUpperLounge(-10.8, -2.8);
                createUpperLounge(10.8, -2.8);
                createDisplayIsland(-11.5, -15.4, 0.95, 0.92);
                createDisplayIsland(11.5, -15.4, 0.95, 0.92);
                createWallShelves(-width / 2 + 2.6, -7.4, 11.5, Math.PI / 2);
                createWallShelves(width / 2 - 2.6, -7.4, 11.5, -Math.PI / 2);
                createPerimeterGlass(-14.5, -10, 0.12, 10.5, anchorSlabTopY + 0.55);
                createPerimeterGlass(14.5, -10, 0.12, 10.5, anchorSlabTopY + 0.55);

                prepareGroupForDistanceFade(detailedInterior);
                g.userData.detailedInteriorBuilt = true;
            };
            const addAccessSlidingDoors = (wallZ, outwardDir) => {
                const doors = new THREE.Group();
                const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.32, metalness: 0.72 });
                const railMat = new THREE.MeshStandardMaterial({ color: 0x8f7746, roughness: 0.24, metalness: 0.86 });
                const doorGlassMat = new THREE.MeshPhysicalMaterial({
                    color: 0xf8fbff,
                    transmission: 0.72,
                    transparent: true,
                    opacity: 0.52,
                    metalness: 0.16,
                    roughness: 0.05
                });

                const openingWidth = anchorEntryWidth;
                const openingHeight = 4.55;
                const frameDepth = 0.18;
                const doorPlaneZ = wallZ + outwardDir * 0.06;
                const transomHeight = anchorEntryHeight - openingHeight;
                const sideFrameX = openingWidth / 2 + 0.02;

                // Marco general del vano.
                m(openingWidth + 0.28, 0.12, frameDepth, 0, openingHeight + 0.06, doorPlaneZ, railMat);
                m(openingWidth + 0.28, 0.08, frameDepth, 0, 0.04, doorPlaneZ, frameMat);
                m(0.14, openingHeight + 0.12, frameDepth, -sideFrameX, openingHeight / 2, doorPlaneZ, frameMat);
                m(0.14, openingHeight + 0.12, frameDepth, sideFrameX, openingHeight / 2, doorPlaneZ, frameMat);
                m(openingWidth, transomHeight, 0.06, 0, openingHeight + transomHeight / 2, doorPlaneZ, glassMat);

                const createDoorPortal = (centerX) => {
                    const portal = new THREE.Group();
                    portal.position.set(centerX, 0, doorPlaneZ);

                    const portalWidth = 4.65;
                    const leafWidth = 1.08;
                    const mullionX = 0;
                    const edgeOffset = portalWidth / 2 - leafWidth / 2 - 0.2;

                    const railTop = new THREE.Mesh(new THREE.BoxGeometry(portalWidth, 0.08, 0.08), railMat);
                    railTop.position.set(0, openingHeight - 0.12, 0);
                    portal.add(railTop);

                    const railBottom = new THREE.Mesh(new THREE.BoxGeometry(portalWidth, 0.05, 0.08), frameMat);
                    railBottom.position.set(0, 0.06, 0);
                    portal.add(railBottom);

                    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.08, openingHeight - 0.12, 0.08), frameMat);
                    sideL.position.set(-portalWidth / 2, (openingHeight - 0.12) / 2, 0);
                    portal.add(sideL);

                    const sideR = sideL.clone();
                    sideR.position.x = portalWidth / 2;
                    portal.add(sideR);

                    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.08, openingHeight - 0.12, 0.08), railMat);
                    mullion.position.set(mullionX, (openingHeight - 0.12) / 2, 0);
                    portal.add(mullion);

                    const createLeaf = (x, handleDir = 1) => {
                        const leaf = new THREE.Group();
                        leaf.position.set(x, 0, 0);
                        const glass = new THREE.Mesh(new THREE.BoxGeometry(leafWidth, openingHeight - 0.34, 0.045), doorGlassMat);
                        glass.position.y = (openingHeight - 0.34) / 2 + 0.08;
                        leaf.add(glass);

                        const topFrame = new THREE.Mesh(new THREE.BoxGeometry(leafWidth + 0.08, 0.07, 0.06), frameMat);
                        topFrame.position.y = openingHeight - 0.16;
                        leaf.add(topFrame);

                        const bottomFrame = new THREE.Mesh(new THREE.BoxGeometry(leafWidth + 0.08, 0.05, 0.06), frameMat);
                        bottomFrame.position.y = 0.08;
                        leaf.add(bottomFrame);

                        const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(0.05, openingHeight - 0.22, 0.06), frameMat);
                        leftFrame.position.set(-leafWidth / 2, openingHeight / 2 - 0.02, 0);
                        leaf.add(leftFrame);

                        const rightFrame = leftFrame.clone();
                        rightFrame.position.x = leafWidth / 2;
                        leaf.add(rightFrame);

                        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.05), railMat);
                        handle.position.set(handleDir * (leafWidth / 2 - 0.22), openingHeight / 2 - 0.05, 0.045);
                        leaf.add(handle);
                        return leaf;
                    };

                    portal.add(createLeaf(-edgeOffset, 1));
                    portal.add(createLeaf(edgeOffset, -1));
                    doors.add(portal);
                };

                createDoorPortal(-3.0);
                createDoorPortal(3.0);
                g.add(doors);
            };
            const drawAnchorFloorWithGrid = (w, d, y, z) => {
                const step = 8;
                const gap = 0.8;
                const lineY = y + 0.012;
                for (let i = -w / 2; i <= w / 2 + 0.1; i += step) {
                    [0, gap].forEach((off) => {
                        const xPos = i + off;
                        if (xPos < -w / 2 - 0.1 || xPos > w / 2 + 0.1) return;
                        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.04, d), anchorStripeMat);
                        line.rotation.x = -Math.PI / 2;
                        line.position.set(xPos, lineY, z);
                        g.add(line);
                    });
                }
                for (let j = -d / 2; j <= d / 2 + 0.1; j += step) {
                    [0, gap].forEach((off) => {
                        const zPos = j + off;
                        if (zPos < -d / 2 - 0.1 || zPos > d / 2 + 0.1) return;
                        const line = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.04), anchorStripeMat);
                        line.rotation.x = -Math.PI / 2;
                        line.position.set(0, lineY, z + zPos);
                        g.add(line);
                    });
                }
            };
            const addAnchorGateway = (wallZ, outwardDir) => {
                const portalDepth = 2.6;
                const canopyDepth = 3.2;
                const portalCenterZ = wallZ + outwardDir * (portalDepth / 2 - 0.2);
                const canopyCenterZ = wallZ + outwardDir * (canopyDepth / 2 + 0.25);
                const sideReturnZ = wallZ + outwardDir * 0.75;
                const thresholdZ = wallZ + outwardDir * 1.1;
                const facadeMat = darkMat;

                // Umbral y piso de acceso para dar presencia de gran tienda.
                m(anchorEntryWidth + 2.4, 0.08, 2.6, 0, 0.05, thresholdZ, anchorFloorMat);
                drawAnchorFloorWithGrid(anchorEntryWidth + 1.8, 2.2, 0.09, thresholdZ);

                // Marco principal y pilastras.
                m(anchorEntryWidth + 2.8, 0.45, canopyDepth, 0, anchorEntryHeight + 0.24, canopyCenterZ, facadeMat);
                m(anchorEntryWidth + 3.2, 0.12, canopyDepth + 0.2, 0, anchorEntryHeight + 0.52, canopyCenterZ, goldMat);
                m(1.1, anchorEntryHeight + 0.3, portalDepth, -(anchorEntryWidth / 2 + 0.55), (anchorEntryHeight + 0.3) / 2, portalCenterZ, facadeMat);
                m(1.1, anchorEntryHeight + 0.3, portalDepth, anchorEntryWidth / 2 + 0.55, (anchorEntryHeight + 0.3) / 2, portalCenterZ, facadeMat);

                // Retornos laterales para que el acceso tenga profundidad.
                m(0.18, anchorEntryHeight, 1.6, -(anchorEntryWidth / 2 - 0.25), anchorEntryHeight / 2, sideReturnZ, whiteMat);
                m(0.18, anchorEntryHeight, 1.6, anchorEntryWidth / 2 - 0.25, anchorEntryHeight / 2, sideReturnZ, whiteMat);

                // Paños de vidrio laterales tipo grandes tiendas.
                m(0.08, anchorEntryHeight - 0.8, portalDepth - 0.5, -(anchorEntryWidth / 2 - 1.05), (anchorEntryHeight - 0.8) / 2 + 0.2, portalCenterZ, glassMat);
                m(0.08, anchorEntryHeight - 0.8, portalDepth - 0.5, anchorEntryWidth / 2 - 1.05, (anchorEntryHeight - 0.8) / 2 + 0.2, portalCenterZ, glassMat);

                // Remates dorados finos para reforzar el lenguaje premium.
                m(0.14, anchorEntryHeight - 0.2, 0.14, -(anchorEntryWidth / 2 + 0.02), anchorEntryHeight / 2, wallZ + outwardDir * 0.18, goldMat);
                m(0.14, anchorEntryHeight - 0.2, 0.14, anchorEntryWidth / 2 + 0.02, anchorEntryHeight / 2, wallZ + outwardDir * 0.18, goldMat);
            };
            const addAnchorUpperGateway = () => {
                const upperPortalDepth = 1.35;
                const upperCanopyDepth = 1.7;
                const upperPortalCenterZ = anchorUpperFrontWallZ + upperPortalDepth / 2 - 0.14;
                const upperCanopyCenterZ = anchorUpperFrontWallZ + upperCanopyDepth / 2 + 0.1;
                const upperPortalCenterY = anchorSlabTopY + anchorUpperEntryClearHeight / 2;
                const upperCanopyY = anchorSlabTopY + anchorUpperEntryClearHeight + 0.2;

                m(anchorEntryWidth + 1.8, 0.26, upperCanopyDepth, 0, upperCanopyY, upperCanopyCenterZ, darkMat);
                m(anchorEntryWidth + 2.15, 0.08, upperCanopyDepth + 0.14, 0, upperCanopyY + 0.18, upperCanopyCenterZ, goldMat);
                m(0.8, anchorUpperEntryClearHeight + 0.18, upperPortalDepth, -(anchorEntryWidth / 2 + 0.4), upperPortalCenterY, upperPortalCenterZ, darkMat);
                m(0.8, anchorUpperEntryClearHeight + 0.18, upperPortalDepth, anchorEntryWidth / 2 + 0.4, upperPortalCenterY, upperPortalCenterZ, darkMat);
                m(0.16, anchorUpperEntryClearHeight, 0.85, -(anchorEntryWidth / 2 - 0.22), upperPortalCenterY, anchorUpperFrontWallZ + 0.38, whiteMat);
                m(0.16, anchorUpperEntryClearHeight, 0.85, anchorEntryWidth / 2 - 0.22, upperPortalCenterY, anchorUpperFrontWallZ + 0.38, whiteMat);
                m(0.08, anchorUpperEntryClearHeight - 0.55, upperPortalDepth - 0.28, -(anchorEntryWidth / 2 - 0.88), anchorSlabTopY + (anchorUpperEntryClearHeight - 0.55) / 2 + 0.16, upperPortalCenterZ, glassMat);
                m(0.08, anchorUpperEntryClearHeight - 0.55, upperPortalDepth - 0.28, anchorEntryWidth / 2 - 0.88, anchorSlabTopY + (anchorUpperEntryClearHeight - 0.55) / 2 + 0.16, upperPortalCenterZ, glassMat);
                m(0.14, anchorUpperEntryClearHeight - 0.12, 0.12, -(anchorEntryWidth / 2 + 0.02), upperPortalCenterY, anchorUpperFrontWallZ + 0.12, goldMat);
                m(0.14, anchorUpperEntryClearHeight - 0.12, 0.12, anchorEntryWidth / 2 + 0.02, upperPortalCenterY, anchorUpperFrontWallZ + 0.12, goldMat);
            };
            const addAnchorDiagonalEscalator = (startX, startZ, endX, endZ, up) => {
                const escMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.78, roughness: 0.26 });
                const stepMat = new THREE.MeshStandardMaterial({ color: 0xb3b3b3, metalness: 0.85, roughness: 0.2 });
                const trimMat = new THREE.MeshStandardMaterial({ color: 0xd4b074, metalness: 0.92, roughness: 0.16 });
                const railGlass = new THREE.MeshStandardMaterial({ color: 0xbfd7ef, transparent: true, opacity: 0.35, metalness: 0.15, roughness: 0.05 });
                const bottomY = -0.09;
                const topY = anchorSlabTopY - 0.12;
                const rise = topY - bottomY;
                const dx = endX - startX;
                const dz = endZ - startZ;
                const runLen = Math.sqrt(dx * dx + dz * dz);
                const landingLen = Math.min(1.8, Math.max(1.2, runLen * 0.18));
                const diagRunLen = Math.max(0.001, runLen - landingLen * 2);
                const bodyLen = Math.sqrt(diagRunLen * diagRunLen + rise * rise);
                const yaw = Math.atan2(dx, dz);
                const pitch = Math.atan2(rise, diagRunLen);
                const escWidth = 3.0;
                const lowerLandingCenter = landingLen / 2;
                const upperLandingCenter = runLen - landingLen / 2;
                const diagonalCenter = landingLen + diagRunLen / 2;
                const axis = Math.abs(dx) >= Math.abs(dz) ? 'x' : 'z';
                const pathStartX = up ? startX : endX;
                const pathStartZ = up ? startZ : endZ;
                const pathEndX = up ? endX : startX;
                const pathEndZ = up ? endZ : startZ;
                const travelDir = axis === 'x'
                    ? Math.sign(pathEndX - pathStartX || 1)
                    : Math.sign(pathEndZ - pathStartZ || 1);

                const esc = new THREE.Group();
                esc.position.set(startX, bottomY, startZ);
                esc.rotation.y = yaw;

                const basePad = new THREE.Mesh(new THREE.BoxGeometry(escWidth + 1.0, 0.26, landingLen), darkMat);
                basePad.position.set(0, 0.13, lowerLandingCenter);
                esc.add(basePad);

                const topPad = new THREE.Mesh(new THREE.BoxGeometry(escWidth + 1.0, 0.26, landingLen), darkMat);
                topPad.position.set(0, rise + 0.13, upperLandingCenter);
                esc.add(topPad);

                const shell = new THREE.Mesh(new THREE.BoxGeometry(escWidth, 0.92, bodyLen), escMat);
                shell.position.set(0, rise / 2, diagonalCenter);
                shell.rotation.x = -pitch;
                esc.add(shell);

                const tread = new THREE.Mesh(new THREE.BoxGeometry(escWidth - 0.8, 0.11, bodyLen - 0.08), stepMat);
                tread.position.set(0, rise / 2 + 0.48, diagonalCenter);
                tread.rotation.x = -pitch;
                esc.add(tread);

                const lowerComb = new THREE.Mesh(new THREE.BoxGeometry(escWidth - 0.34, 0.06, 0.34), trimMat);
                lowerComb.position.set(0, 0.34, landingLen - 0.18);
                esc.add(lowerComb);

                const upperComb = new THREE.Mesh(new THREE.BoxGeometry(escWidth - 0.34, 0.06, 0.34), trimMat);
                upperComb.position.set(0, rise + 0.34, runLen - landingLen + 0.18);
                esc.add(upperComb);

                const lowerSkirt = new THREE.Mesh(new THREE.BoxGeometry(escWidth - 0.45, 0.08, landingLen - 0.18), stepMat);
                lowerSkirt.position.set(0, 0.42, lowerLandingCenter);
                esc.add(lowerSkirt);

                const upperSkirt = new THREE.Mesh(new THREE.BoxGeometry(escWidth - 0.45, 0.08, landingLen - 0.18), stepMat);
                upperSkirt.position.set(0, rise + 0.42, upperLandingCenter);
                esc.add(upperSkirt);

                const addRailSegment = (side, y, z, len, rotX = 0, glassHeight = 1.2) => {
                    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, glassHeight, len), railGlass);
                    rail.position.set(side, y, z);
                    rail.rotation.x = rotX;
                    esc.add(rail);
                };

                [1.2, -1.2].forEach((side) => {
                    // 1. Vidrios base
                    addRailSegment(side, 1.02, lowerLandingCenter, landingLen);
                    addRailSegment(side, rise / 2 + 1.02, diagonalCenter, bodyLen, -pitch);
                    addRailSegment(side, rise + 1.02, upperLandingCenter, landingLen);

                    // 2. Pasamanos continuo (Bucle sin costuras con TubeGeometry)
                    const yTopLower = 1.8;
                    const yTopUpper = rise + 1.8;
                    const r = 0.55;
                    const kappa = 0.5522847; // Constante mágica para aproximar círculos perfectos con curvas Bezier cúbicas
                    
                    const p1 = new THREE.Vector3(side, yTopLower, 0);
                    const p2 = new THREE.Vector3(side, yTopLower, landingLen);
                    const p3 = new THREE.Vector3(side, yTopUpper, runLen - landingLen);
                    const p4 = new THREE.Vector3(side, yTopUpper, runLen);
                    
                    // Curva superior: 180 grados (compuesta de dos arcos perfectos de 90 grados)
                    const p4_cp1 = new THREE.Vector3(side, yTopUpper, runLen + r * kappa);
                    const p4_cp2 = new THREE.Vector3(side, yTopUpper - r + r * kappa, runLen + r);
                    const pMidUp = new THREE.Vector3(side, yTopUpper - r, runLen + r); // Punta frontal exacta
                    
                    const pMidUp_cp1 = new THREE.Vector3(side, yTopUpper - r - r * kappa, runLen + r);
                    const p6_cp2 = new THREE.Vector3(side, yTopUpper - 2 * r, runLen + r * kappa);
                    const p6 = new THREE.Vector3(side, yTopUpper - 2 * r, runLen);
                    
                    const p7 = new THREE.Vector3(side, yTopUpper - 2 * r, runLen - landingLen);
                    const p8 = new THREE.Vector3(side, yTopLower - 2 * r, landingLen);
                    const p9 = new THREE.Vector3(side, yTopLower - 2 * r, 0);
                    
                    // Curva inferior: 180 grados (compuesta de dos arcos perfectos de 90 grados)
                    const p9_cp1 = new THREE.Vector3(side, yTopLower - 2 * r, -r * kappa);
                    const pMidDn_cp2 = new THREE.Vector3(side, yTopLower - r - r * kappa, -r);
                    const pMidDn = new THREE.Vector3(side, yTopLower - r, -r); // Punta trasera exacta
                    
                    const pMidDn_cp1 = new THREE.Vector3(side, yTopLower - r + r * kappa, -r);
                    const p1_cp2 = new THREE.Vector3(side, yTopLower, -r * kappa);
                    
                    const hrPath = new THREE.CurvePath();
                    hrPath.add(new THREE.LineCurve3(p1, p2));
                    hrPath.add(new THREE.LineCurve3(p2, p3));
                    hrPath.add(new THREE.LineCurve3(p3, p4));
                    // Arco superior (180 grados perfecto)
                    hrPath.add(new THREE.CubicBezierCurve3(p4, p4_cp1, p4_cp2, pMidUp));
                    hrPath.add(new THREE.CubicBezierCurve3(pMidUp, pMidUp_cp1, p6_cp2, p6));
                    
                    hrPath.add(new THREE.LineCurve3(p6, p7));
                    hrPath.add(new THREE.LineCurve3(p7, p8));
                    hrPath.add(new THREE.LineCurve3(p8, p9));
                    
                    // Arco inferior (180 grados perfecto)
                    hrPath.add(new THREE.CubicBezierCurve3(p9, p9_cp1, pMidDn_cp2, pMidDn));
                    hrPath.add(new THREE.CubicBezierCurve3(pMidDn, pMidDn_cp1, p1_cp2, p1));
                    
                    // Tubo extruido a lo largo del path
                    const hrGeom = new THREE.TubeGeometry(hrPath, 120, 0.06, 12, true);
                    const hrMesh = new THREE.Mesh(hrGeom, darkMat);
                    esc.add(hrMesh);

                    // Pedacito de metal para cerrar la estructura y recibir la goma del pasamanos
                    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.4, 1.0), escMat);
                    wing.rotation.x = -pitch;
                    wing.position.set(side, (rise + 1.36) - r * Math.cos(pitch), runLen - landingLen + 0.46);
                    esc.add(wing);

                    const balusterBottom = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.05, 0.11), darkMat);
                    balusterBottom.position.set(side, 0.74, landingLen - 0.1);
                    esc.add(balusterBottom);

                    const balusterTop = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.05, 0.11), darkMat);
                    balusterTop.position.set(side, rise + 0.74, runLen - landingLen + 0.1);
                    esc.add(balusterTop);
                });

                g.add(esc);

                const cosR = Math.cos(rotY);
                const sinR = Math.sin(rotY);

                const worldStartX = posX + (startX * cosR + startZ * sinR);
                const worldStartZ = posZ + (-startX * sinR + startZ * cosR);
                const worldEndX = posX + (endX * cosR + endZ * sinR);
                const worldEndZ = posZ + (-endX * sinR + endZ * cosR);

                const worldPathStartX = posX + (pathStartX * cosR + pathStartZ * sinR);
                const worldPathStartZ = posZ + (-pathStartX * sinR + pathStartZ * cosR);

                escalatorList.push({
                    id: escalatorList.length,
                    x: (worldStartX + worldEndX) / 2,
                    z: (worldStartZ + worldEndZ) / 2,
                    xMin: Math.min(worldStartX, worldEndX) - 1.8,
                    xMax: Math.max(worldStartX, worldEndX) + 1.8,
                    zMin: Math.min(worldStartZ, worldEndZ) - 1.8,
                    zMax: Math.max(worldStartZ, worldEndZ) + 1.8,
                    up,
                    yStart: bottomY - 0.53,
                    yEnd: topY - 0.53,
                    xStart: worldStartX,
                    xEnd: worldEndX,
                    zStart: worldStartZ,
                    zEnd: worldEndZ,
                    travelStartX: worldPathStartX,
                    travelStartZ: worldPathStartZ,
                    travelDir,
                    axis,
                    dir: travelDir,
                    flatLen: landingLen,
                    pathLenZ: runLen,
                    diagLenZ: diagRunLen,
                    pathStartY: up ? ESCALATOR_RIDE_Y_BOTTOM : anchorSlabTopY,
                    pathEndY: up ? anchorSlabTopY : ESCALATOR_RIDE_Y_BOTTOM,
                    isAnchorEscalator: true
                });
            };
            const slabZCenter = -10;
            const slabW = width - 0.8;
            const slabD = 29.2;
            const slabXHalf = slabW / 2;
            const slabZHalf = slabD / 2;
            const voidHalfW = anchorEscalatorVoidWidth / 2;
            const voidHalfL = anchorEscalatorVoidLength / 2;
            const leftStripW = slabXHalf - voidHalfW;
            const rightStripW = slabXHalf - voidHalfW;
            const frontStripD = slabZHalf - voidHalfL;
            const backStripD = slabZHalf - voidHalfL;
            const slabY = anchorSlabTopY - anchorSlabThickness / 2;


            m(width, 0.2, 30, 0, 0.02, slabZCenter, anchorFloorMat); // Suelo elevado 2cm para evitar z-fighting
            m(width + 2, 0.2, 30, 0, height, slabZCenter, whiteMat); // Techo sólido
            drawAnchorFloorWithGrid(width - 1.2, 28.8, 0.12, slabZCenter);
            // Extensión frontal: completa el piso hasta el muro de acceso interior.
            m(width, 0.2, 4.2, 0, 0.02, 7.1, anchorFloorMat);
            drawAnchorFloorWithGrid(width - 1.2, 3.8, 0.12, 7.1);



            m(leftStripW, anchorSlabThickness, slabD, -(voidHalfW + leftStripW / 2), slabY, slabZCenter, anchorFloorMat);
            m(rightStripW, anchorSlabThickness, slabD, (voidHalfW + rightStripW / 2), slabY, slabZCenter, anchorFloorMat);
            m(anchorEscalatorVoidWidth, anchorSlabThickness, frontStripD, 0, slabY, slabZCenter + (voidHalfL + frontStripD / 2), anchorFloorMat);
            m(anchorEscalatorVoidWidth, anchorSlabThickness, backStripD, 0, slabY, slabZCenter - (voidHalfL + backStripD / 2), anchorFloorMat);
            const frontEdge = new THREE.Mesh(new THREE.BoxGeometry(width - 0.6, 0.16, 0.24), goldMat);
            frontEdge.position.set(0, anchorSlabTopY + 0.02, 4.88); g.add(frontEdge);
            drawAnchorFloorWithGrid(leftStripW - 1.2, slabD - 1.4, anchorSlabTopY, slabZCenter);
            drawAnchorFloorWithGrid(rightStripW - 1.2, slabD - 1.4, anchorSlabTopY, slabZCenter);
            drawAnchorFloorWithGrid(anchorEscalatorVoidWidth - 1.1, frontStripD - 0.7, anchorSlabTopY, slabZCenter + (voidHalfL + frontStripD / 2));
            drawAnchorFloorWithGrid(anchorEscalatorVoidWidth - 1.1, backStripD - 0.7, anchorSlabTopY, slabZCenter - (voidHalfL + backStripD / 2));
            const longAxisOnX = voidHalfW >= voidHalfL;
            const escHalfWidth = 1.5; // Escala de 3.0 unidades
            const laneMargin = 0.25;
            const minorHalf = longAxisOnX ? voidHalfW : voidHalfL;
            const laneOffset = Math.max(0, minorHalf - escHalfWidth - laneMargin);

            if (longAxisOnX) {
                // Dos carriles paralelos sobre el lado largo, en sentidos opuestos.
                addAnchorDiagonalEscalator(voidHalfL, slabZCenter + laneOffset, -voidHalfL, slabZCenter + laneOffset, true);
                addAnchorDiagonalEscalator(voidHalfL, slabZCenter - laneOffset, -voidHalfL, slabZCenter - laneOffset, false);
            } else {
                // Dos carriles paralelos sobre el lado largo, en sentidos opuestos.
                addAnchorDiagonalEscalator(laneOffset, slabZCenter + voidHalfL, laneOffset, slabZCenter - voidHalfL, true);
                addAnchorDiagonalEscalator(-laneOffset, slabZCenter + voidHalfL, -laneOffset, slabZCenter - voidHalfL, false);
            }
            // Extensión frontal de la losa: tapa el hueco azul visible desde el interior.
            m(width - 0.8, anchorSlabThickness, 4.6, 0, anchorSlabTopY - anchorSlabThickness / 2, 7.0, anchorFloorMat);
            drawAnchorFloorWithGrid(width - 2.2, 4.0, anchorSlabTopY, 7.0);

            // Frontis planta baja con un orificio central, manteniendo los cierres laterales de la caja.
            m(width / 2 - 6, 5.4, 0.2, -(width / 4 + 3), 5.4 / 2, anchorFrontWallZ, whiteMat);
            m(width / 2 - 6, 5.4, 0.2, (width / 4 + 3), 5.4 / 2, anchorFrontWallZ, whiteMat);
            m(12, 1.4, 0.2, 0, 5.4 - 0.7, anchorFrontWallZ, whiteMat);
            m(width / 2 - 6, anchorUpperSideWallHeight, 0.2, -(width / 4 + 3), anchorUpperSideWallCenterY, anchorUpperFrontWallZ, whiteMat);
            m(width / 2 - 6, anchorUpperSideWallHeight, 0.2, (width / 4 + 3), anchorUpperSideWallCenterY, anchorUpperFrontWallZ, whiteMat);
            m(12, anchorUpperFrontWallHeight, 0.2, 0, anchorUpperFrontWallCenterY, anchorUpperFrontWallZ, whiteMat);
            // Bloques de esquina: se estiran hacia el muro lateral para cerrar la unión desde dentro.
            m(3.2, anchorFrontWallH, 4.2, -width / 2 + 1.6, anchorFrontWallH / 2, anchorFrontWallZ - 2.0, whiteMat);
            m(3.2, anchorFrontWallH, 4.2, width / 2 - 1.6, anchorFrontWallH / 2, anchorFrontWallZ - 2.0, whiteMat);
            addAnchorGateway(anchorFrontWallZ, 1);
            const addAnchorVoidRailings = () => {
                const railH = 1.1;
                const railThickness = 0.08;
                const handrailSize = 0.12;
                const glassMat = new THREE.MeshStandardMaterial({ color: 0xbfd7ef, transparent: true, opacity: 0.35, metalness: 0.1, roughness: 0.1 });
                const handrailMat = new THREE.MeshStandardMaterial({ color: 0xd0d5d9, metalness: 0.85, roughness: 0.15 }); // Acero pulido elegante

                const voidHalfW = anchorEscalatorVoidWidth / 2;
                const voidHalfL = anchorEscalatorVoidLength / 2;
                const slabZCenter = -10;

                const xRight = voidHalfW + railThickness / 2;
                const xLeft = -(voidHalfW + railThickness / 2);
                const zFront = slabZCenter + voidHalfL + railThickness / 2;
                const zBack = slabZCenter - (voidHalfL + railThickness / 2);

                const perimeterSpec = [
                    { id: 'front', axis: 'x', min: xLeft, max: xRight, fixed: zFront },
                    { id: 'right', axis: 'z', min: zBack, max: zFront, fixed: xRight },
                    { id: 'back', axis: 'x', min: xLeft, max: xRight, fixed: zBack },
                    { id: 'left', axis: 'z', min: zBack, max: zFront, fixed: xLeft }
                ];

                const perimeterMeta = [];
                let cumulative = 0;

                const drawPerimeterSegment = (spec) => {
                    const len = spec.max - spec.min;
                    if (len <= 0) return;

                    const glassW = spec.axis === 'x' ? len : railThickness;
                    const glassD = spec.axis === 'z' ? len : railThickness;
                    const centerX = spec.axis === 'x' ? (spec.min + spec.max) / 2 : spec.fixed;
                    const centerZ = spec.axis === 'z' ? (spec.min + spec.max) / 2 : spec.fixed;

                    const glass = new THREE.Mesh(new THREE.BoxGeometry(glassW, railH, glassD), glassMat);
                    glass.position.set(centerX, anchorSlabTopY + railH / 2, centerZ);
                    g.add(glass);

                    const hrLen = spec.axis === 'x' ? glassW + 0.05 : glassD + 0.05;
                    const hrGeom = new THREE.CylinderGeometry(handrailSize / 2, handrailSize / 2, hrLen, 16);
                    const hr = new THREE.Mesh(hrGeom, handrailMat);
                    hr.position.set(centerX, anchorSlabTopY + railH + handrailSize / 2, centerZ);
                    hr.rotation.z = spec.axis === 'x' ? Math.PI / 2 : 0;
                    hr.rotation.x = spec.axis === 'z' ? Math.PI / 2 : 0;
                    g.add(hr);


                    const cosR = Math.cos(rotY);
                    const sinR = Math.sin(rotY);
                    const worldX = posX + (centerX * cosR + centerZ * sinR);
                    const worldZ = posZ + (-centerX * sinR + centerZ * cosR);
                    const isRotated = Math.abs(sinR) > 0.5;
                    const baseW = isRotated ? glassD : glassW;
                    const baseD = isRotated ? glassW : glassD;

                    colliders.push({
                        minX: worldX - baseW / 2 - 0.2,
                        maxX: worldX + baseW / 2 + 0.2,
                        minZ: worldZ - baseD / 2 - 0.2,
                        maxZ: worldZ + baseD / 2 + 0.2,
                        minY: anchorSlabTopY,
                        maxY: anchorSlabTopY + 3.0 // Barrera alta para evitar bypass de la cámara
                    });
                };

                perimeterSpec.forEach((spec) => {
                    const segLen = spec.max - spec.min;
                    perimeterMeta.push({
                        id: spec.id,
                        axis: spec.axis,
                        fixed: spec.fixed,
                        min: spec.min,
                        max: spec.max,
                        startAt: cumulative,
                        endAt: cumulative + segLen
                    });
                    cumulative += segLen;
                });

                const makePerimeterLabel = (text) => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 256;
                    canvas.height = 128;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = 'rgba(0,0,0,0)';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = '#ff2a2a';
                    ctx.font = 'bold 72px Inter';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(String(text), canvas.width / 2, canvas.height / 2);
                    const tex = new THREE.CanvasTexture(canvas);
                    tex.needsUpdate = true;
                    return new THREE.Mesh(
                        new THREE.PlaneGeometry(0.42, 0.21),
                        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
                    );
                };

                const getPointAtPerimeterDistance = (distance) => {
                    const total = Math.max(0.001, cumulative);
                    let d = ((distance % total) + total) % total;
                    for (const seg of perimeterMeta) {
                        const segLen = seg.endAt - seg.startAt;
                        if (d > segLen) {
                            d -= segLen;
                            continue;
                        }
                        if (seg.axis === 'x') {
                            return { x: seg.min + d, z: seg.fixed };
                        }
                        return { x: seg.fixed, z: seg.min + d };
                    }
                    return { x: xLeft, z: zFront };
                };

                const drawPerimeterWithCuts = (cutRanges) => {
                    const total = Math.max(0.001, cumulative);
                    const normalizedCuts = cutRanges
                        .map((range) => ({
                            start: Math.max(0, Math.min(total, range.start)),
                            end: Math.max(0, Math.min(total, range.end))
                        }))
                        .filter((range) => range.end > range.start)
                        .sort((a, b) => a.start - b.start);
                    perimeterMeta.forEach((seg) => {
                        const segStart = seg.startAt, segEnd = seg.endAt;
                        const keepRanges = [{ min: seg.min, max: seg.max }];
                        normalizedCuts.forEach((cut) => {
                            if (cut.start >= segEnd || cut.end <= segStart) return;
                            const cutMinLocal = seg.min + Math.max(0, cut.start - segStart);
                            const cutMaxLocal = seg.min + Math.min(segEnd - segStart, cut.end - segStart);
                            for (let i = keepRanges.length - 1; i >= 0; i--) {
                                const kr = keepRanges[i];
                                if (cutMaxLocal <= kr.min || cutMinLocal >= kr.max) continue;
                                keepRanges.splice(i, 1);
                                if (cutMinLocal > kr.min + 0.0001) keepRanges.push({ min: kr.min, max: cutMinLocal });
                                if (cutMaxLocal < kr.max - 0.0001) keepRanges.push({ min: cutMaxLocal, max: kr.max });
                            }
                        });
                        keepRanges.forEach((range) => {
                            drawPerimeterSegment({
                                id: seg.id,
                                axis: seg.axis,
                                fixed: seg.fixed,
                                min: range.min,
                                max: range.max
                            });
                        });
                    });
                };

                const addCutEdgeMiniPillar = (distance) => {
                    const p = getPointAtPerimeterDistance(distance);
                    const pillarR = 0.06;
                    const pillarH = railH + handrailSize;
                    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(pillarR, pillarR, pillarH, 16), handrailMat);
                    pillar.position.set(p.x, anchorSlabTopY + pillarH / 2, p.z);
                    g.add(pillar);
                    
                    const cap = new THREE.Mesh(new THREE.SphereGeometry(pillarR + 0.015, 16, 16), handrailMat);
                    cap.position.set(p.x, anchorSlabTopY + pillarH, p.z);
                    g.add(cap);
                };

                const drawHighlightedRange = (startDistance, endDistance, color = 0xff2a2a) => {
                    const total = Math.max(0.001, cumulative);
                    const start = Math.max(0, Math.min(total, startDistance));
                    const end = Math.max(0, Math.min(total, endDistance));
                    if (end <= start) return;
                    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.15 });
                    const step = 0.1;
                    for (let d = start; d < end; d += step) {
                        const dNext = Math.min(end, d + step);
                        const p1 = getPointAtPerimeterDistance(d);
                        const p2 = getPointAtPerimeterDistance(dNext);
                        const dx = p2.x - p1.x;
                        const dz = p2.z - p1.z;
                        const segLen = Math.hypot(dx, dz);
                        if (segLen <= 0.0001) continue;
                        const mesh = new THREE.Mesh(
                            new THREE.BoxGeometry(segLen, handrailSize + 0.03, railThickness + 0.1),
                            mat
                        );
                        mesh.position.set((p1.x + p2.x) / 2, anchorSlabTopY + railH + handrailSize / 2 + 0.02, (p1.z + p2.z) / 2);
                        mesh.rotation.y = Math.atan2(dx, dz);
                        g.add(mesh);
                    }
                };

                // (La numeración de control perimetral fue eliminada tras finalizar la auditoría geométrica)
                // Tramos solicitados para las entradas de ambas escalas mecánicas
                const cutRanges = [
                    { start: 11.8, end: 14.8 },     // Escala Derecha
                    { start: 32.83, end: 35.83 }    // Escala Izquierda
                ];

                drawPerimeterWithCuts(cutRanges);
                cutRanges.forEach((cut) => {
                    addCutEdgeMiniPillar(cut.start);
                    addCutEdgeMiniPillar(cut.end);
                });
                // drawHighlightedRange(32.83, 35.83); // Franja roja desactivada

                g.userData.voidRailingPerimeter = {
                    totalLength: cumulative,
                    segments: perimeterMeta,
                    cutRange: cutRanges
                };
            };
            addAnchorVoidRailings();
            addAnchorUpperGateway();

            // Paredes laterales
            m(0.2, height, 30, -width / 2, height / 2, slabZCenter, whiteMat);
            m(0.2, height, 30, width / 2, height / 2, slabZCenter, whiteMat);

            // Muro trasero SEPARADO: Planta Baja (con hueco) y Planta Alta (CERRADO)
            // 1. Planta Baja (Puerta de 12m de ancho y 5.4m de alto)
            m(width / 2 - 6, 5.4, 0.2, -(width / 4 + 3), 5.4 / 2, -25, whiteMat);
            m(width / 2 - 6, 5.4, 0.2, (width / 4 + 3), 5.4 / 2, -25, whiteMat);
            m(12, 1.4, 0.2, 0, 5.4 - 0.7, -25, whiteMat); // Dintel de la puerta
            addAnchorGateway(-25, -1);

            // 2. Planta Alta (MURO TOTALMENTE CERRADO para seguridad)
            m(width, height - 5.4, 0.2, 0, 5.4 + (height - 5.4) / 2, -25, whiteMat);

            m(width + 2, 2.5, 0.8, 0, height + 1.25, 5, goldMat);
            const sM = new THREE.Mesh(new THREE.PlaneGeometry(width, 2), new THREE.MeshBasicMaterial({ map: createSignTexture(name), transparent: true }));
            sM.position.set(0, height + 1.25, 5.45); g.add(sM);
            g.userData.ensureDetailedInterior = ensureDetailedInterior;
            g.userData.detailedInteriorGroup = detailedInterior;
            g.userData.interiorDetailFade = 0;
            g.userData.interiorDetailVisible = false;
            registerInteriorFogZone(g, -width / 2 + 0.35, width / 2 - 0.35, -24.7, 8.9, 0.05, height - 0.05);
            return g;
        }
        // --- TIENDAS ANCLA (RESTAURACIÓN ESTRUCTURAL CON SALIDAS) ---
        const sAnchor = createAnchorStore(0, -100, 70, 15, "MALL SUR", "S", 0);
        storeGroups["S"] = sAnchor;
        scene.add(sAnchor);
        registerCollider(-20.5, -125, 29, 1, 0, 15); // Muro Frontal Izq (Sur)
        registerCollider(20.5, -125, 29, 1, 0, 15);  // Muro Frontal Der (Sur)

        const nAnchor = createAnchorStore(0, 100, 70, 15, "MALL NORTE", "N", Math.PI);
        storeGroups["N"] = nAnchor;
        scene.add(nAnchor);
        registerCollider(-20.5, 125, 29, 1, 0, 15); // Muro Frontal Izq (Norte - Puerta Boulevard)
        registerCollider(20.5, 125, 29, 1, 0, 15);  // Muro Frontal Der (Norte - Puerta Boulevard)

        const eAnchor = createAnchorStore(100, 0, 70, 15, "MALL ESTE", "E", -Math.PI / 2);
        storeGroups["E"] = eAnchor;
        scene.add(eAnchor);
        registerCollider(125, -20.5, 1, 29, 0, 15); // Muro Frontal (Este)
        registerCollider(125, 20.5, 1, 29, 0, 15);

        const wAnchor = createAnchorStore(-100, 0, 70, 15, "MALL OESTE", "O", Math.PI / 2);
        storeGroups["O"] = wAnchor;
        scene.add(wAnchor);
        registerCollider(-125, -20.5, 1, 29, 0, 15); // Muro Frontal (Oeste)
        registerCollider(-125, 20.5, 1, 29, 0, 15);

        function createDoorLabelTexture(text) {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = 'rgba(201,166,107,0.9)';
            ctx.lineWidth = 4;
            ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
            ctx.fillStyle = '#f1e5c8';
            ctx.font = '700 58px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(text || '').toUpperCase(), canvas.width / 2, canvas.height / 2);
            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.needsUpdate = true;
            return texture;
        }

        function createCorridorAccessDoor(worldX, worldZ, rotationY = 0, variant = 'outer', doorCode = '') {
            const doorGroup = new THREE.Group();
            const isOuterDoor = variant === 'outer';
            const innerLateralOffset = isOuterDoor ? 0 : -2.2;
            const innerDepthOffset = isOuterDoor ? 0 : -10;
            const manualOffsetX = doorCode === 'OS' ? 6.2 : doorCode === 'OS_COPY' ? 6.2 : doorCode === 'ON' ? 6.2 : doorCode === 'ON_COPY' ? 6.2 : doorCode === 'SO' ? 5.5 : doorCode === 'SO_COPY' ? 23.5 : doorCode === 'SE' ? 14 : doorCode === 'ES' ? -1.8 : doorCode === 'ES_COPY' ? -1.8 : doorCode === 'NE' ? 14.5 : doorCode === 'NE_COPY' ? -3.4 : doorCode === 'NO' ? 5.5 : doorCode === 'NO_COPY' ? 23.5 : doorCode === 'EN' ? -1.8 : doorCode === 'EN_COPY' ? -1.7 : doorCode === 'SE_COPY' ? -3 : 0;
            const manualOffsetZ = doorCode === 'OS' ? 5.6 : doorCode === 'OS_COPY' ? 23.5 : doorCode === 'ON' ? 14.4 : doorCode === 'ON_COPY' ? -3.3 : doorCode === 'SO' ? 1.8 : doorCode === 'SO_COPY' ? 1.8 : doorCode === 'SE' ? 1.9 : doorCode === 'ES' ? 5.6 : doorCode === 'ES_COPY' ? 23.5 : doorCode === 'NE' ? -6.3 : doorCode === 'NE_COPY' ? -6.2 : doorCode === 'NO' ? -6.2 : doorCode === 'NO_COPY' ? -6.2 : doorCode === 'EN' ? 14.4 : doorCode === 'EN_COPY' ? -3.3 : doorCode === 'SE_COPY' ? 1.9 : 0;
            const offsetX = Math.cos(rotationY) * innerLateralOffset;
            const offsetZ = -Math.sin(rotationY) * innerLateralOffset;
            const depthOffsetX = Math.sin(rotationY) * innerDepthOffset;
            const depthOffsetZ = Math.cos(rotationY) * innerDepthOffset;
            doorGroup.position.set(worldX + offsetX + depthOffsetX + manualOffsetX, 0, worldZ + offsetZ + depthOffsetZ + manualOffsetZ);
            doorGroup.rotation.y = rotationY;

            const clearWidth = isOuterDoor ? 13.4 : 7.5;
            const measuredPassageWidth = isOuterDoor ? clearWidth : 6.0;
            const clearHeight = 5.0;
            const frameDepth = 0.2;
            const sideLightWidth = isOuterDoor ? 3.05 : 0.45;
            const centerDividerWidth = isOuterDoor ? 0.08 : 0.12;
            const bayCount = isOuterDoor ? 1 : 2;
            const slidingBayWidth = isOuterDoor ? 6.15 : (clearWidth - sideLightWidth * 2 - centerDividerWidth) / 2;
            const leafWidth = isOuterDoor ? 2.9 : slidingBayWidth / 2 + 0.05;
            const leafCenterOffset = isOuterDoor ? 0.95 : slidingBayWidth / 4;
            const slideDistance = isOuterDoor ? 1.05 : slidingBayWidth * 0.24;
            const topFillHeight = 1.0;
            const emphasizedHorizontalFrames = doorCode === 'SO_COPY' || doorCode === 'ES_COPY' || doorCode === 'NO_COPY';

            const frameMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.32, metalness: 0.78 });
            const accentMat = new THREE.MeshStandardMaterial({ color: 0x8f7746, roughness: 0.22, metalness: 0.88 });
            const doorGlassMat = new THREE.MeshPhysicalMaterial({
                color: 0xf8fbff,
                transmission: 0.74,
                transparent: true,
                opacity: 0.5,
                metalness: 0.14,
                roughness: 0.05
            });
            const guideLineMat = new THREE.MeshBasicMaterial({ color: 0xf4d03f });

            const addPanel = (w, h, x, y, z, material) => {
                const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, frameDepth), material);
                panel.position.set(x, y, z);
                doorGroup.add(panel);
                return panel;
            };

            if (!isOuterDoor) {
                const guideLine = new THREE.Mesh(new THREE.PlaneGeometry(measuredPassageWidth, 0.18), guideLineMat);
                guideLine.rotation.x = -Math.PI / 2;
                guideLine.position.set(0, 0.03, 0.72);
                doorGroup.add(guideLine);
            }

            addPanel(clearWidth + 0.32, 0.14, 0, clearHeight + 0.07, 0, accentMat);
            addPanel(clearWidth + 0.32, 0.08, 0, 0.04, 0, frameMat);
            addPanel(0.14, clearHeight + 0.14, -clearWidth / 2 - 0.02, clearHeight / 2, 0, frameMat);
            addPanel(0.14, clearHeight + 0.14, clearWidth / 2 + 0.02, clearHeight / 2, 0, frameMat);

            if (emphasizedHorizontalFrames) {
                addPanel(clearWidth + 0.38, 0.18, 0, clearHeight + 0.09, 0, frameMat);
                addPanel(clearWidth + 0.38, 0.16, 0, 0.08, 0, frameMat);
            }

            if (doorCode === 'ES_COPY') {
                addPanel(clearWidth + 0.38, 0.16, 0, clearHeight - 0.08, 0, frameMat);
            }

            if (sideLightWidth > 0.01) {
                addPanel(sideLightWidth, clearHeight - 0.18, -(clearWidth / 2 - sideLightWidth / 2), (clearHeight - 0.18) / 2 + 0.08, 0, doorGlassMat);
                addPanel(sideLightWidth, clearHeight - 0.18, (clearWidth / 2 - sideLightWidth / 2), (clearHeight - 0.18) / 2 + 0.08, 0, doorGlassMat);
            }

            const bayCenters = bayCount === 1
                ? [0]
                : [
                    -(centerDividerWidth / 2 + slidingBayWidth / 2),
                    centerDividerWidth / 2 + slidingBayWidth / 2
                ];

            const createSwingLeaf = (bayCenter, hingeSide = 'left') => {
                const swingPivot = new THREE.Group();
                const hingeX = hingeSide === 'left'
                    ? bayCenter - slidingBayWidth / 2 + 0.05
                    : bayCenter + slidingBayWidth / 2 - 0.05;
                swingPivot.position.set(hingeX, 0, 0);
                doorGroup.add(swingPivot);

                const leaf = new THREE.Group();
                leaf.position.set(hingeSide === 'left' ? leafWidth / 2 : -leafWidth / 2, 0, 0);
                swingPivot.add(leaf);

                const glass = new THREE.Mesh(new THREE.BoxGeometry(leafWidth, clearHeight - 0.24, 0.05), doorGlassMat);
                glass.position.set(0, (clearHeight - 0.24) / 2 + 0.09, 0);
                leaf.add(glass);

                const topFrame = new THREE.Mesh(new THREE.BoxGeometry(leafWidth + 0.08, 0.07, 0.06), frameMat);
                topFrame.position.y = clearHeight - 0.16;
                leaf.add(topFrame);

                const bottomFrame = new THREE.Mesh(new THREE.BoxGeometry(leafWidth + 0.08, 0.05, 0.06), frameMat);
                bottomFrame.position.y = 0.08;
                leaf.add(bottomFrame);

                const sideFrame = new THREE.Mesh(new THREE.BoxGeometry(0.05, clearHeight - 0.22, 0.06), frameMat);
                sideFrame.position.set(-leafWidth / 2, clearHeight / 2 - 0.02, 0);
                leaf.add(sideFrame);

                const oppositeFrame = sideFrame.clone();
                oppositeFrame.position.x = leafWidth / 2;
                leaf.add(oppositeFrame);

                const frontHandle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.95, 0.06), accentMat);
                frontHandle.position.set(
                    hingeSide === 'left' ? leafWidth / 2 - 0.2 : -(leafWidth / 2 - 0.2),
                    clearHeight / 2 - 0.02,
                    0.055
                );
                leaf.add(frontHandle);

                const backHandle = frontHandle.clone();
                backHandle.position.z = -0.055;
                leaf.add(backHandle);

                return swingPivot;
            };

            bayCenters.forEach((bayCenter, bayIndex) => {
                const leftSwingPivot = createSwingLeaf(bayCenter, 'left');
                const rightSwingPivot = createSwingLeaf(bayCenter, 'right');

                addPanel(slidingBayWidth - 0.08, topFillHeight, bayCenter, clearHeight - topFillHeight / 2 - 0.11, 0, doorGlassMat);
                addPanel(0.08, clearHeight - 0.12, bayCenter - slidingBayWidth / 2, clearHeight / 2, 0, frameMat);
                addPanel(0.08, clearHeight - 0.12, bayCenter + slidingBayWidth / 2, clearHeight / 2, 0, frameMat);
                addPanel(slidingBayWidth + 0.12, 0.08, bayCenter, clearHeight - 0.08, 0, frameMat);

                corridorSlidingDoors.push({
                    group: doorGroup,
                    leftLeaf: leftSwingPivot,
                    rightLeaf: rightSwingPivot,
                    leftClosedX: leftSwingPivot.position.x,
                    rightClosedX: rightSwingPivot.position.x,
                    leftClosedZ: leftSwingPivot.position.z,
                    rightClosedZ: rightSwingPivot.position.z,
                    triggerCenterX: bayCenter,
                    triggerHalfWidth: slidingBayWidth / 2 + 0.8,
                    triggerDepth: CORRIDOR_DOOR_TRIGGER_DEPTH,
                    frontZ: CORRIDOR_DOOR_FRONT_Z,
                    swingAngle: CORRIDOR_DOOR_SWING_ANGLE,
                    swingSign: bayIndex === 0 ? -1 : 1,
                    openAmount: 0,
                    openUntil: 0
                });

                const labelText = bayIndex === 0 ? 'Entrada' : 'Salida';
                const labelMat = new THREE.MeshBasicMaterial({
                    map: createDoorLabelTexture(labelText),
                    transparent: true,
                    depthWrite: false
                });
                const label = new THREE.Mesh(new THREE.PlaneGeometry(slidingBayWidth - 0.34, 0.42), labelMat);
                label.position.set(bayCenter, clearHeight - 0.56, 0.035);
                doorGroup.add(label);
            });

            if (!isOuterDoor) {
                addPanel(centerDividerWidth, clearHeight - 0.12, 0, clearHeight / 2, 0, accentMat);
            } else {
                addPanel(0.08, clearHeight - 0.12, 0, clearHeight / 2, 0, accentMat);
            }

            scene.add(doorGroup);
        }

        function createAllSideCorridorAccessDoors() {
            const southNorthX = 30.5;
            const eastWestZ = 30.5;
            const innerZ = 90.95;
            const outerZ = 144.0;
            const innerX = 90.95;
            const outerX = 144.0;
            const outerLateralShift = 6.2;

            // Pasillos de anclas Norte y Sur
            [-southNorthX, southNorthX].forEach((x) => {
                createCorridorAccessDoor(x, -innerZ, Math.PI / 2, 'inner', x > 0 ? 'SE' : 'SO');
                if (x < 0) createCorridorAccessDoor(x, -innerZ, Math.PI / 2, 'inner', 'SO_COPY');
                if (x > 0) createCorridorAccessDoor(x, -innerZ, Math.PI / 2, 'inner', 'SE_COPY');
                createCorridorAccessDoor(x, innerZ, Math.PI / 2, 'inner', x > 0 ? 'NE' : 'NO');
                if (x < 0) createCorridorAccessDoor(x, innerZ, Math.PI / 2, 'inner', 'NO_COPY');
                if (x > 0) createCorridorAccessDoor(x, innerZ, Math.PI / 2, 'inner', 'NE_COPY');
            });

            // Pasillos de anclas Este y Oeste
            [-eastWestZ, eastWestZ].forEach((z) => {
                createCorridorAccessDoor(-innerX, z, 0, 'inner', z < 0 ? 'OS' : 'ON');
                if (z < 0) createCorridorAccessDoor(-innerX, z, 0, 'inner', 'OS_COPY');
                if (z > 0) createCorridorAccessDoor(-innerX, z, 0, 'inner', 'ON_COPY');
                createCorridorAccessDoor(innerX, z, 0, 'inner', z < 0 ? 'ES' : 'EN');
                if (z < 0) createCorridorAccessDoor(innerX, z, 0, 'inner', 'ES_COPY');
                if (z > 0) createCorridorAccessDoor(innerX, z, 0, 'inner', 'EN_COPY');
            });
        }

        createAllSideCorridorAccessDoors();

        // --- ANEXO: BOULEVARD & FOOD COURT (ALA NORTE RE-VINCULADA) ---
        function createBoulevardArea() {
            const bX = 0, bZ = 170;
            // 1. Suelo del Boulevard (Terracota)
            const floorGeo = new THREE.PlaneGeometry(120, 90);
            const floorMat = new THREE.MeshStandardMaterial({ color: 0xd2691e, roughness: 0.8 });
            const floor = new THREE.Mesh(floorGeo, floorMat);
            floor.rotation.x = -Math.PI / 2; floor.position.set(bX, 0.1, bZ); scene.add(floor);

            // Conector con el Mall (Ajustado para atravesar la tienda norte)
            const conn = new THREE.Mesh(new THREE.PlaneGeometry(20, 30), floorMat);
            conn.rotation.x = -Math.PI / 2; conn.position.set(0, 0.1, 110); scene.add(conn);

            // 2. Torre de Publicidad Central PRO
            const towerG = new THREE.Group(); towerG.position.set(bX, 0, bZ);
            const adLogos = ["BINANCE", "HONEYGAIN", "QUANTUM", "TRADING"];
            const adColors = [0xf3ba2f, 0xffa500, 0x00ffff, 0xff00ff];
            for (let i = 0; i < 4; i++) {
                const screen = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 7), new THREE.MeshStandardMaterial({ color: adColors[i], metalness: 0.5, roughness: 0.2 }));
                screen.position.y = 2.5 + (i * 6); towerG.add(screen);

                // Pantallas en las 4 caras
                for (let j = 0; j < 4; j++) {
                    const idTex = createSignTexture(adLogos[i], true);
                    const p = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ map: idTex, transparent: true }));
                    p.rotation.y = (Math.PI / 2) * j;
                    p.position.set(
                        Math.sin((Math.PI / 2) * j) * 3.51,
                        2.5 + (i * 6),
                        Math.cos((Math.PI / 2) * j) * 3.51
                    );
                    towerG.add(p);
                }
            }
            scene.add(towerG);
            registerCollider(bX, bZ, 8, 8, 0, 30);

            // 3. Mesas con Parasoles Azules (Food Court)
            function createParasolSet(px, pz) {
                const gr = new THREE.Group(); gr.position.set(px, 0.1, pz);
                const table = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.1), whiteMat); table.position.y = 0.9; gr.add(table);
                const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.5), darkMat); pole.position.y = 1.75; gr.add(pole);
                const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0, 3, 1, 16), new THREE.MeshStandardMaterial({ color: 0x0000ff }));
                canopy.position.y = 3.5; gr.add(canopy);
                scene.add(gr);
                registerCollider(px, pz, 2.5, 2.5, 0, 5);
            }
            [[25, 140], [-25, 140], [25, 180], [-25, 180], [40, 160], [-40, 160]].forEach(p => createParasolSet(p[0], p[1]));

            // 4. Tiendas del Boulevard (Colores planos y vivos como pidió el usuario)
            const bLabels = ["BURGER", "TACO", "PIZZA", "SUSHI", "CAFE"];
            const bCols = [0xff0055, 0x00ff77, 0x0088ff, 0xffaa00, 0x9955ff];
            for (let i = -2; i <= 2; i++) {
                const sX = i * 25; const sZ = 205;
                const shop = new THREE.Group(); shop.position.set(sX, 0, sZ);
                const box = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 12), new THREE.MeshStandardMaterial({ color: bCols[i + 2] }));
                box.position.y = 5; shop.add(box);

                const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshBasicMaterial({ map: createSignTexture(bLabels[i + 2]) }));
                sign.position.set(0, 8, 6.01); shop.add(sign);

                scene.add(shop);
                registerCollider(sX, sZ, 20, 12, 0, 10);
            }
        }
        createBoulevardArea();

        // --- COLISIÓN TORRE CENTRAL Y FUENTE ---
        registerCollider(0, 0, 8, 8, 0, 30); // El núcleo central es sólido

        // --- MUEBLES PLAZA CENTRAL (Sólidos) ---
        function createTableSet(x, z) {
            const gr = new THREE.Group(); gr.position.set(x, 0.1, z);
            const table = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.1), whiteMat); table.position.y = 1.0; gr.add(table);
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1), darkMat); pole.position.y = 0.5; gr.add(pole);
            scene.add(gr);
            registerCollider(x, z, 2.2, 2.2, 0, 3);
        }
        createTableSet(10, 10); createTableSet(-10, 10); createTableSet(10, -10); createTableSet(-10, -10);

        // --- URBANISMO Y PAISAJISMO EXTERIOR ---
        const grassMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 }); // Verde pasto
        const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 }); // Gris asfalto
        const roadLineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

        function createExterior() {
            // Plano de Pasto General
            const grass = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), grassMat);
            grass.rotation.x = -Math.PI / 2;
            grass.position.y = -0.05; // Ligeramente bajo el suelo del mall
            scene.add(grass);

            // Veredas Perimetrales (Anillo de Asfalto Unificado)
            const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), asphaltMat);
            sidewalk.rotation.x = -Math.PI / 2;
            sidewalk.position.y = -0.02;
            scene.add(sidewalk);


            // Estacionamientos (4 Esquinas)
            const pkgPos = [[70, 70], [-70, 70], [70, -70], [-70, -70]];
            pkgPos.forEach(p => {
                const pkg = new THREE.Mesh(new THREE.BoxGeometry(60, 0.2, 60), asphaltMat);
                pkg.position.set(p[0] * 1.8, 0, p[1] * 1.8);
                scene.add(pkg);
                // Líneas de parqueo básicas
                for (let i = -25; i <= 25; i += 5) {
                    const line = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 10), roadLineMat);
                    line.position.set(pkg.position.x + i, 0.15, pkg.position.z); scene.add(line);
                }
            });

            // --- PALMAS TROPICALES EXTERIORES ---
            const createPalm = (x, z) => {
                const p = new THREE.Group(); p.position.set(x, 0, z);
                
                // Tronco de Palma (Segmentado para realismo)
                const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 1.0 });
                for(let i=0; i<10; i++) {
                    const radius = 0.35 - (i * 0.015);
                    const segment = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius+0.05, 1.0, 8), trunkMat);
                    segment.position.y = 0.5 + i * 0.9;
                    segment.rotation.y = i * 0.8; 
                    p.add(segment);
                }

                // Hojas de Palma (Frondas arqueadas)
                const palmLeafMat = new THREE.MeshStandardMaterial({ color: 0x2e5a1c, roughness: 0.7 });
                for (let i = 0; i < 14; i++) {
                    const leafGroup = new THREE.Group();
                    leafGroup.position.y = 9.2;
                    leafGroup.rotation.y = (i * Math.PI * 2) / 14;
                    
                    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 5.5), palmLeafMat);
                    leaf.position.z = 2.5;
                    leaf.rotation.x = -0.4 - (Math.random() * 0.2); 
                    leafGroup.add(leaf);
                    p.add(leafGroup);
                }
                scene.add(p);
            };

            // Plantación simétrica de palmas
            for (let i = -120; i <= 120; i += 40) {
                if (Math.abs(i) < 20) continue;
                createPalm(i, 130); createPalm(i, -130);
                createPalm(130, i); createPalm(-130, i);
            }
        }
        createExterior();

        function createSmallIDTexture(text) {
            const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#c9a66b'; ctx.fillRect(0, 0, 512, 128); // Fondo Oro
            ctx.strokeStyle = '#222222'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, 502, 118);
            ctx.fillStyle = '#000000'; ctx.font = 'bold 80px "Inter"';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(text, 256, 64);
            return new THREE.CanvasTexture(canvas);
        }

        // URBANISMO INTERIOR: Maceteros con árboles estilizados
        function createPlanter(x, z) {
            const gr = new THREE.Group(); gr.position.set(x, 0, z);
            
            // Macetero de Diseño (Base Mármol Negro + Borde Oro)
            const marbleMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.5 });
            const potBase = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1, 1, 8), marbleMat);
            potBase.position.y = 0.5; gr.add(potBase);
            
            const potRim = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.15, 8), goldMat);
            potRim.position.y = 1; gr.add(potRim);
            
            // Tierra / Sustrato con textura simulada
            const dirt = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0x2b1e14, roughness: 1 }));
            dirt.position.y = 0.95; gr.add(dirt);

            // Tronco con ramificación simple
            const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.9 });
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, 3.2, 6), trunkMat); 
            trunk.position.y = 2.4; gr.add(trunk);

            // Rama secundaria
            const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 1, 4), trunkMat);
            branch.position.set(0.15, 3.2, 0.15);
            branch.rotation.z = 0.4;
            gr.add(branch);

            // Follaje "Cloud" (Agrupación densa de esferas orgánicas)
            const leafMat = new THREE.MeshStandardMaterial({ color: 0x224411, roughness: 0.6, metalness: 0.1 });
            const leafMatLight = new THREE.MeshStandardMaterial({ color: 0x336622, roughness: 0.5, metalness: 0.1 });
            const leafMatDark = new THREE.MeshStandardMaterial({ color: 0x112200, roughness: 0.7, metalness: 0.1 });
            
            // Generar una nube de hojas más realista
            const foliagePoints = [
                { p: [0, 4.2, 0], s: 0.95 },
                { p: [0.6, 3.8, 0.4], s: 0.75 },
                { p: [-0.5, 3.9, -0.6], s: 0.8 },
                { p: [0.4, 3.6, -0.7], s: 0.65 },
                { p: [-0.7, 3.7, 0.3], s: 0.7 },
                { p: [0.2, 4.5, -0.2], s: 0.6 },
                { p: [-0.3, 4.4, 0.5], s: 0.55 },
                { p: [0.8, 3.3, -0.2], s: 0.5 },
                { p: [-0.6, 3.4, -0.1], s: 0.45 }
            ];
            
            foliagePoints.forEach((f, idx) => {
                let m = leafMat;
                if (idx % 3 === 1) m = leafMatLight;
                if (idx % 3 === 2) m = leafMatDark;
                
                const blob = new THREE.Mesh(new THREE.SphereGeometry(f.s, 8, 8), m);
                blob.position.set(f.p[0], f.p[1], f.p[2]);
                // Variación de escala para romper la simetría
                blob.scale.set(1 + Math.random()*0.2, 0.7 + Math.random()*0.3, 1 + Math.random()*0.2);
                gr.add(blob);
            });

            scene.add(gr);
            registerCollider(x, z, 2.5, 2.5, 0, 4);
        }
        function createBench(x, z, rot) {
            const gr = new THREE.Group(); gr.position.set(x, 0.1, z); gr.rotation.y = rot;
            const base = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 1.5), darkMat); base.position.y = 0.1; gr.add(base);
            const seat = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.4, 1.7), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.1 })); seat.position.y = 0.4; gr.add(seat);
            scene.add(gr);
        }

        // FUENTE CENTRAL
        function createCentralFountain() {
            const gr = new THREE.Group(); gr.position.set(0, 0.1, 0);
            const basin = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.5, 0.8, 32), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.5 })); gr.add(basin);
            const water = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, 0.1, 32), new THREE.MeshPhysicalMaterial({ color: 0x88ccff, transmission: 0.5, transparent: true, opacity: 0.6, roughness: 0 }));
            water.position.y = 0.4; gr.add(water);
            const monolith = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 2), goldMat); monolith.position.y = 3; gr.add(monolith);
            scene.add(gr);
        }

        // PANTALLAS DIGITALES LED CON ROTACIÓN
        const adTexts = [
            { t: "ROLEX: EXCELLENCE", c: "#000000", tc: "#c9a66b" },
            { t: "GUCCI: SPRING 2026", c: "#4a148c", tc: "#ffffff" },
            { t: "TESLA: NEW GEN", c: "#1a237e", tc: "#ffffff" },
            { t: "SAMSUNG: QUANTUM", c: "#004d40", tc: "#00ffcc" },
            { t: "NESPRESSO: COFFEE", c: "#3e2723", tc: "#ecd0a4" }
        ];
        const adTextures = adTexts.map(ad => {
            const canvas = document.createElement('canvas'); canvas.width = IS_COARSE_POINTER ? 512 : 768; canvas.height = IS_COARSE_POINTER ? 256 : 384;
            const ctx = canvas.getContext('2d');
            const w = canvas.width;
            const h = canvas.height;
            ctx.fillStyle = ad.c; ctx.fillRect(0, 0, w, h); // Fondo Marca
            ctx.strokeStyle = ad.tc; ctx.lineWidth = IS_COARSE_POINTER ? 18 : 24; ctx.strokeRect(14, 14, w - 28, h - 28);
            ctx.fillStyle = ad.tc; ctx.font = `bold ${IS_COARSE_POINTER ? 42 : 62}px "Inter"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(ad.t, w / 2, h / 2);
            return new THREE.CanvasTexture(canvas);
        });

        const screenMeshes = [];
        function createDigitalScreen(x, y, z, rot) {
            const gr = new THREE.Group(); gr.position.set(x, y, z); gr.rotation.y = rot;
            const frame = new THREE.Mesh(new THREE.BoxGeometry(10.2, 5.2, 0.4), darkMat); gr.add(frame);
            const screen = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshBasicMaterial({ map: adTextures[0] }));
            screen.position.z = 0.21; gr.add(screen);
            screenMeshes.push(screen);
            scene.add(gr);
        }

        function createEscalatorTexture() {
            const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#888888'; ctx.fillRect(0, 0, 128, 128); // Base metálica
            ctx.fillStyle = '#111111';
            // Franjas longitudinales (ranuras dentadas)
            for (let i = 0; i < 128; i += 6) {
                ctx.fillRect(i, 0, 2, 128);
            }
            // Bordes amarillos de seguridad (típicos)
            ctx.fillStyle = '#ffcc00'; ctx.fillRect(0, 0, 5, 128); ctx.fillRect(123, 0, 5, 128);
            const tex = new THREE.CanvasTexture(canvas);
            tex.wrapT = tex.wrapS = THREE.RepeatWrapping;
            tex.repeat.set(1, 15); // Repetición a lo largo de la rampa
            return tex;
        }

        function createEscalatorSign(text, color) {
            const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 128, 128);
            ctx.fillStyle = color; ctx.font = 'bold 80px "Inter"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(text, 64, 64);
            ctx.strokeStyle = color; ctx.lineWidth = 10; ctx.strokeRect(5, 5, 118, 118);
            return new THREE.CanvasTexture(canvas);
        }

        function createEscalator(x, zStart, zEnd, up = true) {
            const h = 5.4;
            let dist = zEnd - zStart;
            const flatLen = ESCALATOR_FLAT_LEN;
            const gr = new THREE.Group(); gr.position.set(x, -0.53, zStart);
            const dir = Math.sign(dist);
            const travelStartZ = up ? zStart : zEnd;
            const travelDir = up ? dir : -dir;
            const pathLenZ = Math.abs(dist);
            const diagLenZ = Math.max(0.001, pathLenZ - (flatLen * 2));
            const pathStartY = up ? ESCALATOR_RIDE_Y_BOTTOM : ESCALATOR_RIDE_Y_TOP;
            const pathEndY = up ? ESCALATOR_RIDE_Y_TOP : ESCALATOR_RIDE_Y_BOTTOM;

            // Guardar para colisiones (enrasado al suelo -0.53)
            escalatorList.push({
                id: escalatorList.length,
                x,
                xMin: x - 2.5,
                xMax: x + 2.5,
                zMin: Math.min(zStart, zEnd),
                zMax: Math.max(zStart, zEnd),
                up,
                yStart: -0.53,
                yEnd: h - 0.53,
                xStart: x,
                xEnd: x,
                zStart,
                zEnd,
                travelStartX: x,
                travelStartZ,
                travelDir,
                axis: 'z',
                dir,
                flatLen,
                pathLenZ,
                diagLenZ,
                pathStartY,
                pathEndY
            });

            const matGrey = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5 });
            const escText = createEscalatorTexture();
            const matStep = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, map: escText, metalness: 0.8, roughness: 0.2 });

            const ang = Math.atan2(h, diagLenZ);
            const diagLenH = Math.sqrt(h * h + diagLenZ * diagLenZ);

            const cw = (w, h_box, d, px, py, pz, mat, rx = 0) => {
                const b = new THREE.Mesh(new THREE.BoxGeometry(w, h_box, d), mat);
                b.position.set(px, py, pz); b.rotation.x = rx; gr.add(b);
            };

            cw(3.5, 1.2, flatLen, 0, 0, flatLen / 2 * dir, matGrey);
            cw(3.5, 1.2, diagLenH, 0, h / 2, (flatLen + diagLenZ / 2) * dir, matGrey, -ang * dir);
            cw(3.5, 1.2, flatLen, 0, h, (flatLen + diagLenZ + flatLen / 2) * dir, matGrey);

            cw(2.5, 0.1, flatLen, 0, 0.65, flatLen / 2 * dir, matStep);
            cw(2.5, 0.1, diagLenH, 0, h / 2 + 0.65, (flatLen + diagLenZ / 2) * dir, matStep, -ang * dir);
            cw(2.5, 0.1, flatLen, 0, h + 0.65, (flatLen + diagLenZ + flatLen / 2) * dir, matStep);

            // Indicador de dirección
            const signTex = createEscalatorSign(up ? '↑' : '↓', up ? '#00ff44' : '#ff4400');
            const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: signTex }));
            sign.position.set(0, 1.5, (dir > 0 ? 0 : -0.2)); gr.add(sign);

            [1.4, -1.4].forEach(side => {
                cw(0.05, 1.2, flatLen, side, 1.2, flatLen / 2 * dir, glassMat);
                cw(0.05, 1.2, diagLenH, side, h / 2 + 1.2, (flatLen + diagLenZ / 2) * dir, glassMat, -ang * dir);
                cw(0.05, 1.2, flatLen, side, h + 1.2, (flatLen + diagLenZ + flatLen / 2) * dir, glassMat);
                cw(0.15, 0.15, flatLen + 1, side, 1.8, (flatLen / 2 - 0.5) * dir, darkMat);
                cw(0.15, 0.15, diagLenH, side, h / 2 + 1.8, (flatLen + diagLenZ / 2) * dir, darkMat, -ang * dir);
                cw(0.15, 0.15, flatLen + 1, side, h + 1.8, (flatLen + diagLenZ + flatLen / 2 + 0.5) * dir, darkMat);
            });
            scene.add(gr);
        }

        function getEscalatorProgressAtPosition(escalator, x, z) {
            if (escalator.axis === 'x') {
                return THREE.MathUtils.clamp((x - escalator.travelStartX) * escalator.travelDir, 0, escalator.pathLenZ);
            }
            return THREE.MathUtils.clamp((z - escalator.travelStartZ) * escalator.travelDir, 0, escalator.pathLenZ);
        }

        function getEscalatorRideYAtProgress(escalator, progress) {
            const p = THREE.MathUtils.clamp(progress, 0, escalator.pathLenZ);
            if (p <= escalator.flatLen) return escalator.pathStartY;
            if (p >= escalator.flatLen + escalator.diagLenZ) return escalator.pathEndY;
            const slopeT = (p - escalator.flatLen) / escalator.diagLenZ;
            return THREE.MathUtils.lerp(escalator.pathStartY, escalator.pathEndY, slopeT);
        }

        function getEscalatorRidePosition(escalator, progress, eyeOffset = 0) {
            const p = THREE.MathUtils.clamp(progress, 0, escalator.pathLenZ);
            if (escalator.axis === 'x') {
                return new THREE.Vector3(
                    escalator.travelStartX + escalator.travelDir * p,
                    getEscalatorRideYAtProgress(escalator, p) + eyeOffset,
                    escalator.zStart
                );
            }
            return new THREE.Vector3(
                escalator.x,
                getEscalatorRideYAtProgress(escalator, p) + eyeOffset,
                escalator.travelStartZ + escalator.travelDir * p
            );
        }

        function findActiveEscalator(x, y, z, eyeOffset = 0) {
            let best = null;
            let bestScore = Infinity;

            escalatorList.forEach((escalator) => {
                if (x < escalator.xMin - 1.2 || x > escalator.xMax + 1.2) return;
                if (z < escalator.zMin - 1.2 || z > escalator.zMax + 1.2) return;

                const progress = getEscalatorProgressAtPosition(escalator, x, z);
                const ridePos = getEscalatorRidePosition(escalator, progress, eyeOffset);
                const dx = Math.abs(x - ridePos.x);
                const dy = Math.abs(y - ridePos.y);
                const dz = Math.abs(z - ridePos.z);
                const horizontalOffset = Math.hypot(x - ridePos.x, z - ridePos.z);

                if (horizontalOffset > 1.45 || dy > 1.25) return;

                const score = dx * 1.7 + dy + dz * 0.5;
                if (score < bestScore) {
                    bestScore = score;
                    best = { escalator, progress, ridePos };
                }
            });

            return best;
        }

        function advanceAlongEscalator(point, escalator, progress, travelStep, eyeOffset = 0, snapX = 0.35, blendToLanding = false) {
            const nextProgress = THREE.MathUtils.clamp(progress + travelStep, 0, escalator.pathLenZ);
            const ridePos = getEscalatorRidePosition(escalator, nextProgress, eyeOffset);
            let landing = null;

            if (blendToLanding && escalator.pathEndY > escalator.pathStartY) {
                const blendStart = Math.max(escalator.flatLen, escalator.pathLenZ - 3.4);
                const blendT = THREE.MathUtils.clamp(
                    (nextProgress - blendStart) / Math.max(0.001, escalator.pathLenZ - blendStart),
                    0,
                    1
                );

                if (blendT > 0) {
                    landing = getEscalatorLandingTransform(escalator, eyeOffset);
                    const easedBlend = blendT * blendT * (3 - 2 * blendT);
                    ridePos.lerp(landing.position, easedBlend);
                }
            }

            point.x = THREE.MathUtils.lerp(point.x, ridePos.x, snapX);
            point.y = ridePos.y;
            point.z = ridePos.z;
            return {
                progress: nextProgress,
                ridePos,
                landing,
                done: nextProgress >= escalator.pathLenZ - 0.02
            };
        }

        function getEscalatorExitPosition(escalator, eyeOffset = 0, extraForward = 2.6) {
            const exitPos = getEscalatorRidePosition(escalator, escalator.pathLenZ, eyeOffset);
            if (escalator.axis === 'x') exitPos.x += escalator.travelDir * extraForward;
            else exitPos.z += escalator.travelDir * extraForward;
            return exitPos;
        }

        function getEscalatorLandingTransform(escalator, eyeOffset = 0) {
            if (escalator.isAnchorEscalator) {
                const position = getEscalatorExitPosition(escalator, eyeOffset, 2.4);
                return {
                    position,
                    target: new THREE.Vector3(
                        position.x + (escalator.axis === 'x' ? escalator.travelDir * 8.5 : 0),
                        position.y + 0.05,
                        position.z + (escalator.axis === 'z' ? escalator.travelDir * 8.5 : 0)
                    ),
                    exitAxis: escalator.axis,
                    exitDir: escalator.travelDir
                };
            }
            const isNorthSouthRide = escalator.axis !== 'x';
            const preferredSide = isNorthSouthRide
                ? (escalator.x >= 0 ? 1 : -1)
                : (escalator.z >= 0 ? 1 : -1);
            const sideOptions = [preferredSide, -preferredSide];
            const forwardOffsets = [3.2, 2.7];
            const lateralOffsets = [5.2, 4.3, 3.4];

            for (const forwardOffset of forwardOffsets) {
                for (const sideDir of sideOptions) {
                    for (const lateralOffset of lateralOffsets) {
                        const position = getEscalatorExitPosition(escalator, eyeOffset, forwardOffset);
                        let target;
                        let exitAxis;

                        if (isNorthSouthRide) {
                            position.x += sideDir * lateralOffset;
                            target = new THREE.Vector3(position.x + sideDir * 8.5, position.y + 0.05, position.z);
                            exitAxis = 'x';
                        } else {
                            position.z += sideDir * lateralOffset;
                            target = new THREE.Vector3(position.x, position.y + 0.05, position.z + sideDir * 8.5);
                            exitAxis = 'z';
                        }

                        const landingBlocked = checkCollision(position.x, position.y, position.z);
                        const aheadBlocked = exitAxis === 'x'
                            ? checkCollision(position.x + sideDir * 1.4, position.y, position.z)
                            : checkCollision(position.x, position.y, position.z + sideDir * 1.4);

                        if (!landingBlocked && !aheadBlocked) {
                            return {
                                position,
                                target,
                                exitAxis,
                                exitDir: sideDir
                            };
                        }
                    }
                }
            }

            const fallbackPos = getEscalatorExitPosition(escalator, eyeOffset, 2.6);
            if (isNorthSouthRide) {
                fallbackPos.x += preferredSide * 5.2;
                return {
                    position: fallbackPos,
                    target: new THREE.Vector3(fallbackPos.x + preferredSide * 8.5, fallbackPos.y + 0.05, fallbackPos.z),
                    exitAxis: 'x',
                    exitDir: preferredSide
                };
            }

            fallbackPos.z += preferredSide * 5.2;
            return {
                position: fallbackPos,
                target: new THREE.Vector3(fallbackPos.x, fallbackPos.y + 0.05, fallbackPos.z + preferredSide * 8.5),
                exitAxis: 'z',
                exitDir: preferredSide
            };
        }

        function createGlassElevator(x, z) {
            const gr = new THREE.Group(); gr.position.set(x, 0.1, z);
            // Columnas guía (oro)
            [2.5, -2.5].forEach(px => [2.5, -2.5].forEach(pz => {
                const col = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 22.0), goldMat);
                col.position.set(px, 11.0, pz); gr.add(col);
            }));
            // Cápsula de cristal
            const cab = new THREE.Group(); cab.position.y = 2.7; // Posición estática elegante
            const body = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 4.5, 16, 1, true), glassMat); cab.add(body);
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.4), goldMat); cap.position.y = 2.25; cab.add(cap);
            const base = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.4), goldMat); base.position.y = -2.25; cab.add(base);
            gr.add(cab);
            scene.add(gr);
        }

        function getActiveDoorActors() {
            const actors = [];
            if (isWalking) actors.push({ id: '__local__', position: camera.position.clone() });

            Object.entries(otherPlayers).forEach(([id, player]) => {
                if (player?.mesh) actors.push({ id: `remote:${id}`, position: player.mesh.position.clone() });
            });

            npcs.forEach((npc, index) => {
                if (npc?.mesh) actors.push({ id: `npc:${index}`, position: npc.mesh.position.clone() });
            });

            return actors;
        }

        function applySlidingDoorPose(door) {
            if (door.swingAngle) {
                const angle = door.swingAngle * door.openAmount * (door.swingSign ?? 1);
                door.leftLeaf.rotation.y = angle;
                door.rightLeaf.rotation.y = -angle;
                return;
            }
            const slide = door.slideDistance * door.openAmount;
            if (!door.leftFixed) door.leftLeaf.position.x = door.leftClosedX - slide;
            if (!door.rightFixed) door.rightLeaf.position.x = door.rightClosedX + slide;
            const layerOffset = door.layerOffset ?? BOUTIQUE_DOOR_LAYER_OFFSET;
            if (!door.leftFixed) door.leftLeaf.position.z = door.leftClosedZ - door.openAmount * layerOffset;
            if (!door.rightFixed) door.rightLeaf.position.z = door.rightClosedZ + door.openAmount * layerOffset;
        }

        function applyBoutiqueDoorPose(door) {
            applySlidingDoorPose(door);
        }

        function actorTriggersSlidingDoor(door, currentWorldPos, previousWorldPos) {
            const currentLocal = door.group.worldToLocal(currentWorldPos.clone());
            const prevLocal = door.group.worldToLocal((previousWorldPos || currentWorldPos).clone());
            const triggerCenterX = door.triggerCenterX || 0;
            const withinWidth = Math.abs(currentLocal.x - triggerCenterX) <= door.triggerHalfWidth || Math.abs(prevLocal.x - triggerCenterX) <= door.triggerHalfWidth;
            const nearFront = Math.abs(currentLocal.z - door.frontZ) <= door.triggerDepth || Math.abs(prevLocal.z - door.frontZ) <= door.triggerDepth;

            if (!withinWidth || !nearFront) return false;

            const deltaZ = currentLocal.z - prevLocal.z;
            const crossedDoorPlane = (prevLocal.z - door.frontZ) * (currentLocal.z - door.frontZ) <= 0;
            const enteringStore = prevLocal.z > door.frontZ + 0.35 && deltaZ < -0.012 && currentLocal.z < door.frontZ + door.triggerDepth;
            const exitingStore = prevLocal.z < door.frontZ - 0.35 && deltaZ > 0.012 && currentLocal.z > door.frontZ - door.triggerDepth;
            const waitingOnThreshold = Math.abs(currentLocal.z - door.frontZ) <= 0.7 && Math.abs(deltaZ) > 0.004;

            return enteringStore || exitingStore || (crossedDoorPlane && Math.abs(deltaZ) > 0.008) || waitingOnThreshold;
        }

        function actorTriggersBoutiqueDoor(door, currentWorldPos, previousWorldPos) {
            return actorTriggersSlidingDoor(door, currentWorldPos, previousWorldPos);
        }

        function updateSlidingDoorCollection(doors, prevActorsMap, nowMs, openHoldMs, openEase = 0.24, closeEase = 0.14) {
            const actors = getActiveDoorActors();

            doors.forEach((door) => {
                for (const actor of actors) {
                    const prev = prevActorsMap.get(actor.id);
                    if (actorTriggersSlidingDoor(door, actor.position, prev)) {
                        door.openUntil = nowMs + openHoldMs;
                        break;
                    }
                }

                const targetOpen = nowMs < door.openUntil ? 1 : 0;
                const easing = targetOpen > door.openAmount ? openEase : closeEase;
                door.openAmount = THREE.MathUtils.lerp(door.openAmount, targetOpen, easing);
                if (Math.abs(door.openAmount - targetOpen) < 0.001) door.openAmount = targetOpen;
                applySlidingDoorPose(door);
            });

            const liveActorIds = new Set(actors.map(actor => actor.id));
            Array.from(prevActorsMap.keys()).forEach((id) => {
                if (!liveActorIds.has(id)) prevActorsMap.delete(id);
            });
            actors.forEach((actor) => prevActorsMap.set(actor.id, actor.position.clone()));
        }

        function updateBoutiqueSlidingDoors(nowMs = performance.now()) {
            if (!boutiqueSlidingDoors.length) return;
            updateSlidingDoorCollection(boutiqueSlidingDoors, boutiqueDoorPrevActors, nowMs, BOUTIQUE_DOOR_OPEN_HOLD_MS, 0.24, 0.14);
        }

        function updateCorridorAccessDoors(nowMs = performance.now()) {
            if (!corridorSlidingDoors.length) return;
            updateSlidingDoorCollection(corridorSlidingDoors, corridorDoorPrevActors, nowMs, CORRIDOR_DOOR_OPEN_HOLD_MS, 0.2, 0.12);
        }

        const boutiqueStreamProbe = new THREE.Vector3();
        function updateBoutiqueInteriorStreaming() {
            Object.values(storeGroups).forEach((shop) => {
                if (!shop?.userData?.isBoutique) return;

                const detailedInterior = shop.userData.detailedInteriorGroup;
                const dynamicInterior = shop.getObjectByName("interior");

                if (!isWalking) {
                    shop.userData.interiorDetailFade = 0;
                    if (detailedInterior) setGroupFade(detailedInterior, 0);
                    if (dynamicInterior) setGroupFade(dynamicInterior, 0);
                    shop.userData.interiorDetailVisible = false;
                    return;
                }

                const distance = Math.min(
                    getDistanceToBoutiqueVolume(shop, camera.position),
                    getDistanceToBoutiqueFront(shop, camera.position)
                );
                const targetFade = getBoutiqueInteriorFade(distance);
                const currentFade = shop.userData.interiorDetailFade || 0;
                const nextFade = THREE.MathUtils.lerp(currentFade, targetFade, BOUTIQUE_DETAIL_FADE_SMOOTHING);
                const shouldStreamInterior = targetFade > BOUTIQUE_DETAIL_STREAM_BUILD_THRESHOLD;

                if (shouldStreamInterior) {
                    if (typeof shop.userData.ensureDetailedInterior === 'function') {
                        shop.userData.ensureDetailedInterior();
                    }
                    if (!shop.userData.storeVisualPayload && !shop.userData.isLoadingVisuals) {
                        loadStoreVisualsOnDemand(shop);
                    }
                    if (typeof shop.userData.ensureDynamicStoreVisuals === 'function') {
                        shop.userData.ensureDynamicStoreVisuals();
                    }
                }

                if (detailedInterior) setGroupFade(detailedInterior, nextFade);
                if (dynamicInterior) setGroupFade(dynamicInterior, nextFade);

                shop.userData.interiorDetailFade = nextFade;
                shop.userData.interiorDetailVisible = nextFade > BOUTIQUE_DETAIL_FADE_EPSILON;
            });
        }

        function updateAnchorInteriorStreaming() {
            Object.values(storeGroups).forEach((shop) => {
                if (!shop?.userData?.isAnchor) return;

                const detailedInterior = shop.userData.detailedInteriorGroup;
                if (!detailedInterior) return;

                if (!isWalking) {
                    shop.userData.interiorDetailFade = 0;
                    setGroupFade(detailedInterior, 0);
                    shop.userData.interiorDetailVisible = false;
                    return;
                }

                const distance = Math.min(
                    getDistanceToAnchorVolume(shop, camera.position),
                    getDistanceToAnchorFront(shop, camera.position)
                );
                const targetFade = getAnchorInteriorFade(distance);
                const currentFade = shop.userData.interiorDetailFade || 0;
                const nextFade = THREE.MathUtils.lerp(currentFade, targetFade, ANCHOR_DETAIL_FADE_SMOOTHING);

                if (targetFade > ANCHOR_DETAIL_STREAM_BUILD_THRESHOLD && typeof shop.userData.ensureDetailedInterior === 'function') {
                    shop.userData.ensureDetailedInterior();
                }

                setGroupFade(detailedInterior, nextFade);
                shop.userData.interiorDetailFade = nextFade;
                shop.userData.interiorDetailVisible = nextFade > BOUTIQUE_DETAIL_FADE_EPSILON;
            });
        }

        function createBoutique(posX, posZ, rotY, walls, posY = 0, shopCode = "", fixedLeaves = []) {
            const sh = new THREE.Group(); sh.position.set(posX, posY, posZ); sh.rotation.y = rotY;
            sh.userData = { isBoutique: true, shopCode: shopCode };
            const detailedInterior = new THREE.Group();
            detailedInterior.name = "boutiqueDetailedInterior";
            detailedInterior.visible = false;
            sh.add(detailedInterior);
            const f = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 18), new THREE.MeshPhongMaterial({ color: 0x003366 })); f.position.y = 0.02; sh.add(f);
            const cw = (w, h, d, x, y, z, m, parent = sh) => { const mw = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mw.position.set(x, y, z); parent.add(mw); return mw; };
            const accentPalette = [0xc5a059, 0x6ea6d9, 0xb9875d, 0x8bbf7a, 0xd17f76];
            const paletteSeed = (shopCode || "B").split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
            const accentColor = accentPalette[paletteSeed % accentPalette.length];
            const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.58, metalness: 0.08 });
            const woodDarkMat = new THREE.MeshStandardMaterial({ color: 0x4f3923, roughness: 0.62, metalness: 0.05 });
            const stoneMat = new THREE.MeshStandardMaterial({ color: 0xd7d0c7, roughness: 0.22, metalness: 0.02 });
            const brassMat = new THREE.MeshStandardMaterial({ color: 0xc5a059, roughness: 0.2, metalness: 0.82 });
            const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.44, metalness: 0.16 });
            const softFabricMat = new THREE.MeshStandardMaterial({ color: 0x988f85, roughness: 0.9, metalness: 0.02 });
            const glowMat = new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0.72 });
            const hideRearWallForShop = shopCode === "S101" || shopCode === "S201";

            const addProductCluster = (parent, width, depth, y, paletteOffset = 0) => {
                const tones = [accentColor, 0xf3efe6, 0x1e1e1e, 0xc8b58f, 0x7a8f63];
                const slots = [
                    [-width * 0.22, y, -depth * 0.18, 0.34, 0.32, 0.26],
                    [0, y + 0.06, depth * 0.08, 0.3, 0.44, 0.24],
                    [width * 0.22, y, -depth * 0.02, 0.26, 0.28, 0.26]
                ];
                slots.forEach((slot, index) => {
                    const tone = tones[(paletteSeed + paletteOffset + index) % tones.length];
                    const itemMat = new THREE.MeshStandardMaterial({ color: tone, roughness: 0.45, metalness: 0.08 });
                    const item = new THREE.Mesh(new THREE.BoxGeometry(slot[3], slot[4], slot[5]), itemMat);
                    item.position.set(slot[0], slot[1] + slot[4] / 2, slot[2]);
                    parent.add(item);
                });
            };

            const addShelfWall = (x, z, width, depth, height, rotationY = 0, overrideMat = null) => {
                const shelf = new THREE.Group();
                shelf.position.set(x, 0, z);
                shelf.rotation.y = rotationY;
                const shelfBodyMat = overrideMat || woodMat;
                const shelfBaseMat = overrideMat || woodDarkMat;
                const shelfCapMat = overrideMat || brassMat;
                cw(width, 0.32, depth, 0, 0.16, 0, shelfBaseMat, shelf);
                cw(width, 0.18, depth + 0.08, 0, height + 0.09, 0, shelfCapMat, shelf);
                cw(width, height, 0.08, 0, height / 2, -depth / 2 + 0.04, shelfBodyMat, shelf);
                [-width / 2 + 0.12, width / 2 - 0.12].forEach((px) => cw(0.12, height, depth, px, height / 2, 0, shelfBodyMat, shelf));
                [1.15, 2.15, 3.15].forEach((py, index) => {
                    cw(width - 0.28, 0.1, depth - 0.14, 0, py, 0.02, stoneMat, shelf);
                    const merch = new THREE.Group();
                    merch.position.y = py + 0.05;
                    addProductCluster(merch, width - 0.6, depth - 0.4, 0.02, index);
                    shelf.add(merch);
                });
                sh.add(shelf);
            };

            const addCenterIsland = (x, z, width, depth, height, glassCap = false) => {
                const island = new THREE.Group();
                island.position.set(x, 0, z);
                cw(width, 0.28, depth, 0, 0.14, 0, woodDarkMat, island);
                cw(width - 0.22, height, depth - 0.22, 0, height / 2 + 0.28, 0, stoneMat, island);
                cw(width - 0.36, 0.14, depth - 0.36, 0, height + 0.42, 0, brassMat, island);
                addProductCluster(island, width - 0.8, depth - 0.8, height + 0.42, 2);
                if (glassCap) {
                    cw(width - 0.32, 1.1, 0.06, 0, height + 0.86, -depth / 2 + 0.2, glassMat, island);
                    cw(width - 0.32, 1.1, 0.06, 0, height + 0.86, depth / 2 - 0.2, glassMat, island);
                    cw(0.06, 1.1, depth - 0.32, -width / 2 + 0.2, height + 0.86, 0, glassMat, island);
                    cw(0.06, 1.1, depth - 0.32, width / 2 - 0.2, height + 0.86, 0, glassMat, island);
                    cw(width - 0.28, 0.08, depth - 0.28, 0, height + 1.38, 0, glassMat, island);
                }
                sh.add(island);
            };

            const addCashDesk = (x, z) => {
                const desk = new THREE.Group();
                desk.position.set(x, 0, z);
                cw(2.8, 1.05, 1.15, 0, 0.52, 0, woodDarkMat, desk);
                cw(2.68, 0.16, 1.02, 0, 1.12, 0, stoneMat, desk);
                cw(1.1, 0.86, 0.46, -0.72, 1.55, 0, accentMat, desk);
                cw(0.6, 0.08, 0.42, -0.72, 1.56, 0.03, darkMat, desk);
                cw(0.42, 0.68, 0.42, 0.85, 0.36, 0.12, woodMat, desk);
                cw(0.78, 0.14, 0.48, 0.85, 0.78, 0.12, softFabricMat, desk);
                sh.add(desk);
            };

            const addFrontVitrine = (x, z) => {
                const vitrine = new THREE.Group();
                vitrine.position.set(x, 0, z);
                cw(1.65, 0.75, 0.9, 0, 0.38, 0, stoneMat, vitrine);
                cw(1.45, 0.08, 0.72, 0, 0.8, 0, brassMat, vitrine);
                cw(1.38, 1.08, 0.06, 0, 1.38, -0.3, glassMat, vitrine);
                cw(1.38, 1.08, 0.06, 0, 1.38, 0.3, glassMat, vitrine);
                cw(0.06, 1.08, 0.54, -0.66, 1.38, 0, glassMat, vitrine);
                cw(0.06, 1.08, 0.54, 0.66, 1.38, 0, glassMat, vitrine);
                cw(1.36, 0.08, 0.56, 0, 1.9, 0, glassMat, vitrine);
                addProductCluster(vitrine, 1.0, 0.45, 0.92, 3);
                sh.add(vitrine);
            };
            const addWindowDisplay = (x) => {
                const display = new THREE.Group();
                display.position.set(x, 0, 7.25);
                cw(2.15, 0.3, 0.95, 0, 0.15, 0, woodDarkMat, display);
                cw(1.45, 0.82, 0.48, 0, 0.72, 0, stoneMat, display);
                cw(2.0, 1.15, 0.06, 0, 1.26, -0.34, glassMat, display);
                cw(0.06, 1.15, 0.62, -0.97, 1.26, -0.02, glassMat, display);
                cw(0.06, 1.15, 0.62, 0.97, 1.26, -0.02, glassMat, display);
                cw(1.92, 0.08, 0.62, 0, 1.87, -0.02, glassMat, display);
                cw(1.92, 0.08, 0.62, 0, 0.68, -0.02, brassMat, display);
                const pedestal = new THREE.Group();
                pedestal.position.set(0, 0.66, 0.08);
                cw(0.76, 0.62, 0.42, 0, 0.31, 0, accentMat, pedestal);
                cw(0.88, 0.08, 0.5, 0, 0.66, 0, brassMat, pedestal);
                addProductCluster(pedestal, 0.68, 0.3, 0.68, 4);
                display.add(pedestal);
                sh.add(display);
            };

            const addBoutiqueCeilingFeature = () => {
                [-3.2, 0, 3.2].forEach((px) => {
                    const drop = new THREE.Group();
                    drop.position.set(px, 0, 1.2);
                    cw(0.06, 0.9, 0.06, 0, 4.25, 0, brassMat, drop);
                    cw(1.4, 0.06, 0.26, 0, 3.74, 0, glowMat, drop);
                    sh.add(drop);
                });
                const runner = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.7), glowMat);
                runner.rotation.x = Math.PI / 2;
                runner.position.set(0, 4.7, -2.2);
                sh.add(runner);
            };

            // Iluminación techo (interior)
            const lightStrip = new THREE.Mesh(new THREE.PlaneGeometry(10, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
            lightStrip.rotation.x = Math.PI / 2; lightStrip.position.y = 4.75; sh.add(lightStrip);

            if (walls.back && !hideRearWallForShop && shopCode !== "O207") cw(12, 4.8, 0.1, 0, 2.4, -9, whiteMat);
            if (walls.left !== false && shopCode !== "E206") cw(0.1, 4.8, 18, -6, 2.4, 0, walls.left === 'glass' ? glassMat : whiteMat);
            if (walls.right !== false && shopCode !== "O206") cw(0.1, 4.8, 18, 6, 2.4, 0, walls.right === 'glass' ? glassMat : whiteMat);

            const doorH = 3.6; const shopH = 4.8; const frM = darkMat;
            cw(2.8, shopH, 0.05, -4.5, shopH / 2, 9, glassMat);
            cw(2.8, shopH, 0.05, 4.5, shopH / 2, 9, glassMat);
            cw(6, shopH - doorH, 0.05, 0, (shopH + doorH) / 2, 9, glassMat);

            const leftDoorLeaf = new THREE.Group();
            leftDoorLeaf.position.set(-1.5, doorH / 2, BOUTIQUE_DOOR_FRONT_Z);
            const rightDoorLeaf = new THREE.Group();
            rightDoorLeaf.position.set(1.5, doorH / 2, BOUTIQUE_DOOR_FRONT_Z);
            sh.add(leftDoorLeaf, rightDoorLeaf);

            cw(2.9, doorH, 0.05, 0, 0, 0, glassMat, leftDoorLeaf);
            cw(2.9, doorH, 0.05, 0, 0, 0, glassMat, rightDoorLeaf);
            cw(12.2, 0.2, 0.2, 0, 0.1, 9.05, frM);
            cw(12.2, 0.2, 0.2, 0, shopH, 9.05, frM);
            cw(0.2, shopH, 0.2, -6, shopH / 2, 9.05, frM);
            cw(0.2, shopH, 0.2, 6, shopH / 2, 9.05, frM);
            cw(0.2, shopH, 0.2, -3, shopH / 2, 9.05, frM);
            cw(0.2, shopH, 0.2, 3, shopH / 2, 9.05, frM);
            cw(6, 0.15, 0.2, 0, doorH, 9.05, frM);
            cw(0.1, 1.4, 0.1, 1.25, 0, 0.12, goldMat, leftDoorLeaf);
            cw(0.1, 1.4, 0.1, -1.25, 0, 0.12, goldMat, rightDoorLeaf);

            if (shopCode !== "") {
                const idTex = createSmallIDTexture(shopCode);
                const idPlaque = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: idTex, transparent: true }));
                idPlaque.userData.isStoreCodeSign = true;
                idPlaque.userData.isSign = true;
                idPlaque.userData.isCatalogTrigger = true;
                idPlaque.userData.shopCode = shopCode;
                idPlaque.position.set(-5.0, 4.4, 9.15);
                sh.add(idPlaque);
                catalogClickTargets.push(idPlaque);

                // Invisible helper plane to make plaque clicks reliable for visitors.
                const idPlaqueHitbox = new THREE.Mesh(
                    new THREE.PlaneGeometry(3.1, 1.45),
                    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
                );
                idPlaqueHitbox.userData.isStoreCodeSign = true;
                idPlaqueHitbox.userData.isSign = true;
                idPlaqueHitbox.userData.isPlaqueHitbox = true;
                idPlaqueHitbox.userData.isCatalogTrigger = true;
                idPlaqueHitbox.userData.shopCode = shopCode;
                idPlaqueHitbox.position.copy(idPlaque.position);
                idPlaqueHitbox.position.z += 0.02;
                idPlaqueHitbox.renderOrder = 60;
                sh.add(idPlaqueHitbox);
                catalogClickTargets.push(idPlaqueHitbox);
            }

            const logoBannerTex = createSmallIDTexture(shopCode || "LOCAL");
            const logoBannerMat = new THREE.MeshBasicMaterial({
                map: logoBannerTex,
                transparent: true,
                alphaTest: 0.5,
                depthWrite: true,
                depthTest: true,
                polygonOffset: true,
                polygonOffsetFactor: -1,
                polygonOffsetUnits: -1
            });
            const logoBanner = new THREE.Mesh(new THREE.PlaneGeometry(BOUTIQUE_SIGN_WIDTH, BOUTIQUE_SIGN_HEIGHT), logoBannerMat);
            logoBanner.userData = { isSign: true, isLogoBanner: true, isCatalogTrigger: true, shopCode: shopCode };
            logoBanner.visible = true;
            logoBanner.material.transparent = true;
            logoBanner.material.opacity = 0;
            logoBanner.position.set(0, doorH + ((shopH - doorH) / 2), 9.135);
            logoBanner.renderOrder = -10; // Dibujar ANTES que el suelo para que sea tapado
            sh.add(logoBanner);
            catalogClickTargets.push(logoBanner);
            const r = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.3, 18.2), goldMat); r.position.y = 5.2; sh.add(r);

            const ensureDetailedInterior = () => {
                if (sh.userData.detailedInteriorBuilt) return;
                const decorStartIndex = sh.children.length;

                // Ambientación interior tipo retail premium.
                cw(4.8, 0.02, 7.4, 0, 0.12, -2.2, new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.08 }));
                if (!hideRearWallForShop && walls.left !== false) addShelfWall(-5.05, -0.8, 15.4, 0.72, 3.85, Math.PI / 2);
                if (!hideRearWallForShop && walls.right !== false) addShelfWall(5.05, -0.8, 15.4, 0.72, 3.85, -Math.PI / 2);
                if (walls.back && !hideRearWallForShop) addShelfWall(0, -8.05, 8.4, 0.9, 3.9, 0);
                if (!hideRearWallForShop) addCenterIsland(-1.75, -1.6, 2.5, 1.35, 0.95, false);
                if (!hideRearWallForShop) addCenterIsland(2.1, -4.25, 2.25, 1.2, 0.95, true);
                // Mantener despejado el acceso central del local.
                if (!hideRearWallForShop) addCashDesk(4.35, 2.65);
                if (!hideRearWallForShop) addWindowDisplay(-4.45);
                if (!hideRearWallForShop) addWindowDisplay(4.45);
                addBoutiqueCeilingFeature();

                while (sh.children.length > decorStartIndex) {
                    detailedInterior.add(sh.children[decorStartIndex]);
                }
                sh.userData.detailedInteriorBuilt = true;
            };

            sh.userData.ensureDetailedInterior = ensureDetailedInterior;
            sh.userData.detailedInteriorGroup = detailedInterior;
            sh.userData.interiorDetailFade = 0;
            sh.userData.interiorDetailVisible = false;
            ensureDetailedInterior();

            const leftDoorFixed = (fixedLeaves || []).includes('left');
            const rightDoorFixed = (fixedLeaves || []).includes('right');

            // Solo registramos para animación si al menos una hoja es móvil
            if (!leftDoorFixed || !rightDoorFixed) {
                boutiqueSlidingDoors.push({
                    group: sh,
                    leftLeaf: leftDoorLeaf,
                    rightLeaf: rightDoorLeaf,
                    leftClosedX: -1.5,
                    rightClosedX: 1.5,
                    leftClosedZ: BOUTIQUE_DOOR_FRONT_Z,
                    rightClosedZ: BOUTIQUE_DOOR_FRONT_Z,
                    slideDistance: BOUTIQUE_DOOR_SLIDE_DISTANCE,
                    triggerHalfWidth: BOUTIQUE_DOOR_TRIGGER_HALF_WIDTH,
                    triggerDepth: BOUTIQUE_DOOR_TRIGGER_DEPTH,
                    frontZ: BOUTIQUE_DOOR_FRONT_Z,
                    openAmount: 0,
                    openUntil: 0,
                    leftFixed: leftDoorFixed,
                    rightFixed: rightDoorFixed
                });
            }

            // --- REGISTRO DE COLISIÓN (Paredes laterales, trasera y frontal con hueco de puerta) ---
            const cos = Math.cos(rotY); const sin = Math.sin(rotY);
            const yB = (posY > 5 ? 5.4 : 0);
            
            // 1. Pared Trasera (Fija en profundidad -8.75 para no sobresalir)
            if (walls.back && !hideRearWallForShop && shopCode !== "O207") {
                const rx = posX + sin * (-8.75); const rz = posZ + cos * (-8.75);
                registerCollider(rx, rz, Math.abs(12 * cos) + Math.abs(0.5 * sin), Math.abs(12 * sin) + Math.abs(0.5 * cos), yB, yB + 6);
            }

            // 2. Paredes Laterales (+/- 5.75)
            if (walls.left !== false && shopCode !== "E206") {
                const lx = posX + cos * (-5.75); const lz = posZ + sin * (5.75);
                registerCollider(lx, lz, Math.abs(0.5 * cos) + Math.abs(18 * sin), Math.abs(0.5 * sin) + Math.abs(18 * cos), yB, yB + 6);
            }
            if (walls.right !== false && shopCode !== "O206" && shopCode !== "E201") {
                const rx = posX + cos * (5.75); const rz = posZ + sin * (-5.75);
                registerCollider(rx, rz, Math.abs(0.5 * cos) + Math.abs(18 * sin), Math.abs(0.5 * sin) + Math.abs(18 * cos), yB, yB + 6);
            }

            // 3. Pared Frontal (Cristal con puerta de 6m, desplazada 0.25m hacia adentro: 8.75)
            [BOUTIQUE_DOOR_COLLIDER_OFFSET_X, -BOUTIQUE_DOOR_COLLIDER_OFFSET_X].forEach(offX => {
                const fx = posX + cos * offX + sin * 8.75;
                const fz = posZ + sin * (-offX) + cos * 8.75;
                registerCollider(
                    fx,
                    fz,
                    Math.abs(BOUTIQUE_DOOR_COLLIDER_WIDTH * cos) + Math.abs(0.5 * sin),
                    Math.abs(BOUTIQUE_DOOR_COLLIDER_WIDTH * sin) + Math.abs(0.5 * cos),
                    yB,
                    yB + 6
                );
            });

            registerInteriorFogZone(sh, -5.8, 5.8, -8.7, 8.7, 0.05, 5.0);
            return sh;
        }
        
        // --- LÓGICA DE MOBILIARIO Y PRODUCTOS 3D ---
        const textureLoader = new THREE.TextureLoader();

        async function updateStoreVisuals(code, storeData, products) {
            const sh = storeGroups[code];
            if (!sh) return;
            sh.userData.storeVisualPayload = {
                storeData: storeData || {},
                products: products || []
            };
            sh.userData.storeVisualRevision = (sh.userData.storeVisualRevision || 0) + 1;

            // Asegurarnos que tenga un contenedor de interior
            let interior = sh.getObjectByName("interior");
            if (!interior) {
                interior = new THREE.Group();
                interior.name = "interior";
                interior.visible = false;
                sh.add(interior);
            }
            let showcase = sh.getObjectByName("showcaseVisuals");
            if (!showcase) {
                showcase = new THREE.Group();
                showcase.name = "showcaseVisuals";
                sh.add(showcase);
            }

            sh.userData.ensureDynamicStoreVisuals = function () {
                if (!sh.userData.storeVisualPayload) return;
                if (sh.userData.dynamicInteriorRevision === sh.userData.storeVisualRevision) return;
                const payload = sh.userData.storeVisualPayload;
                const liveStoreData = payload.storeData || {};
                const liveProducts = payload.products || [];

                while (interior.children.length > 0) interior.remove(interior.children[0]);
                while (showcase.children.length > 0) showcase.remove(showcase.children[0]);

                let frameMat = darkMat;
                let shelfMat = glassMat;
                const style = liveStoreData.shelf_style || 'madera';

                if (style === 'madera') {
                    frameMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.8 });
                    shelfMat = new THREE.MeshStandardMaterial({ color: 0x4e3629, roughness: 0.7 });
                } else if (style === 'minimalista') {
                    frameMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.3 });
                    shelfMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 });
                } else if (style === 'cristal') {
                    frameMat = goldMat;
                    shelfMat = glassMat;
                }

                const productsWithImages = liveProducts.filter(p => p && p.image_url).slice(0, 10);
                const productPanelMat = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.94,
                    side: THREE.DoubleSide,
                    depthTest: true,
                    depthWrite: true,
                    alphaTest: 0.5,
                    polygonOffset: true,
                    polygonOffsetFactor: -2
                });
                const productPanelBackMat = new THREE.MeshBasicMaterial({
                    color: 0x080808,
                    transparent: true,
                    opacity: 0.42,
                    side: THREE.DoubleSide,
                    depthTest: true,
                    depthWrite: true,
                    alphaTest: 0.5,
                    polygonOffset: true,
                    polygonOffsetFactor: -1
                });

                const loadProductTexture = (mesh, imageUrl) => {
                    textureLoader.load(imageUrl, (tex) => {
                        tex.colorSpace = THREE.SRGBColorSpace;
                        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
                        mesh.material.map = tex;
                        mesh.material.needsUpdate = true;
                    });
                };

                const addProductImagePlane = (parent, product, x, y, z, width, height, rotationY = 0) => {
                    const holder = new THREE.Group();
                    holder.position.set(x, y, z);
                    holder.rotation.y = rotationY;

                    const backing = new THREE.Mesh(new THREE.PlaneGeometry(width + 0.08, height + 0.08), productPanelBackMat.clone());
                    backing.renderOrder = 40;
                    holder.add(backing);

                    const image = new THREE.Mesh(new THREE.PlaneGeometry(width, height), productPanelMat.clone());
                    image.position.z = 0.02;
                    image.renderOrder = 41;
                    holder.add(image);

                    const trimMat = goldMat.clone();
                    trimMat.depthTest = true;
                    trimMat.depthWrite = true;
                    const top = new THREE.Mesh(new THREE.BoxGeometry(width + 0.12, 0.025, 0.025), trimMat);
                    const bottom = top.clone();
                    const left = new THREE.Mesh(new THREE.BoxGeometry(0.025, height + 0.12, 0.025), trimMat);
                    const right = left.clone();
                    top.position.set(0, height / 2 + 0.045, 0.02);
                    bottom.position.set(0, -height / 2 - 0.045, 0.02);
                    left.position.set(-width / 2 - 0.045, 0, 0.02);
                    right.position.set(width / 2 + 0.045, 0, 0.02);
                    holder.add(top, bottom, left, right);

                    if (product?.image_url) {
                        loadProductTexture(image, product.image_url);
                    } else {
                        image.material.color.setHex(0x111111);
                        image.material.opacity = 0.08;
                    }
                    holder.renderOrder = 41;
                    parent.add(holder);
                    return holder;
                };

                const addFacadeProductPanels = () => {
                    const facade = new THREE.Group();
                    facade.name = "facadeProductPanels";
                    facade.renderOrder = 24;
                    const leftSlots = [
                        [-5.15, 1.28], [-3.85, 1.28], [-5.15, 2.42], [-3.85, 2.42], [-4.5, 3.52]
                    ];
                    const rightSlots = [
                        [3.85, 1.28], [5.15, 1.28], [3.85, 2.42], [5.15, 2.42], [4.5, 3.52]
                    ];
                    [...leftSlots, ...rightSlots].forEach(([x, y], index) => {
                        const product = productsWithImages[index];
                        addProductImagePlane(facade, product, x, y, 9.38, 0.92, 0.72);
                    });
                    showcase.add(facade);
                };

                const addInteriorProductGallery = () => {
                    if (!productsWithImages.length) return;
                    const gallery = new THREE.Group();
                    gallery.name = "interiorProductGallery";
                    const positions = [
                        [-4.2, 1.35], [-2.1, 1.35], [0, 1.35], [2.1, 1.35], [4.2, 1.35],
                        [-4.2, 2.7], [-2.1, 2.7], [0, 2.7], [2.1, 2.7], [4.2, 2.7]
                    ];
                    productsWithImages.forEach((product, index) => {
                        const [x, y] = positions[index];
                        addProductImagePlane(gallery, product, x, y, -8.86, 1.15, 0.9);
                    });
                    interior.add(gallery);
                };

                const addFeaturedWindowProduct = () => {
                    if (!productsWithImages.length) return;
                    const featured = new THREE.Group();
                    featured.name = "featuredWindowProduct";
                    const product = productsWithImages[0];
                    addProductImagePlane(featured, product, -4.45, 1.55, 9.4, 1.15, 0.95);
                    addProductImagePlane(featured, product, 0, 3.15, 9.42, 1.55, 0.95);
                    featured.renderOrder = 25;
                    showcase.add(featured);
                };

                const createShelfUnit = (posX) => {
                    const unit = new THREE.Group();
                    unit.position.set(posX, 0, 0);
                    [-4, 4].forEach(pz => {
                        const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.8, 0.2), frameMat);
                        post.position.set(0, 2.4, pz); unit.add(post);
                    });

                    [1.2, 2.6, 4.0].forEach((py, level) => {
                        const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 8), shelfMat);
                        shelf.position.set(0, py, 0); unit.add(shelf);

                        const pIndexStart = (posX < 0 ? 0 : 5) + (level * 2);
                        for (let i = 0; i < 2; i++) {
                            const p = liveProducts[pIndexStart + i];
                            if (p && p.image_url) {
                                textureLoader.load(p.image_url, (tex) => {
                                    const pMesh = new THREE.Mesh(
                                        new THREE.BoxGeometry(0.1, 0.8, 0.8),
                                        new THREE.MeshStandardMaterial({ map: tex })
                                    );
                                    pMesh.position.set(posX < 0 ? 0.3 : -0.3, py + 0.45, (i === 0 ? -1.5 : 1.5));
                                    unit.add(pMesh);
                                });
                            }
                        }
                    });
                    interior.add(unit);
                };

                const isPassageShop = code === "S101" || code === "S201";
                if (!isPassageShop) createShelfUnit(-5.5);
                if (!isPassageShop) createShelfUnit(5.5);
                addFacadeProductPanels();
                addFeaturedWindowProduct();
                addInteriorProductGallery();
                prepareGroupForDistanceFade(interior);
                sh.userData.dynamicInteriorBuilt = true;
                sh.userData.dynamicInteriorRevision = sh.userData.storeVisualRevision;
            };

            // Actualizar Letrero si hay Logo
            const sign = sh.children.find(c => c.userData?.isLogoBanner) || sh.children.find(c => c.userData?.isSign);
            if (storeData.logo_url) {
                textureLoader.load(storeData.logo_url, (tex) => {
                    if (sign) {
                        tex.colorSpace = THREE.SRGBColorSpace;
                        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
                        sign.material.map = tex;
                        sign.material.needsUpdate = true;
                        sign.material.depthTest = true;
                        sign.material.depthWrite = true;
                        sign.material.alphaTest = 0.5;
                        sign.material.transparent = true;
                        sign.material.opacity = 1;
                        sign.visible = true;
                        sign.renderOrder = -10;
                        const imageAspect = tex.image?.width && tex.image?.height ? tex.image.width / tex.image.height : (BOUTIQUE_SIGN_WIDTH / BOUTIQUE_SIGN_HEIGHT);
                        const bannerAspect = BOUTIQUE_SIGN_WIDTH / BOUTIQUE_SIGN_HEIGHT;
                        if (imageAspect > bannerAspect) {
                            sign.scale.set(1, bannerAspect / imageAspect, 1);
                        } else {
                            sign.scale.set(imageAspect / bannerAspect, 1, 1);
                        }
                    }
                });
            } else if (sign) {
                sign.visible = false;
                sign.scale.set(1, 1, 1);
            }

            if (sh.userData.interiorDetailVisible && typeof sh.userData.ensureDynamicStoreVisuals === 'function') {
                sh.userData.ensureDynamicStoreVisuals();
                setGroupFade(interior, sh.userData.interiorDetailFade || 1);
            } else if (typeof sh.userData.ensureDynamicStoreVisuals === 'function') {
                sh.userData.ensureDynamicStoreVisuals();
            }
        }

        // TÓTEMS DE INFORMACIÓN Y BÚSQUEDA
        function createInfoTexture() {
            const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 1024;
            const ctx = canvas.getContext('2d');
            
            // Fondo digital negro profundo
            ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 512, 1024);
            
            // Borde dorado
            ctx.strokeStyle = '#c5a059'; ctx.lineWidth = 15;
            ctx.strokeRect(10, 10, 492, 1004);

            // Icono "i" superior con fuente garantizada
            ctx.beginPath(); ctx.arc(256, 200, 80, 0, Math.PI * 2);
            ctx.strokeStyle = '#c5a059'; ctx.lineWidth = 10; ctx.stroke();
            ctx.fillStyle = '#c5a059'; ctx.font = 'bold 100px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('i', 256, 200);

            // Texto Principal (Blanco puro para máximo contraste)
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 48px Arial, sans-serif';
            ctx.fillText('BUSCA TU', 256, 450);
            ctx.fillText('TIENDA O', 256, 520);
            ctx.font = 'bold 56px Arial, sans-serif';
            ctx.fillStyle = '#c5a059';
            ctx.fillText('PRODUCTO', 256, 610);

            // Simulación de escaneo/líneas LED
            ctx.fillStyle = 'rgba(197, 160, 89, 0.1)';
            for(let i=0; i<20; i++) {
                ctx.fillRect(20, 300 + (i*30), 472, 2);
            }

            // Botones inferiores brillantes
            for(let i=0; i<3; i++) {
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(100 + (i*110), 850, 85, 85);
                ctx.strokeStyle = '#c5a059';
                ctx.lineWidth = 3;
                ctx.strokeRect(100 + (i*110), 850, 85, 85);
            }

            const tex = new THREE.CanvasTexture(canvas);
            tex.needsUpdate = true;
            return tex;
        }
        const infoScreenTexture = createInfoTexture();
        function createInfoTotem(x, z) {
            const gr = new THREE.Group(); gr.position.set(x, 0, z);
            gr.userData = { isTotem: true };
            // Base Pedestal
            const base = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 2), darkMat); base.position.y = 0.2; gr.add(base);
            // Cuerpo Negro
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4.5, 0.4), darkMat); body.position.y = 2.25; gr.add(body);
            // Pantalla Digital (Brillante Constante - Refresco Forzado)
            const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3), new THREE.MeshBasicMaterial({ map: infoScreenTexture }));
            screen.position.set(0, 2.5, 0.21); gr.add(screen);
            const backScreen = screen.clone(); backScreen.rotation.y = Math.PI; backScreen.position.z = -0.21; gr.add(backScreen);
            // Marco Oro
            const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.2, 0.5), goldMat); frame.position.y = 2.5; gr.add(frame);
            gr.scale.setScalar(0.82);
            scene.add(gr);
            registerCollider(x, z, 1.7, 1.7, 0, 4.3);
        }

        // --- POBLAR TÓTEMS ---
        createInfoTotem(0, 10);   // Centro Atrio
        createInfoTotem(0, 68);   // Ala Norte
        createInfoTotem(0, -68);  // Ala Sur
        createInfoTotem(68, 0);   // Ala Este
        createInfoTotem(-68, 0);  // Ala Oeste


        const q = (sx, sz, y) => {
            const gr = new THREE.Group();
            const floorNum = (y === 0) ? 1 : 2;
            const wingH = (sz > 0) ? 'N' : 'S';
            const wingV = (sx > 0) ? 'E' : 'O';

        // CORRECCIÓN "MORDIDA DE RATÓN": Iniciamos en 23 para cerrar esquinas del atrio
            let oRows, sideRows;
            if (y === 0) {
                // Planta Baja: 5 tiendas, terminan en 83 (71+6 es 77... no, 71+6=77). 
                // Para GAP 12: última debe ser 77.
                oRows = [23, 35, 47, 59, 77];
                sideRows = [23, 35, 47, 59, 77];
            } else {
                // Planta Alta: 7 tiendas para cerrar hasta la Gran Tienda (89+6=95)
                oRows = [23, 35, 47, 59, 71, 83, 89];
                sideRows = [23, 35, 47, 59, 71, 83, 89];
            }

            oRows.forEach((o, i) => {
                const code = `${wingH}${floorNum}${String(i + 1).padStart(2, '0')}`;
                const fixed = (code === "S201") ? ['right'] : [];
                const b = createBoutique(o * sx, 26 * sz, sz > 0 ? Math.PI : 0, { back: true, left: i === 0 ? 'glass' : true, right: i === 0 ? false : true }, y, code, fixed);
                storeGroups[code] = b;
                gr.add(b);
            });

            sideRows.forEach((o, i) => {
                const code = `${wingV}${floorNum}${String(i + 1).padStart(2, '0')}`;
                const wallConfig = { back: true, left: i === 0 ? false : true, right: i === 0 ? 'glass' : true };
                if (code === "E201") wallConfig.right = false;
                const b = createBoutique(26 * sx, o * sz, sx > 0 ? -Math.PI / 2 : Math.PI / 2, wallConfig, y, code);
                storeGroups[code] = b;
                gr.add(b);
            });

            // --- MURO PERIMETRAL EXTERIOR (CIERRA HUECOS CENTRALES, DEJA ENTRADAS LIBRES) ---
            const wallM = whiteMat;
            const h = 5.2; const thickness = 0.2;
            const corridorLen = 48; // Recortado para no sobresalir al pasillo central

            // Muro para oRows (atrás de las tiendas en el eje horizontal)
            const w1 = new THREE.Mesh(new THREE.BoxGeometry(corridorLen, h, thickness), wallM);
            w1.position.set(59 * sx, y + h / 2, 35 * sz); gr.add(w1);

            // Muro para sideRows (atrás de las tiendas en el eje vertical)
            const w2 = new THREE.Mesh(new THREE.BoxGeometry(thickness, h, corridorLen), wallM);
            w2.position.set(35 * sx, y + h / 2, 59 * sz); gr.add(w2);

            return gr;
        };

        // --- POBLAR TRANSPORTES (PARALELOS CON FLUJO INTERCALADO) ---
        // Ala SUR (Desde entrada Sur hacia el Centro)
        createEscalator(3, 30, 17, true);    // Derecha: SUBIDA (Viene del pasillo al atrio)
        createEscalator(-3, 30, 17, false);  // Izquierda: BAJADA (Viene del pasillo al atrio)

        // Ala NORTE (Desde entrada Norte hacia el Centro)
        createEscalator(-3, -30, -17, true); // Derecha: SUBIDA (Viene del pasillo al atrio)
        createEscalator(3, -30, -17, false); // Izquierda: BAJADA (Viene del pasillo al atrio)

        // Registro de escaleras (para depuración y lógica)
        // [Las coordenadas ya están sincronizadas en la lista interna]
        console.log(`[ESCALATORS] Total: ${escalatorList.length} | Up: ${escalatorList.filter(e => e.up).length} | Down: ${escalatorList.filter(e => !e.up).length}`);




        [0, 5.5].forEach(y => { [1, -1].forEach(sx => { [1, -1].forEach(sz => scene.add(q(sx, sz, y))); }); });

        // --- POBLAR URBANISMO ---
        [-70, -45, -20, 28, 48].forEach((j) => { createPlanter(0, j); createBench(8, j, 0); createBench(-8, j, 0); });
        [-70, -45, -20, 28, 48].forEach((k) => { createPlanter(k, 0); createBench(k, 8, Math.PI / 2); createBench(k, -8, Math.PI / 2); });
        createCentralFountain(); // La fuente crece visualmente por el espacio
        createDigitalScreen(0, 22.0, 17, 0);
        createDigitalScreen(0, 22.0, -17, Math.PI);
        createDigitalScreen(17, 22.0, 0, -Math.PI / 2);
        createDigitalScreen(-17, 22.0, 0, Math.PI / 2);

        function createInteriorFloors() {
            const marbleMat = new THREE.MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.1, metalness: 0.1 });
            const bronzeMat = new THREE.MeshStandardMaterial({ color: 0x332211, roughness: 0.2 });

            const drawFloorWithGrid = (w, d, x, y, z) => {
                const thickness = 0.6; // Grosor estructural de "concreto"
                const f = new THREE.Mesh(new THREE.BoxGeometry(w, thickness, d), marbleMat);
                // Ajustamos para que la superficie superior esté en 'y'
                f.position.set(x, y - thickness / 2, z); scene.add(f);

                // DISEÑO DE LUJO: Doble línea (Architectural Grid)
                const step = 8;
                const gap = 0.8;

                for (let i = -200 / 2; i <= 200 / 2; i += step) {
                    if (i >= x - w / 2 - 0.1 && i <= x + w / 2 + 0.1) {
                        [0, gap].forEach(off => {
                            const l = new THREE.Mesh(new THREE.PlaneGeometry(0.04, d), bronzeMat);
                            l.rotation.x = -Math.PI / 2; l.position.set(i + off, y + 0.01, z); scene.add(l);
                        });
                    }
                }
                for (let j = -200 / 2; j <= 200 / 2; j += step) {
                    if (j >= z - d / 2 - 0.1 && j <= z + d / 2 + 0.1) {
                        [0, gap].forEach(off => {
                            const l = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.04), bronzeMat);
                            l.rotation.x = -Math.PI / 2; l.position.set(x, y + 0.01, j + off); scene.add(l);
                        });
                    }
                }
            };

            // PASILLOS EXPANDIDOS (34 de ancho, 190 de largo para tocar Anclas en 95)
            drawFloorWithGrid(34, 190, 0, 0.1, 0);
            drawFloorWithGrid(190, 34, 0, 0.1, 0);

            // PASARELAS NORTE-SUR (Alineadas a fachadas, 6 de ancho, 190 de largo)
            drawFloorWithGrid(6, 190, 14, 5.4, 0);   // ESTE
            drawFloorWithGrid(6, 190, -14, 5.4, 0);  // OESTE

            // PASARELAS ESTE-OESTE (Mantener contacto, 190 de largo)
            drawFloorWithGrid(190, 6, 0, 5.4, 14);  // NORTE
            drawFloorWithGrid(190, 6, 0, 5.4, -14); // SUR

            // PLATAFORMAS DE ACCESO (Vestíbulos de 12 de ancho que unen las pasarelas en las entradas a Tiendas Ancla)
            drawFloorWithGrid(34, 12, 0, 5.4, 89);  // Acceso Norte
            drawFloorWithGrid(34, 12, 0, 5.4, -89); // Acceso Sur
            drawFloorWithGrid(12, 34, 89, 5.4, 0);  // Acceso Este
            drawFloorWithGrid(12, 34, -89, 5.4, 0); // Acceso Oeste
        }
        createInteriorFloors();





        function createPlainWalkway(w, d, x, z, rotated = false) {
            // Ya no es necesaria pues tenemos el suelo completo, pero la dejamos por compatibilidad si se llama
            const m = new THREE.Mesh(new THREE.BoxGeometry(rotated ? d : w, 0.2, rotated ? w : d), whiteMat);
            m.position.set(x, 5.41, z); scene.add(m);
        }


        function createRail(x, z, len, rot, hasSign = "") {
            const r = new THREE.Mesh(new THREE.BoxGeometry(rot ? 0.1 : len, 1.2, rot ? len : 0.1), new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3 })); r.position.set(x, 6.1, z); scene.add(r);
            const c = new THREE.Mesh(new THREE.BoxGeometry(rot ? 0.2 : len, 0.1, rot ? len : 0.2), goldMat); c.position.set(x, 6.7, z); scene.add(c);
            if (hasSign !== "") {
                const sM = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: createSignTexture(hasSign), transparent: true }));
                sM.position.set(x, 6.1, z + (rot ? 0 : 0.06)); if (rot) { sM.rotation.y = -Math.PI / 2; sM.position.x += (x > 0 ? 0.06 : -0.06); }
                scene.add(sM);
            }
            // Barandillas a altura 5.0m a 9.0m para asegurar bloqueo total en segundo piso
            registerCollider(x, z, rot ? 0.2 : len, rot ? len : 0.2, 5.0, 9.0);
        }


        // --- SEGURIDAD Y LUJO: BARANDILLAS HUECO SUR (S) ---
        createRail(8, -17, 6, false); // Segmento derecho
        createRail(-8, -17, 6, false); // Segmento izquierdo
        createRail(0, -83, 22, false);
        createRail(11, -50, 66, true);
        createRail(-11, -50, 66, true);

        // --- SEGURIDAD Y LUJO: BARANDILLAS HUECO NORTE (N) ---
        createRail(8, 17, 6, false); // Segmento derecho
        createRail(-8, 17, 6, false); // Segmento izquierdo
        createRail(0, 83, 22, false);
        createRail(-11, 50, 66, true);
        createRail(11, 50, 66, true);

        // --- SEGURIDAD Y LUJO: BARANDILLAS HUECO OESTE (O) ---
        createRail(-17, 0, 22, true);
        createRail(-83, 0, 22, true);
        createRail(-50, 11, 66, false);
        createRail(-50, -11, 66, false);

        // --- SEGURIDAD Y LUJO: BARANDILLAS HUECO ESTE (E) ---
        createRail(17, 0, 22, true);
        createRail(83, 0, 22, true);
        createRail(50, 11, 66, false);
        createRail(50, -11, 66, false);

        // --- SEGURIDAD Y LUJO: ANILLO CENTRAL (ATRIO) ---
        createRail(0, 11, 22, false);
        createRail(0, -11, 22, false);
        createRail(11, 0, 22, true);
        createRail(-11, 0, 22, true);



















        createVaultedRoof(0, VAULT_CENTER_OFFSET, VAULT_LENGTH, 'N', false, 1, 0, Math.PI, Math.PI, true);
        createVaultedRoof(0, -VAULT_CENTER_OFFSET, VAULT_LENGTH, 'S', false, -1, 0, 0, Math.PI);
        createVaultedRoof(VAULT_CENTER_OFFSET, 0, VAULT_LENGTH, 'E', true, 1, 0, Math.PI, Math.PI);
        createVaultedRoof(-VAULT_CENTER_OFFSET, 0, VAULT_LENGTH, 'O', true, -1, 0, 0, Math.PI);

        const centralDome = new THREE.Mesh(new THREE.SphereGeometry(CENTRAL_DOME_RADIUS, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
        centralDome.position.set(0, DOME_CENTER_Y, 0); scene.add(centralDome);
        const lastRingTarget = DOME_RING_TARGETS[DOME_RING_TARGETS.length - 1];
        const domeRibArc = Math.acos((lastRingTarget.height - DOME_CENTER_Y) / CENTRAL_DOME_RADIUS); // Ángulo para llegar al último anillo
        for (let i = 0; i < 8; i++) {
            const rib = new THREE.Mesh(new THREE.TorusGeometry(CENTRAL_DOME_RADIUS, 0.10, 16, 64, domeRibArc), darkMat);
            rib.position.set(0, DOME_CENTER_Y, 0);
            rib.rotation.z = Math.PI / 2; // Orientar verticalmente
            rib.rotation.y = (Math.PI / 4) * i; // Distribuir radialmente
            scene.add(rib);
        }
        // Rebuild de anillos desde cero (7 niveles):
        // 1) fierro más alto (0), 2..7) pares siguientes por altura (±4, ±7, ±10, ±13, ±16, ±19).
        DOME_RING_TARGETS.forEach((target) => {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(target.radius, 0.10, 16, 128), darkMat);
            const ringHeight = target.height;
            ring.position.set(0, ringHeight, 0);
            ring.rotation.x = Math.PI / 2;
            ring.userData.familyLevel = target.level;
            scene.add(ring);
        });


        // --- SISTEMA DE NAVEGACIÓN REFORZADO (TECLADO + JOYSTICK) ---
        const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, KeyW: false, KeyS: false, KeyA: false, KeyD: false, ControlLeft: false, ControlRight: false };
        const canvasContainer = document.getElementById('canvas-container');
        const shouldPreserveTextFocus = () => {
            const active = document.activeElement;
            if (!active) return false;
            const tag = String(active.tagName || '').toLowerCase();
            const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || active.isContentEditable;
            if (isElementActuallyVisible(document.getElementById('login-overlay'))) return true;
            return isInput;
        };
        const focusMallCanvas = () => {
            if (isElementActuallyVisible(document.getElementById('login-overlay'))) return;
            if (shouldPreserveTextFocus()) return;
            try {
                renderer.domElement.focus({ preventScroll: true });
            } catch (_) {
                renderer.domElement.focus();
            }
        };
        const movementKeySet = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ControlLeft', 'ControlRight']);
        const normalizeMovementCode = (e) => {
            if (movementKeySet.has(e.code)) return e.code;
            const key = String(e.key || '').toLowerCase();
            if (key === 'arrowup') return 'ArrowUp';
            if (key === 'arrowdown') return 'ArrowDown';
            if (key === 'arrowleft') return 'ArrowLeft';
            if (key === 'arrowright') return 'ArrowRight';
            if (key === 'w') return 'KeyW';
            if (key === 'a') return 'KeyA';
            if (key === 's') return 'KeyS';
            if (key === 'd') return 'KeyD';
            if (key === 'control') return e.location === 2 ? 'ControlRight' : 'ControlLeft';
            return '';
        };
        const handleMovementKeyDown = (e) => {
            if (shouldPreserveTextFocus()) return;

            const normalizedCode = normalizeMovementCode(e);
            if (e.key === 'Escape') closeControlsMenu();
            if (normalizedCode) {
                e.preventDefault();
                keys[normalizedCode] = true;
            }
        };
                const handleMovementKeyUp = (e) => {
            if (shouldPreserveTextFocus()) return;

            const normalizedCode = normalizeMovementCode(e);
            if (normalizedCode) {
                e.preventDefault();
                keys[normalizedCode] = false;
            }
        };
        window.addEventListener('keydown', handleMovementKeyDown);
        window.addEventListener('keyup', handleMovementKeyUp);
        document.addEventListener('keydown', handleMovementKeyDown, true);
        document.addEventListener('keyup', handleMovementKeyUp, true);
        window.addEventListener('blur', () => {
            Object.keys(keys).forEach((key) => { keys[key] = false; });
        });
        renderer.domElement.addEventListener('pointerdown', focusMallCanvas);
        canvasContainer.addEventListener('pointerdown', (event) => {
            if (event.target.closest && event.target.closest('input, textarea, button, select, a, label')) return;
            ensureWalkModeActive();
            focusMallCanvas();
        });
        setInterval(() => {
            ensureWalkModeActive();
            if (!shouldForceWalkMode()) return;
            focusMallCanvas();
        }, 1200);

        // --- LÓGICA DE JOYSTICK VIRTUAL ---
        let joystickActive = false;
        let joystickDir = { x: 0, y: 0 };
        const joyZone = document.getElementById('joystick-zone');
        const joyKnob = document.getElementById('joystick-knob');
        const joyRect = joyZone.getBoundingClientRect();
        const joyRadius = 60;

        function handleJoystick(e) {
            e.preventDefault();
            const rect = joyZone.getBoundingClientRect();
            const touch = e.touches ? e.touches[0] : e;
            const centerX = rect.left + joyRadius;
            const centerY = rect.top + joyRadius;
            let dx = touch.clientX - centerX;
            let dy = touch.clientY - centerY;
            const distance = Math.min(Math.sqrt(dx * dx + dy * dy), joyRadius);
            const angle = Math.atan2(dy, dx);

            const moveX = Math.cos(angle) * distance;
            const moveY = Math.sin(angle) * distance;

            joyKnob.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;

            joystickDir.x = moveX / joyRadius;
            joystickDir.y = moveY / joyRadius;
        }

        joyZone.addEventListener('touchstart', (e) => {
            joystickActive = true;
            handleJoystick(e);
        });
        joyZone.addEventListener('touchmove', handleJoystick);
        const releaseJoystick = () => {
            joystickActive = false;
            joystickDir = { x: 0, y: 0 };
            joyKnob.style.transform = `translate(-50%, -50%)`;
        };
        joyZone.addEventListener('touchend', releaseJoystick);
        joyZone.addEventListener('touchcancel', releaseJoystick);
        joyZone.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'touch') return;
            joystickActive = true;
            try { joyZone.setPointerCapture(e.pointerId); } catch (_) {}
            handleJoystick(e);
        });

        joyZone.addEventListener('pointermove', (e) => {
            if (!joystickActive || e.pointerType === 'touch') return;
            handleJoystick(e);
        });

        window.addEventListener('pointerup', releaseJoystick);
        window.addEventListener('pointercancel', releaseJoystick);

        // Touch simulador de teclado para botones de rotación
        const bindKey = (id, key) => {
            const el = document.getElementById(id);
            if (!el) return;
            const pressKey = (e) => {
                e.preventDefault();
                keys[key] = true;
                el.classList.add('opacity-50');
            };
            const releaseKey = (e) => {
                e.preventDefault();
                keys[key] = false;
                el.classList.remove('opacity-50');
            };
            el.addEventListener('touchstart', pressKey);
            el.addEventListener('touchend', releaseKey);
            el.addEventListener('touchcancel', releaseKey);
            el.addEventListener('mousedown', pressKey);
            el.addEventListener('mouseup', releaseKey);
            el.addEventListener('mouseleave', releaseKey);
            el.addEventListener('pointercancel', releaseKey);
            el.addEventListener('pointerleave', releaseKey);
        };
        bindKey('btn-rotate-left', 'ArrowLeft');
        bindKey('btn-rotate-right', 'ArrowRight');
        bindKey('btn-look-up', 'ArrowUp'); // En modo paseo ArrowUp rota hacia arriba si Control está presionado, pero aquí daremos movilidad total
        bindKey('btn-look-down', 'ArrowDown');

        // Lógica de Look Up/Down para botones específicos
        let isBtnLookUp = false;
        let isBtnLookDown = false;
        const lookUpBtn = document.getElementById('btn-look-up');
        const lookDownBtn = document.getElementById('btn-look-down');
        const resetLookUp = () => isBtnLookUp = false;
        const resetLookDown = () => isBtnLookDown = false;
        lookUpBtn.onpointerdown = () => isBtnLookUp = true;
        lookUpBtn.onpointerup = resetLookUp;
        lookUpBtn.onpointercancel = resetLookUp;
        lookUpBtn.onpointerleave = resetLookUp;
        lookDownBtn.onpointerdown = () => isBtnLookDown = true;
        lookDownBtn.onpointerup = resetLookDown;
        lookDownBtn.onpointercancel = resetLookDown;
        lookDownBtn.onpointerleave = resetLookDown;


        let moveSpeed = 0.22;
        let rotSpeed = 0.035;

        function updateKeyboardNavigation() {
            if (!isWalking) {
                currentEscalatorState = null;
                return;
            }
            const prevY = camera.position.y;
            const isCtrl = keys.ControlLeft || keys.ControlRight;
            const wantsStrafeLeft = keys.ArrowLeft || keys.KeyA;
            const wantsStrafeRight = keys.ArrowRight || keys.KeyD;
            const dir = new THREE.Vector3();
            camera.getWorldDirection(dir);
            const walkDir = dir.clone(); walkDir.y = 0; walkDir.normalize();

            // Vector derecha (perpendicular a la mirada y al eje Y)
            const right = new THREE.Vector3().crossVectors(walkDir, new THREE.Vector3(0, 1, 0)).normalize();

            let moveAccumX = 0;
            let moveAccumZ = 0;

            // --- DESPLAZAMIENTO (JOYSTICK + TECLADO WASD) ---
            if (joystickActive) {
                moveAccumX += walkDir.x * (-joystickDir.y * moveSpeed) + right.x * (-joystickDir.x * moveSpeed);
                moveAccumZ += walkDir.z * (-joystickDir.y * moveSpeed) + right.z * (-joystickDir.x * moveSpeed);
            }

            if (isCtrl) {
                // MODO DESPLAZAMIENTO LATERAL + MIRADA VERTICAL
                const strafeSpeed = moveSpeed * 1.05;
                if (wantsStrafeLeft) {
                    moveAccumX -= right.x * strafeSpeed;
                    moveAccumZ -= right.z * strafeSpeed;
                }
                if (wantsStrafeRight) {
                    moveAccumX += right.x * strafeSpeed;
                    moveAccumZ += right.z * strafeSpeed;
                }

                if (keys.ArrowUp) {
                    if (dir.dot(new THREE.Vector3(0, 1, 0)) < 0.95) {
                        const relTarget = controls.target.clone().sub(camera.position);
                        relTarget.applyAxisAngle(right, -rotSpeed);
                        controls.target.copy(camera.position).add(relTarget);
                    }
                }
                if (keys.ArrowDown) {
                    if (dir.dot(new THREE.Vector3(0, -1, 0)) < 0.95) {
                        const relTarget = controls.target.clone().sub(camera.position);
                        relTarget.applyAxisAngle(right, rotSpeed);
                        controls.target.copy(camera.position).add(relTarget);
                    }
                }
            } else {
                // MODO CAMINATA (WALK + YAW)
                if (keys.ArrowUp) {
                    moveAccumX += walkDir.x * moveSpeed;
                    moveAccumZ += walkDir.z * moveSpeed;
                }
                if (keys.ArrowDown) {
                    moveAccumX -= walkDir.x * moveSpeed;
                    moveAccumZ -= walkDir.z * moveSpeed;
                }

                // Rotación horizontal
                if (keys.ArrowLeft) {
                    const relativeTarget = controls.target.clone().sub(camera.position);
                    relativeTarget.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotSpeed);
                    controls.target.copy(camera.position).add(relativeTarget);
                }
                if (keys.ArrowRight) {
                    const relativeTarget = controls.target.clone().sub(camera.position);
                    relativeTarget.applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotSpeed);
                    controls.target.copy(camera.position).add(relativeTarget);
                }

                // Mirada Vertical con botones dedicados
                if (isBtnLookUp) {
                    if (dir.dot(new THREE.Vector3(0, 1, 0)) < 0.95) {
                        const relTarget = controls.target.clone().sub(camera.position);
                        relTarget.applyAxisAngle(right, -rotSpeed);
                        controls.target.copy(camera.position).add(relTarget);
                    }
                }
                if (isBtnLookDown) {
                    if (dir.dot(new THREE.Vector3(0, -1, 0)) < 0.95) {
                        const relTarget = controls.target.clone().sub(camera.position);
                        relTarget.applyAxisAngle(right, rotSpeed);
                        controls.target.copy(camera.position).add(relTarget);
                    }
                }

                // Teclas WASD (Strafe opcional en teclado)
                if (keys.KeyD) { moveAccumX += right.x * moveSpeed; moveAccumZ += right.z * moveSpeed; }
                if (keys.KeyA) { moveAccumX -= right.x * moveSpeed; moveAccumZ -= right.z * moveSpeed; }
                if (keys.KeyW) { moveAccumX += walkDir.x * moveSpeed; moveAccumZ += walkDir.z * moveSpeed; }
                if (keys.KeyS) { moveAccumX -= walkDir.x * moveSpeed; moveAccumZ -= walkDir.z * moveSpeed; }
            }

            // --- APLICACIÓN DE MOVIMIENTO CON MOTOR DE COLISIONES ---
            if (Math.abs(moveAccumX) > 0.0001 || Math.abs(moveAccumZ) > 0.0001) {
                const nx = camera.position.x + moveAccumX;
                const ny = camera.position.y;
                const nz = camera.position.z + moveAccumZ;

                // Colisión eje X (deslizamiento)
                if (!checkCollision(nx, ny, camera.position.z)) {
                    camera.position.x = nx;
                    controls.target.x += moveAccumX;
                }
                // Colisión eje Z (deslizamiento)
                if (!checkCollision(camera.position.x, ny, nz)) {
                    camera.position.z = nz;
                    controls.target.z += moveAccumZ;
                }
                isWalking = true;
            }

            // --- MOTOR DE ESCALERAS MECÁNICAS (TRAYECTORIA REAL) ---
            let onEscalator = false;
            currentEscalatorState = null;
            const nowMs = performance.now();
            if (escalatorExitCooldown) {
                const exitDx = camera.position.x - escalatorExitCooldown.x;
                const exitDz = camera.position.z - escalatorExitCooldown.z;
                if ((exitDx * exitDx + exitDz * exitDz) >= (escalatorExitCooldown.releaseDistance * escalatorExitCooldown.releaseDistance)) {
                    escalatorExitCooldown = null;
                }
            }
            let activeEscalator = findActiveEscalator(
                camera.position.x,
                camera.position.y,
                camera.position.z,
                PLAYER_EYE_HEIGHT
            );
            if (activeEscalator && escalatorExitCooldown && activeEscalator.escalator.id === escalatorExitCooldown.id) {
                activeEscalator = null;
            }
            if (activeEscalator) {
                const prevCamPos = camera.position.clone();
                const ride = advanceAlongEscalator(
                    camera.position,
                    activeEscalator.escalator,
                    activeEscalator.progress,
                    0.11,
                    PLAYER_EYE_HEIGHT,
                    0.4,
                    true
                );
                const delta = camera.position.clone().sub(prevCamPos);
                controls.target.add(delta);
                onEscalator = true;
                if (ride.done) {
                    const exitHoldPos = getEscalatorRidePosition(activeEscalator.escalator, activeEscalator.escalator.pathLenZ, PLAYER_EYE_HEIGHT);
                    currentEscalatorState = null;
                    escalatorExitCooldown = {
                        id: activeEscalator.escalator.id,
                        x: exitHoldPos.x,
                        z: exitHoldPos.z,
                        releaseDistance: 2.35
                    };
                    onEscalator = false;
                } else {
                    currentEscalatorState = {
                        id: activeEscalator.escalator.id,
                        t: activeEscalator.escalator.pathLenZ > 0 ? (ride.progress / activeEscalator.escalator.pathLenZ) : 0
                    };
                }
            }

            // BLOQUEO DE ALTURA (SOLO FUERA DE ESCALERAS)
            if (isWalking && !onEscalator) {
                const prevFloorY = camera.position.y;
                const groundY = camera.position.y > 3.0 ? 5.4 : 0.1;
                camera.position.y = groundY + PLAYER_EYE_HEIGHT;
                controls.target.y += (camera.position.y - prevFloorY);
            }
        }



        // --- SUPABASE & MULTIJUGADOR OPTIMIZADO ---
        let supabaseClient = null;
        let currentEscalatorState = null;
        let escalatorExitCooldown = null;
        let avatarLabelMode = 'far';
        const AVATAR_LABEL_NEAR_DISTANCE = 18;
        const AVATAR_LABEL_FAR_DISTANCE = 40;
        const AVATAR_LABEL_NPC_FAR_DISTANCE = 35;
        const AVATAR_CAMERA_HIDE_DISTANCE = 3.2;

        function syncAvatarLabelModeButton() {
            const btn = document.getElementById('avatar-label-mode-btn');
            if (!btn) return;
            btn.innerText = avatarLabelMode === 'far' ? 'Nombres: Lejos' : 'Nombres: Cerca';
        }

        window.toggleAvatarLabelMode = function () {
            avatarLabelMode = avatarLabelMode === 'far' ? 'near' : 'far';
            syncAvatarLabelModeButton();
            closeControlsMenu();
        };

        function shouldShowAvatarLabel(worldPos, projectedPos, farDistance = Infinity) {
            if (projectedPos.z > 1 || Math.abs(projectedPos.x) > 1 || Math.abs(projectedPos.y) > 1) return false;
            const distToCam = camera.position.distanceTo(worldPos);
            const distanceLimit = avatarLabelMode === 'far' ? farDistance : AVATAR_LABEL_NEAR_DISTANCE;
            return distToCam <= distanceLimit;
        }

        syncAvatarLabelModeButton();
        syncWalkModeButton();
        syncControlsMenu();
        try {
            supabaseClient = supabase.createClient(
                'https://kcfuixvrwbnizspgtmtr.supabase.co',
                'sb_publishable_-H23KD1xJafE_DFpBFZlyA_CL9sNlpG'
            );
        } catch(e) { console.error("Error inicializando Supabase:", e); }

        let passwordRecoveryAudience = 'member';
        let passwordRecoverySessionReady = false;

        function setPasswordRecoveryStatus(message = "", tone = "muted") {
            const el = document.getElementById('password-recovery-status');
            if (!el) return;
            const palette = {
                muted: '#888',
                success: '#7fcf8d',
                error: '#ff8866',
                warn: '#c5a059'
            };
            el.textContent = message;
            el.style.color = palette[tone] || palette.muted;
        }

        function cleanupPasswordRecoveryUrl() {
            const url = new URL(window.location.href);
            url.searchParams.delete('recovery');
            url.searchParams.delete('account');
            history.replaceState({}, document.title, url.pathname + url.search + url.hash.replace(/#.*/, ''));
            if (window.location.hash) {
                history.replaceState({}, document.title, url.pathname + url.search);
            }
        }

        function enterPasswordResetMode(audience = 'member') {
            passwordRecoveryAudience = audience;
            passwordRecoverySessionReady = true;
            const modal = document.getElementById('password-recovery-modal');
            const requestPanel = document.getElementById('password-recovery-request-panel');
            const resetPanel = document.getElementById('password-recovery-reset-panel');
            const title = document.getElementById('password-recovery-title');
            if (title) title.textContent = "Nueva contraseña";
            if (requestPanel) requestPanel.style.display = 'none';
            if (resetPanel) resetPanel.style.display = 'flex';
            if (modal) modal.style.display = 'block';
            setPasswordRecoveryStatus("Ingresa y confirma la nueva contraseña para terminar la recuperación.", "warn");
        }

        function hasRecoveryTokensInUrl() {
            const search = new URLSearchParams(window.location.search);
            const hash = new URLSearchParams(String(window.location.hash || "").replace(/^#/, ''));
            return search.get('recovery') === '1' && (
                hash.get('type') === 'recovery' ||
                !!hash.get('access_token') ||
                !!hash.get('refresh_token')
            );
        }

        async function maybeHandlePasswordRecoveryEntry() {
            if (!supabaseClient || !hasRecoveryTokensInUrl()) return;
            const search = new URLSearchParams(window.location.search);
            enterPasswordResetMode(search.get('account') || 'member');
        }

        function buildPasswordRecoveryRedirectUrl(audience = 'member') {
            const url = new URL(window.location.href);
            url.searchParams.set('recovery', '1');
            url.searchParams.set('account', audience);
            url.hash = '';
            return url.toString();
        }

        window.openPasswordRecovery = function(audience = 'member') {
            passwordRecoveryAudience = audience;
            passwordRecoverySessionReady = false;
            const modal = document.getElementById('password-recovery-modal');
            const requestPanel = document.getElementById('password-recovery-request-panel');
            const resetPanel = document.getElementById('password-recovery-reset-panel');
            const title = document.getElementById('password-recovery-title');
            const copy = document.getElementById('password-recovery-copy');
            const identifierInput = document.getElementById('password-recovery-identifier');
            if (title) title.textContent = "Recuperar contraseña";
            if (copy) copy.textContent = audience === 'tenant'
                ? "Ingresa correo, marca o código de local. Te enviaremos un enlace para redefinir la contraseña del locatario."
                : "Ingresa correo o nick del visitante inscrito. Te enviaremos un enlace para redefinir la contraseña.";
            if (identifierInput) {
                identifierInput.value = audience === 'tenant'
                    ? (document.getElementById('tenant-login-email-main')?.value || document.getElementById('tenant-email')?.value || "")
                    : (document.getElementById('member-login-email')?.value || document.getElementById('nickname-input')?.value || "");
            }
            if (requestPanel) requestPanel.style.display = 'flex';
            if (resetPanel) resetPanel.style.display = 'none';
            if (modal) modal.style.display = 'block';
            setPasswordRecoveryStatus("", "muted");
        };

        window.closePasswordRecovery = function() {
            const modal = document.getElementById('password-recovery-modal');
            if (modal) modal.style.display = 'none';
            if (!passwordRecoverySessionReady) return;
            cleanupPasswordRecoveryUrl();
        };

        window.sendPasswordRecovery = async function() {
            if (!supabaseClient) return setPasswordRecoveryStatus("No hay conexión con Supabase.", "error");
            const identifier = document.getElementById('password-recovery-identifier')?.value.trim() || "";
            if (!identifier) return setPasswordRecoveryStatus("Ingresa un correo o identificador válido.", "error");

            setPasswordRecoveryStatus("Buscando cuenta y enviando enlace...", "muted");

            const email = passwordRecoveryAudience === 'tenant'
                ? await resolveTenantEmail(identifier)
                : await resolveMemberEmail(identifier);

            if (!email || !email.includes('@')) {
                return setPasswordRecoveryStatus("No pude resolver un correo válido para esa cuenta.", "error");
            }

            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: buildPasswordRecoveryRedirectUrl(passwordRecoveryAudience)
            });

            if (error) {
                return setPasswordRecoveryStatus("No se pudo enviar el enlace: " + error.message, "error");
            }

            setPasswordRecoveryStatus(`Enlace enviado a ${email}. Revisa tu correo y vuelve desde ese link para crear una nueva contraseña.`, "success");
        };

        window.submitRecoveredPassword = async function() {
            if (!supabaseClient) return setPasswordRecoveryStatus("No hay conexión con Supabase.", "error");
            const newPass = document.getElementById('password-recovery-new-pass')?.value || "";
            const confirmPass = document.getElementById('password-recovery-new-pass-confirm')?.value || "";
            if (newPass.length < 6) return setPasswordRecoveryStatus("La nueva contraseña debe tener al menos 6 caracteres.", "error");
            if (newPass !== confirmPass) return setPasswordRecoveryStatus("Las contraseñas no coinciden.", "error");

            const { error } = await supabaseClient.auth.updateUser({ password: newPass });
            if (error) return setPasswordRecoveryStatus("No se pudo actualizar la contraseña: " + error.message, "error");

            setPasswordRecoveryStatus("Contraseña actualizada. Vuelve a iniciar sesión con la nueva clave.", "success");
            cleanupPasswordRecoveryUrl();
            passwordRecoverySessionReady = false;

            setTimeout(async () => {
                await supabaseClient.auth.signOut();
                window.closePasswordRecovery();
                if (passwordRecoveryAudience === 'tenant') {
                    setEntryMode('tenant');
                } else {
                    setEntryMode('member');
                }
            }, 900);
        };

        if (supabaseClient?.auth?.onAuthStateChange) {
            supabaseClient.auth.onAuthStateChange((event) => {
                if (event === 'PASSWORD_RECOVERY') {
                    const search = new URLSearchParams(window.location.search);
                    enterPasswordResetMode(search.get('account') || passwordRecoveryAudience || 'member');
                }
            });
        }

        setTimeout(() => {
            maybeHandlePasswordRecoveryEntry();
        }, 250);

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
            if (typeof store === 'string') return store;
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

        async function uploadTenantImage(file, kind = 'asset', index = '') {
            if (!supabaseClient) throw new Error("No hay conexión con Supabase.");
            const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
            if (sessionError) throw sessionError;
            if (!sessionData?.session?.access_token) {
                throw new Error("No hay sesión activa para subir imágenes. Cierra sesión, vuelve a entrar como locatario/admin y prueba otra vez.");
            }
            const storeCode = getStoreCode(myOwnedStore);
            if (!storeCode) throw new Error("No hay local seleccionado.");

            const maxSide = kind === 'logo' ? 800 : 1200;
            const blob = await resizeTenantImage(file, maxSide, 0.82);
            const ext = getFileExtensionFromType(blob.type);
            const safeKind = String(kind || 'asset').replace(/[^a-z0-9_-]/gi, '').toLowerCase();
            const suffix = index === '' || index === null ? '' : `-${index}`;
            const path = `${storeCode}/${safeKind}${suffix}-${Date.now()}.${ext}`;

            const { error } = await supabaseClient.storage
                .from(TENANT_ASSET_BUCKET)
                .upload(path, blob, {
                    contentType: blob.type,
                    upsert: false
                });
            if (error) throw error;

            const { data } = supabaseClient.storage.from(TENANT_ASSET_BUCKET).getPublicUrl(path);
            return data.publicUrl;
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
                if (!byId.error && byId.data) return byId;
                if (byId.error && !isNoRowsError(byId.error)) lastError = byId.error;

                const byLocalCode = await supabaseClient
                    .from('stores')
                    .update(payload)
                    .eq('local_code', code)
                    .select('*')
                    .maybeSingle();
                if (!byLocalCode.error && byLocalCode.data) return byLocalCode;
                if (byLocalCode.error && !isMissingColumnError(byLocalCode.error, 'local_code') && !isNoRowsError(byLocalCode.error)) {
                    lastError = byLocalCode.error;
                }
            }

            return { data: null, error: lastError || new Error("No encontre el local en stores.") };
        }

        async function loadStoreProducts(storeCode) {
            if (!storeCode) return { products: [], skipped: false, error: null };
            
            // Intentar por store_id (UUID o código)
            const byStoreId = await supabaseClient
                .from('store_products')
                .select('*')
                .eq('store_id', storeCode);
            
            if (!byStoreId.error && (byStoreId.data || []).length > 0) {
                return { products: byStoreId.data || [], skipped: false, error: null };
            }

            // Intentar por local_code
            const { data, error } = await supabaseClient
                .from('store_products')
                .select('*')
                .ilike('local_code', storeCode);
            
            if (!error && (data || []).length > 0) {
                return { products: data || [], skipped: false, error: null };
            }

            // Si fallan ambos, devolver lo que tengamos del primer intento si no hubo error crítico
            return { products: byStoreId.data || [], skipped: false, error: byStoreId.error };
        }

        async function replaceStoreProducts(storeRef, productsToInsert = []) {
            const storeId = (typeof storeRef === 'object' ? storeRef.id : null) || storeRef;
            const localCode = (typeof storeRef === 'object' ? storeRef.local_code : null) || (String(storeId).length < 10 ? storeId : null);
            
            if (!storeId) return { ok: false, skipped: false, error: new Error("No hay local seleccionado.") };

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
                setTenantUploadStatus(statusEl, "Subiendo imagen optimizada...", "warn");
                const publicUrl = await uploadTenantImage(file, 'product', index);
                const imageInput = slot?.querySelector('.p-image');
                if (imageInput) imageInput.value = publicUrl;
                setTenantUploadStatus(statusEl, "Imagen subida. Guarda cambios.", "success");
            } catch (error) {
                console.error("Error subiendo producto:", error);
                setTenantUploadStatus(statusEl, "No pude subir: " + error.message, "error");
            } finally {
                input.value = "";
            }
        };

        // --- SISTEMA DE INTERACCIÓN (RAYCASTING) ---
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        const objectDebugContent = document.getElementById('object-debug-content');
        const OBJECT_INSPECTOR_ENABLED = true;

        function formatDebugVector(vec) {
            if (!vec) return "-";
            return `${vec.x.toFixed(2)}, ${vec.y.toFixed(2)}, ${vec.z.toFixed(2)}`;
        }

        function findShopRoot(obj) {
            let current = obj;
            while (current) {
                if (current.userData?.shopCode) return current;
                current = current.parent;
            }
            return null;
        }

        function collectParentChain(obj) {
            const names = [];
            let current = obj;
            while (current) {
                names.push(current.name || current.userData?.shopCode || current.type || "Object3D");
                current = current.parent;
            }
            return names.slice(0, 6).join(" <- ");
        }

        const axisReferenceElements = {
            lineX: document.getElementById('axis-line-x'),
            lineY: document.getElementById('axis-line-y'),
            lineZ: document.getElementById('axis-line-z'),
            labelX: document.getElementById('axis-label-x'),
            labelY: document.getElementById('axis-label-y'),
            labelZ: document.getElementById('axis-label-z')
        };
        const axisReferenceOrigin = { x: 30, y: 62 };
        const axisReferenceScale = 34;
        const axisReferenceInverseQuat = new THREE.Quaternion();
        const axisReferenceTempVector = new THREE.Vector3();
        const axisReferenceWorldAxes = [
            { vector: new THREE.Vector3(1, 0, 0), line: axisReferenceElements.lineX, label: axisReferenceElements.labelX },
            { vector: new THREE.Vector3(0, 1, 0), line: axisReferenceElements.lineY, label: axisReferenceElements.labelY },
            { vector: new THREE.Vector3(0, 0, 1), line: axisReferenceElements.lineZ, label: axisReferenceElements.labelZ }
        ];

        function updateGPSDisplay() {
            const gpsDisplay = document.getElementById('gps-display');
            if (!gpsDisplay || gpsDisplay.style.display === 'none') return;
            const pos = camera.position;
            document.getElementById('gps-x').innerText = pos.x.toFixed(2);
            document.getElementById('gps-y').innerText = pos.y.toFixed(2);
            document.getElementById('gps-z').innerText = pos.z.toFixed(2);
        }

        function updateAxisReference() {
            if (!camera || !axisReferenceElements.lineX) return;

            axisReferenceInverseQuat.copy(camera.quaternion).invert();
            axisReferenceWorldAxes.forEach((axis) => {
                axisReferenceTempVector.copy(axis.vector).applyQuaternion(axisReferenceInverseQuat).normalize();
                const endX = axisReferenceOrigin.x + axisReferenceTempVector.x * axisReferenceScale;
                const endY = axisReferenceOrigin.y - axisReferenceTempVector.y * axisReferenceScale;
                axis.line.setAttribute('x1', axisReferenceOrigin.x);
                axis.line.setAttribute('y1', axisReferenceOrigin.y);
                axis.line.setAttribute('x2', endX.toFixed(2));
                axis.line.setAttribute('y2', endY.toFixed(2));
                axis.label.setAttribute('x', (endX + 4).toFixed(2));
                axis.label.setAttribute('y', (endY + 4).toFixed(2));
                const opacity = THREE.MathUtils.clamp(0.45 + ((axisReferenceTempVector.z + 1) * 0.25), 0.35, 1);
                axis.line.setAttribute('opacity', opacity.toFixed(2));
                axis.label.setAttribute('opacity', opacity.toFixed(2));
            });
        }

        function updateObjectInspector(intersection) {
            if (!OBJECT_INSPECTOR_ENABLED) return;
            if (!objectDebugContent) return;
            if (!intersection?.object) {
                objectDebugContent.innerHTML = `<div class="debug-empty">No se detectó ningún objeto en este clic.</div>`;
                return;
            }

            const obj = intersection.object;
            const shopRoot = findShopRoot(obj);
            const worldPos = new THREE.Vector3();
            obj.getWorldPosition(worldPos);
            const material = Array.isArray(obj.material) ? obj.material[0] : obj.material;
            const materialName = material?.name || material?.type || "-";
            const materialColor = material?.color ? `#${material.color.getHexString()}` : "-";
            const geometry = obj.geometry?.type || "-";
            const userDataKeys = Object.keys(obj.userData || {}).filter(Boolean);

            objectDebugContent.innerHTML = [
                `<div class="debug-row"><strong>Objeto:</strong> ${obj.name || "(sin nombre)"}</div>`,
                `<div class="debug-row"><strong>Tipo:</strong> ${obj.type || "-"}</div>`,
                `<div class="debug-row"><strong>Geometría:</strong> ${geometry}</div>`,
                `<div class="debug-row"><strong>Material:</strong> ${materialName}</div>`,
                `<div class="debug-row"><strong>Color:</strong> ${materialColor}</div>`,
                `<div class="debug-row"><strong>Posición mundo:</strong> ${formatDebugVector(worldPos)}</div>`,
                `<div class="debug-row"><strong>Punto clic:</strong> ${formatDebugVector(intersection.point)}</div>`,
                `<div class="debug-row"><strong>Distancia:</strong> ${intersection.distance.toFixed(2)}</div>`,
                `<div class="debug-row"><strong>shopCode:</strong> ${shopRoot?.userData?.shopCode || "-"}</div>`,
                `<div class="debug-row"><strong>Ruta:</strong> ${collectParentChain(obj)}</div>`,
                `<div class="debug-row"><strong>userData:</strong> ${userDataKeys.length ? userDataKeys.join(", ") : "-"}</div>`
            ].join("");
        }

        // --- SISTEMA DE BÚSQUEDA Y MAPAS ---
        let fullStoreInventory = [];
        async function precalculateInventory() {
            if (!supabaseClient) return;
            // Optimización: Una sola petición para obtener todos los locales activos
            const { data: allStores } = await supabaseClient.from('stores').select('*');
            if (!allStores) return;

            fullStoreInventory = allStores.map(s => ({
                shopCode: getStoreCode(s),
                name: s.name || "Local Disponible",
                category: s.category || "Comercio",
                products: [] // Los productos se cargarán on-demand o al filtrar si es necesario
            }));
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
                div.innerHTML = `<span><strong>${m.name}</strong> (${m.category})</span> <small>${m.shopCode}</small>`;
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
            if (wing === 'E') x = 50 + offset;
            if (wing === 'O') x = 50 - offset;

            if (store.shopCode.length === 1) { // Ancla
                if (wing === 'N') y = 5; if (wing === 'S') y = 95; if (wing === 'E') x = 95; if (wing === 'O') x = 5;
            }

            const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            dot.setAttribute("cx", x); dot.setAttribute("cy", y); dot.setAttribute("r", 4);
            dot.setAttribute("fill", "#ff0000");
            const animate = document.createElementNS("http://www.w3.org/2000/svg", "animate");
            animate.setAttribute("attributeName", "r"); animate.setAttribute("values", "2;5;2"); animate.setAttribute("dur", "1s"); animate.setAttribute("repeatCount", "indefinite");
            dot.appendChild(animate);
            mapTarget.appendChild(dot);

            document.getElementById('location-text').innerHTML = `<b style="color:#c5a059;">Ubicación:</b> Ala ${wing}, Planta ${floor}. Local ${store.shopCode}`;
        }

        window.openSearch = function () { document.getElementById('search-modal').style.display = 'block'; document.getElementById('modal-overlay').style.display = 'block'; };
        document.getElementById('search-close-btn').onclick = () => { document.getElementById('search-modal').style.display = 'none'; document.getElementById('modal-overlay').style.display = 'none'; };

        let lastMallInteractionSignature = "";
        let lastMallInteractionAt = 0;

        async function handleMallInteractionPointer(event) {
            // Mostrar pequeño feedback visual de interacción
            showInteractionFeedback("Procesando clic...");
            if (
                canvasContainer &&
                event.target.closest &&
                event.target.closest('#canvas-container, canvas') &&
                !event.target.closest('#login-overlay, #store-modal, #search-modal, #tenant-login-modal, #tenant-apply-modal, #super-admin-modal, #tenant-admin-modal, #password-recovery-modal, #controls-menu, input, textarea, button, select, a, label')
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
        let myAvatarStyle = "1";
        let currentAccessRole = "guest";
        let currentMemberProfile = null;
        let currentUserProfile = null;
        let currentUserRole = "guest";
        let hasEnteredMall = false;
        let pendingMemberPhone = "";
        let pendingMemberEmail = "";
        let pendingMemberPhoneOtpType = "phone_change";

        window.selectAvatar = function (id, el) {
            myAvatarStyle = id;
            document.querySelectorAll('#avatar-selection .avatar-opt').forEach(btn => btn.classList.remove('selected'));
            el.classList.add('selected');
        }

        window.setEntryMode = function(mode) {
            currentAccessRole = mode;
            const guestPanel = document.getElementById('guest-entry-panel');
            const memberPanel = document.getElementById('member-entry-panel');
            const tenantPanel = document.getElementById('tenant-entry-panel');
            const guestButton = document.getElementById('guest-entry-button');
            const avatarSelection = document.getElementById('avatar-selection');
            const secondaryActions = document.getElementById('entry-secondary-actions');

            // Reset visibilities
            if (guestPanel) guestPanel.style.display = (mode === 'guest') ? 'block' : 'none';
            if (memberPanel) memberPanel.style.display = (mode === 'member') ? 'flex' : 'none';
            if (tenantPanel) tenantPanel.style.display = (mode === 'tenant') ? 'flex' : 'none';
            
            const isGuest = (mode === 'guest');
            if (guestButton) guestButton.style.display = isGuest ? 'inline-block' : 'none';
            if (avatarSelection) avatarSelection.style.display = isGuest ? 'block' : 'none';
            if (secondaryActions) secondaryActions.style.display = isGuest ? 'flex' : 'none';
        }

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
            return `Visitante ${value}`;
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

        function userHasAdminAccess(profile = null, user = null) {
            return (profile?.role === "admin") || (user?.email === 'alanmauri4815@gmail.com');
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

        window.resetAdminPosition = async function() {
            if (!isAdmin) return;
            localStorage.removeItem('mall_admin_last_pos');
            if (supabaseClient && currentUserProfile?.auth_user_id) {
                await supabaseClient.from('user_profiles').update({ last_pos: null }).eq('auth_user_id', currentUserProfile.auth_user_id);
            }
            camera.position.set(0, 1.7, -82);
            controls.target.set(0, 1.80, -78);
            controls.update();
            alert("Posición reiniciada. Te hemos llevado a la entrada del Atrio Sur.");
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
            const manageItem = document.getElementById('tenant-manage-menu-item');
            const tenantAccessItem = document.getElementById('tenant-access-btn');
            const hasTenantSession = hasPrivilegedMallSession && !!currentTenantUser && myOwnedStores.length > 0;
            if (manageItem) manageItem.style.display = hasTenantSession ? 'block' : 'none';
            if (tenantAccessItem) tenantAccessItem.innerText = hasTenantSession ? 'Panel locatario' : 'Acceso Locatarios';
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
                    currentTenantUser = null;
                    hasPrivilegedMallSession = false;
                    let profile = await loadUserProfile(user);
                    if (!profile && user.email === 'alanmauri4815@gmail.com') {
                        profile = {
                            auth_user_id: user.id,
                            email: user.email,
                            display_name: "Administrador Mall",
                            role: "admin"
                        };
                    }
                    applyUserRole(profile, user);

                    myOwnedStores = [];
                    myOwnedStore = null;
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
                if (role === "guest" || role === "member" || role === "registered_visitor") {
                    preloadStoreContent('O101');
                }
                
                if (!restored) {
                    camera.position.set(0, 1.7, -85);
                    controls.target.set(0, 1.7, -100);
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

            const findApplicationEmailByBrand = async (brandName) => {
                const value = String(brandName || "").trim();
                if (!value) return "";
                const { data, error } = await supabaseClient
                    .from('tenant_applications')
                    .select('email')
                    .ilike('brand_name', value)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                return !error && data?.email ? data.email : "";
            };

            const { data: rpcEmail, error: rpcError } = await supabaseClient.rpc('resolve_tenant_login_email', {
                login_identifier: clean
            });
            if (!rpcError && rpcEmail) return rpcEmail;

            const applicationEmail = await findApplicationEmailByBrand(clean);
            if (applicationEmail) return applicationEmail;

            const lookups = [
                supabaseClient.from('stores').select('id,name,contact_email').eq('id', clean).maybeSingle(),
                supabaseClient.from('stores').select('id,name,contact_email').ilike('name', clean).maybeSingle()
            ];
            for (const lookup of lookups) {
                const { data, error } = await lookup;
                if (!error && data?.contact_email) return data.contact_email;
                if (!error && data?.name) {
                    const emailFromStoreName = await findApplicationEmailByBrand(data.name);
                    if (emailFromStoreName) return emailFromStoreName;
                }
            }

            console.warn("No se pudo resolver el identificador de locatario:", rpcError || 'sin coincidencias');
            return clean;
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
                const msg = "Ingresa marca, local o correo, junto con la contraseña de locatario.";
                if (source === 'main') return setTenantLoginStatus(msg, true);
                return alert(msg);
            }

            const email = await resolveTenantEmail(identifier);
            if (!email || !email.includes('@')) {
                const msg = `No pude encontrar el correo asociado a "${identifier}". Prueba con el correo directo del locatario o ejecuta el SQL de reparacion en Supabase.`;
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
                profile = email === 'alanmauri4815@gmail.com'
                    ? { auth_user_id: data.user.id, email, display_name: "Administrador Mall", role: "admin" }
                    : { auth_user_id: data.user.id, email, display_name: data.user.user_metadata?.brand_name || email.split('@')[0], role: "registered_visitor" };
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
            
            if (source === 'main') setTenantLoginStatus("Sesión iniciada. Entrando al mall...");
            else alert("Sesión iniciada con éxito.");
            if (source === 'main') {
                const tenantName = myOwnedStore?.name || data.user.user_metadata?.brand_name || email.split('@')[0];
                await enterMallWithIdentity({ nickname: `Locatario ${tenantName}`, role: "tenant", user: data.user });
                // Fuerza sincronizacion final de controles admin tras entrar al mall.
                applyUserRole(currentUserProfile, data.user);
            }
        }

        window.openTenantAdminFromMenu = async function() {
            closeControlsMenu();
            if (!currentTenantUser) return alert("Primero inicia sesión como locatario.");
            if (!myOwnedStores.length) return alert("Tu cuenta aún no tiene locales asignados.");

            if (myOwnedStores.length > 1) {
                const options = myOwnedStores.map(s => `${getStoreCode(s)}: ${s.name || 'Local sin nombre'}`).join('\n');
                const selectedCode = prompt(`Tienes más de un local. Escribe el código que quieres gestionar:\n\n${options}`, getStoreCode(myOwnedStore) || getStoreCode(myOwnedStores[0]));
                if (!selectedCode) return;
                const selected = myOwnedStores.find(s => getStoreCode(s).toLowerCase() === selectedCode.trim().toLowerCase());
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

        function setFieldValue(id, value = "") {
            const el = document.getElementById(id);
            if (!el) return;
            if (el.type === 'checkbox') el.checked = !!value;
            else el.value = value ?? "";
        }

        function getTrimmedValue(id) {
            return String(document.getElementById(id)?.value || "").trim();
        }

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
            if (profile?.role === 'admin' || String(profile?.email || "").toLowerCase() === 'alanmauri4815@gmail.com') {
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
            const protectedAdmin = String(profile?.role || "").toLowerCase() === 'admin' || targetEmail === 'alanmauri4815@gmail.com';

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
                    ? "No encontré al usuario en mall_members. Debe registrarse primero."
                    : "Todavía no tiene cuenta creada. Debe registrarse antes de asignarle locales.";
            }
        }

        async function refreshAdminAssignedStores(app = null) {
            const target = document.getElementById('admin-assigned-stores');
            if (!target) return;
            target.textContent = "";
            if (!app) return;

            const lookup = await findAssignableProfileForApplication(app);
            if (lookup.error) {
                target.style.color = '#ff8866';
                target.textContent = "No pude verificar los locales asignados.";
                return;
            }

            const profile = lookup.profile;
            if (!profile?.auth_user_id) {
                target.style.color = '#777';
                target.textContent = "Locales asignados: sin cuenta vinculada.";
                return;
            }

            const { data: ownedStores, error } = await supabaseClient
                .from('stores')
                .select('id, name, owner_id')
                .eq('owner_id', profile.auth_user_id)
                .order('id', { ascending: true });

            if (error) {
                target.style.color = '#ff8866';
                target.textContent = "No pude leer los locales asignados: " + error.message;
                return;
            }

            const labels = (ownedStores || []).map(store => {
                const code = getStoreCode(store) || 'Sin código';
                const name = store.name ? ` (${store.name})` : '';
                return `${code}${name}`;
            });

            target.style.color = labels.length ? '#7fcf8d' : '#888';
            target.textContent = labels.length
                ? `Locales asignados: ${labels.join(', ')}`
                : "Locales asignados: ninguno.";
        }

        async function refreshAdminAvailableStores() {
            const target = document.getElementById('admin-available-stores');
            if (!target || !supabaseClient) return;

            const { data: stores, error } = await supabaseClient
                .from('stores')
                .select('id, local_code, name, owner_id')
                .order('local_code', { ascending: true });

            if (error) {
                target.style.color = '#ff8866';
                target.textContent = "No pude cargar los locales disponibles: " + error.message;
                return;
            }

            const freeStores = (stores || []).filter(store => !store.owner_id);
            if (!freeStores.length) {
                target.style.color = '#c5a059';
                target.textContent = "No hay locales libres en este momento.";
                return;
            }

            const labels = freeStores.slice(0, 12).map(store => {
                const code = getStoreCode(store) || store.id || 'Sin código';
                return store.name ? `${code} (${store.name})` : code;
            });
            const extraCount = Math.max(0, freeStores.length - labels.length);

            target.style.color = '#7fcf8d';
            target.textContent = `Disponibles ahora: ${labels.join(', ')}${extraCount ? ` y ${extraCount} más.` : '.'}`;
        }

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
            document.getElementById('admin-local-codes').value = '';
            setAdminAssignmentStatus("Escribe uno o varios códigos visibles del mall y confirma la aprobación.", "muted");
            await refreshAdminProfileIndicator(app.email || "");
            await refreshAdminAssignedStores(app);
            await refreshAdminAvailableStores();
            await loadAdminRentalData(app);
        }

        async function assignStoresToApplicant(appId) {
            const app = getAdminApplicationById(appId);
            if (!app?.email) {
                setAdminAssignmentStatus("No encontré la postulación seleccionada.", "error");
                return;
            }

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
            if (!effectiveProfile?.auth_user_id) {
                setAdminAssignmentStatus("Ese correo todavía no tiene cuenta creada. Debe registrarse primero.", "error");
                return;
            }

            const { data: allStores, error: storesErr } = await supabaseClient
                .from('stores')
                .select('*');
            if (storesErr) {
                setAdminAssignmentStatus("No pude leer locales: " + storesErr.message, "error");
                return;
            }

            const byCode = new Map();
            (allStores || []).forEach(s => {
                if (s.local_code) byCode.set(String(s.local_code).toUpperCase(), s);
                if (s.id) byCode.set(String(s.id).toUpperCase(), s);
            });

            const resolved = requestedCodes.map(c => ({ requested: c, store: byCode.get(c) || null }));
            const missing = resolved.filter(x => !x.store).map(x => x.requested);
            if (missing.length) {
                setAdminAssignmentStatus("Estos códigos no existen: " + missing.join(', '), "error");
                return;
            }

            const alreadyTaken = resolved.filter(x => x.store.owner_id && x.store.owner_id !== effectiveProfile.auth_user_id).map(x => getStoreCode(x.store));
            if (alreadyTaken.length) {
                setAdminAssignmentStatus("Estos locales ya tienen otro locatario: " + alreadyTaken.join(', '), "error");
                return;
            }

            const storesToAssign = [...new Map(
                resolved
                    .filter(x => x.store?.id)
                    .map(x => [String(x.store.id), x.store])
            ).values()];
            const storeIdsToAssign = storesToAssign.map(store => store.id);
            const storeCodesToAssign = storesToAssign.map(store => getStoreCode(store)).filter(Boolean);
            if (!storeIdsToAssign.length) {
                setAdminAssignmentStatus("No hay locales válidos para asignar.", "error");
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
                    : "Locales asignados: " + storeCodesToAssign.join(', '),
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

        window.deleteSelectedTenantAccount = async function() {
            if (!selectedAdminApplicationId) {
                setAdminAssignmentStatus("Selecciona una postulación primero.", "error");
                return;
            }
            await deleteMallAccountForApplication(selectedAdminApplicationId);
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
            adminApplicationsCache = apps || [];

            if (appsErr) {
                listDiv.innerHTML = `<p style="color:#ff8866; font-size:12px;">Error cargando postulaciones: ${escapeHtml(appsErr.message)}</p>`;
                return;
            }

            if (!apps || !apps.length) {
                listDiv.innerHTML = `<p style="color:#888; font-size:12px;">No hay postulaciones por revisar.</p>`;
            } else {
                apps.forEach(app => {
                    const status = (app.status || 'pending').toLowerCase();
                    const statusColor = status === 'approved' ? '#4CAF50' : status === 'rejected' ? '#ff5f57' : '#c5a059';
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

            if (!selectedAdminApplicationId && apps && apps.length) {
                const preferred = apps.find(app => (app.status || 'pending').toLowerCase() === 'pending') || apps[0];
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
                return;
            }
            const total = stores.length;
            const occupied = stores.filter(s => s.owner_id).length;
            const free = total - occupied;

            document.getElementById('stat-total-stores').innerText = total;
            document.getElementById('stat-occupied-stores').innerText = occupied;
            document.getElementById('stat-free-stores').innerText = free;
        }

        window.openTenantAdmin = async function() {
            if (!myOwnedStores.length && myOwnedStore) myOwnedStores = [myOwnedStore];
            const selectedStore = myOwnedStores.find(s => getStoreCode(s) === currentModalStoreCode) || myOwnedStore;
            if (!selectedStore) return alert("No tienes un local asignado.");
            myOwnedStore = selectedStore;
            const storeCode = getStoreCode(myOwnedStore);
            document.getElementById('tenant-store-code-display').textContent = storeCode || "Sin código";
            
            document.getElementById('edit-store-name').value = myOwnedStore.name;
            document.getElementById('edit-store-category').value = myOwnedStore.category || "";
            document.getElementById('edit-store-email').value = myOwnedStore.contact_email || "";
            document.getElementById('edit-store-phone').value = myOwnedStore.contact_phone || myOwnedStore.whatsapp || "";
            document.getElementById('edit-store-logo').value = myOwnedStore.logo_url || "";
            setTenantUploadStatus('edit-store-logo-status', myOwnedStore.logo_url ? "Logo actual cargado." : "Puedes pegar una URL o subir un logo optimizado.", "muted");
            document.getElementById('edit-store-shelf-style').value = myOwnedStore.shelf_style || "madera";
            
            // Cargar productos
            const productsResult = await loadStoreProducts(storeCode);
            if (productsResult.error) {
                alert("No pude cargar productos: " + productsResult.error.message);
            }
            if (productsResult.skipped) {
                console.warn("Falta store_products.local_code. Ejecuta supabase/store_products_local_code_fix.sql para activar inventario por local.");
            }
            const products = (productsResult.products || []).slice(0, 10);
            
            const list = document.getElementById('edit-products-list');
            list.innerHTML = "";
            for(let i=0; i<10; i++) {
                const p = (products && products[i]) ? products[i] : { name: "", price: "", image_url: "" };
                const slot = document.createElement('div');
                slot.className = "p-slot";
                slot.style.padding = "10px"; slot.style.background = "#111"; slot.style.borderRadius = "8px";
                slot.innerHTML = `
                    <input type="text" placeholder="Nombre" value="${escapeHtml(p.name || '')}" class="p-name" style="width:100%; background:#000; border:1px solid #333; color:#fff; font-size:11px; padding:5px; margin-bottom:5px;">
                    <div style="display:flex; gap:5px;">
                        <input type="text" placeholder="Precio" value="${escapeHtml(p.price || '')}" class="p-price" style="flex:1; background:#000; border:1px solid #333; color:#fff; font-size:11px; padding:5px;">
                        <input type="text" placeholder="URL Foto" value="${escapeHtml(p.image_url || '')}" class="p-image" style="flex:2; background:#000; border:1px solid #333; color:#fff; font-size:11px; padding:5px;">
                    </div>
                    <div style="display:flex; gap:8px; align-items:center; margin-top:7px;">
                        <input type="file" accept="image/*" style="display:none;" onchange="uploadTenantProductImage(this, ${i})">
                        <button type="button" onclick="this.previousElementSibling.click()" style="background:rgba(197,160,89,0.10); border:1px solid rgba(197,160,89,0.25); color:#c5a059; padding:6px 8px; border-radius:5px; cursor:pointer; font-size:9px; text-transform:uppercase;">Subir foto</button>
                        <span class="p-upload-status" style="font-size:9px; color:#666; line-height:1.2;">${p.image_url ? 'Foto actual cargada.' : 'Opcional'}</span>
                    </div>
                `;
                list.appendChild(slot);
            }
            
            // Cargar mensajes del buzón
            loadStoreMessages(storeCode);

            document.getElementById('tenant-admin-modal').style.display = 'block';
            document.getElementById('modal-overlay').style.display = 'block';
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
                list.innerHTML = `<p style="color: #ff4444; font-size: 11px; text-align: center; padding: 20px;">Error al cargar: ${error.message}</p>`;
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
                div.innerHTML = `
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <strong style="color:#c5a059; font-size:12px;">${escapeHtml(name)}</strong>
                        <span style="font-size:10px; color:#555;">${date}</span>
                    </div>
                    <div style="font-size:11px; color:#aaa; margin-bottom:8px; line-height:1.4;">${escapeHtml(content)}</div>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <span style="font-size:10px; color:#666;">${escapeHtml(email)}</span>
                        <a href="mailto:${email}?subject=Respuesta Mall - Local ${storeCode}" style="color:#c5a059; font-size:10px; text-decoration:none; border:1px solid rgba(197,160,89,0.3); padding:2px 8px; border-radius:4px;">Responder</a>
                    </div>
                `;
                list.appendChild(div);
            });
        }

        window.closeTenantAdmin = function() {
            document.getElementById('tenant-admin-modal').style.display = 'none';
            document.getElementById('modal-overlay').style.display = 'none';
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
            const newLogo = document.getElementById('edit-store-logo').value;
            const newStyle = document.getElementById('edit-store-shelf-style').value;
            
            // 1. Actualizar tienda (Asegurar owner_id si somos admins)
            let storeUpdatePayload = {
                name: newName,
                category: newCat,
                contact_email: newEmail,
                whatsapp: newPhone,
                logo_url: newLogo,
                shelf_style: newStyle
            };
            
            // Reclamar propiedad si el local no tiene dueño o somos el super-admin
            if (!myOwnedStore.owner_id && currentTenantUser) {
                storeUpdatePayload.owner_id = currentTenantUser.id;
            }

            let { data: updatedStore, error: storeUpdateError } = await updateStoreByCode(myOwnedStore, storeUpdatePayload);
            if (storeUpdateError && /schema cache|column|contact_phone|whatsapp|shelf_style|logo_url|contact_email/i.test(storeUpdateError.message || "")) {
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
            
            // Actualizar localmente
            myOwnedStore = {
                ...myOwnedStore,
                ...(updatedStore || {}),
                name: newName,
                category: newCat,
                contact_email: newEmail,
                contact_phone: newPhone,
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

            // Enviar a la nueva tabla dedicada mall_messages
            const { error } = await supabaseClient.from('mall_messages').insert([{
                sender_name: name,
                sender_email: email,
                message: msg,
                store_id: (String(targetId).includes('-') ? targetId : null),
                local_code: currentModalStoreCode,
                status: 'unread'
            }]);
            
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
            const { data: resolvedEmail, error: rpcError } = await supabaseClient.rpc('resolve_member_login_email', {
                login_identifier: clean
            });
            if (!rpcError && resolvedEmail) return resolvedEmail;
            const { data, error } = await supabaseClient
                .from('mall_members')
                .select('email')
                .ilike('nickname', clean)
                .maybeSingle();
            if (error) {
                console.warn("No se pudo resolver nick de inscrito:", error);
                return clean;
            }
            return data?.email || clean;
        }

        window.memberLogin = async function(identifierOverride = null, passwordOverride = null) {
            if (!supabaseClient) return setMemberStatus("No hay conexión con Supabase.", true);
            const identifier = (identifierOverride || document.getElementById('member-login-email').value).trim();
            const password = passwordOverride || document.getElementById('member-login-pass').value;
            if (!identifier || !password) return setMemberStatus("Ingresa correo/nick y contraseña.", true);

            const email = await resolveMemberEmail(identifier);
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
                if (!nick) return alert("Para entrar con contraseña, ingresa tu nick o correo.");
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
            let label = to === "Todos" ? `<strong style="color: #c5a059;">${user}</strong>` : `<strong style="color: #6dbcdb;">[Privado] ${user}</strong>`;
            p.innerHTML = `${label}: ${text.replace(/</g, "&lt;")}`;
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
            const isFeminine = styleCode === "3";

            let skinColor = 0xffdbac;
            let clothColor = 0x333333;
            let accentColor = 0x555555;
            let hairColor = 0x221100;

            const skinTones = [0xffdbac, 0xf1c27d, 0xe0ac69, 0x8d5524];
            skinColor = skinTones[Math.abs(nickname.split("").reduce((a, b) => a + b.charCodeAt(0), 0)) % skinTones.length];

            if (styleCode === "1") {
                clothColor = 0x1a1a1a;
                accentColor = 0xc5a059;
                hairColor = 0x111111;
            } else if (styleCode === "2") {
                clothColor = 0x0066cc;
                accentColor = 0xf2f2f2;
                hairColor = 0x442211;
            } else if (styleCode === "3") {
                clothColor = 0xaa4455;
                accentColor = 0x2f3136;
                hairColor = 0x221100;
            }

            const clothColorObj = new THREE.Color(clothColor);
            const layeredClothColor = clothColorObj.clone().offsetHSL(0, 0, -0.12);
            const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.56, metalness: 0.02 });
            const clothMat = new THREE.MeshStandardMaterial({ color: clothColor, roughness: 0.68, metalness: 0.04 });
            const layerMat = new THREE.MeshStandardMaterial({ color: layeredClothColor, roughness: 0.76, metalness: 0.03 });
            const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.48, metalness: styleCode === "1" ? 0.24 : 0.08 });
            const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.78, metalness: 0.03 });
            const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.45 });
            const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
            const soleMat = new THREE.MeshStandardMaterial({ color: 0xe6e1d6, roughness: 0.55 });
            const shoeGeom = new THREE.BoxGeometry(0.16, 0.08, 0.29);
            shoeGeom.translate(0, 0, 0.01);
            const toeGeom = new THREE.SphereGeometry(0.07, 12, 10);
            const shoulderSpan = isFeminine ? 0.235 : 0.26;
            const armRootX = isFeminine ? 0.265 : 0.3;
            const armRootY = isFeminine ? 1.38 : 1.4;
            const legRootX = isFeminine ? 0.125 : 0.115;
            const shoulderBaseY = isFeminine ? 1.41 : 1.43;
            const torsoBaseY = isFeminine ? 1.16 : 1.18;
            const waistBaseY = isFeminine ? 0.89 : 0.9;
            const neckBaseY = isFeminine ? 1.53 : 1.54;
            const headBaseY = isFeminine ? 1.71 : 1.74;

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

            if (styleCode === "1") {
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
            } else if (styleCode === "2") {
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
            if (styleCode === "1") hairGeom = new THREE.SphereGeometry(0.208, 16, 14, 0, Math.PI * 2, 0, Math.PI / 1.86);
            else if (styleCode === "2") hairGeom = new THREE.BoxGeometry(0.24, 0.095, 0.34);
            else hairGeom = new THREE.SphereGeometry(0.212, 16, 14, 0, Math.PI * 2, 0, Math.PI / 1.6);

            const hair = addTagged(headPivot, new THREE.Mesh(hairGeom, hairMat), "hair");
            hair.position.set(0, isFeminine ? 0.07 : 0.085, styleCode === "2" ? 0.02 : 0);

            const backHair = addTagged(headPivot, new THREE.Mesh(new THREE.BoxGeometry(isFeminine ? 0.22 : 0.24, isFeminine ? 0.26 : 0.16, isFeminine ? 0.16 : 0.14), hairMat), "backHair");
            backHair.position.set(0, isFeminine ? -0.01 : 0.02, isFeminine ? -0.1 : -0.11);
            backHair.scale.set(styleCode === "2" ? 0.8 : 1, styleCode === "3" ? 1.25 : 0.92, 1);
            if (styleCode === "2") backHair.visible = false;

            const sideHairL = addTagged(headPivot, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.13), hairMat), "sideHairL");
            sideHairL.position.set(-0.145, 0.025, 0.02);
            const sideHairR = addTagged(headPivot, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.13), hairMat), "sideHairR");
            sideHairR.position.set(0.145, 0.025, 0.02);
            if (styleCode === "2") {
                sideHairL.visible = false;
                sideHairR.visible = false;
            }

            if (styleCode === "2") {
                const visor = addTagged(headPivot, new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.1), hairMat), "visor");
                visor.position.set(0, 0.03, 0.2);
            } else if (styleCode === "3") {
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

            const legL = createLimb(isFeminine ? 0.078 : 0.085, isFeminine ? 0.048 : 0.055, 0.86, styleCode === "1" ? blackMat : layerMat, "legL");
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

            const legR = createLimb(isFeminine ? 0.078 : 0.085, isFeminine ? 0.048 : 0.055, 0.86, styleCode === "1" ? blackMat : layerMat, "legR");
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
                    p.mesh.visible = distToCam > AVATAR_CAMERA_HIDE_DISTANCE;
                    if (updateLabels) updateAvatarLabelPosition(p, 2.15);
                }
            });
        }

        // --- VARIABLES GLOBALES DE PUBLICIDAD ---
        let lastAdUpdate = Date.now();
        let adIndex = 0;

        let lastLabelUpdateAt = 0;
        const LABEL_UPDATE_INTERVAL_MS = 1000 / 24;
        const FAR_NPC_SIM_DISTANCE = IS_COARSE_POINTER ? 46 : 58;
        const FAR_NPC_SKIP_FRAMES = IS_COARSE_POINTER ? 3 : 2;
        let frameTick = 0;
        let lastAdminSave = 0;
        let lastSupabaseSave = 0;
        let isAdminSaving = false;
        async function saveAdminPosition() {
            return; // Función desactivada a petición del usuario
            if (!isAdmin || isAdminSaving) return;
            const now = Date.now();
            if (now - lastAdminSave < 2000) return;
            
            // No guardar si estamos en el origen (posible carga inicial o error)
            if (Math.abs(camera.position.x) < 2 && Math.abs(camera.position.z) < 2) return;
            
            lastAdminSave = now;
            const state = {
                px: camera.position.x, py: camera.position.y, pz: camera.position.z,
                tx: controls.target.x, ty: controls.target.y, tz: controls.target.z
            };
            localStorage.setItem('mall_admin_last_pos', JSON.stringify(state));

            // Sincronizar con Supabase cada 10 segundos
            if (supabaseClient && currentUserProfile?.auth_user_id && (now - lastSupabaseSave > 10000)) {
                isAdminSaving = true;
                lastSupabaseSave = now;
                try {
                    await supabaseClient.from('user_profiles').update({ last_pos: state }).eq('auth_user_id', currentUserProfile.auth_user_id);
                } catch(e) {}
                isAdminSaving = false;
            }
        }

        window.addEventListener('beforeunload', () => {
            /* Desactivado
            if (isAdmin) {
                const state = {
                    px: camera.position.x, py: camera.position.y, pz: camera.position.z,
                    tx: controls.target.x, ty: controls.target.y, tz: controls.target.z
                };
                if (Math.abs(state.px) > 0.5 || Math.abs(state.pz) > 0.5) {
                    localStorage.setItem('mall_admin_last_pos', JSON.stringify(state));
                }
            }
            */
        });

        const frameStepErrors = {};
        function runFrameStep(name, fn) {
            try {
                return fn();
            } catch (error) {
                const now = Date.now();
                const lastWarn = frameStepErrors[name] || 0;
                if (now - lastWarn > 2500) {
                    console.warn("Error en ciclo de movimiento/render:", name, error);
                    frameStepErrors[name] = now;
                }
                return null;
            }
        }

        function resetMovementInputState() {
            Object.keys(keys).forEach((key) => { keys[key] = false; });
            joystickActive = false;
            joystickDir = { x: 0, y: 0 };
            isBtnLookUp = false;
            isBtnLookDown = false;
            if (joyKnob) joyKnob.style.transform = `translate(-50%, -50%)`;
        }

        window.addEventListener('visibilitychange', () => {
            if (document.hidden) resetMovementInputState();
        });
        window.addEventListener('focus', () => {
            if (shouldForceWalkMode()) focusMallCanvas();
        });

        function animate() {
            requestAnimationFrame(animate);

            const nowMs = performance.now();
            frameTick = (frameTick + 1) % 100000;
            const currentTime = Date.now();
            if (currentTime - lastAdUpdate > 5000 && Array.isArray(adTextures) && adTextures.length) {
                adIndex = (adIndex + 1) % adTextures.length;
                runFrameStep('ads', () => screenMeshes.forEach(s => {
                    if (s?.material) s.material.map = adTextures[adIndex];
                }));
                lastAdUpdate = currentTime;
            }
            const shouldUpdateLabels = nowMs - lastLabelUpdateAt >= LABEL_UPDATE_INTERVAL_MS;
            if (shouldUpdateLabels) lastLabelUpdateAt = nowMs;
            runFrameStep('adaptive-fog', updateAdaptiveFogProfile);

            runFrameStep('keyboard-navigation', updateKeyboardNavigation);
            runFrameStep('boutique-streaming', updateBoutiqueInteriorStreaming);
            runFrameStep('anchor-streaming', updateAnchorInteriorStreaming);
            runFrameStep('other-players', () => updateOtherPlayers(nowMs, shouldUpdateLabels));
            runFrameStep('npcs', () => updateNPCs(nowMs, shouldUpdateLabels, frameTick));
            runFrameStep('boutique-doors', updateBoutiqueSlidingDoors);
            runFrameStep('corridor-doors', updateCorridorAccessDoors);
            runFrameStep('axis-reference', updateAxisReference);
            runFrameStep('gps-display', updateGPSDisplay);

            runFrameStep('controls-update', () => controls.update());
            runFrameStep('save-admin-position', saveAdminPosition);
            runFrameStep('render', () => renderer.render(scene, camera));
        }

        // --- SISTEMA DE NPCs (MULTITUD ARTIFICIAL CHILENA) ---
        const CHILEAN_NAMES = [
            "Mateo González", "Agustín Muñoz", "Benjamín Rojas", "Vicente Díaz", "Santiago Pérez",
            "Matías Soto", "Joaquín Contreras", "Maximiliano Silva", "Nicolás Martínez", "Sebastián Sepúlveda",
            "Sofía Morales", "Isabella Rodríguez", "Emilia López", "Martina Fuentes", "Lucía Hernández",
            "Francisca Olave", "Catalina Tapia", "Valentina Carrasco", "Florencia Vera", "Isidora Castro",
            "Lucas Herrera", "Felipe Medina", "Diego Castro", "Javier Muñoz", "Gabriel Palma",
            "Paz Romero", "Antonella Silva", "Maite Araya", "Josefa Reyes", "Ignacia Pizarro",
            "Daniela Soto", "Carolina Rojas", "Andrés Martínez", "Cristóbal Valenzuela", "Camila Bravo",
            "Rodrigo Espinoza", "Bastián Tapia", "Javiera Torres", "Renato Vera", "Micaela Lagos",
            "Tomás Castro", "Bárbara Peña", "Emanuel Vargas", "Julieta Miranda", "Pascal Cáceres"
        ];

        const npcs = [];
        const NPC_COUNT = IS_COARSE_POINTER ? 30 : 40; 

        function getValidNPCPosition(y) {
            const isPB = y < 3;
            if (isPB) {
                if (Math.random() > 0.5) {
                    return { x: (Math.random() - 0.5) * 18, z: (Math.random() - 0.5) * 180, y: 0 };
                } else {
                    return { x: (Math.random() - 0.5) * 180, z: (Math.random() - 0.5) * 18, y: 0 };
                }
            } else {
                const side = Math.floor(Math.random() * 4);
                if (side === 0) return { x: 14 + (Math.random() - 0.5) * 4, z: (Math.random() - 0.5) * 180, y: 5.4 };
                if (side === 1) return { x: -14 + (Math.random() - 0.5) * 4, z: (Math.random() - 0.5) * 180, y: 5.4 };
                if (side === 2) return { x: (Math.random() - 0.5) * 180, z: 14 + (Math.random() - 0.5) * 4, y: 5.4 };
                if (side === 3) return { x: (Math.random() - 0.5) * 180, z: -14 + (Math.random() - 0.5) * 4, y: 5.4 };
            }
        }

        function initNPCs() {
            for (let i = 0; i < NPC_COUNT; i++) {
                const name = CHILEAN_NAMES[i % CHILEAN_NAMES.length];
                const style = ["1", "2", "3"][Math.floor(Math.random() * 3)];
                const npcAvatar = createAvatar(name, style);
                
                const startFloor = Math.random() > 0.5 ? 5.4 : 0;
                const pos = getValidNPCPosition(startFloor);
                npcAvatar.mesh.position.set(pos.x, getAvatarGroundY(pos.y), pos.z);
                
                npcs.push({
                    mesh: npcAvatar.mesh,
                    label: npcAvatar.label,
                    rig: npcAvatar.rig,
                    target: new THREE.Vector3(pos.x, getAvatarGroundY(pos.y), pos.z),
                    intermediateTarget: null,
                    state: 'walking',
                    timer: 0,
                    speed: 0.012 + Math.random() * 0.015,
                    name: name,
                    motionPhase: npcAvatar.motionPhase,
                    idlePhase: npcAvatar.idlePhase
                });
                npcAvatar.label.style.background = "rgba(0,0,0,0.4)";
                npcAvatar.label.style.borderColor = "rgba(197, 160, 89, 0.3)";
                npcAvatar.label.style.color = "#aaa";
                npcAvatar.label.style.fontSize = "8px";
                npcAvatar.label.style.padding = "2px 6px";
            }
        }

        function updateNPCs(nowMs = performance.now(), updateLabels = true, frameIndex = 0) {
            const now = Date.now();
            npcs.forEach((npc, npcIndex) => {
                const prevPos = npc.mesh.position.clone();
                const npcDistToCam = camera.position.distanceTo(npc.mesh.position);
                const isFarNpc = npcDistToCam > FAR_NPC_SIM_DISTANCE;
                if (isFarNpc && ((frameIndex + npcIndex) % FAR_NPC_SKIP_FRAMES !== 0)) {
                    npc.mesh.visible = npcDistToCam > AVATAR_CAMERA_HIDE_DISTANCE;
                    if (updateLabels) updateAvatarLabelPosition(npc, 2.2, AVATAR_LABEL_NPC_FAR_DISTANCE);
                    return;
                }
                let onEscalator = false;
                const activeEscalator = findActiveEscalator(
                    npc.mesh.position.x,
                    npc.mesh.position.y,
                    npc.mesh.position.z,
                    AVATAR_FLOOR_OFFSET
                );
                if (activeEscalator) {
                    onEscalator = true;
                    const ride = advanceAlongEscalator(
                        npc.mesh.position,
                        activeEscalator.escalator,
                        activeEscalator.progress,
                        Math.max(0.05, npc.speed * 4.5),
                        AVATAR_FLOOR_OFFSET,
                        0.45,
                        true
                    );
                    npc.mesh.rotation.y = activeEscalator.escalator.travelDir > 0 ? Math.PI : 0;
                    npc.intermediateTarget = null;
                    if (ride.done) {
                        if (ride.landing) {
                            npc.mesh.rotation.y = ride.landing.exitAxis === 'x'
                                ? (ride.landing.exitDir > 0 ? -Math.PI / 2 : Math.PI / 2)
                                : (ride.landing.exitDir > 0 ? Math.PI : 0);
                        }
                        onEscalator = false;
                    }
                }

                if (!onEscalator && npc.state === 'walking') {
                    const needsFloorChange = Math.abs(npc.target.y - npc.mesh.position.y) > 1;
                    let currentMoveTarget = npc.target;

                    if (needsFloorChange) {
                        if (!npc.intermediateTarget) {
                            const isGoingUp = npc.target.y > npc.mesh.position.y;
                            let bestEsc = null;
                            let minDist = Infinity;
                            escalatorList.forEach(e => {
                                if (e.up === isGoingUp) {
                                    const entryPos = getEscalatorRidePosition(e, 0, AVATAR_FLOOR_OFFSET);
                                    const d = npc.mesh.position.distanceTo(entryPos);
                                    if (d < minDist) {
                                        minDist = d;
                                        bestEsc = entryPos;
                                    }
                                }
                            });
                            if (bestEsc) npc.intermediateTarget = bestEsc.clone();
                        }
                        if (npc.intermediateTarget) currentMoveTarget = npc.intermediateTarget;
                    }

                    const dist = npc.mesh.position.distanceTo(currentMoveTarget);
                    if (dist < 0.8) {
                        if (!needsFloorChange) {
                            npc.state = 'looking';
                            npc.timer = now + (4000 + Math.random() * 8000);
                        }
                    } else {
                        const dir = currentMoveTarget.clone().sub(npc.mesh.position);
                        dir.y = 0; dir.normalize();
                        
                        // --- MOVIMIENTO CON COLISIONES ---
                        const nextX = npc.mesh.position.x + dir.x * npc.speed;
                        const nextZ = npc.mesh.position.z + dir.z * npc.speed;
                        const bodyY = npc.mesh.position.y + 1.2; // Altura de colisión

                        if (!checkCollision(nextX, bodyY, nextZ)) {
                            npc.mesh.position.x = nextX;
                            npc.mesh.position.z = nextZ;
                        } else {
                            // Si choca con algo (pared, barandilla, objeto), recalcular ruta
                            npc.state = 'looking';
                            npc.timer = now;
                        }
                        
                        const targetRot = Math.atan2(dir.x, dir.z);
                        let diff = targetRot - npc.mesh.rotation.y;
                        while(diff < -Math.PI) diff += Math.PI * 2;
                        while(diff > Math.PI) diff -= Math.PI * 2;
                        npc.mesh.rotation.y += diff * 0.12;
                    }
                } else if (!onEscalator && npc.state === 'looking') {
                    if (now > npc.timer) {
                        npc.state = 'walking';
                        npc.intermediateTarget = null;
                        const changeFloor = Math.random() > 0.85;
                        const nextY = changeFloor ? (npc.mesh.position.y > 3 ? 0 : 5.4) : npc.mesh.position.y;
                        const pos = getValidNPCPosition(nextY);
                        npc.target.set(pos.x, getAvatarGroundY(pos.y), pos.z);
                    }
                }

                const movedAmount = prevPos.distanceTo(npc.mesh.position);
                applyAvatarPose(npc, movedAmount, nowMs);
                npc.mesh.visible = npcDistToCam > AVATAR_CAMERA_HIDE_DISTANCE;

                // --- 3. ACTUALIZAR ETIQUETAS ---
                if (updateLabels) updateAvatarLabelPosition(npc, 2.2, AVATAR_LABEL_NPC_FAR_DISTANCE);

                // --- 4. SEGURIDAD: GRAVEDAD Y SUELO ---
                if (!onEscalator) {
                    // Guardia anti-NaN: si la Y se corrompe, resetear al suelo
                    if (isNaN(npc.mesh.position.y)) {
                        npc.mesh.position.y = getAvatarGroundY(0);
                    }
                    const inAtrium = Math.abs(npc.mesh.position.x) < 11 && Math.abs(npc.mesh.position.z) < 11;
                    const isPA = npc.mesh.position.y > 2.7;
                    const groundY = isPA ? getAvatarGroundY(5.4) : getAvatarGroundY(0);
                    
                    if (isPA && inAtrium) {
                        npc.mesh.position.y -= 0.2; // Caída libre si logran saltar la barandilla o aparecen en el aire
                        if (npc.mesh.position.y < getAvatarGroundY(0)) npc.mesh.position.y = getAvatarGroundY(0);
                    } else {
                        // Snap suave al suelo para evitar que floten por errores de precisión decimal
                        npc.mesh.position.y = THREE.MathUtils.lerp(npc.mesh.position.y, groundY, 0.1);
                    }
                }
            });
        }

        initNPCs();

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
                    const byId = await supabaseClient.from('stores').select('*').eq('id', code).maybeSingle();
                    dbStore = byId.data || null;
                }
                if (!dbStore && code) {
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

        async function openPublicStoreCatalog(storeRef) {
            try {
                const shopCode = typeof storeRef === 'string' ? storeRef : storeRef?.userData?.shopCode;
                if (!shopCode) return;
                
                // Mostrar el modal inmediatamente con datos preliminares si es posible
                const data = await getStoreData(shopCode);
                if (storeRef?.userData?.isAnchor) data.name = storeRef.userData.name;
                
                openModal(data);
                
                // Cargar visuales en segundo plano para no bloquear la apertura
                hydrateStoreVisualsFromCatalogData(data).catch(e => console.warn("Error hidratando visuales:", e));
            } catch (err) {
                console.error("Error abriendo catálogo:", err);
                showInteractionFeedback("Error al abrir catálogo");
            }
        }
        window.openPublicStoreCatalog = openPublicStoreCatalog;

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
            products.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${escapeHtml(p.n || 'Producto')}</td><td class="price">${escapeHtml(p.p || '-')}</td>`;
                tbody.appendChild(tr);
            });
            const productsWithImages = products.filter(p => p && p.image_url);
            if (gallery) {
                if (productsWithImages.length) {
                    gallery.style.display = 'grid';
                    productsWithImages.forEach(p => {
                        const card = document.createElement('div');
                        card.className = 'store-gallery-card';
                        card.innerHTML = `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.n || 'Producto')}"><div class="store-gallery-meta"><div class="store-gallery-name">${escapeHtml(p.n || 'Producto')}</div><div class="store-gallery-price">${escapeHtml(p.p || 'Consultar')}</div></div>`;
                        gallery.appendChild(card);
                    });
                } else {
                    gallery.style.display = 'none';
                }
            }
            if (logoBox && logoImg) {
                if (data.logo_url) {
                    logoImg.src = data.logo_url;
                    logoImg.alt = `Logo de ${data.name}`;
                    logoBox.style.display = 'flex';
                } else {
                    logoImg.removeAttribute('src');
                    logoBox.style.display = 'none';
                }
            }
            if (summary) {
                const realProductsCount = products.filter(p => p.n !== "Consultar catálogo").length;
                summary.innerText = realProductsCount > 0 ? `Contenido público visible para visitantes: ${realProductsCount} producto(s), precios${productsWithImages.length ? ', imágenes' : ''}${data.logo_url ? ', logo' : ''}.` : 'Este local aún no tiene productos públicos cargados.';
            }
            if (links) {
                links.innerText = data.contactEmail || data.contactPhone ? 'Puedes consultar o cotizar directamente desde esta ficha comercial.' : 'Cuando el locatario publique contacto directo, aparecerá aquí.';
            }
            const manageBtn = document.getElementById('btn-manage-store');
            if (myOwnedStores.some(s => getStoreCode(s) === data.shopCode)) manageBtn.style.display = 'block';
            else manageBtn.style.display = 'none';
            const mailtoBtn = document.getElementById('store-mailto-btn');
            if (data.contactEmail) {
                mailtoBtn.href = `mailto:${data.contactEmail}?subject=Consulta Mall - Local ${data.shopCode}`;
                mailtoBtn.style.display = 'block';
            } else {
                mailtoBtn.style.display = 'none';
            }
            const whatsappBtn = document.getElementById('store-whatsapp-btn');
            const phone = normalizePhone(data.contactPhone || "");
            if (phone) {
                whatsappBtn.href = `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent('Hola, vengo desde el Mall y quiero consultar por el local ' + data.shopCode + '.')}`;
                whatsappBtn.style.display = 'block';
            } else {
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

        async function loadStoreVisualsOnDemand(shRef) {
            if (!shRef || shRef.userData.isLoadingVisuals || shRef.userData.storeVisualPayload) return;
            const code = shRef.userData.shopCode;
            if (!code || !supabaseClient) return;

            shRef.userData.isLoadingVisuals = true;
            try {
                let storeData = null;

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

                if (storeData) {
                    const resolvedCode = getStoreCode(storeData) || code;
                    let productsResult = await loadStoreProducts(resolvedCode);
                    if ((!productsResult.products || !productsResult.products.length) && storeData.id && storeData.id !== resolvedCode) {
                        productsResult = await loadStoreProducts(storeData.id);
                    }
                    await updateStoreVisuals(resolvedCode, storeData, productsResult.products || []);
                }
            } catch (e) {
                console.warn("Error en carga on-demand para " + code, e);
            } finally {
                shRef.userData.isLoadingVisuals = false;
            }
        }

        async function hydrateStoreVisualsFromCatalogData(data) {
            if (!data?.shopCode || !storeGroups[data.shopCode]) return;
            const products = (Array.isArray(data.products) ? data.products : [])
                .filter(product => product && product.image_url)
                .map(product => ({
                    name: product.n || product.name || "Producto",
                    price: product.p || product.price || "",
                    image_url: product.image_url || ""
                }));
            await updateStoreVisuals(data.shopCode, {
                id: data.storeId || data.shopCode,
                name: data.name,
                category: data.category,
                contact_email: data.contactEmail || "",
                contact_phone: data.contactPhone || "",
                logo_url: data.logo_url || "",
                shelf_style: data.shelf_style || "madera"
            }, products);
        }

        async function preloadStoreContent(code) {
            if (!code || !supabaseClient || !storeGroups[code]) return;
            try {
                const data = await getStoreData(code);
                await hydrateStoreVisualsFromCatalogData(data);
                storeGroups[code].userData.catalogPreloaded = true;
            } catch (error) {
                console.warn("No pude precargar contenido del local " + code, error);
            }
        }

        preloadStoreContent('O101');

        setTimeout(() => { if (document.getElementById('loader')) document.getElementById('loader').remove(); }, 1500);
    