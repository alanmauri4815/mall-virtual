        // --- VARIABLES GLOBALES DE PUBLICIDAD ---
        let lastAdUpdate = Date.now();
        let adIndex = 0;

        let lastLabelUpdateAt = 0;
        const LABEL_UPDATE_INTERVAL_MS = 1000 / 24;
        const FAR_NPC_SIM_DISTANCE = IS_COARSE_POINTER ? 46 : 58;
        const FAR_NPC_SKIP_FRAMES = IS_COARSE_POINTER ? 2 : 1;
        let frameTick = 0;
        let lastFrameTimeMs = performance.now();
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
            window.mallRuntimeMonitor?.enter(name);
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
            if (typeof currentMoveVelocityX !== 'undefined') currentMoveVelocityX = 0;
            if (typeof currentMoveVelocityZ !== 'undefined') currentMoveVelocityZ = 0;
            if (typeof currentYawVelocity !== 'undefined') currentYawVelocity = 0;
            if (typeof currentPitchVelocity !== 'undefined') currentPitchVelocity = 0;
            if (joyKnob) joyKnob.style.transform = `translate(-50%, -50%)`;
        }

        window.addEventListener('visibilitychange', () => {
            lastFrameTimeMs = performance.now();
            if (document.hidden) resetMovementInputState();
        });
        window.addEventListener('focus', () => {
            if (shouldForceWalkMode()) focusMallCanvas();
        });

        let lastRenderedFrameAt = 0;
        function animate() {
            requestAnimationFrame(animate);

            const nowMs = performance.now();
            if (document.hidden || window.isMallWebGLContextLost?.()) {
                lastFrameTimeMs = nowMs;
                return;
            }
            const targetFrameIntervalMs = window.mallPerformanceProfile?.targetFrameIntervalMs || 0;
            if (targetFrameIntervalMs && nowMs - lastRenderedFrameAt < targetFrameIntervalMs) return;
            lastRenderedFrameAt = nowMs;
            const deltaSec = Math.min(1 / 30, Math.max(1 / 120, (nowMs - lastFrameTimeMs) / 1000 || (1 / 60)));
            lastFrameTimeMs = nowMs;
            frameTick = (frameTick + 1) % 100000;
            const currentTime = Date.now();
            const activeAdTextures = window.mallAdTextures;
            const activeAdScreens = window.mallAdScreenMeshes;
            if (currentTime - lastAdUpdate > 5000 && Array.isArray(activeAdTextures) && activeAdTextures.length) {
                adIndex = (adIndex + 1) % activeAdTextures.length;
                runFrameStep('ads', () => (activeAdScreens || []).forEach(s => {
                    if (s?.material) s.material.map = activeAdTextures[adIndex];
                }));
                lastAdUpdate = currentTime;
            }
            const shouldUpdateLabels = nowMs - lastLabelUpdateAt >= LABEL_UPDATE_INTERVAL_MS;
            if (shouldUpdateLabels) lastLabelUpdateAt = nowMs;
            runFrameStep('adaptive-fog', updateAdaptiveFogProfile);

            runFrameStep('keyboard-navigation', () => updateKeyboardNavigation(deltaSec));
            runFrameStep('maze-game', () => window.updateMallMazeGame?.(nowMs));
            runFrameStep('escalator-visuals', () => updateEscalatorStepVisuals(deltaSec));
            runFrameStep('boutique-streaming', updateBoutiqueInteriorStreaming);
            runFrameStep('anchor-streaming', updateAnchorInteriorStreaming);
            runFrameStep('other-players', () => updateOtherPlayers(nowMs, shouldUpdateLabels));
            runFrameStep('npcs', () => updateNPCs(nowMs, shouldUpdateLabels, frameTick));
            runFrameStep('traffic-vehicles', () => window.updateMallTrafficVehicles?.(deltaSec));
            runFrameStep('boutique-doors', updateBoutiqueSlidingDoors);
            runFrameStep('corridor-doors', updateCorridorAccessDoors);
            runFrameStep('axis-reference', updateAxisReference);
            runFrameStep('gps-display', updateGPSDisplay);

            runFrameStep('controls-update', () => {
                controls.update();
                window.keepMallSeatedCameraAnchored?.();
            });
            runFrameStep('analytics-attention', () => window.mallAnalytics?.updateAttention(nowMs));
            runFrameStep('member-pedometer', () => window.updateMemberPedometer?.(nowMs));
            runFrameStep('promotion-collectibles', () => window.updateMallPromotionCollectibles?.(nowMs));
            runFrameStep('store-attendants', () => window.updateStoreAttendants?.(nowMs, shouldUpdateLabels));
            runFrameStep('save-admin-position', saveAdminPosition);
            runFrameStep('render', () => renderer.render(scene, camera));
            window.mallRuntimeMonitor?.enter('idle');
            window.mallRuntimeMonitor?.heartbeat(Date.now());
        }

        // --- SISTEMA DE NPCs (MULTITUD ARTIFICIAL CHILENA) ---
        const NPC_PEOPLE = [
            ["Mateo González", "male"], ["Agustín Muñoz", "male"], ["Benjamín Rojas", "male"],
            ["Vicente Díaz", "male"], ["Santiago Pérez", "male"], ["Matías Soto", "male"],
            ["Joaquín Contreras", "male"], ["Maximiliano Silva", "male"], ["Nicolás Martínez", "male"],
            ["Sebastián Sepúlveda", "male"], ["Sofía Morales", "female"], ["Isabella Rodríguez", "female"],
            ["Emilia López", "female"], ["Martina Fuentes", "female"], ["Lucía Hernández", "female"],
            ["Francisca Olave", "female"], ["Catalina Tapia", "female"], ["Valentina Carrasco", "female"],
            ["Florencia Vera", "female"], ["Isidora Castro", "female"], ["Lucas Herrera", "male"],
            ["Felipe Medina", "male"], ["Diego Castro", "male"], ["Javier Muñoz", "male"],
            ["Gabriel Palma", "male"], ["Paz Romero", "female"], ["Antonella Silva", "female"],
            ["Maite Araya", "female"], ["Josefa Reyes", "female"], ["Ignacia Pizarro", "female"],
            ["Daniela Soto", "female"], ["Carolina Rojas", "female"], ["Andrés Martínez", "male"],
            ["Cristóbal Valenzuela", "male"], ["Camila Bravo", "female"], ["Rodrigo Espinoza", "male"],
            ["Bastián Tapia", "male"], ["Javiera Torres", "female"], ["Renato Vera", "male"],
            ["Micaela Lagos", "female"], ["Tomás Castro", "male"], ["Bárbara Peña", "female"],
            ["Emanuel Vargas", "male"], ["Julieta Miranda", "female"], ["Pascal Cáceres", "female"]
        ].map(([name, body]) => Object.freeze({ name, body }));
        const CHILEAN_NAMES = NPC_PEOPLE.map(person => person.name);

        function getNPCIdentity(index) {
            const person = NPC_PEOPLE[index % NPC_PEOPLE.length];
            const outfits = person.body === "female"
                ? ["casual", "elegant", "sport"]
                : ["casual", "elegant", "work"];
            const skinTones = ["fair", "light", "olive", "latino", "asian", "medium", "deep", "rich"];
            const hairColors = ["brown", "black", "auburn", "blonde"];
            const hairStyles = person.body === "female"
                ? ["bob01", "long01", "ponytail01", "braid01", "afro01"]
                : ["short01", "short02", "short03", "short04", "afro01"];
            const eyeColors = ["brown", "hazel", "green", "blue"];
            const ages = ["young", "adult", "senior"];
            const heights = person.body === "female" ? [160, 165, 170, 175] : [170, 175, 180, 185];
            const variant = Math.floor(index / NPC_PEOPLE.length);
            const seed = index + variant * 13;
            const appearance = {
                body: person.body,
                outfit: outfits[seed % outfits.length],
                skinTone: skinTones[(seed * 3 + 1) % skinTones.length],
                hairColor: hairColors[(seed * 5 + 2) % hairColors.length],
                hairStyle: hairStyles[(seed * 9 + 4) % hairStyles.length],
                eyeColor: eyeColors[(seed * 7 + 1) % eyeColors.length],
                age: ages[(seed * 11 + 2) % ages.length],
                height: heights[(seed * 7 + 3) % heights.length]
            };
            return {
                name: variant ? `${person.name} ${variant + 1}` : person.name,
                gender: person.body,
                style: `av2.${appearance.body}.${appearance.outfit}.${appearance.skinTone}.${appearance.hairColor}.${appearance.height}.${appearance.eyeColor}.${appearance.age}.${appearance.hairStyle}`
            };
        }

        const npcs = [];
        const NPC_COUNT = window.mallPerformanceProfile?.npcCount ?? (IS_COARSE_POINTER ? 30 : 40);
        const NPC_GROUND_FLOOR_Y = 0;
        const NPC_UPPER_FLOOR_Y = 5.4;
        const NPC_UPPER_ATRIUM_EDGE = typeof SECOND_FLOOR_ATRIUM_EDGE === 'number'
            ? SECOND_FLOOR_ATRIUM_EDGE
            : 9;
        const NPC_UPPER_OUTER_EDGE = typeof SECOND_FLOOR_WALKWAY_OUTER_EDGE === 'number'
            ? SECOND_FLOOR_WALKWAY_OUTER_EDGE
            : 17;
        const NPC_UPPER_ANCHOR_ACCESS_START = 82.8;
        const NPC_MIN_WALK_SPEED = 1.00;
        const NPC_MAX_WALK_SPEED = 1.35;
        const NPC_LOOK_AROUND_CHANCE = 0.30;
        const NPC_LOOK_MIN_MS = 1200;
        const NPC_LOOK_MAX_MS = 3200;
        const NPC_STUCK_REPLAN_MS = 3200;
        const NPC_STATIC_BLOCK_CONFIRM_MS = 700;
        const NPC_ROUTE_REBUILD_COOLDOWN_MS = 1200;
        const NPC_DETOUR_TTL_MS = 5200;
        const NPC_DETOUR_RETRY_DELAY_MS = 850;
        const NPC_FAILED_ESCALATOR_COOLDOWN_MS = 7500;
        const NPC_DESTINATION_MEMORY_MS = 45000;
        const NPC_DESTINATION_MEMORY_DISTANCE = 14;
        const NPC_MAX_DESTINATION_MEMORY = 7;
        const NPC_NAV_GRID_STEP = 8;
        const NPC_NAV_EDGE_MAX_DISTANCE = 12.5;
        const NPC_NAV_SAMPLE_STEP = 0.65;
        const NPC_NAV_WAYPOINT_REACHED_DISTANCE = 0.95;
        const NPC_DISCREET_SPAWN_MIN_CAMERA_DISTANCE = 28;
        const NPC_DISCREET_SPAWN_ENDPOINTS = [-104, -92, 92, 104];
        const NPC_SEAT_DISCOVERY_DISTANCE = 2.5;
        const NPC_SEAT_APPROACH_DISTANCE = 0.1;
        const NPC_SEAT_MIN_MS = 5000;
        const NPC_SEAT_MAX_MS = 12000;
        const NPC_SEAT_DECISION_MIN_MS = 3000;
        const NPC_SEAT_DECISION_MAX_MS = 8000;
        const NPC_SEAT_DECISION_CHANCE = 0.24;
        const NPC_SEATED_ROOT_LIFT = 0.36;
        const NPC_POST_STAND_STABILIZE_MS = 1200;

        function setNPCSeatedVisualHeight(npc, seated) {
            if (!npc || npc.avatarKind !== 'gltf') return;
            // Seat posture changes must not wipe the live correction that pins the
            // avatar's feet to the floor during the sitting/standing clip.
            npc.gltfBaseY = -0.02;
            if (npc.gltfRoot) npc.gltfRoot.position.y = npc.gltfBaseY + (npc.seatVisualOffset?.y || 0);
        }
        // Dos accesos laterales por brazo. Cada punto representa el centro del
        // conjunto de puertas y conserva su vector de avance hacia el mall.
        const NPC_LATERAL_ENTRIES = [
            { id: 'sur-oeste', x: -26, z: -87, inwardX: 0, inwardZ: 1 },
            { id: 'sur-este', x: 26, z: -87, inwardX: 0, inwardZ: 1 },
            { id: 'norte-oeste', x: -26, z: 87, inwardX: 0, inwardZ: -1 },
            { id: 'norte-este', x: 26, z: 87, inwardX: 0, inwardZ: -1 },
            { id: 'este-sur', x: -87, z: -26, inwardX: 1, inwardZ: 0 },
            { id: 'este-norte', x: -87, z: 26, inwardX: 1, inwardZ: 0 },
            { id: 'oeste-sur', x: 87, z: -26, inwardX: -1, inwardZ: 0 },
            { id: 'oeste-norte', x: 87, z: 26, inwardX: -1, inwardZ: 0 }
        ];
        const NPC_ENTRY_PORTAL_OFFSETS = [-8.6, 8.6, -7.1, 7.1, -5.6, 5.6];
        const npcNavigationGraphs = { ground: null, upper: null };

        function isNPCOnUpperFloor(y) {
            return y > (NPC_UPPER_FLOOR_Y / 2);
        }

        // Las pendientes de las escalas no son pasillos: solo se recorren durante
        // un viaje asignado. Las plataformas se mantienen libres para poder abordar.
        function getEscalatorSlopeAtPosition(x, z, padding = 0.08) {
            return escalatorList.find((escalator) => {
                if (!isEscalatorMotionEnabled(escalator)) return false;
                const progress = getEscalatorProgressAtPosition(escalator, x, z);
                const slopeStart = escalator.flatLen + 0.18;
                const slopeEnd = escalator.pathLenZ - escalator.flatLen - 0.18;
                if (progress < slopeStart || progress > slopeEnd) return false;
                const ridePos = getEscalatorRidePosition(escalator, progress, 0);
                const lateralOffset = Math.hypot(x - ridePos.x, z - ridePos.z);
                return lateralOffset <= 1.42 + padding;
            }) || null;
        }

        function isInsideEscalatorFootprint(x, z, padding = 0.08) {
            return Boolean(getEscalatorSlopeAtPosition(x, z, padding));
        }

        function isSupportedUpperFloorPosition(x, z) {
            const absX = Math.abs(x);
            const absZ = Math.abs(z);
            const innerEdge = NPC_UPPER_ATRIUM_EDGE - 0.05;
            const outerEdge = NPC_UPPER_OUTER_EDGE + 0.75;
            const onNorthSouthWalkway = absX >= innerEdge && absX <= outerEdge;
            const onEastWestWalkway = absZ >= innerEdge && absZ <= outerEdge;
            const inNorthSouthAnchorAccess = absZ >= NPC_UPPER_ANCHOR_ACCESS_START && absX <= outerEdge;
            const inEastWestAnchorAccess = absX >= NPC_UPPER_ANCHOR_ACCESS_START && absZ <= outerEdge;
            return onNorthSouthWalkway
                || onEastWestWalkway
                || inNorthSouthAnchorAccess
                || inEastWestAnchorAccess;
        }

        function canNPCOccupyPosition(x, meshY, z, options = {}) {
            if (isNPCOnUpperFloor(meshY) && !isSupportedUpperFloorPosition(x, z)) return false;
            const escalatorSlope = getEscalatorSlopeAtPosition(x, z);
            if (escalatorSlope && escalatorSlope.id !== options.allowedEscalatorId) return false;
            return !checkCollision(x, meshY + 1.2, z, {
                ...options,
                bodyMinY: meshY,
                bodyMaxY: meshY + DYNAMIC_ACTOR_COLLISION_HEIGHT
            });
        }

        function releaseNPCSeat(npc, npcIndex) {
            if (npc.seatTarget) window.releaseMallBenchSeat?.(npc.seatTarget, `npc:${npcIndex}`);
            npc.seatTarget = null;
        }

        const NPC_POSITION_TRACE_LIMIT = 900;
        const npcPositionTraceEnabled = new URLSearchParams(window.location.search).get('seatTrace') === '1';
        window.mallNpcPositionTrace = [];

        function traceNPCPosition(npc, npcIndex, source, before, now) {
            if (!npcPositionTraceEnabled || !npc?.mesh || !before) return;
            const after = npc.mesh.position;
            const distance = Math.hypot(after.x - before.x, after.z - before.z);
            if (distance < 0.04 && source !== 'stand-root-commit' && source !== 'safety-rollback') return;
            const trace = window.mallNpcPositionTrace;
            trace.push({
                at: now,
                npcIndex,
                source,
                state: npc.state,
                motion: npc.motionMode,
                distance: Number(distance.toFixed(4)),
                before: { x: Number(before.x.toFixed(3)), z: Number(before.z.toFixed(3)) },
                after: { x: Number(after.x.toFixed(3)), z: Number(after.z.toFixed(3)) },
                target: { x: Number(npc.target?.x?.toFixed(3) || 0), z: Number(npc.target?.z?.toFixed(3) || 0) },
                lastSafe: { x: Number(npc.lastSafePosition?.x?.toFixed(3) || 0), z: Number(npc.lastSafePosition?.z?.toFixed(3) || 0) },
                bench: npc.seatTarget?.benchId || npc.departingSeatColliderId || null,
                visualOffset: { x: Number(npc.seatVisualOffset?.x?.toFixed(3) || 0), z: Number(npc.seatVisualOffset?.z?.toFixed(3) || 0) }
            });
            if (trace.length > NPC_POSITION_TRACE_LIMIT) trace.splice(0, trace.length - NPC_POSITION_TRACE_LIMIT);
        }

        function beginNPCSeatApproach(npc, npcIndex, now) {
            if (typeof window.findMallBenchSeat !== 'function') return false;
            if (Math.abs(npc.target.y - npc.mesh.position.y) > 1) return false;
            if (now < (npc.nextSeatDecisionAt || 0)) return false;
            npc.nextSeatDecisionAt = now + NPC_SEAT_DECISION_MIN_MS
                + Math.random() * (NPC_SEAT_DECISION_MAX_MS - NPC_SEAT_DECISION_MIN_MS);
            const seat = window.findMallBenchSeat(npc.mesh.position, NPC_SEAT_DISCOVERY_DISTANCE, {
                floorY: npc.mesh.position.y,
                owner: `npc:${npcIndex}`
            });
            if (!seat || Math.random() > NPC_SEAT_DECISION_CHANCE) return false;
            if (!window.reserveMallBenchSeat?.(seat, `npc:${npcIndex}`, NPC_SEAT_MAX_MS + 14000)) return false;

            npc.seatTarget = seat;
            npc.state = 'approaching-seat';
            npc.motionMode = 'walk';
            npc.intermediateTarget = null;
            npc.intermediateEscalatorId = null;
            npc.avoidanceTarget = null;
            clearNPCNavigationRoute(npc);
            return true;
        }

        function updateNPCSeatState(npc, npcIndex, now, motionNowMs, moveStep) {
            if (npc.state === 'post-stand') {
                npc.motionMode = 'idle';
                if (npc.seatStandAnchor) {
                    npc.mesh.position.x = npc.seatStandAnchor.x;
                    npc.mesh.position.z = npc.seatStandAnchor.z;
                }
                if (now < (npc.postStandUntil || 0)) return true;

                const departingColliderId = npc.seatTarget?.benchId || '';
                releaseNPCSeat(npc, npcIndex);
                npc.state = 'walking';
                npc.seatStandAnchor = null;
                npc.postStandUntil = 0;
                npc.departingSeatColliderId = departingColliderId;
                npc.departingSeatColliderUntil = now + 2400;
                npc.nextSeatDecisionAt = now + NPC_SEAT_DECISION_MIN_MS;
                const next = findNovelNPCPosition(npc, npc.mesh.position, isNPCOnUpperFloor(npc.mesh.position.y) ? 5.4 : 0, `npc:${npcIndex}`);
                if (next) {
                    npc.target.set(next.x, getAvatarGroundY(next.y), next.z);
                    rememberNPCDestination(npc, npc.target, now);
                } else {
                    npc.state = 'looking';
                    npc.timer = now + 1200;
                }
                return true;
            }

            if (npc.state === 'standing-up') {
                npc.motionMode = 'idle';
                if (npc.seatStandAnchor) {
                    npc.mesh.position.x = npc.seatStandAnchor.x;
                    npc.mesh.position.z = npc.seatStandAnchor.z;
                }
                if (!npc.seatStandStarted || !npc.standUntil || motionNowMs < npc.standUntil) {
                    npc.seatStandStarted = true;
                    return true;
                }

                // The visual root owns the foot correction. Never bake it into the
                // navigation group here: a malformed or accumulated animation root
                // offset would otherwise relocate the NPC several metres at once.
                // Keep the physics origin at the original seat anchor until actual
                // walking begins.
                traceNPCPosition(npc, npcIndex, 'stand-root-lock', npc.mesh.position.clone(), now);
                npc.seatStandAnchor = npc.mesh.position.clone();
                npc.state = 'post-stand';
                npc.motionMode = 'idle';
                npc.seatStandStarted = false;
                npc.postStandUntil = now + NPC_POST_STAND_STABILIZE_MS;
                return true;
            }

            if (npc.state === 'seated') {
                npc.motionMode = 'sit';
                if (now <= npc.timer) return true;

                npc.state = 'standing-up';
                npc.motionMode = 'idle';
                npc.seatStandAnchor = npc.mesh.position.clone();
                npc.seatStandStarted = false;
                setNPCSeatedVisualHeight(npc, false);
                return true;
            }

            if (npc.state !== 'approaching-seat' || !npc.seatTarget) {
                return beginNPCSeatApproach(npc, npcIndex, now);
            }

            const seat = npc.seatTarget;
            const deltaX = seat.position.x - npc.mesh.position.x;
            const deltaZ = seat.position.z - npc.mesh.position.z;
            const distance = Math.hypot(deltaX, deltaZ);
            if (distance <= NPC_SEAT_APPROACH_DISTANCE) {
                npc.mesh.position.x = seat.position.x;
                npc.mesh.position.z = seat.position.z;
                npc.mesh.rotation.y = seat.yaw;
                npc.state = 'seated';
                npc.motionMode = 'sit';
                setNPCSeatedVisualHeight(npc, true);
                npc.timer = now + NPC_SEAT_MIN_MS + Math.random() * (NPC_SEAT_MAX_MS - NPC_SEAT_MIN_MS);
                return true;
            }

            const direction = new THREE.Vector3(deltaX, 0, deltaZ).normalize();
            const step = Math.min(moveStep, distance);
            const nextX = npc.mesh.position.x + direction.x * step;
            const nextZ = npc.mesh.position.z + direction.z * step;
            if (!canNPCOccupyPosition(nextX, npc.mesh.position.y, nextZ, {
                ignoreActorId: `npc:${npcIndex}`,
                includeActors: false,
                collisionRadius: DYNAMIC_ACTOR_COLLISION_RADIUS * 0.78,
                ignoredColliderOwnerIds: [seat.benchId]
            })) {
                releaseNPCSeat(npc, npcIndex);
                npc.state = 'walking';
                npc.motionMode = 'idle';
                npc.nextSeatDecisionAt = now + NPC_SEAT_DECISION_MIN_MS;
                return false;
            }

            npc.mesh.position.x = nextX;
            npc.mesh.position.z = nextZ;
            const targetYaw = Math.atan2(direction.x, direction.z);
            const yawDelta = Math.atan2(
                Math.sin(targetYaw - npc.mesh.rotation.y),
                Math.cos(targetYaw - npc.mesh.rotation.y)
            );
            npc.mesh.rotation.y += yawDelta * 0.22;
            npc.motionMode = 'walk';
            return true;
        }

        function isNPCNavigationSegmentWalkable(from, to, meshY) {
            const distance = Math.hypot(to.x - from.x, to.z - from.z);
            const sampleCount = Math.max(1, Math.ceil(distance / NPC_NAV_SAMPLE_STEP));
            for (let sample = 0; sample <= sampleCount; sample++) {
                const t = sample / sampleCount;
                const x = from.x + (to.x - from.x) * t;
                const z = from.z + (to.z - from.z) * t;
                if (isInsideEscalatorFootprint(x, z)) return false;
                if (!canNPCOccupyPosition(x, meshY, z, {
                    includeActors: false,
                    collisionRadius: DYNAMIC_ACTOR_COLLISION_RADIUS * 0.78
                })) return false;
            }
            return true;
        }

        function isNPCNavigationEdgeWalkable(from, to, meshY) {
            for (const t of [0.25, 0.5, 0.75]) {
                const x = from.x + (to.x - from.x) * t;
                const z = from.z + (to.z - from.z) * t;
                if (isInsideEscalatorFootprint(x, z)) return false;
                if (!canNPCOccupyPosition(x, meshY, z, {
                    includeActors: false,
                    collisionRadius: DYNAMIC_ACTOR_COLLISION_RADIUS * 0.78
                })) return false;
            }
            return true;
        }

        function buildNPCNavigationGraph(meshY) {
            const candidates = [];
            const seen = new Set();
            const addCandidate = (x, z) => {
                const key = `${x.toFixed(2)}:${z.toFixed(2)}`;
                if (seen.has(key)) return;
                seen.add(key);
                if (!canNPCOccupyPosition(x, meshY, z, {
                    includeActors: false,
                    collisionRadius: DYNAMIC_ACTOR_COLLISION_RADIUS * 0.78
                })) return;
                candidates.push({ id: candidates.length, x, z, neighbors: [] });
            };
            const axisPoints = [];
            for (let value = -112; value <= 112; value += NPC_NAV_GRID_STEP) axisPoints.push(value);
            if (axisPoints[axisPoints.length - 1] !== 112) axisPoints.push(112);

            if (isNPCOnUpperFloor(meshY)) {
                const laneOffsets = [-15, -13, -11, 11, 13, 15];
                laneOffsets.forEach(x => axisPoints.forEach(z => addCandidate(x, z)));
                laneOffsets.forEach(z => axisPoints.forEach(x => addCandidate(x, z)));
            } else {
                const laneOffsets = [-7, -4, 0, 4, 7];
                laneOffsets.forEach(x => axisPoints.forEach(z => addCandidate(x, z)));
                laneOffsets.forEach(z => axisPoints.forEach(x => addCandidate(x, z)));

                // El anillo evita que una ruta intente atravesar la pileta central.
                // Mantiene el cuerpo fuera de la pileta sin crear una franja de evitación invisible.
                const ringRadius = 8.8;
                for (let point = 0; point < 24; point++) {
                    const angle = (point / 24) * Math.PI * 2;
                    addCandidate(Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius);
                }
            }

            for (let a = 0; a < candidates.length; a++) {
                for (let b = a + 1; b < candidates.length; b++) {
                    const nodeA = candidates[a];
                    const nodeB = candidates[b];
                    const distance = Math.hypot(nodeB.x - nodeA.x, nodeB.z - nodeA.z);
                    if (distance > NPC_NAV_EDGE_MAX_DISTANCE) continue;
                    if (!isNPCNavigationEdgeWalkable(nodeA, nodeB, meshY)) continue;
                    nodeA.neighbors.push({ id: nodeB.id, cost: distance });
                    nodeB.neighbors.push({ id: nodeA.id, cost: distance });
                }
            }
            return { meshY, nodes: candidates };
        }

        function countNPCNavigationComponents(graph) {
            const visited = new Set();
            let components = 0;
            for (const node of graph.nodes) {
                if (visited.has(node.id)) continue;
                components++;
                const pending = [node.id];
                visited.add(node.id);
                while (pending.length > 0) {
                    const current = graph.nodes[pending.pop()];
                    current.neighbors.forEach(edge => {
                        if (visited.has(edge.id)) return;
                        visited.add(edge.id);
                        pending.push(edge.id);
                    });
                }
            }
            return components;
        }

        function initializeNPCNavigationGraphs() {
            const startedAt = performance.now();
            npcNavigationGraphs.ground = buildNPCNavigationGraph(getAvatarGroundY(NPC_GROUND_FLOOR_Y));
            npcNavigationGraphs.upper = buildNPCNavigationGraph(getAvatarGroundY(NPC_UPPER_FLOOR_Y));
            const groundComponents = countNPCNavigationComponents(npcNavigationGraphs.ground);
            const upperComponents = countNPCNavigationComponents(npcNavigationGraphs.upper);
            console.info(
                `[NPC NAV] Red lista: ${npcNavigationGraphs.ground.nodes.length} nodos PB, `
                + `${npcNavigationGraphs.upper.nodes.length} nodos P2, `
                + `${groundComponents}/${upperComponents} componentes, `
                + `${Math.round(performance.now() - startedAt)} ms.`
            );
        }

        function getNPCNavigationGraph(meshY) {
            return isNPCOnUpperFloor(meshY) ? npcNavigationGraphs.upper : npcNavigationGraphs.ground;
        }

        function findNearestVisibleNPCNavigationNode(graph, point) {
            if (!graph) return null;
            const orderedNodes = graph.nodes
                .map(node => ({ node, distance: Math.hypot(node.x - point.x, node.z - point.z) }))
                .sort((a, b) => a.distance - b.distance);
            for (const candidate of orderedNodes) {
                if (isNPCNavigationSegmentWalkable(point, candidate.node, graph.meshY)) {
                    return candidate.node;
                }
            }
            return null;
        }

        function buildNPCNavigationRoute(start, goal, meshY) {
            const graph = getNPCNavigationGraph(meshY);
            if (!graph || graph.nodes.length === 0) return [goal.clone()];
            const directDistance = Math.hypot(goal.x - start.x, goal.z - start.z);
            if (
                directDistance <= NPC_NAV_EDGE_MAX_DISTANCE
                && isNPCNavigationSegmentWalkable(start, goal, graph.meshY)
            ) return [goal.clone()];

            const startNode = findNearestVisibleNPCNavigationNode(graph, start);
            const goalNode = findNearestVisibleNPCNavigationNode(graph, goal);
            if (!startNode || !goalNode) return [goal.clone()];

            const open = new Set([startNode.id]);
            const cameFrom = new Map();
            const gScore = new Map([[startNode.id, 0]]);
            const fScore = new Map([[
                startNode.id,
                Math.hypot(goalNode.x - startNode.x, goalNode.z - startNode.z)
            ]]);

            while (open.size > 0) {
                let currentId = null;
                let currentScore = Infinity;
                open.forEach(id => {
                    const score = fScore.get(id) ?? Infinity;
                    if (score < currentScore) {
                        currentId = id;
                        currentScore = score;
                    }
                });
                if (currentId === goalNode.id) {
                    const routeIds = [currentId];
                    while (cameFrom.has(currentId)) {
                        currentId = cameFrom.get(currentId);
                        routeIds.push(currentId);
                    }
                    routeIds.reverse();
                    const route = routeIds
                        .map(id => new THREE.Vector3(graph.nodes[id].x, meshY, graph.nodes[id].z));
                    route.push(goal.clone());
                    return route;
                }

                open.delete(currentId);
                const current = graph.nodes[currentId];
                for (const edge of current.neighbors) {
                    const tentativeScore = (gScore.get(currentId) ?? Infinity) + edge.cost;
                    if (tentativeScore >= (gScore.get(edge.id) ?? Infinity)) continue;
                    const neighbor = graph.nodes[edge.id];
                    cameFrom.set(edge.id, currentId);
                    gScore.set(edge.id, tentativeScore);
                    fScore.set(
                        edge.id,
                        tentativeScore + Math.hypot(goalNode.x - neighbor.x, goalNode.z - neighbor.z)
                    );
                    open.add(edge.id);
                }
            }

            return [goal.clone()];
        }

        function clearNPCNavigationRoute(npc) {
            npc.navigationRoute = [];
            npc.navigationGoal = null;
        }

        function getNPCNavigationWaypoint(npc, goal, forceRebuild = false) {
            const goalChanged = !npc.navigationGoal || npc.navigationGoal.distanceToSquared(goal) > 0.25;
            if (forceRebuild || goalChanged || !Array.isArray(npc.navigationRoute) || npc.navigationRoute.length === 0) {
                npc.navigationGoal = goal.clone();
                npc.navigationRoute = buildNPCNavigationRoute(npc.mesh.position, goal, npc.mesh.position.y);
            }
            while (
                npc.navigationRoute.length > 1
                && npc.mesh.position.distanceTo(npc.navigationRoute[0]) < NPC_NAV_WAYPOINT_REACHED_DISTANCE
            ) {
                npc.navigationRoute.shift();
            }
            return npc.navigationRoute[0] || goal;
        }

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

        // Los NPC aparecen en extremos de los brazos, fuera del foco del atrio y
        // de los accesos a escalas. Así un visitante nunca los ve "nacer".
        function getDiscreetNPCSpawnCandidate(y) {
            const isUpper = y >= 3;
            const laneOffsets = isUpper ? [-15, -13, 13, 15] : [-7, -4, 4, 7];
            const endpoint = NPC_DISCREET_SPAWN_ENDPOINTS[
                Math.floor(Math.random() * NPC_DISCREET_SPAWN_ENDPOINTS.length)
            ] + (Math.random() - 0.5) * 5;
            const lane = laneOffsets[Math.floor(Math.random() * laneOffsets.length)];
            return Math.random() < 0.5
                ? { x: lane, z: endpoint, y: isUpper ? NPC_UPPER_FLOOR_Y : NPC_GROUND_FLOOR_Y }
                : { x: endpoint, z: lane, y: isUpper ? NPC_UPPER_FLOOR_Y : NPC_GROUND_FLOOR_Y };
        }

        function findDiscreetNPCSpawnPosition(y, ignoreActorId = null, attempts = 42) {
            let fallback = null;
            const hasCamera = typeof camera !== 'undefined' && camera?.position;
            for (let attempt = 0; attempt < attempts; attempt++) {
                const candidate = getDiscreetNPCSpawnCandidate(y);
                const candidateY = getAvatarGroundY(candidate.y);
                if (!canNPCOccupyPosition(candidate.x, candidateY, candidate.z, {
                    ignoreActorId,
                    collisionRadius: DYNAMIC_ACTOR_COLLISION_RADIUS * 0.8
                })) continue;
                if (!fallback) fallback = candidate;
                if (!hasCamera || Math.hypot(
                    candidate.x - camera.position.x,
                    candidate.z - camera.position.z
                ) >= NPC_DISCREET_SPAWN_MIN_CAMERA_DISTANCE) {
                    return candidate;
                }
            }
            return fallback || findWalkableNPCPosition(y, ignoreActorId, attempts);
        }

        function findLateralNPCEntrySpawnPosition(npcIndex, ignoreActorId = null) {
            const entry = NPC_LATERAL_ENTRIES[npcIndex % NPC_LATERAL_ENTRIES.length];
            const row = Math.floor(npcIndex / NPC_LATERAL_ENTRIES.length);
            const tangentX = -entry.inwardZ;
            const tangentZ = entry.inwardX;
            let fallback = null;

            for (let attempt = 0; attempt < NPC_ENTRY_PORTAL_OFFSETS.length * 3; attempt++) {
                const offsetIndex = (row + attempt) % NPC_ENTRY_PORTAL_OFFSETS.length;
                const tangentOffset = NPC_ENTRY_PORTAL_OFFSETS[offsetIndex];
                const outwardDistance = 0.8 + ((row + Math.floor(attempt / NPC_ENTRY_PORTAL_OFFSETS.length)) % 3) * 1.25;
                const candidate = {
                    x: entry.x + tangentX * tangentOffset - entry.inwardX * outwardDistance,
                    z: entry.z + tangentZ * tangentOffset - entry.inwardZ * outwardDistance,
                    y: NPC_GROUND_FLOOR_Y
                };
                const candidateY = getAvatarGroundY(candidate.y);
                if (!canNPCOccupyPosition(candidate.x, candidateY, candidate.z, {
                    ignoreActorId,
                    collisionRadius: DYNAMIC_ACTOR_COLLISION_RADIUS * 0.82
                })) continue;
                fallback = candidate;
                break;
            }

            const position = fallback || findDiscreetNPCSpawnPosition(NPC_GROUND_FLOOR_Y, ignoreActorId);
            if (!position) return null;
            const inwardTarget = {
                x: position.x + entry.inwardX * 15,
                z: position.z + entry.inwardZ * 15,
                y: NPC_GROUND_FLOOR_Y
            };
            return { position, inwardTarget, entry };
        }

        function findWalkableNPCPosition(y, ignoreActorId = null, attempts = 48) {
            for (let attempt = 0; attempt < attempts; attempt++) {
                const candidate = getValidNPCPosition(y);
                const candidateY = getAvatarGroundY(candidate.y);
                if (canNPCOccupyPosition(candidate.x, candidateY, candidate.z, {
                    ignoreActorId,
                    collisionRadius: DYNAMIC_ACTOR_COLLISION_RADIUS * 0.8
                })) {
                    return candidate;
                }
            }

            const fallbackPositions = y < 3
                ? [[0, 12], [12, 0], [0, -12], [-12, 0]]
                : [[13, 0], [-13, 0], [0, 13], [0, -13]];
            const floorY = y < 3 ? NPC_GROUND_FLOOR_Y : NPC_UPPER_FLOOR_Y;
            const meshY = getAvatarGroundY(floorY);
            const fallback = fallbackPositions.find(([x, z]) => canNPCOccupyPosition(x, meshY, z, {
                ignoreActorId,
                collisionRadius: DYNAMIC_ACTOR_COLLISION_RADIUS * 0.8
            }));
            if (!fallback) return null;
            const [x, z] = fallback;
            return { x, z, y: floorY };
        }

        function findDistantNPCPosition(origin, y, ignoreActorId = null, minDistance = 7) {
            let fallback = null;
            for (let attempt = 0; attempt < 10; attempt++) {
                const candidate = findWalkableNPCPosition(y, ignoreActorId, 10);
                if (!candidate) continue;
                fallback = candidate;
                const dx = candidate.x - origin.x;
                const dz = candidate.z - origin.z;
                if ((dx * dx) + (dz * dz) >= minDistance * minDistance) return candidate;
            }
            return fallback || findWalkableNPCPosition(y, ignoreActorId);
        }

        function rememberNPCDestination(npc, destination, now, failed = false) {
            if (!npc || !destination) return;
            const history = Array.isArray(npc.destinationMemory) ? npc.destinationMemory : [];
            const floor = isNPCOnUpperFloor(destination.y) ? 'upper' : 'ground';
            const duplicate = history.find(entry => (
                entry.floor === floor
                && Math.hypot(entry.x - destination.x, entry.z - destination.z) < 3
            ));
            if (duplicate) {
                duplicate.at = now;
                duplicate.failed = duplicate.failed || failed;
            } else {
                history.push({ x: destination.x, z: destination.z, floor, at: now, failed });
            }
            npc.destinationMemory = history
                .filter(entry => now - entry.at < NPC_DESTINATION_MEMORY_MS)
                .slice(-NPC_MAX_DESTINATION_MEMORY);
        }

        function isRememberedNPCDestination(npc, destination, now) {
            if (!Array.isArray(npc?.destinationMemory)) return false;
            const floor = isNPCOnUpperFloor(destination.y) ? 'upper' : 'ground';
            return npc.destinationMemory.some(entry => (
                entry.floor === floor
                && now - entry.at < NPC_DESTINATION_MEMORY_MS
                && Math.hypot(entry.x - destination.x, entry.z - destination.z) < NPC_DESTINATION_MEMORY_DISTANCE
            ));
        }

        function getNPCHeadingCompatibility(npc, origin, destination) {
            if (!npc?.lastMoveDirection || npc.lastMoveDirection.lengthSq() < 0.01) return 1;
            const candidateDirection = destination.clone().sub(origin).setY(0);
            if (candidateDirection.lengthSq() < 0.01) return 1;
            candidateDirection.normalize();
            return candidateDirection.dot(npc.lastMoveDirection);
        }

        function findNovelNPCPosition(npc, origin, y, ignoreActorId = null) {
            let fallback = null;
            let directionFallback = null;
            for (let attempt = 0; attempt < 28; attempt++) {
                const candidate = findDistantNPCPosition(origin, y, ignoreActorId, 9);
                if (!candidate) continue;
                const target = new THREE.Vector3(candidate.x, getAvatarGroundY(candidate.y), candidate.z);
                const wasRecentlyVisited = isRememberedNPCDestination(npc, target, Date.now());
                const headingCompatibility = getNPCHeadingCompatibility(npc, origin, target);
                if (!fallback && !wasRecentlyVisited) fallback = candidate;
                if (!directionFallback && headingCompatibility > -0.25) directionFallback = candidate;
                // Evita repetir trayectos inmediatos y los retornos bruscos de 180 grados.
                if (!wasRecentlyVisited && headingCompatibility > -0.25) return candidate;
            }
            return fallback || directionFallback || findDistantNPCPosition(origin, y, ignoreActorId, 7);
        }

        function recordNPCMovementDirection(npc, direction) {
            if (!npc?.lastMoveDirection || !direction || direction.lengthSq() < 0.0001) return;
            npc.lastMoveDirection.copy(direction).setY(0).normalize();
        }

        function findNPCDetour(npc, npcIndex, desiredDirection, now, moveStep = npc.speed / 60) {
            if (!desiredDirection || desiredDirection.lengthSq() < 0.0001) return null;

            const direction = desiredDirection.clone().setY(0).normalize();
            const preferredTurn = npc.preferredTurn || (Math.random() < 0.5 ? -1 : 1);
            const angleCandidates = [
                preferredTurn * Math.PI / 6,
                -preferredTurn * Math.PI / 6,
                preferredTurn * Math.PI / 4,
                -preferredTurn * Math.PI / 4,
                preferredTurn * Math.PI / 2,
                -preferredTurn * Math.PI / 2
            ];
            const immediateStep = Math.max(0.04, moveStep * 1.4);
            const detourDistance = 1.9 + Math.random() * 0.8;

            for (const angle of angleCandidates) {
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const candidateDir = new THREE.Vector3(
                    direction.x * cos - direction.z * sin,
                    0,
                    direction.x * sin + direction.z * cos
                ).normalize();
                const nextX = npc.mesh.position.x + candidateDir.x * immediateStep;
                const nextZ = npc.mesh.position.z + candidateDir.z * immediateStep;
                const detourX = npc.mesh.position.x + candidateDir.x * detourDistance;
                const detourZ = npc.mesh.position.z + candidateDir.z * detourDistance;

                const canTakeFirstStep = canNPCOccupyPosition(nextX, npc.mesh.position.y, nextZ, {
                    ignoreActorId: `npc:${npcIndex}`,
                    collisionRadius: DYNAMIC_ACTOR_COLLISION_RADIUS * 0.82
                });
                const hasWalkableDetour = canNPCOccupyPosition(detourX, npc.mesh.position.y, detourZ, {
                    ignoreActorId: `npc:${npcIndex}`,
                    includeActors: false,
                    collisionRadius: DYNAMIC_ACTOR_COLLISION_RADIUS * 0.82
                });
                if (!canTakeFirstStep || !hasWalkableDetour) continue;

                npc.avoidanceTarget = new THREE.Vector3(detourX, npc.mesh.position.y, detourZ);
                npc.avoidanceUntil = now + NPC_DETOUR_TTL_MS;
                npc.lastDetourAt = now;
                npc.preferredTurn = -preferredTurn;
                return candidateDir;
            }

            return null;
        }

        function replanNPCNavigation(npc, npcIndex, now) {
            const needsFloorChange = Math.abs(npc.target.y - npc.mesh.position.y) > 1;
            rememberNPCDestination(npc, npc.target, now, true);
            if (npc.intermediateEscalatorId !== null && npc.intermediateEscalatorId !== undefined) {
                npc.blockedEscalatorId = npc.intermediateEscalatorId;
                npc.blockedEscalatorUntil = now + NPC_FAILED_ESCALATOR_COOLDOWN_MS;
            }

            npc.intermediateTarget = null;
            npc.intermediateEscalatorId = null;
            npc.avoidanceTarget = null;
            clearNPCNavigationRoute(npc);
            npc.avoidanceUntil = 0;
            npc.lastDetourAt = 0;
            npc.blockedSince = 0;
            npc.lastProgressAt = now;
            npc.lastSuccessfulMoveAt = now;
            npc.lastProgressPosition.copy(npc.mesh.position);
            npc.lastRouteRebuildAt = now;
            npc.state = 'walking';

            if (!needsFloorChange) {
                const floorY = isNPCOnUpperFloor(npc.mesh.position.y) ? NPC_UPPER_FLOOR_Y : NPC_GROUND_FLOOR_Y;
                const next = findNovelNPCPosition(npc, npc.mesh.position, floorY, `npc:${npcIndex}`);
                if (next) {
                    npc.target.set(next.x, getAvatarGroundY(next.y), next.z);
                    rememberNPCDestination(npc, npc.target, now);
                } else {
                    npc.state = 'looking';
                    npc.timer = now + 1200;
                }
            }
        }

        function initNPCs() {
            for (let i = 0; i < NPC_COUNT; i++) {
                const identity = getNPCIdentity(i);
                const { name, style } = identity;
                // Comparten rig y acciones Mixamo con los visitantes, sin entrar
                // al canal de presencia multijugador.
                const npcAvatar = createGameReadyAvatar(name, style);

                const startFloor = NPC_GROUND_FLOOR_Y;
                const entrySpawn = findLateralNPCEntrySpawnPosition(i, `npc:${i}`);
                if (!entrySpawn) {
                    npcAvatar.mesh.visible = false;
                    if (npcAvatar.label) npcAvatar.label.style.display = 'none';
                    continue;
                }
                const pos = entrySpawn.position;
                const initialPosition = new THREE.Vector3(pos.x, getAvatarGroundY(pos.y), pos.z);
                const initialTarget = entrySpawn.inwardTarget;
                npcAvatar.mesh.position.copy(initialPosition);
                npcAvatar.mesh.rotation.y = Math.atan2(entrySpawn.entry.inwardX, entrySpawn.entry.inwardZ);
                
                Object.assign(npcAvatar, {
                    target: new THREE.Vector3(initialTarget.x, getAvatarGroundY(initialTarget.y), initialTarget.z),
                    intermediateTarget: null,
                    intermediateEscalatorId: null,
                    // Conserva la escala abordada y su avance. Sin este estado el
                    // detector por proximidad podia capturar el descanso opuesto.
                    escalatorRide: null,
                    escalatorExitUntil: 0,
                    seatTarget: null,
                    nextSeatDecisionAt: Date.now() + NPC_SEAT_DECISION_MIN_MS + Math.random() * NPC_SEAT_DECISION_MAX_MS,
                    navigationRoute: [],
                    navigationGoal: null,
                    avoidanceTarget: null,
                    avoidanceUntil: 0,
                    lastDetourAt: 0,
                    state: 'walking',
                    timer: 0,
                    speed: NPC_MIN_WALK_SPEED + Math.random() * (NPC_MAX_WALK_SPEED - NPC_MIN_WALK_SPEED),
                    name: name,
                    gender: identity.gender,
                    lastSafePosition: initialPosition.clone(),
                    lastProgressPosition: initialPosition.clone(),
                    lastProgressAt: Date.now(),
                    lastSuccessfulMoveAt: Date.now(),
                    lastMotionUpdateAt: performance.now(),
                    blockedSince: 0,
                    blockedEscalatorId: null,
                    blockedEscalatorUntil: 0,
                    preferredTurn: Math.random() < 0.5 ? -1 : 1,
                    destinationMemory: [{
                        x: initialTarget.x,
                        z: initialTarget.z,
                        floor: startFloor > 3 ? 'upper' : 'ground',
                        at: Date.now(),
                        failed: false
                    }],
                    lastMoveDirection: new THREE.Vector3(),
                    lastRouteRebuildAt: 0,
                    entryId: entrySpawn.entry.id
                });
                npcs.push(npcAvatar);
            }
        }

        window.isMallSeatStandGpsReady = function() {
            const readyAvatar = npcs.some((npc) => npc?.gltfRoot && npc?.actions?.sit && npc?.actions?.stand);
            if (!readyAvatar || typeof window.findMallBenchSeat !== 'function') return false;
            const floors = [NPC_GROUND_FLOOR_Y, NPC_UPPER_FLOOR_Y];
            return floors.some((floorY) => window.findMallBenchSeat(camera.position, Infinity, {
                floorY,
                requireAvailable: false
            }));
        };

        window.getMallSeatStandGpsReadiness = function() {
            return npcs.map((npc, index) => ({
                index,
                avatarKind: npc.avatarKind,
                ready: Boolean(npc.ready),
                hasRoot: Boolean(npc.gltfRoot),
                actions: Object.keys(npc.actions || {}),
                loading: Boolean(npc.mesh?.userData?.avatarLoading)
            }));
        };

        window.runMallSeatStandGpsSimulation = function() {
            const npcIndex = npcs.findIndex((npc) => npc?.gltfRoot && npc?.actions?.sit && npc?.actions?.stand);
            if (npcIndex < 0) return Promise.reject(new Error('Todavía no hay un avatar NPC listo para la simulación.'));
            const npc = npcs[npcIndex];
            const owner = `npc:${npcIndex}`;
            // The diagnostic runs in an isolated local test session. Release NPC
            // reservations first so it can always claim one physical bench seat.
            npcs.forEach((occupant, index) => {
                if (occupant?.seatTarget) releaseNPCSeat(occupant, index);
            });
            const floorOptions = camera.position.y > 3
                ? [NPC_UPPER_FLOOR_Y, NPC_GROUND_FLOOR_Y]
                : [NPC_GROUND_FLOOR_Y, NPC_UPPER_FLOOR_Y];
            let seat = null;
            let floorY = floorOptions[0];
            for (const candidateFloor of floorOptions) {
                seat = window.findMallBenchSeat?.(camera.position, Infinity, {
                    floorY: candidateFloor,
                    owner,
                    requireAvailable: true
                });
                if (seat) {
                    floorY = candidateFloor;
                    break;
                }
            }
            if (!seat) return Promise.reject(new Error('No hay una banca libre para la simulación GPS.'));

            if (!window.reserveMallBenchSeat?.(seat, owner, 30000)) {
                return Promise.reject(new Error('No se pudo reservar la banca de prueba.'));
            }

            npc.mesh.position.set(seat.position.x, getAvatarGroundY(floorY), seat.position.z);
            npc.mesh.rotation.y = seat.yaw;
            npc.seatTarget = seat;
            npc.state = 'seated';
            npc.motionMode = 'sit';
            npc.intermediateTarget = null;
            npc.intermediateEscalatorId = null;
            npc.avoidanceTarget = null;
            clearNPCNavigationRoute(npc);
            setNPCSeatedVisualHeight(npc, true);
            const sitDurationMs = Math.max(800, (npc.actions.sit.getClip().duration || 1) * 1000);
            npc.timer = Date.now() + sitDurationMs + 350;

            return new Promise((resolve, reject) => {
                const gps = {
                    active: true,
                    startedAt: performance.now(),
                    seatId: seat.id,
                    reference: null,
                    sawStand: false,
                    frames: [],
                    maxDrift: {},
                    maxVerticalDrift: {},
                    maxRotationDrift: {},
                    maxAnchorError: {},
                    maxFrameStep: {},
                    resolve
                };
                npc.shoeGps = gps;
                window.mallActiveShoeGpsActor = npc;
                setTimeout(() => {
                    if (!gps.active) return;
                    gps.active = false;
                    reject(new Error(`La simulación GPS excedió el tiempo límite después de ${gps.frames.length} fotogramas.`));
                }, sitDurationMs + 12000);

                const entryOverlay = document.getElementById('login-overlay');
                if (entryOverlay && window.getComputedStyle(entryOverlay).display !== 'none') {
                    // On the local GPS diagnostic route the mall render loop is
                    // paused until visitor entry. Drive this one NPC through the
                    // exact pose/state functions without creating a remote session.
                    const stepMs = 1000 / 60;
                    gps.simulationStartMs = performance.now();
                    gps.simulationWallStart = Date.now();
                    gps.simulationFrame = 0;
                    while (gps.active && gps.simulationFrame < 1800) {
                        const nowMs = gps.simulationStartMs + gps.simulationFrame * stepMs;
                        const wallNow = gps.simulationWallStart + gps.simulationFrame * stepMs;
                        gps.simulationFrame += 1;
                        updateNPCSeatState(npc, npcIndex, wallNow, nowMs, 0);
                        window.applyAvatarPose?.(npc, 0, nowMs);
                    }
                    if (gps.active) {
                        gps.active = false;
                        reject(new Error(`La simulación GPS superó 1800 cuadros (${gps.frames.length} medidos).`));
                    }
                }
            });
        };

        window.getMallSeatStandGpsTrace = function() {
            return window.mallLastShoeGpsTrace || null;
        };

        if (new URLSearchParams(window.location.search).get('seatGps') === '1') {
            const gpsStatus = document.createElement('pre');
            gpsStatus.id = 'mall-seat-gps-status';
            gpsStatus.style.cssText = 'position:fixed;left:12px;top:12px;z-index:100000;max-width:520px;padding:10px;background:#111;color:#f1d48f;font:12px monospace;white-space:pre-wrap;pointer-events:none';
            gpsStatus.textContent = 'GPS zapatos: esperando avatar animado...';
            document.body.appendChild(gpsStatus);
            const startedWaitingAt = Date.now();
            const readinessTimer = setInterval(() => {
                if (Date.now() - startedWaitingAt > 120000) {
                    clearInterval(readinessTimer);
                    gpsStatus.textContent = 'GPS zapatos: tiempo de espera agotado.';
                    return;
                }
                if (!window.isMallSeatStandGpsReady()) return;
                clearInterval(readinessTimer);
                gpsStatus.textContent = 'GPS zapatos: simulando sentarse y levantarse...';
                window.runMallSeatStandGpsSimulation()
                    .then((report) => {
                        gpsStatus.textContent = [
                            `GPS zapatos: ${report.frameCount} frames`,
                            `Deslizamiento 3D: izq. ${report.maxDrift.left.toFixed(4)} m / der. ${report.maxDrift.right.toFixed(4)} m`,
                            `Error de anclaje: izq. ${report.maxAnchorError.left.toFixed(4)} m / der. ${report.maxAnchorError.right.toFixed(4)} m`,
                            `Elevación: izq. ${report.maxVerticalDrift.left.toFixed(4)} m / der. ${report.maxVerticalDrift.right.toFixed(4)} m`,
                            `Giro de zapatos: izq. ${report.maxRotationDriftRadians.left.toFixed(4)} rad / der. ${report.maxRotationDriftRadians.right.toFixed(4)} rad`,
                            `Máximo salto entre cuadros: ${Math.max(report.maxFrameStep.left, report.maxFrameStep.right).toFixed(4)} m`,
                            `Fases: ${Object.entries(report.motionFrameCounts).map(([motion, count]) => `${motion} ${count}`).join(', ')}`
                        ].join('\n');
                    })
                    .catch((error) => {
                        gpsStatus.textContent = `GPS zapatos: error: ${error.message}`;
                    });
            }, 250);
        }

        function updateNPCs(nowMs = performance.now(), updateLabels = true, frameIndex = 0) {
            const now = Date.now();
            npcs.forEach((npc, npcIndex) => {
                if (npc.collisionDisabled) return;
                const prevPos = npc.mesh.position.clone();
                const npcDistToCam = camera.position.distanceTo(npc.mesh.position);
                const isFarNpc = npcDistToCam > FAR_NPC_SIM_DISTANCE;
                if (isFarNpc && ((frameIndex + npcIndex) % FAR_NPC_SKIP_FRAMES !== 0)) {
                    npc.mesh.visible = true;
                    if (updateLabels) updateAvatarLabelPosition(npc, 2.2, AVATAR_LABEL_NPC_FAR_DISTANCE);
                    return;
                }
                const elapsedMotionSeconds = Math.min(
                    0.25,
                    Math.max(1 / 120, (nowMs - (npc.lastMotionUpdateAt || nowMs - 1000 / 60)) / 1000)
                );
                npc.lastMotionUpdateAt = nowMs;
                const moveStep = npc.speed * elapsedMotionSeconds;
                let onEscalator = false;

                if (window.mallFeatureFlags?.benchSeatingEnabled === true
                    && updateNPCSeatState(npc, npcIndex, now, nowMs, moveStep)) {
                    traceNPCPosition(npc, npcIndex, 'seat-state', prevPos, now);
                    const seatMovementAmount = npc.motionMode === 'walk'
                        ? prevPos.distanceTo(npc.mesh.position)
                        : 0;
                    applyAvatarPose(npc, seatMovementAmount, nowMs);
                    npc.mesh.visible = true;
                    if (updateLabels) updateAvatarLabelPosition(npc, 2.2, AVATAR_LABEL_NPC_FAR_DISTANCE);
                    return;
                }

                // --- APARTADO AUTOMÁTICO DE NPCS ---
                // Si el NPC está demasiado cerca de un jugador (local o remoto), se corre/se hace a un lado
                // Usamos un radio de detección de apartado más amplio (1.3m) para que se empiece a correr antes
                // de que la colisión física bloquee por completo al jugador (0.8m).
                const yieldRadius = 1.3; 
                
                // 1. Evitar jugador local
                if (typeof isWalking !== 'undefined' && isWalking && typeof camera !== 'undefined') {
                    const lpx = camera.position.x;
                    const lpz = camera.position.z;
                    const lpy = camera.position.y - PLAYER_EYE_HEIGHT;
                    
                    // Verificar solapamiento vertical (dentro del mismo piso o transición de altura)
                    if (Math.abs(npc.mesh.position.y - lpy) < 3.0) {
                        const dx = npc.mesh.position.x - lpx;
                        const dz = npc.mesh.position.z - lpz;
                        const distSq = (dx * dx) + (dz * dz);
                        if (distSq < yieldRadius * yieldRadius) {
                            const dist = Math.sqrt(distSq);
                            // Fuerza de empuje suave (mientras más cerca, más rápido se corre)
                            const pushForce = Math.max(0.02, (yieldRadius - dist) * 0.25 + 0.03);
                            let pushX = dx;
                            let pushZ = dz;
                            if (dist < 0.001) {
                                pushX = Math.random() - 0.5;
                                pushZ = Math.random() - 0.5;
                            } else {
                                pushX /= dist;
                                pushZ /= dist;
                            }
                            const targetX = npc.mesh.position.x + pushX * pushForce;
                            const targetZ = npc.mesh.position.z + pushZ * pushForce;
                            // Validar que no se salga de las paredes estáticas del mall
                            if (typeof checkCollision !== 'undefined' && canNPCOccupyPosition(targetX, npc.mesh.position.y, targetZ, { includeActors: false })) {
                                npc.mesh.position.x = targetX;
                                npc.mesh.position.z = targetZ;
                            }
                        }
                    }
                }

                // 2. Evitar otros jugadores remotos
                if (typeof otherPlayers !== 'undefined') {
                    Object.values(otherPlayers).forEach(p => {
                        if (!p?.mesh) return;
                        const rpx = p.mesh.position.x;
                        const rpz = p.mesh.position.z;
                        const rpy = p.mesh.position.y;
                        
                        if (Math.abs(npc.mesh.position.y - rpy) < 3.0) {
                            const dx = npc.mesh.position.x - rpx;
                            const dz = npc.mesh.position.z - rpz;
                            const distSq = (dx * dx) + (dz * dz);
                            if (distSq < yieldRadius * yieldRadius) {
                                const dist = Math.sqrt(distSq);
                                const pushForce = Math.max(0.02, (yieldRadius - dist) * 0.25 + 0.03);
                                let pushX = dx;
                                let pushZ = dz;
                                if (dist < 0.001) {
                                    pushX = Math.random() - 0.5;
                                    pushZ = Math.random() - 0.5;
                                } else {
                                    pushX /= dist;
                                    pushZ /= dist;
                                }
                                const targetX = npc.mesh.position.x + pushX * pushForce;
                                const targetZ = npc.mesh.position.z + pushZ * pushForce;
                                if (typeof checkCollision !== 'undefined' && canNPCOccupyPosition(targetX, npc.mesh.position.y, targetZ, { includeActors: false })) {
                                    npc.mesh.position.x = targetX;
                                    npc.mesh.position.z = targetZ;
                                }
                            }
                        }
                    });
                }

                const activeRide = npc.escalatorRide;
                let activeEscalator = null;
                if (activeRide) {
                    const assignedEscalator = escalatorList.find(e => e.id === activeRide.id);
                    if (assignedEscalator && isEscalatorMotionEnabled(assignedEscalator)) {
                        activeEscalator = {
                            escalator: assignedEscalator,
                            progress: activeRide.progress
                        };
                    } else {
                        npc.escalatorRide = null;
                    }
                } else if (now >= (npc.escalatorExitUntil || 0)) {
                    activeEscalator = findActiveEscalator(
                        npc.mesh.position.x,
                        npc.mesh.position.y,
                        npc.mesh.position.z,
                        AVATAR_FLOOR_OFFSET
                    );
                }
                const needsFloorChangeNow = Math.abs(npc.target.y - npc.mesh.position.y) > 1;
                if (activeEscalator) {
                    const wantsToGoUp = npc.target.y > npc.mesh.position.y;
                    const isAssignedEscalator = npc.intermediateEscalatorId === activeEscalator.escalator.id;
                    const canRideEscalator = Boolean(npc.escalatorRide)
                        || (
                            needsFloorChangeNow
                            && activeEscalator.escalator.up === wantsToGoUp
                            && isAssignedEscalator
                        );

                    if (!canRideEscalator) {
                        // Un NPC que llega a una escala sin requerirla no la cruza ni la usa
                        // en sentido contrario: vuelve a la malla de pasillos seguros.
                        npc.blockedEscalatorId = activeEscalator.escalator.id;
                        npc.blockedEscalatorUntil = now + NPC_FAILED_ESCALATOR_COOLDOWN_MS;
                        if (isAssignedEscalator) {
                            npc.intermediateTarget = null;
                            npc.intermediateEscalatorId = null;
                        }
                        clearNPCNavigationRoute(npc);
                        npc.avoidanceTarget = null;
                        npc.blockedSince = now;

                        // Nunca se permite que una correccion ocurra dentro de la pendiente.
                        // El ultimo punto seguro se guarda solo en las zonas transitables, por lo
                        // que restaura al avatar al pasillo antes de calcular un desvio nuevo.
                        if (
                            npc.lastSafePosition
                            && !isInsideEscalatorFootprint(
                                npc.lastSafePosition.x,
                                npc.lastSafePosition.z,
                                0.02
                            )
                        ) {
                            npc.mesh.position.copy(npc.lastSafePosition);
                        }
                        const entry = getEscalatorRidePosition(activeEscalator.escalator, 0, AVATAR_FLOOR_OFFSET);
                        const awayDirection = npc.mesh.position.clone().sub(entry).setY(0);
                        if (awayDirection.lengthSq() < 0.001) awayDirection.set(Math.random() - 0.5, 0, Math.random() - 0.5);
                        findNPCDetour(npc, npcIndex, awayDirection, now, moveStep);
                        activeEscalator = null;
                    }
                }
                if (activeEscalator) {
                    onEscalator = true;
                    if (!npc.escalatorRide) {
                        npc.escalatorRide = {
                            id: activeEscalator.escalator.id,
                            progress: activeEscalator.progress
                        };
                    }
                    const travelDirection = getEscalatorTravelDirection(activeEscalator.escalator);
                    const ride = advanceAlongEscalator(
                        npc.mesh.position,
                        activeEscalator.escalator,
                        activeEscalator.progress,
                        THREE.MathUtils.clamp(moveStep * 4.5, 0.03, 0.3),
                        AVATAR_FLOOR_OFFSET,
                        0.45,
                        true
                    );
                    npc.escalatorRide.progress = ride.progress;
                    // El sentido se obtiene de la trayectoria real, incluida la diagonal
                    // calibrada de las escalas ancla, para que el avatar nunca suba de espalda.
                    const targetRot = Math.atan2(travelDirection.x, travelDirection.z);
                    let rotationDelta = targetRot - npc.mesh.rotation.y;
                    while (rotationDelta < -Math.PI) rotationDelta += Math.PI * 2;
                    while (rotationDelta > Math.PI) rotationDelta -= Math.PI * 2;
                    // La orientacion se estabiliza al abordar para que el avatar no recorra
                    // varios escalones de espalda mientras se ajusta la rotacion.
                    npc.mesh.rotation.y += rotationDelta * 0.48;
                    recordNPCMovementDirection(npc, travelDirection);
                    clearNPCNavigationRoute(npc);
                    npc.avoidanceTarget = null;
                    npc.lastDetourAt = 0;
                    npc.blockedSince = 0;
                    npc.lastProgressAt = now;
                    npc.lastSuccessfulMoveAt = now;
                    npc.lastProgressPosition.copy(npc.mesh.position);
                    if (ride.done) {
                        npc.escalatorRide = null;
                        // El descanso no puede volver a capturar el avatar como si
                        // abordara la misma escala desde el extremo contrario.
                        npc.escalatorExitUntil = now + 1800;
                        npc.intermediateTarget = null;
                        npc.intermediateEscalatorId = null;
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
                    let navigationDestination = npc.target;

                    if (needsFloorChange) {
                        if (!npc.intermediateTarget) {
                            const isGoingUp = npc.target.y > npc.mesh.position.y;
                            let bestEsc = null;
                            let bestEscId = null;
                            let minDist = Infinity;
                            escalatorList.forEach(e => {
                                if (!isEscalatorMotionEnabled(e)) return;
                                if (e.id === npc.blockedEscalatorId && now < npc.blockedEscalatorUntil) return;
                                if (e.up === isGoingUp) {
                                    const entryPos = getEscalatorRidePosition(e, 0, AVATAR_FLOOR_OFFSET);
                                    const d = npc.mesh.position.distanceTo(entryPos);
                                    if (d < minDist) {
                                        minDist = d;
                                        bestEsc = entryPos;
                                        bestEscId = e.id;
                                    }
                                }
                            });
                            if (bestEsc) {
                                npc.intermediateTarget = bestEsc.clone();
                                npc.intermediateEscalatorId = bestEscId;
                            }
                        }
                        if (npc.intermediateTarget) navigationDestination = npc.intermediateTarget;
                    }

                    let currentMoveTarget = getNPCNavigationWaypoint(npc, navigationDestination);

                    if (npc.avoidanceTarget) {
                        const detourReached = npc.mesh.position.distanceTo(npc.avoidanceTarget) < 0.42;
                        if (detourReached || now > npc.avoidanceUntil) {
                            npc.avoidanceTarget = null;
                            npc.avoidanceUntil = 0;
                        } else {
                            currentMoveTarget = npc.avoidanceTarget;
                        }
                    }

                    const dist = npc.mesh.position.distanceTo(currentMoveTarget);
                    if (dist < 0.8) {
                        if (!needsFloorChange) {
                            npc.state = 'looking';
                            npc.timer = Math.random() < NPC_LOOK_AROUND_CHANCE
                                ? now + NPC_LOOK_MIN_MS + Math.random() * (NPC_LOOK_MAX_MS - NPC_LOOK_MIN_MS)
                                : now + 250 + Math.random() * 450;
                        }
                    } else {
                        const dir = currentMoveTarget.clone().sub(npc.mesh.position);
                        dir.y = 0; dir.normalize();
                        let moveDirection = dir;
                        
                        // --- MOVIMIENTO CON COLISIONES ---
                        const nextX = npc.mesh.position.x + dir.x * moveStep;
                        const nextZ = npc.mesh.position.z + dir.z * moveStep;
                        const clearsStaticGeometry = canNPCOccupyPosition(nextX, npc.mesh.position.y, nextZ, {
                            ignoreActorId: `npc:${npcIndex}`,
                            includeActors: false,
                            allowedEscalatorId: npc.intermediateEscalatorId,
                            collisionRadius: DYNAMIC_ACTOR_COLLISION_RADIUS * 0.82,
                            ignoredColliderOwnerIds: now < (npc.departingSeatColliderUntil || 0)
                                ? [npc.departingSeatColliderId]
                                : []
                        });
                        const clearsAllActors = clearsStaticGeometry && canNPCOccupyPosition(
                            nextX,
                            npc.mesh.position.y,
                            nextZ,
                            {
                                ignoreActorId: `npc:${npcIndex}`,
                                allowedEscalatorId: npc.intermediateEscalatorId,
                                collisionRadius: DYNAMIC_ACTOR_COLLISION_RADIUS * 0.82,
                                ignoredColliderOwnerIds: now < (npc.departingSeatColliderUntil || 0)
                                    ? [npc.departingSeatColliderId]
                                    : []
                            }
                        );
                        if (clearsAllActors) {
                            npc.mesh.position.x = nextX;
                            npc.mesh.position.z = nextZ;
                            recordNPCMovementDirection(npc, moveDirection);
                            npc.blockedSince = 0;
                            npc.lastSuccessfulMoveAt = now;
                        } else if (!clearsStaticGeometry) {
                            // Un solo fotograma bloqueado no es suficiente evidencia para desviar al
                            // avatar: de este modo ignora bloqueos ficticios y evita el zigzag.
                            if (!npc.blockedSince) npc.blockedSince = now;
                            const blockedFor = now - npc.blockedSince;
                            const mayRebuild = now - (npc.lastRouteRebuildAt || 0) > NPC_ROUTE_REBUILD_COOLDOWN_MS;
                            if (blockedFor > NPC_STATIC_BLOCK_CONFIRM_MS && mayRebuild) {
                                replanNPCNavigation(npc, npcIndex, now);
                            }
                        } else {
                            // El rodeo local solo corresponde a personas u otros obstáculos móviles.
                            if (!npc.blockedSince) npc.blockedSince = now;
                            const canRetryDetour = now - (npc.lastDetourAt || 0) >= NPC_DETOUR_RETRY_DELAY_MS;
                            const detourDirection = canRetryDetour
                                ? findNPCDetour(npc, npcIndex, dir, now, moveStep)
                                : null;
                            if (detourDirection) {
                                moveDirection = detourDirection;
                                npc.mesh.position.x += detourDirection.x * moveStep;
                                npc.mesh.position.z += detourDirection.z * moveStep;
                                recordNPCMovementDirection(npc, detourDirection);
                                npc.lastSuccessfulMoveAt = now;
                            } else if (now - npc.blockedSince > NPC_STUCK_REPLAN_MS) {
                                replanNPCNavigation(npc, npcIndex, now);
                            }
                        }
                        
                        const targetRot = Math.atan2(moveDirection.x, moveDirection.z);
                        let diff = targetRot - npc.mesh.rotation.y;
                        while(diff < -Math.PI) diff += Math.PI * 2;
                        while(diff > Math.PI) diff -= Math.PI * 2;
                        npc.mesh.rotation.y += diff * 0.12;
                    }
                } else if (!onEscalator && npc.state === 'looking') {
                    if (!Number.isFinite(npc.timer)) npc.timer = now;
                    if (now > npc.timer) {
                        npc.state = 'walking';
                        npc.intermediateTarget = null;
                        npc.intermediateEscalatorId = null;
                        clearNPCNavigationRoute(npc);
                        npc.avoidanceTarget = null;
                        const changeFloor = Math.random() > 0.85;
                        const nextY = changeFloor ? (npc.mesh.position.y > 3 ? 0 : 5.4) : npc.mesh.position.y;
                        const novelPos = findNovelNPCPosition(npc, npc.mesh.position, nextY, `npc:${npcIndex}`);
                        if (novelPos) {
                            npc.target.set(novelPos.x, getAvatarGroundY(novelPos.y), novelPos.z);
                            rememberNPCDestination(npc, npc.target, now);
                        } else {
                            npc.state = 'looking';
                            npc.timer = now + 1200;
                        }
                    }
                }

                const movedAmount = prevPos.distanceTo(npc.mesh.position);
                if (!onEscalator && npc.state === 'walking') {
                    const progressDistance = npc.lastProgressPosition.distanceTo(npc.mesh.position);
                    if (progressDistance > 0.32) {
                        npc.lastProgressPosition.copy(npc.mesh.position);
                        npc.lastProgressAt = now;
                        npc.blockedSince = 0;
                    }
                    if (now - npc.lastSuccessfulMoveAt > NPC_STUCK_REPLAN_MS) {
                        replanNPCNavigation(npc, npcIndex, now);
                    }
                } else {
                    npc.lastProgressPosition.copy(npc.mesh.position);
                    npc.lastProgressAt = now;
                    npc.lastSuccessfulMoveAt = now;
                    npc.blockedSince = 0;
                }
                applyAvatarPose(npc, movedAmount, nowMs);
                npc.mesh.visible = true;

                // --- 3. ACTUALIZAR ETIQUETAS ---
                if (updateLabels) updateAvatarLabelPosition(npc, 2.2, AVATAR_LABEL_NPC_FAR_DISTANCE);

                // --- 4. SEGURIDAD: GRAVEDAD Y SUELO ---
                if (!onEscalator) {
                    // Guardia anti-NaN: si la Y se corrompe, resetear al suelo
                    if (isNaN(npc.mesh.position.y)) {
                        npc.mesh.position.y = getAvatarGroundY(0);
                    }
                    const isUpperFloor = isNPCOnUpperFloor(npc.mesh.position.y);
                    const floorY = isUpperFloor ? NPC_UPPER_FLOOR_Y : NPC_GROUND_FLOOR_Y;
                    const groundY = getAvatarGroundY(floorY);
                    const hasFloorSupport = !isUpperFloor || isSupportedUpperFloorPosition(
                        npc.mesh.position.x,
                        npc.mesh.position.z
                    );
                    const occupiesStaticObstacle = checkCollision(
                        npc.mesh.position.x,
                        groundY + 1.2,
                        npc.mesh.position.z,
                        {
                            ignoreActorId: `npc:${npcIndex}`,
                            includeActors: false,
                            collisionRadius: DYNAMIC_ACTOR_COLLISION_RADIUS * 0.8,
                            bodyMinY: groundY,
                            bodyMaxY: groundY + DYNAMIC_ACTOR_COLLISION_HEIGHT,
                            // The movement pass already grants this short exemption so
                            // an avatar can step out of the bench volume. Apply the same
                            // rule to the final safety pass; otherwise it restores the
                            // pre-seat lastSafePosition and appears to teleport metres.
                            ignoredColliderOwnerIds: now < (npc.departingSeatColliderUntil || 0)
                                ? [npc.departingSeatColliderId]
                                : []
                        }
                    );

                    if (!hasFloorSupport || occupiesStaticObstacle) {
                        const beforeSafetyRollback = npc.mesh.position.clone();
                        if (npc.lastSafePosition) {
                            npc.mesh.position.copy(npc.lastSafePosition);
                        } else {
                            const safe = findDiscreetNPCSpawnPosition(floorY, `npc:${npcIndex}`);
                            if (!safe) {
                                npc.mesh.visible = false;
                                npc.collisionDisabled = true;
                                if (npc.label) npc.label.style.display = 'none';
                                return;
                            }
                            npc.mesh.position.set(safe.x, getAvatarGroundY(safe.y), safe.z);
                        }
                        npc.intermediateTarget = null;
                        npc.intermediateEscalatorId = null;
                        clearNPCNavigationRoute(npc);
                        npc.avoidanceTarget = null;
                        npc.state = 'looking';
                        npc.timer = now;
                        traceNPCPosition(npc, npcIndex, 'safety-rollback', beforeSafetyRollback, now);
                    } else {
                        // El apoyo debe ser exacto: una interpolación vertical deja pies visibles bajo la losa.
                        npc.mesh.position.y = groundY;
                        if (!npc.lastSafePosition) npc.lastSafePosition = new THREE.Vector3();
                        npc.lastSafePosition.copy(npc.mesh.position);
                    }
                }
                traceNPCPosition(npc, npcIndex, 'frame-end', prevPos, now);
            });
        }

        initializeNPCNavigationGraphs();
        initNPCs();

