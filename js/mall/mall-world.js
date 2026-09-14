        // --- CENTRAL STRUCTURE PARAMETERS ---
        const VAULT_RADIUS = 17;
        const VAULT_LENGTH = 78;
        const VAULT_CENTER_OFFSET = 56.5;
        const DOME_CENTER_Y = 25.5; // Elevado para mayor lujo y espacio
        const CENTRAL_DOME_RADIUS = 28.0;
        const UPPER_MALL_ROOF_Y = 10.2;
        const LONGITUDINAL_BEAM_LEVELS = [-16, -13, -10, -7, -4, 0, 4, 7, 10, 13, 16]; // Añadido el 0 para el cenit
        const RING_FAMILY_LEVELS = [0, 4, 7, 10, 13, 16];
        const overheadStructureAuditRegistry = [];

        function registerOverheadStructure(group, metadata) {
            const entry = { group, ...metadata };
            group.userData.structuralAudit = entry;
            overheadStructureAuditRegistry.push(entry);
            return entry;
        }

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
            // Norte es el molde canónico; O rota 90°, S 180° y E -90°.
            return (wingLabel === 'N' || wingLabel === 'O') ? 2 : -2;
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
            const ribOffset = getVaultRibOffset(wingLabel);
            for (let i = -l / 2; i <= l / 2; i += 4) {
                const rib = new THREE.Mesh(new THREE.TorusGeometry(r, 0.10, 16, 64, Math.PI), darkMat);
                const zPos = i + ribOffset;
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
            const zOffset = getVaultRibOffset(wingLabel);
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

        function addQuarterSphereEndClosure(group, r, l, wingLabel) {
            const closure = new THREE.Group();
            const innerSign = getVaultInnerSign(wingLabel);
            const zStart = -innerSign * (l / 2) + getVaultRibOffset(wingLabel);
            const outwardSign = -innerSign;
            const anchorRoofY = UPPER_MALL_ROOF_Y - DOME_CENTER_Y;
            const closureDepth = 10;
            const baseScale = 0.78;
            // Cada costilla continúa una viga longitudinal existente. Reutilizar
            // estos niveles evita barras faltantes, extras o desalineadas.
            const ribLevels = LONGITUDINAL_BEAM_LEVELS;
            const ringRatios = [0.25, 0.5, 0.75, 1];
            closure.position.z = zStart;
            closure.name = `Cierre cuarto de esfera - Bóveda ${wingLabel}`;
            closure.userData.isVaultEndClosure = true;

            const pointOnClosure = (level, ratio) => {
                const archAngle = (level / r) * (Math.PI / 2);
                const topX = Math.sin(archAngle) * r;
                const topY = Math.cos(archAngle) * r;
                const quarterAngle = ratio * (Math.PI / 2);
                const taper = 1 - (1 - baseScale) * Math.sin(quarterAngle);
                return new THREE.Vector3(
                    topX * taper,
                    anchorRoofY + (topY - anchorRoofY) * Math.cos(quarterAngle),
                    outwardSign * closureDepth * Math.sin(quarterAngle)
                );
            };

            const addConnector = (start, end, name) => {
                const direction = end.clone().sub(start);
                const length = direction.length();
                if (length <= 0.0001) return;
                const connector = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, length), darkMat);
                connector.position.copy(start).add(end).multiplyScalar(0.5);
                connector.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.normalize());
                connector.name = name;
                closure.add(connector);
            };

            // Las costillas prolongan uno a uno los fierros de la bóveda; los tres
            // anillos ordenan el cierre sin formar una malla excesivamente densa.
            const ribCurves = ribLevels.map((level) => {
                const points = Array.from({ length: 25 }, (_, index) => pointOnClosure(level, index / 24));
                const curve = new THREE.CatmullRomCurve3(points);
                const rib = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.10, 8, false), darkMat);
                rib.name = `Costilla cierre ${wingLabel} ${level}`;
                closure.add(rib);
                return curve;
            });

            ringRatios.forEach((ratio, ringIndex) => {
                for (let index = 0; index < ribCurves.length - 1; index += 1) {
                    addConnector(
                        ribCurves[index].getPoint(ratio),
                        ribCurves[index + 1].getPoint(ratio),
                        ringIndex === ringRatios.length - 1
                            ? `Viga de entrega cierre ${wingLabel}`
                            : `Anillo cierre ${wingLabel} ${ringIndex + 1}`
                    );
                }
            });

            const addLateralClosure = (side) => {
                const edgeLevel = side * 16;
                const outerPoint = (ratio) => {
                    const quarterAngle = ratio * (Math.PI / 2);
                    return new THREE.Vector3(
                        side * r,
                        anchorRoofY * Math.sin(quarterAngle),
                        outwardSign * closureDepth * Math.sin(quarterAngle)
                    );
                };
                const innerPoint = (ratio) => pointOnClosure(edgeLevel, ratio);
                const segments = 6;
                const vertices = [];
                const indices = [];

                for (let index = 0; index <= segments; index += 1) {
                    const ratio = index / segments;
                    const inner = innerPoint(ratio);
                    const outer = outerPoint(ratio);
                    vertices.push(inner.x, inner.y, inner.z, outer.x, outer.y, outer.z);
                }
                for (let index = 0; index < segments; index += 1) {
                    const a = index * 2;
                    const b = a + 1;
                    const c = a + 2;
                    const d = a + 3;
                    if (side > 0) {
                        indices.push(a, b, c, b, d, c);
                    } else {
                        indices.push(a, c, b, b, c, d);
                    }
                }

                // El vidrio contiene el vacío lateral sin bloquear la luz ni la vista.
                const paneGeometry = new THREE.BufferGeometry();
                paneGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                paneGeometry.setIndex(indices);
                paneGeometry.computeVertexNormals();
                roofGlassMat.side = THREE.DoubleSide;
                roofGlassMat.needsUpdate = true;
                const pane = new THREE.Mesh(paneGeometry, roofGlassMat);
                pane.name = `Vidrio lateral cierre ${wingLabel} ${side > 0 ? 'D' : 'I'}`;
                closure.add(pane);
                roofGlassMeshes.push(pane);

                // Tres montantes curvos y cuatro travesaños hacen legible la unión,
                // manteniendo el borde de la bóveda como referencia estructural.
                [0.35, 0.7, 1].forEach((lateralRatio, railIndex) => {
                    const points = Array.from({ length: 25 }, (_, index) => {
                        const ratio = index / 24;
                        return innerPoint(ratio).lerp(outerPoint(ratio), lateralRatio);
                    });
                    const rail = new THREE.Mesh(
                        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.08, 8, false),
                        darkMat
                    );
                    rail.name = `Montante lateral cierre ${wingLabel} ${side > 0 ? 'D' : 'I'} ${railIndex + 1}`;
                    closure.add(rail);
                });
                ringRatios.forEach((ratio, ringIndex) => {
                    addConnector(
                        innerPoint(ratio),
                        outerPoint(ratio),
                        `Travesaño lateral cierre ${wingLabel} ${side > 0 ? 'D' : 'I'} ${ringIndex + 1}`
                    );
                });
            };

            [1, -1].forEach(addLateralClosure);

            group.add(closure);
        }

        function createVaultedRoof(x, z, length, wingLabel, rot = false) {
            const vaultG = new THREE.Group(); vaultG.position.set(x, DOME_CENTER_Y, z);
            if (rot) vaultG.rotation.y = Math.PI / 2;
            // Cada brazo calcula su propia cara interna; S y O son el reflejo geométrico de N y E.
            const geometryWing = wingLabel;
            const sourceInnerSign = getVaultInnerSign(geometryWing);
            const intendedInnerSign = getVaultInnerSign(wingLabel);
            const sourceJoint = getVaultInnerEdgeForLevel(0, VAULT_RADIUS, sourceInnerSign);
            const intendedJoint = getVaultInnerEdgeForLevel(0, VAULT_RADIUS, intendedInnerSign);
            const connectionProfileLocal = LONGITUDINAL_BEAM_LEVELS.map((level) => {
                const joint = getVaultInnerEdgeForLevel(level, VAULT_RADIUS, sourceInnerSign);
                return [joint.xOut, joint.innerY, joint.innerZ];
            });
            const capProfileLocal = LONGITUDINAL_BEAM_LEVELS.map((level) => {
                const edge = getVaultInnerEdgeForLevel(level, VAULT_RADIUS, sourceInnerSign);
                return [edge.xOut, edge.yOut, -sourceInnerSign * (length / 2) + getVaultRibOffset(geometryWing)];
            });
            vaultG.name = `Estructura superior - Bóveda ${wingLabel}`;
            addArchitecturalShell(vaultG, VAULT_RADIUS, length, geometryWing);
            addTransverseRibs(vaultG, VAULT_RADIUS, length, geometryWing);
            addLowerLateralBracing(vaultG, VAULT_RADIUS, length, geometryWing);
            addLongitudinalGirders(vaultG, VAULT_RADIUS, length, geometryWing);
            addQuarterSphereEndClosure(vaultG, VAULT_RADIUS, length, geometryWing);
            scene.add(vaultG);
            registerOverheadStructure(vaultG, {
                id: `vault-${wingLabel.toLowerCase()}`,
                label: `Bóveda ${wingLabel}`,
                kind: 'vault',
                wingLabel,
                symmetricSource: geometryWing,
                symmetryAxis: rot ? 'x' : 'z',
                sourceInnerSign,
                intendedInnerSign,
                sourceRibOffset: getVaultRibOffset(geometryWing),
                intendedRibOffset: getVaultRibOffset(wingLabel),
                sourceJointLocal: [sourceJoint.xOut, sourceJoint.innerY, sourceJoint.innerZ],
                intendedJointLocal: [intendedJoint.xOut, intendedJoint.innerY, intendedJoint.innerZ],
                connectionProfileLocal,
                capProfileLocal,
                shellOuterLocalZ: -sourceInnerSign * (length / 2) + getVaultRibOffset(geometryWing),
                capAnchorLocalZ: -intendedInnerSign * (length / 2) + getVaultRibOffset(wingLabel),
                length
            });
            return vaultG;
        }

        const escalatorList = [];
        const escalatorVisualMaterials = [];
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
        const BOUTIQUE_FACADE_LOAD_DISTANCE = IS_COARSE_POINTER ? 40 : 40;
        const BOUTIQUE_FACADE_VISIBLE_NEAR_DISTANCE = IS_COARSE_POINTER ? 10 : 10;
        const BOUTIQUE_FACADE_VISIBLE_FAR_DISTANCE = IS_COARSE_POINTER ? 35 : 35;
        const BOUTIQUE_FACADE_FADE_SMOOTHING = 0.18;
        const BOUTIQUE_DETAIL_FADE_EPSILON = 0.02;
        const BOUTIQUE_DETAIL_STREAM_BUILD_THRESHOLD = 0.01;
        const BOUTIQUE_DETAIL_FADE_SMOOTHING = 0.14;
        const ANCHOR_DETAIL_NEAR_DISTANCE = IS_COARSE_POINTER ? 42 : 56;
        const ANCHOR_DETAIL_FAR_DISTANCE = IS_COARSE_POINTER ? 58 : 76;
        const ANCHOR_DETAIL_STREAM_BUILD_THRESHOLD = 0.01;
        const ANCHOR_DETAIL_FADE_SMOOTHING = 0.12;
        // Aprovecha el paño superior de 1.20 m sin invadir su perfilería.
        const BOUTIQUE_SIGN_WIDTH = 5.7;
        const BOUTIQUE_SIGN_HEIGHT = 1.06;
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

        function setBoutiqueLogoFade(shop, fade) {
            const sign = shop?.children?.find(c => c.userData?.isLogoBanner);
            if (!sign || !sign.material) return;
            const logoReady = Boolean(sign.userData?.logoLoaded);
            sign.visible = logoReady && fade > BOUTIQUE_DETAIL_FADE_EPSILON;
            if (!sign.visible) return;
            sign.material.transparent = true;
            sign.material.opacity = fade;
            sign.material.needsUpdate = true;
        }

        function getBoutiqueInteriorFade(distance) {
            const range = Math.max(0.001, BOUTIQUE_DETAIL_FAR_DISTANCE - BOUTIQUE_DETAIL_NEAR_DISTANCE);
            const t = THREE.MathUtils.clamp((BOUTIQUE_DETAIL_FAR_DISTANCE - distance) / range, 0, 1);
            return t * t * (3 - 2 * t);
        }

        function getBoutiqueFacadeFade(distance) {
            const range = Math.max(0.001, BOUTIQUE_FACADE_VISIBLE_FAR_DISTANCE - BOUTIQUE_FACADE_VISIBLE_NEAR_DISTANCE);
            const t = THREE.MathUtils.clamp((BOUTIQUE_FACADE_VISIBLE_FAR_DISTANCE - distance) / range, 0, 1);
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
                const idM = new THREE.Mesh(getMallPlaneGeometry(15, 15), new THREE.MeshBasicMaterial({ map: idTex, transparent: true }));
                idM.userData.isSign = true; idM.userData.isAnchorSign = true; idM.userData.shopCode = idLetter;
                idM.position.set(0, height + 0.1, -14); idM.rotation.x = -Math.PI / 2; g.add(idM);

            }

            const m = (w, h, d, x, y, z, mat) => { const mw = new THREE.Mesh(getMallBoxGeometry(w, h, d), mat); mw.position.set(x, y, z); g.add(mw); };
            const anchorSlabTopY = 5.4;
            const anchorSlabThickness = 0.6;
            const anchorFloorMat = new THREE.MeshStandardMaterial({ color: 0xc8c8c2, roughness: 0.48, metalness: 0.02 });
            const anchorStripeMat = new THREE.MeshStandardMaterial({ color: 0x332211, roughness: 0.42, metalness: 0.08 });
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
            const facadeStoneMat = new THREE.MeshStandardMaterial({ color: 0xd8d0c4, roughness: 0.62, metalness: 0.02 });
            const facadeMetalMat = new THREE.MeshStandardMaterial({ color: 0x2c2b2a, roughness: 0.32, metalness: 0.72 });
            const facadeChampagneMat = new THREE.MeshStandardMaterial({ color: 0xb8945b, roughness: 0.3, metalness: 0.78 });
            const facadeGlassMat = new THREE.MeshPhysicalMaterial({ color: 0xdcecff, transmission: 0.62, transparent: true, opacity: 0.32, metalness: 0.02, roughness: 0.14, clearcoat: 0.24, clearcoatRoughness: 0.2 });
            const createFacadePlane = (w, h, x, y, z, texture, opacity = 1) => {
                const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, opacity });
                const plane = new THREE.Mesh(getMallPlaneGeometry(w, h), mat);
                plane.position.set(x, y, z);
                g.add(plane);
                return plane;
            };
            const addFacadeDisplayBay = (centerX, wallZ, outwardDir, bayWidth = 9.6, bayHeight = 7.0) => {
                const centerZ = wallZ + outwardDir * 0.32;
                m(bayWidth + 0.5, bayHeight + 0.4, 0.26, centerX, bayHeight / 2 + 0.2, centerZ, facadeMetalMat);
                m(bayWidth, bayHeight, 0.08, centerX, bayHeight / 2 + 0.2, centerZ + outwardDir * 0.07, facadeGlassMat);
                m(bayWidth, 0.12, 0.22, centerX, bayHeight + 0.42, centerZ, facadeChampagneMat);
                m(bayWidth, 0.08, 0.18, centerX, 0.12, centerZ, facadeChampagneMat);
            };
            const addAnchorFacadeIdentity = (wallZ, outwardDir, labelText, variant = 'atrium') => {
                const isBoulevard = variant === 'boulevard';
                const panelWidth = isBoulevard ? 23 : 19;
                const signCenterY = isBoulevard ? height - 2.2 : height - 2.0;
                const panelZ = wallZ + outwardDir * (isBoulevard ? 0.58 : 0.4);
                const marqueeDepth = isBoulevard ? 0.52 : 0.4;
                addFacadeDisplayBay(-18.5, wallZ, outwardDir, 10.2, isBoulevard ? 7.4 : 6.8);
                addFacadeDisplayBay(18.5, wallZ, outwardDir, 10.2, isBoulevard ? 7.4 : 6.8);

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

                const identitySign = createFacadePlane(panelWidth - 1.25, 1.78, 0, signCenterY + 0.04, panelZ + outwardDir * 0.22, createSignTexture(labelText, false, 'anchor'), 1);
                identitySign.renderOrder = 38;
                identitySign.material.toneMapped = false;
            };
            const ensureDetailedInterior = () => {
                if (g.userData.detailedInteriorBuilt) return;
                const addDetail = (w, h, d, x, y, z, mat, parent = detailedInterior) => {
                const mesh = new THREE.Mesh(getMallBoxGeometry(w, h, d), mat);
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
                const displayMat = new THREE.MeshStandardMaterial({ color: 0xf3eee4, roughness: 0.48, metalness: 0.03 });
                const baseMat = new THREE.MeshStandardMaterial({ color: 0xefe8dc, roughness: 0.52, metalness: 0.02 });
                const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b6b43, roughness: 0.56, metalness: 0.08 });
                const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x4a3421, roughness: 0.58, metalness: 0.06 });
                const metalMat = new THREE.MeshStandardMaterial({ color: 0x565a60, roughness: 0.32, metalness: 0.78 });
                const accentShelfMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.38, metalness: 0.14 });
                const planterMat = new THREE.MeshStandardMaterial({ color: 0xd7d0c1, roughness: 0.62, metalness: 0.04 });
                const leafMat = new THREE.MeshStandardMaterial({ color: 0x6f9a63, roughness: 0.88, metalness: 0.0 });
                const railGlassMat = new THREE.MeshPhysicalMaterial({ color: 0xdcecff, transmission: 0.66, transparent: true, opacity: 0.3, roughness: 0.14, metalness: 0.02, clearcoat: 0.24, clearcoatRoughness: 0.18 });

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
                    window.setMallShadowMode?.(planter, { cast: true, receive: true });
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
                    window.setMallShadowMode?.(island, { cast: true, receive: true });
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
                    window.setMallShadowMode?.(shelf, { cast: true, receive: true });
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
                    window.setMallShadowMode?.(cashier, { cast: true, receive: true });
                    detailedInterior.add(cashier);
                    registerObjectColliderFromBounds(cashier, { paddingX: 0.08, paddingZ: 0.08 });
                };

                const createUpperLounge = (x, z) => {
                    const lounge = new THREE.Group();
                    addDetail(4.4, 0.48, 1.12, x, anchorSlabTopY + 0.24, z, baseMat, lounge);
                    addDetail(1.75, 0.58, 0.42, x - 1.08, anchorSlabTopY + 0.66, z - 0.3, accentShelfMat, lounge);
                    addDetail(1.75, 0.58, 0.42, x + 1.08, anchorSlabTopY + 0.66, z + 0.3, accentShelfMat, lounge);
                    addDetail(0.9, 0.32, 0.9, x, anchorSlabTopY + 0.18, z + 1.45, darkWoodMat, lounge);
                    window.setMallShadowMode?.(lounge, { cast: true, receive: true });
                    detailedInterior.add(lounge);
                    registerObjectColliderFromBounds(lounge, { paddingX: 0.08, paddingZ: 0.08 });
                };

                const createPerimeterGlass = (x, z, widthSize, depthSize, y) => {
                    const rail = new THREE.Mesh(new THREE.BoxGeometry(widthSize, 1.0, depthSize), railGlassMat);
                    rail.position.set(x, y, z);
                    detailedInterior.add(rail);
                };

                // El eje central conecta ambas entradas y las escaleras; debe
                // permanecer libre de mostradores y mobiliario fijo.
                createDisplayIsland(-11.5, -1.8, 1.08, 1.0);
                createDisplayIsland(11.5, -1.8, 1.08, 1.0);
                createDisplayIsland(0, -7.0, 1.15, 1.0);
                createDisplayIsland(-11.0, -13.0, 0.92, 1.0);
                createDisplayIsland(11.0, -13.0, 0.92, 1.0);
                createWallShelves(-width / 2 + 2.4, -7.5, 14.0, Math.PI / 2);
                createWallShelves(width / 2 - 2.4, -7.5, 14.0, -Math.PI / 2);
                // No instalar estanterias frente al acceso posterior (z=-25).
                createPlanter(-width / 2 + 4.8, 0, 4.8, 1.05);
                createPlanter(width / 2 - 4.8, 0, 4.8, 1.05);
                createPlanter(-7.8, 0, -18.4, 0.95);
                createPlanter(7.8, 0, -18.4, 0.95);

                // Segundo piso libre de lounges: el acceso completo queda
                // disponible para el flujo hacia y desde la tienda ancla.
                createDisplayIsland(-11.5, -15.4, 0.95, 0.92);
                createDisplayIsland(11.5, -15.4, 0.95, 0.92);
                createWallShelves(-width / 2 + 2.6, -7.4, 11.5, Math.PI / 2);
                createWallShelves(width / 2 - 2.6, -7.4, 11.5, -Math.PI / 2);
                createPerimeterGlass(-14.5, -10, 0.12, 10.5, anchorSlabTopY + 0.55);
                createPerimeterGlass(14.5, -10, 0.12, 10.5, anchorSlabTopY + 0.55);

                prepareGroupForDistanceFade(detailedInterior);
                g.userData.detailedInteriorBuilt = true;
            };
            const disposeDetailedInterior = () => {
                if (!g.userData.detailedInteriorBuilt) return;
                detailedInterior.traverse((object) => {
                    if (!object.geometry?.userData?.mallSharedGeometry) object.geometry?.dispose?.();
                    const materials = Array.isArray(object.material) ? object.material : [object.material];
                    materials.filter(Boolean).forEach((material) => material.dispose?.());
                });
                detailedInterior.clear();
                g.userData.detailedInteriorBuilt = false;
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
                    metalness: 0.02,
                    roughness: 0.14,
                    clearcoat: 0.22,
                    clearcoatRoughness: 0.18
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
                        const line = new THREE.Mesh(getMallPlaneGeometry(0.04, d), anchorStripeMat);
                        line.rotation.x = -Math.PI / 2;
                        line.position.set(xPos, lineY, z);
                        g.add(line);
                    });
                }
                for (let j = -d / 2; j <= d / 2 + 0.1; j += step) {
                    [0, gap].forEach((off) => {
                        const zPos = j + off;
                        if (zPos < -d / 2 - 0.1 || zPos > d / 2 + 0.1) return;
                        const line = new THREE.Mesh(getMallPlaneGeometry(w, 0.04), anchorStripeMat);
                        line.rotation.x = -Math.PI / 2;
                        line.position.set(0, lineY, z + zPos);
                        g.add(line);
                    });
                }
            };
            const addAnchorGateway = (wallZ, outwardDir) => {
                const portalDepth = 2.6;
                const portalCenterZ = wallZ + outwardDir * (portalDepth / 2 - 0.2);
                const sideReturnZ = wallZ + outwardDir * 0.75;
                const thresholdZ = wallZ + outwardDir * 1.1;
                const facadeMat = darkMat;

                // Umbral y piso de acceso para dar presencia de gran tienda.
                m(anchorEntryWidth + 2.4, 0.08, 2.6, 0, 0.05, thresholdZ, anchorFloorMat);
                drawAnchorFloorWithGrid(anchorEntryWidth + 1.8, 2.2, 0.09, thresholdZ);

                // Pilastras laterales del portal. La antigua marquesina
                // horizontal coincidia con la cota del segundo piso y se
                // comportaba visualmente como una tarima que bloqueaba el paso.
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
                const stepFlowDirection = up ? 1 : -1;
                const stepMat = createEscalatorStepVisualMaterial(stepFlowDirection, Math.max(10, Math.round(diagRunLen * 1.15)), up);
                const landingStepMat = createEscalatorStepVisualMaterial(stepFlowDirection, Math.max(6, Math.round(landingLen * 3.2)), up);

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

                const tread = new THREE.Mesh(new THREE.BoxGeometry(escWidth - 0.72, 0.055, bodyLen - 0.08), stepMat);
                tread.position.set(0, rise / 2 + 0.72, diagonalCenter);
                tread.rotation.x = -pitch;
                tread.renderOrder = 40;
                esc.add(tread);

                const lowerComb = new THREE.Mesh(new THREE.BoxGeometry(escWidth - 0.34, 0.06, 0.34), trimMat);
                lowerComb.position.set(0, 0.34, landingLen - 0.18);
                esc.add(lowerComb);

                const upperComb = new THREE.Mesh(new THREE.BoxGeometry(escWidth - 0.34, 0.06, 0.34), trimMat);
                upperComb.position.set(0, rise + 0.34, runLen - landingLen + 0.18);
                esc.add(upperComb);

                const lowerSkirt = new THREE.Mesh(new THREE.BoxGeometry(escWidth - 0.45, 0.08, landingLen - 0.18), landingStepMat);
                lowerSkirt.position.set(0, 0.48, lowerLandingCenter);
                lowerSkirt.renderOrder = 40;
                esc.add(lowerSkirt);

                const upperSkirt = new THREE.Mesh(new THREE.BoxGeometry(escWidth - 0.45, 0.08, landingLen - 0.18), landingStepMat);
                upperSkirt.position.set(0, rise + 0.48, upperLandingCenter);
                upperSkirt.renderOrder = 40;
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
            g.userData.ensureDetailedInterior = ensureDetailedInterior;
            g.userData.disposeDetailedInterior = disposeDetailedInterior;
            g.userData.detailedInteriorGroup = detailedInterior;
            g.userData.interiorDetailFade = 0;
            g.userData.interiorDetailVisible = false;
            registerInteriorFogZone(g, -width / 2 + 0.35, width / 2 - 0.35, -24.7, 8.9, 0.05, height - 0.05);
            return g;
        }
        // --- TIENDAS ANCLA (RESTAURACIÓN ESTRUCTURAL CON SALIDAS) ---
        const sAnchor = createAnchorStore(0, -100, 70, 15, "SUR", "S", 0);
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

        function registerAnchorShellColliders(anchor, anchorCode) {
            const rotation = anchor.rotation.y;
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            const addLocal = (localX, localZ, width, depth, minY, maxY, suffix) => {
                const worldX = anchor.position.x + localX * cos + localZ * sin;
                const worldZ = anchor.position.z - localX * sin + localZ * cos;
                const worldWidth = Math.abs(width * cos) + Math.abs(depth * sin);
                const worldDepth = Math.abs(width * sin) + Math.abs(depth * cos);
                registerCollider(worldX, worldZ, worldWidth, worldDepth, minY, maxY, `anchor:${anchorCode}:${suffix}`);
            };

            // Cerramientos visibles, conservando las aperturas centrales de acceso.
            addLocal(-20.5, 9.05, 29, 0.45, 0, 5.4, 'atrium-lower-left');
            addLocal(20.5, 9.05, 29, 0.45, 0, 5.4, 'atrium-lower-right');
            addLocal(-20.5, 4.88, 29, 0.45, 5.4, 15, 'atrium-upper-left');
            addLocal(20.5, 4.88, 29, 0.45, 5.4, 15, 'atrium-upper-right');
            addLocal(-33.4, 7.05, 3.2, 4.2, 0, 5.4, 'atrium-corner-left');
            addLocal(33.4, 7.05, 3.2, 4.2, 0, 5.4, 'atrium-corner-right');
            addLocal(-35, -10, 0.45, 30, 0, 15, 'side-left');
            addLocal(35, -10, 0.45, 30, 0, 15, 'side-right');
        }
        registerAnchorShellColliders(sAnchor, 'S');

        const nAnchor = createAnchorStore(0, 100, 70, 15, "NORTE", "N", Math.PI);
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
        registerAnchorShellColliders(nAnchor, 'N');

        const eastAnchor = createAnchorStore(-100, 0, 70, 15, "ESTE", "E", Math.PI / 2);
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
        registerAnchorShellColliders(eastAnchor, 'E');

        const westAnchor = createAnchorStore(100, 0, 70, 15, "OESTE", "O", -Math.PI / 2);
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
        registerAnchorShellColliders(westAnchor, 'O');

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
                metalness: 0.02,
                roughness: 0.14,
                clearcoat: 0.22,
                clearcoatRoughness: 0.18
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

        function createFirstFloorEntranceSigns() {
            const signTexture = createDoorLabelTexture('Entrada');
            const panelMaterial = new THREE.MeshStandardMaterial({
                color: 0x111111,
                roughness: 0.3,
                metalness: 0.72
            });
            const trimMaterial = new THREE.MeshStandardMaterial({
                color: 0xb8944e,
                roughness: 0.24,
                metalness: 0.86
            });

            FIRST_FLOOR_LATERAL_ENTRANCES.forEach((entrance, index) => {
                const [x, y, z] = entrance.signPosition || entrance.position;
                const sign = new THREE.Group();
                sign.name = `firstFloorEntranceSign-${index + 1}`;
                sign.position.set(x, y, z);
                sign.rotation.y = entrance.signRotationY;

                const panel = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.92, 0.16), panelMaterial);
                sign.add(panel);

                const topTrim = new THREE.Mesh(new THREE.BoxGeometry(5.08, 0.07, 0.2), trimMaterial);
                topTrim.position.y = 0.495;
                sign.add(topTrim);
                const bottomTrim = topTrim.clone();
                bottomTrim.position.y = -0.495;
                sign.add(bottomTrim);

                [-0.091, 0.091].forEach((faceZ, faceIndex) => {
                    const face = new THREE.Mesh(
                        new THREE.PlaneGeometry(4.55, 0.68),
                        new THREE.MeshBasicMaterial({
                            map: signTexture,
                            transparent: true,
                            depthWrite: false,
                            toneMapped: false
                        })
                    );
                    face.position.z = faceZ;
                    if (faceIndex === 0) face.rotation.y = Math.PI;
                    face.renderOrder = 14;
                    sign.add(face);
                });

                scene.add(sign);
            });
        }

        createAllSideCorridorAccessDoors();
        createFirstFloorEntranceSigns();

        // --- ANEXO: BOULEVARD & FOOD COURT (ALA NORTE RE-VINCULADA) ---
        function createBoulevardArea() {
            const bX = 0, bZ = 170;
            // 1. Suelo del Boulevard (Terracota)
            const floorGeo = new THREE.PlaneGeometry(120, 90);
            const floorMat = new THREE.MeshStandardMaterial({ color: 0xd2691e, roughness: 0.8 });
            const floor = new THREE.Mesh(floorGeo, floorMat);
            floor.rotation.x = -Math.PI / 2; floor.position.set(bX, 0, bZ); scene.add(floor);

            // Conector con el Mall (Ajustado para atravesar la tienda norte)
            const conn = new THREE.Mesh(new THREE.PlaneGeometry(20, 30), floorMat);
            conn.rotation.x = -Math.PI / 2; conn.position.set(0, 0, 110); scene.add(conn);

            // Laberinto de referencia con modulos de 2 m, muros fisicos de 2.5 m y techo opaco.
            const createBoulevardMaze = () => {
                const columns = 17;
                const rows = 18;
                const cellSize = 2;
                // +X es oeste y +Z es norte en la referencia del mall.
                const mazeCenter = { x: -37, z: 179 };
                const wallHeight = 2.5;
                const mazeDrawY = wallHeight / 2;
                const markerY = 0.19;
                const lineHeight = wallHeight;
                const lineThickness = 0.065;
                const roofThickness = 0.12;
                const maze = new THREE.Group();
                maze.name = 'Laberinto de referencia 2.5m - Boulevard Norte';
                maze.position.set(mazeCenter.x, 0, mazeCenter.z);
                maze.userData = {
                    isParkingMaze: true,
                    cellSize,
                    cellsWide: columns,
                    cellsDeep: rows,
                    metersWide: columns * cellSize,
                    metersDeep: rows * cellSize,
                    floor: 1,
                    wallHeight,
                    future3DConversion: 'complete',
                    collisions: true,
                    pattern: 'user-reference',
                    visualStage: 2,
                    decorationIsNonCollidable: true,
                    routeSignageStage: 3,
                    wayfindingIsNonCollidable: true
                };

                const createMazeSurfaceTexture = (kind, baseColor, variance, repeatX, repeatY) => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 96;
                    canvas.height = 96;
                    const context = canvas.getContext('2d');
                    if (!context) return null;

                    const imageData = context.createImageData(canvas.width, canvas.height);
                    let seed = kind.length * 2654435761;
                    for (let i = 0; i < imageData.data.length; i += 4) {
                        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                        const noise = ((seed >>> 24) / 255 - 0.5) * variance;
                        imageData.data[i] = Math.max(0, Math.min(255, Math.round(baseColor[0] + noise)));
                        imageData.data[i + 1] = Math.max(0, Math.min(255, Math.round(baseColor[1] + noise)));
                        imageData.data[i + 2] = Math.max(0, Math.min(255, Math.round(baseColor[2] + noise)));
                        imageData.data[i + 3] = 255;
                    }
                    context.putImageData(imageData, 0, 0);

                    // Variaciones grandes y discretas rompen la repetición del ruido de píxel.
                    context.globalAlpha = 0.09;
                    context.fillStyle = kind === 'floor' ? '#fff1d0' : '#ffffff';
                    for (let i = 0; i < (kind === 'floor' ? 30 : 12); i++) {
                        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                        const x = (seed % 96) + 0.5;
                        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                        const y = (seed % 96) + 0.5;
                        const size = kind === 'floor' ? 1 + (seed % 3) : 3 + (seed % 7);
                        context.fillRect(x, y, size, kind === 'wall' ? 1 : size * 0.55);
                    }
                    context.globalAlpha = 1;

                    if (kind === 'roof') {
                        context.strokeStyle = 'rgba(70, 58, 46, 0.14)';
                        context.lineWidth = 1;
                        for (let y = 15; y < 96; y += 24) {
                            context.beginPath();
                            context.moveTo(0, y + 0.5);
                            context.lineTo(96, y + 0.5);
                            context.stroke();
                        }
                    }

                    const texture = new THREE.CanvasTexture(canvas);
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.repeat.set(repeatX, repeatY);
                    if ('SRGBColorSpace' in THREE) texture.colorSpace = THREE.SRGBColorSpace;
                    texture.needsUpdate = true;
                    return texture;
                };

                const wallTexture = createMazeSurfaceTexture('wall', [129, 117, 104], 10, 2.4, 1.6);
                const floorTexture = createMazeSurfaceTexture('floor', [202, 178, 138], 12, 8, 8);
                const roofTexture = createMazeSurfaceTexture('roof', [169, 155, 136], 7, 4, 4);

                const wallMat = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    map: wallTexture,
                    bumpMap: wallTexture,
                    bumpScale: 0.018,
                    roughness: 0.78,
                    metalness: 0.04
                });
                const roofMat = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    map: roofTexture,
                    bumpMap: roofTexture,
                    bumpScale: 0.008,
                    roughness: 0.88,
                    metalness: 0.02,
                    emissive: 0x211b15,
                    emissiveIntensity: 0.32
                });
                const wallGuideMat = new THREE.MeshStandardMaterial({
                    color: 0xc8a866,
                    roughness: 0.44,
                    metalness: 0.28,
                    emissive: 0x4a2c10,
                    emissiveIntensity: 0.42
                });
                const floorGuideMat = new THREE.MeshStandardMaterial({
                    color: 0xd6b873,
                    roughness: 0.38,
                    metalness: 0.16,
                    emissive: 0x4d2b0c,
                    emissiveIntensity: 0.34
                });
                const startMat = new THREE.MeshStandardMaterial({
                    color: 0x55c58a,
                    roughness: 0.36,
                    metalness: 0.08,
                    emissive: 0x1e8b55,
                    emissiveIntensity: 0.5
                });
                const finishMat = new THREE.MeshStandardMaterial({
                    color: 0xe27258,
                    roughness: 0.36,
                    metalness: 0.08,
                    emissive: 0x8d2419,
                    emissiveIntensity: 0.46
                });
                const ceilingFixtureMat = new THREE.MeshBasicMaterial({
                    color: 0xffe5b3,
                    toneMapped: false
                });
                // Cada caracter representa un segmento de muro de la imagen:
                // # = muro, . = paso. Se conserva la abertura de entrada y salida.
                const horizontalWalls = [
                    '#################',
                    '..####.#######...',
                    '.##.##..###.##...',
                    '.#...##..#...##..',
                    '#..#..##.....##..',
                    '..###.###...##...',
                    '.####.####..##...',
                    '.#.#...####..##..',
                    '.....#..####..##.',
                    '.....##..####.##.',
                    '......##..###.##.',
                    '.......##..#...#.',
                    '.......###...#...',
                    '....#.#####.###..',
                    '....#####.######.',
                    '.....#.##..#####.',
                    '...#...###.######',
                    '..###.##########.',
                    '#################'
                ];
                const verticalWalls = [
                    '.#..............##',
                    '##....##......####',
                    '#..##..##..##..###',
                    '#.####..######..##',
                    '###..##..####..###',
                    '##........##..####',
                    '#....##....##..###',
                    '########....##..##',
                    '#####..##....##..#',
                    '######..##......##',
                    '#######..##..##..#',
                    '########..########',
                    '#######....##..###',
                    '####............##',
                    '#####....##......#',
                    '########..##.....#',
                    '###..##..........#',
                    '#...............#.'
                ];

                const originX = -(columns * cellSize) / 2;
                const originZ = -(rows * cellSize) / 2;
                const roofWidth = columns * cellSize + lineThickness;
                const roofDepth = rows * cellSize + lineThickness;
                // Reutilizar estas geometrías reduce memoria sin cambiar la malla
                // visual ni los colliders independientes de cada segmento.
                const horizontalWallGeometry = new THREE.BoxGeometry(cellSize + lineThickness, lineHeight, lineThickness);
                const verticalWallGeometry = new THREE.BoxGeometry(lineThickness, lineHeight, cellSize + lineThickness);
                const horizontalGuideGeometry = new THREE.BoxGeometry(cellSize * 0.62, 0.055, 0.04);
                const verticalGuideGeometry = new THREE.BoxGeometry(0.04, 0.055, cellSize * 0.62);
                const checkpointGeometry = new THREE.BoxGeometry(0.72, 0.025, 0.12);
                const mazeFloorMat = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    map: floorTexture,
                    bumpMap: floorTexture,
                    bumpScale: 0.012,
                    roughness: 0.84,
                    metalness: 0.02
                });
                const mazeFloor = new THREE.Mesh(
                    new THREE.PlaneGeometry(roofWidth, roofDepth),
                    mazeFloorMat
                );
                mazeFloor.name = 'Piso interior del laberinto';
                mazeFloor.rotation.x = -Math.PI / 2;
                mazeFloor.position.y = 0.018;
                window.setMallShadowMode?.(mazeFloor, { receive: true });
                maze.add(mazeFloor);

                const addCeilingLight = (localX, localZ, color = 0xffd49a) => {
                    const fixture = new THREE.Mesh(
                        new THREE.BoxGeometry(1.15, 0.045, 0.22),
                        ceilingFixtureMat
                    );
                    fixture.name = 'Luminaria de orientación del laberinto';
                    fixture.position.set(localX, wallHeight - 0.08, localZ);
                    maze.add(fixture);

                    // Luces sin sombras: iluminan los pasillos sin multiplicar el coste del render.
                    const light = new THREE.PointLight(color, 0.52, 13, 1.8);
                    light.name = 'Luz ambiental del laberinto';
                    light.position.set(localX, wallHeight - 0.28, localZ);
                    maze.add(light);
                };

                [
                    [-14, -15, 0xffd39a],
                    [10, -15, 0xffd39a],
                    [-10, -1, 0xffe5b6],
                    [10, 3, 0xffe5b6],
                    [-10, 14, 0xffd39a],
                    [12, 15, 0xffd39a]
                ].forEach(([localX, localZ, color]) => addCeilingLight(localX, localZ, color));

                const roof = new THREE.Mesh(
                    new THREE.BoxGeometry(roofWidth, roofThickness, roofDepth),
                    roofMat
                );
                roof.name = 'Techo opaco del laberinto';
                roof.position.set(0, wallHeight + roofThickness / 2, 0);
                window.setMallShadowMode?.(roof, { cast: true, receive: true });
                maze.add(roof);
                registerCollider(
                    maze.position.x,
                    maze.position.z,
                    roofWidth,
                    roofDepth,
                    wallHeight,
                    wallHeight + roofThickness,
                    `${maze.name}:roof`
                );

                const addHorizontalWall = (row, col) => {
                    const wall = new THREE.Mesh(horizontalWallGeometry, wallMat);
                    wall.position.set(originX + col * cellSize + cellSize / 2, mazeDrawY, originZ + row * cellSize);
                    window.setMallShadowMode?.(wall, { cast: true, receive: true });
                    maze.add(wall);
                    registerCollider(
                        maze.position.x + originX + col * cellSize + cellSize / 2,
                        maze.position.z + originZ + row * cellSize,
                        cellSize + lineThickness,
                        lineThickness,
                        0,
                        wallHeight,
                        `${maze.name}:h:${row}:${col}`
                    );

                    if ((row * columns + col) % 4 === 1) {
                        const guide = new THREE.Mesh(horizontalGuideGeometry, wallGuideMat);
                        guide.name = 'Acento de orientación del laberinto';
                        guide.position.set(
                            originX + col * cellSize + cellSize / 2,
                            1.85,
                            originZ + row * cellSize + lineThickness / 2 + 0.025
                        );
                        maze.add(guide);
                    }
                };
                const addVerticalWall = (row, col) => {
                    const wall = new THREE.Mesh(verticalWallGeometry, wallMat);
                    wall.position.set(originX + col * cellSize, mazeDrawY, originZ + row * cellSize + cellSize / 2);
                    window.setMallShadowMode?.(wall, { cast: true, receive: true });
                    maze.add(wall);
                    registerCollider(
                        maze.position.x + originX + col * cellSize,
                        maze.position.z + originZ + row * cellSize + cellSize / 2,
                        lineThickness,
                        cellSize + lineThickness,
                        0,
                        wallHeight,
                        `${maze.name}:v:${row}:${col}`
                    );

                    if ((row * columns + col) % 4 === 3) {
                        const guide = new THREE.Mesh(verticalGuideGeometry, wallGuideMat);
                        guide.name = 'Acento de orientación del laberinto';
                        guide.position.set(
                            originX + col * cellSize + lineThickness / 2 + 0.025,
                            1.85,
                            originZ + row * cellSize + cellSize / 2
                        );
                        maze.add(guide);
                    }
                };

                horizontalWalls.forEach((wallRow, row) => {
                    [...wallRow].forEach((segment, col) => {
                        if (segment === '#') addHorizontalWall(row, col);
                    });
                });
                verticalWalls.forEach((wallRow, row) => {
                    [...wallRow].forEach((segment, col) => {
                        if (segment === '#') addVerticalWall(row, col);
                    });
                });

                const addCellMarker = (row, col, material) => {
                    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.035, 0.42), material);
                    marker.position.set(
                        originX + col * cellSize + cellSize / 2,
                        markerY,
                        originZ + row * cellSize + cellSize / 2
                    );
                    maze.add(marker);
                };
                addCellMarker(0, 0, startMat);
                addCellMarker(rows - 1, columns - 1, finishMat);

                const routeCheckpointCells = [
                    [1, 3],
                    [5, 3],
                    [8, 2],
                    [12, 11],
                    [14, 5]
                ];
                routeCheckpointCells.forEach(([row, col], index) => {
                    const marker = new THREE.Mesh(checkpointGeometry, floorGuideMat);
                    marker.name = `Punto de control ${String.fromCharCode(65 + index)} del laberinto`;
                    marker.userData.isMazeDecoration = true;
                    marker.userData.isMazeCheckpoint = true;
                    marker.position.set(
                        originX + col * cellSize + cellSize / 2,
                        markerY,
                        originZ + row * cellSize + cellSize / 2
                    );
                    maze.add(marker);
                });

                [
                    [2, 2], [5, 13], [9, 4], [12, 11], [15, 6]
                ].forEach(([row, col]) => {
                    const marker = new THREE.Mesh(
                        checkpointGeometry,
                        floorGuideMat
                    );
                    marker.name = 'Baliza de orientación del laberinto';
                    marker.position.set(
                        originX + col * cellSize + cellSize / 2,
                        markerY,
                        originZ + row * cellSize + cellSize / 2
                    );
                    maze.add(marker);
                });

                const addSectorLandmark = ({ row, col, axis, label, color }) => {
                    const localX = axis === 'horizontal'
                        ? originX + col * cellSize + cellSize / 2
                        : originX + col * cellSize;
                    const localZ = axis === 'horizontal'
                        ? originZ + row * cellSize
                        : originZ + row * cellSize + cellSize / 2;
                    const panelMaterial = new THREE.MeshStandardMaterial({
                        color,
                        roughness: 0.38,
                        metalness: 0.22,
                        emissive: color,
                        emissiveIntensity: 0.26
                    });
                    const panel = new THREE.Mesh(
                        axis === 'horizontal'
                            ? new THREE.BoxGeometry(1.02, 0.7, 0.026)
                            : new THREE.BoxGeometry(0.026, 0.7, 1.02),
                        panelMaterial
                    );
                    panel.name = `Hito visual del sector ${label}`;
                    panel.userData.isMazeDecoration = true;
                    panel.position.set(
                        localX + (axis === 'horizontal' ? 0 : lineThickness / 2 + 0.016),
                        1.32,
                        localZ + (axis === 'horizontal' ? lineThickness / 2 + 0.016 : 0)
                    );
                    maze.add(panel);

                    const labelTexture = createDoorLabelTexture(`SECTOR ${label}`);
                    [-1, 1].forEach((side) => {
                        const face = new THREE.Mesh(
                            new THREE.PlaneGeometry(axis === 'horizontal' ? 0.86 : 0.18, axis === 'horizontal' ? 0.2 : 0.86),
                            new THREE.MeshBasicMaterial({
                                map: labelTexture,
                                transparent: true,
                                depthWrite: false,
                                toneMapped: false
                            })
                        );
                        if (axis === 'horizontal') {
                            face.position.set(localX, 1.32, localZ + side * (lineThickness / 2 + 0.034));
                            face.rotation.y = side < 0 ? Math.PI : 0;
                        } else {
                            face.position.set(localX + side * (lineThickness / 2 + 0.034), 1.32, localZ);
                            face.rotation.y = side < 0 ? -Math.PI / 2 : Math.PI / 2;
                        }
                        face.name = `Identificador del sector ${label}`;
                        face.userData.isMazeDecoration = true;
                        face.renderOrder = 13;
                        maze.add(face);
                    });

                    const ceilingAccent = new THREE.Mesh(
                        axis === 'horizontal'
                            ? new THREE.BoxGeometry(1.3, 0.035, 0.24)
                            : new THREE.BoxGeometry(0.24, 0.035, 1.3),
                        panelMaterial
                    );
                    ceilingAccent.name = `Luminaria de sector ${label}`;
                    ceilingAccent.userData.isMazeDecoration = true;
                    ceilingAccent.position.set(localX, wallHeight - 0.12, localZ);
                    maze.add(ceilingAccent);
                };

                [
                    { row: 1, col: 3, axis: 'horizontal', label: 'A', color: 0x76b8ad },
                    { row: 5, col: 3, axis: 'horizontal', label: 'B', color: 0xd0ad67 },
                    { row: 8, col: 2, axis: 'vertical', label: 'C', color: 0x9d9bd0 },
                    { row: 12, col: 11, axis: 'horizontal', label: 'D', color: 0xc88e72 },
                    { row: 14, col: 5, axis: 'horizontal', label: 'E', color: 0x78a6c0 }
                ].forEach(addSectorLandmark);

                const addRouteSign = ({ row, col, label, color, rotationY = 0, offsetX = 0, offsetZ = 0 }) => {
                    const localX = originX + col * cellSize + cellSize / 2 + offsetX;
                    const localZ = originZ + row * cellSize + cellSize / 2 + offsetZ;
                    const signMaterial = new THREE.MeshStandardMaterial({
                        color,
                        roughness: 0.32,
                        metalness: 0.24,
                        emissive: color,
                        emissiveIntensity: 0.34
                    });
                    const sign = new THREE.Mesh(
                        new THREE.BoxGeometry(1.42, 0.46, 0.028),
                        signMaterial
                    );
                    sign.name = `Señal de recorrido ${label}`;
                    sign.userData.isMazeDecoration = true;
                    sign.userData.isMazeWayfinding = true;
                    sign.position.set(localX, 2.08, localZ);
                    sign.rotation.y = rotationY;
                    maze.add(sign);

                    const labelTexture = createDoorLabelTexture(label);
                    [-1, 1].forEach((side) => {
                        const face = new THREE.Mesh(
                            new THREE.PlaneGeometry(1.22, 0.25),
                            new THREE.MeshBasicMaterial({
                                map: labelTexture,
                                transparent: true,
                                depthWrite: false,
                                toneMapped: false
                            })
                        );
                        const faceOffsetX = Math.sin(rotationY) * side * 0.034;
                        const faceOffsetZ = Math.cos(rotationY) * side * 0.034;
                        face.position.set(localX + faceOffsetX, 2.08, localZ + faceOffsetZ);
                        face.rotation.y = rotationY + (side < 0 ? Math.PI : 0);
                        face.name = `Texto de señal ${label}`;
                        face.userData.isMazeDecoration = true;
                        face.userData.isMazeWayfinding = true;
                        face.renderOrder = 14;
                        maze.add(face);
                    });

                    const confirmationLight = new THREE.PointLight(color, 0.38, 6, 1.8);
                    confirmationLight.name = `Luz de confirmación ${label}`;
                    confirmationLight.position.set(localX, 2.31, localZ);
                    maze.add(confirmationLight);

                    const lightBar = new THREE.Mesh(
                        new THREE.BoxGeometry(1.16, 0.035, 0.12),
                        ceilingFixtureMat
                    );
                    lightBar.name = `Luminaria de confirmación ${label}`;
                    lightBar.userData.isMazeDecoration = true;
                    lightBar.userData.isMazeWayfinding = true;
                    lightBar.position.set(localX, 2.35, localZ);
                    lightBar.rotation.y = rotationY;
                    maze.add(lightBar);
                };

                // Las señales se suspenden sobre las celdas abiertas; son visuales y no crean colliders.
                addRouteSign({ row: 0, col: 0, label: 'ENTRADA', color: 0x55c58a, rotationY: Math.PI / 2 });
                addRouteSign({ row: rows - 1, col: columns - 1, label: 'META', color: 0xe27258 });
                addRouteSign({
                    row: rows - 1,
                    col: columns - 1,
                    label: 'SALIDA',
                    color: 0x70b9cf,
                    rotationY: Math.PI / 2,
                    offsetX: 0.14,
                    offsetZ: 0.14
                });

                const getMazeCellWorldPosition = (row, col) => ({
                    x: maze.position.x + originX + col * cellSize + cellSize / 2,
                    z: maze.position.z + originZ + row * cellSize + cellSize / 2
                });
                const panicStationCells = [
                    { row: 2, col: 1, axis: 'horizontal' },
                    { row: 3, col: 1, axis: 'vertical' },
                    { row: 7, col: 13, axis: 'horizontal' },
                    { row: 11, col: 14, axis: 'vertical' },
                    { row: 13, col: 12, axis: 'horizontal' }
                ];
                const getMazeWallWorldPosition = ({ row, col, axis }) => ({
                    x: maze.position.x + (axis === 'horizontal'
                        ? originX + col * cellSize + cellSize / 2
                        : originX + col * cellSize),
                    z: maze.position.z + (axis === 'horizontal'
                        ? originZ + row * cellSize
                        : originZ + row * cellSize + cellSize / 2)
                });
                const addPanicStation = ({ row, col, axis }, index) => {
                    const localX = axis === 'horizontal'
                        ? originX + col * cellSize + cellSize / 2
                        : originX + col * cellSize;
                    const localZ = axis === 'horizontal'
                        ? originZ + row * cellSize
                        : originZ + row * cellSize + cellSize / 2;
                    const normalOffset = lineThickness / 2 + 0.052;
                    const buttonMaterial = new THREE.MeshStandardMaterial({
                        color: 0xd45454,
                        roughness: 0.3,
                        metalness: 0.18,
                        emissive: 0x751b1b,
                        emissiveIntensity: 0.55
                    });
                    const button = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.12, 0.12, 0.065, 16),
                        buttonMaterial
                    );
                    button.name = `Botón de pánico del laberinto ${index + 1}`;
                    button.userData.isMazeDecoration = true;
                    button.userData.isMazePanicStation = true;
                    button.position.set(
                        localX + (axis === 'vertical' ? normalOffset : 0),
                        1.32,
                        localZ + (axis === 'horizontal' ? normalOffset : 0)
                    );
                    button.rotation.x = axis === 'horizontal' ? Math.PI / 2 : 0;
                    button.rotation.z = axis === 'vertical' ? Math.PI / 2 : 0;
                    maze.add(button);

                    const labelTexture = createDoorLabelTexture('AYUDA');
                    [-1, 1].forEach((side) => {
                        const face = new THREE.Mesh(
                            new THREE.PlaneGeometry(0.62, 0.16),
                            new THREE.MeshBasicMaterial({
                                map: labelTexture,
                                transparent: true,
                                depthWrite: false,
                                toneMapped: false
                            })
                        );
                        const faceOffset = side * normalOffset;
                        face.position.set(
                            localX + (axis === 'vertical' ? faceOffset : 0),
                            1.56,
                            localZ + (axis === 'horizontal' ? faceOffset : 0)
                        );
                        face.rotation.y = axis === 'horizontal'
                            ? (side < 0 ? Math.PI : 0)
                            : (side < 0 ? -Math.PI / 2 : Math.PI / 2);
                        face.name = `Señal de ayuda del laberinto ${index + 1}`;
                        face.userData.isMazeDecoration = true;
                        face.userData.isMazePanicStation = true;
                        face.renderOrder = 14;
                        maze.add(face);
                    });
                };
                panicStationCells.forEach(addPanicStation);
                const startWorldPosition = getMazeCellWorldPosition(0, 0);
                const finishWorldPosition = getMazeCellWorldPosition(rows - 1, columns - 1);
                window.mallMazeDefinition = {
                    name: maze.name,
                    floor: 1,
                    cellSize,
                    rows,
                    columns,
                    bounds: {
                        minX: maze.position.x + originX,
                        maxX: maze.position.x + originX + columns * cellSize,
                        minZ: maze.position.z + originZ,
                        maxZ: maze.position.z + originZ + rows * cellSize
                    },
                    start: startWorldPosition,
                    finish: finishWorldPosition,
                    startRadius: 1,
                    finishRadius: 1,
                    routeCheckpointCount: routeCheckpointCells.length,
                    routeCheckpoints: routeCheckpointCells.map(([row, col], index) => ({
                        id: `checkpoint-${index + 1}`,
                        index: index + 1,
                        label: `Punto ${String.fromCharCode(65 + index)}`,
                        row,
                        col,
                        ...getMazeCellWorldPosition(row, col),
                        radius: 1.1
                    })),
                    entryGate: {
                        x: maze.position.x + originX,
                        z: startWorldPosition.z,
                        width: cellSize * 0.45
                    },
                    panicStations: panicStationCells.map((station, index) => ({
                        ...station,
                        id: `panic-${index + 1}`,
                        label: 'AYUDA',
                        ...getMazeWallWorldPosition(station),
                        radius: 1.15
                    }))
                };

                scene.add(maze);
                return maze;
            };
            createBoulevardMaze();

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

        // La pileta registra su propia huella circular al construirse.
        // --- URBANISMO Y PAISAJISMO EXTERIOR ---
        const grassMat = new THREE.MeshStandardMaterial({ color: 0x2f6d38, roughness: 0.9 });
        const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x30353a, roughness: 0.92 });
        const parkingMat = new THREE.MeshStandardMaterial({ color: 0x58636b, roughness: 0.88 });
        const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xd4a84f, roughness: 0.72 });
        const curvedRoadEdgeMat = new THREE.MeshBasicMaterial({ color: 0xd7d1c3 });
        const roadLineMat = new THREE.MeshBasicMaterial({ color: 0xf4f1e7 });
        const roadCenterLineMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            fog: false,
            toneMapped: false
        });

        function createExterior() {
            const MALL_HALF_WIDTH = 35;
            const MALL_ARM_END = 144;
            const SIDEWALK_WIDTH = 6;
            const TWO_WAY_ROAD_WIDTH = 7;
            const ROAD_CORNER_RADIUS = 12;
            const PARKING_INNER = MALL_HALF_WIDTH + SIDEWALK_WIDTH + TWO_WAY_ROAD_WIDTH;
            const PARKING_SIZE = 113;
            const PARKING_OUTER = PARKING_INNER + PARKING_SIZE;
            const PARKING_CENTER = (PARKING_INNER + PARKING_OUTER) / 2;
            const ARM_SIDE_LENGTH = MALL_ARM_END - MALL_HALF_WIDTH;
            const ARM_SIDE_CENTER = (MALL_ARM_END + MALL_HALF_WIDTH) / 2;

            const grass = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), grassMat);
            grass.rotation.x = -Math.PI / 2;
            grass.position.y = -0.06;
            scene.add(grass);

            const addGroundRect = (width, depth, x, z, material, y = 0.01) => {
                const surface = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
                surface.rotation.x = -Math.PI / 2;
                surface.position.set(x, y, z);
                scene.add(surface);
                return surface;
            };

            const addGroundMark = (width, depth, x, z, material = roadLineMat, y = 0.055, height = 0.025) => {
                const marking = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
                marking.position.set(x, y, z);
                scene.add(marking);
                return marking;
            };

            // Vereda peatonal continua de seis metros en todo el contorno de la cruz.
            [-1, 1].forEach((side) => {
                [-1, 1].forEach((armDirection) => {
                    addGroundRect(
                        SIDEWALK_WIDTH,
                        ARM_SIDE_LENGTH,
                        side * (MALL_HALF_WIDTH + SIDEWALK_WIDTH / 2),
                        armDirection * ARM_SIDE_CENTER,
                        sidewalkMat,
                        0.025
                    );
                    addGroundRect(
                        ARM_SIDE_LENGTH,
                        SIDEWALK_WIDTH,
                        armDirection * ARM_SIDE_CENTER,
                        side * (MALL_HALF_WIDTH + SIDEWALK_WIDTH / 2),
                        sidewalkMat,
                        0.025
                    );
                });
            });
            addGroundRect(MALL_HALF_WIDTH * 2, SIDEWALK_WIDTH, 0, MALL_ARM_END + SIDEWALK_WIDTH / 2, sidewalkMat, 0.025);
            addGroundRect(MALL_HALF_WIDTH * 2, SIDEWALK_WIDTH, 0, -(MALL_ARM_END + SIDEWALK_WIDTH / 2), sidewalkMat, 0.025);
            addGroundRect(SIDEWALK_WIDTH, MALL_HALF_WIDTH * 2, MALL_ARM_END + SIDEWALK_WIDTH / 2, 0, sidewalkMat, 0.025);
            addGroundRect(SIDEWALK_WIDTH, MALL_HALF_WIDTH * 2, -(MALL_ARM_END + SIDEWALK_WIDTH / 2), 0, sidewalkMat, 0.025);

            // Cierra las ocho esquinas exteriores de la vereda en los cuatro brazos.
            [-1, 1].forEach((endDirection) => {
                [-1, 1].forEach((side) => {
                    addGroundRect(
                        SIDEWALK_WIDTH,
                        SIDEWALK_WIDTH,
                        side * (MALL_HALF_WIDTH + SIDEWALK_WIDTH / 2),
                        endDirection * (MALL_ARM_END + SIDEWALK_WIDTH / 2),
                        sidewalkMat,
                        0.025
                    );
                    addGroundRect(
                        SIDEWALK_WIDTH,
                        SIDEWALK_WIDTH,
                        endDirection * (MALL_ARM_END + SIDEWALK_WIDTH / 2),
                        side * (MALL_HALF_WIDTH + SIDEWALK_WIDTH / 2),
                        sidewalkMat,
                        0.025
                    );
                });
            });

            // La calzada y su eje se generan más abajo como una única cinta continua.
            // Esto evita que rectángulos heredados sobresalgan bajo los arcos circulares.
            const addDashedCenterLine = (axis, fixed, start, end) => {
                for (let cursor = start; cursor <= end; cursor += 9) {
                    if (axis === 'z') addGroundMark(0.11, 5, fixed, cursor, roadCenterLineMat);
                    else addGroundMark(5, 0.11, cursor, fixed, roadCenterLineMat);
                }
            };

            const carBodyMaterials = [
                0x9e2f2f, 0x1f5f8b, 0xd8d9da, 0x222831,
                0xd88b18, 0x456b4f, 0x704f86, 0xf0efe9
            ].map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.27, metalness: 0.58 }));
            const carDarkMat = new THREE.MeshStandardMaterial({ color: 0x101318, roughness: 0.31, metalness: 0.5 });
            const carGlassMat = new THREE.MeshStandardMaterial({ color: 0x263f50, roughness: 0.08, metalness: 0.42, transparent: true, opacity: 0.9 });
            const carChromeMat = new THREE.MeshStandardMaterial({ color: 0xc8d0d5, roughness: 0.18, metalness: 0.9 });
            const carHeadlightMat = new THREE.MeshStandardMaterial({ color: 0xf5f1d0, emissive: 0x6d673d, emissiveIntensity: 0.34, roughness: 0.16 });
            const carTaillightMat = new THREE.MeshStandardMaterial({ color: 0xa81919, emissive: 0x4a0808, emissiveIntensity: 0.3, roughness: 0.2 });

            const createCarProfileGeometry = (points, width, bevelSize = 0.045) => {
                const shape = new THREE.Shape();
                points.forEach(([px, py, controlX, controlY], index) => {
                    if (index === 0) shape.moveTo(px, py);
                    else if (Number.isFinite(controlX) && Number.isFinite(controlY)) shape.quadraticCurveTo(controlX, controlY, px, py);
                    else shape.lineTo(px, py);
                });
                const geometry = new THREE.ExtrudeGeometry(shape, {
                    depth: width,
                    bevelEnabled: true,
                    bevelSegments: 3,
                    bevelSize,
                    bevelThickness: bevelSize,
                    curveSegments: 8
                });
                geometry.translate(0, 0, -width / 2);
                geometry.rotateY(Math.PI / 2);
                geometry.computeVertexNormals();
                return geometry;
            };

            // Perfiles compartidos: la silueta curva evita el aspecto de bloques apilados.
            const carLowerBodyGeometry = createCarProfileGeometry([
                [-2.08, 0.28], [-2.13, 0.48, -2.16, 0.34], [-1.91, 0.73, -2.08, 0.66],
                [-1.35, 0.9, -1.68, 0.86], [1.35, 0.9], [1.92, 0.74, 1.69, 0.86],
                [2.13, 0.5, 2.08, 0.66], [2.08, 0.28], [1.72, 0.2], [-1.72, 0.2]
            ], 1.76, 0.065);
            const carGlassGeometry = createCarProfileGeometry([
                [-1.34, 0.88], [-0.77, 1.57, -1.08, 1.36], [-0.43, 1.69, -0.62, 1.67],
                [0.67, 1.66], [1.24, 1.12, 1.02, 1.5], [1.32, 0.91],
                [0.98, 0.88], [-1.03, 0.88]
            ], 1.54, 0.025);
            const carRoofGeometry = createCarProfileGeometry([
                [-0.86, 1.57], [-0.49, 1.76, -0.68, 1.72], [0.68, 1.73],
                [0.91, 1.6, 0.82, 1.7], [0.73, 1.54], [-0.72, 1.54]
            ], 1.62, 0.035);
            const carWheelGeometry = new THREE.CylinderGeometry(0.38, 0.38, 0.22, 18);
            carWheelGeometry.rotateZ(Math.PI / 2);
            const carRimGeometry = new THREE.CylinderGeometry(0.21, 0.21, 0.235, 12);
            carRimGeometry.rotateZ(Math.PI / 2);
            const carLightGeometry = new THREE.BoxGeometry(0.5, 0.18, 0.055);
            const carBumperGeometry = new THREE.BoxGeometry(1.35, 0.11, 0.07);
            const carMirrorGeometry = new THREE.SphereGeometry(0.14, 10, 6);
            const carDoorLineGeometry = new THREE.BoxGeometry(0.018, 0.62, 0.025);

            const createParkedCar = (x, z, rotationY, colorIndex, options = {}) => {
                const { registerStaticCollision = true } = options;
                const car = new THREE.Group();
                car.position.set(x, 0, z);
                car.rotation.y = rotationY;
                const bodyMaterial = carBodyMaterials[colorIndex % carBodyMaterials.length];
                const body = new THREE.Mesh(carLowerBodyGeometry, bodyMaterial);
                car.add(body);
                const cabin = new THREE.Mesh(carGlassGeometry, carGlassMat);
                car.add(cabin);
                const roof = new THREE.Mesh(carRoofGeometry, bodyMaterial);
                car.add(roof);

                [-0.94, 0.94].forEach((wheelX) => {
                    [-1.36, 1.36].forEach((wheelZ) => {
                        const wheel = new THREE.Mesh(carWheelGeometry, carDarkMat);
                        wheel.position.set(wheelX, 0.39, wheelZ);
                        car.add(wheel);
                        const rim = new THREE.Mesh(carRimGeometry, carChromeMat);
                        rim.position.copy(wheel.position);
                        car.add(rim);
                    });
                });

                [-0.53, 0.53].forEach(lightX => {
                    const headlight = new THREE.Mesh(carLightGeometry, carHeadlightMat);
                    headlight.position.set(lightX, 0.69, -2.09);
                    car.add(headlight);
                    const taillight = new THREE.Mesh(carLightGeometry, carTaillightMat);
                    taillight.position.set(lightX, 0.66, 2.09);
                    car.add(taillight);
                });
                [-1, 1].forEach(side => {
                    const mirror = new THREE.Mesh(carMirrorGeometry, bodyMaterial);
                    mirror.scale.set(1.15, 0.55, 0.72);
                    mirror.position.set(side * 0.91, 1.14, -0.48);
                    car.add(mirror);
                    [-0.3, 0.72].forEach(doorZ => {
                        const doorLine = new THREE.Mesh(carDoorLineGeometry, carDarkMat);
                        doorLine.position.set(side * 0.892, 0.99, doorZ);
                        car.add(doorLine);
                    });
                });
                [-2.115, 2.115].forEach((bumperZ, index) => {
                    const bumper = new THREE.Mesh(carBumperGeometry, index === 0 ? carChromeMat : carDarkMat);
                    bumper.position.set(0, 0.36, bumperZ);
                    car.add(bumper);
                });
                // Ajuste horizontal proporcional al avatar; la altura permanece intacta.
                car.scale.set(1.1, 0.94, 1.15);
                car.userData.isSolidObstacle = true;
                car.userData.collisionFootprint = { width: 2.36, length: 4.95, height: 2.2 };
                scene.add(car);
                if (registerStaticCollision) {
                    // El volumen llega a la altura de navegación para bloquear jugadores y NPC.
                    registerRotatedSolidFootprint(x, z, 2.36, 4.95, rotationY, 0, 2.2);
                }
                return car;
            };

            const towerBrownMat = new THREE.MeshStandardMaterial({ color: 0x4b3827, roughness: 0.48, metalness: 0.24 });
            const towerGoldMat = new THREE.MeshStandardMaterial({ color: 0xb78a38, roughness: 0.22, metalness: 0.72 });
            const towerGlassMat = new THREE.MeshPhysicalMaterial({
                color: 0x9ab6c7,
                transmission: 0.32,
                transparent: true,
                opacity: 0.78,
                roughness: 0.12,
                metalness: 0.18
            });

            const createSecurityTower = (x, z, quadrantLabel) => {
                const tower = new THREE.Group();
                tower.name = `parking-security-tower-${quadrantLabel}`;
                tower.position.set(x, 0, z);
                const addTowerBox = (w, h, d, px, py, pz, material) => {
                    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
                    mesh.position.set(px, py, pz);
                    tower.add(mesh);
                };
                addTowerBox(4.8, 0.28, 4.8, 0, 0.14, 0, towerBrownMat);
                [-1.65, 1.65].forEach((px) => [-1.65, 1.65].forEach((pz) => {
                    addTowerBox(0.32, 4.1, 0.32, px, 2.15, pz, towerBrownMat);
                }));
                addTowerBox(4.5, 1.8, 4.5, 0, 4.65, 0, towerBrownMat);
                addTowerBox(4.18, 1.22, 0.06, 0, 4.72, 2.28, towerGlassMat);
                addTowerBox(4.18, 1.22, 0.06, 0, 4.72, -2.28, towerGlassMat);
                addTowerBox(0.06, 1.22, 4.18, 2.28, 4.72, 0, towerGlassMat);
                addTowerBox(0.06, 1.22, 4.18, -2.28, 4.72, 0, towerGlassMat);
                addTowerBox(5.25, 0.3, 5.25, 0, 5.72, 0, towerGoldMat);
                const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.42, 12), new THREE.MeshBasicMaterial({ color: 0xffc247 }));
                beacon.position.y = 6.08;
                tower.add(beacon);
                scene.add(tower);
                registerCollider(x, z, 5.25, 5.25, 0, 6.35);
            };

            const stripeTransforms = [];
            const PARKING_STALL_WIDTH = 2.9;
            const PARKING_STALL_DEPTH = 5.6;
            const PARKING_STALL_SIDE_MARGIN = 4;
            const parkedCarSlots = [2, 8, 14, 21, 27, 34];
            const parkingRows = [12.5, 35.5, 78.5, 101.5].map(offset => PARKING_INNER + offset);
            const createParkingQuadrant = (sx, sz) => {
                addGroundRect(PARKING_SIZE, PARKING_SIZE, sx * PARKING_CENTER, sz * PARKING_CENTER, parkingMat, 0.008);

                // Dos corredores internos de doble sentido alimentan las cuatro filas.
                const firstParkingAisle = PARKING_INNER + 25;
                const secondParkingAisle = PARKING_INNER + 89;
                addGroundRect(PARKING_SIZE, TWO_WAY_ROAD_WIDTH, sx * PARKING_CENTER, sz * firstParkingAisle, asphaltMat, 0.02);
                addGroundRect(PARKING_SIZE, TWO_WAY_ROAD_WIDTH, sx * PARKING_CENTER, sz * secondParkingAisle, asphaltMat, 0.02);
                addDashedCenterLine('x', sz * firstParkingAisle, sx > 0 ? PARKING_INNER : -PARKING_OUTER, sx > 0 ? PARKING_OUTER : -PARKING_INNER);
                addDashedCenterLine('x', sz * secondParkingAisle, sx > 0 ? PARKING_INNER : -PARKING_OUTER, sx > 0 ? PARKING_OUTER : -PARKING_INNER);

                parkingRows.forEach((rowDistance, rowIndex) => {
                    for (
                        let u = PARKING_INNER + PARKING_STALL_SIDE_MARGIN;
                        u <= PARKING_OUTER - PARKING_STALL_SIDE_MARGIN;
                        u += PARKING_STALL_WIDTH
                    ) {
                        stripeTransforms.push({ x: sx * u, z: sz * rowDistance });
                    }
                    parkedCarSlots.forEach((slotIndex, carIndex) => {
                        const u = PARKING_INNER
                            + PARKING_STALL_SIDE_MARGIN
                            + PARKING_STALL_WIDTH / 2
                            + slotIndex * PARKING_STALL_WIDTH;
                        if (u + PARKING_STALL_WIDTH / 2 > PARKING_OUTER - PARKING_STALL_SIDE_MARGIN) return;
                        if ((carIndex + rowIndex) % 2 !== 0) return;
                        createParkedCar(
                            sx * u,
                            sz * rowDistance,
                            sz > 0 ? 0 : Math.PI,
                            rowIndex * 2 + carIndex + (sx > 0 ? 1 : 4)
                        );
                    });
                });

                createSecurityTower(sx * PARKING_CENTER, sz * PARKING_CENTER, `${sx > 0 ? 'E' : 'O'}${sz > 0 ? 'N' : 'S'}`);
            };

            [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => createParkingQuadrant(sx, sz));

            // Doce pasos peatonales: cuatro accesos principales y ocho puertas laterales.
            const terminalRoadCenter = MALL_ARM_END + SIDEWALK_WIDTH + TWO_WAY_ROAD_WIDTH / 2;
            const exteriorEntrances = [
                // Entradas principales de las tiendas ancla.
                { axis: 'z', x: 0, z: terminalRoadCenter, width: 12 },
                { axis: 'z', x: 0, z: -terminalRoadCenter, width: 12 },
                { axis: 'x', x: terminalRoadCenter, z: 0, width: 12 },
                { axis: 'x', x: -terminalRoadCenter, z: 0, width: 12 },
                // Centros medidos de las ocho entradas laterales.
                { axis: 'x', x: 44.39, z: -86.95, width: 7.5 },
                { axis: 'z', x: 86.76, z: -44.47, width: 7.5 },
                { axis: 'z', x: 86.77, z: 44.59, width: 7.5 },
                { axis: 'x', x: 44.94, z: 87.05, width: 7.5 },
                { axis: 'x', x: -44.53, z: 87.14, width: 7.5 },
                { axis: 'z', x: -86.88, z: 44.94, width: 7.5 },
                { axis: 'z', x: -86.84, z: -44.56, width: 7.5 },
                { axis: 'x', x: -44.91, z: -86.93, width: 7.5 }
            ];
            const crosswalkStripeDepth = 0.48;
            const crosswalkStripeGap = 0.38;
            const crosswalkMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                fog: false,
                toneMapped: false,
                polygonOffset: true,
                polygonOffsetFactor: -4,
                polygonOffsetUnits: -4
            });
            const crosswalks = [];

            const createCrosswalk = (axis, x, z, crosswalkWidth) => {
                const crossingDepth = TWO_WAY_ROAD_WIDTH - 0.35;
                const stripeStep = crosswalkStripeDepth + crosswalkStripeGap;
                const stripeCount = Math.floor(crossingDepth / stripeStep);
                const firstOffset = -((stripeCount - 1) * stripeStep) / 2;
                for (let index = 0; index < stripeCount; index += 1) {
                    const offset = firstOffset + index * stripeStep;
                    if (axis === 'z') {
                        addGroundMark(crosswalkWidth, crosswalkStripeDepth, x, z + offset, crosswalkMat, 0.05, 0.004);
                    } else {
                        addGroundMark(crosswalkStripeDepth, crosswalkWidth, x + offset, z, crosswalkMat, 0.05, 0.004);
                    }
                }
                crosswalks.push({
                    axis,
                    x,
                    z,
                    halfWidth: crosswalkWidth / 2,
                    halfDepth: TWO_WAY_ROAD_WIDTH / 2 + 1.1
                });
            };

            exteriorEntrances.forEach(({ axis, x, z, width }) => createCrosswalk(axis, x, z, width));
            window.mallCrosswalks = crosswalks;

            // Dos carriles continuos recorren el contorno completo de la cruz del mall.
            const roadBase = MALL_HALF_WIDTH + SIDEWALK_WIDTH + TWO_WAY_ROAD_WIDTH / 2;
            const baseTrafficRoute = [
                [roadBase, -terminalRoadCenter],
                [roadBase, -roadBase],
                [terminalRoadCenter, -roadBase],
                [terminalRoadCenter, roadBase],
                [roadBase, roadBase],
                [roadBase, terminalRoadCenter],
                [-roadBase, terminalRoadCenter],
                [-roadBase, roadBase],
                [-terminalRoadCenter, roadBase],
                [-terminalRoadCenter, -roadBase],
                [-roadBase, -roadBase],
                [-roadBase, -terminalRoadCenter]
            ];

            const buildRoundedClosedPoints = (vertices, radius = ROAD_CORNER_RADIUS, samplesPerCorner = 16) => {
                const source = vertices.map(([x, z]) => new THREE.Vector3(x, 0, z));
                const points = [];
                source.forEach((corner, index) => {
                    const previous = source[(index - 1 + source.length) % source.length];
                    const next = source[(index + 1) % source.length];
                    const incomingLength = previous.distanceTo(corner);
                    const outgoingLength = next.distanceTo(corner);
                    const tangentRadius = Math.min(radius, incomingLength / 2, outgoingLength / 2);
                    const incomingDirection = corner.clone().sub(previous).normalize();
                    const outgoingDirection = next.clone().sub(corner).normalize();
                    const tangentStart = corner.clone().addScaledVector(incomingDirection, -tangentRadius);
                    const tangentEnd = corner.clone().addScaledVector(outgoingDirection, tangentRadius);
                    const arcCenter = tangentStart.clone().addScaledVector(outgoingDirection, tangentRadius);
                    const startAngle = Math.atan2(tangentStart.z - arcCenter.z, tangentStart.x - arcCenter.x);
                    const endAngle = Math.atan2(tangentEnd.z - arcCenter.z, tangentEnd.x - arcCenter.x);
                    let angleDelta = endAngle - startAngle;
                    while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
                    while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;

                    for (let sampleIndex = 0; sampleIndex <= samplesPerCorner; sampleIndex += 1) {
                        const angle = startAngle + angleDelta * (sampleIndex / samplesPerCorner);
                        points.push(new THREE.Vector3(
                            arcCenter.x + Math.cos(angle) * tangentRadius,
                            0,
                            arcCenter.z + Math.sin(angle) * tangentRadius
                        ));
                    }
                });
                return points;
            };

            const roundedRoadCenterPoints = buildRoundedClosedPoints(baseTrafficRoute, ROAD_CORNER_RADIUS, 16);

            const createRoadRibbon = (points, width, material, y, name) => {
                const positions = [];
                const indices = [];
                points.forEach((point, index) => {
                    const previous = points[(index - 1 + points.length) % points.length];
                    const next = points[(index + 1) % points.length];
                    const tangent = next.clone().sub(previous).normalize();
                    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
                    const left = point.clone().addScaledVector(normal, width / 2);
                    const right = point.clone().addScaledVector(normal, -width / 2);
                    positions.push(left.x, y, left.z, right.x, y, right.z);
                    const nextIndex = (index + 1) % points.length;
                    // Vértices en sentido antihorario vistos desde arriba: la cara visible apunta a +Y.
                    indices.push(index * 2, nextIndex * 2, index * 2 + 1);
                    indices.push(index * 2 + 1, nextIndex * 2, nextIndex * 2 + 1);
                });
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                geometry.setIndex(indices);
                geometry.computeVertexNormals();
                const ribbon = new THREE.Mesh(geometry, material);
                ribbon.name = name;
                scene.add(ribbon);
            };

            const buildTrafficRoute = (laneOffset) => {
                const points = roundedRoadCenterPoints.map((point, index) => {
                    const previous = roundedRoadCenterPoints[(index - 1 + roundedRoadCenterPoints.length) % roundedRoadCenterPoints.length];
                    const next = roundedRoadCenterPoints[(index + 1) % roundedRoadCenterPoints.length];
                    const tangent = next.clone().sub(previous).normalize();
                    // En el plano XZ, este vector apunta a la derecha del avance de la ruta base.
                    const right = new THREE.Vector3(-tangent.z, 0, tangent.x);
                    return point.clone().addScaledVector(right, laneOffset);
                });
                const segmentLengths = [];
                const cumulativeLengths = [0];
                let totalLength = 0;
                points.forEach((point, index) => {
                    const nextPoint = points[(index + 1) % points.length];
                    const segmentLength = point.distanceTo(nextPoint);
                    segmentLengths.push(segmentLength);
                    totalLength += segmentLength;
                    cumulativeLengths.push(totalLength);
                });
                return { points, segmentLengths, cumulativeLengths, totalLength };
            };

            // El borde claro hace legible el radio incluso sobre los antiguos empalmes rectos.
            createRoadRibbon(roundedRoadCenterPoints, TWO_WAY_ROAD_WIDTH + 0.42, curvedRoadEdgeMat, 0.041, 'rounded-road-edge');
            createRoadRibbon(roundedRoadCenterPoints, TWO_WAY_ROAD_WIDTH, asphaltMat, 0.047, 'rounded-perimeter-road');

            const sampleTrafficRoute = (route, rawDistance) => {
                const distance = ((rawDistance % route.totalLength) + route.totalLength) % route.totalLength;
                let segmentIndex = route.segmentLengths.length - 1;
                for (let index = 0; index < route.segmentLengths.length; index += 1) {
                    if (distance <= route.cumulativeLengths[index + 1]) {
                        segmentIndex = index;
                        break;
                    }
                }
                const segmentStart = route.points[segmentIndex];
                const segmentEnd = route.points[(segmentIndex + 1) % route.points.length];
                const segmentLength = route.segmentLengths[segmentIndex] || 1;
                const alpha = (distance - route.cumulativeLengths[segmentIndex]) / segmentLength;
                return {
                    position: segmentStart.clone().lerp(segmentEnd, alpha),
                    tangent: segmentEnd.clone().sub(segmentStart).normalize()
                };
            };

            const roundedCenterRoute = buildTrafficRoute(0);
            for (let distance = 2.5; distance < roundedCenterRoute.totalLength; distance += 9) {
                const sample = sampleTrafficRoute(roundedCenterRoute, distance);
                const dash = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 5), roadCenterLineMat);
                dash.position.set(sample.position.x, 0.096, sample.position.z);
                dash.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
                dash.name = 'rounded-road-center-dash';
                scene.add(dash);
            }

            const trafficVehicles = [];
            const TRAFFIC_CRUISE_SPEED = MALL_PEDESTRIAN_WALK_SPEED * 2;
            const createTrafficVehicle = (laneOffset, direction, progress, colorIndex) => {
                const route = buildTrafficRoute(laneOffset);
                const mesh = createParkedCar(0, 0, 0, colorIndex, { registerStaticCollision: false });
                mesh.name = `moving-traffic-car-${trafficVehicles.length + 1}`;
                mesh.userData.isSolidObstacle = false;
                const vehicle = {
                    mesh,
                    route,
                    direction,
                    distance: route.totalLength * progress,
                    speed: TRAFFIC_CRUISE_SPEED,
                    cruiseSpeed: TRAFFIC_CRUISE_SPEED,
                    width: 2.36,
                    length: 4.95,
                    height: 2.2
                };
                const initialSample = sampleTrafficRoute(route, vehicle.distance);
                const initialTangent = initialSample.tangent.multiplyScalar(direction);
                mesh.position.copy(initialSample.position);
                mesh.rotation.y = Math.atan2(-initialTangent.x, -initialTangent.z);
                trafficVehicles.push(vehicle);
                return vehicle;
            };

            // Tres autos por pista, espaciados para mantener un flujo continuo y legible.
            createTrafficVehicle(1.25, 1, 0.06, 0);
            createTrafficVehicle(1.25, 1, 0.39, 2);
            createTrafficVehicle(1.25, 1, 0.72, 4);
            createTrafficVehicle(-1.25, -1, 0.22, 1);
            createTrafficVehicle(-1.25, -1, 0.55, 3);
            createTrafficVehicle(-1.25, -1, 0.88, 5);
            window.mallTrafficVehicles = trafficVehicles;
            console.info(`[Traffic] ${trafficVehicles.length} autos y ${crosswalks.length} pasos cebra activos.`);

            const isCrosswalkOccupied = (crosswalk, actors) => actors.some((actor) => {
                if (!actor || actor.y > 3.1 || actor.y + (actor.height || 0) < -0.1) return false;
                if (crosswalk.axis === 'z') {
                    return Math.abs(actor.x - crosswalk.x) <= crosswalk.halfWidth
                        && Math.abs(actor.z - crosswalk.z) <= crosswalk.halfDepth;
                }
                return Math.abs(actor.z - crosswalk.z) <= crosswalk.halfWidth
                    && Math.abs(actor.x - crosswalk.x) <= crosswalk.halfDepth;
            });

            window.updateMallTrafficVehicles = (deltaSec = 1 / 60) => {
                let actors = [];
                try {
                    if (typeof getDynamicCollisionActors === 'function') actors = getDynamicCollisionActors();
                } catch (_initializationError) {
                    // La escena exterior puede terminar antes que la presencia multijugador.
                }
                const occupiedCrosswalks = crosswalks.filter(crosswalk => isCrosswalkOccupied(crosswalk, actors));

                trafficVehicles.forEach((vehicle, vehicleIndex) => {
                    const sample = sampleTrafficRoute(vehicle.route, vehicle.distance);
                    const travelTangent = sample.tangent.multiplyScalar(vehicle.direction);
                    let mustStop = occupiedCrosswalks.some((crosswalk) => {
                        const toCrosswalkX = crosswalk.x - sample.position.x;
                        const toCrosswalkZ = crosswalk.z - sample.position.z;
                        const forwardDistance = toCrosswalkX * travelTangent.x + toCrosswalkZ * travelTangent.z;
                        const lateralDistance = Math.abs(toCrosswalkX * -travelTangent.z + toCrosswalkZ * travelTangent.x);
                        return forwardDistance > 0.5 && forwardDistance < 30 && lateralDistance < 7.5;
                    });

                    if (!mustStop) {
                        mustStop = trafficVehicles.some((otherVehicle, otherIndex) => {
                            if (otherIndex === vehicleIndex) return false;
                            const dx = otherVehicle.mesh.position.x - sample.position.x;
                            const dz = otherVehicle.mesh.position.z - sample.position.z;
                            const forwardDistance = dx * travelTangent.x + dz * travelTangent.z;
                            const lateralDistance = Math.abs(dx * -travelTangent.z + dz * travelTangent.x);
                            return forwardDistance > 0 && forwardDistance < 14 && lateralDistance < 2.4;
                        });
                    }

                    const targetSpeed = mustStop ? 0 : vehicle.cruiseSpeed;
                    const rate = targetSpeed < vehicle.speed ? 18 : 5.4;
                    vehicle.speed += THREE.MathUtils.clamp(targetSpeed - vehicle.speed, -rate * deltaSec, rate * deltaSec);
                    vehicle.distance += vehicle.speed * deltaSec * vehicle.direction;

                    const nextSample = sampleTrafficRoute(vehicle.route, vehicle.distance);
                    const nextTangent = nextSample.tangent.multiplyScalar(vehicle.direction);
                    vehicle.mesh.position.copy(nextSample.position);
                    vehicle.mesh.rotation.y = Math.atan2(-nextTangent.x, -nextTangent.z);
                });
            };

            // Una sola malla instanciada dibuja todas las líneas de plazas holgadas 2,9 x 5,6 m.
            const stripeGeometry = new THREE.BoxGeometry(0.09, 0.025, PARKING_STALL_DEPTH);
            const stripeMesh = new THREE.InstancedMesh(stripeGeometry, roadLineMat, stripeTransforms.length);
            const stripeMatrix = new THREE.Matrix4();
            stripeTransforms.forEach((transform, index) => {
                stripeMatrix.makeTranslation(transform.x, 0.058, transform.z);
                stripeMesh.setMatrixAt(index, stripeMatrix);
            });
            stripeMesh.instanceMatrix.needsUpdate = true;
            scene.add(stripeMesh);

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

            // Vegetación desplazada fuera de las calzadas y estacionamientos.
            for (let i = -140; i <= 140; i += 40) {
                if (Math.abs(i) < 20) continue;
                if (i !== -20) createPalm(i, 176);
                createPalm(i, -176);
                createPalm(176, i); createPalm(-176, i);
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

            window.setMallShadowMode?.(gr, { cast: true, receive: true });
            scene.add(gr);
            registerCollider(x, z, 2.5, 2.5, 0, 4);
        }
        function createBench(x, z, rot) {
            const gr = new THREE.Group(); gr.position.set(x, 0.1, z); gr.rotation.y = rot;
            const benchId = `bench:ground:${x.toFixed(2)}:${z.toFixed(2)}:${rot.toFixed(3)}`;
            gr.name = benchId;
            gr.userData.mallEditableId = benchId;
            const base = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 1.5), darkMat); base.position.y = 0.1; gr.add(base);
            const seat = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.4, 1.7), new THREE.MeshStandardMaterial({ color: 0x242424, roughness: 0.48, metalness: 0.06 })); seat.position.y = 0.4; gr.add(seat);
            window.setMallShadowMode?.(gr, { cast: true, receive: true });
            scene.add(gr);
                window.registerMallEditableObject?.(gr, {
                    id: benchId,
                    type: 'bench',
                    deletable: true,
                    label: `Banca (${x.toFixed(1)}, ${z.toFixed(1)})`,
                areaCode: 'mall-ground'
            });
            registerRotatedSolidFootprint(x, z, 4.4, 1.9, rot, 0, 2.6, benchId);
        }

        // FUENTE CENTRAL
        function createCentralFountain() {
            const gr = new THREE.Group(); gr.position.set(0, 0.1, 0);
            const basin = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.5, 0.8, 32), new THREE.MeshStandardMaterial({ color: 0xc8c6c2, roughness: 0.52, metalness: 0.08 })); gr.add(basin);
            const water = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, 0.1, 32), new THREE.MeshPhysicalMaterial({ color: 0x78bde8, transmission: 0.58, transparent: true, opacity: 0.62, roughness: 0.08, metalness: 0.0, clearcoat: 0.5, clearcoatRoughness: 0.08 }));
            water.position.y = 0.4; gr.add(water);
            const monolith = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 2), goldMat);
            monolith.position.y = 3;
            monolith.name = 'mallIntroMonolith';
            monolith.userData.isMallIntroTrigger = true;
            monolith.userData.displayName = 'Introducción del Mall';
            gr.add(monolith);

            const labelCanvas = document.createElement('canvas');
            labelCanvas.width = 1024;
            labelCanvas.height = 256;
            const labelCtx = labelCanvas.getContext('2d');
            labelCtx.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
            labelCtx.fillStyle = 'rgba(12, 12, 12, 0.94)';
            labelCtx.strokeStyle = '#d8b45f';
            labelCtx.lineWidth = 8;
            labelCtx.beginPath();
            labelCtx.roundRect(12, 12, 1000, 232, 28);
            labelCtx.fill();
            labelCtx.stroke();
            labelCtx.font = '700 78px Georgia, serif';
            labelCtx.textAlign = 'center';
            labelCtx.textBaseline = 'middle';
            labelCtx.fillStyle = '#e4c16d';
            labelCtx.shadowColor = 'rgba(228, 193, 109, 0.55)';
            labelCtx.shadowBlur = 18;
            labelCtx.fillText('INSTRUCCIONES', 512, 132);

            const labelTexture = new THREE.CanvasTexture(labelCanvas);
            labelTexture.colorSpace = THREE.SRGBColorSpace;
            labelTexture.needsUpdate = true;
            const labelMaterial = new THREE.MeshBasicMaterial({
                map: labelTexture,
                transparent: true,
                toneMapped: false,
                depthWrite: false
            });
            const addInstructionLabel = (x, z, rotationY) => {
                const label = new THREE.Mesh(new THREE.PlaneGeometry(1.84, 0.46), labelMaterial);
                // El rótulo es hijo del monolito, cuyo origen ya está a 3 m:
                // y=0 lo sitúa exactamente a media altura, frente a la mirada.
                label.position.set(x, 0, z);
                label.rotation.y = rotationY;
                label.renderOrder = 12;
                label.name = 'mallIntroInstructionsLabel';
                monolith.add(label);
            };
            addInstructionLabel(0, 1.011, 0);
            addInstructionLabel(0, -1.011, Math.PI);
            addInstructionLabel(1.011, 0, Math.PI / 2);
            addInstructionLabel(-1.011, 0, -Math.PI / 2);

            window.mallIntroTargets = Array.isArray(window.mallIntroTargets) ? window.mallIntroTargets : [];
            window.mallIntroTargets.push(monolith);
            window.setMallShadowMode?.(gr, { cast: true, receive: true });
            scene.add(gr);
            // El radio corporal (0.4 m) completa la huella hasta el borde visible de 7.5 m.
            registerCircularCollider(0, 0, 7.1, 0, 4.8);
        }

        // PANTALLAS DIGITALES LED CON ROTACIÓN
        const CENTRAL_AD_CANVAS_W = IS_COARSE_POINTER ? 512 : 1024;
        const CENTRAL_AD_CANVAS_H = IS_COARSE_POINTER ? 256 : 512;

        function drawWrappedAdText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
            const words = String(text || "").split(/\s+/).filter(Boolean);
            let line = "";
            let lines = 0;
            words.forEach((word) => {
                if (lines >= maxLines) return;
                const test = line ? `${line} ${word}` : word;
                if (ctx.measureText(test).width > maxWidth && line) {
                    ctx.fillText(line, x, y + lines * lineHeight);
                    line = word;
                    lines += 1;
                } else {
                    line = test;
                }
            });
            if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineHeight);
        }

        function normalizeAdPrice(price = "") {
            const raw = String(price || "").trim();
            if (!raw || raw === "-") return "consultar precio";
            const digits = raw.replace(/[^\d]/g, "");
            if (digits.length >= 4) {
                return `$ ${Number(digits).toLocaleString('es-CL')}`;
            }
            if (raw.startsWith("$")) return raw.replace(/^\$\s*/, "$ ");
            return `$ ${raw}`;
        }

        function drawCatalogAdBase(ctx, ad, imageReady = false, image = null) {
            const w = CENTRAL_AD_CANVAS_W;
            const h = CENTRAL_AD_CANVAS_H;
            ctx.clearRect(0, 0, w, h);
            const gradient = ctx.createLinearGradient(0, 0, w, h);
            gradient.addColorStop(0, "#0d0d0d");
            gradient.addColorStop(0.52, "#17130b");
            gradient.addColorStop(1, "#2b2415");
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, w, h);

            ctx.strokeStyle = "#c5a059";
            ctx.lineWidth = IS_COARSE_POINTER ? 8 : 12;
            ctx.strokeRect(18, 18, w - 36, h - 36);

            const pad = IS_COARSE_POINTER ? 34 : 58;
            const imageX = Math.round(w * 0.62);
            const imageY = pad;
            const imageW = w - imageX - pad;
            const imageH = h - pad * 2;

            ctx.fillStyle = "#f7f2e8";
            ctx.font = `bold ${IS_COARSE_POINTER ? 20 : 38}px Arial, sans-serif`;
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            drawWrappedAdText(ctx, `Visite la tienda ${ad.storeName}`, pad, pad, imageX - pad * 1.6, IS_COARSE_POINTER ? 26 : 48, 2);

            ctx.fillStyle = "#c5a059";
            ctx.font = `bold ${IS_COARSE_POINTER ? 16 : 27}px Arial, sans-serif`;
            drawWrappedAdText(ctx, `y sorpréndase con sus productos como: ${ad.productOne} o ${ad.productTwo}`, pad, IS_COARSE_POINTER ? 102 : 190, imageX - pad * 1.55, IS_COARSE_POINTER ? 22 : 36, 3);

            ctx.fillStyle = "#ffffff";
            ctx.font = `bold ${IS_COARSE_POINTER ? 18 : 34}px Arial, sans-serif`;
            drawWrappedAdText(ctx, `a solo ${normalizeAdPrice(ad.price)}`, pad, h - (IS_COARSE_POINTER ? 72 : 116), imageX - pad * 1.55, IS_COARSE_POINTER ? 24 : 42, 1);

            ctx.fillStyle = "#f4f4f4";
            ctx.fillRect(imageX, imageY, imageW, imageH);
            ctx.strokeStyle = "rgba(197, 160, 89, 0.65)";
            ctx.lineWidth = IS_COARSE_POINTER ? 4 : 7;
            ctx.strokeRect(imageX, imageY, imageW, imageH);

            if (imageReady && image) {
                const imgRatio = image.width / image.height;
                const boxRatio = imageW / imageH;
                let drawW = imageW;
                let drawH = imageH;
                let drawX = imageX;
                let drawY = imageY;
                if (imgRatio > boxRatio) {
                    drawH = imageW / imgRatio;
                    drawY = imageY + (imageH - drawH) / 2;
                } else {
                    drawW = imageH * imgRatio;
                    drawX = imageX + (imageW - drawW) / 2;
                }
                ctx.drawImage(image, drawX, drawY, drawW, drawH);
            } else {
                ctx.fillStyle = "#777";
                ctx.font = `bold ${IS_COARSE_POINTER ? 16 : 26}px Arial, sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("Producto destacado", imageX + imageW / 2, imageY + imageH / 2);
            }
        }

        function createFallbackAdTexture(text = "CATÁLOGOS DEL MALL") {
            const canvas = document.createElement('canvas');
            canvas.width = CENTRAL_AD_CANVAS_W;
            canvas.height = CENTRAL_AD_CANVAS_H;
            const ctx = canvas.getContext('2d');
            drawCatalogAdBase(ctx, {
                storeName: "nuestros locatarios",
                productOne: "novedades",
                productTwo: "productos exclusivos",
                price: "consultar"
            });
            ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#f7f2e8";
            ctx.font = `bold ${IS_COARSE_POINTER ? 26 : 48}px Arial, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, canvas.width / 2, canvas.height / 2);
            const tex = new THREE.CanvasTexture(canvas);
            tex.needsUpdate = true;
            return tex;
        }

        function createCatalogAdTexture(ad) {
            const canvas = document.createElement('canvas');
            canvas.width = CENTRAL_AD_CANVAS_W;
            canvas.height = CENTRAL_AD_CANVAS_H;
            const ctx = canvas.getContext('2d');
            const tex = new THREE.CanvasTexture(canvas);
            tex.needsUpdate = true;
            drawCatalogAdBase(ctx, ad);

            if (ad.imageUrl) {
                const image = new Image();
                image.crossOrigin = "anonymous";
                image.onload = () => {
                    try {
                        drawCatalogAdBase(ctx, ad, true, image);
                        tex.needsUpdate = true;
                    } catch (error) {
                        console.warn("No pude dibujar imagen de anuncio:", error);
                    }
                };
                image.src = ad.imageUrl;
            }
            return tex;
        }

        const adTextures = [createFallbackAdTexture()];

        const screenMeshes = [];
        window.mallAdTextures = adTextures;
        window.mallAdScreenMeshes = screenMeshes;
        function createDigitalScreen(x, y, z, rot) {
            const gr = new THREE.Group(); gr.position.set(x, y, z); gr.rotation.y = rot;
            const frame = new THREE.Mesh(new THREE.BoxGeometry(10.2, 5.2, 0.4), darkMat); gr.add(frame);
            const screen = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshBasicMaterial({ map: adTextures[0] }));
            screen.position.z = 0.21; gr.add(screen);
            const backScreen = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshBasicMaterial({ map: adTextures[0] }));
            backScreen.rotation.y = Math.PI;
            backScreen.position.z = -0.21;
            gr.add(backScreen);
            screenMeshes.push(screen, backScreen);
            scene.add(gr);
        }

        function shuffleAdItems(items = []) {
            const copy = [...items];
            for (let i = copy.length - 1; i > 0; i -= 1) {
                const j = Math.floor(Math.random() * (i + 1));
                [copy[i], copy[j]] = [copy[j], copy[i]];
            }
            return copy;
        }

        function getAdStoreCode(store) {
            if (!store) return "";
            return String(store.local_code || store.shopCode || store.shop_code || store.code || store.id || "").trim();
        }

        function getAdCodeCandidates(value = "") {
            const raw = String(value || "").trim();
            if (!raw) return [];
            const compact = raw.replace(/-/g, "");
            const hyphenated = compact.replace(/^([A-Z]+)(\d+)$/i, "$1-$2").toUpperCase();
            return [...new Set([raw, raw.toUpperCase(), compact, compact.toUpperCase(), hyphenated].filter(Boolean))];
        }

        async function loadCentralCatalogAds() {
            if (!supabaseClient) return;
            try {
                const { stores, products: catalogProducts } = await window.mallCatalogRequests.getData();
                const products = catalogProducts.filter(product =>
                    product &&
                    (product.name || product.n) &&
                    (product.price || product.p)
                );
                if (!stores.length || !products.length) {
                    console.log("[Ads] No hay tiendas o productos suficientes para publicidad central.");
                    return;
                }

                const storeByKey = new Map();
                stores.forEach((store) => {
                    const keys = [
                        store.id,
                        getAdStoreCode(store),
                        ...getAdCodeCandidates(getAdStoreCode(store))
                    ].filter(Boolean);
                    keys.forEach(key => storeByKey.set(String(key).toLowerCase(), store));
                });

                const productsByStore = new Map();
                products.forEach((product) => {
                    const keys = [
                        product.store_id,
                        product.local_code,
                        ...getAdCodeCandidates(product.local_code)
                    ].filter(Boolean);
                    let matchedStore = null;
                    for (const key of keys) {
                        matchedStore = storeByKey.get(String(key).toLowerCase());
                        if (matchedStore) break;
                    }
                    if (!matchedStore) return;
                    const storeCode = getAdStoreCode(matchedStore) || matchedStore.id;
                    if (!productsByStore.has(storeCode)) {
                        productsByStore.set(storeCode, { store: matchedStore, products: [] });
                    }
                    productsByStore.get(storeCode).products.push(product);
                });

                const ads = shuffleAdItems([...productsByStore.values()]
                    .filter(entry => entry.products.length > 0)
                    .map((entry) => {
                        const orderedProducts = shuffleAdItems(entry.products).sort((a, b) => Number(!!b.image_url) - Number(!!a.image_url));
                        const first = orderedProducts[0];
                        const second = orderedProducts[1] || orderedProducts[0];
                        return {
                            storeName: entry.store.name || getAdStoreCode(entry.store) || "este local",
                            storeCode: getAdStoreCode(entry.store),
                            productOne: first.name || first.n || "Producto",
                            productTwo: second.name || second.n || "otro producto",
                            price: first.price || first.p || "",
                            imageUrl: first.image_url || "",
                            description: first.description || ""
                        };
                    }))
                    .slice(0, 12);

                if (!ads.length) {
                    console.log("[Ads] No encontre productos vinculados a tiendas para publicidad central.");
                    return;
                }
                adTextures.splice(0, adTextures.length, ...ads.map(createCatalogAdTexture));
                screenMeshes.forEach((screen, index) => {
                    if (!screen?.material) return;
                    screen.material.map = adTextures[Math.floor(index / 2) % adTextures.length];
                    screen.material.needsUpdate = true;
                });
                window.centralCatalogAds = ads;
                console.log(`[Ads] Publicidad central cargada: ${ads.length} tienda(s) con productos.`);
            } catch (error) {
                console.warn("[Ads] No pude cargar publicidad de catálogos:", error);
            }
        }

        function scheduleCentralCatalogAds(attempt = 1) {
            setTimeout(async () => {
                if (typeof supabaseClient === "undefined" || !supabaseClient) {
                    if (attempt < 6) {
                        scheduleCentralCatalogAds(attempt + 1);
                    } else {
                        console.log("[Ads] Supabase no disponible para publicidad central.");
                    }
                    return;
                }
                await loadCentralCatalogAds();
            }, attempt === 1 ? 1800 : 1400);
        }

        window.loadCentralCatalogAds = loadCentralCatalogAds;
        scheduleCentralCatalogAds();

        function createEscalatorTexture(isUp = true) {
            const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
            const ctx = canvas.getContext('2d');
            const accent = isUp ? '#63d59a' : '#e6a34a';
            const accentSoft = isUp ? 'rgba(99,213,154,0.42)' : 'rgba(230,163,74,0.44)';
            const accentCore = isUp ? 'rgba(200,255,224,0.82)' : 'rgba(255,218,160,0.86)';

            ctx.fillStyle = '#8f9292';
            ctx.fillRect(0, 0, 128, 128);

            const baseGradient = ctx.createLinearGradient(0, 0, 128, 0);
            baseGradient.addColorStop(0, '#6f7373');
            baseGradient.addColorStop(0.18, '#a9adad');
            baseGradient.addColorStop(0.5, '#c8cccc');
            baseGradient.addColorStop(0.82, '#a3a7a7');
            baseGradient.addColorStop(1, '#6c7070');
            ctx.fillStyle = baseGradient;
            ctx.fillRect(0, 0, 128, 128);

            for (let y = 0; y < 128; y += 14) {
                ctx.fillStyle = '#f3f4f0';
                ctx.fillRect(8, y, 112, 2);
                ctx.fillStyle = '#5c6060';
                ctx.fillRect(8, y + 2, 112, 2);
                ctx.fillStyle = 'rgba(255,255,255,0.18)';
                ctx.fillRect(14, y + 6, 100, 1);
            }

            ctx.strokeStyle = accentSoft;
            ctx.lineWidth = 4;
            ctx.lineJoin = 'round';
            for (let y = -18; y < 146; y += 28) {
                ctx.beginPath();
                ctx.moveTo(44, y + 19);
                ctx.lineTo(64, y + 7);
                ctx.lineTo(84, y + 19);
                ctx.stroke();
            }

            const flowGradient = ctx.createLinearGradient(0, 0, 128, 0);
            flowGradient.addColorStop(0, 'rgba(255,255,255,0)');
            flowGradient.addColorStop(0.3, accentSoft);
            flowGradient.addColorStop(0.5, accentCore);
            flowGradient.addColorStop(0.7, accentSoft);
            flowGradient.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = flowGradient;
            for (let y = 3; y < 128; y += 28) {
                ctx.fillRect(14, y, 100, 3);
            }

            ctx.fillStyle = '#ffcc00';
            ctx.fillRect(0, 0, 5, 128);
            ctx.fillRect(123, 0, 5, 128);
            ctx.fillStyle = accent;
            ctx.fillRect(6, 0, 2, 128);
            ctx.fillRect(120, 0, 2, 128);

            const tex = new THREE.CanvasTexture(canvas);
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.encoding = THREE.sRGBEncoding;
            tex.wrapT = tex.wrapS = THREE.RepeatWrapping;
            tex.repeat.set(1, 15);
            return tex;
        }

        function createEscalatorStepVisualMaterial(flowDirection = 1, repeatLength = 15, isUp = true) {
            const tex = createEscalatorTexture(isUp);
            tex.repeat.set(1, Math.max(6, repeatLength));
            tex.offset.set(0, 0);
            const mat = new THREE.MeshStandardMaterial({
                color: 0xaaaaaa,
                map: tex,
                emissive: isUp ? 0x12351f : 0x35200d,
                emissiveIntensity: 0.18,
                metalness: 0.72,
                roughness: 0.24,
                polygonOffset: true,
                polygonOffsetFactor: -8,
                polygonOffsetUnits: -8,
                depthWrite: false
            });
            escalatorVisualMaterials.push({
                texture: tex,
                direction: Math.sign(flowDirection || 1),
                speed: 1.15
            });
            return mat;
        }

        function updateEscalatorStepVisuals(deltaSec = 1 / 60) {
            escalatorVisualMaterials.forEach((entry) => {
                if (!entry?.texture) return;
                entry.texture.offset.y = (entry.texture.offset.y + deltaSec * entry.speed * entry.direction) % 1;
            });
        }

        function createEscalator(x, zStart, zEnd, up = true) {
            const h = 5.4;
            let dist = zEnd - zStart;
            const originalFlatLen = ESCALATOR_FLAT_LEN;
            const lowerFlatLen = originalFlatLen * 0.5;
            // La tangencia superior replica exactamente los 2 m medidos entre
            // el retorno inferior y el comienzo de su pendiente.
            const upperFlatLen = lowerFlatLen;
            const gr = new THREE.Group(); gr.position.set(x, -0.53, zStart);
            const dir = Math.sign(dist);
            const pathLenZ = Math.abs(dist);
            const lowerLandingStart = originalFlatLen - lowerFlatLen;
            const diagonalStart = originalFlatLen;
            const upperLandingEnd = pathLenZ;
            const diagonalEnd = upperLandingEnd - upperFlatLen;
            const effectivePathLen = upperLandingEnd - lowerLandingStart;
            const lowerPathZ = zStart + lowerLandingStart * dir;
            const upperPathZ = zStart + upperLandingEnd * dir;
            const travelStartZ = up ? lowerPathZ : upperPathZ;
            const travelDir = up ? dir : -dir;
            const diagLenZ = Math.max(0.001, diagonalEnd - diagonalStart);
            const pathStartY = up ? ESCALATOR_RIDE_Y_BOTTOM : ESCALATOR_RIDE_Y_TOP;
            const pathEndY = up ? ESCALATOR_RIDE_Y_TOP : ESCALATOR_RIDE_Y_BOTTOM;

            // Guardar para colisiones (enrasado al suelo -0.53)
            escalatorList.push({
                id: escalatorList.length,
                x,
                xMin: x - 2.5,
                xMax: x + 2.5,
                zMin: Math.min(lowerPathZ, upperPathZ),
                zMax: Math.max(lowerPathZ, upperPathZ),
                up,
                yStart: -0.53,
                yEnd: h - 0.53,
                xStart: x,
                xEnd: x,
                zStart: lowerPathZ,
                zEnd: upperPathZ,
                travelStartX: x,
                travelStartZ,
                travelDir,
                axis: 'z',
                dir,
                flatLen: up ? lowerFlatLen : upperFlatLen,
                pathLenZ: effectivePathLen,
                diagLenZ,
                pathStartY,
                pathEndY
            });

            const matGrey = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5 });
            const stepFlowDirection = dir * (up ? 1 : -1);
            const matStep = createEscalatorStepVisualMaterial(stepFlowDirection, Math.max(10, Math.round(effectivePathLen * 0.95)), up);
            const matLowerLanding = createEscalatorStepVisualMaterial(stepFlowDirection, Math.max(6, Math.round(lowerFlatLen * 3.5)), up);
            const matUpperLanding = createEscalatorStepVisualMaterial(stepFlowDirection, Math.max(6, Math.round(upperFlatLen * 3.5)), up);

            const ang = Math.atan2(h, diagLenZ);
            const diagLenH = Math.sqrt(h * h + diagLenZ * diagLenZ);

            const cw = (w, h_box, d, px, py, pz, mat, rx = 0) => {
                const b = new THREE.Mesh(getMallBoxGeometry(w, h_box, d), mat);
                b.position.set(px, py, pz); b.rotation.x = rx; gr.add(b);
                return b;
            };

            const addConventionalHandrail = (side) => {
                const radius = 0.48;
                const kappa = 0.5522847498;
                const lowerTopY = 1.8;
                const upperTopY = h + 1.8;
                const lowerReturnY = lowerTopY - radius * 2;
                const upperReturnY = upperTopY - radius * 2;
                const hiddenInset = diagonalStart + 0.7;
                const upperHiddenInset = diagonalEnd - 0.7;
                const localPoint = (travel, y) => new THREE.Vector3(side, y, travel * dir);

                const path = new THREE.CurvePath();

                // El retorno inferior se pierde dentro de la carcasa al comenzar la pendiente.
                path.add(new THREE.LineCurve3(
                    localPoint(hiddenInset, lowerReturnY),
                    localPoint(lowerLandingStart + radius, lowerReturnY)
                ));

                const lowerCenterY = lowerTopY - radius;
                path.add(new THREE.CubicBezierCurve3(
                    localPoint(lowerLandingStart + radius, lowerReturnY),
                    localPoint(lowerLandingStart + radius - radius * kappa, lowerReturnY),
                    localPoint(lowerLandingStart, lowerCenterY - radius * kappa),
                    localPoint(lowerLandingStart, lowerCenterY)
                ));
                path.add(new THREE.CubicBezierCurve3(
                    localPoint(lowerLandingStart, lowerCenterY),
                    localPoint(lowerLandingStart, lowerCenterY + radius * kappa),
                    localPoint(lowerLandingStart + radius - radius * kappa, lowerTopY),
                    localPoint(lowerLandingStart + radius, lowerTopY)
                ));

                path.add(new THREE.LineCurve3(
                    localPoint(lowerLandingStart + radius, lowerTopY),
                    localPoint(diagonalStart, lowerTopY)
                ));
                path.add(new THREE.LineCurve3(
                    localPoint(diagonalStart, lowerTopY),
                    localPoint(diagonalEnd, upperTopY)
                ));
                path.add(new THREE.LineCurve3(
                    localPoint(diagonalEnd, upperTopY),
                    localPoint(upperLandingEnd - radius, upperTopY)
                ));

                const upperCenterY = upperTopY - radius;
                path.add(new THREE.CubicBezierCurve3(
                    localPoint(upperLandingEnd - radius, upperTopY),
                    localPoint(upperLandingEnd - radius + radius * kappa, upperTopY),
                    localPoint(upperLandingEnd, upperCenterY + radius * kappa),
                    localPoint(upperLandingEnd, upperCenterY)
                ));
                path.add(new THREE.CubicBezierCurve3(
                    localPoint(upperLandingEnd, upperCenterY),
                    localPoint(upperLandingEnd, upperCenterY - radius * kappa),
                    localPoint(upperLandingEnd - radius + radius * kappa, upperReturnY),
                    localPoint(upperLandingEnd - radius, upperReturnY)
                ));

                path.add(new THREE.LineCurve3(
                    localPoint(upperLandingEnd - radius, upperReturnY),
                    localPoint(upperHiddenInset, upperReturnY)
                ));

                const geometry = new THREE.TubeGeometry(path, 128, 0.075, 12, false);
                const handrail = new THREE.Mesh(geometry, darkMat);
                handrail.name = 'central-escalator-conventional-handrail';
                gr.add(handrail);

                const housingWidth = 0.38;
                const housingHeight = 0.46;
                const lowerHousingLength = hiddenInset - (lowerLandingStart + radius);
                const lowerHousingCenter = (hiddenInset + lowerLandingStart + radius) / 2;
                const upperHousingLength = (upperLandingEnd - radius) - upperHiddenInset;
                const upperHousingCenter = (upperHiddenInset + upperLandingEnd - radius) / 2;

                const lowerHousing = cw(
                    housingWidth,
                    housingHeight,
                    lowerHousingLength,
                    side,
                    lowerReturnY,
                    lowerHousingCenter * dir,
                    matGrey
                );
                lowerHousing.name = 'central-escalator-lower-handrail-housing';

                const upperHousing = cw(
                    housingWidth,
                    housingHeight,
                    upperHousingLength,
                    side,
                    upperReturnY,
                    upperHousingCenter * dir,
                    matGrey
                );
                upperHousing.name = 'central-escalator-upper-handrail-housing';
            };

            cw(3.5, 1.2, lowerFlatLen, 0, 0, (lowerLandingStart + lowerFlatLen / 2) * dir, matGrey);
            cw(3.5, 1.2, diagLenH, 0, h / 2, (diagonalStart + diagLenZ / 2) * dir, matGrey, -ang * dir);
            cw(3.5, 1.2, upperFlatLen, 0, h, (diagonalEnd + upperFlatLen / 2) * dir, matGrey);

            const lowerLandingTread = cw(2.5, 0.08, lowerFlatLen, 0, 0.72, (lowerLandingStart + lowerFlatLen / 2) * dir, matLowerLanding);
            lowerLandingTread.renderOrder = 40;
            const diagonalTread = cw(2.62, 0.055, diagLenH, 0, h / 2 + 0.88, (diagonalStart + diagLenZ / 2) * dir, matStep, -ang * dir);
            diagonalTread.renderOrder = 40;
            const upperLandingTread = cw(2.5, 0.08, upperFlatLen, 0, h + 0.72, (diagonalEnd + upperFlatLen / 2) * dir, matUpperLanding);
            upperLandingTread.renderOrder = 40;

            [1.4, -1.4].forEach(side => {
                cw(0.05, 1.2, lowerFlatLen, side, 1.2, (lowerLandingStart + lowerFlatLen / 2) * dir, glassMat);
                cw(0.05, 1.2, diagLenH, side, h / 2 + 1.2, (diagonalStart + diagLenZ / 2) * dir, glassMat, -ang * dir);
                cw(0.05, 1.2, upperFlatLen, side, h + 1.2, (diagonalEnd + upperFlatLen / 2) * dir, glassMat);
                addConventionalHandrail(side);
            });
            scene.add(gr);
        }

        function getEscalatorProgressAtPosition(escalator, x, z) {
            if (escalator.ridePath) {
                const { startX, startZ, dx, dz, len } = escalator.ridePath;
                const lengthSquared = (dx * dx) + (dz * dz);
                const projectedDistance = lengthSquared > 0.000001
                    ? (((x - startX) * dx) + ((z - startZ) * dz)) / Math.sqrt(lengthSquared)
                    : 0;
                return THREE.MathUtils.clamp(projectedDistance, 0, len);
            }
            if (escalator.axis === 'x') {
                return THREE.MathUtils.clamp((x - escalator.travelStartX) * escalator.travelDir, 0, escalator.pathLenZ);
            }
            return THREE.MathUtils.clamp((z - escalator.travelStartZ) * escalator.travelDir, 0, escalator.pathLenZ);
        }

        function getEscalatorTravelDirection(escalator) {
            if (escalator.ridePath) {
                const { dx, dz, len } = escalator.ridePath;
                return new THREE.Vector3(dx / len, 0, dz / len);
            }
            return escalator.axis === 'x'
                ? new THREE.Vector3(escalator.travelDir, 0, 0)
                : new THREE.Vector3(0, 0, escalator.travelDir);
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
            if (escalator.ridePath) {
                const { startX, startZ, dx, dz, len } = escalator.ridePath;
                const pathT = p / len;
                return new THREE.Vector3(
                    startX + dx * pathT,
                    getEscalatorRideYAtProgress(escalator, p) + eyeOffset,
                    startZ + dz * pathT
                );
            }
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
            const direction = getEscalatorTravelDirection(escalator);
            exitPos.x += direction.x * extraForward;
            exitPos.z += direction.z * extraForward;
            return exitPos;
        }

        function getEscalatorLandingTransform(escalator, eyeOffset = 0) {
            if (escalator.isAnchorEscalator) {
                const position = getEscalatorExitPosition(escalator, eyeOffset, 2.4);
                const direction = getEscalatorTravelDirection(escalator);
                return {
                    position,
                    target: new THREE.Vector3(
                        position.x + direction.x * 8.5,
                        position.y + 0.05,
                        position.z + direction.z * 8.5
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
                const showcaseVisuals = shop.getObjectByName("showcaseVisuals");

                const distance = Math.min(
                    getDistanceToBoutiqueVolume(shop, camera.position),
                    getDistanceToBoutiqueFront(shop, camera.position)
                );
                const facadeTargetFade = getBoutiqueFacadeFade(distance);
                const facadeCurrentFade = shop.userData.facadeVisualFade || 0;
                const facadeNextFade = THREE.MathUtils.lerp(facadeCurrentFade, facadeTargetFade, BOUTIQUE_FACADE_FADE_SMOOTHING);
                const shouldPreloadFacade = distance <= BOUTIQUE_FACADE_LOAD_DISTANCE;

                if (shouldPreloadFacade) {
                    if ((!shop.userData.storeVisualPayload || shop.userData.storeVisualPayload?.notFound) && !shop.userData.isLoadingVisuals && typeof loadStoreVisualsOnDemand === 'function') {
                        loadStoreVisualsOnDemand(shop);
                    }
                    if (typeof shop.userData.ensureFacadeStoreVisuals === 'function') {
                        shop.userData.ensureFacadeStoreVisuals();
                    }
                }
                if (showcaseVisuals) setGroupFade(showcaseVisuals, facadeNextFade);
                if (Array.isArray(shop.userData.doorFacadeVisualGroups)) {
                    shop.userData.doorFacadeVisualGroups.forEach((group) => setGroupFade(group, facadeNextFade));
                }
                setBoutiqueLogoFade(shop, facadeNextFade);
                shop.userData.facadeVisualFade = facadeNextFade;
                if (
                    window.mallPerformanceProfile?.isLowEndMobile
                    && facadeNextFade <= BOUTIQUE_DETAIL_FADE_EPSILON
                    && distance > BOUTIQUE_FACADE_LOAD_DISTANCE + 16
                    && typeof shop.userData.disposeFacadeStoreVisuals === 'function'
                ) {
                    shop.userData.disposeFacadeStoreVisuals();
                }

                if (!isWalking) {
                    shop.userData.interiorDetailFade = 0;
                    if (detailedInterior) setGroupFade(detailedInterior, 0);
                    if (dynamicInterior) setGroupFade(dynamicInterior, 0);
                    shop.userData.interiorDetailVisible = false;
                    return;
                }

                const targetFade = getBoutiqueInteriorFade(distance);
                const currentFade = shop.userData.interiorDetailFade || 0;
                const nextFade = THREE.MathUtils.lerp(currentFade, targetFade, BOUTIQUE_DETAIL_FADE_SMOOTHING);
                const shouldStreamInterior = targetFade > BOUTIQUE_DETAIL_STREAM_BUILD_THRESHOLD;

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
                if (
                    window.mallPerformanceProfile?.isLowEndMobile
                    && nextFade <= BOUTIQUE_DETAIL_FADE_EPSILON
                    && distance > BOUTIQUE_DETAIL_FAR_DISTANCE + 8
                    && typeof shop.userData.disposeDetailedInterior === 'function'
                ) {
                    shop.userData.disposeDetailedInterior();
                }
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
                if (
                    window.mallPerformanceProfile?.isLowEndMobile
                    && nextFade <= BOUTIQUE_DETAIL_FADE_EPSILON
                    && distance > ANCHOR_DETAIL_FAR_DISTANCE + 12
                    && typeof shop.userData.disposeDetailedInterior === 'function'
                ) {
                    shop.userData.disposeDetailedInterior();
                }
            });
        }

        const centralCornerBoutiqueFloorGeometryCache = new Map();
        function getCentralCornerBoutiqueFloorGeometry(cutSide) {
            if (centralCornerBoutiqueFloorGeometryCache.has(cutSide)) {
                return centralCornerBoutiqueFloorGeometryCache.get(cutSide);
            }

            const points = cutSide === 'left'
                ? [[-6, -9], [6, -9], [6, 9], [-3, 9], [-6, 6]]
                : [[-6, -9], [6, -9], [6, 6], [3, 9], [-6, 9]];
            const shape = new THREE.Shape();
            shape.moveTo(points[0][0], points[0][1]);
            points.slice(1).forEach(([x, z]) => shape.lineTo(x, z));
            shape.closePath();

            // La extrusión baja desde la cota superior del local, igual que la losa original.
            const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false });
            geometry.rotateX(Math.PI / 2);
            geometry.userData.mallSharedGeometry = true;
            centralCornerBoutiqueFloorGeometryCache.set(cutSide, geometry);
            return geometry;
        }

        const centralCornerBoutiqueCapGeometryCache = new Map();
        function getCentralCornerBoutiqueCapGeometry(cutSide) {
            if (centralCornerBoutiqueCapGeometryCache.has(cutSide)) {
                return centralCornerBoutiqueCapGeometryCache.get(cutSide);
            }

            // La cubierta sobresalía 10 cm respecto de la losa y dejaba franjas doradas.
            // Se replica el chaflán con ese margen para que no reaparezcan bajo el acabado.
            const points = cutSide === 'left'
                ? [[-6.1, -9.1], [6.1, -9.1], [6.1, 9.1], [-2.9, 9.1], [-6.1, 5.9]]
                : [[-6.1, -9.1], [6.1, -9.1], [6.1, 5.9], [2.9, 9.1], [-6.1, 9.1]];
            const shape = new THREE.Shape();
            shape.moveTo(points[0][0], points[0][1]);
            points.slice(1).forEach(([x, z]) => shape.lineTo(x, z));
            shape.closePath();

            const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
            geometry.rotateX(Math.PI / 2);
            geometry.userData.mallSharedGeometry = true;
            centralCornerBoutiqueCapGeometryCache.set(cutSide, geometry);
            return geometry;
        }

        function createBoutique(posX, posZ, rotY, walls, posY = 0, shopCode = "", fixedLeaves = [], physicalMeta = null) {
            const sh = new THREE.Group(); sh.position.set(posX, posY, posZ); sh.rotation.y = rotY;
            const plateCode = physicalMeta?.plateCode || shopCode;
            const catalogCode = plateCode || shopCode;
            const cornerQuadrant = String(physicalMeta?.quadrant || '');
            const cornerSx = cornerQuadrant.startsWith('xp_') ? 1 : -1;
            const cornerSz = cornerQuadrant.endsWith('_zp') ? 1 : -1;
            const isCentralCornerBoutique = Boolean(physicalMeta?.isCorner);
            const cornerChamferSide = !isCentralCornerBoutique
                ? ''
                : physicalMeta.cornerFacade === 'horizontal'
                    ? (cornerSx * cornerSz > 0 ? 'right' : 'left')
                    : (-cornerSx * cornerSz > 0 ? 'right' : 'left');
            sh.userData = {
                isBoutique: true,
                shopCode: catalogCode,
                hasGlass: (walls.left === 'glass' || walls.right === 'glass'),
                sourceShopCode: catalogCode,
                generatedShopCode: physicalMeta?.generatedCode || shopCode,
                physicalSpaceId: physicalMeta?.id || '',
                plateCode: plateCode,
                isCornerBoutique: Boolean(physicalMeta?.isCorner),
                cornerFacade: physicalMeta?.cornerFacade || '',
                cornerChamferSide,
                imageDisplaySurfaces: [],
                imageDisplaySlots: [],
                doorFacadeVisualGroups: []
            };
            if (physicalMeta) registerPhysicalSpace(sh, physicalMeta);
            const detailedInterior = new THREE.Group();
            detailedInterior.name = "boutiqueDetailedInterior";
            detailedInterior.visible = false;
            sh.add(detailedInterior);
            const boutiqueFloorGeometry = cornerChamferSide
                ? getCentralCornerBoutiqueFloorGeometry(cornerChamferSide)
                : getMallBoxGeometry(12, 0.2, 18);
            const f = new THREE.Mesh(boutiqueFloorGeometry, new THREE.MeshPhongMaterial({ color: 0x003366 }));
            f.position.y = cornerChamferSide ? 0.12 : 0.02;
            sh.add(f);
            const cw = (w, h, d, x, y, z, m, parent = sh) => { const mw = new THREE.Mesh(getMallBoxGeometry(w, h, d), m); mw.position.set(x, y, z); parent.add(mw); return mw; };
            let editableFurnitureIndex = 0;
            const registerBoutiqueFurniture = (object, kind) => {
                editableFurnitureIndex += 1;
                const id = `furniture:${physicalMeta?.id || catalogCode}:${kind}:${String(editableFurnitureIndex).padStart(2, '0')}`;
                object.name = id;
                object.userData.mallEditableId = id;
                window.setMallShadowMode?.(object, { cast: true, receive: true });
                window.registerMallEditableObject?.(object, {
                    id,
                    type: 'furniture',
                    deletable: true,
                    label: `${kind} de ${plateCode || shopCode}`,
                    areaCode: plateCode || shopCode
                });
            };
            const registerBoutiqueWall = (wall, face, isPartition = false) => {
                if (!wall || !physicalMeta?.id) return wall;
                const id = `wall:${physicalMeta.id}:${face}`;
                wall.name = wall.name || id;
                wall.userData.mallEditableId = id;
                window.registerMallEditableObject?.(wall, {
                    id,
                    type: 'wall',
                    deletable: isPartition === true,
                    label: `Muro ${face} de ${plateCode || shopCode}`,
                    areaCode: plateCode || shopCode
                });
                return wall;
            };
            const accentPalette = [0xc5a059, 0x6ea6d9, 0xb9875d, 0x8bbf7a, 0xd17f76];
            const paletteSeed = (shopCode || "B").split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
            const accentColor = accentPalette[paletteSeed % accentPalette.length];
            const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.58, metalness: 0.08 });
            const woodDarkMat = new THREE.MeshStandardMaterial({ color: 0x4f3923, roughness: 0.62, metalness: 0.05 });
            const stoneMat = new THREE.MeshStandardMaterial({ color: 0xd7d0c7, roughness: 0.54, metalness: 0.02 });
            const brassMat = new THREE.MeshStandardMaterial({ color: 0xc5a059, roughness: 0.32, metalness: 0.76 });
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
            const transverseWallHighlightMat = new THREE.MeshStandardMaterial({
                color: 0xff2448,
                emissive: 0x7a0018,
                emissiveIntensity: 0.55,
                roughness: 0.42,
                metalness: 0.04
            });
            const showPartitionCandidates = window.MALL_SHOW_PARTITION_CANDIDATES === true;
            const partitionWallMaterial = showPartitionCandidates ? transverseWallHighlightMat : whiteMat;
            const reviewBackWallIds = new Set([
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
            const reviewLeftWallIds = new Set([
                'phys_b_f2_xn_zn_vertical_07',
                'phys_b_f2_xp_zp_vertical_07',
                'phys_b_f2_xp_zp_vertical_06'
            ]);
            const reviewRightWallIds = new Set([
                'phys_b_f2_xp_zn_vertical_07',
                'phys_b_f2_xp_zp_vertical_06'
            ]);
            const getMergedPartitionFace = () => {
                if (
                    physicalMeta?.kind !== 'boutique' ||
                    physicalMeta?.isCorner ||
                    (physicalMeta?.slotIndex !== 6 && physicalMeta?.slotIndex !== 7)
                ) return '';

                const siblingSlot = physicalMeta.slotIndex === 6 ? 7 : 6;
                const siblingId = String(physicalMeta.id || '').replace(/_(06|07)$/, `_${String(siblingSlot).padStart(2, '0')}`);
                if (!siblingId || siblingId === physicalMeta.id) return '';
                const siblingCode = resolvePhysicalPlateCode(siblingId, '');
                if (!siblingCode || siblingCode !== plateCode) return '';

                const rowDelta = siblingSlot === 7 ? 6 : -6;
                const quadrant = String(physicalMeta.quadrant || '');
                const dx = physicalMeta.axis === 'horizontal'
                    ? rowDelta * (quadrant.startsWith('xp_') ? 1 : -1)
                    : 0;
                const dz = physicalMeta.axis === 'vertical'
                    ? rowDelta * (quadrant.endsWith('_zp') ? 1 : -1)
                    : 0;
                const localPositiveXDot = dx * Math.cos(rotY) + dz * (-Math.sin(rotY));
                return localPositiveXDot >= 0 ? 'right' : 'left';
            };
            const mergedPartitionFace = getMergedPartitionFace();
            const highlightBackWall = reviewBackWallIds.has(physicalMeta?.id);
            const highlightLeftWall = reviewLeftWallIds.has(physicalMeta?.id) || mergedPartitionFace === 'left';
            const highlightRightWall = reviewRightWallIds.has(physicalMeta?.id) || mergedPartitionFace === 'right';
            const markPartitionCandidate = (wall, face) => {
                if (!wall) return wall;
                wall.name = `internal-partition-candidate-${plateCode || shopCode}-${face}`;
                wall.userData.isInternalPartitionCandidate = true;
                wall.userData.partitionFace = face;
                wall.userData.physicalSpaceId = physicalMeta?.id || '';
                wall.userData.displayCode = plateCode || shopCode;
                return wall;
            };

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
                registerBoutiqueFurniture(shelf, 'estanteria');
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
                registerBoutiqueFurniture(island, 'isla-central');
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
                registerBoutiqueFurniture(desk, 'mostrador');
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
                registerBoutiqueFurniture(vitrine, 'vitrina');
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
                registerBoutiqueFurniture(display, 'exhibidor');
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
                const runner = new THREE.Mesh(getMallPlaneGeometry(5.2, 0.7), glowMat);
                runner.rotation.x = Math.PI / 2;
                runner.position.set(0, 4.7, -2.2);
                sh.add(runner);
            };

            const configuredFurnitureLayout = window.MALL_STORE_FURNITURE_LAYOUTS?.[catalogCode] || null;
            const configuredPhysicalFurniture = configuredFurnitureLayout?.physicalSpaces?.[physicalMeta?.id] || null;
            const usesS107StandardFurniture = (
                physicalMeta?.kind === 'boutique' &&
                physicalMeta?.sizeClass === 'standard' &&
                !physicalMeta?.isCorner
            );

            const getConfiguredFurnitureFootprint = (item) => {
                const dimensionsByType = {
                    'cash-desk': [2.8, 1.15],
                    'front-vitrine': [1.65, 0.9]
                };
                const [baseWidth, baseDepth] = dimensionsByType[item.type] || [item.width, item.depth];
                const width = Number(baseWidth);
                const depth = Number(baseDepth);
                if (!Number.isFinite(width) || !Number.isFinite(depth)) return null;

                const rotationY = Number(item.rotationY) || 0;
                const projectedWidth = Math.abs(width * Math.cos(rotationY)) + Math.abs(depth * Math.sin(rotationY));
                const projectedDepth = Math.abs(width * Math.sin(rotationY)) + Math.abs(depth * Math.cos(rotationY));
                return { width: projectedWidth, depth: projectedDepth };
            };

            const isConfiguredFurnitureInsideSafeBounds = (item, safeBounds) => {
                if (!safeBounds) return false;
                const footprint = getConfiguredFurnitureFootprint(item);
                if (!footprint) return false;

                const halfWidth = footprint.width / 2;
                const halfDepth = footprint.depth / 2;
                return (
                    item.x - halfWidth >= safeBounds.minX &&
                    item.x + halfWidth <= safeBounds.maxX &&
                    item.z - halfDepth >= safeBounds.minZ &&
                    item.z + halfDepth <= safeBounds.maxZ
                );
            };

            const addConfiguredFurniture = (layout) => {
                if (!layout?.items?.length) return;

                layout.items.forEach((item) => {
                    if (!isConfiguredFurnitureInsideSafeBounds(item, layout.safeBounds)) {
                        console.warn(`[Mall] Mueble omitido por salir del limite seguro de ${catalogCode}:`, item);
                        return;
                    }

                    switch (item.type) {
                        case 'shelf-wall':
                            addShelfWall(item.x, item.z, item.width, item.depth, item.height, item.rotationY || 0);
                            break;
                        case 'center-island':
                            addCenterIsland(item.x, item.z, item.width, item.depth, item.height, Boolean(item.glassCap));
                            break;
                        case 'cash-desk':
                            addCashDesk(item.x, item.z);
                            break;
                        case 'front-vitrine':
                            addFrontVitrine(item.x, item.z);
                            break;
                        default:
                            console.warn(`[Mall] Tipo de mueble no reconocido para ${catalogCode}:`, item.type);
                    }
                });
            };

            const addS107StandardFurniture = () => {
                addShelfWall(-5.05, -0.8, 15.4, 0.72, 3.85, Math.PI / 2);
                addShelfWall(5.05, -0.8, 15.4, 0.72, 3.85, -Math.PI / 2);
                addShelfWall(0, -8.05, 8.4, 0.9, 3.9);
                addCenterIsland(-1.75, -1.6, 2.5, 1.35, 0.95, false);
                addCenterIsland(2.1, -4.25, 2.25, 1.2, 0.95, true);
                addCashDesk(4.35, 2.65);
                addWindowDisplay(-4.45);
                addWindowDisplay(4.45);
            };

            const addS106InteriorPictureFrame = () => {
                if (String(plateCode || '').toUpperCase() !== 'S-106') return;

                const frame = new THREE.Group();
                frame.name = 's106InteriorPictureFrame';
                frame.position.set(3.82, 2.68, -8.91);

                const frameWidth = 1.82;
                const frameHeight = 1.36;
                const frameDepth = 0.055;
                const rail = 0.075;
                const backing = new THREE.Mesh(
                    getMallPlaneGeometry(frameWidth - rail * 2, frameHeight - rail * 2),
                    new THREE.MeshBasicMaterial({ color: 0xeee9df, side: THREE.FrontSide })
                );
                backing.position.z = 0.012;
                frame.add(backing);

                const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x27231d, roughness: 0.48, metalness: 0.22 });
                const goldInsetMaterial = new THREE.MeshStandardMaterial({ color: 0xb8924e, roughness: 0.42, metalness: 0.46 });
                const horizontalRail = new THREE.BoxGeometry(frameWidth, rail, frameDepth);
                const verticalRail = new THREE.BoxGeometry(rail, frameHeight, frameDepth);
                const top = new THREE.Mesh(horizontalRail, frameMaterial);
                const bottom = new THREE.Mesh(horizontalRail, frameMaterial);
                const left = new THREE.Mesh(verticalRail, frameMaterial);
                const right = new THREE.Mesh(verticalRail, frameMaterial);
                top.position.set(0, frameHeight / 2, 0.02);
                bottom.position.set(0, -frameHeight / 2, 0.02);
                left.position.set(-frameWidth / 2, 0, 0.02);
                right.position.set(frameWidth / 2, 0, 0.02);
                frame.add(top, bottom, left, right);

                const goldTop = new THREE.Mesh(new THREE.BoxGeometry(frameWidth - 0.11, 0.018, 0.018), goldInsetMaterial);
                const goldBottom = goldTop.clone();
                const goldLeft = new THREE.Mesh(new THREE.BoxGeometry(0.018, frameHeight - 0.11, 0.018), goldInsetMaterial);
                const goldRight = goldLeft.clone();
                goldTop.position.set(0, frameHeight / 2 - rail - 0.012, 0.052);
                goldBottom.position.set(0, -frameHeight / 2 + rail + 0.012, 0.052);
                goldLeft.position.set(-frameWidth / 2 + rail + 0.012, 0, 0.052);
                goldRight.position.set(frameWidth / 2 - rail - 0.012, 0, 0.052);
                frame.add(goldTop, goldBottom, goldLeft, goldRight);

                const imageMount = new THREE.Group();
                imageMount.name = 's106InteriorPictureImageMount';
                imageMount.position.z = 0.058;
                frame.add(imageMount);
                sh.userData.s106InteriorPictureImageMount = imageMount;

                sh.add(frame);
                if (typeof sh.userData.refreshS106InteriorPicture === 'function') {
                    sh.userData.refreshS106InteriorPicture();
                }
            };

            // Iluminación techo (interior)
            const lightStrip = new THREE.Mesh(getMallPlaneGeometry(10, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
            lightStrip.rotation.x = Math.PI / 2; lightStrip.position.y = 4.75; sh.add(lightStrip);
            // Nota rendimiento: evitamos PointLight por local para no penalizar FPS/carga inicial.

            let backWall = null;
            let leftWall = null;
            let rightWall = null;
            if (walls.back && !hideRearWallForShop && shopCode !== "E207" && (!highlightBackWall || showPartitionCandidates)) {
                backWall = cw(12, 4.8, 0.1, 0, 2.4, -9, highlightBackWall ? partitionWallMaterial : whiteMat);
                registerBoutiqueWall(backWall, 'back', highlightBackWall);
                if (highlightBackWall) markPartitionCandidate(backWall, 'back');
            }
            if (walls.left !== false && shopCode !== "O206" && !hiddenLeftWallIds.has(physicalMeta?.id) && (!highlightLeftWall || showPartitionCandidates)) {
                leftWall = cw(0.1, 4.8, 18, -6, 2.4, 0, highlightLeftWall ? partitionWallMaterial : (walls.left === 'glass' ? glassMat : whiteMat));
                registerBoutiqueWall(leftWall, 'left', highlightLeftWall);
                if (highlightLeftWall) markPartitionCandidate(leftWall, 'left');
            }
            if (walls.right !== false && shopCode !== "E206" && !hiddenRightWallIds.has(physicalMeta?.id) && (!highlightRightWall || showPartitionCandidates)) {
                rightWall = cw(0.1, 4.8, 18, 6, 2.4, 0, highlightRightWall ? partitionWallMaterial : (walls.right === 'glass' ? glassMat : whiteMat));
                registerBoutiqueWall(rightWall, 'right', highlightRightWall);
                if (highlightRightWall) markPartitionCandidate(rightWall, 'right');
            }

            const doorH = 3.6; const shopH = 4.8; const frM = darkMat;
            const hasLeftChamferCut = cornerChamferSide === 'left';
            const hasRightChamferCut = cornerChamferSide === 'right';
            if (!hasLeftChamferCut) cw(2.8, shopH, 0.05, -4.5, shopH / 2, 9, glassMat);
            if (!hasRightChamferCut) cw(2.8, shopH, 0.05, 4.5, shopH / 2, 9, glassMat);
            cw(6, shopH - doorH, 0.05, 0, (shopH + doorH) / 2, 9, glassMat);

            const leftDoorLeaf = new THREE.Group();
            leftDoorLeaf.position.set(-1.5, doorH / 2, BOUTIQUE_DOOR_FRONT_Z);
            const rightDoorLeaf = new THREE.Group();
            rightDoorLeaf.position.set(1.5, doorH / 2, BOUTIQUE_DOOR_FRONT_Z);
            sh.add(leftDoorLeaf, rightDoorLeaf);
            // El streaming se ejecuta fuera de createBoutique: conservar estas
            // referencias permite montar afiches como hijos de cada hoja móvil.
            sh.userData.slidingDoorLeaves = { left: leftDoorLeaf, right: rightDoorLeaf };

            cw(2.9, doorH, 0.05, 0, 0, 0, glassMat, leftDoorLeaf);
            cw(2.9, doorH, 0.05, 0, 0, 0, glassMat, rightDoorLeaf);
            // El extremo de 3 m que se reemplaza por el chaflán queda sin zócalo.
            // Así no se reconstruye un triángulo metálico bajo el vidrio diagonal.
            if (hasLeftChamferCut) {
                cw(9.1, 0.2, 0.2, 1.55, 0.1, 9.05, frM);
            } else if (hasRightChamferCut) {
                cw(9.1, 0.2, 0.2, -1.55, 0.1, 9.05, frM);
            } else {
                cw(12.2, 0.2, 0.2, 0, 0.1, 9.05, frM);
            }
            // El travesaño superior replica el corte inferior: termina donde
            // comienza el vidrio diagonal y no forma una punta sobre la esquina.
            if (hasLeftChamferCut) {
                cw(9.1, 0.2, 0.2, 1.55, shopH, 9.05, frM);
            } else if (hasRightChamferCut) {
                cw(9.1, 0.2, 0.2, -1.55, shopH, 9.05, frM);
            } else {
                cw(12.2, 0.2, 0.2, 0, shopH, 9.05, frM);
            }
            if (!hasLeftChamferCut) cw(0.2, shopH, 0.2, -6, shopH / 2, 9.05, frM);
            if (!hasRightChamferCut) cw(0.2, shopH, 0.2, 6, shopH / 2, 9.05, frM);
            cw(0.2, shopH, 0.2, -3, shopH / 2, 9.05, frM);
            cw(0.2, shopH, 0.2, 3, shopH / 2, 9.05, frM);
            cw(6, 0.15, 0.2, 0, doorH, 9.05, frM);
            cw(0.1, 1.4, 0.1, 1.25, 0, 0.12, goldMat, leftDoorLeaf);
            cw(0.1, 1.4, 0.1, -1.25, 0, 0.12, goldMat, rightDoorLeaf);

            const registerImageDisplaySlot = (slot) => {
                sh.userData.imageDisplaySlots.push({
                    name: slot.name,
                    surface: slot.surface,
                    x: slot.x,
                    y: slot.y,
                    z: slot.z,
                    width: slot.width,
                    height: slot.height,
                    rotationY: slot.rotationY || 0
                });
            };

            const registerImageDisplaySurface = (surface) => {
                sh.userData.imageDisplaySurfaces.push(surface);
                (surface.slots || []).forEach(slot => registerImageDisplaySlot({ ...slot, surface: surface.name }));
            };

            if (!hasLeftChamferCut) {
                registerImageDisplaySurface({
                    name: 'front-left-glass',
                    kind: 'front',
                    slots: [
                        { name: 'front-left-low', x: -4.92, y: 1.55, z: 9.028, width: 1.28, height: 1.02 },
                        { name: 'front-left-mid', x: -4.12, y: 2.6, z: 9.028, width: 1.28, height: 1.02 },
                        { name: 'front-left-high', x: -4.88, y: 3.68, z: 9.028, width: 1.28, height: 1.02 }
                    ]
                });
            }
            if (!hasRightChamferCut) {
                registerImageDisplaySurface({
                    name: 'front-right-glass',
                    kind: 'front',
                    slots: [
                        { name: 'front-right-low', x: 4.12, y: 1.55, z: 9.028, width: 1.28, height: 1.02 },
                        { name: 'front-right-mid', x: 4.92, y: 2.6, z: 9.028, width: 1.28, height: 1.02 },
                        { name: 'front-right-high', x: 4.16, y: 3.68, z: 9.028, width: 1.28, height: 1.02 }
                    ]
                });
            }

            if (walls.left === 'glass') {
                registerImageDisplaySurface({
                    name: 'left-side-glass',
                    kind: 'side',
                    slots: [
                        { name: 'left-side-front-low', x: -5.972, y: 1.75, z: 5.8, width: 1.5, height: 1.05, rotationY: -Math.PI / 2 },
                        { name: 'left-side-front-high', x: -5.972, y: 3.05, z: 5.8, width: 1.5, height: 1.05, rotationY: -Math.PI / 2 },
                        { name: 'left-side-inner-low', x: -5.972, y: 1.75, z: 2.5, width: 1.5, height: 1.05, rotationY: -Math.PI / 2 }
                    ]
                });
            }
            if (walls.right === 'glass') {
                registerImageDisplaySurface({
                    name: 'right-side-glass',
                    kind: 'side',
                    slots: [
                        { name: 'right-side-front-low', x: 5.972, y: 1.75, z: 5.8, width: 1.5, height: 1.05, rotationY: Math.PI / 2 },
                        { name: 'right-side-front-high', x: 5.972, y: 3.05, z: 5.8, width: 1.5, height: 1.05, rotationY: Math.PI / 2 },
                        { name: 'right-side-inner-low', x: 5.972, y: 1.75, z: 2.5, width: 1.5, height: 1.05, rotationY: Math.PI / 2 }
                    ]
                });
            }

            if (shopCode !== "") {
                const idTex = createSmallIDTexture(plateCode);
                const idPlaque = new THREE.Mesh(getMallPlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: idTex, transparent: true }));
                idPlaque.userData.isStoreCodeSign = true;
                idPlaque.userData.isSign = true;
                idPlaque.userData.isCatalogTrigger = true;
                idPlaque.userData.shopCode = catalogCode;
                idPlaque.userData.sourceShopCode = catalogCode;
                idPlaque.userData.displayCode = plateCode;
                idPlaque.position.set(hasLeftChamferCut ? 4.85 : -4.85, 4.58, 9.18);
                sh.add(idPlaque);
                catalogClickTargets.push(idPlaque);

                // Invisible helper plane to make plaque clicks reliable for visitors.
                const idPlaqueHitbox = new THREE.Mesh(
                    getMallPlaneGeometry(1.95, 0.68),
                    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
                );
                idPlaqueHitbox.userData.isStoreCodeSign = true;
                idPlaqueHitbox.userData.isSign = true;
                idPlaqueHitbox.userData.isPlaqueHitbox = true;
                idPlaqueHitbox.userData.isCatalogTrigger = true;
                idPlaqueHitbox.userData.shopCode = catalogCode;
                idPlaqueHitbox.userData.sourceShopCode = catalogCode;
                idPlaqueHitbox.userData.displayCode = plateCode;
                idPlaqueHitbox.position.copy(idPlaque.position);
                idPlaqueHitbox.position.z += 0.02;
                idPlaqueHitbox.renderOrder = 60;
                sh.add(idPlaqueHitbox);
                catalogClickTargets.push(idPlaqueHitbox);

                // Amplia el objetivo táctil al paño superior sin volver interactiva la
                // fachada inferior, donde los visitantes caminan y orientan la cámara.
                const upperStorefrontHitbox = new THREE.Mesh(
                    getMallPlaneGeometry(11.8, shopH - doorH - 0.05),
                    new THREE.MeshBasicMaterial({
                        transparent: true,
                        opacity: 0,
                        depthWrite: false,
                        colorWrite: false,
                        side: THREE.DoubleSide
                    })
                );
                upperStorefrontHitbox.userData.isUpperStorefrontHitbox = true;
                upperStorefrontHitbox.userData.isCatalogTrigger = true;
                upperStorefrontHitbox.userData.shopCode = catalogCode;
                upperStorefrontHitbox.userData.sourceShopCode = catalogCode;
                upperStorefrontHitbox.userData.displayCode = plateCode;
                upperStorefrontHitbox.position.set(0, doorH + ((shopH - doorH) / 2), 9.3);
                sh.add(upperStorefrontHitbox);
                catalogClickTargets.push(upperStorefrontHitbox);
            }

            const logoBannerMat = new THREE.MeshBasicMaterial({
                transparent: true,
                alphaTest: 0.5,
                depthWrite: false,
                depthTest: true,
                side: THREE.FrontSide,
                polygonOffset: true,
                polygonOffsetFactor: -1,
                polygonOffsetUnits: -1
            });
            logoBannerMat.toneMapped = false;
            const logoBanner = new THREE.Mesh(getMallPlaneGeometry(BOUTIQUE_SIGN_WIDTH, BOUTIQUE_SIGN_HEIGHT), logoBannerMat);
            logoBanner.userData = { isSign: true, isLogoBanner: true, shopCode: catalogCode, sourceShopCode: catalogCode, displayCode: plateCode };
            logoBanner.visible = true;
            logoBanner.material.transparent = true;
            logoBanner.material.opacity = 0;
            logoBanner.position.set(0, doorH + ((shopH - doorH) / 2), 9.24);
            logoBanner.renderOrder = 24;
            sh.add(logoBanner);
            const boutiqueCapGeometry = cornerChamferSide
                ? getCentralCornerBoutiqueCapGeometry(cornerChamferSide)
                : getMallBoxGeometry(12.2, 0.3, 18.2);
            const r = new THREE.Mesh(boutiqueCapGeometry, goldMat);
            r.position.y = cornerChamferSide ? 5.35 : 5.2;
            sh.add(r);

            const ensureDetailedInterior = () => {
                if (sh.userData.detailedInteriorBuilt) return;
                const decorStartIndex = sh.children.length;

                // Ambientación interior tipo retail premium.
                cw(4.8, 0.02, 7.4, 0, 0.12, -2.2, new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.08 }));
                if (usesS107StandardFurniture) {
                    addS107StandardFurniture();
                } else if (configuredPhysicalFurniture) {
                    addConfiguredFurniture(configuredPhysicalFurniture);
                } else if (!configuredFurnitureLayout) {
                    if (!hideRearWallForShop && walls.left !== false) addShelfWall(-5.05, -0.8, 15.4, 0.72, 3.85, Math.PI / 2);
                    if (!hideRearWallForShop && walls.right !== false) addShelfWall(5.05, -0.8, 15.4, 0.72, 3.85, -Math.PI / 2);
                    if (walls.back && !hideRearWallForShop) {
                        addShelfWall(0, -8.05, 8.4, 0.9, 3.9, 0);
                    }
                    if (!hideRearWallForShop) addCenterIsland(-1.75, -1.6, 2.5, 1.35, 0.95, false);
                    if (!hideRearWallForShop) addCenterIsland(2.1, -4.25, 2.25, 1.2, 0.95, true);
                    // Mantener despejado el acceso central del local.
                    if (!hideRearWallForShop) addCashDesk(4.35, 2.65);
                    if (!hideRearWallForShop) addWindowDisplay(-4.45);
                    if (!hideRearWallForShop) addWindowDisplay(4.45);
                }
                addS106InteriorPictureFrame();
                addBoutiqueCeilingFeature();

                while (sh.children.length > decorStartIndex) {
                    detailedInterior.add(sh.children[decorStartIndex]);
                }
                sh.userData.detailedInteriorBuilt = true;
            };
            const disposeDetailedInterior = () => {
                if (!sh.userData.detailedInteriorBuilt) return;
                detailedInterior.traverse((object) => {
                    if (!object.geometry?.userData?.mallSharedGeometry) object.geometry?.dispose?.();
                    const materials = Array.isArray(object.material) ? object.material : [object.material];
                    materials.filter(Boolean).forEach((material) => material.dispose?.());
                });
                detailedInterior.clear();
                sh.userData.detailedInteriorBuilt = false;
            };

            sh.userData.ensureDetailedInterior = ensureDetailedInterior;
            sh.userData.disposeDetailedInterior = disposeDetailedInterior;
            sh.userData.detailedInteriorGroup = detailedInterior;
            sh.userData.interiorDetailFade = 0;
            sh.userData.interiorDetailVisible = false;

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
            if (backWall?.parent && backWall.visible !== false) {
                const rx = posX + sin * (-8.75); const rz = posZ + cos * (-8.75);
                registerCollider(rx, rz, Math.abs(12 * cos) + Math.abs(0.5 * sin), Math.abs(12 * sin) + Math.abs(0.5 * cos), yB, yB + 6, `wall:${physicalMeta?.id}:back`);
            }

            // 2. Paredes Laterales (+/- 5.75)
            if (leftWall?.parent && leftWall.visible !== false) {
                const lx = posX + cos * (-5.75); const lz = posZ + sin * 5.75;
                registerCollider(lx, lz, Math.abs(0.5 * cos) + Math.abs(18 * sin), Math.abs(0.5 * sin) + Math.abs(18 * cos), yB, yB + 6, `wall:${physicalMeta?.id}:left`);
            }
            if (rightWall?.parent && rightWall.visible !== false && shopCode !== "O201") {
                const rx = posX + cos * 5.75; const rz = posZ + sin * (-5.75);
                registerCollider(rx, rz, Math.abs(0.5 * cos) + Math.abs(18 * sin), Math.abs(0.5 * sin) + Math.abs(18 * cos), yB, yB + 6, `wall:${physicalMeta?.id}:right`);
            }

            // 3. Pared Frontal (Cristal con puerta de 6m, desplazada 0.25m hacia adentro: 8.75)
            [BOUTIQUE_DOOR_COLLIDER_OFFSET_X, -BOUTIQUE_DOOR_COLLIDER_OFFSET_X].forEach(offX => {
                const facadeSide = offX < 0 ? 'left' : 'right';
                if (facadeSide === cornerChamferSide) return;
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

        function disposeStoreVisualObject(root) {
            if (!root) return;
            const disposedTextures = new Set();
            const disposedMaterials = new Set();
            const disposedGeometries = new Set();
            root.traverse((object) => {
                object.userData = object.userData || {};
                object.userData.storeVisualDisposed = true;
                const geometry = object.geometry;
                if (geometry && !geometry.userData?.mallSharedGeometry && !disposedGeometries.has(geometry)) {
                    disposedGeometries.add(geometry);
                    geometry.dispose?.();
                }
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                materials.filter(Boolean).forEach((material) => {
                    if (disposedMaterials.has(material)) return;
                    disposedMaterials.add(material);
                    Object.values(material).forEach((value) => {
                        if (value?.isTexture && !disposedTextures.has(value)) {
                            disposedTextures.add(value);
                            value.dispose();
                        }
                    });
                    const ownedTexture = material.userData?.loadedTexture;
                    if (ownedTexture?.isTexture && !disposedTextures.has(ownedTexture)) {
                        disposedTextures.add(ownedTexture);
                        ownedTexture.dispose();
                    }
                    material.dispose?.();
                });
            });
            if (root.parent) root.parent.remove(root);
        }

        function clearStoreVisualGroup(group) {
            if (!group) return;
            [...group.children].forEach(disposeStoreVisualObject);
        }

        async function updateStoreVisuals(code, storeData, products) {
            const rawTargets = getStoreGroupCollection(code);
            const getVisualCodeForms = (value = "") => {
                const raw = String(value || "").trim();
                if (!raw) return [];
                const compact = raw.replace(/-/g, "");
                const hyphenated = compact.replace(/^([A-Z]+)(\d+)$/i, "$1-$2").toUpperCase();
                return [raw, raw.toUpperCase(), compact, compact.toUpperCase(), hyphenated].filter(Boolean);
            };
            const visualCandidates = [...new Set([
                code,
                storeData?.local_code,
                storeData?.shopCode,
                storeData?.shop_code,
                storeData?.code,
                storeData?.id
            ].flatMap(getVisualCodeForms).map(value => value.toUpperCase()).filter(Boolean))];
            const exactTargets = rawTargets.filter((group) => {
                const currentCodes = [
                    group?.userData?.shopCode,
                    group?.userData?.plateCode,
                    group?.userData?.displayCode
                ].flatMap(getVisualCodeForms).map(value => value.toUpperCase()).filter(Boolean);
                return currentCodes.some(groupCode => visualCandidates.includes(groupCode));
            });
            const targets = exactTargets;
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

                const visualSlotCount = Math.max(20, Math.min(50, Number(liveStoreData.product_limit) || liveProducts.length || 20));
                const storefrontProducts = typeof window.arrangeStoreProductsBySlot === 'function'
                    ? window.arrangeStoreProductsBySlot(liveProducts, visualSlotCount)
                    : liveProducts;
                // Los locales esquina comparten el mismo catálogo entre sus dos fachadas
                // físicas. Cada una recibe una serie propia, sin duplicar afiches.
                const cornerProductOffset = sh.userData.isCornerBoutique
                    && sh.userData.cornerFacade === 'vertical'
                    ? 6
                    : 0;
                const storefrontImageLimit = window.mallPerformanceProfile?.isLowEndMobile ? 4 : (sh.userData.isCornerBoutique ? 6 : 10);
                const productsWithImages = storefrontProducts.slice(cornerProductOffset, cornerProductOffset + storefrontImageLimit);
                const productPanelMat = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 1,
                    side: THREE.FrontSide,
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
                    side: THREE.FrontSide,
                    depthTest: true,
                    depthWrite: true,
                    alphaTest: 0.5,
                    polygonOffset: true,
                    polygonOffsetFactor: -1,
                    polygonOffsetUnits: -1
                });
                productPanelBackMat.toneMapped = false;

                const getStorefrontProductImageUrl = (product = {}) => {
                    const explicit = product.display_image_url || product.image_display_url || product.thumbnail_url || product.thumb_url || product.image_thumb_url;
                    const source = String(explicit || product.image_url || "").trim();
                    if (explicit || !source) return source;
                    const catalogVariant = source.replace(/-catalog-(\d+)\.(webp|jpg|jpeg|png)(\?|$)/i, '-display-$1.$2$3');
                    if (catalogVariant !== source) return catalogVariant;
                    return source.replace(/(\/product-\d+-\d+)\.(webp|jpg|jpeg|png)(\?|$)/i, '$1-display.webp$3');
                };

                const loadProductTexture = (mesh, imageUrl, targetAspect = 1, fallbackUrl = "") => {
                    const loadUrl = (url, canFallback = true) => textureLoader.load(url, (tex) => {
                        if (mesh.userData?.storeVisualDisposed) {
                            tex.dispose();
                            return;
                        }
                        let finalTexture = tex;
                        const image = tex.image;
                        if (image?.width && image?.height) {
                            try {
                                const canvasW = window.mallPerformanceProfile?.isLowEndMobile ? 256 : 512;
                                const canvasH = Math.max(256, Math.round(canvasW / Math.max(0.35, targetAspect)));
                                const canvas = document.createElement('canvas');
                                canvas.width = canvasW;
                                canvas.height = canvasH;
                                const ctx = canvas.getContext('2d');
                                ctx.clearRect(0, 0, canvasW, canvasH);
                                const imageAspect = image.width / image.height;
                                let drawW = canvasW;
                                let drawH = canvasW / imageAspect;
                                if (drawH > canvasH) {
                                    drawH = canvasH;
                                    drawW = canvasH * imageAspect;
                                }
                                const drawX = (canvasW - drawW) / 2;
                                const drawY = (canvasH - drawH) / 2;
                                ctx.drawImage(image, drawX, drawY, drawW, drawH);
                                const containedTexture = new THREE.CanvasTexture(canvas);
                                containedTexture.colorSpace = THREE.SRGBColorSpace;
                                containedTexture.encoding = THREE.sRGBEncoding;
                                containedTexture.needsUpdate = true;
                                tex.dispose();
                                finalTexture = containedTexture;
                            } catch (error) {
                                finalTexture = tex;
                            }
                        }
                        finalTexture.colorSpace = THREE.SRGBColorSpace;
                        finalTexture.encoding = THREE.sRGBEncoding;
                        finalTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
                        finalTexture.generateMipmaps = false;
                        finalTexture.minFilter = THREE.LinearFilter;
                        finalTexture.magFilter = THREE.LinearFilter;
                        finalTexture.wrapS = THREE.ClampToEdgeWrapping;
                        finalTexture.wrapT = THREE.ClampToEdgeWrapping;
                        finalTexture.needsUpdate = true;
                        if (mesh.material.userData?.loadedTexture) {
                            mesh.material.userData.loadedTexture.dispose();
                        }
                        mesh.material.map = finalTexture;
                        mesh.material.userData = mesh.material.userData || {};
                        mesh.material.userData.loadedTexture = finalTexture;
                        mesh.material.transparent = true;
                        mesh.material.opacity = 1;
                        mesh.material.alphaTest = 0.02;
                        mesh.material.toneMapped = false;
                        mesh.material.needsUpdate = true;
                    }, undefined, () => {
                        if (canFallback && fallbackUrl && fallbackUrl !== url) {
                            loadUrl(fallbackUrl, false);
                            return;
                        }
                        mesh.material.color.setHex(0x181818);
                        mesh.material.opacity = 0.16;
                        mesh.material.needsUpdate = true;
                    });
                    loadUrl(imageUrl);
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
                        loadProductTexture(image, getStorefrontProductImageUrl(product), 1, product.image_url);
                    } else {
                        image.material.color.setHex(0x111111);
                        image.material.opacity = 0.08;
                    }
                    parent.add(holder);
                    return holder;
                };

                sh.userData.refreshS106InteriorPicture = function () {
                    if (String(sh.userData.plateCode || sh.userData.displayCode || '').toUpperCase() !== 'S-106') return;
                    const mount = sh.userData.s106InteriorPictureImageMount;
                    if (!mount) return;
                    clearStoreVisualGroup(mount);

                    const explicitUrl = String(
                        liveStoreData.interior_feature_image_url
                        || liveStoreData.interior_image_url
                        || ''
                    ).trim();
                    // Excepcion exclusiva de S-106: el cuadro interior usa el casillero 10.
                    const extraProduct = storefrontProducts[9];
                    const pictureProduct = explicitUrl
                        ? { image_url: explicitUrl, display_image_url: explicitUrl }
                        : extraProduct;
                    if (!pictureProduct?.image_url) return;

                    const image = new THREE.Mesh(
                        getMallPlaneGeometry(1.63, 1.17),
                        productPanelMat.clone()
                    );
                    image.position.z = 0.001;
                    image.renderOrder = 26;
                    image.userData.isS106InteriorFeatureImage = true;
                    loadProductTexture(image, getStorefrontProductImageUrl(pictureProduct), 1, pictureProduct.image_url);
                    mount.add(image);
                };

                sh.userData.refreshS106InteriorPicture();

                const addFacadeProductPanels = () => {
                    const facade = new THREE.Group();
                    facade.name = "facadeProductPanels";
                    facade.renderOrder = 24;
                    const slots = Array.isArray(sh.userData.imageDisplaySlots) ? sh.userData.imageDisplaySlots : [];
                    slots.forEach((slot, index) => {
                        const product = productsWithImages[index];
                        if (!product?.image_url) return;
                        const isFrontSlot = String(slot.surface || '').startsWith('front-');
                        const slotHalfWidth = (slot.width || 0) / 2;
                        const slotHalfHeight = (slot.height || 0) / 2;
                        const doorOpeningHalfWidth = 3.0;
                        const overlapsDoorClearance = isFrontSlot
                            && Math.abs(slot.z - BOUTIQUE_DOOR_FRONT_Z) < 0.08
                            && Math.abs(slot.x) - slotHalfWidth < doorOpeningHalfWidth
                            && slot.y - slotHalfHeight < doorH;
                        if (overlapsDoorClearance) {
                            const attachToLeftLeaf = slot.x < 0;
                            const doorLeaves = sh.userData.slidingDoorLeaves || {};
                            const doorLeaf = attachToLeftLeaf ? doorLeaves.left : doorLeaves.right;
                            const closedX = attachToLeftLeaf ? -1.5 : 1.5;
                            if (!doorLeaf) return;
                            const doorPanel = addProductImagePlane(
                                doorLeaf,
                                product,
                                slot.x - closedX,
                                slot.y - doorH / 2,
                                slot.z - BOUTIQUE_DOOR_FRONT_Z,
                                slot.width,
                                slot.height,
                                slot.rotationY || 0
                            );
                            doorPanel.userData.isDoorFacadePanel = true;
                            sh.userData.doorFacadeVisualGroups.push(doorPanel);
                            return;
                        }
                        addProductImagePlane(
                            facade,
                            product,
                            slot.x,
                            slot.y,
                            slot.z,
                            slot.width,
                            slot.height,
                            slot.rotationY || 0
                        );
                    });

                    // Cada puerta recibe dos afiches como hijos de su hoja móvil.
                    // Los locales normales usan 7-10; las esquinas preservan 1-12
                    // para sus dos vitrinas y distribuyen 13-16 / 17-20 por fachada.
                    const doorProductOffset = sh.userData.isCornerBoutique
                        ? (sh.userData.cornerFacade === 'vertical' ? 16 : 12)
                        : 6;
                    const doorImageLimit = window.mallPerformanceProfile?.isLowEndMobile ? 2 : 4;
                    const doorProducts = storefrontProducts.slice(doorProductOffset, doorProductOffset + doorImageLimit);
                    const slidingDoorLeaves = sh.userData.slidingDoorLeaves || {};
                    const doorLeaves = [slidingDoorLeaves.left, slidingDoorLeaves.right];
                    const doorPanelY = [-0.82, 0.82];
                    doorProducts.forEach((product, index) => {
                        if (!product?.image_url) return;
                        const leafIndex = Math.floor(index / doorPanelY.length);
                        const leaf = doorLeaves[leafIndex];
                        if (!leaf) return;
                        const panel = addProductImagePlane(
                            leaf,
                            product,
                            0,
                            doorPanelY[index % doorPanelY.length],
                            0.038,
                            1.08,
                            1.26
                        );
                        panel.userData.isDoorFacadePanel = true;
                        panel.userData.doorLeafIndex = leafIndex;
                        sh.userData.doorFacadeVisualGroups.push(panel);
                    });
                    showcase.add(facade);
                };

                sh.userData.ensureFacadeStoreVisuals = function () {
                    if (!sh.userData.storeVisualPayload) return;
                    if (sh.userData.facadeVisualRevision === sh.userData.storeVisualRevision) return;
                    window.mallRuntimeMonitor?.enter('store-visual-apply', { storeCode: code }, true);
                    clearStoreVisualGroup(showcase);
                    (sh.userData.doorFacadeVisualGroups || []).forEach((group) => {
                        disposeStoreVisualObject(group);
                    });
                    sh.userData.doorFacadeVisualGroups = [];
                    addFacadeProductPanels();
                    sh.userData.facadeVisualRevision = sh.userData.storeVisualRevision;
                };

                sh.userData.disposeFacadeStoreVisuals = function () {
                    if (!sh.userData.facadeVisualRevision) return;
                    window.mallRuntimeMonitor?.enter('boutique-streaming', { storeCode: code, action: 'dispose-facade' }, true);
                    clearStoreVisualGroup(showcase);
                    (sh.userData.doorFacadeVisualGroups || []).forEach(disposeStoreVisualObject);
                    sh.userData.doorFacadeVisualGroups = [];
                    sh.userData.facadeVisualRevision = 0;
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
                        if (!product?.image_url) return;
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
                                textureLoader.load(getStorefrontProductImageUrl(p), (tex) => {
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
                    clearStoreVisualGroup(interior);
                    const isPassageShop = code === "S101" || code === "S201";
                    // Las imágenes comerciales viven sólo en las superficies de vidrio registradas.
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
                            let logoTexture = tex;
                            const image = tex.image;
                            if (image?.width && image?.height) {
                                try {
                                    const canvasW = window.mallPerformanceProfile?.isLowEndMobile ? 512 : 1024;
                                    const canvasH = Math.round(canvasW / (BOUTIQUE_SIGN_WIDTH / BOUTIQUE_SIGN_HEIGHT));
                                    const canvas = document.createElement('canvas');
                                    canvas.width = canvasW;
                                    canvas.height = canvasH;
                                    const ctx = canvas.getContext('2d');
                                    ctx.clearRect(0, 0, canvasW, canvasH);
                                    const paddingX = canvasW * 0.025;
                                    const paddingY = canvasH * 0.025;
                                    const boxW = canvasW - paddingX * 2;
                                    const boxH = canvasH - paddingY * 2;
                                    const imageAspect = image.width / image.height;
                                    let drawW = boxW;
                                    let drawH = boxW / imageAspect;
                                    if (drawH > boxH) {
                                        drawH = boxH;
                                        drawW = boxH * imageAspect;
                                    }
                                    const drawX = (canvasW - drawW) / 2;
                                    const drawY = (canvasH - drawH) / 2;
                                    ctx.drawImage(image, drawX, drawY, drawW, drawH);
                                    logoTexture = new THREE.CanvasTexture(canvas);
                                    tex.dispose();
                                } catch (error) {
                                    logoTexture = tex;
                                }
                            }
                            logoTexture.colorSpace = THREE.SRGBColorSpace;
                            logoTexture.encoding = THREE.sRGBEncoding;
                            logoTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
                            logoTexture.generateMipmaps = false;
                            logoTexture.minFilter = THREE.LinearFilter;
                            logoTexture.magFilter = THREE.LinearFilter;
                            logoTexture.wrapS = THREE.ClampToEdgeWrapping;
                            logoTexture.wrapT = THREE.ClampToEdgeWrapping;
                            logoTexture.needsUpdate = true;
                            if (sign.material.userData?.loadedLogoTexture) {
                                sign.material.userData.loadedLogoTexture.dispose();
                            }
                            sign.material.map = logoTexture;
                            sign.material.userData = sign.material.userData || {};
                            sign.material.userData.loadedLogoTexture = logoTexture;
                            sign.material.needsUpdate = true;
                            sign.material.depthTest = true;
                            sign.material.depthWrite = false;
                            sign.material.alphaTest = 0.02;
                            sign.material.transparent = true;
                            sign.material.opacity = sh.userData.facadeVisualFade || 0;
                            sign.material.toneMapped = false;
                            sign.userData.logoLoaded = true;
                            sign.visible = sign.material.opacity > BOUTIQUE_DETAIL_FADE_EPSILON;
                            sign.renderOrder = 24;
                            sign.scale.set(1, 1, 1);
                        }
                    });
                } else if (sign) {
                    sign.userData.logoLoaded = false;
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

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 512, 1024);

            ctx.strokeStyle = '#c5a059';
            ctx.lineWidth = 18;
            ctx.strokeRect(18, 18, 476, 988);

            ctx.fillStyle = '#111111';
            ctx.font = 'bold 48px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('Busca tu', 256, 110);
            ctx.fillText('producto o tu', 256, 172);
            ctx.fillText('local aquí', 256, 234);

            ctx.fillStyle = '#f4f4f4';
            ctx.strokeStyle = '#d6d6d6';
            ctx.lineWidth = 6;
            if (typeof ctx.roundRect === 'function') {
                ctx.beginPath();
                ctx.roundRect(70, 395, 372, 92, 20);
                ctx.fill();
                ctx.stroke();
            } else {
                ctx.fillRect(70, 395, 372, 92);
                ctx.strokeRect(70, 395, 372, 92);
            }

            ctx.fillStyle = '#555555';
            ctx.font = '32px Arial, sans-serif';
            ctx.fillText('Escribe tu búsqueda', 256, 425);

            ctx.strokeStyle = '#c5a059';
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.moveTo(120, 680);
            ctx.lineTo(210, 760);
            ctx.lineTo(390, 560);
            ctx.stroke();

            ctx.fillStyle = '#c5a059';
            ctx.beginPath();
            ctx.arc(120, 680, 18, 0, Math.PI * 2);
            ctx.arc(390, 560, 18, 0, Math.PI * 2);
            ctx.fill();

            const tex = new THREE.CanvasTexture(canvas);
            tex.needsUpdate = true;
            return tex;
        }
        const infoScreenTexture = createInfoTexture();
        function createTotemLabelTexture(text) {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(17, 17, 17, 0.92)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#c5a059';
            ctx.lineWidth = 8;
            ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
            ctx.fillStyle = '#c5a059';
            ctx.font = 'bold 42px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, canvas.width / 2, canvas.height / 2);
            const tex = new THREE.CanvasTexture(canvas);
            tex.needsUpdate = true;
            return tex;
        }

        function createInfoTotem({ id, label, x, z, rotationY = 0 }) {
            const gr = new THREE.Group(); gr.position.set(x, 0, z);
            gr.rotation.y = rotationY;
            gr.userData = { isTotem: true, totemId: id, label };
            const base = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.18, 0.9), darkMat);
            base.position.y = 0.09;
            gr.add(base);

            const body = new THREE.Mesh(new THREE.BoxGeometry(0.86, 2.05, 0.24), darkMat);
            body.position.y = 1.16;
            gr.add(body);

            const screenMat = new THREE.MeshBasicMaterial({
                map: infoScreenTexture,
                toneMapped: false,
                depthWrite: false,
                depthTest: true,
                side: THREE.FrontSide
            });
            const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.45), screenMat);
            screen.position.set(0, 1.25, 0.18);
            screen.renderOrder = 32;
            gr.add(screen);
            const backScreen = screen.clone();
            backScreen.rotation.y = Math.PI;
            backScreen.position.z = -0.18;
            backScreen.renderOrder = 32;
            gr.add(backScreen);

            const frame = new THREE.Group();
            frame.position.y = 1.25;
            const addFrameBar = (w, h, x, y, z) => {
                const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), goldMat);
                bar.position.set(x, y, z);
                frame.add(bar);
            };
            const frameHalfH = 1.62 / 2;
            const frameHalfW = 0.88 / 2;
            const barThickness = 0.055;
            [-0.19, 0.19].forEach((z) => {
                addFrameBar(0.88, barThickness, 0, frameHalfH - barThickness / 2, z);
                addFrameBar(0.88, barThickness, 0, -frameHalfH + barThickness / 2, z);
                addFrameBar(barThickness, 1.62, -frameHalfW + barThickness / 2, 0, z);
                addFrameBar(barThickness, 1.62, frameHalfW - barThickness / 2, 0, z);
            });
            gr.add(frame);

            const labelMat = new THREE.MeshBasicMaterial({
                map: createTotemLabelTexture(label),
                transparent: true,
                toneMapped: false
            });
            const labelFront = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.27), labelMat);
            labelFront.position.set(0, 2.42, 0.17);
            gr.add(labelFront);
            const labelBack = labelFront.clone();
            labelBack.rotation.y = Math.PI;
            labelBack.position.z = -0.17;
            gr.add(labelBack);

            window.setMallShadowMode?.(base, { cast: true, receive: true });
            window.setMallShadowMode?.(body, { cast: true, receive: true });
            window.setMallShadowMode?.(frame, { cast: true, receive: true });

            scene.add(gr);
            window.mallTotemTargets = Array.isArray(window.mallTotemTargets) ? window.mallTotemTargets : [];
            window.mallTotemTargets.push(gr);
            registerCollider(x, z, 1.1, 1.1, 0, 2.3);
        }

        function createInformationModuleLabelTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#151515';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#c9a85c';
            ctx.lineWidth = 12;
            ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
            ctx.fillStyle = '#f1d48f';
            ctx.font = '700 84px Georgia, serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('INFORMACIONES', canvas.width / 2, 108);
            ctx.font = '600 31px Arial, sans-serif';
            ctx.fillStyle = '#d7c495';
            ctx.fillText('BIENVENIDA Y ORIENTACION', canvas.width / 2, 181);

            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            return texture;
        }

        function createInformationModule() {
            // Keep the module on the west side of the atrium, out of the main cross-aisle.
            const x = -17;
            const z = 0;
            const rotationY = Math.PI / 2;
            const module = new THREE.Group();
            module.name = 'Modulo de informaciones';
            module.position.set(x, 0, z);
            module.rotation.y = rotationY;
            module.userData = {
                isInformationModule: true,
                physicalRegistrationId: 'information-desk-main',
                label: 'INFORMACIONES',
                mallEditable: false
            };

            const shellMat = new THREE.MeshStandardMaterial({ color: 0x1b1a18, roughness: 0.42, metalness: 0.28 });
            const counterMat = new THREE.MeshStandardMaterial({ color: 0xe5dfd2, roughness: 0.58, metalness: 0.08 });
            const counterTopMat = new THREE.MeshStandardMaterial({ color: 0x584829, roughness: 0.34, metalness: 0.28 });
            const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xc9a85c, roughness: 0.26, metalness: 0.62 });
            const uniformMat = new THREE.MeshStandardMaterial({ color: 0x1d526c, roughness: 0.62 });
            const skinMat = new THREE.MeshStandardMaterial({ color: 0xdab58a, roughness: 0.78 });
            const hairMat = new THREE.MeshStandardMaterial({ color: 0x25211e, roughness: 0.72 });

            const base = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.16, 2.2), shellMat);
            base.position.y = 0.08;
            module.add(base);

            const counter = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.82, 0.56), counterMat);
            counter.position.set(0, 0.5, 0.62);
            module.add(counter);

            const counterTop = new THREE.Mesh(new THREE.BoxGeometry(2.82, 0.1, 0.7), counterTopMat);
            counterTop.position.set(0, 0.96, 0.62);
            module.add(counterTop);

            // Keep the information sign above the assistant's head while preserving its support frame.
            const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.95, 0.12, 0.58), shellMat);
            canopy.position.set(0, 3.11, 0);
            module.add(canopy);

            [-1.3, 1.3].forEach((supportX) => {
                const support = new THREE.Mesh(new THREE.BoxGeometry(0.13, 2.22, 0.16), shellMat);
                support.position.set(supportX, 2.04, 0);
                module.add(support);
            });

            const headerTexture = createInformationModuleLabelTexture();
            const headerMat = new THREE.MeshBasicMaterial({ map: headerTexture, toneMapped: false });
            const headerFront = new THREE.Mesh(new THREE.PlaneGeometry(2.66, 0.66), headerMat);
            headerFront.position.set(0, 2.75, 0.09);
            module.add(headerFront);
            const headerBack = headerFront.clone();
            headerBack.rotation.y = Math.PI;
            headerBack.position.z = -0.09;
            module.add(headerBack);

            const lowerTrim = new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.06, 0.08), goldTrimMat);
            lowerTrim.position.set(0, 2.36, 0.11);
            module.add(lowerTrim);

