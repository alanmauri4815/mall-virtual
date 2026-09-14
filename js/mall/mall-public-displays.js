        // --- PANELES PUBLICOS ADMINISTRABLES (PRUEBA PILOTO) ---
        (() => {
            // v2 invalida la prueba inicial, que estaba asociada por error al local FO-02.
            const STORAGE_KEY = 'mall-public-display-corridor-o102-v2';
            const MAX_IMAGE_SIDE = 1280;
            const DEFAULT_WIDTH = 8;
            const DEFAULT_HEIGHT = 4.5;
            const TOP_WALL_MARGIN = 0.15;
            const posterMeshes = new Map();
            const runtime = window.mallPublicDisplayRuntime;
            const displayRaycaster = new THREE.Raycaster();
            const displayMouse = new THREE.Vector2();
            let selectedPlacement = null;
            let selectedFile = null;

            if (!runtime?.scene || !runtime?.camera || !runtime?.renderer) {
                console.warn('[PublicDisplay] El motor 3D todavia no esta disponible.');
                return;
            }

            const isAuthorizedAdmin = () => Boolean(window.mallCanManagePublicDisplays?.());

            function ensureModal() {
                let modal = document.getElementById('public-display-modal');
                if (modal) return modal;
                modal = document.createElement('div');
                modal.id = 'public-display-modal';
                modal.className = 'public-display-modal';
                modal.setAttribute('aria-hidden', 'true');
                modal.innerHTML = `
                    <div class="public-display-dialog" role="dialog" aria-modal="true" aria-labelledby="public-display-title">
                        <button type="button" class="public-display-close" aria-label="Cerrar">&times;</button>
                        <div class="public-display-eyebrow">Espacio público piloto</div>
                        <h2 id="public-display-title">Publicar imagen en el muro</h2>
                        <p id="public-display-surface-label" class="public-display-copy"></p>
                        <label class="public-display-file">
                            <span>Seleccionar imagen</span>
                            <input id="public-display-file-input" type="file" accept="image/png,image/jpeg,image/webp" required>
                        </label>
                        <div class="public-display-preview-wrap">
                            <img id="public-display-preview" alt="Vista previa de la imagen pública">
                            <span id="public-display-preview-empty">La vista previa aparecerá aquí</span>
                        </div>
                        <div class="public-display-fields">
                            <label>Ancho (m)<input id="public-display-width" type="number" min="1" max="14" step="0.1" value="8"></label>
                            <label>Alto (m)<input id="public-display-height" type="number" min="1" max="5" step="0.1" value="4.5"></label>
                        </div>
                        <p id="public-display-status" class="public-display-status">Solo será visible por la cara seleccionada.</p>
                        <div class="public-display-actions">
                            <button type="button" class="public-display-secondary" data-public-display-action="cancel">Cancelar</button>
                            <button type="button" class="public-display-primary" data-public-display-action="publish">Publicar imagen</button>
                        </div>
                    </div>`;
                document.body.appendChild(modal);

                const close = () => {
                    modal.classList.remove('is-open');
                    modal.setAttribute('aria-hidden', 'true');
                    selectedFile = null;
                    const input = document.getElementById('public-display-file-input');
                    if (input) input.value = '';
                };
                modal.querySelector('.public-display-close').addEventListener('click', close);
                modal.querySelector('[data-public-display-action="cancel"]').addEventListener('click', close);
                modal.addEventListener('pointerdown', (event) => {
                    if (event.target === modal) close();
                });
                modal.querySelector('#public-display-file-input').addEventListener('change', (event) => {
                    selectedFile = event.target.files?.[0] || null;
                    const preview = document.getElementById('public-display-preview');
                    const empty = document.getElementById('public-display-preview-empty');
                    if (!selectedFile) {
                        preview.removeAttribute('src');
                        empty.style.display = 'block';
                        return;
                    }
                    preview.src = URL.createObjectURL(selectedFile);
                    preview.onload = () => URL.revokeObjectURL(preview.src);
                    empty.style.display = 'none';
                });
                modal.querySelector('[data-public-display-action="publish"]').addEventListener('click', publishSelectedImage);
                return modal;
            }

            function setStatus(message, tone = '') {
                const status = document.getElementById('public-display-status');
                if (!status) return;
                status.textContent = message;
                status.dataset.tone = tone;
            }

            async function optimizeImage(file) {
                const bitmap = await createImageBitmap(file);
                const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(bitmap.width * scale));
                canvas.height = Math.max(1, Math.round(bitmap.height * scale));
                const context = canvas.getContext('2d', { alpha: true });
                context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                bitmap.close?.();
                return canvas.toDataURL('image/webp', 0.82);
            }

            function createPoster(record) {
                const existing = posterMeshes.get(record.id);
                if (existing) {
                    existing.parent?.remove(existing);
                    existing.geometry?.dispose?.();
                    existing.material?.map?.dispose?.();
                    existing.material?.dispose?.();
                }
                const texture = new THREE.TextureLoader().load(record.imageDataUrl);
                texture.colorSpace = THREE.SRGBColorSpace;
                const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    side: THREE.FrontSide,
                    depthWrite: true,
                    polygonOffset: true,
                    polygonOffsetFactor: -2,
                    polygonOffsetUnits: -2
                });
                const poster = new THREE.Mesh(new THREE.PlaneGeometry(record.width, record.height), material);
                poster.name = `public-poster-${record.id}`;
                poster.position.fromArray(record.position);
                const surface = (window.mallPublicDisplaySurfaces || []).find(
                    (candidate) => candidate.userData.publicDisplayId === record.surfaceId
                );
                if (surface) {
                    surface.updateWorldMatrix(true, false);
                    const surfaceBounds = new THREE.Box3().setFromObject(surface);
                    poster.position.y = surfaceBounds.max.y - TOP_WALL_MARGIN - record.height / 2;
                }
                poster.quaternion.fromArray(record.quaternion);
                poster.renderOrder = 12;
                poster.userData.isPublicDisplayPoster = true;
                poster.userData.publicDisplayId = record.surfaceId;
                runtime.scene.add(poster);
                posterMeshes.set(record.id, poster);
            }

            function saveRecord(record) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
                createPoster(record);
            }

            function loadSavedRecord() {
                try {
                    const record = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
                    if (record?.imageDataUrl && Array.isArray(record.position) && Array.isArray(record.quaternion)) {
                        createPoster(record);
                    }
                } catch (error) {
                    console.warn('[PublicDisplay] No se pudo restaurar la prueba local.', error);
                }
            }

            async function publishSelectedImage() {
                if (!isAuthorizedAdmin() || !selectedPlacement) return;
                if (!selectedFile) {
                    setStatus('Selecciona una imagen antes de publicar.', 'error');
                    return;
                }
                const width = THREE.MathUtils.clamp(Number(document.getElementById('public-display-width').value) || DEFAULT_WIDTH, 1, 14);
                const height = THREE.MathUtils.clamp(Number(document.getElementById('public-display-height').value) || DEFAULT_HEIGHT, 1, 5);
                setStatus('Optimizando y colocando la imagen…');
                try {
                    const imageDataUrl = await optimizeImage(selectedFile);
                    const record = {
                        id: 'public-display-pilot-01',
                        surfaceId: selectedPlacement.surfaceId,
                        imageDataUrl,
                        width,
                        height,
                        position: selectedPlacement.position,
                        quaternion: selectedPlacement.quaternion,
                        updatedAt: new Date().toISOString()
                    };
                    saveRecord(record);
                    setStatus('Imagen publicada correctamente.', 'success');
                    setTimeout(() => {
                        const modal = document.getElementById('public-display-modal');
                        modal?.classList.remove('is-open');
                        modal?.setAttribute('aria-hidden', 'true');
                    }, 650);
                } catch (error) {
                    console.error('[PublicDisplay] Error al procesar la imagen.', error);
                    setStatus(error?.message || 'No se pudo procesar la imagen.', 'error');
                }
            }

            function openForIntersection(intersection) {
                const surface = intersection.object;
                const normal = intersection.face.normal.clone().transformDirection(surface.matrixWorld).normalize();
                const position = intersection.point.clone().addScaledVector(normal, 0.012);
                const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
                selectedPlacement = {
                    surfaceId: surface.userData.publicDisplayId,
                    position: position.toArray(),
                    quaternion: quaternion.toArray()
                };
                const modal = ensureModal();
                document.getElementById('public-display-surface-label').textContent = surface.userData.publicDisplayLabel || 'Muro habilitado';
                document.getElementById('public-display-width').value = DEFAULT_WIDTH;
                document.getElementById('public-display-height').value = DEFAULT_HEIGHT;
                document.getElementById('public-display-preview').removeAttribute('src');
                document.getElementById('public-display-preview-empty').style.display = 'block';
                setStatus('Solo será visible por la cara seleccionada.');
                modal.classList.add('is-open');
                modal.setAttribute('aria-hidden', 'false');
            }

            function handleDoubleClick(event) {
                if (!isAuthorizedAdmin()) return;
                const surfaces = Array.isArray(window.mallPublicDisplaySurfaces) ? window.mallPublicDisplaySurfaces : [];
                if (!surfaces.length) return;
                const rect = runtime.renderer.domElement.getBoundingClientRect();
                displayMouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                displayMouse.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
                displayRaycaster.setFromCamera(displayMouse, runtime.camera);
                const intersections = displayRaycaster.intersectObjects(surfaces, false);
                if (!intersections.length) return;
                event.preventDefault();
                event.stopPropagation();
                window.mallMobileControls?.stopAutoForward?.();
                openForIntersection(intersections[0]);
            }

            ensureModal();
            runtime.renderer.domElement.addEventListener('dblclick', handleDoubleClick);
            loadSavedRecord();
            window.mallPublicDisplayPilot = { loadSavedRecord };
        })();
