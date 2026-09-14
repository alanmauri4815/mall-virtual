(function initializeMallMobileControls(globalScope) {
    const DEFAULT_FOV = 55;
    const MIN_FOV = 35;
    const MAX_FOV = 70;
    const DRAG_THRESHOLD_PX = 6;
    const DOUBLE_TAP_MAX_MS = 320;
    const DOUBLE_TAP_MAX_DISTANCE_PX = 34;
    const STORAGE_KEY = 'mall-mobile-control-preferences-v1';
    const activePointers = new Map();
    const state = {
        autoForward: false,
        sensitivity: 1,
        leftHanded: false,
        pinchStartDistance: 0,
        pinchStartFov: DEFAULT_FOV,
        gestureMoved: false,
        lastTap: null
    };

    function isMobileWalkGestureAvailable() {
        if (!globalScope.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints < 1) return false;
        if (typeof isWalking === 'undefined' || !isWalking) return false;
        if (typeof shouldForceWalkMode === 'function' && !shouldForceWalkMode()) return false;
        return true;
    }

    function persistPreferences() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                sensitivity: state.sensitivity,
                leftHanded: state.leftHanded
            }));
        } catch (_) {}
    }

    function restorePreferences() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            const sensitivity = Number(saved.sensitivity);
            if (Number.isFinite(sensitivity)) state.sensitivity = THREE.MathUtils.clamp(sensitivity, 0.5, 1.8);
            state.leftHanded = saved.leftHanded === true;
        } catch (_) {}
    }

    function updateInterface() {
        const autoButton = document.getElementById('mobile-auto-forward-btn');
        const sensitivityInput = document.getElementById('mobile-look-sensitivity');
        const leftHandedInput = document.getElementById('mobile-left-handed');
        document.body.classList.toggle('mobile-controls-left-handed', state.leftHanded);
        if (autoButton) {
            autoButton.classList.toggle('is-active', state.autoForward);
            autoButton.setAttribute('aria-pressed', String(state.autoForward));
            autoButton.title = state.autoForward ? 'Detener avance' : 'Avance automático';
            autoButton.setAttribute('aria-label', autoButton.title);
        }
        if (sensitivityInput) sensitivityInput.value = String(state.sensitivity);
        if (leftHandedInput) leftHandedInput.checked = state.leftHanded;
    }

    function suppressCanvasTap(durationMs = 700) {
        globalScope.mallSuppressCanvasTapUntil = Date.now() + durationMs;
    }

    function setAutoForward(active) {
        const nextValue = Boolean(active);
        if (state.autoForward === nextValue) return;
        state.autoForward = nextValue;
        updateInterface();
    }

    function toggleAutoForward() {
        if (!isMobileWalkGestureAvailable()) return;
        setAutoForward(!state.autoForward);
    }

    function animateFov(targetFov) {
        const startFov = camera.fov;
        const destination = THREE.MathUtils.clamp(targetFov, MIN_FOV, MAX_FOV);
        const startedAt = performance.now();
        const duration = 180;
        const step = (now) => {
            const progress = Math.min(1, (now - startedAt) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            camera.fov = THREE.MathUtils.lerp(startFov, destination, eased);
            camera.updateProjectionMatrix();
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    function resetZoom() {
        animateFov(DEFAULT_FOV);
        suppressCanvasTap();
    }

    function rotateWalkingView(deltaX, deltaY) {
        const offset = controls.target.clone().sub(camera.position);
        const distance = Math.max(offset.length(), 0.01);
        const spherical = new THREE.Spherical().setFromVector3(offset);
        const scale = state.sensitivity * 0.0038;
        spherical.theta += deltaX * scale;
        spherical.phi = THREE.MathUtils.clamp(
            spherical.phi + deltaY * scale,
            Math.PI / 2 - 0.7,
            Math.PI / 2 + 0.5
        );
        spherical.radius = distance;
        offset.setFromSpherical(spherical);
        controls.target.copy(camera.position).add(offset);
        controls.update();
    }

    function pointerDistance() {
        const points = [...activePointers.values()];
        if (points.length < 2) return 0;
        return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    }

    function handlePointerDown(event) {
        if (event.pointerType !== 'touch' || !isMobileWalkGestureAvailable()) return;
        event.preventDefault();
        activePointers.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
            startX: event.clientX,
            startY: event.clientY,
            startedAt: Date.now()
        });
        try { renderer.domElement.setPointerCapture(event.pointerId); } catch (_) {}
        if (activePointers.size === 1) state.gestureMoved = false;
        if (activePointers.size === 2) {
            state.pinchStartDistance = Math.max(pointerDistance(), 1);
            state.pinchStartFov = camera.fov;
            state.gestureMoved = true;
            suppressCanvasTap();
        }
    }

    function handlePointerMove(event) {
        const previous = activePointers.get(event.pointerId);
        if (!previous || event.pointerType !== 'touch') return;
        event.preventDefault();
        const deltaX = event.clientX - previous.x;
        const deltaY = event.clientY - previous.y;
        previous.x = event.clientX;
        previous.y = event.clientY;

        if (activePointers.size >= 2) {
            const distance = Math.max(pointerDistance(), 1);
            const ratio = distance / Math.max(state.pinchStartDistance, 1);
            camera.fov = THREE.MathUtils.clamp(state.pinchStartFov / ratio, MIN_FOV, MAX_FOV);
            camera.updateProjectionMatrix();
            state.gestureMoved = true;
            suppressCanvasTap();
            return;
        }

        const moved = Math.hypot(event.clientX - previous.startX, event.clientY - previous.startY);
        if (moved < DRAG_THRESHOLD_PX && !state.gestureMoved) return;
        state.gestureMoved = true;
        rotateWalkingView(deltaX, deltaY);
        suppressCanvasTap();
    }

    function handlePointerEnd(event) {
        const pointer = activePointers.get(event.pointerId);
        if (!pointer || event.pointerType !== 'touch') return;
        const pointerCount = activePointers.size;
        const moved = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY);
        const isTap = pointerCount === 1 && !state.gestureMoved && moved < DRAG_THRESHOLD_PX;
        activePointers.delete(event.pointerId);

        if (isTap) {
            const now = Date.now();
            const prior = state.lastTap;
            if (
                prior &&
                now - prior.at <= DOUBLE_TAP_MAX_MS &&
                Math.hypot(event.clientX - prior.x, event.clientY - prior.y) <= DOUBLE_TAP_MAX_DISTANCE_PX
            ) {
                state.lastTap = null;
                globalScope.mallTouchDoubleTapUntil = now + 700;
                resetZoom();
            } else {
                state.lastTap = { at: now, x: event.clientX, y: event.clientY };
            }
        } else if (pointerCount > 1 || state.gestureMoved) {
            suppressCanvasTap();
        }

        if (activePointers.size < 2) state.pinchStartDistance = 0;
        if (activePointers.size === 0) state.gestureMoved = false;
    }

    function setSettingsOpen(open) {
        const panel = document.getElementById('mobile-control-settings');
        const button = document.getElementById('mobile-settings-btn');
        if (!panel || !button) return;
        const opening = Boolean(open);
        if (opening) setAutoForward(false);
        panel.hidden = !opening;
        button.setAttribute('aria-expanded', String(opening));
    }

    function toggleSettings(event) {
        event?.stopPropagation?.();
        const panel = document.getElementById('mobile-control-settings');
        if (!panel) return;
        setSettingsOpen(panel.hidden);
    }

    function bindInterface() {
        const canvas = renderer.domElement;
        canvas.style.touchAction = 'none';
        canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
        canvas.addEventListener('pointermove', handlePointerMove, { passive: false });
        canvas.addEventListener('pointerup', handlePointerEnd, { passive: false });
        canvas.addEventListener('pointercancel', handlePointerEnd, { passive: false });

        document.getElementById('mobile-auto-forward-btn')?.addEventListener('click', toggleAutoForward);
        const settingsButton = document.getElementById('mobile-settings-btn');
        const settingsPanel = document.getElementById('mobile-control-settings');
        settingsButton?.addEventListener('click', toggleSettings);
        document.getElementById('mobile-control-settings-close')?.addEventListener('click', (event) => {
            event.stopPropagation?.();
            setSettingsOpen(false);
        });
        document.addEventListener?.('pointerdown', (event) => {
            if (!settingsPanel || settingsPanel.hidden) return;
            if (settingsPanel.contains(event.target) || settingsButton?.contains(event.target)) return;
            setSettingsOpen(false);
        }, true);
        document.addEventListener?.('keydown', (event) => {
            if (event.key === 'Escape') setSettingsOpen(false);
        });
        document.getElementById('mobile-reset-zoom-btn')?.addEventListener('click', resetZoom);
        document.getElementById('mobile-look-sensitivity')?.addEventListener('input', (event) => {
            state.sensitivity = THREE.MathUtils.clamp(Number(event.target.value) || 1, 0.5, 1.8);
            persistPreferences();
        });
        document.getElementById('mobile-left-handed')?.addEventListener('change', (event) => {
            state.leftHanded = Boolean(event.target.checked);
            persistPreferences();
            updateInterface();
        });
        updateInterface();
    }

    restorePreferences();
    globalScope.mallMobileControls = Object.freeze({
        bind: bindInterface,
        isAutoForwardActive: () => state.autoForward,
        setAutoForward,
        stopAutoForward: () => setAutoForward(false),
        resetZoom
    });
})(window);
