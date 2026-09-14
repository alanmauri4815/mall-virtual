        (() => {
            const ANALYTICS_RPC = 'record_analytics_event';
            const SESSION_STORAGE_KEY = window.mallContext?.storageKey('mall_analytics_session_v1') || 'mall_analytics_session_v1';
            const SESSION_IDLE_MS = 30 * 60 * 1000;
            const MAX_QUEUE_SIZE = 120;
            const ATTENTION_SAMPLE_MS = 200;
            const ATTENTION_MIN_MS = 3000;
            const ATTENTION_LOSS_GRACE_MS = 350;
            const ATTENTION_ENTER_DISTANCE = 2.0;
            const ATTENTION_EXIT_DISTANCE = 2.3;
            const ATTENTION_ENTER_DOT = Math.cos(THREE.MathUtils.degToRad(30));
            const ATTENTION_EXIT_DOT = Math.cos(THREE.MathUtils.degToRad(38));
            const TRACKABLE_EVENTS = new Set([
                'session_started',
                'mall_entered',
                'search_opened',
                'search_submitted',
                'search_result_clicked',
                'route_requested',
                'store_attention_qualified',
                'store_attention_ended',
                'store_opened',
                'product_viewed',
                'contact_clicked',
                'message_sent',
                'login_succeeded',
                'zone_entered',
                'maze_started',
                'maze_completed',
                'maze_exited',
                'assistant_question_sent',
                'feedback_submitted'
            ]);

            const queue = [];
            const onceKeys = new Set();
            const attentionRaycaster = new THREE.Raycaster();
            const attentionForward = new THREE.Vector3();
            const attentionTargetDirection = new THREE.Vector3();
            const attentionTargetWorld = new THREE.Vector3();
            let flushPromise = null;
            let backendRetryAt = 0;
            let backendInstalled = null;
            let lastAttentionSampleAt = 0;
            let searchTimer = 0;
            let pendingSearch = null;
            let attentionState = null;
            let lastZoneSampleAt = 0;
            let currentZone = '';

            function createUuid() {
                if (window.crypto?.randomUUID) return window.crypto.randomUUID();
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
                    const random = Math.floor(Math.random() * 16);
                    const value = character === 'x' ? random : ((random & 0x3) | 0x8);
                    return value.toString(16);
                });
            }

            function getSupabaseClient() {
                try {
                    return typeof supabaseClient !== 'undefined' ? supabaseClient : null;
                } catch (_) {
                    return null;
                }
            }

            function getDeviceClass() {
                const shortestSide = Math.min(window.innerWidth || 0, window.innerHeight || 0);
                if (shortestSide && shortestSide < 600) return 'mobile';
                if (shortestSide && shortestSide < 900) return 'tablet';
                return 'desktop';
            }

            function loadSession() {
                const now = Date.now();
                try {
                    const stored = JSON.parse(window.sessionStorage.getItem(SESSION_STORAGE_KEY) || 'null');
                    if (
                        stored?.id
                        && Number.isFinite(stored.lastActivityAt)
                        && now - stored.lastActivityAt <= SESSION_IDLE_MS
                    ) {
                        stored.lastActivityAt = now;
                        window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stored));
                        return stored;
                    }
                } catch (_) {
                    // El navegador puede bloquear sessionStorage; se usa una sesion en memoria.
                }
                const created = { id: createUuid(), startedAt: now, lastActivityAt: now };
                try {
                    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(created));
                } catch (_) {}
                return created;
            }

            let session = loadSession();

            function touchSession() {
                const now = Date.now();
                if (now - session.lastActivityAt > SESSION_IDLE_MS) {
                    session = { id: createUuid(), startedAt: now, lastActivityAt: now };
                    onceKeys.clear();
                    enqueueEvent('session_started', {}, true);
                } else {
                    session.lastActivityAt = now;
                }
                try {
                    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
                } catch (_) {}
            }

            function cleanSearchTerm(value) {
                const normalized = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
                if (!normalized || normalized.includes('@') || /(?:\+?\d[\s().-]*){7,}/.test(normalized)) return '';
                return normalized;
            }

            function normalizeProductId(value) {
                const normalized = String(value ?? '').trim();
                if (/^[1-9][0-9]*$/.test(normalized)) return normalized;
                if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
                    return normalized.toLowerCase();
                }
                return null;
            }

            function buildRpcPayload(eventName, details = {}) {
                return {
                    p_mall_id: window.mallContext?.id || null,
                    p_client_event_id: details.clientEventId || createUuid(),
                    p_session_id: session.id,
                    p_event_name: eventName,
                    p_store_code: String(details.storeCode || '').trim() || null,
                    p_product_id: normalizeProductId(details.productId),
                    p_search_term: cleanSearchTerm(details.searchTerm) || null,
                    p_channel: String(details.channel || '').trim().toLowerCase() || null,
                    p_source: String(details.source || '').trim().toLowerCase().slice(0, 40) || null,
                    p_item_label: String(details.itemLabel || '').trim().slice(0, 120) || null,
                    p_duration_ms: Number.isFinite(details.durationMs) ? Math.max(0, Math.round(details.durationMs)) : null,
                    p_result_count: Number.isFinite(details.resultCount) ? Math.max(0, Math.round(details.resultCount)) : null,
                    p_device_class: getDeviceClass()
                };
            }

            function isMissingAnalyticsBackend(error) {
                const message = String(error?.message || '').toLowerCase();
                return (
                    message.includes('record_analytics_event')
                    || message.includes('get_store_analytics')
                    || message.includes('get_mall_analytics')
                    || message.includes('schema cache')
                    || message.includes('could not find the function')
                );
            }

            async function flushQueue() {
                if (flushPromise) return flushPromise;
                if (Date.now() < backendRetryAt) return null;
                const client = getSupabaseClient();
                if (!client || !queue.length) return null;

                flushPromise = (async () => {
                    while (queue.length) {
                        const payload = queue[0];
                        const { error } = await client.rpc(ANALYTICS_RPC, payload);
                        if (error) {
                            backendInstalled = isMissingAnalyticsBackend(error) ? false : backendInstalled;
                            backendRetryAt = Date.now() + (isMissingAnalyticsBackend(error) ? 60000 : 10000);
                            if (!isMissingAnalyticsBackend(error)) {
                                console.warn('[Analitica] Evento no registrado:', error.message);
                            }
                            break;
                        }
                        backendInstalled = true;
                        document.documentElement.dataset.mallAnalyticsReady = 'true';
                        queue.shift();
                    }
                })().finally(() => {
                    flushPromise = null;
                });
                return flushPromise;
            }

            function enqueueEvent(eventName, details = {}, skipTouch = false) {
                if (!TRACKABLE_EVENTS.has(eventName)) return false;
                if (!skipTouch) touchSession();
                queue.push(buildRpcPayload(eventName, details));
                if (queue.length > MAX_QUEUE_SIZE) queue.splice(0, queue.length - MAX_QUEUE_SIZE);
                void flushQueue();
                return true;
            }

            function track(eventName, details = {}) {
                return enqueueEvent(eventName, details);
            }

            function trackOnce(key, eventName, details = {}) {
                if (onceKeys.has(key)) return false;
                onceKeys.add(key);
                return track(eventName, details);
            }

            function startMallSession(identity = {}) {
                trackOnce(`session_started:${session.id}`, 'session_started', {
                    source: identity.source || 'mall'
                });
                trackOnce(`mall_entered:${session.id}`, 'mall_entered', {
                    source: identity.role || 'guest'
                });
                if (identity.role && identity.role !== 'guest') {
                    trackOnce(`login_succeeded:${session.id}:${identity.role}`, 'login_succeeded', {
                        source: identity.role
                    });
                }
            }

            function trackSearch(searchTerm, resultCount) {
                const cleanTerm = cleanSearchTerm(searchTerm);
                if (!cleanTerm) return;
                pendingSearch = { searchTerm: cleanTerm, resultCount };
                window.clearTimeout(searchTimer);
                searchTimer = window.setTimeout(() => {
                    if (!pendingSearch) return;
                    track('search_submitted', pendingSearch);
                    pendingSearch = null;
                }, 650);
            }

            function getStoreCodeFromGroup(group) {
                return String(
                    group?.userData?.shopCode
                    || group?.userData?.plateCode
                    || group?.userData?.displayCode
                    || ''
                ).trim();
            }

            function isDescendantOf(object, root) {
                let current = object;
                while (current) {
                    if (current === root) return true;
                    current = current.parent;
                }
                return false;
            }

            function isIgnoredOccluder(hit) {
                const object = hit?.object;
                if (!object || object.visible === false) return true;
                if (object.userData?.isPlaqueHitbox) return true;
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                return materials.every((material) => (
                    !material
                    || material.visible === false
                    || (material.transparent && Number(material.opacity) <= 0.03)
                ));
            }

            function hasAttentionLineOfSight(group, targetWorld, distance) {
                attentionTargetDirection.copy(targetWorld).sub(camera.position);
                const rayLength = attentionTargetDirection.length();
                if (rayLength <= 0.001) return false;
                attentionTargetDirection.normalize();
                attentionRaycaster.set(camera.position, attentionTargetDirection);
                attentionRaycaster.near = 0.05;
                attentionRaycaster.far = Math.min(distance + 0.35, rayLength + 0.35);
                const hits = attentionRaycaster.intersectObjects(scene.children, true);
                for (const hit of hits) {
                    if (hit.distance > rayLength + 0.2) break;
                    if (isDescendantOf(hit.object, group)) return true;
                    if (isIgnoredOccluder(hit)) continue;
                    return false;
                }
                return true;
            }

            function isAttentionEnvironmentActive() {
                if (document.hidden) return false;
                if (typeof hasEnteredMall === 'undefined' || !hasEnteredMall) return false;
                if (typeof isWalking === 'undefined' || !isWalking) return false;
                const blockingSelectors = [
                    '#login-overlay',
                    '#store-modal',
                    '#search-modal',
                    '#mall-intro-modal',
                    '#super-admin-modal',
                    '#tenant-admin-modal'
                ];
                return !blockingSelectors.some((selector) => {
                    const element = document.querySelector(selector);
                    if (!element) return false;
                    const style = window.getComputedStyle(element);
                    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01;
                });
            }

            function findAttentionCandidate() {
                if (!isAttentionEnvironmentActive()) return null;
                if (typeof allStoreGroups === 'undefined' || !Array.isArray(allStoreGroups)) return null;

                camera.getWorldDirection(attentionForward);
                attentionForward.y = 0;
                if (attentionForward.lengthSq() < 0.001) return null;
                attentionForward.normalize();

                let best = null;
                const currentCode = attentionState?.storeCode || '';

                for (const group of allStoreGroups) {
                    if (!group?.userData?.isBoutique || group.visible === false) continue;
                    const storeCode = getStoreCodeFromGroup(group);
                    if (!storeCode) continue;

                    const localCamera = group.worldToLocal(camera.position.clone());
                    if (localCamera.y < 0.35 || localCamera.y > 5.4) continue;

                    const frontZ = 9.05;
                    const halfWidth = 6;
                    const frontDepth = localCamera.z - frontZ;
                    const sameCandidate = storeCode === currentCode;
                    const maxDistance = sameCandidate ? ATTENTION_EXIT_DISTANCE : ATTENTION_ENTER_DISTANCE;
                    if (frontDepth < -0.12 || frontDepth > maxDistance) continue;

                    const nearestX = THREE.MathUtils.clamp(localCamera.x, -halfWidth, halfWidth);
                    const outsideX = localCamera.x - nearestX;
                    const distance = Math.hypot(outsideX, Math.max(0, frontDepth));
                    if (distance > maxDistance) continue;
                    const incidenceDot = distance <= 0.001
                        ? 1
                        : Math.max(0, frontDepth) / distance;

                    attentionTargetWorld.set(
                        nearestX,
                        THREE.MathUtils.clamp(localCamera.y, 1.0, 3.2),
                        frontZ
                    );
                    group.localToWorld(attentionTargetWorld);
                    attentionTargetDirection.copy(attentionTargetWorld).sub(camera.position);
                    attentionTargetDirection.y = 0;
                    if (attentionTargetDirection.lengthSq() < 0.001) continue;
                    attentionTargetDirection.normalize();

                    const directionDot = attentionForward.dot(attentionTargetDirection);
                    const minimumDot = sameCandidate ? ATTENTION_EXIT_DOT : ATTENTION_ENTER_DOT;
                    if (directionDot < minimumDot) continue;
                    if (incidenceDot < minimumDot) continue;
                    if (!hasAttentionLineOfSight(group, attentionTargetWorld, distance)) continue;

                    const score = directionDot * 3 + incidenceDot - distance * 0.6;
                    if (!best || score > best.score) {
                        best = { group, storeCode, distance, directionDot, incidenceDot, score };
                    }
                }
                return best;
            }

            function finishAttention(nowMs) {
                if (!attentionState) return;
                const durationMs = Math.max(0, nowMs - attentionState.startedAt);
                if (attentionState.qualified) {
                    track('store_attention_ended', {
                        storeCode: attentionState.storeCode,
                        durationMs,
                        source: 'frontage'
                    });
                }
                attentionState = null;
            }

            function getCurrentZone() {
                if (typeof camera === 'undefined' || !camera?.position) return '';
                const { x, y, z } = camera.position;
                const floor = y >= 5 ? 'Planta 2' : 'Planta 1';
                const horizontal = Math.abs(x) >= Math.abs(z)
                    ? (x >= 8 ? 'Oriente' : x <= -8 ? 'Poniente' : 'Centro')
                    : (z >= 8 ? 'Norte' : z <= -8 ? 'Sur' : 'Centro');
                return `${floor} · ${horizontal}`;
            }

            function updateZoneActivity(nowMs) {
                if (nowMs - lastZoneSampleAt < 5000) return;
                lastZoneSampleAt = nowMs;
                if (!isAttentionEnvironmentActive()) return;
                const nextZone = getCurrentZone();
                if (!nextZone || nextZone === currentZone) return;
                currentZone = nextZone;
                track('zone_entered', { source: 'navigation', itemLabel: nextZone });
            }

            function updateAttention(nowMs = performance.now()) {
                updateZoneActivity(nowMs);
                if (nowMs - lastAttentionSampleAt < ATTENTION_SAMPLE_MS) return;
                lastAttentionSampleAt = nowMs;
                const candidate = findAttentionCandidate();

                if (!candidate) {
                    if (!attentionState) return;
                    if (!attentionState.lostAt) attentionState.lostAt = nowMs;
                    if (nowMs - attentionState.lostAt >= ATTENTION_LOSS_GRACE_MS) {
                        finishAttention(nowMs);
                    }
                    return;
                }

                if (!attentionState || attentionState.storeCode !== candidate.storeCode) {
                    finishAttention(nowMs);
                    attentionState = {
                        storeCode: candidate.storeCode,
                        startedAt: nowMs,
                        lostAt: 0,
                        qualified: false
                    };
                    return;
                }

                attentionState.lostAt = 0;
                const durationMs = nowMs - attentionState.startedAt;
                if (!attentionState.qualified && durationMs >= ATTENTION_MIN_MS) {
                    attentionState.qualified = true;
                    track('store_attention_qualified', {
                        storeCode: attentionState.storeCode,
                        durationMs: ATTENTION_MIN_MS,
                        source: 'frontage'
                    });
                }
            }

            function formatNumber(value) {
                return new Intl.NumberFormat('es-CL').format(Number(value) || 0);
            }

            function formatRate(numerator, denominator) {
                if (!Number(denominator)) return '0%';
                return `${Math.min(999, Math.round((Number(numerator) / Number(denominator)) * 100))}%`;
            }

            function setText(id, value) {
                const element = document.getElementById(id);
                if (element) element.textContent = value;
            }

            function renderDailyBars(containerId, daily = [], key = 'unique_visitors') {
                const container = document.getElementById(containerId);
                if (!container) return;
                container.textContent = '';
                const values = daily.map((row) => Number(row?.[key]) || 0);
                const maximum = Math.max(1, ...values);
                daily.forEach((row, index) => {
                    const bar = document.createElement('span');
                    bar.className = 'analytics-daily-bar';
                    bar.style.height = `${Math.max(4, Math.round((values[index] / maximum) * 100))}%`;
                    bar.title = `${row.day}: ${formatNumber(values[index])}`;
                    container.appendChild(bar);
                });
            }

            function renderRankedList(containerId, rows, labelKey, valueKey, emptyCopy) {
                const container = document.getElementById(containerId);
                if (!container) return;
                container.textContent = '';
                if (!Array.isArray(rows) || !rows.length) {
                    const empty = document.createElement('p');
                    empty.className = 'analytics-empty';
                    empty.textContent = emptyCopy;
                    container.appendChild(empty);
                    return;
                }
                rows.forEach((row, index) => {
                    const item = document.createElement('div');
                    item.className = 'analytics-ranked-row';
                    const label = document.createElement('span');
                    label.textContent = `${index + 1}. ${row?.[labelKey] || 'Sin nombre'}`;
                    const value = document.createElement('strong');
                    value.textContent = formatNumber(row?.[valueKey]);
                    item.append(label, value);
                    container.appendChild(item);
                });
            }

            async function loadTenantDashboard(storeId) {
                const status = document.getElementById('tenant-analytics-status');
                if (!storeId || !getSupabaseClient()) return;
                const days = Number(document.getElementById('tenant-analytics-period')?.value || 30);
                if (status) status.textContent = 'Actualizando estadísticas...';
                const { data, error } = await getSupabaseClient().rpc('get_store_analytics', {
                    p_store_id: String(storeId),
                    p_days: days
                });
                if (error) {
                    if (status) {
                        status.textContent = isMissingAnalyticsBackend(error)
                            ? 'Activa el módulo ejecutando supabase/analytics_foundation_20260726.sql.'
                            : `No se pudieron cargar las estadísticas: ${error.message}`;
                    }
                    return;
                }
                const summary = data?.summary || {};
                setText('tenant-metric-visitors', formatNumber(summary.unique_visitors));
                setText('tenant-metric-attention', formatNumber(summary.attention_count));
                setText('tenant-metric-opens', formatNumber(summary.store_opens));
                setText('tenant-metric-products', formatNumber(summary.product_views));
                setText('tenant-metric-contacts', formatNumber(summary.contact_actions));
                setText('tenant-metric-conversion', formatRate(summary.contact_actions, summary.attention_count || summary.store_opens));
                setText('tenant-metric-attention-time', `${Number(summary.average_attention_seconds || 0).toFixed(1)} s`);
                setText('tenant-metric-no-action', formatNumber(summary.attention_without_action));
                renderDailyBars('tenant-analytics-daily', data?.daily || []);
                renderRankedList(
                    'tenant-analytics-products',
                    data?.top_products || [],
                    'product_name',
                    'view_count',
                    'Aún no hay productos vistos en este período.'
                );
                renderRankedList(
                    'tenant-analytics-searches',
                    data?.top_searches || [],
                    'search_term',
                    'click_count',
                    'Aún no hay búsquedas que conduzcan a este local.'
                );
                if (status) status.textContent = `Datos de los últimos ${data?.days || days} días.`;
            }

            async function loadAdminDashboard() {
                const status = document.getElementById('admin-analytics-status');
                const client = getSupabaseClient();
                if (!client) return;
                const days = Number(document.getElementById('admin-analytics-period')?.value || 30);
                if (status) status.textContent = 'Actualizando estadísticas...';
                const { data, error } = await client.rpc('get_mall_analytics_scoped', {
                    p_mall_id: window.mallContext?.id || null,
                    p_days: days
                });
                if (error) {
                    if (status) {
                        status.textContent = isMissingAnalyticsBackend(error)
                            ? 'Activa el módulo ejecutando supabase/mall_operations_observability_20260913.sql.'
                            : `No se pudieron cargar las estadísticas: ${error.message}`;
                    }
                    return;
                }
                const summary = data?.summary || {};
                setText('admin-metric-visitors', formatNumber(summary.unique_visitors));
                setText('admin-metric-entries', formatNumber(summary.mall_entries));
                setText('admin-metric-attention', formatNumber(summary.attention_count));
                setText('admin-metric-opens', formatNumber(summary.store_opens));
                setText('admin-metric-products', formatNumber(summary.product_views));
                setText('admin-metric-contacts', formatNumber(summary.contact_actions));
                setText('admin-metric-searches', formatNumber(summary.searches));
                setText('admin-metric-missed-searches', formatNumber(summary.searches_without_results));
                renderDailyBars('admin-analytics-daily', data?.daily || []);
                renderRankedList(
                    'admin-analytics-stores',
                    data?.top_stores || [],
                    'name',
                    'activity_score',
                    'Aún no hay actividad suficiente para ordenar locales.'
                );
                renderRankedList(
                    'admin-analytics-missed',
                    data?.searches_without_results || [],
                    'search_term',
                    'search_count',
                    'No hay búsquedas sin resultados en este período.'
                );
                if (status) {
                    status.textContent = Number(summary.unique_visitors || 0)
                        ? `Datos agregados de los últimos ${data?.days || days} días.`
                        : `Aún no hay actividad registrada en los últimos ${data?.days || days} días.`;
                }
            }

            function renderOperationalActivity(containerId, rows = [], emptyCopy) {
                const container = document.getElementById(containerId);
                if (!container) return;
                container.textContent = '';
                if (!Array.isArray(rows) || !rows.length) {
                    const empty = document.createElement('p');
                    empty.className = 'analytics-empty';
                    empty.textContent = emptyCopy;
                    container.appendChild(empty);
                    return;
                }
                rows.forEach((row) => {
                    const item = document.createElement('div');
                    item.className = 'operations-activity-row';
                    const label = document.createElement('span');
                    const detail = document.createElement('span');
                    label.textContent = row?.label || row?.event_label || 'Actividad';
                    detail.textContent = row?.detail || row?.occurred_label || '';
                    item.append(label, detail);
                    container.appendChild(item);
                });
            }

            async function loadAdminOperationsDashboard() {
                const status = document.getElementById('admin-operations-status');
                const client = getSupabaseClient();
                const mallId = window.mallContext?.id || null;
                if (!client || !mallId) return;
                const days = Number(document.getElementById('admin-operations-period')?.value || 30);
                if (status) status.textContent = 'Actualizando actividad operacional...';
                const { data, error } = await client.rpc('get_mall_operations_dashboard', {
                    p_mall_id: mallId,
                    p_days: days
                });
                if (error) {
                    if (status) {
                        const missing = String(error.message || '').toLowerCase().includes('get_mall_operations_dashboard')
                            || String(error.message || '').toLowerCase().includes('schema cache');
                        status.textContent = missing
                            ? 'Activa este panel ejecutando supabase/mall_operations_observability_20260913.sql.'
                            : `No se pudo cargar la operación: ${error.message}`;
                    }
                    return;
                }
                const summary = data?.summary || {};
                setText('admin-ops-active', formatNumber(summary.active_last_15_minutes));
                setText('admin-ops-maze-started', formatNumber(summary.maze_started));
                setText('admin-ops-maze-completed', formatNumber(summary.maze_completed));
                setText('admin-ops-assistant', formatNumber(summary.assistant_questions));
                setText('admin-ops-feedback', formatNumber(summary.feedback_submitted));
                renderRankedList('admin-ops-zones', data?.zones || [], 'zone_name', 'visitor_count', 'Aún no hay recorridos registrados.');
                renderRankedList('admin-ops-conversations', data?.conversations || [], 'label', 'question_count', 'Aún no hay consultas registradas.');
                renderRankedList('admin-ops-roles', data?.roles || [], 'role_name', 'entry_count', 'Aún no hay ingresos registrados.');
                renderRankedList('admin-ops-feedback-list', data?.feedback || [], 'label', 'count', 'No hay sugerencias ni reclamos en este período.');
                renderOperationalActivity('admin-ops-recent', data?.recent_activity || [], 'Aún no hay actividad reciente.');
                if (status) status.textContent = `Datos operacionales de los últimos ${data?.days || days} días.`;
            }

            document.addEventListener('click', (event) => {
                const link = event.target.closest('a');
                if (!link) return;
                if (link.id === 'store-mailto-btn') {
                    track('contact_clicked', { storeCode: currentModalStoreCode, channel: 'email', source: 'store_modal' });
                } else if (link.id === 'store-whatsapp-btn') {
                    track('contact_clicked', { storeCode: currentModalStoreCode, channel: 'whatsapp', source: 'store_modal' });
                } else if (link.closest('#modal-store-links')) {
                    track('contact_clicked', { storeCode: currentModalStoreCode, channel: 'social', source: 'store_modal' });
                }
            });

            const refreshTenantDashboard = () => {
                try {
                    const selectedStoreId = myOwnedStore?.id || myOwnedStore?.local_code || currentModalStoreCode;
                    if (selectedStoreId) void loadTenantDashboard(selectedStoreId);
                } catch (_) {}
            };
            document.getElementById('tenant-analytics-refresh')?.addEventListener('click', refreshTenantDashboard);
            document.getElementById('tenant-analytics-period')?.addEventListener('change', refreshTenantDashboard);
            document.getElementById('admin-analytics-refresh')?.addEventListener('click', () => void loadAdminDashboard());
            document.getElementById('admin-analytics-period')?.addEventListener('change', () => void loadAdminDashboard());
            document.getElementById('admin-operations-refresh')?.addEventListener('click', () => void loadAdminOperationsDashboard());
            document.getElementById('admin-operations-period')?.addEventListener('change', () => void loadAdminOperationsDashboard());

            window.addEventListener('online', () => {
                backendRetryAt = 0;
                void flushQueue();
            });
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) finishAttention(performance.now());
            });
            window.addEventListener('pagehide', () => finishAttention(performance.now()));

            window.mallAnalytics = {
                track,
                trackOnce,
                trackSearch,
                startMallSession,
                updateAttention,
                loadTenantDashboard,
                loadAdminDashboard,
                loadAdminOperationsDashboard,
                getBackendStatus: () => backendInstalled
            };

            if (window.__pendingMallAnalyticsIdentity) {
                startMallSession(window.__pendingMallAnalyticsIdentity);
                delete window.__pendingMallAnalyticsIdentity;
            }
        })();
