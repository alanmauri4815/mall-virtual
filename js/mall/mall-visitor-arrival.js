        // Llegada guiada para visitantes que no eligieron una preferencia de acceso.
        (() => {
            const ENTRY_EYE_Y = 1.8;
            const ENTRY_SPEED = 3.8;
            const ESCALATOR_SPEED = 1.85;
            const LOOK_AHEAD = 7.5;
            let arrivalSequence = 0;
            let arrivalPromise = null;
            let arrivalCompleted = false;

            // Validamos cada acceso con el administrador antes de habilitar el siguiente.
            const lateralEntrances = FIRST_FLOOR_LATERAL_ENTRANCES.slice(0, 1).map((entry) => {
                const position = new THREE.Vector3(...(entry.releasePosition || entry.position));
                const target = new THREE.Vector3(...entry.target);
                const inward = target.sub(position).setY(0).normalize();
                return { position, inward };
            });

            const resetManualInput = () => {
                if (typeof resetLocalMovementInputs === 'function') resetLocalMovementInputs();
                window.mallMobileControls?.stopAutoForward?.();
            };

            const setPose = (position, direction) => {
                const targetY = Number.isFinite(controls.maxPolarAngle) && controls.maxPolarAngle < Math.PI / 2
                    ? position.y - LOOK_AHEAD / Math.tan(controls.maxPolarAngle)
                    : position.y;
                camera.position.copy(position);
                controls.target.set(
                    position.x + direction.x * LOOK_AHEAD,
                    targetY + direction.y * LOOK_AHEAD,
                    position.z + direction.z * LOOK_AHEAD
                );
                controls.update();
            };

            const animateSegment = (from, to, speed, sequence) => new Promise((resolve) => {
                const distance = from.distanceTo(to);
                if (distance < 0.001) {
                    resolve(true);
                    return;
                }
                const direction = to.clone().sub(from).normalize();
                const duration = Math.max(220, (distance / speed) * 1000);
                const startedAt = performance.now();

                const step = (now) => {
                    if (sequence !== arrivalSequence) {
                        resolve(false);
                        return;
                    }
                    const linearT = THREE.MathUtils.clamp((now - startedAt) / duration, 0, 1);
                    const easedT = linearT * linearT * (3 - 2 * linearT);
                    setPose(from.clone().lerp(to, easedT), direction);
                    if (linearT < 1) requestAnimationFrame(step);
                    else resolve(true);
                };
                requestAnimationFrame(step);
            });

            async function runLateralArrival(sequence) {
                const entry = lateralEntrances[Math.floor(Math.random() * lateralEntrances.length)];
                const inward = entry.inward.clone();
                const start = entry.position.clone().setY(ENTRY_EYE_Y);
                const vestibule = start.clone().addScaledVector(inward, 7.5);
                const releasePoint = start.clone().addScaledVector(inward, 16.5);

                setPose(start, inward);
                for (const point of [vestibule, releasePoint]) {
                    const completed = await animateSegment(camera.position.clone(), point, ENTRY_SPEED, sequence);
                    if (!completed) return false;
                }
                return true;
            }

            async function runEscalatorArrival(sequence) {
                const ascending = (typeof escalatorList !== 'undefined' ? escalatorList : [])
                    .filter((escalator) => !escalator.isAnchorEscalator
                        && isEscalatorMotionEnabled(escalator)
                        && escalator.pathEndY > escalator.pathStartY + 1);
                if (!ascending.length) return runLateralArrival(sequence);

                const escalator = ascending[Math.floor(Math.random() * ascending.length)];
                const direction = getEscalatorTravelDirection(escalator);
                let progress = Math.min(escalator.pathLenZ * 0.12, Math.max(0.3, escalator.flatLen * 0.55));
                let lastTime = performance.now();
                setPose(getEscalatorRidePosition(escalator, progress, PLAYER_EYE_HEIGHT), direction);

                const reachedLanding = await new Promise((resolve) => {
                    const step = (now) => {
                        if (sequence !== arrivalSequence) {
                            resolve(false);
                            return;
                        }
                        const deltaSec = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
                        lastTime = now;
                        progress = Math.min(escalator.pathLenZ, progress + ESCALATOR_SPEED * deltaSec);
                        setPose(getEscalatorRidePosition(escalator, progress, PLAYER_EYE_HEIGHT), direction);
                        if (progress < escalator.pathLenZ - 0.01) requestAnimationFrame(step);
                        else resolve(true);
                    };
                    requestAnimationFrame(step);
                });
                if (!reachedLanding) return false;

                const landing = getEscalatorLandingTransform(escalator, PLAYER_EYE_HEIGHT);
                const safeLanding = typeof resolveWalkableSpawnPosition === 'function'
                    ? resolveWalkableSpawnPosition(landing.position)
                    : landing.position;
                return animateSegment(camera.position.clone(), safeLanding, ENTRY_SPEED, sequence);
            }

            window.resetMallGuidedVisitorArrival = () => {
                arrivalSequence++;
                arrivalPromise = null;
                arrivalCompleted = false;
                window.mallGuidedArrivalActive = false;
            };

            window.startMallGuidedVisitorArrival = () => {
                if (arrivalCompleted) return Promise.resolve(true);
                if (arrivalPromise) return arrivalPromise;

                const sequence = ++arrivalSequence;
                arrivalPromise = (async () => {
                    window.mallGuidedArrivalActive = true;
                    resetManualInput();
                    window.mallMovementLockedUntil = 0;
                    if (typeof showInteractionFeedback === 'function') {
                        showInteractionFeedback('Ingresando al mall...');
                    }

                    try {
                        const completed = await runLateralArrival(sequence);
                        if (!completed || sequence !== arrivalSequence) return false;
                        arrivalCompleted = true;
                        if (typeof showInteractionFeedback === 'function') {
                            showInteractionFeedback('Ya puedes recorrer el mall.');
                        }
                        if (typeof broadcastMyPosition === 'function') broadcastMyPosition();
                        return true;
                    } catch (error) {
                        console.warn('No se pudo completar la llegada guiada del visitante:', error);
                        if (typeof forceEntrySpawn === 'function') forceEntrySpawn();
                        return false;
                    } finally {
                        if (sequence === arrivalSequence) {
                            window.mallGuidedArrivalActive = false;
                            if (!arrivalCompleted) arrivalPromise = null;
                            resetManualInput();
                            if (typeof focusMallCanvas === 'function') focusMallCanvas();
                        }
                    }
                })();
                return arrivalPromise;
            };
        })();
