        // --- MOTOR DE COLISIONES PRO (CON ALTURA) ---
        const colliders = [];
        const PLAYER_COLLISION_RADIUS = 0.4;
        const DYNAMIC_ACTOR_COLLISION_RADIUS = 0.4;
        const DYNAMIC_ACTOR_COLLISION_HEIGHT = 2.35;
        function registerCollider(x, z, w, d, minY = -5, maxY = 50, ownerId = '') {
            const collider = {
                minX: x - w / 2, maxX: x + w / 2,
                minZ: z - d / 2, maxZ: z + d / 2,
                minY, maxY, ownerId, enabled: true
            };
            colliders.push(collider);
            return collider;
        }
        function registerCircularCollider(x, z, radius, minY = -5, maxY = 50, ownerId = '') {
            const collider = { shape: 'circle', x, z, radius, minY, maxY, ownerId, enabled: true };
            colliders.push(collider);
            return collider;
        }
        function registerOrientedCollider(x, z, w, d, rotation = 0, minY = -5, maxY = 50, ownerId = '') {
            const collider = {
                shape: 'oriented-box',
                x, z,
                halfW: w / 2,
                halfD: d / 2,
                rotation,
                minY, maxY, ownerId, enabled: true
            };
            colliders.push(collider);
            return collider;
        }
        function isPointInsideColliderFootprint(nx, nz, collider, radius = 0) {
            if (collider.shape === 'circle') {
                const dx = nx - collider.x;
                const dz = nz - collider.z;
                const combinedRadius = collider.radius + radius;
                return (dx * dx) + (dz * dz) < combinedRadius * combinedRadius;
            }
            if (collider.shape === 'oriented-box') {
                const dx = nx - collider.x;
                const dz = nz - collider.z;
                const cos = Math.cos(collider.rotation);
                const sin = Math.sin(collider.rotation);
                const localX = dx * cos - dz * sin;
                const localZ = dx * sin + dz * cos;
                return circleOverlapsRectangle(localX, localZ, collider.halfW, collider.halfD, radius);
            }
            const centerX = (collider.minX + collider.maxX) / 2;
            const centerZ = (collider.minZ + collider.maxZ) / 2;
            return circleOverlapsRectangle(
                nx - centerX,
                nz - centerZ,
                (collider.maxX - collider.minX) / 2,
                (collider.maxZ - collider.minZ) / 2,
                radius
            );
        }
        function circleOverlapsRectangle(localX, localZ, halfW, halfD, radius) {
            if (Math.abs(localX) <= halfW && Math.abs(localZ) <= halfD) return true;
            const outsideX = Math.max(0, Math.abs(localX) - halfW);
            const outsideZ = Math.max(0, Math.abs(localZ) - halfD);
            return (outsideX * outsideX) + (outsideZ * outsideZ) < radius * radius;
        }
        function isPointInsideCollider(nx, ny, nz, collider, radius = 0, bodyMinY = null, bodyMaxY = null) {
            const verticalOverlap = Number.isFinite(bodyMinY) && Number.isFinite(bodyMaxY)
                ? bodyMinY < collider.maxY && bodyMaxY > collider.minY
                : ny > collider.minY && ny < collider.maxY;
            if (!verticalOverlap) return false;
            return isPointInsideColliderFootprint(nx, nz, collider, radius);
        }
        function doesBodyOverlapCollider(nx, nz, minY, maxY, collider, radius = 0) {
            return isPointInsideColliderFootprint(nx, nz, collider, radius)
                && minY < collider.maxY && maxY > collider.minY;
        }
        function getColliderPenetrationDepth(nx, nz, collider, radius = 0) {
            if (collider.shape === 'circle') {
                const dx = nx - collider.x;
                const dz = nz - collider.z;
                return Math.max(0, collider.radius + radius - Math.hypot(dx, dz));
            }

            let centerX;
            let centerZ;
            let halfW;
            let halfD;
            let localX;
            let localZ;
            if (collider.shape === 'oriented-box') {
                const dx = nx - collider.x;
                const dz = nz - collider.z;
                const cos = Math.cos(collider.rotation);
                const sin = Math.sin(collider.rotation);
                localX = dx * cos - dz * sin;
                localZ = dx * sin + dz * cos;
                halfW = collider.halfW;
                halfD = collider.halfD;
            } else {
                centerX = (collider.minX + collider.maxX) / 2;
                centerZ = (collider.minZ + collider.maxZ) / 2;
                localX = nx - centerX;
                localZ = nz - centerZ;
                halfW = (collider.maxX - collider.minX) / 2;
                halfD = (collider.maxZ - collider.minZ) / 2;
            }

            const outsideX = Math.max(0, Math.abs(localX) - halfW);
            const outsideZ = Math.max(0, Math.abs(localZ) - halfD);
            if (outsideX === 0 && outsideZ === 0) {
                return Math.min(halfW - Math.abs(localX), halfD - Math.abs(localZ)) + radius;
            }
            return Math.max(0, radius - Math.hypot(outsideX, outsideZ));
        }
        function getDynamicCollisionActors(ignoreActorId = null) {
            const actors = [];
            if (isWalking && ignoreActorId !== '__local__') {
                actors.push({
                    id: '__local__',
                    x: camera.position.x,
                    y: camera.position.y - PLAYER_EYE_HEIGHT,
                    z: camera.position.z,
                    radius: DYNAMIC_ACTOR_COLLISION_RADIUS,
                    height: DYNAMIC_ACTOR_COLLISION_HEIGHT
                });
            }

            Object.entries(otherPlayers).forEach(([id, player]) => {
                if (!player?.mesh || player.hasReceivedPose === false || ignoreActorId === `remote:${id}`) return;
                actors.push({
                    id: `remote:${id}`,
                    x: player.mesh.position.x,
                    y: player.mesh.position.y,
                    z: player.mesh.position.z,
                    radius: player.mesh.userData?.collisionRadius || DYNAMIC_ACTOR_COLLISION_RADIUS,
                    height: player.mesh.userData?.collisionHeight || DYNAMIC_ACTOR_COLLISION_HEIGHT
                });
            });

            npcs.forEach((npc, index) => {
                if (!npc?.mesh || ignoreActorId === `npc:${index}`) return;
                actors.push({
                    id: `npc:${index}`,
                    x: npc.mesh.position.x,
                    y: npc.mesh.position.y,
                    z: npc.mesh.position.z,
                    radius: npc.mesh.userData?.collisionRadius || DYNAMIC_ACTOR_COLLISION_RADIUS,
                    height: npc.mesh.userData?.collisionHeight || DYNAMIC_ACTOR_COLLISION_HEIGHT
                });
            });

            return actors;
        }
        function checkCollision(nx, ny, nz, options = {}) {
            const {
                ignoreActorId = null,
                includeActors = true,
                collisionRadius = PLAYER_COLLISION_RADIUS,
                bodyMinY = null,
                bodyMaxY = null,
                ignoredColliderOwnerIds = [],
                allowStaticCollisionEscape = false
            } = options;

            const ignoredOwners = new Set(ignoredColliderOwnerIds);
            let reducingExistingStaticOverlap = false;
            if (allowStaticCollisionEscape && ignoreActorId === '__local__' && camera?.position) {
                const hasBodyHeight = Number.isFinite(bodyMinY) && Number.isFinite(bodyMaxY);
                const overlapsVertically = (collider) => hasBodyHeight
                    ? bodyMinY < collider.maxY && bodyMaxY > collider.minY
                    : ny > collider.minY && ny < collider.maxY;
                const activeColliders = colliders.filter((collider) => collider.enabled !== false
                    && !(collider.ownerId && ignoredOwners.has(collider.ownerId))
                    && overlapsVertically(collider));
                const originPenetrations = new Map();
                let originTotal = 0;
                activeColliders.forEach((collider) => {
                    const radius = Math.min(collisionRadius, collider.contactRadius ?? collisionRadius);
                    const depth = getColliderPenetrationDepth(
                        camera.position.x, camera.position.z, collider, radius
                    );
                    if (depth > 0) {
                        originPenetrations.set(collider, depth);
                        originTotal += depth;
                    }
                });

                if (originTotal > 0) {
                    let targetTotal = 0;
                    let entersNewCollider = false;
                    activeColliders.forEach((collider) => {
                        const radius = Math.min(collisionRadius, collider.contactRadius ?? collisionRadius);
                        const depth = getColliderPenetrationDepth(nx, nz, collider, radius);
                        if (depth > 0 && !originPenetrations.has(collider)) entersNewCollider = true;
                        targetTotal += depth;
                    });
                    reducingExistingStaticOverlap = !entersNewCollider
                        && targetTotal < originTotal - 0.0001;
                }
            }

            if (!reducingExistingStaticOverlap) {
                for (let c of colliders) {
                    if (c.enabled === false) continue;
                    if (c.ownerId && ignoredOwners.has(c.ownerId)) continue;
                    const effectiveRadius = Math.min(collisionRadius, c.contactRadius ?? collisionRadius);
                    const hasCollision = Number.isFinite(bodyMinY) && Number.isFinite(bodyMaxY)
                        ? doesBodyOverlapCollider(nx, nz, bodyMinY, bodyMaxY, c, effectiveRadius)
                        : isPointInsideCollider(nx, ny, nz, c, effectiveRadius);
                    if (hasCollision) return true;
                }
            }

            // Los autos en circulación son obstáculos dinámicos, no colliders estáticos.
            const trafficVehicles = typeof window !== 'undefined' && Array.isArray(window.mallTrafficVehicles)
                ? window.mallTrafficVehicles
                : [];
            for (const vehicle of trafficVehicles) {
                if (!vehicle?.mesh?.visible) continue;
                const relativeX = nx - vehicle.mesh.position.x;
                const relativeZ = nz - vehicle.mesh.position.z;
                const cos = Math.cos(vehicle.mesh.rotation.y);
                const sin = Math.sin(vehicle.mesh.rotation.y);
                const localX = relativeX * cos - relativeZ * sin;
                const localZ = relativeX * sin + relativeZ * cos;
                const halfWidth = (vehicle.width || 2.36) / 2 + collisionRadius;
                const halfLength = (vehicle.length || 4.95) / 2 + collisionRadius;
                const vehicleHeight = vehicle.height || 2.2;
                const verticalOverlap = Number.isFinite(bodyMinY) && Number.isFinite(bodyMaxY)
                    ? bodyMinY < vehicleHeight && bodyMaxY > -0.1
                    : ny > -0.1 && ny < vehicleHeight;
                if (circleOverlapsRectangle(localX, localZ, halfWidth - collisionRadius, halfLength - collisionRadius, collisionRadius)
                    && verticalOverlap) {
                    return true;
                }
            }

            if (includeActors) {
                // Obtener la posición actual del actor que comprueba la colisión, si está disponible
                let currentX = null;
                let currentZ = null;
                if (ignoreActorId) {
                    if (ignoreActorId === '__local__') {
                        if (typeof camera !== 'undefined') {
                            currentX = camera.position.x;
                            currentZ = camera.position.z;
                        }
                    } else if (ignoreActorId.startsWith('npc:')) {
                        const idx = parseInt(ignoreActorId.split(':')[1]);
                        if (typeof npcs !== 'undefined' && npcs[idx]) {
                            currentX = npcs[idx].mesh.position.x;
                            currentZ = npcs[idx].mesh.position.z;
                        }
                    } else if (ignoreActorId.startsWith('remote:')) {
                        const rid = ignoreActorId.split(':')[1];
                        if (typeof otherPlayers !== 'undefined' && otherPlayers[rid]) {
                            currentX = otherPlayers[rid].mesh.position.x;
                            currentZ = otherPlayers[rid].mesh.position.z;
                        }
                    }
                }

                for (let actor of getDynamicCollisionActors(ignoreActorId)) {
                    const actorMinY = actor.y;
                    const actorMaxY = actor.y + actor.height;
                    if (ny <= actorMinY || ny >= actorMaxY) continue;
                    const dx = nx - actor.x;
                    const dz = nz - actor.z;
                    const minDistance = collisionRadius + actor.radius;
                    if ((dx * dx) + (dz * dz) < minDistance * minDistance) {
                        // Si conocemos la posición actual, verificamos si nos estamos alejando
                        if (currentX !== null && currentZ !== null) {
                            const oldDx = currentX - actor.x;
                            const oldDz = currentZ - actor.z;
                            const oldDistSq = (oldDx * oldDx) + (oldDz * oldDz);
                            const newDistSq = (dx * dx) + (dz * dz);
                            // Si la nueva distancia es mayor que la anterior, nos estamos alejando de la colisión
                            if (newDistSq > oldDistSq) {
                                continue;
                            }
                        }
                        return true;
                    }
                }
            }

            return false;
        }
        function setActorCollisionProfile(actorMesh, radius = DYNAMIC_ACTOR_COLLISION_RADIUS, height = DYNAMIC_ACTOR_COLLISION_HEIGHT) {
            if (!actorMesh?.userData) return;
            actorMesh.userData.collisionRadius = radius;
            actorMesh.userData.collisionHeight = height;
        }
        function registerSolidFootprint(x, z, w, d, minY = 0, maxY = 4, ownerId = '') {
            return registerCollider(x, z, w, d, minY, maxY, ownerId);
        }
        function registerRotatedSolidFootprint(x, z, w, d, rot = 0, minY = 0, maxY = 4, ownerId = '') {
            return registerOrientedCollider(x, z, w, d, rot, minY, maxY, ownerId);
        }
        function registerObjectColliderFromBounds(object3D, options = {}) {
            if (!object3D) return;
            const {
                paddingX = 0,
                paddingZ = 0,
                minY = null,
                maxY = null,
                minSize = 0.005
            } = options;
            // El mobiliario se registra mientras su local aun puede estar fuera de la escena.
            // Actualizar toda la cadena evita que su huella quede en coordenadas locales
            // y se replique como un obstaculo invisible cerca del centro del mall.
            object3D.updateWorldMatrix(true, true);
            const bbox = new THREE.Box3().setFromObject(object3D);
            if (!Number.isFinite(bbox.min.x) || bbox.isEmpty()) return;
            const inverseRoot = new THREE.Matrix4().copy(object3D.matrixWorld).invert();
            const localBounds = new THREE.Box3().makeEmpty();
            object3D.traverse((child) => {
                if (!child.isMesh || !child.geometry) return;
                if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
                if (!child.geometry.boundingBox) return;
                const childToRoot = new THREE.Matrix4().multiplyMatrices(inverseRoot, child.matrixWorld);
                localBounds.union(child.geometry.boundingBox.clone().applyMatrix4(childToRoot));
            });
            if (localBounds.isEmpty()) return;
            const localSize = new THREE.Vector3();
            const localCenter = new THREE.Vector3();
            localBounds.getSize(localSize);
            localBounds.getCenter(localCenter);
            const worldCenter = localCenter.applyMatrix4(object3D.matrixWorld);
            const elements = object3D.matrixWorld.elements;
            const scaleX = Math.hypot(elements[0], elements[2]);
            const scaleZ = Math.hypot(elements[8], elements[10]);
            const rotationY = Math.atan2(elements[8], elements[0]);
            const ownerId = options.ownerId || object3D.userData?.mallEditableId || '';
            if (ownerId) {
                for (let index = colliders.length - 1; index >= 0; index -= 1) {
                    if (colliders[index].ownerId === ownerId) colliders.splice(index, 1);
                }
            }
            return registerOrientedCollider(
                worldCenter.x,
                worldCenter.z,
                Math.max(minSize, localSize.x * scaleX + paddingX * 2),
                Math.max(minSize, localSize.z * scaleZ + paddingZ * 2),
                rotationY,
                minY ?? bbox.min.y,
                maxY ?? bbox.max.y,
                ownerId
            );
        }

        function rebuildMallEditableCollider(object3D, ownerId) {
            if (!object3D || !ownerId) return;
            for (let index = colliders.length - 1; index >= 0; index -= 1) {
                if (colliders[index].ownerId === ownerId) colliders.splice(index, 1);
            }
            if (object3D.visible === false) return;
            registerObjectColliderFromBounds(object3D, { ownerId });
        }

        if (typeof window !== 'undefined') {
            window.mallPhysics = {
                ...(window.mallPhysics || {}),
                registerOrientedCollider
            };
            window.mallEditableCollision = { rebuild: rebuildMallEditableCollider };
        }

