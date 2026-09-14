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
        function isPointInsideCollider(nx, ny, nz, collider, radius = 0) {
            if (collider.shape === 'circle') {
                const dx = nx - collider.x;
                const dz = nz - collider.z;
                const combinedRadius = collider.radius + radius;
                return (dx * dx) + (dz * dz) < combinedRadius * combinedRadius
                    && ny > collider.minY && ny < collider.maxY;
            }
            if (collider.shape === 'oriented-box') {
                const dx = nx - collider.x;
                const dz = nz - collider.z;
                const cos = Math.cos(collider.rotation);
                const sin = Math.sin(collider.rotation);
                const localX = dx * cos - dz * sin;
                const localZ = dx * sin + dz * cos;
                return Math.abs(localX) < collider.halfW + radius
                    && Math.abs(localZ) < collider.halfD + radius
                    && ny > collider.minY && ny < collider.maxY;
            }
            return nx > (collider.minX - radius) && nx < (collider.maxX + radius)
                && nz > (collider.minZ - radius) && nz < (collider.maxZ + radius)
                && ny > collider.minY && ny < collider.maxY;
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
                collisionRadius = PLAYER_COLLISION_RADIUS
            } = options;

            for (let c of colliders) {
                if (c.enabled === false) continue;
                if (isPointInsideCollider(nx, ny, nz, c, collisionRadius)) return true;
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
                if (Math.abs(localX) < halfWidth && Math.abs(localZ) < halfLength && ny > -0.1 && ny < vehicleHeight) {
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
            const cos = Math.cos(rot);
            const sin = Math.sin(rot);
            const footprintW = Math.abs(w * cos) + Math.abs(d * sin);
            const footprintD = Math.abs(w * sin) + Math.abs(d * cos);
            return registerCollider(x, z, footprintW, footprintD, minY, maxY, ownerId);
        }
        function registerObjectColliderFromBounds(object3D, options = {}) {
            if (!object3D) return;
            const {
                paddingX = 0.08,
                paddingZ = 0.08,
                minY = null,
                maxY = null,
                minSize = 0.12
            } = options;
            // El mobiliario se registra mientras su local aun puede estar fuera de la escena.
            // Actualizar toda la cadena evita que su huella quede en coordenadas locales
            // y se replique como un obstaculo invisible cerca del centro del mall.
            object3D.updateWorldMatrix(true, true);
            const bbox = new THREE.Box3().setFromObject(object3D);
            if (!Number.isFinite(bbox.min.x) || bbox.isEmpty()) return;
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            bbox.getSize(size);
            bbox.getCenter(center);
            const ownerId = options.ownerId || object3D.userData?.mallEditableId || '';
            if (ownerId) {
                for (let index = colliders.length - 1; index >= 0; index -= 1) {
                    if (colliders[index].ownerId === ownerId) colliders.splice(index, 1);
                }
            }
            return registerCollider(
                center.x,
                center.z,
                Math.max(minSize, size.x + paddingX * 2),
                Math.max(minSize, size.z + paddingZ * 2),
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
            registerObjectColliderFromBounds(object3D, { ownerId, paddingX: 0.08, paddingZ: 0.08 });
        }

        if (typeof window !== 'undefined') {
            window.mallPhysics = {
                ...(window.mallPhysics || {}),
                registerOrientedCollider
            };
            window.mallEditableCollision = { rebuild: rebuildMallEditableCollider };
        }

