        // --- VARIABLES GLOBALES DE PUBLICIDAD ---
        let lastAdUpdate = Date.now();
        let adIndex = 0;

        let lastLabelUpdateAt = 0;
        const LABEL_UPDATE_INTERVAL_MS = 1000 / 24;
        const FAR_NPC_SIM_DISTANCE = IS_COARSE_POINTER ? 46 : 58;
        const FAR_NPC_SKIP_FRAMES = IS_COARSE_POINTER ? 3 : 2;
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
            if (document.hidden) resetMovementInputState();
        });
        window.addEventListener('focus', () => {
            if (shouldForceWalkMode()) focusMallCanvas();
        });

        function animate() {
            requestAnimationFrame(animate);

            const nowMs = performance.now();
            const deltaSec = Math.min(1 / 30, Math.max(1 / 120, (nowMs - lastFrameTimeMs) / 1000 || (1 / 60)));
            lastFrameTimeMs = nowMs;
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

            runFrameStep('keyboard-navigation', () => updateKeyboardNavigation(deltaSec));
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

        function findWalkableNPCPosition(y, ignoreActorId = null, attempts = 18) {
            for (let attempt = 0; attempt < attempts; attempt++) {
                const candidate = getValidNPCPosition(y);
                const bodyY = getAvatarGroundY(candidate.y) + 1.2;
                if (!checkCollision(candidate.x, bodyY, candidate.z, {
                    ignoreActorId,
                    collisionRadius: DYNAMIC_ACTOR_COLLISION_RADIUS * 0.8
                })) {
                    return candidate;
                }
            }
            return getValidNPCPosition(y);
        }

        function initNPCs() {
            for (let i = 0; i < NPC_COUNT; i++) {
                const name = buildNpcDisplayName(i);
                const style = buildRandomAvatarStyle();
                const npcAvatar = createAvatar(name, style);
                
                const startFloor = Math.random() > 0.5 ? 5.4 : 0;
                const pos = findWalkableNPCPosition(startFloor, `npc:${i}`);
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
            }
        }

        function updateNPCs(nowMs = performance.now(), updateLabels = true, frameIndex = 0) {
            const now = Date.now();
            npcs.forEach((npc, npcIndex) => {
                const prevPos = npc.mesh.position.clone();
                const npcDistToCam = camera.position.distanceTo(npc.mesh.position);
                const isFarNpc = npcDistToCam > FAR_NPC_SIM_DISTANCE;
                if (isFarNpc && ((frameIndex + npcIndex) % FAR_NPC_SKIP_FRAMES !== 0)) {
                    npc.mesh.visible = true;
                    if (updateLabels) updateAvatarLabelPosition(npc, 2.2, AVATAR_LABEL_NPC_FAR_DISTANCE);
                    return;
                }
                let onEscalator = false;

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
                            if (typeof checkCollision !== 'undefined' && !checkCollision(targetX, npc.mesh.position.y + 1.2, targetZ, { includeActors: false })) {
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
                                if (typeof checkCollision !== 'undefined' && !checkCollision(targetX, npc.mesh.position.y + 1.2, targetZ, { includeActors: false })) {
                                    npc.mesh.position.x = targetX;
                                    npc.mesh.position.z = targetZ;
                                }
                            }
                        }
                    });
                }

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
                                if (!isEscalatorMotionEnabled(e)) return;
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

                        if (!checkCollision(nextX, bodyY, nextZ, { ignoreActorId: `npc:${npcIndex}` })) {
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
                        const pos = findWalkableNPCPosition(nextY, `npc:${npcIndex}`);
                        npc.target.set(pos.x, getAvatarGroundY(pos.y), pos.z);
                    }
                }

                const movedAmount = prevPos.distanceTo(npc.mesh.position);
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

