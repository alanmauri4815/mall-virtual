        // --- SISTEMA DE INTERACCIÓN (RAYCASTING) ---
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        const objectDebugContent = document.getElementById('object-debug-content');
        const OBJECT_INSPECTOR_ENABLED = true;

        function formatDebugVector(vec) {
            if (!vec) return "-";
            return `${vec.x.toFixed(2)}, ${vec.y.toFixed(2)}, ${vec.z.toFixed(2)}`;
        }

        function findShopRoot(obj) {
            let current = obj;
            while (current) {
                if (current.userData?.shopCode) return current;
                current = current.parent;
            }
            return null;
        }

        function collectParentChain(obj) {
            const names = [];
            let current = obj;
            while (current) {
                names.push(current.name || current.userData?.shopCode || current.type || "Object3D");
                current = current.parent;
            }
            return names.slice(0, 6).join(" <- ");
        }

        const axisReferenceElements = {
            lineX: document.getElementById('axis-line-x'),
            lineY: document.getElementById('axis-line-y'),
            lineZ: document.getElementById('axis-line-z'),
            labelX: document.getElementById('axis-label-x'),
            labelY: document.getElementById('axis-label-y'),
            labelZ: document.getElementById('axis-label-z')
        };
        const axisReferenceOrigin = { x: 30, y: 62 };
        const axisReferenceScale = 34;
        const axisReferenceInverseQuat = new THREE.Quaternion();
        const axisReferenceTempVector = new THREE.Vector3();
        const axisReferenceWorldAxes = [
            { vector: new THREE.Vector3(1, 0, 0), line: axisReferenceElements.lineX, label: axisReferenceElements.labelX },
            { vector: new THREE.Vector3(0, 1, 0), line: axisReferenceElements.lineY, label: axisReferenceElements.labelY },
            { vector: new THREE.Vector3(0, 0, 1), line: axisReferenceElements.lineZ, label: axisReferenceElements.labelZ }
        ];

        function updateGPSDisplay() {
            const gpsDisplay = document.getElementById('gps-display');
            if (!gpsDisplay || gpsDisplay.style.display === 'none') return;
            const pos = camera.position;
            const dir = new THREE.Vector3();
            camera.getWorldDirection(dir);
            dir.y = 0;
            if (dir.lengthSq() < 0.000001) dir.set(0, 0, 1);
            dir.normalize();
            const headingDeg = (THREE.MathUtils.radToDeg(Math.atan2(dir.x, dir.z)) + 360) % 360;
            document.getElementById('gps-x').innerText = pos.x.toFixed(2);
            document.getElementById('gps-y').innerText = pos.y.toFixed(2);
            document.getElementById('gps-z').innerText = pos.z.toFixed(2);
            document.getElementById('gps-angle').innerText = `${headingDeg.toFixed(1)}°`;
        }

        function updateAxisReference() {
            if (!camera || !axisReferenceElements.lineX) return;

            axisReferenceInverseQuat.copy(camera.quaternion).invert();
            axisReferenceWorldAxes.forEach((axis) => {
                axisReferenceTempVector.copy(axis.vector).applyQuaternion(axisReferenceInverseQuat).normalize();
                const endX = axisReferenceOrigin.x + axisReferenceTempVector.x * axisReferenceScale;
                const endY = axisReferenceOrigin.y - axisReferenceTempVector.y * axisReferenceScale;
                axis.line.setAttribute('x1', axisReferenceOrigin.x);
                axis.line.setAttribute('y1', axisReferenceOrigin.y);
                axis.line.setAttribute('x2', endX.toFixed(2));
                axis.line.setAttribute('y2', endY.toFixed(2));
                axis.label.setAttribute('x', (endX + 4).toFixed(2));
                axis.label.setAttribute('y', (endY + 4).toFixed(2));
                const opacity = THREE.MathUtils.clamp(0.45 + ((axisReferenceTempVector.z + 1) * 0.25), 0.35, 1);
                axis.line.setAttribute('opacity', opacity.toFixed(2));
                axis.label.setAttribute('opacity', opacity.toFixed(2));
            });
        }

        function updateObjectInspector(intersection) {
            if (!OBJECT_INSPECTOR_ENABLED) return;
            if (!objectDebugContent) return;
            if (!intersection?.object) {
                objectDebugContent.innerHTML = `<div class="debug-empty">No se detectó ningún objeto en este clic.</div>`;
                return;
            }

            const obj = intersection.object;
            const shopRoot = findShopRoot(obj);
            const worldPos = new THREE.Vector3();
            obj.getWorldPosition(worldPos);
            const material = Array.isArray(obj.material) ? obj.material[0] : obj.material;
            const materialName = material?.name || material?.type || "-";
            const materialColor = material?.color ? `#${material.color.getHexString()}` : "-";
            const geometry = obj.geometry?.type || "-";
            const userDataKeys = Object.keys(obj.userData || {}).filter(Boolean);

            objectDebugContent.innerHTML = [
                `<div class="debug-row"><strong>Objeto:</strong> ${obj.name || "(sin nombre)"}</div>`,
                `<div class="debug-row"><strong>Tipo:</strong> ${obj.type || "-"}</div>`,
                `<div class="debug-row"><strong>Geometría:</strong> ${geometry}</div>`,
                `<div class="debug-row"><strong>Material:</strong> ${materialName}</div>`,
                `<div class="debug-row"><strong>Color:</strong> ${materialColor}</div>`,
                `<div class="debug-row"><strong>Posición mundo:</strong> ${formatDebugVector(worldPos)}</div>`,
                `<div class="debug-row"><strong>Punto clic:</strong> ${formatDebugVector(intersection.point)}</div>`,
                `<div class="debug-row"><strong>Distancia:</strong> ${intersection.distance.toFixed(2)}</div>`,
                `<div class="debug-row"><strong>shopCode:</strong> ${shopRoot?.userData?.shopCode || "-"}</div>`,
                `<div class="debug-row"><strong>Ruta:</strong> ${collectParentChain(obj)}</div>`,
                `<div class="debug-row"><strong>userData:</strong> ${userDataKeys.length ? userDataKeys.join(", ") : "-"}</div>`
            ].join("");
        }

