(function initializeMallMazeGame() {
    const TIME_LIMIT_MS = 15 * 60 * 1000;
    const RECORDS_STORAGE_KEY = 'mall-maze-records-v1';
    const MAX_RECORDS = 10;
    const RECORDS_READ_RPC = 'get_mall_maze_records';
    const RECORDS_START_RPC = 'start_mall_maze_run';
    const RECORDS_CHECKPOINT_RPC = 'record_mall_maze_checkpoint';
    const RECORDS_WRITE_RPC = 'submit_mall_maze_record_v2';
    const MAZE_VERSION = 'north-west-v2';
    const state = {
        status: 'idle',
        startedAt: 0,
        elapsedMs: 0,
        lastRenderedSecond: -1,
        nearPanicStationId: null,
        timeLimitAcknowledged: false,
        recordRank: null,
        isNewRecord: false,
        recordMessage: '',
        globalRecords: [],
        globalRecordsAvailable: false,
        recordSyncState: 'local',
        remoteRunId: null,
        routeCheckpointIndex: 0,
        pendingRouteCheckpoint: null,
        routeValidationState: 'offline'
    };
    let previousPosition = null;
    let controlsBound = false;
    let recordSyncToken = 0;

    function getDistanceSquared(point, target) {
        const dx = point.x - target.x;
        const dz = point.z - target.z;
        return dx * dx + dz * dz;
    }

    function formatElapsedTime(milliseconds) {
        const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
        const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const seconds = (totalSeconds % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    }

    function getHud() {
        return {
            panel: document.getElementById('maze-timer'),
            value: document.getElementById('maze-timer-value'),
            status: document.getElementById('maze-timer-status'),
            panicButton: document.getElementById('maze-panic-button'),
            timeLimit: document.getElementById('maze-time-limit'),
            continueButton: document.getElementById('maze-time-limit-continue'),
            exitButton: document.getElementById('maze-time-limit-exit'),
            completion: document.getElementById('maze-complete'),
            completionTime: document.getElementById('maze-complete-time'),
            recordMessage: document.getElementById('maze-record-message'),
            recordHeading: document.getElementById('maze-record-heading'),
            recordList: document.getElementById('maze-record-list'),
            progress: document.getElementById('maze-route-progress'),
            validation: document.getElementById('maze-route-validation'),
            completionContinue: document.getElementById('maze-complete-continue'),
            completionExit: document.getElementById('maze-complete-exit')
        };
    }

    function bindControls() {
        if (controlsBound) return;
        const hud = getHud();
        if (!hud.panicButton || !hud.continueButton || !hud.exitButton || !hud.completionContinue || !hud.completionExit) return;
        hud.panicButton.addEventListener('click', () => exitMaze('panic-button'));
        hud.continueButton.addEventListener('click', () => continueMaze());
        hud.exitButton.addEventListener('click', () => exitMaze('time-limit'));
        hud.completionContinue.addEventListener('click', () => dismissCompletion());
        hud.completionExit.addEventListener('click', () => exitMaze('finish-exit'));
        if (document.addEventListener) {
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && state.status === 'running') exitMaze('panic-keyboard');
            });
        }
        controlsBound = true;
    }

    function renderTimeLimitPrompt(visible) {
        const hud = getHud();
        if (hud.timeLimit) hud.timeLimit.hidden = !visible;
    }

    function renderCompletionPrompt(visible) {
        const hud = getHud();
        if (hud.completion) hud.completion.hidden = !visible;
        if (!visible) return;
        if (hud.completionTime) hud.completionTime.textContent = formatElapsedTime(state.elapsedMs);
        if (hud.recordMessage) hud.recordMessage.textContent = state.recordMessage;
        if (hud.recordHeading) {
            hud.recordHeading.textContent = state.globalRecordsAvailable
                ? 'Récords globales'
                : 'Récords locales (respaldo)';
        }
        if (hud.recordList) hud.recordList.textContent = getVisibleRecords()
            .slice(0, 5)
            .map((record, index) => `${index + 1}. ${record.name} · ${formatElapsedTime(record.elapsedMs)}`)
            .join('\n') || 'Aún no hay tiempos registrados.';
    }

    function renderHud(visible, statusText, showPanicButton = false) {
        bindControls();
        const hud = getHud();
        if (!hud.panel || !hud.value || !hud.status) return;
        hud.panel.hidden = !visible;
        if (hud.panicButton) {
            hud.panicButton.hidden = !visible || !showPanicButton || state.status !== 'running';
        }
        if (hud.progress) {
            const total = Number(window.mallMazeDefinition?.routeCheckpointCount || 0);
            hud.progress.textContent = total
                ? `${Math.min(state.routeCheckpointIndex, total)}/${total} puntos de control`
                : 'Recorrido sin puntos de control';
        }
        if (hud.validation) {
            hud.validation.textContent = state.routeValidationState === 'active'
                ? 'Validación global'
                : state.routeValidationState === 'starting'
                    ? 'Conectando...'
                    : state.routeValidationState === 'invalid'
                        ? 'Registro local'
                        : 'Modo local';
        }
        if (!visible) return;

        const renderedSecond = Math.floor(state.elapsedMs / 1000);
        if (renderedSecond !== state.lastRenderedSecond || state.status === 'complete') {
            hud.value.textContent = formatElapsedTime(state.elapsedMs);
            state.lastRenderedSecond = renderedSecond;
        }
        hud.status.textContent = statusText;
        hud.panel.dataset.state = state.status;
    }

    function isWithinMazeBounds(position, maze) {
        return position.x >= maze.bounds.minX - 1
            && position.x <= maze.bounds.maxX + 1
            && position.z >= maze.bounds.minZ - 1
            && position.z <= maze.bounds.maxZ + 1;
    }

    function hasCrossedEntry(position, maze) {
        if (!previousPosition || !maze.entryGate) return false;
        const wasOutside = previousPosition.x < maze.entryGate.x - 0.12;
        const isInside = position.x >= maze.entryGate.x - 0.12;
        const isAligned = Math.abs(position.z - maze.entryGate.z) <= maze.entryGate.width;
        return wasOutside && isInside && isAligned;
    }

    function getNearbyPanicStation(position, maze) {
        return (maze.panicStations || []).find((station) => {
            const dx = position.x - station.x;
            const dz = position.z - station.z;
            return (dx * dx + dz * dz) <= station.radius ** 2;
        }) || null;
    }

    function resetJourneyState() {
        state.status = 'idle';
        state.startedAt = 0;
        state.elapsedMs = 0;
        state.lastRenderedSecond = -1;
        state.nearPanicStationId = null;
        state.timeLimitAcknowledged = false;
        state.recordRank = null;
        state.isNewRecord = false;
        state.recordMessage = '';
        state.globalRecords = [];
        state.globalRecordsAvailable = false;
        state.recordSyncState = 'local';
        state.remoteRunId = null;
        state.routeCheckpointIndex = 0;
        state.pendingRouteCheckpoint = null;
        state.routeValidationState = 'offline';
        recordSyncToken += 1;
        previousPosition = null;
    }

    function exitMaze(reason = 'manual') {
        const maze = window.mallMazeDefinition;
        if (!maze || typeof camera === 'undefined' || !camera?.position) return;
        const previous = camera.position.clone();
        const exitPosition = new THREE.Vector3(
            maze.bounds.minX - 2.2,
            typeof PLAYER_EYE_HEIGHT === 'number' ? PLAYER_EYE_HEIGHT : 1.7,
            maze.entryGate.z
        );
        camera.position.copy(exitPosition);
        if (typeof controls !== 'undefined' && controls?.target) {
            controls.target.add(exitPosition.clone().sub(previous));
            controls.update();
        }
        window.resetMallNavigationInputs?.(900);
        window.mallMovementLockedUntil = Date.now() + 900;
        resetJourneyState();
        previousPosition = { x: exitPosition.x, z: exitPosition.z };
        renderTimeLimitPrompt(false);
        renderCompletionPrompt(false);
        renderHud(false, '', false);
        document.body.dataset.mazeExitReason = reason;
    }

    function continueMaze() {
        if (state.status !== 'limit-prompt') return;
        state.status = 'running';
        state.startedAt = performance.now() - state.elapsedMs;
        state.timeLimitAcknowledged = true;
        renderTimeLimitPrompt(false);
    }

    function dismissCompletion() {
        if (state.status !== 'complete') return;
        renderCompletionPrompt(false);
    }

    function getStoredRecords() {
        if (typeof localStorage === 'undefined') return [];
        try {
            const stored = JSON.parse(localStorage.getItem(RECORDS_STORAGE_KEY) || '[]');
            if (!Array.isArray(stored)) return [];
            return stored
                .map(normalizeRecord)
                .filter(Boolean)
                .sort((left, right) => left.elapsedMs - right.elapsedMs || left.createdAt - right.createdAt)
                .slice(0, MAX_RECORDS);
        } catch (_) {
            return [];
        }
    }

    function getMazeRecordPlayerName() {
        const candidate = String(window.mallMazePlayerName || '').trim();
        return (candidate || 'Jugador local').slice(0, 40);
    }

    function normalizeRecord(record) {
        const elapsedMs = Number(record?.elapsedMs ?? record?.elapsed_ms);
        if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return null;
        const createdAtValue = record?.createdAt ?? record?.created_at;
        const parsedCreatedAt = typeof createdAtValue === 'string'
            ? Date.parse(createdAtValue)
            : Number(createdAtValue);
        return {
            name: String(record?.name ?? record?.player_name ?? 'Jugador local').slice(0, 40),
            elapsedMs: Math.round(elapsedMs),
            createdAt: Number.isFinite(parsedCreatedAt) ? parsedCreatedAt : 0
        };
    }

    function getVisibleRecords() {
        return state.globalRecordsAvailable
            ? state.globalRecords
            : getStoredRecords();
    }

    function getSupabaseClient() {
        if (window.mallSupabaseClient?.rpc) return window.mallSupabaseClient;
        try {
            if (typeof supabaseClient !== 'undefined' && supabaseClient?.rpc) return supabaseClient;
        } catch (_) {
            // The Supabase module is optional while the app is loading or offline.
        }
        return null;
    }

    function saveCompletedRecord() {
        const records = getStoredRecords();
        const previousBest = records[0]?.elapsedMs ?? Infinity;
        const entry = {
            name: getMazeRecordPlayerName(),
            elapsedMs: Math.max(1, Math.round(state.elapsedMs)),
            createdAt: Date.now()
        };
        const nextRecords = [...records, entry]
            .sort((left, right) => left.elapsedMs - right.elapsedMs || left.createdAt - right.createdAt)
            .slice(0, MAX_RECORDS);
        const recordIndex = nextRecords.indexOf(entry);
        state.recordRank = recordIndex >= 0 ? recordIndex + 1 : null;
        state.isNewRecord = entry.elapsedMs < previousBest;
        state.recordMessage = state.isNewRecord
            ? 'Nuevo récord. Este tiempo ocupa el primer lugar en este dispositivo.'
            : state.recordRank
                ? `Tiempo registrado: puesto ${state.recordRank} de ${nextRecords.length}.`
                : 'Tiempo registrado, fuera de los diez mejores de este dispositivo.';

        if (typeof localStorage === 'undefined') return entry;
        try {
            localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(nextRecords));
        } catch (_) {
            state.recordMessage = 'Tiempo completado. No se pudo guardar el récord en este navegador.';
        }
        return entry;
    }

    function getNextRouteCheckpoint(position, maze) {
        const checkpoints = maze.routeCheckpoints || [];
        return checkpoints[state.routeCheckpointIndex] || null;
    }

    function getRouteStatus(maze) {
        if (state.routeValidationState === 'invalid') return 'Ruta no validada; puedes salir al boulevard';
        const nextCheckpoint = getNextRouteCheckpoint(camera.position, maze);
        if (state.remoteRunId && nextCheckpoint) return `${nextCheckpoint.label}: busca el marcador iluminado`;
        if (state.remoteRunId && !nextCheckpoint) return 'Puntos de control completos; llega a META';
        return 'Recorrido activo';
    }

    async function startRemoteMazeRun(maze) {
        const client = getSupabaseClient();
        if (!client) return;

        const runToken = recordSyncToken;
        state.routeValidationState = 'starting';
        try {
            const { data, error } = await client.rpc(RECORDS_START_RPC, {
                p_player_name: getMazeRecordPlayerName(),
                p_maze_version: MAZE_VERSION,
                p_checkpoint_count: Number(maze.routeCheckpointCount || maze.routeCheckpoints?.length || 0)
            });
            if (error) throw error;
            if (runToken !== recordSyncToken || state.status !== 'running') return;

            const row = Array.isArray(data) ? data[0] : data;
            if (!row?.run_id) throw new Error('Supabase no devolvió una partida válida.');
            state.remoteRunId = row.run_id;
            state.routeCheckpointIndex = 0;
            state.routeValidationState = 'active';
        } catch (_) {
            if (runToken === recordSyncToken) state.routeValidationState = 'offline';
        }
    }

    async function syncRouteCheckpoint(checkpoint, elapsedMs) {
        const client = getSupabaseClient();
        if (!client || !state.remoteRunId) return;

        const runToken = recordSyncToken;
        try {
            const { data, error } = await client.rpc(RECORDS_CHECKPOINT_RPC, {
                p_run_id: state.remoteRunId,
                p_checkpoint: checkpoint.index,
                p_elapsed_ms: Math.max(0, Math.round(elapsedMs))
            });
            if (error) throw error;
            if (runToken !== recordSyncToken) return;

            const row = Array.isArray(data) ? data[0] : data;
            if (!row?.accepted) throw new Error('Punto de control rechazado.');
            state.routeCheckpointIndex = Math.max(
                state.routeCheckpointIndex,
                Number(row.next_checkpoint) || checkpoint.index
            );
            state.pendingRouteCheckpoint = null;
        } catch (_) {
            if (runToken === recordSyncToken) {
                state.pendingRouteCheckpoint = null;
                state.routeValidationState = 'invalid';
            }
        }
    }

    function processRouteCheckpoint(position, maze) {
        if (!state.remoteRunId || state.routeValidationState !== 'active' || state.pendingRouteCheckpoint) return;
        const checkpoint = getNextRouteCheckpoint(position, maze);
        if (!checkpoint || getDistanceSquared(position, checkpoint) > checkpoint.radius ** 2) return;
        state.pendingRouteCheckpoint = checkpoint.index;
        void syncRouteCheckpoint(checkpoint, state.elapsedMs);
    }

    async function syncCompletedRecord(entry) {
        const client = getSupabaseClient();
        const routeCheckpointCount = Number(window.mallMazeDefinition?.routeCheckpointCount || 0);
        const routeIsVerified = state.remoteRunId
            && state.routeValidationState === 'active'
            && state.routeCheckpointIndex >= routeCheckpointCount
            && !state.pendingRouteCheckpoint;
        if (!client || !routeIsVerified) {
            if (state.remoteRunId) {
                state.recordMessage = 'Tiempo guardado localmente. Completa los puntos de control para entrar al ranking global.';
                renderCompletionPrompt(true);
            }
            return;
        }

        const syncToken = recordSyncToken;
        state.recordSyncState = 'syncing';
        try {
            const { data: submission, error: submissionError } = await client.rpc(RECORDS_WRITE_RPC, {
                p_run_id: state.remoteRunId,
                p_player_name: entry.name,
                p_elapsed_ms: entry.elapsedMs
            });
            if (submissionError) throw submissionError;
            if (syncToken !== recordSyncToken) return;

            const submissionRow = Array.isArray(submission) ? submission[0] : submission;
            const remoteRank = Number(submissionRow?.rank);
            if (Number.isFinite(remoteRank) && remoteRank > 0) state.recordRank = remoteRank;
            state.isNewRecord = submissionRow?.is_new_record === true;

            const { data: remoteRecords, error: readError } = await client.rpc(RECORDS_READ_RPC, {
                p_limit: MAX_RECORDS
            });
            if (readError) throw readError;
            if (syncToken !== recordSyncToken) return;

            state.globalRecords = Array.isArray(remoteRecords)
                ? remoteRecords.map(normalizeRecord).filter(Boolean).slice(0, MAX_RECORDS)
                : [];
            state.globalRecordsAvailable = true;
            state.recordSyncState = 'global';
            state.recordMessage = state.isNewRecord
                ? 'Nuevo récord global. Este tiempo ocupa el primer lugar del mall.'
                : state.recordRank
                    ? `Tiempo registrado: puesto ${state.recordRank} del ranking global.`
                    : 'Tiempo registrado en el ranking global.';
            if (state.status === 'complete') renderCompletionPrompt(true);
        } catch (_) {
            if (syncToken === recordSyncToken) state.recordSyncState = 'local';
        }
    }

    function updateMallMazeGame(nowMs = performance.now()) {
        const maze = window.mallMazeDefinition;
        if (!maze || typeof camera === 'undefined' || !camera?.position) return;

        const position = camera.position;
        const isNearFinish = getDistanceSquared(position, maze.finish) <= maze.finishRadius ** 2;
        const isInMazeArea = isWithinMazeBounds(position, maze);
        const crossedEntry = hasCrossedEntry(position, maze);
        const nearbyPanicStation = getNearbyPanicStation(position, maze);
        state.nearPanicStationId = nearbyPanicStation?.id || null;

        if ((state.status === 'running' || state.status === 'complete') && !isInMazeArea) {
            resetJourneyState();
            previousPosition = { x: position.x, z: position.z };
            renderTimeLimitPrompt(false);
            renderCompletionPrompt(false);
            renderHud(false, '', false);
            document.body.dataset.mazeExitReason = 'natural-exit';
            return;
        }

        if (state.status === 'idle') {
            if (crossedEntry) {
                state.status = 'running';
                state.startedAt = nowMs;
                state.elapsedMs = 0;
                state.lastRenderedSecond = -1;
                state.timeLimitAcknowledged = false;
                state.routeCheckpointIndex = 0;
                state.pendingRouteCheckpoint = null;
                state.remoteRunId = null;
                state.routeValidationState = 'offline';
                void startRemoteMazeRun(maze);
                renderHud(true, getRouteStatus(maze), false);
                previousPosition = { x: position.x, z: position.z };
                return;
            }
            renderHud(false, '', false);
            previousPosition = { x: position.x, z: position.z };
            return;
        }

        if (state.status === 'running') {
            state.elapsedMs = Math.max(0, nowMs - state.startedAt);
            processRouteCheckpoint(position, maze);
            const routeCheckpointCount = Number(maze.routeCheckpointCount || maze.routeCheckpoints?.length || 0);
            const routeReady = (!state.remoteRunId && state.routeValidationState !== 'starting')
                || state.routeValidationState === 'invalid'
                || (state.routeValidationState === 'active'
                    && state.routeCheckpointIndex >= routeCheckpointCount
                    && !state.pendingRouteCheckpoint);
            if (isNearFinish && routeReady) {
                state.status = 'complete';
                const completedRecord = saveCompletedRecord();
                renderCompletionPrompt(true);
                void syncCompletedRecord(completedRecord);
                renderHud(true, 'Meta alcanzada', false);
                previousPosition = { x: position.x, z: position.z };
                return;
            }
            if (isNearFinish && !routeReady) {
                renderHud(true, getRouteStatus(maze), Boolean(nearbyPanicStation));
                previousPosition = { x: position.x, z: position.z };
                return;
            }
            if (state.elapsedMs >= TIME_LIMIT_MS && isInMazeArea && !state.timeLimitAcknowledged) {
                state.status = 'limit-prompt';
                renderTimeLimitPrompt(true);
                renderHud(true, 'Decide si deseas continuar', false);
                previousPosition = { x: position.x, z: position.z };
                return;
            }
            renderHud(true, getRouteStatus(maze), Boolean(nearbyPanicStation));
            previousPosition = { x: position.x, z: position.z };
            return;
        }

        if (state.status === 'limit-prompt') {
            renderTimeLimitPrompt(true);
            renderHud(true, 'Decide si deseas continuar', false);
            previousPosition = { x: position.x, z: position.z };
            return;
        }

        renderHud(isInMazeArea && state.status === 'complete', 'Meta alcanzada', false);
        previousPosition = { x: position.x, z: position.z };
    }

    function resetMallMazeGame() {
        resetJourneyState();
        renderTimeLimitPrompt(false);
        renderCompletionPrompt(false);
        renderHud(false, '', false);
    }

    window.updateMallMazeGame = updateMallMazeGame;
    window.mallMazeGame = {
        getState: () => ({ ...state }),
        reset: resetMallMazeGame
    };
})();
