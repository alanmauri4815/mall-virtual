        // Editor no destructivo de infraestructura secundaria para administradores.
        (() => {
            const registry = new Map();
            const pendingOverrides = new Map();
            const persistenceChains = new Map();
            const LEGACY_STORAGE_KEY = 'mall-object-overrides-v1';
            const STORAGE_KEY = window.mallContext?.storageKey(LEGACY_STORAGE_KEY) || LEGACY_STORAGE_KEY;
            const DELETION_RECOVERY_KEY = window.mallContext?.storageKey('mall-object-deletion-recovery-20260815') || 'mall-object-deletion-recovery-20260815';
            const CUSTOM_FURNITURE_TYPES = Object.freeze({
                bench: 'Banca',
                shelf: 'Estantería',
                shelfLong: 'Estante largo lateral',
                shelfShort: 'Estante corto de fondo',
                counter: 'Mostrador',
                table: 'Mesa',
                display: 'Vitrina',
                goldenBalloon: 'Globo dorado · descuento',
                pictureFrameSmall: 'Marco de imagen · pequeño',
                pictureFrameMedium: 'Marco de imagen · mediano',
                pictureFrameLarge: 'Marco de imagen · grande'
            });
            const PICTURE_FRAME_PRESETS = Object.freeze({
                pictureFrameSmall: Object.freeze({ size: 'small', width: 1.4, height: 0.9, border: 0.07 }),
                pictureFrameMedium: Object.freeze({ size: 'medium', width: 3.0, height: 1.8, border: 0.11 }),
                pictureFrameLarge: Object.freeze({ size: 'large', width: 6.0, height: 3.4, border: 0.16 })
            });
            const PICTURE_FRAME_BUCKET = 'mall-public-media';
            const MAX_PICTURE_IMAGE_SIDE = 1920;
            const POSITION_GRID_STEP = 0.25;
            const ROTATION_GRID_DEGREES = 15;
            const MAGNET_DISTANCE = 0.3;
            const MAGNET_RELEASE_WINDOW_MS = 3000;
            const FLOOR_GRID_ORIGINS = Object.freeze([0, 5.3]);
            const GOLDEN_BALLOON_FLOAT_HEIGHT = 2.55;
            let createFormDraft = {
                kind: 'bench',
                promotionCode: '',
                promotionReward: 'Descuento especial',
                promotionEnds: ''
            };
            let selectedEntry = null;
            const magnetReleaseArming = new Map();
            const detachedMagnetEntries = new Set();
            let databaseReady = false;

            const canEdit = () => Boolean(window.mallCanEditInfrastructure?.());
            const round = (value) => Number(Number(value).toFixed(4));
            const nearestFloorOrigin = (worldY) => FLOOR_GRID_ORIGINS.reduce((nearest, origin) => (
                Math.abs(worldY - origin) < Math.abs(worldY - nearest) ? origin : nearest
            ), FLOOR_GRID_ORIGINS[0]);
            const gridOriginForAxis = (axis, worldPosition) => axis === 'y'
                ? nearestFloorOrigin(worldPosition.y)
                : 0;
            const snapToGrid = (value, origin = 0) => round(
                origin + Math.round((value - origin) / POSITION_GRID_STEP) * POSITION_GRID_STEP
            );
            const nextGridValue = (value, direction, origin = 0) => {
                const relative = (value - origin) / POSITION_GRID_STEP;
                const epsilon = 1e-7;
                const gridIndex = direction > 0
                    ? Math.floor(relative + epsilon) + 1
                    : Math.ceil(relative - epsilon) - 1;
                return round(origin + gridIndex * POSITION_GRID_STEP);
            };
            const normalizeDegrees = (degrees) => ((degrees % 360) + 360) % 360;
            const nextRotationDegrees = (radians, direction) => {
                const degrees = normalizeDegrees(THREE.MathUtils.radToDeg(radians));
                const epsilon = 1e-7;
                const stepIndex = direction > 0
                    ? Math.floor(degrees / ROTATION_GRID_DEGREES + epsilon) + 1
                    : Math.ceil(degrees / ROTATION_GRID_DEGREES - epsilon) - 1;
                return normalizeDegrees(stepIndex * ROTATION_GRID_DEGREES);
            };
            const readLocalOverrides = () => {
                try {
                    const stored = localStorage.getItem(STORAGE_KEY);
                    if (stored) return JSON.parse(stored);
                    if (window.mallContext?.isDefault) {
                        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
                        if (legacy) {
                            localStorage.setItem(STORAGE_KEY, legacy);
                            return JSON.parse(legacy);
                        }
                    }
                }
                catch (_) { return {}; }
                return {};
            };
            const recoverDeletedLocalOverrides = () => {
                if (localStorage.getItem(DELETION_RECOVERY_KEY) === 'complete') return;
                const local = readLocalOverrides();
                let changed = false;
                Object.values(local).forEach((transform) => {
                    if (transform?.deleted !== true) return;
                    transform.deleted = false;
                    transform.visible = true;
                    changed = true;
                });
                if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
            };
            recoverDeletedLocalOverrides();
            const captureTransform = (object) => {
                object.updateWorldMatrix(true, false);
                const position = new THREE.Vector3();
                const quaternion = new THREE.Quaternion();
                const scale = new THREE.Vector3();
                object.matrixWorld.decompose(position, quaternion, scale);
                const rotationOrder = object.rotation.order || 'XYZ';
                const rotation = new THREE.Euler(0, 0, 0, rotationOrder)
                    .setFromQuaternion(quaternion, rotationOrder);
                return {
                    position: position.toArray().map(round),
                    rotation: [rotation.x, rotation.y, rotation.z].map(round),
                    scale: scale.toArray().map(round),
                    visible: object.visible !== false,
                    coordinateSpace: 'world',
                    transformVersion: 2,
                    rotationOrder
                };
            };
            const createFurnitureMaterial = (color, options = {}) => new THREE.MeshStandardMaterial({
                color,
                roughness: options.roughness ?? 0.72,
                metalness: options.metalness ?? 0.04,
                transparent: options.transparent === true,
                opacity: options.opacity ?? 1
            });
            const addFurniturePart = (group, name, size, position, material) => {
                const geometry = window.getMallBoxGeometry
                    ? window.getMallBoxGeometry(size[0], size[1], size[2])
                    : new THREE.BoxGeometry(size[0], size[1], size[2]);
                const part = new THREE.Mesh(geometry, material);
                part.name = name;
                part.position.set(...position);
                group.add(part);
                return part;
            };
            const isPictureFrameKind = (kind) => Boolean(PICTURE_FRAME_PRESETS[kind]);
            const applyPictureFrameImage = (group, imageUrl = '') => {
                const image = group?.getObjectByName?.('imagen-marco');
                if (!image?.material) return;
                const cleanUrl = String(imageUrl || '').trim();
                const previousMap = image.material.map;
                image.material.map = null;
                image.material.color.setHex(cleanUrl ? 0xffffff : 0x26231d);
                image.material.needsUpdate = true;
                previousMap?.dispose?.();
                if (!cleanUrl) return;
                new THREE.TextureLoader().load(cleanUrl, (texture) => {
                    if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
                    else if ('encoding' in texture && THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
                    texture.minFilter = THREE.LinearFilter;
                    image.material.map = texture;
                    image.material.color.setHex(0xffffff);
                    image.material.needsUpdate = true;
                }, undefined, (error) => {
                    console.warn('[Mall editor] No se pudo cargar la imagen del marco:', error);
                    image.material.color.setHex(0x26231d);
                    image.material.needsUpdate = true;
                });
            };
            const buildCustomFurniture = (kind) => {
                if (!CUSTOM_FURNITURE_TYPES[kind]) return null;
                const group = new THREE.Group();
                const pale = createFurnitureMaterial(0xd8d1c3);
                const wood = createFurnitureMaterial(0x8c7044, { roughness: 0.58 });
                const dark = createFurnitureMaterial(0x242424, { roughness: 0.45, metalness: 0.16 });
                const glass = createFurnitureMaterial(0xb8d9df, { transparent: true, opacity: 0.42, roughness: 0.12 });
                if (kind === 'bench') {
                    addFurniturePart(group, 'asiento', [2.4, 0.22, 0.72], [0, 0.58, 0], wood);
                    addFurniturePart(group, 'pata-izquierda', [0.18, 0.52, 0.58], [-0.88, 0.27, 0], dark);
                    addFurniturePart(group, 'pata-derecha', [0.18, 0.52, 0.58], [0.88, 0.27, 0], dark);
                } else if (kind === 'shelf' || kind === 'shelfLong' || kind === 'shelfShort') {
                    const width = kind === 'shelfLong' ? 5.8 : kind === 'shelfShort' ? 2.8 : 2.2;
                    const height = 2.3;
                    const sideX = (width - 0.16) / 2;
                    addFurniturePart(group, 'respaldo', [width, height, 0.1], [0, height / 2, -0.28], wood);
                    addFurniturePart(group, 'lateral-izquierdo', [0.16, height, 0.62], [-sideX, height / 2, 0], pale);
                    addFurniturePart(group, 'lateral-derecho', [0.16, height, 0.62], [sideX, height / 2, 0], pale);
                    [0.12, 0.82, 1.52, 2.22].forEach((y, index) => {
                        addFurniturePart(group, `repisa-${index + 1}`, [width, 0.12, 0.68], [0, y, 0], index === 3 ? wood : pale);
                    });
                } else if (kind === 'counter') {
                    addFurniturePart(group, 'cuerpo', [2.3, 1.02, 0.72], [0, 0.51, 0], pale);
                    addFurniturePart(group, 'cubierta', [2.5, 0.14, 0.9], [0, 1.09, 0], wood);
                    addFurniturePart(group, 'zócalo', [2.38, 0.12, 0.78], [0, 0.06, 0], dark);
                } else if (kind === 'table') {
                    addFurniturePart(group, 'cubierta', [1.65, 0.14, 1.05], [0, 0.84, 0], wood);
                    [[-0.62, -0.34], [0.62, -0.34], [-0.62, 0.34], [0.62, 0.34]].forEach(([x, z], index) => {
                        addFurniturePart(group, `pata-${index + 1}`, [0.13, 0.82, 0.13], [x, 0.41, z], dark);
                    });
                } else if (kind === 'display') {
                    addFurniturePart(group, 'base', [2.0, 0.68, 0.72], [0, 0.34, 0], pale);
                    addFurniturePart(group, 'vidrio-frontal', [1.92, 0.78, 0.06], [0, 1.05, 0.33], glass);
                    addFurniturePart(group, 'vidrio-trasero', [1.92, 0.78, 0.06], [0, 1.05, -0.33], glass);
                    addFurniturePart(group, 'cubierta', [2.08, 0.11, 0.78], [0, 1.48, 0], wood);
                } else if (kind === 'goldenBalloon') {
                    const gold = createFurnitureMaterial(0xd8ad3f, { roughness: 0.22, metalness: 0.72 });
                    gold.emissive.setHex(0x5a3b05);
                    gold.emissiveIntensity = 0.42;
                    const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.48, 24, 18), gold);
                    balloon.name = 'globo-dorado';
                    balloon.scale.y = 1.16;
                    group.add(balloon);
                    const tie = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 4), gold);
                    tie.name = 'nudo-globo-dorado';
                    tie.rotation.z = Math.PI;
                    tie.position.y = -0.62;
                    group.add(tie);
                    const string = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.012, 0.012, 1.2, 8),
                        new THREE.MeshBasicMaterial({ color: 0xc5a059 })
                    );
                    string.name = 'hilo-globo-dorado';
                    string.position.y = -1.28;
                    group.add(string);
                    group.userData.isPromotionCollectible = true;
                } else if (isPictureFrameKind(kind)) {
                    const preset = PICTURE_FRAME_PRESETS[kind];
                    const imageWidth = preset.width - preset.border * 2;
                    const imageHeight = preset.height - preset.border * 2;
                    const frame = createFurnitureMaterial(0xb58a3a, { roughness: 0.38, metalness: 0.32 });
                    const imageMaterial = new THREE.MeshBasicMaterial({ color: 0x26231d, side: THREE.FrontSide });
                    addFurniturePart(group, 'respaldo-marco', [preset.width, preset.height, 0.08], [0, preset.height / 2, 0], dark);
                    addFurniturePart(group, 'marco-superior', [preset.width, preset.border, 0.14], [0, preset.height - preset.border / 2, 0.04], frame);
                    addFurniturePart(group, 'marco-inferior', [preset.width, preset.border, 0.14], [0, preset.border / 2, 0.04], frame);
                    addFurniturePart(group, 'marco-izquierdo', [preset.border, imageHeight, 0.14], [-(preset.width - preset.border) / 2, preset.height / 2, 0.04], frame);
                    addFurniturePart(group, 'marco-derecho', [preset.border, imageHeight, 0.14], [(preset.width - preset.border) / 2, preset.height / 2, 0.04], frame);
                    const image = new THREE.Mesh(new THREE.PlaneGeometry(imageWidth, imageHeight), imageMaterial);
                    image.name = 'imagen-marco';
                    image.position.set(0, preset.height / 2, 0.081);
                    image.renderOrder = 13;
                    group.add(image);
                }
                group.userData.mallCustomFurniture = true;
                group.userData.mallFurnitureKind = kind;
                group.userData.mallPictureFrameSize = PICTURE_FRAME_PRESETS[kind]?.size || '';
                return group;
            };
            const getFurnitureSpawnTransform = () => {
                const direction = new THREE.Vector3();
                camera.getWorldDirection(direction);
                direction.y = 0;
                if (direction.lengthSq() < 0.001) direction.set(0, 0, -1);
                direction.normalize();
                const position = camera.position.clone().addScaledVector(direction, 3.2);
                position.y = camera.position.y > 3 ? 5.3 : 0;
                return {
                    position,
                    rotationY: Math.atan2(-direction.x, -direction.z)
                };
            };
            const normalizeGoldenBalloonPosition = (entry) => {
                if (entry?.furnitureKind !== 'goldenBalloon' || !entry.object) return;
                const floorY = entry.object.position.y > 3 ? 5.3 : 0;
                if (entry.object.position.y < floorY + 1.15) {
                    entry.object.position.y = floorY + GOLDEN_BALLOON_FLOAT_HEIGHT;
                }
            };
            const createCustomFurniture = (kind, options = {}) => {
                if (!CUSTOM_FURNITURE_TYPES[kind]) return null;
                const id = String(options.id || `furniture:custom:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
                if (registry.has(id)) return registry.get(id);
                const object = buildCustomFurniture(kind);
                if (!object) return null;
                const label = options.label || `${CUSTOM_FURNITURE_TYPES[kind]} agregada`;
                object.name = id;
                scene.add(object);
                if (options.transform) {
                    if (Array.isArray(options.transform.position)) object.position.fromArray(options.transform.position);
                    if (Array.isArray(options.transform.rotation)) object.rotation.set(...options.transform.rotation);
                    if (Array.isArray(options.transform.scale)) object.scale.fromArray(options.transform.scale);
                } else {
                    const spawn = getFurnitureSpawnTransform();
                    spawn.position.x = snapToGrid(spawn.position.x);
                    spawn.position.z = snapToGrid(spawn.position.z);
                    object.position.copy(spawn.position);
                    if (kind === 'goldenBalloon') {
                        object.position.y += GOLDEN_BALLOON_FLOAT_HEIGHT;
                    }
                    object.rotation.y = THREE.MathUtils.degToRad(
                        normalizeDegrees(Math.round(THREE.MathUtils.radToDeg(spawn.rotationY) / ROTATION_GRID_DEGREES) * ROTATION_GRID_DEGREES)
                    );
                }
                object.updateWorldMatrix(true, true);
                const entry = window.registerMallEditableObject(object, {
                    id,
                    type: 'furniture',
                    deletable: true,
                    structuralCritical: false,
                    label,
                    areaCode: options.areaCode || 'ADMIN-CUSTOM'
                });
                if (!entry) return null;
                entry.customCreated = true;
                entry.furnitureKind = kind;
                entry.promotionId = String(options.promotionId || '').trim() || null;
                entry.pictureFrameSize = PICTURE_FRAME_PRESETS[kind]?.size || null;
                entry.pictureImageUrl = String(options.pictureImageUrl || '').trim() || null;
                normalizeGoldenBalloonPosition(entry);
                object.userData.mallCustomFurniture = true;
                object.userData.mallFurnitureKind = kind;
                object.userData.isPromotionCollectible = kind === 'goldenBalloon';
                object.userData.promotionId = entry.promotionId || '';
                object.userData.mallPictureFrameSize = entry.pictureFrameSize;
                object.userData.mallPictureImageUrl = entry.pictureImageUrl;
                if (isPictureFrameKind(kind)) applyPictureFrameImage(object, entry.pictureImageUrl);
                window.mallEditableCollision?.rebuild(object, id);
                return entry;
            };
            const applyWorldTransform = (object, transform) => {
                const rotationOrder = transform.rotationOrder || 'XYZ';
                const worldPosition = new THREE.Vector3().fromArray(transform.position);
                const worldRotation = new THREE.Euler(
                    transform.rotation[0],
                    transform.rotation[1],
                    transform.rotation[2],
                    rotationOrder
                );
                const worldQuaternion = new THREE.Quaternion().setFromEuler(worldRotation);
                const worldScale = new THREE.Vector3().fromArray(transform.scale);
                const worldMatrix = new THREE.Matrix4().compose(worldPosition, worldQuaternion, worldScale);
                const localMatrix = worldMatrix.clone();
                if (object.parent) {
                    object.parent.updateWorldMatrix(true, false);
                    localMatrix.premultiply(object.parent.matrixWorld.clone().invert());
                }
                object.rotation.order = rotationOrder;
                localMatrix.decompose(object.position, object.quaternion, object.scale);
                object.updateMatrix();
                object.matrixWorldNeedsUpdate = true;
            };
            const applyTransform = (entry, transform) => {
                if (!entry?.object || !transform) return;
                const { object } = entry;
                const blockedStructuralDeletion = transform.deleted === true
                    && (!entry.deletable || entry.structuralCritical);
                entry.deleted = transform.deleted === true && !blockedStructuralDeletion;
                if (entry.deleted) {
                    object.visible = false;
                    window.mallEditableCollision?.rebuild(object, entry.id);
                    if (object.parent) object.parent.remove(object);
                    return;
                }
                if (!object.parent && entry.originalParent) entry.originalParent.add(object);
                const completeTransform = Array.isArray(transform.position)
                    && Array.isArray(transform.rotation)
                    && Array.isArray(transform.scale);
                if (completeTransform && transform.coordinateSpace === 'world') {
                    applyWorldTransform(object, transform);
                } else {
                    if (Array.isArray(transform.position)) object.position.fromArray(transform.position);
                    if (Array.isArray(transform.rotation)) object.rotation.set(...transform.rotation);
                    if (Array.isArray(transform.scale)) object.scale.fromArray(transform.scale);
                }
                if (blockedStructuralDeletion) object.visible = true;
                else if (typeof transform.visible === 'boolean') object.visible = transform.visible;
                normalizeGoldenBalloonPosition(entry);
                object.updateWorldMatrix(true, true);
                window.mallEditableCollision?.rebuild(object, entry.id);
            };

            window.registerMallEditableObject = (object, metadata = {}) => {
                const id = String(metadata.id || object?.userData?.mallEditableId || '').trim();
                if (!object || !id || metadata.structuralCritical) return null;
                const type = metadata.type || 'object';
                const deletable = metadata.deletable === true || (
                    metadata.deletable !== false && (type === 'furniture' || type === 'bench')
                );
                const structuralCritical = metadata.structuralCritical === true || !deletable;
                object.userData.mallEditableId = id;
                object.userData.mallEditableType = type;
                object.userData.mallEditableLabel = metadata.label || object.name || id;
                object.userData.mallEditableAreaCode = metadata.areaCode || '';
                object.userData.mallEditableDeletable = deletable;
                object.userData.mallStructuralCritical = structuralCritical;
                const entry = {
                    id,
                    object,
                    type,
                    label: object.userData.mallEditableLabel,
                    areaCode: object.userData.mallEditableAreaCode,
                    deletable,
                    structuralCritical,
                    deleted: false,
                    originalParent: object.parent,
                    original: captureTransform(object)
                };
                registry.set(id, entry);
                const override = pendingOverrides.get(id) || readLocalOverrides()[id];
                if (override) applyTransform(entry, override);
                return entry;
            };

            const editableTypes = ['wall', 'furniture', 'bench'];
            const findEditableEntry = (object) => {
                let current = object;
                while (current) {
                    const namedId = /^(wall|furniture|bench):/.test(current.name || '') ? current.name : '';
                    const metadataId = String(current.userData?.mallEditableId || '').trim();
                    const id = String(namedId || metadataId).trim();
                    if (id) {
                        const registered = registry.get(id);
                        if (registered?.object === current) return registered;

                        const idType = id.split(':', 1)[0];
                        const declaredType = current.userData?.mallEditableType;
                        const inferredType = editableTypes.includes(idType)
                            ? idType
                            : (editableTypes.includes(declaredType) ? declaredType : '');
                        if (inferredType) {
                            return window.registerMallEditableObject(current, {
                                id,
                                type: inferredType,
                                label: current.userData?.mallEditableLabel || current.name || id,
                                areaCode: current.userData?.mallEditableAreaCode || '',
                                deletable: current.userData?.mallEditableDeletable === true,
                                structuralCritical: current.userData?.mallStructuralCritical === true
                            });
                        }
                    }
                    current = current.parent;
                }
                return null;
            };
            const selectEditableObject = (object) => {
                selectedEntry = findEditableEntry(object);
                setTimeout(() => renderEditor(databaseReady ? '' : 'Modo local disponible; sincronización pendiente.'), 0);
                return selectedEntry;
            };
            const escapeAttribute = (value) => String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            const findEditableIntersection = (intersections = []) => {
                for (const intersection of intersections) {
                    if (findEditableEntry(intersection?.object)) return intersection;
                }
                return null;
            };
            const renderEditor = (message = '') => {
                const previousEditor = document.getElementById('mall-object-editor');
                const previousCreateForm = previousEditor?.querySelector('.mall-object-editor__create');
                if (previousCreateForm) {
                    createFormDraft = {
                        kind: previousCreateForm.querySelector('[data-furniture-kind]')?.value || createFormDraft.kind,
                        promotionCode: previousCreateForm.querySelector('[data-promotion-code]')?.value || '',
                        promotionReward: previousCreateForm.querySelector('[data-promotion-reward]')?.value || 'Descuento especial',
                        promotionEnds: previousCreateForm.querySelector('[data-promotion-ends]')?.value || ''
                    };
                }
                previousEditor?.remove();
                if (!canEdit()) return;
                const host = document.getElementById('object-debug-panel');
                if (!host) return;
                const editor = document.createElement('div');
                editor.id = 'mall-object-editor';
                editor.className = 'mall-object-editor';
                const hiddenEntries = [...registry.values()].filter((entry) => !entry.deleted && entry.object.visible === false);
                const deletedEntries = [...registry.values()].filter((entry) => entry.deleted === true);
                const hiddenMarkup = hiddenEntries.length
                    ? `<div class="mall-object-editor__hidden"><strong>Objetos ocultos</strong>${hiddenEntries.map((entry) => `<button data-restore-id="${entry.id}">${entry.label}</button>`).join('')}</div>`
                    : '';
                const deletedMarkup = deletedEntries.length
                    ? `<div class="mall-object-editor__hidden"><strong>Papelera</strong>${deletedEntries.map((entry) => `<button data-undelete-id="${entry.id}">Recuperar ${entry.label}</button>`).join('')}</div>`
                    : '';
                const selectedFurnitureKind = String(createFormDraft.kind || 'bench');
                const createMarkup = `
                    <div class="mall-object-editor__create">
                        <strong>Agregar mobiliario</strong>
                        <div>
                            <select aria-label="Tipo de mueble" data-furniture-kind>
                                ${Object.entries(CUSTOM_FURNITURE_TYPES).map(([value, label]) => `<option value="${value}"${value === selectedFurnitureKind ? ' selected' : ''}>${label}</option>`).join('')}
                            </select>
                            <button type="button" data-create-furniture>Agregar</button>
                        </div>
                        <div class="mall-object-editor__promotion-fields" data-promotion-fields${selectedFurnitureKind === 'goldenBalloon' ? '' : ' hidden'}>
                            <label>Código de descuento <input type="text" data-promotion-code maxlength="64" placeholder="Ej.: MALL10" value="${escapeAttribute(createFormDraft.promotionCode)}"></label>
                            <label>Premio <input type="text" data-promotion-reward maxlength="140" value="${escapeAttribute(createFormDraft.promotionReward || 'Descuento especial')}"></label>
                            <label>Válido hasta <input type="date" data-promotion-ends value="${escapeAttribute(createFormDraft.promotionEnds)}"></label>
                            <small>El código se guarda protegido y sólo se entrega al miembro que encuentre el globo.</small>
                        </div>
                        <small>Aparecerá frente a ti y quedará seleccionado.</small>
                    </div>`;
                if (!selectedEntry) {
                    editor.innerHTML = `${createMarkup}<div class="mall-object-editor__status">${message || 'Selecciona un muro, mueble o banca registrada.'}</div>${hiddenMarkup}${deletedMarkup}`;
                    editor.addEventListener('click', handleEditorAction);
                    editor.addEventListener('change', handleEditorChange);
                    host.appendChild(editor);
                    return;
                }
                const deleteControl = selectedEntry.deletable && !selectedEntry.structuralCritical
                    ? '<button data-edit="delete" data-danger="true">Eliminar</button>'
                    : '<button type="button" disabled title="Sólo pueden eliminarse muebles, bancas y tabiquería no estructural.">Estructura protegida</button>';
                const pictureFrameControl = isPictureFrameKind(selectedEntry.furnitureKind)
                    ? `<label class="mall-object-editor__picture">
                        <strong>Imagen del marco</strong>
                        <span>${selectedEntry.pictureImageUrl ? 'Imagen cargada. Selecciona otra para reemplazarla.' : 'Sin imagen. Formatos JPG, PNG o WebP.'}</span>
                        <input type="file" accept="image/jpeg,image/png,image/webp" data-picture-frame-file>
                    </label>`
                    : '';
                editor.innerHTML = `
                    ${createMarkup}
                    <div class="mall-object-editor__status"><strong>${selectedEntry.label}</strong><br>${selectedEntry.id} · ${selectedEntry.type}${selectedEntry.deletable ? ' · eliminable' : ' · protegida'}</div>
                    <div class="mall-object-editor__alignment">Retícula mundial: 0,25 m · Giro: 15° · ${detachedMagnetEntries.has(selectedEntry.id) ? 'Imán liberado para este mueble · Restaurar lo vuelve a activar.' : 'Imán de bordes activo · Repite la misma flecha antes de 3 s o usa “Despegar imán”.'}</div>
                    ${pictureFrameControl}
                    <div class="mall-object-editor__grid">
                        <button data-edit="x-">X -</button><button data-edit="y+">Y +</button><button data-edit="x+">X +</button>
                        <button data-edit="z-">Z -</button><button data-edit="y-">Y -</button><button data-edit="z+">Z +</button>
                        <button data-edit="rot-">Girar -</button><button data-edit="restore">Restaurar</button><button data-edit="rot+">Girar +</button>
                        <button data-edit="hide">Ocultar</button><button data-edit="detach">Despegar imán</button>${deleteControl}<button data-edit="save">Guardar</button>
                    </div>
                    <div class="mall-object-editor__message">${message}</div>${hiddenMarkup}${deletedMarkup}`;
                editor.addEventListener('click', handleEditorAction);
                editor.addEventListener('change', handleEditorChange);
                host.appendChild(editor);
            };
            const setWorldPosition = (object, worldPosition) => {
                if (object.parent) {
                    object.parent.updateWorldMatrix(true, false);
                    object.position.copy(object.parent.worldToLocal(worldPosition));
                } else {
                    object.position.copy(worldPosition);
                }
            };
            const rangesOverlap = (minA, maxA, minB, maxB, margin = 0.04) => (
                Math.min(maxA, maxB) - Math.max(minA, minB) > margin
            );
            const applyMagneticAlignment = (entry, axis) => {
                const object = entry?.object;
                if (!object) return false;
                if (detachedMagnetEntries.has(entry.id)) return null;
                object.updateWorldMatrix(true, true);
                const movingBox = new THREE.Box3().setFromObject(object);
                if (movingBox.isEmpty()) return false;
                const perpendicularAxis = axis === 'x' ? 'z' : axis === 'z' ? 'x' : null;
                if (!perpendicularAxis) return false;
                let bestDelta = null;
                registry.forEach((candidate) => {
                    if (!candidate?.object || candidate === entry || candidate.deleted || candidate.object.visible === false || !candidate.object.parent) return;
                    candidate.object.updateWorldMatrix(true, true);
                    const candidateBox = new THREE.Box3().setFromObject(candidate.object);
                    if (candidateBox.isEmpty()) return;
                    if (!rangesOverlap(movingBox.min.y, movingBox.max.y, candidateBox.min.y, candidateBox.max.y)) return;
                    if (!rangesOverlap(
                        movingBox.min[perpendicularAxis], movingBox.max[perpendicularAxis],
                        candidateBox.min[perpendicularAxis], candidateBox.max[perpendicularAxis]
                    )) return;
                    const deltas = [
                        candidateBox.min[axis] - movingBox.max[axis],
                        candidateBox.max[axis] - movingBox.min[axis]
                    ];
                    deltas.forEach((delta) => {
                        if (Math.abs(delta) > MAGNET_DISTANCE) return;
                        if (bestDelta === null || Math.abs(delta) < Math.abs(bestDelta)) bestDelta = delta;
                    });
                });
                if (bestDelta === null) return null;
                const worldPosition = object.getWorldPosition(new THREE.Vector3());
                worldPosition[axis] += bestDelta;
                setWorldPosition(object, worldPosition);
                return { releaseDirection: -Math.sign(bestDelta) };
            };
            const moveOnWorldGrid = (entry, axis, direction) => {
                const object = entry?.object;
                if (!object) return null;
                const now = Date.now();
                const armedRelease = magnetReleaseArming.get(entry.id);
                const releaseRequested = Boolean(
                    armedRelease
                    && armedRelease.axis === axis
                    && armedRelease.direction === direction
                    && now - armedRelease.armedAt <= MAGNET_RELEASE_WINDOW_MS
                );
                const worldPosition = object.getWorldPosition(new THREE.Vector3());
                const origin = gridOriginForAxis(axis, worldPosition);
                worldPosition[axis] = nextGridValue(worldPosition[axis], direction, origin);
                setWorldPosition(object, worldPosition);
                if (axis !== 'x' && axis !== 'z') {
                    magnetReleaseArming.delete(entry.id);
                    return null;
                }
                if (releaseRequested) {
                    detachedMagnetEntries.add(entry.id);
                    magnetReleaseArming.delete(entry.id);
                    return { detached: true };
                }
                const magneticResult = applyMagneticAlignment(entry, axis);
                if (magneticResult?.releaseDirection === direction) {
                    magnetReleaseArming.set(entry.id, { axis, direction, armedAt: now });
                    return { armed: true };
                }
                magnetReleaseArming.delete(entry.id);
                return null;
            };
            const mutateSelected = (action) => {
                if (!selectedEntry || !canEdit()) return;
                const object = selectedEntry.object;
                let movementResult = null;
                if (action === 'x-') movementResult = moveOnWorldGrid(selectedEntry, 'x', -1);
                if (action === 'x+') movementResult = moveOnWorldGrid(selectedEntry, 'x', 1);
                if (action === 'y-') movementResult = moveOnWorldGrid(selectedEntry, 'y', -1);
                if (action === 'y+') movementResult = moveOnWorldGrid(selectedEntry, 'y', 1);
                if (action === 'z-') movementResult = moveOnWorldGrid(selectedEntry, 'z', -1);
                if (action === 'z+') movementResult = moveOnWorldGrid(selectedEntry, 'z', 1);
                if (action === 'rot-') object.rotation.y = THREE.MathUtils.degToRad(nextRotationDegrees(object.rotation.y, -1));
                if (action === 'rot+') object.rotation.y = THREE.MathUtils.degToRad(nextRotationDegrees(object.rotation.y, 1));
                if (action === 'detach') {
                    detachedMagnetEntries.add(selectedEntry.id);
                    magnetReleaseArming.delete(selectedEntry.id);
                }
                if (action === 'hide') object.visible = false;
                if (action === 'restore') {
                    detachedMagnetEntries.delete(selectedEntry.id);
                    applyTransform(selectedEntry, selectedEntry.original);
                }
                if (action === 'hide' || action === 'restore') magnetReleaseArming.delete(selectedEntry.id);
                object.updateWorldMatrix(true, true);
                window.mallEditableCollision?.rebuild(object, selectedEntry.id);
                if (movementResult?.armed) return 'Imán activo: repite la misma flecha antes de 3 s para despegarlo.';
                if (movementResult?.detached) return 'Imán liberado: el objeto ya se separó y conserva la retícula de 0,25 m.';
                if (action === 'detach') return 'Imán liberado para este mueble. Puedes moverlo sin que vuelva a pegarse a los bordes.';
                return null;
            };
            const getSupabaseClient = () => {
                try { return window.supabaseClient || supabaseClient || null; }
                catch (_) { return null; }
            };
            const scopeQuery = (query) => window.mallContext?.scopeQuery
                ? window.mallContext.scopeQuery(query)
                : query;
            const scopePayload = (payload) => window.mallContext?.scopePayload
                ? window.mallContext.scopePayload(payload)
                : payload;
            const persistEntry = async (entry) => {
                if (!entry || !canEdit()) return false;
                const transform = {
                    ...captureTransform(entry.object),
                    deleted: entry.deleted === true,
                    customCreated: entry.customCreated === true,
                    furnitureKind: entry.furnitureKind || null,
                    promotionId: entry.promotionId || null,
                    pictureFrameSize: entry.pictureFrameSize || null,
                    pictureImageUrl: entry.pictureImageUrl || null,
                    label: entry.label,
                    areaCode: entry.areaCode || '',
                    savedAt: new Date().toISOString()
                };
                const local = readLocalOverrides();
                local[entry.id] = transform;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
                pendingOverrides.set(entry.id, transform);
                const client = getSupabaseClient();
                if (!client) return false;
                const previousSave = persistenceChains.get(entry.id) || Promise.resolve();
                const queuedSave = previousSave.catch(() => {}).then(async () => {
                    const { error: catalogError } = await client.from('mall_editable_objects').upsert(scopePayload({
                        object_id: entry.id,
                        object_type: entry.type,
                        area_code: entry.areaCode || null,
                        label: entry.label,
                        editable: true,
                        structural_critical: entry.structuralCritical === true,
                        metadata: {
                            deleted: transform.deleted,
                            deletable: entry.deletable === true,
                            customCreated: entry.customCreated === true,
                            furnitureKind: entry.furnitureKind || null,
                            promotionId: entry.promotionId || null,
                            pictureFrameSize: entry.pictureFrameSize || null,
                            pictureImageUrl: entry.pictureImageUrl || null,
                            coordinateSpace: transform.coordinateSpace,
                            transformVersion: transform.transformVersion,
                            rotationOrder: transform.rotationOrder
                        }
                    }), { onConflict: 'mall_id,object_id' });
                    if (catalogError) throw catalogError;
                    const { data: authData } = await client.auth.getUser();
                    const { error } = await client.from('mall_object_overrides').upsert(scopePayload({
                        object_id: entry.id,
                        position_x: transform.position[0], position_y: transform.position[1], position_z: transform.position[2],
                        rotation_x: transform.rotation[0], rotation_y: transform.rotation[1], rotation_z: transform.rotation[2],
                        scale_x: transform.scale[0], scale_y: transform.scale[1], scale_z: transform.scale[2],
                        visible: transform.visible,
                        collision_enabled: transform.visible,
                        updated_by: authData?.user?.id || null,
                        updated_at: transform.savedAt
                    }), { onConflict: 'mall_id,object_id' });
                    if (error) throw error;
                    if (entry.promotionId) {
                        const promotionUpdate = {
                            object_id: entry.id,
                            position_x: transform.position[0],
                            position_y: transform.position[1],
                            position_z: transform.position[2],
                            active: entry.deleted !== true
                        };
                        if (entry.deleted === true) promotionUpdate.status = 'cancelled';
                        const { error: promotionError } = await scopeQuery(client
                            .from('mall_promotions')
                            .update(promotionUpdate))
                            .eq('id', entry.promotionId);
                        if (promotionError) throw promotionError;
                    }
                    return true;
                });
                persistenceChains.set(entry.id, queuedSave);
                try {
                    return await queuedSave;
                } finally {
                    if (persistenceChains.get(entry.id) === queuedSave) persistenceChains.delete(entry.id);
                }
            };
            const persistSelected = () => persistEntry(selectedEntry);
            const optimizePictureFrameImage = async (file) => {
                if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type || '')) {
                    throw new Error('Selecciona una imagen JPG, PNG o WebP.');
                }
                const bitmap = await createImageBitmap(file);
                const scale = Math.min(1, MAX_PICTURE_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(bitmap.width * scale));
                canvas.height = Math.max(1, Math.round(bitmap.height * scale));
                const context = canvas.getContext('2d', { alpha: false });
                context.fillStyle = '#ffffff';
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                bitmap.close?.();
                return await new Promise((resolve, reject) => {
                    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se pudo optimizar la imagen.')), 'image/webp', 0.86);
                });
            };
            const uploadSelectedPictureFrameImage = async (file) => {
                if (!selectedEntry || !isPictureFrameKind(selectedEntry.furnitureKind) || !canEdit()) return;
                const entry = selectedEntry;
                renderEditor('Optimizando y subiendo imagen...');
                try {
                    const client = getSupabaseClient();
                    if (!client) throw new Error('Supabase no está disponible.');
                    const blob = await optimizePictureFrameImage(file);
                    const safeId = entry.id.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
                    const objectPath = `picture-frames/${safeId}.webp`;
                    const { error: uploadError } = await client.storage
                        .from(PICTURE_FRAME_BUCKET)
                        .upload(objectPath, blob, {
                            contentType: 'image/webp',
                            // The URL receives a version query after each overwrite.
                            cacheControl: '31536000',
                            upsert: true
                        });
                    if (uploadError) throw uploadError;
                    const { data } = client.storage.from(PICTURE_FRAME_BUCKET).getPublicUrl(objectPath);
                    entry.pictureImageUrl = `${data.publicUrl}?v=${Date.now()}`;
                    entry.object.userData.mallPictureImageUrl = entry.pictureImageUrl;
                    applyPictureFrameImage(entry.object, entry.pictureImageUrl);
                    const remote = await persistSelected();
                    renderEditor(remote ? 'Imagen publicada para todos los visitantes.' : 'Imagen cargada localmente; falta sincronizar el objeto.');
                } catch (error) {
                    console.warn('[Mall editor] No se pudo publicar la imagen del marco:', error);
                    renderEditor(error?.message || 'No se pudo publicar la imagen del marco.');
                }
            };
            const handleEditorChange = (event) => {
                const furnitureSelect = event.target.closest('select[data-furniture-kind]');
                if (furnitureSelect) {
                    const fields = furnitureSelect.closest('.mall-object-editor__create')?.querySelector('[data-promotion-fields]');
                    if (fields) fields.hidden = furnitureSelect.value !== 'goldenBalloon';
                }
                const input = event.target.closest('input[data-picture-frame-file]');
                if (!input?.files?.[0]) return;
                uploadSelectedPictureFrameImage(input.files[0]);
            };
            async function handleEditorAction(event) {
                const createButton = event.target.closest('button[data-create-furniture]');
                if (createButton && canEdit()) {
                    event.preventDefault();
                    event.stopPropagation();
                    const form = createButton.closest('.mall-object-editor__create');
                    const kind = form?.querySelector('[data-furniture-kind]')?.value;
                    const promotionCode = form?.querySelector('[data-promotion-code]')?.value?.trim() || '';
                    if (kind === 'goldenBalloon' && !promotionCode) {
                        renderEditor('Para crear un Globo dorado debes indicar el código de descuento.');
                        return;
                    }
                    const entry = createCustomFurniture(kind);
                    if (!entry) {
                        renderEditor('No se pudo crear el mueble seleccionado.');
                        return;
                    }
                    const discardCreatedEntry = () => {
                        entry.object.visible = false;
                        window.mallEditableCollision?.rebuild(entry.object, entry.id);
                        if (entry.object.parent) entry.object.parent.remove(entry.object);
                        registry.delete(entry.id);
                        pendingOverrides.delete(entry.id);
                    };
                    if (kind === 'goldenBalloon') {
                        const client = getSupabaseClient();
                        if (!client) {
                            discardCreatedEntry();
                            renderEditor('El globo quedó creado localmente, pero Supabase no está disponible para registrar el descuento.');
                            return;
                        }
                        renderEditor('Registrando el código y la posición del Globo dorado...');
                        const rewardLabel = form?.querySelector('[data-promotion-reward]')?.value?.trim() || 'Descuento especial';
                        const endsDate = form?.querySelector('[data-promotion-ends]')?.value || '';
                        const endsAt = endsDate ? `${endsDate}T23:59:59` : null;
                        const position = entry.object.getWorldPosition(new THREE.Vector3());
                        const { data: promotion, error: promotionError } = await client.from('mall_promotions').insert(scopePayload({
                            title: 'Encuentra el Globo Dorado',
                            description: 'Busca el Globo Dorado en el mall y tócalo para obtener tu código de descuento.',
                            promotion_type: 'golden_balloon',
                            reward_label: rewardLabel,
                            min_monthly_meters: 0,
                            starts_at: new Date().toISOString(),
                            ends_at: endsAt,
                            active: true,
                            status: 'placed',
                            max_claims: 1,
                            object_id: entry.id,
                            position_x: position.x,
                            position_y: position.y,
                            position_z: position.z
                        })).select('id').single();
                        if (promotionError) {
                            discardCreatedEntry();
                            renderEditor(`El globo se creó, pero no se registró la promoción: ${promotionError.message}`);
                            return;
                        }
                        const { error: codeError } = await client.from('mall_promotion_codes').insert(scopePayload({
                            promotion_id: promotion.id,
                            discount_code: promotionCode
                        }));
                        if (codeError) {
                            await scopeQuery(client.from('mall_promotions').delete()).eq('id', promotion.id);
                            discardCreatedEntry();
                            renderEditor(`No se pudo guardar el código de descuento: ${codeError.message}`);
                            return;
                        }
                        entry.promotionId = promotion.id;
                        entry.object.userData.promotionId = promotion.id;
                    }
                    selectedEntry = entry;
                    renderEditor('Mueble creado frente a ti. Puedes moverlo, girarlo y guardar los ajustes.');
                    try {
                        const remote = await persistSelected();
                        renderEditor(remote
                            ? 'Mueble creado y registrado. Ajusta su posición y pulsa Guardar.'
                            : 'Mueble creado localmente. Ajusta su posición y pulsa Guardar.');
                    } catch (error) {
                        console.warn('[Mall editor] No se pudo sincronizar el mueble nuevo:', error);
                        renderEditor('Mueble creado localmente; no se pudo sincronizar con Supabase.');
                    }
                    return;
                }
                const undeleteId = event.target.closest('button')?.dataset.undeleteId;
                if (undeleteId && canEdit()) {
                    event.preventDefault();
                    event.stopPropagation();
                    const entry = registry.get(undeleteId);
                    if (entry) {
                        detachedMagnetEntries.delete(undeleteId);
                        magnetReleaseArming.delete(undeleteId);
                        entry.deleted = false;
                        applyTransform(entry, entry.original);
                        selectedEntry = entry;
                        try {
                            const remote = await persistSelected();
                            renderEditor(remote ? 'Objeto recuperado para todos los visitantes.' : 'Objeto recuperado localmente.');
                        } catch (error) {
                            console.warn('[Mall editor] No se pudo sincronizar la recuperación:', error);
                            renderEditor('Objeto recuperado localmente; falta sincronizar con Supabase.');
                        }
                    }
                    return;
                }
                const restoreId = event.target.closest('button')?.dataset.restoreId;
                if (restoreId && canEdit()) {
                    event.preventDefault();
                    event.stopPropagation();
                    const entry = registry.get(restoreId);
                    if (entry) {
                        detachedMagnetEntries.delete(restoreId);
                        magnetReleaseArming.delete(restoreId);
                        applyTransform(entry, entry.original);
                        selectedEntry = entry;
                        renderEditor('Objeto recuperado; pulsa Guardar para publicar.');
                    }
                    return;
                }
                const action = event.target.closest('button')?.dataset.edit;
                if (!action) return;
                event.preventDefault();
                event.stopPropagation();
                if (action === 'save') {
                    renderEditor('Guardando...');
                    try {
                        const remote = await persistSelected();
                        renderEditor(remote ? 'Guardado para todos los visitantes.' : 'Guardado localmente. Falta aplicar el SQL de Supabase.');
                    } catch (error) {
                        console.warn('[Mall editor] No se pudo guardar en Supabase:', error);
                        renderEditor('Guardado localmente; falta aplicar o revisar el SQL.');
                    }
                    return;
                }
                if (action === 'delete') {
                    if (!selectedEntry.deletable || selectedEntry.structuralCritical) {
                        renderEditor('Eliminación bloqueada: sólo se permiten muebles, bancas y tabiquería no estructural identificada.');
                        return;
                    }
                    const confirmed = window.confirm(`Eliminar permanentemente “${selectedEntry.label}”? Esta acción retirará el objeto y su colisión del mall.`);
                    if (!confirmed) return;
                    const deletedEntry = selectedEntry;
                    detachedMagnetEntries.delete(deletedEntry.id);
                    magnetReleaseArming.delete(deletedEntry.id);
                    deletedEntry.deleted = true;
                    deletedEntry.object.visible = false;
                    window.mallEditableCollision?.rebuild(deletedEntry.object, deletedEntry.id);
                    if (deletedEntry.object.parent) deletedEntry.object.parent.remove(deletedEntry.object);
                    renderEditor('Eliminando...');
                    try {
                        const remote = await persistSelected();
                        selectedEntry = null;
                        renderEditor(remote
                            ? 'Objeto eliminado permanentemente para todos los visitantes.'
                            : 'Objeto eliminado en este equipo. Falta sincronizar con Supabase.');
                    } catch (error) {
                        console.warn('[Mall editor] No se pudo sincronizar la eliminación:', error);
                        selectedEntry = null;
                        renderEditor('Objeto eliminado localmente; no se pudo sincronizar con Supabase.');
                    }
                    return;
                }
                const movementMessage = mutateSelected(action);
                renderEditor(movementMessage || (action === 'restore' ? 'Estado original restaurado; pulsa Guardar.' : 'Vista previa; pulsa Guardar para publicar.'));
            }
            const recoverRemoteDeletions = async (client) => {
                if (localStorage.getItem(DELETION_RECOVERY_KEY) === 'complete') return true;
                const { data: catalog, error } = await scopeQuery(client
                    .from('mall_editable_objects')
                    .select('object_id, metadata'));
                if (error) return false;
                const deletedRows = (catalog || []).filter((row) => row.metadata?.deleted === true);
                for (const row of deletedRows) {
                    const metadata = { ...(row.metadata || {}), deleted: false };
                    const { error: catalogError } = await scopeQuery(client
                        .from('mall_editable_objects')
                        .update({ metadata }))
                        .eq('object_id', row.object_id);
                    if (catalogError) return false;
                    const { error: overrideError } = await scopeQuery(client
                        .from('mall_object_overrides')
                        .update({ visible: true, collision_enabled: true, updated_at: new Date().toISOString() }))
                        .eq('object_id', row.object_id);
                    if (overrideError) return false;
                }
                localStorage.setItem(DELETION_RECOVERY_KEY, 'complete');
                return true;
            };
            const loadRemoteOverrides = async () => {
                const client = getSupabaseClient();
                if (!client) return false;
                if (!await recoverRemoteDeletions(client)) return false;
                const [{ data, error }, { data: catalog, error: catalogError }] = await Promise.all([
                    scopeQuery(client.from('mall_object_overrides').select('*')),
                    scopeQuery(client.from('mall_editable_objects').select('object_id, object_type, area_code, label, metadata'))
                ]);
                if (error || catalogError) return false;
                const localOverrides = readLocalOverrides();
                const catalogById = new Map((catalog || []).map((row) => [row.object_id, row]));
                (catalog || []).forEach((row) => {
                    if (row.object_type !== 'furniture' || row.metadata?.customCreated !== true) return;
                    const localTransform = localOverrides[row.object_id];
                    createCustomFurniture(row.metadata?.furnitureKind, {
                        id: row.object_id,
                        label: row.label,
                        areaCode: row.area_code,
                        transform: localTransform,
                        pictureImageUrl: row.metadata?.pictureImageUrl || localTransform?.pictureImageUrl,
                        promotionId: row.metadata?.promotionId || localTransform?.promotionId
                    });
                });
                const deletedIds = new Set((catalog || [])
                    .filter((row) => row.metadata?.deleted === true)
                    .map((row) => row.object_id));
                (data || []).forEach((row) => {
                    const metadata = catalogById.get(row.object_id)?.metadata || {};
                    const remoteTransform = {
                        position: [row.position_x, row.position_y, row.position_z],
                        rotation: [row.rotation_x, row.rotation_y, row.rotation_z],
                        scale: [row.scale_x, row.scale_y, row.scale_z],
                        visible: row.visible !== false,
                        deleted: deletedIds.has(row.object_id),
                        savedAt: row.updated_at || '',
                        coordinateSpace: metadata.coordinateSpace || 'local',
                        transformVersion: metadata.transformVersion || 1,
                        rotationOrder: metadata.rotationOrder || 'XYZ'
                    };
                    const localTransform = localOverrides[row.object_id];
                    const localTime = Date.parse(localTransform?.savedAt || '') || 0;
                    const remoteTime = Date.parse(remoteTransform.savedAt || '') || 0;
                    const effectiveTransform = localTransform && localTime >= remoteTime ? localTransform : remoteTransform;
                    pendingOverrides.set(row.object_id, effectiveTransform);
                    applyTransform(registry.get(row.object_id), effectiveTransform);
                });
                deletedIds.forEach((objectId) => {
                    if (pendingOverrides.has(objectId)) return;
                    const transform = { deleted: true, visible: false };
                    pendingOverrides.set(objectId, transform);
                    applyTransform(registry.get(objectId), transform);
                });
                window.mallObjectEditor?.configurePromotionCollectibles?.(window.mallActivePromotions || []);
                databaseReady = true;
                return true;
            };

            window.addEventListener('mall:inspector-selection', (event) => {
                selectEditableObject(event.detail?.object);
            });
            window.mallObjectEditor = {
                registry,
                loadRemoteOverrides,
                render: renderEditor,
                select: selectEditableObject,
                findIntersection: findEditableIntersection,
                createFurniture: createCustomFurniture,
                getPromotionCollectibleObject: (promotionId) => [...registry.values()]
                    .find((entry) => entry.furnitureKind === 'goldenBalloon'
                        && String(entry.promotionId || entry.object?.userData?.promotionId || '') === String(promotionId))?.object || null,
                hidePromotionCollectible: (promotionId) => {
                    const object = [...registry.values()]
                        .find((entry) => entry.furnitureKind === 'goldenBalloon'
                            && String(entry.promotionId || entry.object?.userData?.promotionId || '') === String(promotionId))?.object;
                    if (object) object.visible = false;
                },
                configurePromotionCollectibles: (promotions = []) => {
                    const active = new Map((promotions || [])
                        .filter((promotion) => promotion?.promotion_type === 'golden_balloon' && !promotion?.claimed_at)
                        .map((promotion) => [String(promotion.object_id || ''), promotion]));
                    [...registry.values()]
                        .filter((entry) => entry.furnitureKind === 'goldenBalloon')
                        .forEach((entry) => {
                            const promotion = active.get(entry.id);
                            // Visitors need to see the collectible before signing in; the claim RPC
                            // remains the only place that can reveal or redeem its protected code.
                            const promotionId = String(
                                promotion?.id
                                || entry.promotionId
                                || entry.object?.userData?.promotionId
                                || ''
                            );
                            entry.object.userData.promotionId = promotionId;
                            entry.object.traverse((node) => {
                                node.userData.isPromotionCollectible = Boolean(promotionId);
                                node.userData.promotionId = promotionId;
                            });
                            entry.object.visible = Boolean(promotionId);
                        });
                },
                alignment: Object.freeze({
                    positionStep: POSITION_GRID_STEP,
                    rotationStepDegrees: ROTATION_GRID_DEGREES,
                    magnetDistance: MAGNET_DISTANCE
                })
            };
            Object.entries(readLocalOverrides()).forEach(([id, transform]) => {
                if (transform?.customCreated !== true || registry.has(id)) return;
                createCustomFurniture(transform.furnitureKind, {
                    id,
                    label: transform.label,
                    areaCode: transform.areaCode,
                    transform,
                    pictureImageUrl: transform.pictureImageUrl,
                    promotionId: transform.promotionId
                });
            });
            let attempts = 0;
            const waitForDatabase = setInterval(async () => {
                attempts += 1;
                if (await loadRemoteOverrides() || attempts > 20) clearInterval(waitForDatabase);
            }, 750);
        })();
