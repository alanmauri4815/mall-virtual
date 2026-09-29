(() => {
    const preview = document.getElementById('mall-tour-preview');
    const card = document.getElementById('mall-tour-card');
    const pointer = document.getElementById('mall-tour-pointer');
    const title = document.getElementById('mall-tour-title');
    const copy = document.getElementById('mall-tour-copy');
    const stepCount = document.getElementById('mall-tour-step-count');
    const recovery = document.getElementById('mall-tour-recovery');
    const continueButton = document.getElementById('mall-tour-continue');
    const voiceButton = document.getElementById('mall-tour-voice');
    const previewVoiceButton = document.getElementById('mall-tour-preview-voice');
    const previewVoiceIcon = document.getElementById('mall-tour-preview-voice-icon');
    const previewVoiceLabel = document.getElementById('mall-tour-preview-voice-label');
    const hints = document.getElementById('mall-tour-hints');
    const welcomeAudio = document.getElementById('mall-tour-welcome-audio');
    const skipButton = card?.querySelector('.mall-tour-card__skip');
    const pointerLabel = pointer?.querySelector('.mall-tour-pointer__label');
    const pointerMarker = pointer?.querySelector('.mall-tour-pointer__marker');
    const storeModal = document.getElementById('store-modal');
    const joystick = document.getElementById('joystick-zone');
    const lookControls = document.getElementById('mobile-look-panel');
    const state = {
        active: false,
        step: 'idle',
        voice: false,
        crossed: false,
        lastPosition: null,
        lastMovementAt: 0,
        lastProjectionAt: 0,
        initialLook: null,
        fallbackShown: false,
        entryStart: null,
        storeCode: null,
        voiceTrack: null
    };
    const tourAudio = new Audio();
    tourAudio.preload = 'none';
    const tempProjected = new THREE.Vector3();

    function cameraRef() {
        return typeof camera !== 'undefined' ? camera : null;
    }

    function controlsRef() {
        return typeof controls !== 'undefined' ? controls : null;
    }

    function currentForward() {
        const activeCamera = cameraRef();
        if (!activeCamera) return new THREE.Vector3(1, 0, 0);
        return activeCamera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
    }

    function currentCatalogIsOpen() {
        return storeModal && window.getComputedStyle(storeModal).display !== 'none';
    }

    function playTrack(track) {
        state.voiceTrack = track || null;
        tourAudio.pause();
        tourAudio.currentTime = 0;
        if (!state.voiceTrack) return;
        tourAudio.src = `Voz-${state.voiceTrack}.mp3?v=20260928-tour-audio-v1`;
        if (!state.voice) return;
        tourAudio.play().catch((error) => {
            console.warn(`No se pudo reproducir Voz-${state.voiceTrack}.mp3:`, error);
        });
    }

    function restoreTourCard() {
        if (card.parentElement !== document.body) pointer.insertAdjacentElement('afterend', card);
        card.classList.remove('mall-tour-card--catalog');
    }

    function resetWelcomeAudio() {
        if (!welcomeAudio) return;
        welcomeAudio.pause();
        welcomeAudio.currentTime = 0;
        previewVoiceButton?.setAttribute('aria-pressed', 'false');
        if (previewVoiceIcon) previewVoiceIcon.textContent = 'volume_up';
        if (previewVoiceLabel) previewVoiceLabel.textContent = 'Escuchar bienvenida';
    }

    async function toggleWelcomeAudio() {
        if (!welcomeAudio || !previewVoiceButton) return;
        if (!welcomeAudio.paused) {
            welcomeAudio.pause();
            previewVoiceButton.setAttribute('aria-pressed', 'false');
            previewVoiceIcon.textContent = 'play_arrow';
            previewVoiceLabel.textContent = 'Continuar bienvenida';
            return;
        }
        if (welcomeAudio.ended) welcomeAudio.currentTime = 0;
        try {
            await welcomeAudio.play();
            previewVoiceButton.setAttribute('aria-pressed', 'true');
            previewVoiceIcon.textContent = 'pause';
            previewVoiceLabel.textContent = 'Pausar bienvenida';
        } catch (error) {
            console.warn('No se pudo reproducir el audio de bienvenida:', error);
            previewVoiceLabel.textContent = 'Audio no disponible';
        }
    }

    function setStep(step) {
        state.step = step;
        state.lastMovementAt = performance.now();
        state.lastPosition = cameraRef()?.position.clone() || null;
        state.fallbackShown = false;
        recovery.hidden = true;
        continueButton.hidden = true;
        hints.hidden = step !== 'store-help';
        document.body.dataset.mallTourStep = step;
        joystick?.classList.toggle('mall-tour-target', step === 'arrival');
        lookControls?.classList.toggle('mall-tour-target', step === 'turn');

        const settings = {
            arrival: {
                icon: 'directions_walk', count: '1 / 5', track: '02',
                title: 'Lleguemos por el paso cebra',
                copy: 'Avanza con W o el joystick. Gira arrastrando la vista.'
            },
            turn: {
                icon: '360', count: '2 / 5', track: '04',
                title: 'Prueba a girar la vista',
                copy: 'Arrastra la pantalla o usa los controles de cámara.'
            },
            store: {
                icon: 'storefront', count: '3 / 5', track: '07',
                title: 'Abre un local',
                copy: 'Toca una placa dorada con el código de cualquier tienda.'
            },
            'store-help': {
                icon: 'storefront', count: '4 / 5', track: '07A',
                title: 'Entra y conversa con el local',
                copy: 'Puedes entrar por la puerta y preguntar al asistente. También puedes escribirle al locatario desde esta ficha.'
            },
            entry: {
                icon: 'door_front', count: '5 / 5', track: '08',
                title: 'Practica la entrada',
                copy: 'Cierra la ficha y avanza por la puerta del local. Tras caminar unos pasos, confirma que ya entraste.'
            },
            complete: {
                icon: 'task_alt', count: '5 / 5', track: '09',
                title: '¡Ya sabes cómo empezar!',
                copy: 'Ya sabes cómo llegar, abrir un local y pedir orientación. ¡Explora a tu ritmo!'
            }
        }[step];
        if (!settings) return;
        if (step === 'store-help') {
            storeModal.insertBefore(card, document.getElementById('modal-store-hero'));
            card.classList.add('mall-tour-card--catalog');
        } else {
            restoreTourCard();
        }
        card.querySelector('.mall-tour-card__icon .material-symbols-outlined').textContent = settings.icon;
        stepCount.textContent = settings.count;
        title.textContent = settings.title;
        copy.textContent = settings.copy;
        pointer.hidden = step === 'complete' || step === 'store-help';
        skipButton.textContent = step === 'complete' ? 'Seguir explorando' : 'Saltar';
        continueButton.textContent = step === 'store-help' ? 'Practicar entrada' : 'Ya entré';
        continueButton.hidden = step !== 'store-help';
        if (step === 'turn') state.initialLook = currentForward();
        if (step === 'entry') state.entryStart = cameraRef()?.position.clone() || null;
        playTrack(settings.track);
        syncCardVisibility();
    }

    function syncCardVisibility() {
        card.hidden = !state.active || (currentCatalogIsOpen() && state.step !== 'store-help');
    }

    function setPose(position, lookTarget) {
        const activeCamera = cameraRef();
        const activeControls = controlsRef();
        if (!activeCamera || !activeControls) return false;
        activeCamera.position.copy(position);
        let target = lookTarget;
        if (typeof getEntryControlsTarget === 'function') {
            target = getEntryControlsTarget(position, lookTarget);
        }
        activeControls.target.copy(target);
        activeControls.update();
        activeCamera.position.copy(position);
        activeControls.target.copy(target);
        activeControls.update();
        activeCamera.position.copy(position);
        return true;
    }

    function startTour() {
        const activeCamera = cameraRef();
        const activeControls = controlsRef();
        if (!activeCamera || !activeControls || typeof THREE === 'undefined') {
            window.mallGuidedTourPending = false;
            return;
        }
        state.active = true;
        state.crossed = false;
        state.lastProjectionAt = 0;
        document.body.classList.add('mall-tour-active');
        const eyeHeight = typeof PLAYER_EYE_HEIGHT === 'number' ? PLAYER_EYE_HEIGHT : 1.85;
        const outsideStart = new THREE.Vector3(-49.5, eyeHeight + 0.1, 87.14);
        const facingPoint = new THREE.Vector3(-42, outsideStart.y, outsideStart.z);
        if (!setPose(outsideStart, facingPoint)) {
            stopTour(false);
            return;
        }
        if (typeof resetLocalMovementInputs === 'function') resetLocalMovementInputs();
        window.mallMovementLockedUntil = 0;
        if (typeof broadcastMyPosition === 'function') broadcastMyPosition();
        setStep('arrival');
        tick();
    }

    function getStoreTarget() {
        if (typeof catalogClickTargets === 'undefined') return null;
        const activeCamera = cameraRef();
        if (!activeCamera) return null;
        activeCamera.updateMatrixWorld(true);
        const forward = currentForward();
        const candidates = [];
        for (const mesh of catalogClickTargets) {
            if (!mesh?.userData?.isStoreCodeSign || mesh.userData.isPlaqueHitbox || mesh.visible === false) continue;
            const meshStoreCode = String(mesh.userData.shopCode || mesh.userData.sourceShopCode || '').toLowerCase();
            if (state.storeCode && meshStoreCode && meshStoreCode !== String(state.storeCode).toLowerCase()) continue;
            mesh.updateWorldMatrix(true, false);
            const worldPosition = mesh.getWorldPosition(new THREE.Vector3());
            const offset = worldPosition.clone().sub(activeCamera.position);
            const distance = offset.length();
            if (distance < 4 || distance > 65 || forward.dot(offset.setY(0).normalize()) < 0.04) continue;
            const projected = worldPosition.clone().project(activeCamera);
            if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 0.88 || projected.y < -0.68 || projected.y > 0.78) continue;
            candidates.push({ worldPosition, distance, score: Math.abs(projected.x) + Math.abs(projected.y + 0.12) * 0.75 + distance * 0.006 });
        }
        candidates.sort((a, b) => a.score - b.score);
        return candidates[0]?.worldPosition || null;
    }

    function getPointerTarget() {
        const activeCamera = cameraRef();
        if (!activeCamera) return null;
        if (state.step === 'arrival') {
            if (!state.crossed) {
                pointerLabel.textContent = 'PASO CEBRA';
                return new THREE.Vector3(-44.53, 2.5, 87.14);
            }
            pointerLabel.textContent = 'ENTRADA';
            return new THREE.Vector3(-23.8, 3.1, 88.8);
        }
        if (state.step === 'turn') {
            pointerLabel.textContent = 'GIRA LA VISTA';
            return activeCamera.position.clone().add(currentForward().multiplyScalar(7));
        }
        if (state.step === 'store') {
            pointerLabel.textContent = 'TOCA UN LOCAL';
            return getStoreTarget() || activeCamera.position.clone().add(currentForward().multiplyScalar(12));
        }
        if (state.step === 'entry') {
            pointerLabel.textContent = 'ENTRA AL LOCAL';
            return getStoreTarget() || activeCamera.position.clone().add(currentForward().multiplyScalar(12));
        }
        return null;
    }

    function updatePointer(now) {
        if (now - state.lastProjectionAt < 70 || !state.active || state.step === 'complete' || state.step === 'store-help') return;
        state.lastProjectionAt = now;
        const target = getPointerTarget();
        const activeCamera = cameraRef();
        if (!target || !activeCamera) {
            pointer.hidden = true;
            return;
        }
        activeCamera.updateMatrixWorld(true);
        tempProjected.copy(target).project(activeCamera);
        if (tempProjected.z > 1.1) {
            pointer.hidden = true;
            return;
        }
        const halfWidth = window.innerWidth / 2;
        const halfHeight = window.innerHeight / 2;
        const rawX = (tempProjected.x + 1) * halfWidth;
        const rawY = (1 - tempProjected.y) * halfHeight;
        const x = THREE.MathUtils.clamp(rawX, 28, window.innerWidth - 28);
        const y = THREE.MathUtils.clamp(rawY, 34, window.innerHeight - 34);
        pointer.style.left = `${x}px`;
        pointer.style.top = `${y}px`;
        const isEdge = x !== rawX || y !== rawY;
        pointer.classList.toggle('is-edge', isEdge);
        pointerMarker.style.transform = isEdge
            ? `rotate(${Math.atan2(rawY - halfHeight, rawX - halfWidth) * (180 / Math.PI) + 45}deg)`
            : '';
        pointer.hidden = false;
    }

    function showArrivalFallback() {
        state.fallbackShown = true;
        recovery.textContent = '¿Se te dificulta avanzar? Puedes continuar desde la entrada interior.';
        recovery.hidden = false;
        continueButton.textContent = 'Continuar desde dentro';
        continueButton.hidden = false;
        playTrack('05');
    }

    function tick() {
        if (!state.active || state.step === 'complete') return;
        const now = performance.now();
        const activeCamera = cameraRef();
        if (!activeCamera) return;
        updatePointer(now);

        if (state.step === 'arrival') {
            const position = activeCamera.position;
            if (!state.lastPosition || position.distanceTo(state.lastPosition) > 0.45) {
                state.lastPosition = position.clone();
                state.lastMovementAt = now;
            }
            if (!state.crossed && position.x >= -40.3) {
                state.crossed = true;
                title.textContent = 'Paso cebra listo';
                copy.textContent = 'Sigue recto hacia la puerta señalada.';
                playTrack('03');
            }
            if (position.x >= -12.5) {
                setStep('turn');
            } else if (!state.fallbackShown && now - state.lastMovementAt > 10000) {
                showArrivalFallback();
            }
        } else if (state.step === 'turn' && state.initialLook) {
            const current = currentForward();
            if (state.initialLook.dot(current) < 0.9) {
                setStep('store');
            } else if (!state.fallbackShown && now - state.lastMovementAt > 10000) {
                state.fallbackShown = true;
                recovery.textContent = 'Puedes continuar sin practicar el giro.';
                recovery.hidden = false;
                continueButton.textContent = 'Continuar';
                continueButton.hidden = false;
                playTrack('06');
            }
        } else if (state.step === 'entry' && state.entryStart) {
            if (activeCamera.position.distanceTo(state.entryStart) >= 2.5 && continueButton.hidden) {
                copy.textContent = '¡Bien! Ya puedes conversar con el asistente o volver a la ficha para escribirle al local.';
                continueButton.textContent = 'Ya entré';
                continueButton.hidden = false;
            }
        }
        requestAnimationFrame(tick);
    }

    function advanceTour() {
        if (!state.active) return;
        if (state.step === 'arrival') {
            if (typeof forceEntrySpawn === 'function') forceEntrySpawn();
            setStep('turn');
        } else if (state.step === 'turn') {
            setStep('store');
        } else if (state.step === 'store-help') {
            restoreTourCard();
            window.closeModal?.();
            setStep('entry');
        } else if (state.step === 'entry') {
            setStep('complete');
        }
    }

    function stopTour(returnToInterior = false) {
        if (returnToInterior && state.active && state.step === 'arrival' && typeof forceEntrySpawn === 'function') {
            forceEntrySpawn();
        }
        state.active = false;
        state.step = 'idle';
        state.voice = false;
        tourAudio.pause();
        tourAudio.currentTime = 0;
        restoreTourCard();
        document.body.classList.remove('mall-tour-active');
        delete document.body.dataset.mallTourStep;
        joystick?.classList.remove('mall-tour-target');
        lookControls?.classList.remove('mall-tour-target');
        card.hidden = true;
        pointer.hidden = true;
        preview.hidden = true;
        voiceButton.setAttribute('aria-pressed', 'false');
        voiceButton.setAttribute('aria-label', 'Activar voz');
    }

    window.startMallGuidedExperience = () => {
        resetWelcomeAudio();
        preview.hidden = false;
        preview.querySelector('[data-mall-action="confirmMallGuidedExperience"]')?.focus();
    };
    window.cancelMallGuidedExperience = () => {
        resetWelcomeAudio();
        preview.hidden = true;
    };
    window.confirmMallGuidedExperience = async () => {
        resetWelcomeAudio();
        preview.hidden = true;
        try {
            await window.startMallExperience?.();
            startTour();
        } catch (error) {
            console.error('No se pudo iniciar el recorrido guiado:', error);
        }
    };
    window.skipMallGuidedTour = () => stopTour(true);
    window.advanceMallGuidedTour = advanceTour;
    window.toggleMallGuidedVoice = () => {
        state.voice = !state.voice;
        voiceButton.setAttribute('aria-pressed', String(state.voice));
        voiceButton.setAttribute('aria-label', state.voice ? 'Desactivar voz' : 'Activar voz');
        voiceButton.title = state.voice ? 'Desactivar voz' : 'Activar voz';
        if (state.voice && state.voiceTrack) {
            tourAudio.currentTime = 0;
            tourAudio.play().catch((error) => console.warn('No se pudo reproducir la voz del recorrido:', error));
        } else {
            tourAudio.pause();
            tourAudio.currentTime = 0;
        }
    };
    window.mallGuidedTour = Object.freeze({ start: startTour });

    previewVoiceButton?.addEventListener('click', toggleWelcomeAudio);
    welcomeAudio?.addEventListener('ended', resetWelcomeAudio);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !preview.hidden) window.cancelMallGuidedExperience();
    });
    window.addEventListener('mall:catalog-opened', (event) => {
        if (!state.active || state.step !== 'store') return;
        state.storeCode = event.detail?.storeCode || null;
        setStep('store-help');
    });
    if (storeModal) {
        new MutationObserver(() => {
            if (state.active && state.step === 'store-help' && !currentCatalogIsOpen()) {
                setStep('entry');
                return;
            }
            syncCardVisibility();
        }).observe(storeModal, { attributes: true, attributeFilter: ['style', 'class'] });
    }
})();
