(function initializeMallStructuralAudit() {
    'use strict';

    const AUDIT_QUERY_KEY = 'structural-audit';
    const POSITION_TOLERANCE = 0.25;
    const LENGTH_TOLERANCE = 0.25;
    let overlayGroup = null;
    let auditPanel = null;
    let auditReport = null;
    let savedCameraView = null;
    let savedAuditNavigation = null;
    let savedLoginOverlay = null;

    const isLocalEnvironment = () => /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
    const isAuditRequested = () => new URLSearchParams(window.location.search).has(AUDIT_QUERY_KEY);

    function getSource() {
        return window.mallOverheadStructureAuditSource || null;
    }

    function getWorldBox(group) {
        group.updateWorldMatrix(true, true);
        return new THREE.Box3().setFromObject(group);
    }

    function getBoxCenter(box) {
        return box.getCenter(new THREE.Vector3());
    }

    function getBoxSize(box) {
        return box.getSize(new THREE.Vector3());
    }

    function reflectBoxAcrossAxis(box, axis) {
        const reflected = box.clone();
        if (axis === 'x') {
            reflected.min.x = -box.max.x;
            reflected.max.x = -box.min.x;
        } else {
            reflected.min.z = -box.max.z;
            reflected.max.z = -box.min.z;
        }
        return reflected;
    }

    function reflectPointAcrossDiagonal(point, diagonal) {
        if (diagonal === 'x=z') return new THREE.Vector3(point.z, point.y, point.x);
        return new THREE.Vector3(-point.z, point.y, -point.x);
    }

    function reflectBoxAcrossDiagonal(box, diagonal) {
        const reflected = box.clone();
        if (diagonal === 'x=z') {
            reflected.min.x = box.min.z;
            reflected.max.x = box.max.z;
            reflected.min.z = box.min.x;
            reflected.max.z = box.max.x;
        } else {
            reflected.min.x = -box.max.z;
            reflected.max.x = -box.min.z;
            reflected.min.z = -box.max.x;
            reflected.max.z = -box.min.x;
        }
        return reflected;
    }

    function toWorldPoint(group, values) {
        return group.localToWorld(new THREE.Vector3(values[0], values[1], values[2]));
    }

    function getMeshCount(group) {
        let count = 0;
        group.traverse((node) => { if (node.isMesh) count += 1; });
        return count;
    }

    function profileDeviation(referenceGroup, referenceProfile, candidateGroup, candidateProfile, transform) {
        if (!referenceProfile?.length || !candidateProfile?.length || referenceProfile.length !== candidateProfile.length) return Infinity;
        const expected = referenceProfile.map((point) => transform(toWorldPoint(referenceGroup, point)));
        const actual = candidateProfile.map((point) => toWorldPoint(candidateGroup, point));
        return Math.max(...expected.map((target) => Math.min(...actual.map((point) => point.distanceTo(target)))));
    }

    function makeIssue(id, severity, title, detail, extras = {}) {
        return { id, severity, title, detail, ...extras };
    }

    function analyzeVaultPair(reference, candidate, axis) {
        const referenceBox = getWorldBox(reference.group);
        const expectedBox = reflectBoxAcrossAxis(referenceBox, axis);
        const actualBox = getWorldBox(candidate.group);
        const expectedCenter = getBoxCenter(expectedBox);
        const actualCenter = getBoxCenter(actualBox);
        const expectedSize = getBoxSize(expectedBox);
        const actualSize = getBoxSize(actualBox);
        const positionDelta = actualCenter.distanceTo(expectedCenter);
        const lengthDelta = Math.max(
            Math.abs(actualSize.x - expectedSize.x),
            Math.abs(actualSize.y - expectedSize.y),
            Math.abs(actualSize.z - expectedSize.z)
        );
        const actualJoint = toWorldPoint(candidate.group, candidate.sourceJointLocal);
        const expectedJoint = toWorldPoint(candidate.group, candidate.intendedJointLocal);
        const jointDeviation = actualJoint.distanceTo(expectedJoint);
        const capDelta = Math.abs(candidate.shellOuterLocalZ - candidate.capAnchorLocalZ);
        const referenceMeshCount = getMeshCount(reference.group);
        const candidateMeshCount = getMeshCount(candidate.group);
        const connectionProfileDeviation = profileDeviation(
            reference.group,
            reference.connectionProfileLocal,
            candidate.group,
            candidate.connectionProfileLocal,
            (point) => point.clone().set(axis === 'x' ? -point.x : point.x, point.y, axis === 'z' ? -point.z : point.z)
        );
        const orientationMismatch = candidate.sourceInnerSign !== candidate.intendedInnerSign;
        const offsetMismatch = candidate.sourceRibOffset !== candidate.intendedRibOffset;
        const issues = [];

        if (orientationMismatch) {
            issues.push(makeIssue(
                `${candidate.id}-orientation`,
                'critical',
                `${candidate.label}: orientación espejo ausente`,
                `La geometría de ${candidate.symmetricSource} conserva su sentido en vez de reflejarse sobre el eje ${axis.toUpperCase()}.`,
                { actualBox, expectedBox, actualJoint, expectedJoint, candidate }
            ));
        }
        if (positionDelta > POSITION_TOLERANCE || lengthDelta > LENGTH_TOLERANCE || referenceMeshCount !== candidateMeshCount) {
            issues.push(makeIssue(
                `${candidate.id}-dimensions`,
                'high',
                `${candidate.label}: posición o largo fuera de simetría`,
                `Desplazamiento ${positionDelta.toFixed(2)} m; diferencia máxima de tramo ${lengthDelta.toFixed(2)} m; inventario ${candidateMeshCount}/${referenceMeshCount}.`,
                { actualBox, expectedBox, actualJoint, expectedJoint, candidate }
            ));
        }
        if (jointDeviation > POSITION_TOLERANCE || capDelta > LENGTH_TOLERANCE || connectionProfileDeviation > POSITION_TOLERANCE || offsetMismatch) {
            issues.push(makeIssue(
                `${candidate.id}-connections`,
                'critical',
                `${candidate.label}: unión cúpula/tapa desalineada`,
                `El punto de conexión se desvía ${jointDeviation.toFixed(2)} m, el perfil ${connectionProfileDeviation.toFixed(2)} m y la tapa ${capDelta.toFixed(2)} m.`,
                { actualBox, expectedBox, actualJoint, expectedJoint, candidate }
            ));
        }

        return {
            reference,
            candidate,
            axis,
            actualBox,
            expectedBox,
            positionDelta,
            lengthDelta,
            jointDeviation,
            capDelta,
            issues
        };
    }

    function analyzeDiagonalPair(reference, candidate, diagonal) {
        const referenceBox = getWorldBox(reference.group);
        const expectedBox = reflectBoxAcrossDiagonal(referenceBox, diagonal);
        const actualBox = getWorldBox(candidate.group);
        const expectedCenter = getBoxCenter(expectedBox);
        const actualCenter = getBoxCenter(actualBox);
        const expectedSize = getBoxSize(expectedBox);
        const actualSize = getBoxSize(actualBox);
        const positionDelta = actualCenter.distanceTo(expectedCenter);
        const lengthDelta = Math.max(
            Math.abs(actualSize.x - expectedSize.x),
            Math.abs(actualSize.y - expectedSize.y),
            Math.abs(actualSize.z - expectedSize.z)
        );
        const connectionCenterIndex = Math.floor(reference.connectionProfileLocal.length / 2);
        const referenceJoint = toWorldPoint(reference.group, reference.connectionProfileLocal[connectionCenterIndex]);
        const expectedJoint = reflectPointAcrossDiagonal(referenceJoint, diagonal);
        const actualJoint = toWorldPoint(candidate.group, candidate.connectionProfileLocal[connectionCenterIndex]);
        const jointDeviation = actualJoint.distanceTo(expectedJoint);
        const connectionProfileDeviation = profileDeviation(
            reference.group,
            reference.connectionProfileLocal,
            candidate.group,
            candidate.connectionProfileLocal,
            (point) => reflectPointAcrossDiagonal(point, diagonal)
        );
        const capProfileDeviation = profileDeviation(
            reference.group,
            reference.capProfileLocal,
            candidate.group,
            candidate.capProfileLocal,
            (point) => reflectPointAcrossDiagonal(point, diagonal)
        );
        const referenceMeshCount = getMeshCount(reference.group);
        const candidateMeshCount = getMeshCount(candidate.group);
        const diagonalLabel = diagonal === 'x=z' ? 'N↔O' : 'N↔E';
        const issues = [];

        if (positionDelta > POSITION_TOLERANCE || lengthDelta > LENGTH_TOLERANCE || referenceMeshCount !== candidateMeshCount) {
            issues.push(makeIssue(
                `${candidate.id}-diagonal-shape`,
                'high',
                `${candidate.label}: simetría diagonal ${diagonalLabel} incompleta`,
                `Desplazamiento ${positionDelta.toFixed(2)} m; diferencia máxima de tramo ${lengthDelta.toFixed(2)} m; inventario ${candidateMeshCount}/${referenceMeshCount}.`,
                { actualBox, expectedBox, actualJoint, expectedJoint, candidate }
            ));
        }
        if (jointDeviation > POSITION_TOLERANCE || connectionProfileDeviation > POSITION_TOLERANCE || capProfileDeviation > POSITION_TOLERANCE) {
            issues.push(makeIssue(
                `${candidate.id}-diagonal-connections`,
                'critical',
                `${candidate.label}: conexiones diagonales desalineadas`,
                `Unión ${jointDeviation.toFixed(2)} m; perfil cúpula ${connectionProfileDeviation.toFixed(2)} m; perfil de tapa ${capProfileDeviation.toFixed(2)} m.`,
                { actualBox, expectedBox, actualJoint, expectedJoint, candidate }
            ));
        }

        return { reference, candidate, diagonal, actualBox, expectedBox, positionDelta, lengthDelta, jointDeviation, connectionProfileDeviation, capProfileDeviation, issues };
    }

    function analyzeDome(dome) {
        if (!dome?.group) return [];
        const ribs = dome.group.children.filter((child) => child.geometry?.type === 'TorusGeometry' && child.rotation.z !== 0);
        const rings = dome.group.children.filter((child) => child.geometry?.type === 'TorusGeometry' && child.rotation.z === 0);
        const issues = [];
        if (ribs.length !== dome.radialRibCount || rings.length !== dome.ringCount) {
            issues.push(makeIssue(
                'central-dome-inventory',
                'high',
                'Cúpula central: inventario estructural incompleto',
                `Se encontraron ${ribs.length}/${dome.radialRibCount} meridianos y ${rings.length}/${dome.ringCount} anillos.`
            ));
        }
        const expectedAngles = Array.from({ length: dome.radialRibCount }, (_, index) => index * dome.radialStep);
        const hasRadialSymmetry = ribs.every((rib, index) => Math.abs(rib.rotation.y - expectedAngles[index]) < 0.001);
        if (!hasRadialSymmetry) {
            issues.push(makeIssue(
                'central-dome-radial-symmetry',
                'high',
                'Cúpula central: meridianos sin distribución radial uniforme',
                'Los ocho meridianos deben separarse exactamente 45 grados.'
            ));
        }
        return issues;
    }

    function buildReport() {
        const source = getSource();
        if (!source?.vaults?.length || !source.dome) return null;
        const vaults = new Map(source.vaults.map((entry) => [entry.wingLabel, entry]));
        const pairs = [
            analyzeVaultPair(vaults.get('N'), vaults.get('S'), 'z'),
            analyzeVaultPair(vaults.get('E'), vaults.get('O'), 'x'),
            analyzeDiagonalPair(vaults.get('N'), vaults.get('O'), 'x=z'),
            analyzeDiagonalPair(vaults.get('N'), vaults.get('E'), 'x=-z')
        ];
        const issues = [...pairs.flatMap((pair) => pair.issues), ...analyzeDome(source.dome)];
        const totalMeshes = source.vaults.reduce((total, vault) => total + getMeshCount(vault.group), 0) + source.dome.group.children.length;

        return {
            source,
            pairs,
            issues,
            totalMeshes,
            comparisonCount: pairs.length + 1,
            criticalCount: issues.filter((issue) => issue.severity === 'critical').length,
            highCount: issues.filter((issue) => issue.severity === 'high').length
        };
    }

    function createPointMarker(position, color) {
        const marker = new THREE.Mesh(
            new THREE.SphereGeometry(0.62, 16, 12),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.96, depthTest: false })
        );
        marker.position.copy(position);
        marker.renderOrder = 1000;
        overlayGroup.add(marker);
    }

    function createConnectionGuide(actual, expected) {
        const geometry = new THREE.BufferGeometry().setFromPoints([actual, expected]);
        const guide = new THREE.Line(
            geometry,
            new THREE.LineDashedMaterial({ color: 0xffb100, dashSize: 1.2, gapSize: 0.65, transparent: true, opacity: 0.96, depthTest: false })
        );
        guide.computeLineDistances();
        guide.renderOrder = 999;
        overlayGroup.add(guide);
        createPointMarker(actual, 0xff3545);
        createPointMarker(expected, 0x00e7ff);
    }

    function renderOverlay(report) {
        if (overlayGroup) scene.remove(overlayGroup);
        overlayGroup = new THREE.Group();
        overlayGroup.name = 'Auditoría visual de estructura superior';
        report.pairs.forEach((pair) => {
            if (!pair.issues.length) return;
            const actual = new THREE.Box3Helper(pair.actualBox, 0xff3545);
            const expected = new THREE.Box3Helper(pair.expectedBox, 0x00e7ff);
            actual.material.depthTest = false;
            expected.material.depthTest = false;
            actual.renderOrder = 998;
            expected.renderOrder = 997;
            overlayGroup.add(actual, expected);
            createConnectionGuide(pair.issues[0].actualJoint, pair.issues[0].expectedJoint);
        });
        scene.add(overlayGroup);
    }

    function enterAuditViewport() {
        const loginOverlay = document.getElementById('login-overlay');
        if (loginOverlay && !savedLoginOverlay) {
            savedLoginOverlay = {
                display: loginOverlay.style.display,
                opacity: loginOverlay.style.opacity
            };
            loginOverlay.style.opacity = '0';
            loginOverlay.style.display = 'none';
        }

        if (typeof isWalking === 'undefined' || !isWalking || savedAuditNavigation) return;
        savedAuditNavigation = {
            isWalking,
            lockWalkModePreference,
            fog: scene.fog,
            enablePan: controls.enablePan,
            enableRotate: controls.enableRotate,
            enableZoom: controls.enableZoom,
            minPolarAngle: controls.minPolarAngle,
            maxPolarAngle: controls.maxPolarAngle,
            minDistance: controls.minDistance,
            maxDistance: controls.maxDistance
        };
        isWalking = false;
        lockWalkModePreference = false;
        scene.fog = null;
        controls.enablePan = true;
        controls.enableRotate = true;
        controls.enableZoom = true;
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = Math.PI / 2 - 0.05;
        controls.minDistance = 1;
        controls.maxDistance = 500;
        syncWalkModeButton?.();
    }

    function leaveAuditViewport() {
        const loginOverlay = document.getElementById('login-overlay');
        if (loginOverlay && savedLoginOverlay) {
            loginOverlay.style.display = savedLoginOverlay.display;
            loginOverlay.style.opacity = savedLoginOverlay.opacity;
            savedLoginOverlay = null;
        }
        if (!savedAuditNavigation) return;
        isWalking = savedAuditNavigation.isWalking;
        lockWalkModePreference = savedAuditNavigation.lockWalkModePreference;
        scene.fog = savedAuditNavigation.fog;
        controls.enablePan = savedAuditNavigation.enablePan;
        controls.enableRotate = savedAuditNavigation.enableRotate;
        controls.enableZoom = savedAuditNavigation.enableZoom;
        controls.minPolarAngle = savedAuditNavigation.minPolarAngle;
        controls.maxPolarAngle = savedAuditNavigation.maxPolarAngle;
        controls.minDistance = savedAuditNavigation.minDistance;
        controls.maxDistance = savedAuditNavigation.maxDistance;
        savedAuditNavigation = null;
        syncWalkModeButton?.();
    }

    function getIssueTarget(issue) {
        if (!issue.actualBox) return new THREE.Vector3(0, 25, 0);
        return getBoxCenter(issue.actualBox);
    }

    function focusAudit(issue) {
        if (typeof camera === 'undefined' || typeof controls === 'undefined') return;
        if (!savedCameraView) {
            savedCameraView = {
                position: camera.position.clone(),
                target: controls.target.clone()
            };
        }
        const target = getIssueTarget(issue);
        const bounds = getBoxSize(issue.actualBox);
        const span = Math.max(bounds.x, bounds.z);
        const sideOffset = Math.max(38, span * 0.62);
        const elevation = Math.max(62, span * 1.05);
        const isNorthSouthPair = issue?.candidate?.symmetryAxis === 'z';

        // Una vista elevada evita que las losas oculten los trazos de comparación.
        camera.position.set(
            target.x + (isNorthSouthPair ? sideOffset : -sideOffset),
            target.y + elevation,
            target.z + (isNorthSouthPair ? -sideOffset : sideOffset)
        );
        controls.target.copy(target);
        controls.update();
    }

    function resetView() {
        if (!savedCameraView || typeof camera === 'undefined' || typeof controls === 'undefined') return;
        camera.position.copy(savedCameraView.position);
        controls.target.copy(savedCameraView.target);
        controls.update();
        savedCameraView = null;
    }

    function severityLabel(severity) {
        return severity === 'critical' ? 'CRÍTICO' : 'ALTO';
    }

    function renderPanel(report) {
        if (!auditPanel) return;
        const issueRows = report.issues.length
            ? report.issues.map((issue) => `
                <button class="structural-audit__issue structural-audit__issue--${issue.severity}" type="button" data-structural-issue="${issue.id}">
                    <span>${severityLabel(issue.severity)}</span>
                    <strong>${issue.title}</strong>
                    <small>${issue.detail}</small>
                </button>
            `).join('')
            : '<p class="structural-audit__clear">No se detectaron desviaciones geométricas.</p>';
        auditPanel.innerHTML = `
            <div class="structural-audit__heading">
                <div>
                    <span>INSPECCIÓN LOCAL</span>
                    <h2>Estructura superior</h2>
                </div>
                <button type="button" class="structural-audit__close" aria-label="Ocultar auditoría">×</button>
            </div>
            <p class="structural-audit__summary">${report.totalMeshes} fierros evaluados en ${report.comparisonCount} contrastes axiales, diagonales y radiales. ${report.criticalCount} críticos, ${report.highCount} altos.</p>
            <p class="structural-audit__legend"><i class="structural-audit__legend--actual"></i> actual <i class="structural-audit__legend--expected"></i> referencia <i class="structural-audit__legend--joint"></i> unión esperada</p>
            <div class="structural-audit__issues">${issueRows}</div>
            <div class="structural-audit__actions">
                <button type="button" data-structural-action="overview">Vista general</button>
                <button type="button" data-structural-action="reset">Restaurar vista</button>
            </div>
            <p class="structural-audit__note">La auditoría no modifica geometría, materiales ni colisiones.</p>
        `;
        auditPanel.querySelector('.structural-audit__close')?.addEventListener('click', disable);
        auditPanel.querySelector('[data-structural-action="overview"]')?.addEventListener('click', () => {
            if (report.issues[0]) {
                focusAudit(report.issues[0]);
            }
        });
        auditPanel.querySelector('[data-structural-action="reset"]')?.addEventListener('click', resetView);
        auditPanel.querySelectorAll('[data-structural-issue]').forEach((button) => {
            button.addEventListener('click', () => {
                const issue = report.issues.find((entry) => entry.id === button.dataset.structuralIssue);
                if (issue) focusAudit(issue);
            });
        });
    }

    function createPanel() {
        if (auditPanel || !document.body) return;
        auditPanel = document.createElement('aside');
        auditPanel.id = 'structural-audit-panel';
        auditPanel.hidden = true;
        auditPanel.setAttribute('aria-live', 'polite');
        document.body.append(auditPanel);
    }

    function hasAdminAuditAccess() {
        return window.mallCanUseAdminTools?.() === true;
    }

    function enable() {
        if (!isLocalEnvironment() || !hasAdminAuditAccess()) return false;
        auditReport = buildReport();
        if (!auditReport) return false;
        createPanel();
        enterAuditViewport();
        renderOverlay(auditReport);
        renderPanel(auditReport);
        auditPanel.hidden = false;
        document.body.dataset.structuralAudit = 'active';
        if (isAuditRequested() && auditReport.issues[0]) {
            focusAudit(auditReport.issues[0]);
        }
        return true;
    }

    function disable() {
        if (overlayGroup) {
            scene.remove(overlayGroup);
            overlayGroup = null;
        }
        if (auditPanel) auditPanel.hidden = true;
        document.body.dataset.structuralAudit = 'inactive';
        resetView();
        leaveAuditViewport();
    }

    function addLocalToggle() {
        if (!isLocalEnvironment()) return;
        const dropdown = document.getElementById('controls-dropdown');
        if (!dropdown || document.getElementById('structural-audit-toggle')) return;
        const button = document.createElement('button');
        button.id = 'structural-audit-toggle';
        button.className = 'controls-menu-item structural-audit-toggle';
        button.type = 'button';
        button.textContent = 'Inspeccionar estructura';
        button.hidden = !hasAdminAuditAccess();
        button.addEventListener('click', () => {
            if (!hasAdminAuditAccess()) return;
            if (auditPanel?.hidden === false) disable();
            else enable();
        });
        dropdown.append(button);
    }

    function syncLocalToggleAccess() {
        const button = document.getElementById('structural-audit-toggle');
        const canUseAudit = hasAdminAuditAccess();
        if (button) button.hidden = !canUseAudit;
        if (!canUseAudit && auditPanel?.hidden === false) disable();
    }

    function initialize() {
        if (!isLocalEnvironment()) return;
        createPanel();
        addLocalToggle();
        syncLocalToggleAccess();
        if (isAuditRequested() && hasAdminAuditAccess()) enable();
    }

    window.mallStructuralAudit = {
        enable,
        disable,
        toggle: () => (auditPanel?.hidden === false ? disable() : enable()),
        getReport: () => auditReport
    };
    window.addEventListener('mall:admin-access-changed', syncLocalToggleAccess);
    window.addEventListener('DOMContentLoaded', initialize, { once: true });
})();
