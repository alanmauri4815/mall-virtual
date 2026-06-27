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

        function getVaultInnerSign(wingLabel) {
            if (wingLabel === 'E') return 1;
            if (wingLabel === 'O') return -1;
            if (wingLabel === 'N') return -1;
            return 1; // S
        }

        function getVaultRibOffset(wingLabel) {
            return (wingLabel === 'N' || wingLabel === 'E') ? 2 : 0;
        }

        function getVaultInnerEdgeForLevel(anglePos, r, innerSign) {
            const angle = (anglePos / r) * (Math.PI / 2);
            const xOut = Math.sin(angle) * r;
            const yOut = Math.cos(angle) * r;
            const familyLevel = Math.abs(anglePos);
            const ringTarget = DOME_RING_TARGETS.find(t => t.level === Math.round(familyLevel)) || DOME_RING_TARGETS[0];
            const innerY = ringTarget.height - DOME_CENTER_Y;
            const innerAxisAbs = Math.sqrt(Math.max((CENTRAL_DOME_RADIUS ** 2) - (xOut ** 2) - (innerY ** 2), 0));
            const innerZ = innerSign * (VAULT_CENTER_OFFSET - innerAxisAbs);
            return { xOut, yOut, innerY, innerZ };
        }

        function addArchitecturalShell(group, r, l, wingLabel) {
            const innerSign = getVaultInnerSign(wingLabel);
            const ribOffset = getVaultRibOffset(wingLabel);
            const outerZ = -innerSign * (l / 2) + ribOffset;

            const segments = 16;
            const geometry = new THREE.BufferGeometry();
            const vertices = [];
            const indices = [];

            // Generar vértices para el arco exterior (Z = outerZ, radio = 17) y el arco interior (conexión con domo)
            for (let i = 0; i <= segments; i++) {
                const anglePos = -16 + (32 * i / segments); // De -16 a 16 (niveles de fierros)
                const { xOut, yOut, innerY, innerZ } = getVaultInnerEdgeForLevel(anglePos, r, innerSign);
                vertices.push(xOut, yOut, outerZ);

                // Punto Interior (Cierre con anillos del domo)
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

            const mesh = new THREE.Mesh(geometry, roofGlassMat);
            mesh.side = THREE.DoubleSide;
            group.add(mesh);
            roofGlassMeshes.push(mesh);
        }

        function addVaultShell(group, r, l) {
            const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 32, 1, true, 0, Math.PI), roofGlassMat);
            m.rotation.x = Math.PI / 2; m.rotation.z = -Math.PI / 2; group.add(m);
            roofGlassMeshes.push(m);
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
            const innerSign = getVaultInnerSign(wingLabel);
            const ribOffset = getVaultRibOffset(wingLabel);
            const zStart = -innerSign * (l / 2) + ribOffset;
            LONGITUDINAL_BEAM_LEVELS.forEach((anglePos) => {
                const { xOut, yOut, innerZ } = getVaultInnerEdgeForLevel(anglePos, r, innerSign);
                const beamCenterZ = (zStart + innerZ) / 2;
                const beamLen = Math.abs(innerZ - zStart) + 0.08;
                const beam = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, beamLen), darkMat);
                beam.position.set(xOut, yOut, beamCenterZ);
                group.add(beam);
            });
        }
        function addLowerLateralBracing(group, r, l, wingLabel) {
            const zOffset = (wingLabel === 'E' || wingLabel === 'S') ? 2 : 0;
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
            const innerSign = getVaultInnerSign(wingLabel);
            const ribOffset = getVaultRibOffset(wingLabel);
            const zStart = -innerSign * (l / 2) + ribOffset;
            capG.position.set(0, 0, zStart);
            const convergeZ = -innerSign * 4.5;
            const convergeY = 16.5 - DOME_CENTER_Y; // Elevado para que quede sobre el techo de las tiendas (15m)
            const targetPoint = new THREE.Vector3(0, convergeY, convergeZ);
            const beamLevels = [-16, -13, -10, -7, -4, 0, 4, 7, 10, 13, 16];
            
            // Crear curvas (meridianos)
            const curves = [];
            beamLevels.forEach(anglePos => {
                const angle = (anglePos / r) * (Math.PI / 2);
                const xLocal = Math.sin(angle) * r;
                const yLocal = Math.cos(angle) * r;
                const startPoint = new THREE.Vector3(xLocal, yLocal, 0);
                const controlPoint = new THREE.Vector3(xLocal, yLocal, convergeZ);
                const curve = new THREE.QuadraticBezierCurve3(startPoint, controlPoint, targetPoint);
                curves.push(curve);
            });

            // Dibujar vigas de meridianos (longitudinales curvos) usando TubeGeometry
            curves.forEach(curve => {
                const tubeGeom = new THREE.TubeGeometry(curve, 30, 0.05, 8, false);
                const tubeMesh = new THREE.Mesh(tubeGeom, darkMat);
                capG.add(tubeMesh);
            });

            // Dibujar vigas de paralelos (enrejado transversal curvo de 4 niveles)
            const tLevels = [0.2, 0.4, 0.6, 0.8];
            tLevels.forEach(t => {
                for (let i = 0; i < curves.length - 1; i++) {
                    const p1 = curves[i].getPointAt(t);
                    const p2 = curves[i+1].getPointAt(t);
                    const dist = p1.distanceTo(p2);
                    const parallelSeg = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, dist), darkMat);
                    parallelSeg.position.copy(p1).add(p2).multiplyScalar(0.5);
                    parallelSeg.lookAt(p2);
                    capG.add(parallelSeg);
                }
            });

            group.add(capG);
        }

        function createVaultedRoof(x, z, length, wingLabel, rot = false, capPos = 1, capX = 0, capY = 0, capZ = 0, showCap = true) {
            const vaultG = new THREE.Group(); vaultG.position.set(x, DOME_CENTER_Y, z);
            if (rot) vaultG.rotation.y = Math.PI / 2;
            // Simetría estricta: Sur reutiliza la geometría de Norte, Oeste reutiliza la de Este.
            const symmetricRoofSource = wingLabel === 'S' ? 'N' : (wingLabel === 'O' ? 'E' : wingLabel);
            addArchitecturalShell(vaultG, VAULT_RADIUS, length, symmetricRoofSource);
            addTransverseRibs(vaultG, VAULT_RADIUS, length, symmetricRoofSource);
            addLowerLateralBracing(vaultG, VAULT_RADIUS, length, symmetricRoofSource);
            addLongitudinalGirders(vaultG, VAULT_RADIUS, length, symmetricRoofSource);
            // La tapa final debe respetar el ala real para no generar paños sobrantes.
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
        const BOUTIQUE_FACADE_PRELOAD_DISTANCE = IS_COARSE_POINTER ? 22 : 28;
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
            const facadeStoneMat = new THREE.MeshStandardMaterial({ color: 0xd8d0c4, roughness: 0.34, metalness: 0.04 });
            const facadeMetalMat = new THREE.MeshStandardMaterial({ color: 0x2c2b2a, roughness: 0.24, metalness: 0.76 });
            const facadeChampagneMat = new THREE.MeshStandardMaterial({ color: 0xb8945b, roughness: 0.18, metalness: 0.9 });
            const facadeGlassMat = new THREE.MeshPhysicalMaterial({ color: 0xeaf4ff, transmission: 0.6, transparent: true, opacity: 0.34, metalness: 0.1, roughness: 0.06 });
            const createFacadePlane = (w, h, x, y, z, texture, opacity = 1) => {
                const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, opacity });
                const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
                plane.position.set(x, y, z);
                g.add(plane);
                return plane;
            };
            const addFacadeLantern = (x, wallZ, outwardDir, bottomY, lanternHeight = 5.8) => {
                const lanternDepth = 1.15;
                const centerZ = wallZ + outwardDir * 0.72;
                m(2.1, lanternHeight + 0.4, lanternDepth + 0.18, x, bottomY + lanternHeight / 2, centerZ, facadeMetalMat);
                m(1.72, lanternHeight, lanternDepth, x, bottomY + lanternHeight / 2, centerZ, facadeGlassMat);
                m(1.92, 0.12, lanternDepth + 0.1, x, bottomY + lanternHeight + 0.14, centerZ, facadeChampagneMat);
                m(1.92, 0.1, lanternDepth + 0.06, x, bottomY + 0.05, centerZ, facadeChampagneMat);
                m(0.08, lanternHeight, lanternDepth + 0.04, x - 0.86, bottomY + lanternHeight / 2, centerZ, facadeChampagneMat);
                m(0.08, lanternHeight, lanternDepth + 0.04, x + 0.86, bottomY + lanternHeight / 2, centerZ, facadeChampagneMat);
            };
            const addFacadeDisplayBay = (centerX, wallZ, outwardDir, bayWidth = 9.6, bayHeight = 7.0) => {
                const centerZ = wallZ + outwardDir * 0.32;
                m(bayWidth + 0.5, bayHeight + 0.4, 0.26, centerX, bayHeight / 2 + 0.2, centerZ, facadeMetalMat);
                m(bayWidth, bayHeight, 0.08, centerX, bayHeight / 2 + 0.2, centerZ + outwardDir * 0.07, facadeGlassMat);
                m(bayWidth, 0.12, 0.22, centerX, bayHeight + 0.42, centerZ, facadeChampagneMat);
                m(bayWidth, 0.08, 0.18, centerX, 0.12, centerZ, facadeChampagneMat);
            };
            const addFacadeVerticalFin = (centerX, wallZ, outwardDir, finHeight = 11.6) => {
                const centerZ = wallZ + outwardDir * 0.62;
                m(0.34, finHeight, 1.62, centerX, finHeight / 2, centerZ, facadeMetalMat);
                m(0.08, finHeight - 0.5, 1.74, centerX, finHeight / 2 + 0.08, centerZ + outwardDir * 0.1, facadeChampagneMat);
            };
            const addAnchorFacadeIdentity = (wallZ, outwardDir, labelText, variant = 'atrium') => {
                const isBoulevard = variant === 'boulevard';
                const panelWidth = isBoulevard ? 23 : 19;
                const signCenterY = isBoulevard ? height - 2.2 : height - 2.0;
                const panelZ = wallZ + outwardDir * (isBoulevard ? 0.58 : 0.4);
                const marqueeDepth = isBoulevard ? 0.52 : 0.4;
                const finBase = anchorEntryWidth / 2 + (isBoulevard ? 4.5 : 3.8);

                m(width - 8, 1.35, 0.62, 0, 0.68, wallZ + outwardDir * 0.24, facadeStoneMat);
                m(width - 10, 0.14, 0.18, 0, 1.36, wallZ + outwardDir * 0.56, facadeChampagneMat);

                addFacadeDisplayBay(-18.5, wallZ, outwardDir, 10.2, isBoulevard ? 7.4 : 6.8);
                addFacadeDisplayBay(18.5, wallZ, outwardDir, 10.2, isBoulevard ? 7.4 : 6.8);
                addFacadeLantern(-11.6, wallZ, outwardDir, 0.28, isBoulevard ? 6.2 : 5.6);
                addFacadeLantern(11.6, wallZ, outwardDir, 0.28, isBoulevard ? 6.2 : 5.6);

                [-1, 1].forEach((side) => {
                    [0, 0.62, 1.24].forEach((offset) => addFacadeVerticalFin(side * (finBase + offset), wallZ, outwardDir, isBoulevard ? 12.0 : 10.6));
                });

                m(panelWidth, 2.45, marqueeDepth, 0, signCenterY, panelZ, facadeMetalMat);
                m(panelWidth + 0.48, 0.14, marqueeDepth + 0.1, 0, signCenterY + 1.27, panelZ, facadeChampagneMat);
                m(panelWidth + 0.48, 0.12, marqueeDepth + 0.1, 0, signCenterY - 1.27, panelZ, facadeChampagneMat);
                m(0.14, 2.55, marqueeDepth + 0.1, -(panelWidth / 2 + 0.16), signCenterY, panelZ, facadeChampagneMat);
                m(0.14, 2.55, marqueeDepth + 0.1, panelWidth / 2 + 0.16, signCenterY, panelZ, facadeChampagneMat);

                const marqueeGlow = new THREE.Mesh(
                    new THREE.PlaneGeometry(panelWidth - 0.9, 1.8),
                    new THREE.MeshBasicMaterial({ color: 0xf4ddb1, transparent: true, opacity: 0.13, depthWrite: false })
                );
                marqueeGlow.position.set(0, signCenterY, panelZ + outwardDir * 0.19);
                g.add(marqueeGlow);

                createFacadePlane(panelWidth - 1.8, 1.42, 0, signCenterY + 0.04, panelZ + outwardDir * 0.22, createSignTexture(labelText), 1);
            };
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
                    registerObjectColliderFromBounds(planter, { paddingX: 0.06, paddingZ: 0.06 });
                };

                const createDisplayIsland = (x, z, widthScale = 1, depthScale = 1) => {
                    const island = new THREE.Group();
                    addDetail(5.0 * widthScale, 0.95, 2.0 * depthScale, x, 0.48, z, baseMat, island);
                    addDetail(4.4 * widthScale, 0.14, 1.4 * depthScale, x, 1.02, z, accentShelfMat, island);
                    addDetail(4.0 * widthScale, 0.28, 0.52, x, 1.28, z - 0.35 * depthScale, displayMat, island);
                    addDetail(3.6 * widthScale, 0.22, 0.44, x, 1.58, z + 0.28 * depthScale, displayMat, island);
                    addDetail(1.2 * widthScale, 0.18, 1.2 * depthScale, x, 1.22, z, railGlassMat, island);
                    detailedInterior.add(island);
                    registerObjectColliderFromBounds(island, { paddingX: 0.08, paddingZ: 0.08 });
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
                    registerObjectColliderFromBounds(shelf, { paddingX: 0.06, paddingZ: 0.06 });
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
                    registerObjectColliderFromBounds(cashier, { paddingX: 0.08, paddingZ: 0.08 });
                };

                const createUpperLounge = (x, z) => {
                    const lounge = new THREE.Group();
                    addDetail(5.8, 0.55, 1.5, x, anchorSlabTopY + 0.28, z, baseMat, lounge);
                    addDetail(2.4, 0.72, 0.52, x - 1.5, anchorSlabTopY + 0.82, z - 0.42, accentShelfMat, lounge);
                    addDetail(2.4, 0.72, 0.52, x + 1.5, anchorSlabTopY + 0.82, z + 0.42, accentShelfMat, lounge);
                    addDetail(1.3, 0.4, 1.3, x, anchorSlabTopY + 0.22, z + 2.2, darkWoodMat, lounge);
                    detailedInterior.add(lounge);
                    registerObjectColliderFromBounds(lounge, { paddingX: 0.08, paddingZ: 0.08 });
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
                if (!sh.userData.hasGlass) {
                    createShelfUnit(-5.5); // Izquierda
                    createShelfUnit(5.5);  // Derecha
                }               g.add(doors);
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
                const worldPathEndX = posX + (pathEndX * cosR + pathEndZ * sinR);
                const worldPathEndZ = posZ + (-pathEndX * sinR + pathEndZ * cosR);
                const worldPathDx = worldPathEndX - worldPathStartX;
                const worldPathDz = worldPathEndZ - worldPathStartZ;
                const worldAxis = Math.abs(worldPathDx) >= Math.abs(worldPathDz) ? 'x' : 'z';
                const worldTravelDir = worldAxis === 'x'
                    ? Math.sign(worldPathDx || 1)
                    : Math.sign(worldPathDz || 1);
                const worldPathLen = Math.hypot(worldPathDx, worldPathDz);

                const useEastCalibration = idLetter === 'E';
                const useNorthUpCalibration = idLetter === 'N' && up === true;
                const useNorthDownCalibration = idLetter === 'N' && up === false;
                const useWestUpCalibration = idLetter === 'O' && up === true;
                const useWestDownCalibration = idLetter === 'O' && up === false;
                const eastUpStart = { x: -108.53, z: -7.51 };
                const eastUpEnd = { x: -108.36, z: 6.43 };
                const eastDownStart = { x: -111.41, z: -7.54 };
                const eastDownEnd = { x: -111.46, z: 6.21 };
                const northUpStart = { x: -6.61, z: 108.80 };
                const northUpEnd = { x: 7.12, z: 108.46 };
                const northDownStart = { x: -6.31, z: 111.68 };
                const northDownEnd = { x: 6.27, z: 111.48 };
                const westUpStart = { x: 108.60, z: 6.34 };
                const westUpEnd = { x: 108.54, z: -6.57 };
                const westDownStart = { x: 111.48, z: 6.47 };
                const westDownEnd = { x: 111.35, z: -6.38 };
                const useCustomCalibration = useEastCalibration || useNorthUpCalibration || useNorthDownCalibration || useWestUpCalibration || useWestDownCalibration;
                const calibratedStart = useEastCalibration
                    ? (up ? eastUpStart : eastDownStart)
                    : (useNorthUpCalibration
                        ? northUpStart
                        : (useNorthDownCalibration
                            ? northDownStart
                            : (useWestUpCalibration
                                ? westUpStart
                                : (useWestDownCalibration ? westDownStart : null))));
                const calibratedEnd = useEastCalibration
                    ? (up ? eastUpEnd : eastDownEnd)
                    : (useNorthUpCalibration
                        ? northUpEnd
                        : (useNorthDownCalibration
                            ? northDownEnd
                            : (useWestUpCalibration
                                ? westUpEnd
                                : (useWestDownCalibration ? westDownEnd : null))));
                const calibratedDx = useCustomCalibration ? (calibratedEnd.x - calibratedStart.x) : 0;
                const calibratedDz = useCustomCalibration ? (calibratedEnd.z - calibratedStart.z) : 0;
                const calibratedLen = useCustomCalibration ? Math.hypot(calibratedDx, calibratedDz) : 0;
                const ridePath = useCustomCalibration
                    ? {
                        startX: calibratedStart.x,
                        startZ: calibratedStart.z,
                        endX: calibratedEnd.x,
                        endZ: calibratedEnd.z,
                        dx: calibratedDx,
                        dz: calibratedDz,
                        len: Math.max(0.001, calibratedLen)
                    }
                    : null;

                const boundsStartX = ridePath ? ridePath.startX : worldStartX;
                const boundsEndX = ridePath ? ridePath.endX : worldEndX;
                const boundsStartZ = ridePath ? ridePath.startZ : worldStartZ;
                const boundsEndZ = ridePath ? ridePath.endZ : worldEndZ;

                escalatorList.push({
                    id: escalatorList.length,
                    x: (boundsStartX + boundsEndX) / 2,
                    z: (boundsStartZ + boundsEndZ) / 2,
                    xMin: Math.min(boundsStartX, boundsEndX) - 1.8,
                    xMax: Math.max(boundsStartX, boundsEndX) + 1.8,
                    zMin: Math.min(boundsStartZ, boundsEndZ) - 1.8,
                    zMax: Math.max(boundsStartZ, boundsEndZ) + 1.8,
                    up,
                    yStart: bottomY - 0.53,
                    yEnd: topY - 0.53,
                    xStart: worldStartX,
                    xEnd: worldEndX,
                    zStart: worldStartZ,
                    zEnd: worldEndZ,
                    travelStartX: ridePath ? ridePath.startX : worldPathStartX,
                    travelStartZ: ridePath ? ridePath.startZ : worldPathStartZ,
                    travelDir: worldTravelDir,
                    axis: worldAxis,
                    dir: travelDir,
                    flatLen: landingLen,
                    pathLenZ: ridePath ? ridePath.len : worldPathLen,
                    diagLenZ: diagRunLen,
                    pathStartY: up ? ESCALATOR_RIDE_Y_BOTTOM : anchorSlabTopY,
                    pathEndY: up ? anchorSlabTopY : ESCALATOR_RIDE_Y_BOTTOM,
                    isAnchorEscalator: true,
                    anchorCode: idLetter,
                    ridePath
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
            const minorHalf = longAxisOnX ? voidHalfL : voidHalfW;
            const laneOffset = Math.max(0, minorHalf - escHalfWidth - laneMargin);

            if (longAxisOnX) {
                // Dos carriles paralelos sobre el lado largo, en sentidos opuestos.
                addAnchorDiagonalEscalator(voidHalfW, slabZCenter + laneOffset, -voidHalfW, slabZCenter + laneOffset, true);
                addAnchorDiagonalEscalator(-voidHalfW, slabZCenter - laneOffset, voidHalfW, slabZCenter - laneOffset, false);
            } else {
                // Dos carriles paralelos sobre el lado largo, en sentidos opuestos.
                addAnchorDiagonalEscalator(laneOffset, slabZCenter + voidHalfL, laneOffset, slabZCenter - voidHalfL, true);
                addAnchorDiagonalEscalator(-laneOffset, slabZCenter - voidHalfL, -laneOffset, slabZCenter + voidHalfL, false);
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
            addAnchorFacadeIdentity(-25, -1, name, 'boulevard');

            // 2. Planta Alta (MURO TOTALMENTE CERRADO para seguridad)
            m(width, height - 5.4, 0.2, 0, 5.4 + (height - 5.4) / 2, -25, whiteMat);

            addAnchorFacadeIdentity(anchorFrontWallZ, 1, name, 'atrium');
            m(width + 2, 2.5, 0.8, 0, height + 1.25, 5, facadeMetalMat);
            m(width + 2.4, 0.12, 0.94, 0, height + 2.52, 5, facadeChampagneMat);
            m(width + 2.4, 0.12, 0.94, 0, height - 0.02, 5, facadeChampagneMat);
            const sM = new THREE.Mesh(new THREE.PlaneGeometry(width - 6, 1.85), new THREE.MeshBasicMaterial({ map: createSignTexture(name), transparent: true, depthWrite: false }));
            sM.position.set(0, height + 1.25, 5.48); g.add(sM);
            g.userData.ensureDetailedInterior = ensureDetailedInterior;
            g.userData.detailedInteriorGroup = detailedInterior;
            g.userData.interiorDetailFade = 0;
            g.userData.interiorDetailVisible = false;
            registerInteriorFogZone(g, -width / 2 + 0.35, width / 2 - 0.35, -24.7, 8.9, 0.05, height - 0.05);
            return g;
        }
        // --- TIENDAS ANCLA (RESTAURACIÓN ESTRUCTURAL CON SALIDAS) ---
        const sAnchor = createAnchorStore(0, -100, 70, 15, "MALL SUR", "S", 0);
        registerStoreGroup("S", sAnchor);
        registerPhysicalSpace(sAnchor, {
            id: buildAnchorPhysicalSpaceId(0, -100),
            kind: 'anchor',
            floor: 0,
            axis: 'anchor',
            quadrant: 'x0_zn',
            slotIndex: 1,
            wing: 'zn',
            generatedCode: 'S',
            displayCode: 'S',
            sizeClass: 'anchor',
            width: 70,
            depth: 30,
            height: 15
        });
        scene.add(sAnchor);
        registerCollider(-20.5, -125, 29, 1, 0, 15); // Muro Frontal Izq (Sur)
        registerCollider(20.5, -125, 29, 1, 0, 15);  // Muro Frontal Der (Sur)

        const nAnchor = createAnchorStore(0, 100, 70, 15, "MALL NORTE", "N", Math.PI);
        registerStoreGroup("N", nAnchor);
        registerPhysicalSpace(nAnchor, {
            id: buildAnchorPhysicalSpaceId(0, 100),
            kind: 'anchor',
            floor: 0,
            axis: 'anchor',
            quadrant: 'x0_zp',
            slotIndex: 1,
            wing: 'zp',
            generatedCode: 'N',
            displayCode: 'N',
            sizeClass: 'anchor',
            width: 70,
            depth: 30,
            height: 15
        });
        scene.add(nAnchor);
        registerCollider(-20.5, 125, 29, 1, 0, 15); // Muro Frontal Izq (Norte - Puerta Boulevard)
        registerCollider(20.5, 125, 29, 1, 0, 15);  // Muro Frontal Der (Norte - Puerta Boulevard)

        const eastAnchor = createAnchorStore(-100, 0, 70, 15, "MALL ESTE", "E", Math.PI / 2);
        registerStoreGroup("E", eastAnchor);
        registerPhysicalSpace(eastAnchor, {
            id: buildAnchorPhysicalSpaceId(-100, 0),
            kind: 'anchor',
            floor: 0,
            axis: 'anchor',
            quadrant: 'xn_z0',
            slotIndex: 1,
            wing: 'xn',
            generatedCode: 'E',
            displayCode: 'E',
            sizeClass: 'anchor',
            width: 70,
            depth: 30,
            height: 15
        });
        scene.add(eastAnchor);
        registerCollider(-125, -20.5, 1, 29, 0, 15); // Muro Frontal (Este)
        registerCollider(-125, 20.5, 1, 29, 0, 15);

        const westAnchor = createAnchorStore(100, 0, 70, 15, "MALL OESTE", "O", -Math.PI / 2);
        registerStoreGroup("O", westAnchor);
        registerPhysicalSpace(westAnchor, {
            id: buildAnchorPhysicalSpaceId(100, 0),
            kind: 'anchor',
            floor: 0,
            axis: 'anchor',
            quadrant: 'xp_z0',
            slotIndex: 1,
            wing: 'xp',
            generatedCode: 'O',
            displayCode: 'O',
            sizeClass: 'anchor',
            width: 70,
            depth: 30,
            height: 15
        });
        scene.add(westAnchor);
        registerCollider(125, -20.5, 1, 29, 0, 15); // Muro Frontal (Oeste)
        registerCollider(125, 20.5, 1, 29, 0, 15);

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
            registerRotatedSolidFootprint(x, z, 4.4, 1.9, rot, 0, 2.6);
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

        function isEscalatorMotionEnabled(escalator) {
            if (!escalator?.isAnchorEscalator) return true;
            if (escalator.anchorCode === 'S') return true;
            if (escalator.anchorCode === 'O' && (escalator.up === true || escalator.up === false)) return true;
            if (escalator.anchorCode === 'N' && (escalator.up === true || escalator.up === false)) return true;
            if (escalator.anchorCode === 'E' && (escalator.up === true || escalator.up === false)) return true;
            return false;
        }

        function findActiveEscalator(x, y, z, eyeOffset = 0) {
            let best = null;
            let bestScore = Infinity;

            escalatorList.forEach((escalator) => {
                if (!isEscalatorMotionEnabled(escalator)) return;
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
                const angle = door.swingAngle * door.openAmount * (door.swingSign ? 1 : -1);
                door.leftLeaf.rotation.y = angle;
                door.rightLeaf.rotation.y = -angle;
                return;
            }
            const slide = door.slideDistance * door.openAmount;
            if (!door.leftFixed) door.leftLeaf.position.x = door.leftClosedX - slide;
            if (!door.rightFixed) door.rightLeaf.position.x = door.rightClosedX + slide;
            const layerOffset = door.layerOffset ? BOUTIQUE_DOOR_LAYER_OFFSET : 0;
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
            allStoreGroups.forEach((shop) => {
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
                const shouldPreloadFacade = distance <= BOUTIQUE_FACADE_PRELOAD_DISTANCE;
                const shouldStreamInterior = targetFade > BOUTIQUE_DETAIL_STREAM_BUILD_THRESHOLD;

                if (shouldPreloadFacade) {
                    if (!shop.userData.storeVisualPayload && !shop.userData.isLoadingVisuals) {
                        loadStoreVisualsOnDemand(shop);
                    }
                    if (typeof shop.userData.ensureFacadeStoreVisuals === 'function') {
                        shop.userData.ensureFacadeStoreVisuals();
                    }
                }

                if (shouldStreamInterior) {
                    if (typeof shop.userData.ensureDetailedInterior === 'function') {
                        shop.userData.ensureDetailedInterior();
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
            allStoreGroups.forEach((shop) => {
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

        function createBoutique(posX, posZ, rotY, walls, posY = 0, shopCode = "", fixedLeaves = [], physicalMeta = null) {
            const sh = new THREE.Group(); sh.position.set(posX, posY, posZ); sh.rotation.y = rotY;
            const plateCode = physicalMeta?.plateCode || shopCode;
            sh.userData = {
                isBoutique: true,
                shopCode: shopCode,
                hasGlass: (walls.left === 'glass' || walls.right === 'glass'),
                sourceShopCode: physicalMeta?.generatedCode || shopCode,
                physicalSpaceId: physicalMeta?.id || '',
                plateCode: plateCode
            };
            if (physicalMeta) registerPhysicalSpace(sh, physicalMeta);
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
            const hiddenRearWallIds = new Set([
                'phys_b_f1_xp_zn_horizontal_01',
                'phys_b_f1_xn_zn_horizontal_01',
                'phys_b_f1_xp_zn_vertical_01',
                'phys_b_f1_xp_zp_vertical_01',
                'phys_b_f1_xn_zp_vertical_01',
                'phys_b_f1_xn_zp_horizontal_01',
                'phys_b_f1_xp_zp_horizontal_01'
            ]);
            const hiddenLeftWallIds = new Set([
                'phys_b_f2_xn_zn_vertical_07',
                'phys_b_f2_xp_zp_vertical_07',
                'phys_b_f2_xp_zp_vertical_06'
            ]);
            const hiddenRightWallIds = new Set([
                'phys_b_f2_xp_zn_vertical_07',
                'phys_b_f2_xp_zp_vertical_06'
            ]);
            const hideRearWallForShop = shopCode === "S101" || shopCode === "S201" || hiddenRearWallIds.has(physicalMeta?.id);
            const transverseWallHighlightMat = new THREE.MeshStandardMaterial({ color: 0xc83b32, roughness: 0.54, metalness: 0.06 });
            const highlightedBackWallIds = new Set([
                'phys_b_f1_xp_zn_vertical_02',
                'phys_b_f1_xp_zn_horizontal_01',
                'phys_b_f1_xn_zn_horizontal_01',
                'phys_b_f1_xp_zn_vertical_01',
                'phys_b_f1_xp_zp_vertical_01',
                'phys_b_f1_xn_zn_vertical_01',
                'phys_b_f1_xn_zp_vertical_01',
                'phys_b_f1_xn_zp_horizontal_01',
                'phys_b_f1_xp_zp_horizontal_01',
                'phys_b_f2_xn_zn_vertical_07',
                'phys_b_f2_xp_zn_vertical_07'
            ]);
            const highlightBackWall = highlightedBackWallIds.has(physicalMeta?.id);
            const highlightedLeftWallIds = new Set([
                'phys_b_f2_xn_zn_vertical_07',
                'phys_b_f2_xp_zp_vertical_07',
                'phys_b_f2_xp_zp_vertical_06'
            ]);
            const highlightedRightWallIds = new Set([
                'phys_b_f2_xp_zn_vertical_07',
                'phys_b_f2_xp_zp_vertical_06'
            ]);
            const highlightLeftWall = highlightedLeftWallIds.has(physicalMeta?.id);
            const highlightRightWall = highlightedRightWallIds.has(physicalMeta?.id);

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

            const boutiqueEntryClearance = {
                minX: -3.6,
                maxX: 3.6,
                minZ: 1.2,
                maxZ: 9.1
            };

            const intersectsBoutiqueEntry = (centerX, centerZ, width, depth, margin = 0.18) => {
                const halfW = width / 2 + margin;
                const halfD = depth / 2 + margin;
                const minX = centerX - halfW;
                const maxX = centerX + halfW;
                const minZ = centerZ - halfD;
                const maxZ = centerZ + halfD;
                return !(
                    maxX < boutiqueEntryClearance.minX ||
                    minX > boutiqueEntryClearance.maxX ||
                    maxZ < boutiqueEntryClearance.minZ ||
                    minZ > boutiqueEntryClearance.maxZ
                );
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
                registerObjectColliderFromBounds(shelf, { paddingX: 0.06, paddingZ: 0.06 });
            };

            const addCenterIsland = (x, z, width, depth, height, glassCap = false) => {
                if (intersectsBoutiqueEntry(x, z, width, depth)) return;
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
                registerObjectColliderFromBounds(island, { paddingX: 0.08, paddingZ: 0.08 });
            };

            const addCashDesk = (x, z) => {
                if (intersectsBoutiqueEntry(x, z, 2.8, 1.15)) return;
                const desk = new THREE.Group();
                desk.position.set(x, 0, z);
                cw(2.8, 1.05, 1.15, 0, 0.52, 0, woodDarkMat, desk);
                cw(2.68, 0.16, 1.02, 0, 1.12, 0, stoneMat, desk);
                cw(1.1, 0.86, 0.46, -0.72, 1.55, 0, accentMat, desk);
                cw(0.6, 0.08, 0.42, -0.72, 1.56, 0.03, darkMat, desk);
                cw(0.42, 0.68, 0.42, 0.85, 0.36, 0.12, woodMat, desk);
                cw(0.78, 0.14, 0.48, 0.85, 0.78, 0.12, softFabricMat, desk);
                sh.add(desk);
                registerObjectColliderFromBounds(desk, { paddingX: 0.08, paddingZ: 0.08 });
            };

            const addFrontVitrine = (x, z) => {
                if (intersectsBoutiqueEntry(x, z, 1.65, 0.9)) return;
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
                registerObjectColliderFromBounds(vitrine, { paddingX: 0.08, paddingZ: 0.08 });
            };
            const addWindowDisplay = (x) => {
                if (intersectsBoutiqueEntry(x, 7.25, 2.15, 0.95)) return;
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
                registerObjectColliderFromBounds(display, { paddingX: 0.08, paddingZ: 0.08 });
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
            // Nota rendimiento: evitamos PointLight por local para no penalizar FPS/carga inicial.

            if (walls.back && !hideRearWallForShop && shopCode !== "E207") {
                cw(12, 4.8, 0.1, 0, 2.4, -9, highlightBackWall ? transverseWallHighlightMat : whiteMat);
            }
            if (walls.left !== false && shopCode !== "O206" && !hiddenLeftWallIds.has(physicalMeta?.id)) {
                cw(0.1, 4.8, 18, -6, 2.4, 0, highlightLeftWall ? transverseWallHighlightMat : (walls.left === 'glass' ? glassMat : whiteMat));
            }
            if (walls.right !== false && shopCode !== "E206" && !hiddenRightWallIds.has(physicalMeta?.id)) {
                cw(0.1, 4.8, 18, 6, 2.4, 0, highlightRightWall ? transverseWallHighlightMat : (walls.right === 'glass' ? glassMat : whiteMat));
            }

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
                const idTex = createSmallIDTexture(plateCode);
                const idPlaque = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: idTex, transparent: true }));
                idPlaque.userData.isStoreCodeSign = true;
                idPlaque.userData.isSign = true;
                idPlaque.userData.isCatalogTrigger = true;
                idPlaque.userData.shopCode = shopCode;
                idPlaque.userData.displayCode = plateCode;
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
                idPlaqueHitbox.userData.displayCode = plateCode;
                idPlaqueHitbox.position.copy(idPlaque.position);
                idPlaqueHitbox.position.z += 0.02;
                idPlaqueHitbox.renderOrder = 60;
                sh.add(idPlaqueHitbox);
                catalogClickTargets.push(idPlaqueHitbox);
            }

            const logoBannerTex = createSmallIDTexture(plateCode || "LOCAL");
            const logoBannerMat = new THREE.MeshBasicMaterial({
                map: logoBannerTex,
                transparent: true,
                alphaTest: 0.5,
                depthWrite: false,
                depthTest: true,
                side: THREE.DoubleSide,
                polygonOffset: true,
                polygonOffsetFactor: -1,
                polygonOffsetUnits: -1
            });
            logoBannerMat.toneMapped = false;
            const logoBanner = new THREE.Mesh(new THREE.PlaneGeometry(BOUTIQUE_SIGN_WIDTH, BOUTIQUE_SIGN_HEIGHT), logoBannerMat);
            logoBanner.userData = { isSign: true, isLogoBanner: true, isCatalogTrigger: true, shopCode: shopCode, displayCode: plateCode };
            logoBanner.visible = true;
            logoBanner.material.transparent = true;
            logoBanner.material.opacity = 0;
            logoBanner.position.set(0, doorH + ((shopH - doorH) / 2), 9.028);
            logoBanner.renderOrder = 24;
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
                if (walls.back && !hideRearWallForShop) {
                    addShelfWall(0, -8.05, 8.4, 0.9, 3.9, 0, highlightBackWall ? transverseWallHighlightMat : null);
                }
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
            if (walls.back && !hideRearWallForShop && shopCode !== "E207") {
                const rx = posX + sin * (-8.75); const rz = posZ + cos * (-8.75);
                registerCollider(rx, rz, Math.abs(12 * cos) + Math.abs(0.5 * sin), Math.abs(12 * sin) + Math.abs(0.5 * cos), yB, yB + 6);
            }

            // 2. Paredes Laterales (+/- 5.75)
            if (walls.left !== false && shopCode !== "O206" && !hiddenLeftWallIds.has(physicalMeta?.id)) {
                const lx = posX + cos * (-5.75); const lz = posZ + sin * 5.75;
                registerCollider(lx, lz, Math.abs(0.5 * cos) + Math.abs(18 * sin), Math.abs(0.5 * sin) + Math.abs(18 * cos), yB, yB + 6);
            }
            if (walls.right !== false && shopCode !== "E206" && shopCode !== "O201" && !hiddenRightWallIds.has(physicalMeta?.id)) {
                const rx = posX + cos * 5.75; const rz = posZ + sin * (-5.75);
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
        THREE.Cache.enabled = true;
        const textureLoader = new THREE.TextureLoader();
        textureLoader.setCrossOrigin('anonymous');

        async function updateStoreVisuals(code, storeData, products) {
            const targets = getStoreGroupCollection(code);
            if (!targets.length) return;
            targets.forEach((sh) => {
                sh.userData.storeVisualPayload = {
                    storeData: storeData || {},
                    products: products || []
                };
                sh.userData.storeVisualRevision = (sh.userData.storeVisualRevision || 0) + 1;

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

                if (!sh.userData.storeVisualPayload) return;
                const payload = sh.userData.storeVisualPayload;
                const liveStoreData = payload.storeData || {};
                const liveProducts = payload.products || [];

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
                    opacity: 1,
                    side: THREE.DoubleSide,
                    depthTest: true,
                    depthWrite: true,
                    alphaTest: 0.5,
                    polygonOffset: true,
                    polygonOffsetFactor: -1,
                    polygonOffsetUnits: -1
                });
                productPanelMat.toneMapped = false;
                const productPanelBackMat = new THREE.MeshBasicMaterial({
                    color: 0x080808,
                    transparent: true,
                    opacity: 0.42,
                    side: THREE.DoubleSide,
                    depthTest: true,
                    depthWrite: true,
                    alphaTest: 0.5,
                    polygonOffset: true,
                    polygonOffsetFactor: -1,
                    polygonOffsetUnits: -1
                });
                productPanelBackMat.toneMapped = false;

                const loadProductTexture = (mesh, imageUrl) => {
                    textureLoader.load(imageUrl, (tex) => {
                        tex.colorSpace = THREE.SRGBColorSpace;
                        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
                        tex.generateMipmaps = false;
                        tex.minFilter = THREE.LinearFilter;
                        tex.magFilter = THREE.LinearFilter;
                        tex.wrapS = THREE.ClampToEdgeWrapping;
                        tex.wrapT = THREE.ClampToEdgeWrapping;
                        tex.needsUpdate = true;
                        mesh.material.map = tex;
                        mesh.material.transparent = true;
                        mesh.material.opacity = 1;
                        mesh.material.alphaTest = 0.02;
                        mesh.material.toneMapped = false;
                        mesh.material.needsUpdate = true;
                    }, undefined, () => {
                        mesh.material.color.setHex(0x181818);
                        mesh.material.opacity = 0.16;
                        mesh.material.needsUpdate = true;
                    });
                };

                const addProductImagePlane = (parent, product, x, y, z, width, height, rotationY = 0) => {
                    const holder = new THREE.Group();
                    holder.position.set(x, y, z);
                    holder.rotation.y = rotationY;
                    holder.renderOrder = -10;

                    const backing = new THREE.Mesh(new THREE.PlaneGeometry(width + 0.08, height + 0.08), productPanelBackMat.clone());
                    backing.position.z = 0;
                    backing.renderOrder = -10;
                    holder.add(backing);

                    const image = new THREE.Mesh(new THREE.PlaneGeometry(width, height), productPanelMat.clone());
                    image.position.z = 0.001;
                    image.renderOrder = -9;
                    holder.add(image);

                    const trimMat = goldMat.clone();
                    trimMat.depthTest = true;
                    trimMat.depthWrite = true;
                    const top = new THREE.Mesh(new THREE.BoxGeometry(width + 0.12, 0.025, 0.025), trimMat);
                    const bottom = top.clone();
                    const left = new THREE.Mesh(new THREE.BoxGeometry(0.025, height + 0.12, 0.025), trimMat);
                    const right = left.clone();
                    top.position.set(0, height / 2 + 0.045, 0.002);
                    bottom.position.set(0, -height / 2 - 0.045, 0.002);
                    left.position.set(-width / 2 - 0.045, 0, 0.002);
                    right.position.set(width / 2 + 0.045, 0, 0.002);
                    top.renderOrder = -9;
                    bottom.renderOrder = -9;
                    left.renderOrder = -9;
                    right.renderOrder = -9;
                    holder.add(top, bottom, left, right);

                    if (product?.image_url) {
                        loadProductTexture(image, product.image_url);
                    } else {
                        image.material.color.setHex(0x111111);
                        image.material.opacity = 0.08;
                    }
                    parent.add(holder);
                    return holder;
                };

                const addFacadeProductPanels = () => {
                    const facade = new THREE.Group();
                    facade.name = "facadeProductPanels";
                    facade.renderOrder = 24;
                    const showcaseBehindGlassZ = 9.028;
                    const leftSlots = [
                        [-4.92, 1.55], [-4.12, 2.6], [-4.88, 3.68]
                    ];
                    const rightSlots = [
                        [4.12, 1.55], [4.92, 2.6], [4.16, 3.68]
                    ];
                    [...leftSlots, ...rightSlots].forEach(([x, y], index) => {
                        const product = productsWithImages[index];
                        addProductImagePlane(facade, product, x, y, showcaseBehindGlassZ, 1.28, 1.02);
                    });
                    showcase.add(facade);
                };

                sh.userData.ensureFacadeStoreVisuals = function () {
                    if (!sh.userData.storeVisualPayload) return;
                    if (sh.userData.facadeVisualRevision === sh.userData.storeVisualRevision) return;
                    while (showcase.children.length > 0) showcase.remove(showcase.children[0]);
                    addFacadeProductPanels();
                    sh.userData.facadeVisualRevision = sh.userData.storeVisualRevision;
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

                const createShelfUnit = (posX) => {
                    const unit = new THREE.Group();
                    // Retrasar los estantes laterales para liberar completamente
                    // la embocadura de la puerta y el cono visual de acceso.
                    unit.position.set(posX, 0, -4.2);
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
                    if (!sh.userData.dynamicInteriorCollisionBuilt) {
                        registerObjectColliderFromBounds(unit, { paddingX: 0.06, paddingZ: 0.06 });
                    }
                };

                sh.userData.ensureDynamicStoreVisuals = function () {
                    if (!sh.userData.storeVisualPayload) return;
                    if (sh.userData.dynamicInteriorRevision === sh.userData.storeVisualRevision) return;
                    if (typeof sh.userData.ensureFacadeStoreVisuals === 'function') {
                        sh.userData.ensureFacadeStoreVisuals();
                    }
                    while (interior.children.length > 0) interior.remove(interior.children[0]);
                    const isPassageShop = code === "S101" || code === "S201";
                    // Los afiches en vitrina sustituyen a los estantes laterales
                    // cercanos al acceso para no obstruir entradas.
                    addInteriorProductGallery();
                    prepareGroupForDistanceFade(interior);
                    sh.userData.dynamicInteriorBuilt = true;
                    sh.userData.dynamicInteriorCollisionBuilt = true;
                    sh.userData.dynamicInteriorRevision = sh.userData.storeVisualRevision;
                };

                // Actualizar Letrero si hay Logo
                const sign = sh.children.find(c => c.userData?.isLogoBanner) || sh.children.find(c => c.userData?.isSign);
                if (storeData.logo_url) {
                    textureLoader.load(storeData.logo_url, (tex) => {
                        if (sign) {
                            tex.colorSpace = THREE.SRGBColorSpace;
                            tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
                            tex.generateMipmaps = false;
                            tex.minFilter = THREE.LinearFilter;
                            tex.magFilter = THREE.LinearFilter;
                            tex.wrapS = THREE.ClampToEdgeWrapping;
                            tex.wrapT = THREE.ClampToEdgeWrapping;
                            tex.needsUpdate = true;
                            sign.material.map = tex;
                            sign.material.needsUpdate = true;
                            sign.material.depthTest = true;
                            sign.material.depthWrite = false;
                            sign.material.alphaTest = 0.02;
                            sign.material.transparent = true;
                            sign.material.opacity = 1;
                            sign.material.toneMapped = false;
                            sign.visible = true;
                            sign.renderOrder = 24;
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

                if (typeof sh.userData.ensureFacadeStoreVisuals === 'function') {
                    sh.userData.ensureFacadeStoreVisuals();
                }
                if (sh.userData.interiorDetailVisible && typeof sh.userData.ensureDynamicStoreVisuals === 'function') {
                    sh.userData.ensureDynamicStoreVisuals();
                    setGroupFade(interior, sh.userData.interiorDetailFade || 1);
                }
            });
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


        const STORE_CODE_RENAMES = {
            E105: 'S-101',
            O105: 'S-102',
            E104: 'S-103',
            O104: 'S-104',
            E103: 'S-105',
            O103: 'S-106',
            E102: 'S-107',
            O102: 'S-108',
            E101: 'SE-10',
            O101: 'OS-10',
            S105: 'O-101',
            N105: 'O-102',
            S104: 'O-103',
            N104: 'O-104',
            S103: 'O-105',
            N103: 'O-106',
            S102: 'O-107',
            N102: 'O-108',
            S101: 'OS-10'
        };

        function renameStoreCode(code) {
            return STORE_CODE_RENAMES[code] || code;
        }

        const q = (sx, sz, y) => {
            const gr = new THREE.Group();
            const floorNum = (y === 0) ? 1 : 2;
            const wingH = (sz > 0) ? 'N' : 'S';
            const wingV = (sx > 0) ? 'O' : 'E';
            const sectorKey = getSignedSectorKey(sx, sz);

        // CORRECCIÓN "MORDIDA DE RATÓN": Iniciamos en 23 para cerrar esquinas del atrio
            let oRows, sideRows;
            if (y === 0) {
                // Planta Baja: local corrido para agrupar junto al ancla y abrir vacío al centro del brazo.
                oRows = [23, 35, 47, 65, 77];
                sideRows = [23, 35, 47, 65, 77];
            } else {
                // Planta Alta: 7 tiendas para cerrar hasta la Gran Tienda (89+6=95)
                oRows = [23, 35, 47, 59, 71, 83, 89];
                sideRows = [23, 35, 47, 59, 71, 83, 89];
            }

            oRows.forEach((o, i) => {
                const generatedCode = `${wingH}${floorNum}${String(i + 1).padStart(2, '0')}`;
                const code = renameStoreCode(generatedCode);
                const physicalSpaceId = buildBoutiquePhysicalSpaceId(floorNum, sx, sz, 'horizontal', i + 1);
                const plateCode = resolvePhysicalPlateCode(physicalSpaceId, code);
                const fixed = (code === "S201") ? ['right'] : [];
                const isCornerSlot = i === 0;
                const wallConfigH = {
                    back: true,
                    left: isCornerSlot ? (sx > 0 ? false : 'glass') : true,
                    right: isCornerSlot ? (sx > 0 ? 'glass' : false) : true
                };
                const b = createBoutique(o * sx, 26 * sz, sz > 0 ? Math.PI : 0, wallConfigH, y, code, fixed, {
                    id: physicalSpaceId,
                    kind: 'boutique',
                    floor: floorNum,
                    axis: 'horizontal',
                    quadrant: sectorKey,
                    slotIndex: i + 1,
                    wing: wingH,
                    generatedCode,
                    displayCode: plateCode,
                    plateCode,
                    sizeClass: 'standard',
                    width: 12,
                    depth: 18,
                    height: 5.2
                });
                registerStoreGroup(code, b);
                gr.add(b);
            });

            sideRows.forEach((o, i) => {
                const generatedCode = `${wingV}${floorNum}${String(i + 1).padStart(2, '0')}`;
                const code = renameStoreCode(generatedCode);
                const physicalSpaceId = buildBoutiquePhysicalSpaceId(floorNum, sx, sz, 'vertical', i + 1);
                const plateCode = resolvePhysicalPlateCode(physicalSpaceId, code);
                const isCornerSlot = i === 0;
                const wallConfig = {
                    back: true,
                    left: isCornerSlot ? (sz > 0 ? false : 'glass') : true,
                    right: isCornerSlot ? (sz > 0 ? 'glass' : false) : true
                };
                if (code === "O201") wallConfig.right = false;
                const b = createBoutique(26 * sx, o * sz, sx > 0 ? -Math.PI / 2 : Math.PI / 2, wallConfig, y, code, [], {
                    id: physicalSpaceId,
                    kind: 'boutique',
                    floor: floorNum,
                    axis: 'vertical',
                    quadrant: sectorKey,
                    slotIndex: i + 1,
                    wing: wingV,
                    generatedCode,
                    displayCode: plateCode,
                    plateCode,
                    sizeClass: 'standard',
                    width: 12,
                    depth: 18,
                    height: 5.2
                });
                registerStoreGroup(code, b);
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

            // Segundo piso: eliminación de tramos solicitados (patrón simétrico).
            if (y === 5.5) {
                const cutSegments = [
                    { x1: 17, z1: -83, x2: 34, z2: -83 },
                    { x1: -17, z1: -83, x2: -34, z2: -83 },
                    { x1: -17, z1: 83, x2: -34, z2: 83 },
                    { x1: 17, z1: 83, x2: 34, z2: 83 },
                    { x1: 83, z1: -17, x2: 83, z2: -34 },
                    { x1: 83, z1: 17, x2: 83, z2: 34 },
                    { x1: -83, z1: -17, x2: -83, z2: -34 },
                    { x1: -83, z1: 17, x2: -83, z2: 34 }
                ];

                const cutBoxes = cutSegments.map((s) => {
                    const minX = Math.min(s.x1, s.x2) - 0.8;
                    const maxX = Math.max(s.x1, s.x2) + 0.8;
                    const minZ = Math.min(s.z1, s.z2) - 0.8;
                    const maxZ = Math.max(s.z1, s.z2) + 0.8;
                    return new THREE.Box3(
                        new THREE.Vector3(minX, 5.3, minZ),
                        new THREE.Vector3(maxX, 11.1, maxZ)
                    );
                });

                const toRemove = [];
                const tempBox = new THREE.Box3();
                const tempSize = new THREE.Vector3();
                gr.traverse((node) => {
                    if (!node?.isMesh || !node.geometry || !node.parent) return;
                    tempBox.setFromObject(node);
                    if (tempBox.isEmpty()) return;
                    tempBox.getSize(tempSize);
                    const isWallLike = (tempSize.y > 4.5 && tempSize.y < 6.2) && (tempSize.x <= 1.2 || tempSize.z <= 1.2);
                    if (!isWallLike) return;
                    if (!cutBoxes.some((box) => box.intersectsBox(tempBox))) return;
                    toRemove.push(node);
                });
                toRemove.forEach((node) => node.parent?.remove(node));
            }

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

        function createSecondFloorSupportPillars() {
            const pillarShaftMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.2, metalness: 0.08 });
            const shaftH = 4.62;
            const shaftY = shaftH / 2;
            const capitalH = 0.18;
            const topBandH = 0.08;
            const supportTopY = shaftH + capitalH + topBandH;

            const addSupport = (x, z) => {
                const support = new THREE.Group();

                const base = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.54, 0.6, 0.16, 24),
                    pillarShaftMat
                );
                base.position.set(0, 0.07, 0);
                support.add(base);

                const shaft = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.3, 0.34, shaftH, 28),
                    pillarShaftMat
                );
                shaft.position.set(0, shaftY, 0);
                support.add(shaft);

                const band = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.39, 0.39, 0.16, 28),
                    goldMat
                );
                band.position.set(0, 0.45, 0);
                support.add(band);

                const capital = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.5, 0.58, 0.18, 28),
                    pillarShaftMat
                );
                capital.position.set(0, shaftH + capitalH / 2, 0);
                support.add(capital);

                const topBand = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.58, 0.58, 0.08, 28),
                    pillarShaftMat
                );
                topBand.position.set(0, shaftH + capitalH + topBandH / 2, 0);
                support.add(topBand);

                support.position.set(x, 0, z);
                scene.add(support);
                // Huella un poco más contenida: evita sensación de "bulto invisible"
                // alrededor del fuste sin permitir atravesar visualmente el pilar.
                registerSolidFootprint(x, z, 0.76, 0.76, 0, supportTopY + 0.2);
            };

            // Modulación estructural:
            // pilares pegados al borde exterior de las pasarelas para no invadir la circulación central.
            const longSpanStations = [-62, -38, 38, 62];
            const innerEdgeOffset = 11.75;
            longSpanStations.forEach((z) => {
                addSupport(innerEdgeOffset, z);
                addSupport(-innerEdgeOffset, z);
            });
            longSpanStations.forEach((x) => {
                addSupport(x, innerEdgeOffset);
                addSupport(x, -innerEdgeOffset);
            });
            [
                [innerEdgeOffset, innerEdgeOffset],
                [innerEdgeOffset, -innerEdgeOffset],
                [-innerEdgeOffset, innerEdgeOffset],
                [-innerEdgeOffset, -innerEdgeOffset]
            ].forEach(([x, z]) => addSupport(x, z));
        }
        createSecondFloorSupportPillars();

        const railCornerPillarsPlaced = new Set();
        function addRailCornerPillar(x, z) {
            const key = `${x.toFixed(2)}|${z.toFixed(2)}`;
            if (railCornerPillarsPlaced.has(key)) return;
            railCornerPillarsPlaced.add(key);

            const pillarBody = new THREE.Mesh(
                new THREE.CylinderGeometry(0.09, 0.09, 1.28, 18),
                new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.85, roughness: 0.2 })
            );
            pillarBody.position.set(x, 6.14, z);
            scene.add(pillarBody);

            const pillarCap = new THREE.Mesh(
                new THREE.SphereGeometry(0.105, 16, 16),
                goldMat
            );
            pillarCap.position.set(x, 6.79, z);
            scene.add(pillarCap);
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
            // Refuerzo en extremos: evita micro-huecos en esquinas/intersecciones del perímetro.
            const endpointColliderSize = 0.6;
            const half = len / 2;
            if (rot) {
                addRailCornerPillar(x, z - half);
                addRailCornerPillar(x, z + half);
                registerCollider(x, z - half, endpointColliderSize, endpointColliderSize, 5.0, 9.0);
                registerCollider(x, z + half, endpointColliderSize, endpointColliderSize, 5.0, 9.0);
            } else {
                addRailCornerPillar(x - half, z);
                addRailCornerPillar(x + half, z);
                registerCollider(x - half, z, endpointColliderSize, endpointColliderSize, 5.0, 9.0);
                registerCollider(x + half, z, endpointColliderSize, endpointColliderSize, 5.0, 9.0);
            }
        }


        // --- SEGURIDAD Y LUJO: BARANDILLAS HUECO SUR (S) ---
        createRail(8, -17, 6, false); // Segmento derecho
        createRail(-8, -17, 6, false); // Segmento izquierdo
        createRail(0, -83, 22, false);
        createRail(11, -50, 66, true);
        createRail(-11, -50, 66, true);
        // Refuerzo puntual frente a S-203: el tramo visible existe, pero aquí necesitaba mayor espesor de colisión.
        registerCollider(-11.0, -71.0, 1.4, 12.5, 5.0, 9.0);

        // --- SEGURIDAD Y LUJO: BARANDILLAS HUECO NORTE (N) ---
        createRail(8, 17, 6, false); // Segmento derecho
        createRail(-8, 17, 6, false); // Segmento izquierdo
        createRail(0, 83, 22, false);
        createRail(-11, 50, 66, true);
        createRail(11, 50, 66, true);
        // Refuerzo puntual reportado cerca de x~11.3, z~71.8 en el borde norte-derecho.
        registerCollider(11.0, 71.8, 1.4, 12.5, 5.0, 9.0);

        // --- SEGURIDAD Y LUJO: BARANDILLAS HUECO OESTE (O) ---
        createRail(-17, 0, 22, true);
        createRail(-83, 0, 22, true);
        createRail(-50, 11, 66, false);
        createRail(-50, -11, 66, false);
        // Refuerzo puntual reportado en borde oeste superior (x~-78, z~11)
        registerCollider(-78.0, 11.0, 8.0, 1.2, 5.0, 9.0);

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
        // Refuerzo de seguridad en esquinas del anillo central (evita cruce diagonal por unión de tramos)
        [
            [11, 11],
            [11, -11],
            [-11, 11],
            [-11, -11]
        ].forEach(([cx, cz]) => registerCollider(cx, cz, 0.9, 0.9, 5.0, 9.0));



















        createVaultedRoof(0, VAULT_CENTER_OFFSET, VAULT_LENGTH, 'N', false, 1, 0, Math.PI, Math.PI, true);
        createVaultedRoof(0, -VAULT_CENTER_OFFSET, VAULT_LENGTH, 'S', false, -1, 0, 0, Math.PI);
        createVaultedRoof(VAULT_CENTER_OFFSET, 0, VAULT_LENGTH, 'O', true, 1, 0, Math.PI, Math.PI);
        createVaultedRoof(-VAULT_CENTER_OFFSET, 0, VAULT_LENGTH, 'E', true, -1, 0, 0, Math.PI);
        // Cierre de paños en uniones cúpula-brazos (evita huecos visibles en vista aérea).
        const addRoofJunctionPanels = () => {
            const panelMat = roofGlassMat;
            const panelY = UPPER_MALL_ROOF_Y + 6.8;
            const panelW = 18.0;
            const panelD = 13.5;
            const panelConfigs = [
                { x: 18.5, z: 18.5, rotY: Math.PI / 4 },
                { x: -18.5, z: 18.5, rotY: -Math.PI / 4 },
                { x: 18.5, z: -18.5, rotY: -Math.PI / 4 },
                { x: -18.5, z: -18.5, rotY: Math.PI / 4 }
            ];
            panelConfigs.forEach((cfg) => {
                const panel = new THREE.Mesh(new THREE.PlaneGeometry(panelW, panelD), panelMat);
                panel.rotation.x = -Math.PI / 2;
                panel.rotation.z = cfg.rotY;
                panel.position.set(cfg.x, panelY, cfg.z);
                scene.add(panel);
                roofGlassMeshes.push(panel);
            });
        };
        addRoofJunctionPanels();

        const centralDome = new THREE.Mesh(new THREE.SphereGeometry(CENTRAL_DOME_RADIUS, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), roofGlassMat);
        centralDome.position.set(0, DOME_CENTER_Y, 0); scene.add(centralDome);
        roofGlassMeshes.push(centralDome);
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

        // (Luces puntuales extra removidas para mantener rendimiento de carga estable)

        // Modo nocturno liviano (sin luces dinámicas adicionales): solo materiales + luces globales.
        const currentHour = new Date().getHours();
        const isNightMode = currentHour >= 19 || currentHour < 7;
        if (isNightMode) {
            roofGlassMat.color.setHex(0xf4f7fb);
            roofGlassMat.opacity = 0.46;
            roofGlassMat.transmission = 0.68;
            glassMat.color.setHex(0x9bb7de);
            glassMat.opacity = 0.58;
            glassMat.transmission = 0.18;
            darkMat.color.setHex(DARK_METAL_NIGHT);
            darkMat.roughness = 0.2;
            darkMat.metalness = 0.65;
            ambientLight.intensity = 1.7;
            hemisphereLight.intensity = 2.0;
            sun.intensity = 1.6;
        } else {
            roofGlassMat.color.setHex(0xf4f7fb);
            roofGlassMat.opacity = 0.46;
            roofGlassMat.transmission = 0.68;
            glassMat.color.setHex(0xffffff);
            glassMat.opacity = 0.7;
            glassMat.transmission = 0.3;
            darkMat.color.setHex(DARK_METAL_DAY);
            darkMat.roughness = 0.1;
            darkMat.metalness = 0.5;
            ambientLight.intensity = 2.0;
            hemisphereLight.intensity = 2.5;
            sun.intensity = 3.0;
        }
        roofGlassMat.needsUpdate = true;
        glassMat.needsUpdate = true;
        darkMat.needsUpdate = true;
        roofGlassMeshes.forEach((mesh) => { if (mesh?.material) mesh.material.needsUpdate = true; });