const assistant = new THREE.Group();
assistant.name = 'Asistente virtual de informaciones';
assistant.position.set(0, 0, -0.28);
assistant.userData = {
    isMallInformationAssistant: true,
    assistantScope: 'mall',
    registrationId: 'main-information-assistant',
    physicalLocation: 'Mesón principal de informaciones'
};
const faceMat = new THREE.MeshStandardMaterial({ color: 0x1a1613, roughness: 0.5 });
const trouserMat = new THREE.MeshStandardMaterial({ color: 0x173d52, roughness: 0.68 });
const shoeMat = new THREE.MeshStandardMaterial({ color: 0x161514, roughness: 0.5 });
const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.26), uniformMat);
torso.position.y = 1.38;
assistant.add(torso);
const belt = new THREE.Mesh(new THREE.BoxGeometry(0.51, 0.07, 0.275), trouserMat);
belt.position.y = 1.04;
assistant.add(belt);
const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.15, 12), skinMat);
neck.position.y = 1.76;
assistant.add(neck);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), skinMat);
head.position.y = 1.98;
assistant.add(head);
const hair = new THREE.Mesh(new THREE.SphereGeometry(0.247, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat);
hair.position.y = 2.07;
assistant.add(hair);
[-0.31, 0.31].forEach((armX) => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.46, 10), uniformMat);
    arm.position.set(armX, 1.39, 0.02);
    arm.rotation.z = armX < 0 ? 0.15 : -0.15;
    assistant.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), skinMat);
    hand.position.set(armX * 1.12, 1.15, 0.03);
    assistant.add(hand);
});
[-0.13, 0.13].forEach((legX) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.54, 0.18), trouserMat);
    leg.position.set(legX, 0.75, 0);
    assistant.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.28), shoeMat);
    shoe.position.set(legX, 0.43, 0.05);
    assistant.add(shoe);
});
[-0.075, 0.075].forEach((eyeX) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.027, 10, 8), faceMat);
    eye.position.set(eyeX, 2.02, 0.224);
    assistant.add(eye);
    const eyebrow = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.012), hairMat);
    eyebrow.position.set(eyeX, 2.095, 0.223);
    eyebrow.rotation.z = eyeX < 0 ? -0.12 : 0.12;
    assistant.add(eyebrow);
});
const nose = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), skinMat);
nose.position.set(0, 1.96, 0.235);
assistant.add(nose);
module.add(assistant);

            assistant.traverse((child) => {
                child.userData = {
                    ...child.userData,
                    isMallInformationAssistant: true,
                    assistantScope: 'mall'
                };
            });

            module.traverse((child) => {
                if (child.isMesh) window.setMallShadowMode?.(child, true, true);
            });
            scene.add(module);
            window.mallInformationModuleTargets = window.mallInformationModuleTargets || [];
            window.mallInformationModuleTargets.push(module);
            // The desk footprint is rotated with the module. Keep its physical
            // volume separate from the assistant so both can be diagnosed and
            // collide consistently for the visitor and NPC navigation.
            registerRotatedSolidFootprint(
                x,
                z,
                3.35,
                2.35,
                rotationY,
                0,
                2.45,
                'information-desk-main'
            );
            const assistantWorldPosition = assistant.getWorldPosition(new THREE.Vector3());
            registerCircularCollider(
                assistantWorldPosition.x,
                assistantWorldPosition.z,
                0.4,
                0,
                2.45,
                'main-information-assistant'
            );
        }

        // --- POBLAR TÓTEMS ---
        const SEARCH_TOTEM_LOCATIONS = [
            { id: 'atrium', label: 'TÓTEM ATRIO', x: 0, z: 10, rotationY: 0 },
            { id: 'north', label: 'TÓTEM NORTE', x: 0, z: 78, rotationY: Math.PI },
            { id: 'south', label: 'TÓTEM SUR', x: 0, z: -78, rotationY: 0 },
            { id: 'east', label: 'TÓTEM ESTE', x: -78, z: 0, rotationY: Math.PI / 2 },
            { id: 'west', label: 'TÓTEM OESTE', x: 78, z: 0, rotationY: -Math.PI / 2 }
        ];
        SEARCH_TOTEM_LOCATIONS.forEach(createInfoTotem);


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

        // Modulos reversibles para los ocho vacios de 6 m del primer piso.
        // La mitad izquierda funciona como puesto y la derecha queda libre para acceso.
        const MINI_FOOD_STALLS_ENABLED = true;
        function createMiniFoodStall(posX, posZ, rotY, moduleId, physicalMeta) {
            const stall = new THREE.Group();
            const displayCode = String(physicalMeta?.displayCode || physicalMeta?.generatedCode || '').trim();
            stall.name = `mini-food-stall-${moduleId}`;
            stall.position.set(posX, 0, posZ);
            stall.rotation.y = rotY;
            stall.userData = {
                isMiniFoodStall: true,
                moduleId,
                occupiedSide: 'left',
                clearPassageSide: 'right',
                clearPassageWidth: 3
            };

            const counterBodyMat = new THREE.MeshStandardMaterial({
                color: 0xd8c7a8,
                roughness: 0.48,
                metalness: 0.05
            });
            const counterTopMat = new THREE.MeshStandardMaterial({
                color: 0x59432c,
                roughness: 0.32,
                metalness: 0.12
            });
            const addBox = (w, h, d, x, y, z, material) => {
                const mesh = new THREE.Mesh(getMallBoxGeometry(w, h, d), material);
                mesh.position.set(x, y, z);
                stall.add(mesh);
                return mesh;
            };

            // Una unica hoja fija ocupa exactamente la mitad izquierda del frente.
            // La perfileria replica las proporciones de las boutiques vecinas.
            addBox(2.9, 3.55, 0.055, -1.5, 1.775, 9.03, glassMat);
            addBox(6.0, 0.15, 0.20, 0, 3.60, 9.05, darkMat);
            addBox(3.0, 0.20, 0.20, -1.5, 0.10, 9.05, darkMat);
            addBox(0.20, 4.80, 0.20, -3.0, 2.40, 9.05, darkMat);
            addBox(0.20, 3.60, 0.20, 0, 1.80, 9.05, darkMat);
            addBox(0.20, 4.80, 0.20, 3.0, 2.40, 9.05, darkMat);

            // Franja superior continua para la futura placa o logo del puesto.
            addBox(5.9, 1.20, 0.055, 0, 4.20, 9.03, glassMat);
            addBox(6.20, 0.20, 0.20, 0, 4.80, 9.05, darkMat);

            // La identidad visible del puesto proviene del mismo displayCode
            // utilizado por physical_spaces y stores.
            if (displayCode) {
                const plateTexture = createSmallIDTexture(displayCode);
                const plate = new THREE.Mesh(
                    getMallPlaneGeometry(1.6, 0.4),
                    new THREE.MeshBasicMaterial({ map: plateTexture, transparent: true })
                );
                plate.name = `mini-food-stall-plate-${displayCode}`;
                plate.position.set(-1.85, 4.58, 9.18);
                plate.userData = {
                    isStoreCodeSign: true,
                    isSign: true,
                    isCatalogTrigger: true,
                    shopCode: displayCode,
                    sourceShopCode: displayCode,
                    displayCode
                };
                stall.add(plate);
                catalogClickTargets.push(plate);
            }

            // Mostrador angosto junto al pasillo: deja una zona de trabajo detras.
            const counterX = -0.75;
            addBox(1.15, 1.02, 8.4, counterX, 0.51, 3.9, counterBodyMat);
            addBox(1.42, 0.13, 8.65, counterX, 1.085, 3.9, counterTopMat);
            addBox(0.09, 0.3, 8.25, -0.10, 1.29, 3.9, glassMat);
            addBox(0.12, 0.09, 8.3, -0.07, 1.46, 3.9, goldMat);

            const localToWorld = (x, z) => ({
                x: posX + (x * Math.cos(rotY)) + (z * Math.sin(rotY)),
                z: posZ - (x * Math.sin(rotY)) + (z * Math.cos(rotY))
            });
            const glassCenter = localToWorld(-1.5, 9.03);
            const upperGlassCenter = localToWorld(0, 9.03);
            const counterCenter = localToWorld(counterX, 3.9);
            registerRotatedSolidFootprint(glassCenter.x, glassCenter.z, 2.9, 0.10, rotY, 0, 3.65);
            registerRotatedSolidFootprint(upperGlassCenter.x, upperGlassCenter.z, 5.9, 0.20, rotY, 3.58, 4.90);
            registerRotatedSolidFootprint(counterCenter.x, counterCenter.z, 1.42, 8.65, rotY, 0, 1.55);

            registerPhysicalSpace(stall, physicalMeta);
            if (displayCode) registerStoreGroup(displayCode, stall);

            return stall;
        }

        // El relleno del chaflan y las pasarelas usan las mismas instancias, para que
        // luz, rugosidad y reticula se perciban como una sola losa continua.
        const centralCorridorFloorMat = new THREE.MeshStandardMaterial({
            color: 0xb0b0b0,
            roughness: 0.1,
            metalness: 0.1
        });
        const centralCorridorFloorGridMat = new THREE.MeshStandardMaterial({ color: 0x332211, roughness: 0.2 });
        const CENTRAL_CORRIDOR_GRID_STEP = 8;
        const CENTRAL_CORRIDOR_GRID_GAP = 0.8;
        // Los locales del segundo nivel parten en Y=5.5, pero la losa transitable
        // del pasillo termina en Y=5.4.
        const CENTRAL_CORNER_FLOOR_SURFACE_OFFSET = -0.1;

        function getTriangleGridSegment(vertices, axis, coordinate) {
            const intersections = [];
            const epsilon = 0.0001;

            for (let index = 0; index < vertices.length; index += 1) {
                const start = vertices[index];
                const end = vertices[(index + 1) % vertices.length];
                const startAxis = axis === 'x' ? start.x : start.z;
                const endAxis = axis === 'x' ? end.x : end.z;
                const startOther = axis === 'x' ? start.z : start.x;
                const endOther = axis === 'x' ? end.z : end.x;
                const axisDelta = endAxis - startAxis;

                if (Math.abs(axisDelta) < epsilon) {
                    if (Math.abs(coordinate - startAxis) < epsilon) {
                        intersections.push(startOther, endOther);
                    }
                    continue;
                }

                if (coordinate < Math.min(startAxis, endAxis) - epsilon || coordinate > Math.max(startAxis, endAxis) + epsilon) {
                    continue;
                }
                const ratio = (coordinate - startAxis) / axisDelta;
                intersections.push(startOther + (endOther - startOther) * ratio);
            }

            const unique = [...new Set(intersections.map(value => value.toFixed(4)))].map(Number).sort((a, b) => a - b);
            return unique.length >= 2 && unique[unique.length - 1] - unique[0] > epsilon
                ? [unique[0], unique[unique.length - 1]]
                : null;
        }

        function createCentralCornerFloorGrid(vertices) {
            const grid = new THREE.Group();
            grid.name = 'Reticula pasillo chaflan';

            const addSegment = (axis, coordinate, start, end) => {
                const length = end - start;
                if (length <= 0.0001) return;
                const line = axis === 'x'
                    ? new THREE.Mesh(getMallPlaneGeometry(0.04, length), centralCorridorFloorGridMat)
                    : new THREE.Mesh(getMallPlaneGeometry(length, 0.04), centralCorridorFloorGridMat);
                line.rotation.x = -Math.PI / 2;
                line.position.set(
                    axis === 'x' ? coordinate : (start + end) / 2,
                    0.01,
                    axis === 'x' ? (start + end) / 2 : coordinate
                );
                grid.add(line);
            };

            for (let coordinate = -100; coordinate <= 100; coordinate += CENTRAL_CORRIDOR_GRID_STEP) {
                [0, CENTRAL_CORRIDOR_GRID_GAP].forEach(offset => {
                    const xSegment = getTriangleGridSegment(vertices, 'x', coordinate + offset);
                    if (xSegment) addSegment('x', coordinate + offset, xSegment[0], xSegment[1]);
                    const zSegment = getTriangleGridSegment(vertices, 'z', coordinate + offset);
                    if (zSegment) addSegment('z', coordinate + offset, zSegment[0], zSegment[1]);
                });
            }
            return grid;
        }

        function createCentralCornerFloorInfill(sx, sz, y) {
            const innerEdge = 17;
            const cut = 3;
            const overlap = 0.12;
            const cornerX = (innerEdge - overlap) * sx;
            const cornerZ = (innerEdge - overlap) * sz;
            const horizontalEndX = (innerEdge + cut + overlap) * sx;
            const verticalEndZ = (innerEdge + cut + overlap) * sz;
            const shape = new THREE.Shape();
            shape.moveTo(cornerX, cornerZ);
            shape.lineTo(horizontalEndX, cornerZ);
            shape.lineTo(cornerX, verticalEndZ);
            shape.closePath();

            // Mismo grosor de 60 cm que la losa de las pasarelas: no deja ver
            // la cubierta dorada ni desde el corredor ni desde el primer piso.
            const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: false });
            geometry.rotateX(Math.PI / 2);
            const infill = new THREE.Mesh(geometry, centralCorridorFloorMat);
            infill.position.y = y;
            infill.name = `Relleno estructural piso chaflán ${sx > 0 ? 'O' : 'E'}${sz > 0 ? 'N' : 'S'}-2`;
            infill.userData.isCentralCornerFloorInfill = true;
            infill.receiveShadow = renderer.shadowMap.enabled;
            infill.add(createCentralCornerFloorGrid([
                { x: cornerX, z: cornerZ },
                { x: horizontalEndX, z: cornerZ },
                { x: cornerX, z: verticalEndZ }
            ]));
            return infill;
        }

        function createCentralCornerChamfer(sx, sz, y) {
            const shopHeight = 4.8;
            const cut = 3;
            const innerEdge = 17;
            const cornerX = innerEdge * sx;
            const cornerZ = innerEdge * sz;
            const horizontalEnd = new THREE.Vector3(cornerX + cut * sx, y + shopHeight / 2, cornerZ);
            const verticalEnd = new THREE.Vector3(cornerX, y + shopHeight / 2, cornerZ + cut * sz);
            const center = horizontalEnd.clone().add(verticalEnd).multiplyScalar(0.5);
            const dx = verticalEnd.x - horizontalEnd.x;
            const dz = verticalEnd.z - horizontalEnd.z;
            const length = Math.hypot(dx, dz);
            const rotationY = Math.atan2(-dz, dx);
            const floorNum = y === 0 ? 1 : 2;
            const cornerCode = `${sx > 0 ? 'O' : 'E'}${sz > 0 ? 'N' : 'S'}`;
            const chamfer = new THREE.Group();
            chamfer.name = `Chaflán de vidrio ${cornerCode}-${floorNum}`;
            chamfer.userData = {
                isCentralCornerChamfer: true,
                cornerCode,
                floor: floorNum,
                cut
            };

            const addMember = (width, height, depth, x, yPos, z, material, name = '') => {
                const member = new THREE.Mesh(getMallBoxGeometry(width, height, depth), material);
                member.position.set(x, yPos, z);
                member.rotation.y = rotationY;
                if (name) member.name = name;
                chamfer.add(member);
                return member;
            };

            // Los pilares existentes de cada frente cierran los extremos del corte.
            // Este paño diagonal sustituye solo el rincón sobrante, sin duplicar estructura.
            // En ambas plantas, el triángulo comparte la cota y el acabado del pasillo.
            const chamferFloorY = y === 0 ? 0.1 : y + CENTRAL_CORNER_FLOOR_SURFACE_OFFSET;
            chamfer.add(createCentralCornerFloorInfill(sx, sz, chamferFloorY));
            // Hipotenusa visual a ras de suelo: no registra colisión propia y deja libre el pasillo.
            addMember(length + 0.16, 0.20, 0.20, center.x, y + 0.10, center.z, darkMat, `Hipotenusa chaflán ${cornerCode}-${floorNum}`);
            const glass = addMember(length, shopHeight, 0.055, center.x, center.y, center.z, glassMat, `Vidrio chaflán ${cornerCode}-${floorNum}`);
            glass.userData.isCentralCornerChamferGlass = true;
            addMember(length + 0.16, 0.20, 0.20, center.x, y + shopHeight - 0.10, center.z, darkMat, `Dintel chaflán ${cornerCode}-${floorNum}`);
            addMember(0.10, shopHeight - 0.24, 0.14, center.x, center.y, center.z, darkMat, `Montante chaflán ${cornerCode}-${floorNum}`);
            addMember(length - 0.28, 0.035, 0.05, center.x, y + shopHeight - 0.28, center.z, goldMat, `Perfil dorado chaflán ${cornerCode}-${floorNum}`);

            // El volumen orientado coincide con el vidrio diagonal, evitando un collider
            // rectangular que bloquearía injustificadamente los pasillos vecinos.
            window.mallPhysics.registerOrientedCollider(
                center.x,
                center.z,
                length + 0.16,
                0.16,
                rotationY,
                y,
                y + shopHeight,
                `corner-chamfer:${floorNum}:${cornerCode}`
            );
            return chamfer;
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
                    // El segundo módulo de la tienda esquina ya construye esta
                    // fachada perpendicular y su puerta. No duplicar aquí un
                    // paño lateral de vidrio que cierre ese acceso.
                    left: isCornerSlot ? false : true,
                    right: isCornerSlot ? false : true
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
                    isCorner: isCornerSlot,
                    cornerFacade: 'horizontal',
                    width: 12,
                    depth: 18,
                    height: 5.2
                });
                // La placa fisica es la identidad vigente. No registrar tambien el
                // alias historico cuando contradice la placa: eso mezcla esquinas
                // distintas (por ejemplo SE-10 y OS-10) en busquedas y teletransporte.
                registerStoreGroup(plateCode || code, b);
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
                    // La fachada perpendicular pertenece al módulo horizontal
                    // de este mismo local esquina; dejar libre la unión evita
                    // vidrio, afiches y colisión delante de ambas puertas.
                    left: isCornerSlot ? false : true,
                    right: isCornerSlot ? false : true
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
                    isCorner: isCornerSlot,
                    cornerFacade: 'vertical',
                    width: 12,
                    depth: 18,
                    height: 5.2
                });
                registerStoreGroup(plateCode || code, b);
                gr.add(b);
            });

            gr.add(createCentralCornerChamfer(sx, sz, y));

            if (y === 0 && MINI_FOOD_STALLS_ENABLED) {
                const microCodeBySector = {
                    xn_zn: ['FE-02', 'FS-01'],
                    xn_zp: ['FE-01', 'FN-02'],
                    xp_zn: ['FO-01', 'FS-02'],
                    xp_zp: ['FO-02', 'FN-01']
                };
                const [horizontalMicroCode, verticalMicroCode] = microCodeBySector[sectorKey];
                gr.add(createMiniFoodStall(
                    56 * sx,
                    26 * sz,
                    sz > 0 ? Math.PI : 0,
                    `${sectorKey}-horizontal`,
                    {
                        id: `phys_m_f1_${sectorKey}_horizontal_01`,
                        kind: 'micro',
                        floor: 1,
                        axis: 'horizontal',
                        quadrant: sectorKey,
                        slotIndex: 1,
                        generatedCode: horizontalMicroCode,
                        displayCode: horizontalMicroCode,
                        sizeClass: 'micro-food',
                        width: 6,
                        depth: 18,
                        height: 5.2
                    }
                ));
                gr.add(createMiniFoodStall(
                    26 * sx,
                    56 * sz,
                    sx > 0 ? -Math.PI / 2 : Math.PI / 2,
                    `${sectorKey}-vertical`,
                    {
                        id: `phys_m_f1_${sectorKey}_vertical_01`,
                        kind: 'micro',
                        floor: 1,
                        axis: 'vertical',
                        quadrant: sectorKey,
                        slotIndex: 1,
                        generatedCode: verticalMicroCode,
                        displayCode: verticalMicroCode,
                        sizeClass: 'micro-food',
                        width: 6,
                        depth: 18,
                        height: 5.2
                    }
                ));
            }

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
        // Bancas longitudinales al flujo: sobre Z en los brazos N/S y sobre X en E/O.
        [-70, -45, -20, 28, 48].forEach((j) => { createPlanter(0, j); createBench(8, j, Math.PI / 2); createBench(-8, j, Math.PI / 2); });
        [-70, -45, -20, 28, 48].forEach((k) => { createPlanter(k, 0); createBench(k, 8, 0); createBench(k, -8, 0); });
        createCentralFountain(); // La fuente crece visualmente por el espacio
        createInformationModule();
        createDigitalScreen(0, 22.0, 17, 0);
        createDigitalScreen(0, 22.0, -17, Math.PI);
        createDigitalScreen(17, 22.0, 0, -Math.PI / 2);
        createDigitalScreen(-17, 22.0, 0, Math.PI / 2);

        // Coleccionable reutilizable para concursos de miembros inscritos.
        const GOLDEN_BALLOON_LOCATIONS = [
            { x: -6.5, y: 2.55, z: 31 },
            { x: 7.2, y: 2.55, z: -46 },
            { x: 44, y: 2.55, z: 6.5 },
            { x: -43, y: 2.55, z: -6.5 },
            { x: 6.5, y: 7.9, z: 55 }
        ];
        const goldenBalloonGroup = new THREE.Group();
        goldenBalloonGroup.visible = false;
        goldenBalloonGroup.userData = { isPromotionCollectible: true, promotionId: '', baseY: 2.55 };
        const goldenBalloonMaterial = new THREE.MeshStandardMaterial({
            color: 0xd8ad3f,
            emissive: 0x5a3b05,
            emissiveIntensity: 0.42,
            roughness: 0.22,
            metalness: 0.72
        });
        const goldenBalloonBody = new THREE.Mesh(new THREE.SphereGeometry(0.48, 24, 18), goldenBalloonMaterial);
        goldenBalloonBody.scale.y = 1.16;
        goldenBalloonBody.userData.isPromotionCollectible = true;
        goldenBalloonGroup.add(goldenBalloonBody);
        const goldenBalloonTie = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 4), goldenBalloonMaterial);
        goldenBalloonTie.rotation.z = Math.PI;
        goldenBalloonTie.position.y = -0.62;
        goldenBalloonTie.userData.isPromotionCollectible = true;
        goldenBalloonGroup.add(goldenBalloonTie);
        const goldenBalloonString = new THREE.Mesh(
            new THREE.CylinderGeometry(0.012, 0.012, 1.2, 8),
            new THREE.MeshBasicMaterial({ color: 0xc5a059 })
        );
        goldenBalloonString.position.y = -1.28;
        goldenBalloonString.userData.isPromotionCollectible = true;
        goldenBalloonGroup.add(goldenBalloonString);
        scene.add(goldenBalloonGroup);
        window.mallPromotionTargets = [goldenBalloonGroup];

        window.configureMallPromotionCollectibles = function (promotions = []) {
            const promotion = (promotions || []).find(item => item?.promotion_type === 'golden_balloon' && !item?.claimed_at);
            if (!promotion) {
                goldenBalloonGroup.visible = false;
                goldenBalloonGroup.userData.promotionId = '';
                return;
            }
            if (promotion.object_id) {
                goldenBalloonGroup.visible = false;
                goldenBalloonGroup.userData.promotionId = '';
                return;
            }
            const seed = String(promotion.id || promotion.title || 'golden-balloon')
                .split('')
                .reduce((sum, character) => sum + character.charCodeAt(0), 0);
            const location = GOLDEN_BALLOON_LOCATIONS[seed % GOLDEN_BALLOON_LOCATIONS.length];
            goldenBalloonGroup.position.set(location.x, location.y, location.z);
            goldenBalloonGroup.userData.baseY = location.y;
            goldenBalloonGroup.userData.promotionId = String(promotion.id || '');
            goldenBalloonGroup.traverse(node => {
                node.userData.promotionId = String(promotion.id || '');
                node.userData.isPromotionCollectible = true;
            });
            goldenBalloonGroup.visible = true;
        };

        window.hideMallPromotionCollectible = function (promotionId) {
            if (String(goldenBalloonGroup.userData.promotionId) !== String(promotionId)) return;
            goldenBalloonGroup.visible = false;
        };

        window.updateMallPromotionCollectibles = function (nowMs = performance.now()) {
            if (!goldenBalloonGroup.visible) return;
            goldenBalloonGroup.position.y = goldenBalloonGroup.userData.baseY + Math.sin(nowMs * 0.0017) * 0.14;
            goldenBalloonGroup.rotation.y += 0.006;
        };

        // Geometria coordinada del segundo piso. Las fachadas permanecen en +/-17
        // y las pasarelas crecen 2 m hacia los atrios, sin mover locales ni escaleras.
        const SECOND_FLOOR_WALKWAY_EXPANSION = 2;
        const SECOND_FLOOR_WALKWAY_OUTER_EDGE = 17;
        const SECOND_FLOOR_ATRIUM_EDGE = 11 - SECOND_FLOOR_WALKWAY_EXPANSION;
        const SECOND_FLOOR_WALKWAY_WIDTH = SECOND_FLOOR_WALKWAY_OUTER_EDGE - SECOND_FLOOR_ATRIUM_EDGE;
        const SECOND_FLOOR_WALKWAY_CENTER = (SECOND_FLOOR_WALKWAY_OUTER_EDGE + SECOND_FLOOR_ATRIUM_EDGE) / 2;
        const SECOND_FLOOR_ATRIUM_SPAN = SECOND_FLOOR_ATRIUM_EDGE * 2;
        const SECOND_FLOOR_ESCALATOR_OPENING_HALF_WIDTH = 5;

        function createInteriorFloors() {
            const marbleMat = centralCorridorFloorMat;
            const bronzeMat = centralCorridorFloorGridMat;

            const drawFloorWithGrid = (w, d, x, y, z) => {
                const thickness = 0.6; // Grosor estructural de "concreto"
                const f = new THREE.Mesh(new THREE.BoxGeometry(w, thickness, d), marbleMat);
                // Ajustamos para que la superficie superior esté en 'y'
                f.position.set(x, y - thickness / 2, z);
                f.receiveShadow = renderer.shadowMap.enabled;
                scene.add(f);

                // DISEÑO DE LUJO: Doble línea (Architectural Grid)
                for (let i = -200 / 2; i <= 200 / 2; i += CENTRAL_CORRIDOR_GRID_STEP) {
                    if (i >= x - w / 2 - 0.1 && i <= x + w / 2 + 0.1) {
                        [0, CENTRAL_CORRIDOR_GRID_GAP].forEach(off => {
                            const l = new THREE.Mesh(getMallPlaneGeometry(0.04, d), bronzeMat);
                            l.rotation.x = -Math.PI / 2; l.position.set(i + off, y + 0.01, z); scene.add(l);
                        });
                    }
                }
                for (let j = -200 / 2; j <= 200 / 2; j += CENTRAL_CORRIDOR_GRID_STEP) {
                    if (j >= z - d / 2 - 0.1 && j <= z + d / 2 + 0.1) {
                        [0, CENTRAL_CORRIDOR_GRID_GAP].forEach(off => {
                            const l = new THREE.Mesh(getMallPlaneGeometry(w, 0.04), bronzeMat);
                            l.rotation.x = -Math.PI / 2; l.position.set(x, y + 0.01, j + off); scene.add(l);
                        });
                    }
                }
            };

            // PASILLOS EXPANDIDOS (34 de ancho, 190 de largo para tocar Anclas en 95)
            drawFloorWithGrid(34, 190, 0, 0.1, 0);
            drawFloorWithGrid(190, 34, 0, 0.1, 0);

            // PASARELAS NORTE-SUR: borde exterior fijo y 2 m nuevos hacia los atrios.
            drawFloorWithGrid(SECOND_FLOOR_WALKWAY_WIDTH, 190, SECOND_FLOOR_WALKWAY_CENTER, 5.4, 0);   // ESTE
            drawFloorWithGrid(SECOND_FLOOR_WALKWAY_WIDTH, 190, -SECOND_FLOOR_WALKWAY_CENTER, 5.4, 0);  // OESTE

            // PASARELAS ESTE-OESTE con la misma seccion de 8 m.
            drawFloorWithGrid(190, SECOND_FLOOR_WALKWAY_WIDTH, 0, 5.4, SECOND_FLOOR_WALKWAY_CENTER);  // NORTE
            drawFloorWithGrid(190, SECOND_FLOOR_WALKWAY_WIDTH, 0, 5.4, -SECOND_FLOOR_WALKWAY_CENTER); // SUR

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
            const pillarShaftMat = new THREE.MeshStandardMaterial({ color: 0xeeeae4, roughness: 0.58, metalness: 0.02 });
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
                    new THREE.CylinderGeometry(0.39, 0.41, shaftH, 28),
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
                window.setMallShadowMode?.(support, { cast: true, receive: true });
                scene.add(support);
                // Huella un poco más contenida: evita sensación de "bulto invisible"
                // alrededor del fuste sin permitir atravesar visualmente el pilar.
                registerSolidFootprint(x, z, 0.88, 0.88, 0, supportTopY + 0.2);
            };

            // Modulacion estructural: los soportes acompanian el nuevo borde interior
            // con 1.25 m de retiro para acercarlos 0.50 m a las fachadas.
            const longSpanStations = [-62, -38, 38, 62];
            const innerEdgeOffset = SECOND_FLOOR_ATRIUM_EDGE + 1.25;
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

        const atriumRailEdge = SECOND_FLOOR_ATRIUM_EDGE;
        const atriumRailSpan = SECOND_FLOOR_ATRIUM_SPAN;
        const escalatorEntryRailLength = atriumRailEdge - SECOND_FLOOR_ESCALATOR_OPENING_HALF_WIDTH;
        const escalatorEntryRailCenter = SECOND_FLOOR_ESCALATOR_OPENING_HALF_WIDTH + escalatorEntryRailLength / 2;

        // --- SEGURIDAD Y LUJO: BARANDILLAS HUECO SUR (S) ---
        createRail(escalatorEntryRailCenter, -17, escalatorEntryRailLength, false); // Segmento derecho
        createRail(-escalatorEntryRailCenter, -17, escalatorEntryRailLength, false); // Segmento izquierdo
        // Cierre central entre ambas escalas: protege el hueco sin invadir sus bocas.
        createRail(0, -17, 2.5, false);
        createRail(0, -83, atriumRailSpan, false);
        createRail(atriumRailEdge, -50, 66, true);
        createRail(-atriumRailEdge, -50, 66, true);
        // Refuerzo puntual frente a S-203: el tramo visible existe, pero aquí necesitaba mayor espesor de colisión.
        registerCollider(-atriumRailEdge, -71.0, 1.4, 12.5, 5.0, 9.0);

        // --- SEGURIDAD Y LUJO: BARANDILLAS HUECO NORTE (N) ---
        createRail(escalatorEntryRailCenter, 17, escalatorEntryRailLength, false); // Segmento derecho
        createRail(-escalatorEntryRailCenter, 17, escalatorEntryRailLength, false); // Segmento izquierdo
        // Replica simetrica del cierre central en el desembarco norte.
        createRail(0, 17, 2.5, false);
        createRail(0, 83, atriumRailSpan, false);
        createRail(-atriumRailEdge, 50, 66, true);
        createRail(atriumRailEdge, 50, 66, true);
        // Refuerzo puntual del borde norte-derecho, vinculado a la nueva linea de baranda.
        registerCollider(atriumRailEdge, 71.8, 1.4, 12.5, 5.0, 9.0);

        // --- SEGURIDAD Y LUJO: BARANDILLAS HUECO OESTE (O) ---
        createRail(-17, 0, atriumRailSpan, true);
        createRail(-83, 0, atriumRailSpan, true);
        createRail(-50, atriumRailEdge, 66, false);
        createRail(-50, -atriumRailEdge, 66, false);
        // Refuerzo puntual del borde oeste superior, vinculado a la nueva linea de baranda.
        registerCollider(-78.0, atriumRailEdge, 8.0, 1.2, 5.0, 9.0);

        // --- SEGURIDAD Y LUJO: BARANDILLAS HUECO ESTE (E) ---
        createRail(17, 0, atriumRailSpan, true);
        createRail(83, 0, atriumRailSpan, true);
        createRail(50, atriumRailEdge, 66, false);
        createRail(50, -atriumRailEdge, 66, false);

        // --- SEGURIDAD Y LUJO: ANILLO CENTRAL (ATRIO) ---
        createRail(0, atriumRailEdge, atriumRailSpan, false);
        createRail(0, -atriumRailEdge, atriumRailSpan, false);
        createRail(atriumRailEdge, 0, atriumRailSpan, true);
        createRail(-atriumRailEdge, 0, atriumRailSpan, true);
        // Refuerzo de seguridad en esquinas del anillo central (evita cruce diagonal por unión de tramos)
        [
            [atriumRailEdge, atriumRailEdge],
            [atriumRailEdge, -atriumRailEdge],
            [-atriumRailEdge, atriumRailEdge],
            [-atriumRailEdge, -atriumRailEdge]
        ].forEach(([cx, cz]) => registerCollider(cx, cz, 0.9, 0.9, 5.0, 9.0));



















        createVaultedRoof(0, VAULT_CENTER_OFFSET, VAULT_LENGTH, 'N');
        createVaultedRoof(0, -VAULT_CENTER_OFFSET, VAULT_LENGTH, 'S');
        createVaultedRoof(VAULT_CENTER_OFFSET, 0, VAULT_LENGTH, 'O', true);
        createVaultedRoof(-VAULT_CENTER_OFFSET, 0, VAULT_LENGTH, 'E', true);
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
                const panel = new THREE.Mesh(getMallPlaneGeometry(panelW, panelD), panelMat);
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
        const centralDomeFrame = new THREE.Group();
        centralDomeFrame.name = 'Estructura superior - Cúpula central';
        scene.add(centralDomeFrame);
        const lastRingTarget = DOME_RING_TARGETS[DOME_RING_TARGETS.length - 1];
        const domeRibArc = Math.acos((lastRingTarget.height - DOME_CENTER_Y) / CENTRAL_DOME_RADIUS); // Ángulo para llegar al último anillo
        for (let i = 0; i < 8; i++) {
            const rib = new THREE.Mesh(new THREE.TorusGeometry(CENTRAL_DOME_RADIUS, 0.10, 16, 64, domeRibArc), darkMat);
            rib.position.set(0, DOME_CENTER_Y, 0);
            rib.rotation.z = Math.PI / 2; // Orientar verticalmente
            rib.rotation.y = (Math.PI / 4) * i; // Distribuir radialmente
            centralDomeFrame.add(rib);
        }
        // Rebuild de anillos desde cero (7 niveles):
        // 1) fierro más alto (0), 2..7) pares siguientes por altura (±4, ±7, ±10, ±13, ±16, ±19).
        DOME_RING_TARGETS.forEach((target) => {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(target.radius, 0.10, 16, 128), darkMat);
            const ringHeight = target.height;
            ring.position.set(0, ringHeight, 0);
            ring.rotation.x = Math.PI / 2;
            ring.userData.familyLevel = target.level;
            centralDomeFrame.add(ring);
        });
        registerOverheadStructure(centralDomeFrame, {
            id: 'central-dome-frame',
            label: 'Cúpula central',
            kind: 'dome',
            radialRibCount: 8,
            ringCount: DOME_RING_TARGETS.length,
            radialStep: Math.PI / 4
        });
        window.mallOverheadStructureAuditSource = {
            revision: '20260905-structural-audit-v1',
            vaults: overheadStructureAuditRegistry.filter((entry) => entry.kind === 'vault'),
            dome: overheadStructureAuditRegistry.find((entry) => entry.kind === 'dome') || null
        };

        // (Luces puntuales extra removidas para mantener rendimiento de carga estable)

        // Modo nocturno liviano (sin luces dinámicas adicionales): solo materiales + luces globales.
        const currentHour = new Date().getHours();
        const isNightMode = currentHour >= 19 || currentHour < 7;
        if (isNightMode) {
            roofGlassMat.color.setHex(0x9bb7d4);
            roofGlassMat.opacity = 0.42;
            roofGlassMat.transmission = 0.56;
            glassMat.color.setHex(0x9bb7de);
            glassMat.opacity = 0.58;
            glassMat.transmission = 0.18;
            darkMat.color.setHex(DARK_METAL_NIGHT);
            darkMat.roughness = 0.34;
            darkMat.metalness = 0.68;
            ambientLight.intensity = 0.42;
            hemisphereLight.intensity = 0.62;
            sun.intensity = 0.82;
        } else {
            roofGlassMat.color.setHex(0xc9def3);
            roofGlassMat.opacity = 0.38;
            roofGlassMat.transmission = 0.62;
            glassMat.color.setHex(0xdcecff);
            glassMat.opacity = 0.58;
            glassMat.transmission = 0.42;
            darkMat.color.setHex(DARK_METAL_DAY);
            darkMat.roughness = 0.28;
            darkMat.metalness = 0.68;
            ambientLight.intensity = 0.5;
            hemisphereLight.intensity = 0.84;
            sun.intensity = 1.55;
        }
        roofGlassMat.needsUpdate = true;
        glassMat.needsUpdate = true;
        darkMat.needsUpdate = true;
        roofGlassMeshes.forEach((mesh) => { if (mesh?.material) mesh.material.needsUpdate = true; });

        // Acabado visual sutil: no cambia geometría, transformaciones ni colisiones.
        // Se aplica una sola vez sobre superficies opacas para evitar propagar cambios
        // a vidrios, imágenes, avatares y materiales interactivos.
        (() => {
            if (scene.userData.realisticSurfaceFinishApplied) return;

            const textureCache = new Map();
            const excludedPattern = /glass|vidrio|image|imagen|poster|logo|sign|cartel|avatar|npc|tree|leaf|plant|water|agua|car|auto|road|asphalt|parking|sidewalk|vereda|line|stripe|door|puerta|handrail|pasamanos/i;
            const metalPattern = /metal|frame|marco|rail|barand|fierro|steel|acero|brass|bronze|gold|oro|pillar|pilar|column|columna/i;
            const wallPattern = /wall|muro|facade|fachada|panel|back|tabique|partition|divisor/i;
            const floorPattern = /floor|piso|ground|suelo|platform|plataforma|slab|losa/i;

            const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
            const hashString = (value) => {
                let hash = 2166136261;
                for (let i = 0; i < value.length; i++) {
                    hash ^= value.charCodeAt(i);
                    hash = Math.imul(hash, 16777619);
                }
                return hash >>> 0;
            };

            const getRoughnessTexture = (kind) => {
                if (textureCache.has(kind)) return textureCache.get(kind);

                const canvas = document.createElement('canvas');
                canvas.width = 32;
                canvas.height = 32;
                const context = canvas.getContext('2d');
                if (!context) return null;

                const imageData = context.createImageData(canvas.width, canvas.height);
                const base = kind === 'metal' ? 224 : kind === 'wall' ? 214 : 205;
                const variance = kind === 'metal' ? 12 : 16;
                let seed = hashString(`mall-surface-${kind}`);
                for (let i = 0; i < imageData.data.length; i += 4) {
                    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                    const noise = ((seed >>> 24) / 255 - 0.5) * variance;
                    const value = clamp(Math.round(base + noise), 0, 255);
                    imageData.data[i] = value;
                    imageData.data[i + 1] = value;
                    imageData.data[i + 2] = value;
                    imageData.data[i + 3] = 255;
                }
                context.putImageData(imageData, 0, 0);

                const texture = new THREE.CanvasTexture(canvas);
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(kind === 'metal' ? 3 : 5, kind === 'metal' ? 3 : 5);
                if ('NoColorSpace' in THREE) texture.colorSpace = THREE.NoColorSpace;
                texture.needsUpdate = true;
                textureCache.set(kind, texture);
                return texture;
            };

            const getMaterialText = (mesh, material) => [
                mesh.name,
                material.name,
                mesh.userData?.mallEditableType,
                mesh.userData?.mallEditableLabel,
                mesh.userData?.mallEditableAreaCode
            ].filter(Boolean).join(' ');

            const classifySurface = (mesh, material) => {
                if (!material || material.transparent || material.opacity < 0.99 || material.transmission > 0.01) return null;
                if (!('roughness' in material)) return null;

                const text = getMaterialText(mesh, material);
                if (excludedPattern.test(text)) return null;
                if (metalPattern.test(text) || material.metalness >= 0.45) return 'metal';
                if (wallPattern.test(text)) return 'wall';
                if (floorPattern.test(text)) return 'floor';

                const geometry = mesh.geometry;
                if (!geometry) return null;
                if (!geometry.boundingBox) geometry.computeBoundingBox();
                const size = new THREE.Vector3();
                geometry.boundingBox.getSize(size);
                const broad = Math.max(size.x, size.z);
                const thin = Math.min(size.x, size.z);
                if (size.y <= 0.28 && broad >= 4 && mesh.position.y <= 2.2) return 'floor';
                if (size.y >= 2.5 && thin <= 0.8 && broad >= 3) return 'wall';
                return null;
            };

            scene.traverse((mesh) => {
                if (!mesh.isMesh || Array.isArray(mesh.material)) return;
                const kind = classifySurface(mesh, mesh.material);
                if (!kind || mesh.material.userData?.realisticSurfaceFinish) return;

                const material = mesh.material.clone();
                material.userData = { ...(material.userData || {}), realisticSurfaceFinish: true };
                material.roughnessMap = getRoughnessTexture(kind);
                material.roughness = kind === 'metal' ? 0.34 : kind === 'wall' ? 0.72 : 0.78;
                if (kind === 'metal') material.metalness = clamp(Math.max(material.metalness || 0, 0.58), 0, 0.86);
                material.needsUpdate = true;
                mesh.material = material;
            });

            scene.userData.realisticSurfaceFinishApplied = true;
        })();
