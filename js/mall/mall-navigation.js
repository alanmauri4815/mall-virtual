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

        // Invertir dirección del zoom con la rueda del mouse en modo aéreo
        renderer.domElement.addEventListener('wheel', (event) => {
            if (isWalking) return;
            if (event.isCustomInvertedWheel) return;
            event.stopImmediatePropagation();
            event.preventDefault();
            const invertedEvent = new WheelEvent('wheel', {
                deltaX: event.deltaX,
                deltaY: -event.deltaY,
                deltaZ: event.deltaZ,
                deltaMode: event.deltaMode,
                bubbles: event.bubbles,
                cancelable: event.cancelable,
                clientX: event.clientX,
                clientY: event.clientY,
                screenX: event.screenX,
                screenY: event.screenY,
                view: event.view,
                detail: event.detail,
                ctrlKey: event.ctrlKey,
                altKey: event.altKey,
                shiftKey: event.shiftKey,
                metaKey: event.metaKey
            });
            invertedEvent.isCustomInvertedWheel = true;
            event.target.dispatchEvent(invertedEvent);
        }, true);

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

        function handleJoystick(e) {
            e.preventDefault();
            const rect = joyZone.getBoundingClientRect();
            const touch = e.touches ? e.touches[0] : e;
            const joyRadius = Math.max(1, Math.min(rect.width, rect.height) / 2);
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
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


        const BASE_FRAME_RATE = 60;
        const MIN_NAV_DELTA = 1 / 120;
        const MAX_NAV_DELTA = 1 / 30;
        let moveSpeed = 0.22 * BASE_FRAME_RATE;
        let rotSpeed = 0.035 * BASE_FRAME_RATE;
        let currentMoveVelocityX = 0;
        let currentMoveVelocityZ = 0;
        let currentYawVelocity = 0;
        let currentPitchVelocity = 0;

        function getNavigationBlend(deltaSec, responsiveness) {
            return 1 - Math.exp(-responsiveness * deltaSec);
        }

        function updateKeyboardNavigation(deltaSec = 1 / BASE_FRAME_RATE) {
            deltaSec = THREE.MathUtils.clamp(deltaSec || (1 / BASE_FRAME_RATE), MIN_NAV_DELTA, MAX_NAV_DELTA);
            if (!isWalking) {
                currentEscalatorState = null;
                currentMoveVelocityX = 0;
                currentMoveVelocityZ = 0;
                currentYawVelocity = 0;
                currentPitchVelocity = 0;
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

            let moveInputX = 0;
            let moveInputZ = 0;
            let yawInput = 0;
            let pitchInput = 0;

            // --- DESPLAZAMIENTO (JOYSTICK + TECLADO WASD) ---
            if (joystickActive) {
                moveInputX += walkDir.x * (-joystickDir.y) + right.x * joystickDir.x;
                moveInputZ += walkDir.z * (-joystickDir.y) + right.z * joystickDir.x;
            }

            if (isCtrl) {
                // MODO DESPLAZAMIENTO LATERAL + MIRADA VERTICAL
                if (wantsStrafeLeft) {
                    moveInputX -= right.x * 1.05;
                    moveInputZ -= right.z * 1.05;
                }
                if (wantsStrafeRight) {
                    moveInputX += right.x * 1.05;
                    moveInputZ += right.z * 1.05;
                }

                if (keys.ArrowUp) {
                    pitchInput -= 1;
                }
                if (keys.ArrowDown) {
                    pitchInput += 1;
                }
            } else {
                // MODO CAMINATA (WALK + YAW)
                if (keys.ArrowUp) {
                    moveInputX += walkDir.x;
                    moveInputZ += walkDir.z;
                }
                if (keys.ArrowDown) {
                    moveInputX -= walkDir.x;
                    moveInputZ -= walkDir.z;
                }

                // Rotación horizontal
                if (keys.ArrowLeft) {
                    yawInput += 1;
                }
                if (keys.ArrowRight) {
                    yawInput -= 1;
                }

                // Mirada Vertical con botones dedicados
                if (isBtnLookUp) {
                    pitchInput -= 1;
                }
                if (isBtnLookDown) {
                    pitchInput += 1;
                }

                // Teclas WASD (Strafe opcional en teclado)
                if (keys.KeyD) { moveInputX += right.x; moveInputZ += right.z; }
                if (keys.KeyA) { moveInputX -= right.x; moveInputZ -= right.z; }
                if (keys.KeyW) { moveInputX += walkDir.x; moveInputZ += walkDir.z; }
                if (keys.KeyS) { moveInputX -= walkDir.x; moveInputZ -= walkDir.z; }
            }

            const moveInputLength = Math.hypot(moveInputX, moveInputZ);
            if (moveInputLength > 1) {
                moveInputX /= moveInputLength;
                moveInputZ /= moveInputLength;
            }

            const moveBlend = getNavigationBlend(deltaSec, moveInputLength > 0.001 ? 14 : 18);
            const rotBlend = getNavigationBlend(deltaSec, Math.abs(yawInput) > 0.001 || Math.abs(pitchInput) > 0.001 ? 16 : 20);
            currentMoveVelocityX = THREE.MathUtils.lerp(currentMoveVelocityX, moveInputX * moveSpeed, moveBlend);
            currentMoveVelocityZ = THREE.MathUtils.lerp(currentMoveVelocityZ, moveInputZ * moveSpeed, moveBlend);
            currentYawVelocity = THREE.MathUtils.lerp(currentYawVelocity, yawInput * rotSpeed, rotBlend);
            currentPitchVelocity = THREE.MathUtils.lerp(currentPitchVelocity, pitchInput * rotSpeed, rotBlend);

            const yawStep = currentYawVelocity * deltaSec;
            if (Math.abs(yawStep) > 0.00001) {
                const relativeTarget = controls.target.clone().sub(camera.position);
                relativeTarget.applyAxisAngle(new THREE.Vector3(0, 1, 0), yawStep);
                controls.target.copy(camera.position).add(relativeTarget);
            }

            const pitchStep = currentPitchVelocity * deltaSec;
            if (Math.abs(pitchStep) > 0.00001) {
                const pitchDotLimit = pitchStep < 0 ? dir.dot(new THREE.Vector3(0, 1, 0)) : dir.dot(new THREE.Vector3(0, -1, 0));
                if (pitchDotLimit < 0.95) {
                    const relTarget = controls.target.clone().sub(camera.position);
                    relTarget.applyAxisAngle(right, pitchStep);
                    controls.target.copy(camera.position).add(relTarget);
                } else {
                    currentPitchVelocity = 0;
                }
            }

            // --- APLICACIÓN DE MOVIMIENTO CON MOTOR DE COLISIONES ---
            const moveAccumX = currentMoveVelocityX * deltaSec;
            const moveAccumZ = currentMoveVelocityZ * deltaSec;
            if (Math.abs(moveAccumX) > 0.0001 || Math.abs(moveAccumZ) > 0.0001) {
                const nx = camera.position.x + moveAccumX;
                const ny = camera.position.y;
                const nz = camera.position.z + moveAccumZ;

                // Colisión eje X (deslizamiento)
                if (!checkCollision(nx, ny, camera.position.z, { ignoreActorId: '__local__' })) {
                    camera.position.x = nx;
                    controls.target.x += moveAccumX;
                } else {
                    currentMoveVelocityX = 0;
                }
                // Colisión eje Z (deslizamiento)
                if (!checkCollision(camera.position.x, ny, nz, { ignoreActorId: '__local__' })) {
                    camera.position.z = nz;
                    controls.target.z += moveAccumZ;
                } else {
                    currentMoveVelocityZ = 0;
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



