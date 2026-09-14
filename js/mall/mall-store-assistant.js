(function () {
    'use strict';

    const mallAssistantScopeQuery = (query) => window.mallContext?.scopeQuery
        ? window.mallContext.scopeQuery(query)
        : query;
    const mallAssistantScopePayload = (payload) => window.mallContext?.scopePayload
        ? window.mallContext.scopePayload(payload)
        : payload;

    const DEFAULT_HANDOFF = 'Veo que tienes varias preguntas y quiero que recibas una respuesta completa. Si gustas, déjame tu nombre y un medio de contacto. Enviaré tu consulta a la persona encargada de la tienda, quien estará encantada de responderte personalmente.';
    const DEFAULT_SETTINGS = {
        enabled: true,
        assistant_name: 'Asistente',
        greeting: 'Hola. Bienvenido a nuestra tienda. ¿En qué puedo ayudarte?',
        store_brief: '',
        handoff_message: DEFAULT_HANDOFF,
        faq: [],
        max_turns: 4,
        question_max_chars: 300,
        answer_max_words: 80
    };
    const MALL_ASSISTANT_CODE = '__MALL__';
    const DEFAULT_MALL_SETTINGS = {
        enabled: true,
        assistant_name: 'Asistente del Mall',
        greeting: 'Hola. Soy el asistente del Mall Emprendimientos. ¿Qué información necesitas?',
        mall_brief: '',
        handoff_message: 'Si no encontraste la información que buscas, puedes dejar un reclamo o sugerencia para que la administración del mall lo revise.',
        faq: [],
        max_turns: 4,
        question_max_chars: 300,
        answer_max_words: 80
    };
    const settingsByCode = new Map();
    const attendantsByCode = new Map();
    const conversationsByCode = new Map();
    let activeStoreCode = '';
    let activeStoreData = null;
    let assistantBusy = false;
    let lastAttendantStreamAt = 0;
    let mallAssistantSettings = { ...DEFAULT_MALL_SETTINGS };
    const attendantStreamProbe = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;

    window.mallStoreAttendantTargets = window.mallStoreAttendantTargets || [];

    function canonicalCode(value) {
        const raw = String(value || '').trim().toUpperCase();
        if (!raw) return '';
        const compact = raw.replace(/-/g, '');
        return compact.replace(/^([A-Z]+)(\d+)$/, '$1-$2');
    }

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9ñ]+/g, ' ')
            .trim();
    }

    function normalizeSentence(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function limitWords(value, maxWords) {
        const words = String(value || '').trim().split(/\s+/).filter(Boolean);
        return words.length <= maxWords ? words.join(' ') : `${words.slice(0, maxWords).join(' ')}…`;
    }

    function getStoreRecord(code) {
        const wanted = canonicalCode(code);
        return (window.supabaseStoresCache || []).find((store) => (
            canonicalCode(store.local_code) === wanted
            || canonicalCode(store.id) === wanted
        )) || null;
    }

    function hasMeaningfulStoreName(store) {
        const name = normalizeText(store?.name);
        if (!name) return false;
        const localCode = normalizeText(canonicalCode(store?.local_code));
        const storeId = normalizeText(canonicalCode(store?.id));
        return name !== localCode
            && name !== storeId
            && name !== 'local disponible';
    }

    function hasPublicCatalogProducts(store) {
        const cache = window.storeProductsCache;
        if (!cache?.size) return false;
        const keys = [
            store?.local_code,
            store?.id,
            canonicalCode(store?.local_code),
            canonicalCode(store?.id)
        ].filter(Boolean);
        return keys.some((key) => {
            const list = cache.get(key);
            return Array.isArray(list) && list.some((item) => item && (item.name || item.n || item.image_url || item.photo_url));
        });
    }

    function isAssistantEligibleStore(store) {
        if (!store) return false;
        if (store.owner_id) return true;
        if (String(store.service_status || 'active').toLowerCase() === 'suspended') return false;
        const logoUrl = typeof safeImageUrl === 'function'
            ? safeImageUrl(store.logo_url || '')
            : String(store.logo_url || '').trim();
        return !!(
            logoUrl
            || hasMeaningfulStoreName(store)
            || hasPublicCatalogProducts(store)
        );
    }

    function getPilotSettings(store) {
        const code = canonicalCode(store?.local_code || store?.id);
        if (!isAssistantEligibleStore(store)) return null;
        if (code === 'E-105') {
            return {
                ...DEFAULT_SETTINGS,
                store_id: store.id,
                assistant_name: 'Isabella',
                greeting: 'Hola, soy Isabella. Bienvenido a Isabella Joyas. ¿En qué puedo ayudarte?'
            };
        }
        return {
            ...DEFAULT_SETTINGS,
            store_id: store.id,
            assistant_name: 'Asistente',
            greeting: `Hola, soy el asistente de ${store.name || 'esta tienda'}. ¿En qué puedo ayudarte?`
        };
    }

    function getGroupForStore(code) {
        const candidates = [];
        const add = (group) => {
            if (group && !candidates.includes(group)) candidates.push(group);
        };
        const wanted = canonicalCode(code);
        if (typeof getStoreGroupCollection === 'function') {
            getStoreGroupCollection(wanted).forEach(add);
            getStoreGroupCollection(wanted.replace(/-/g, '')).forEach(add);
        }
        if (typeof storeGroups !== 'undefined') {
            add(storeGroups[wanted]);
            add(storeGroups[wanted.replace(/-/g, '')]);
        }
        return candidates.sort((a, b) => {
            const score = (group) => canonicalCode(
                group?.userData?.plateCode
                || group?.userData?.physicalSpaceMeta?.displayCode
                || group?.userData?.shopCode
            ) === wanted ? 0 : 1;
            return score(a) - score(b);
        })[0] || null;
    }

    function removeAttendant(code) {
        const actor = attendantsByCode.get(code);
        if (!actor) return;
        const targetIndex = window.mallStoreAttendantTargets.indexOf(actor.mesh);
        if (targetIndex >= 0) window.mallStoreAttendantTargets.splice(targetIndex, 1);
        actor.label?.remove();
        actor.mesh?.parent?.remove(actor.mesh);
        actor.mesh?.traverse?.((object) => {
            object.geometry?.dispose?.();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.filter(Boolean).forEach((material) => material.dispose?.());
        });
        attendantsByCode.delete(code);
    }

    function resolveAttendantLocalPosition(group, code) {
        const preferRight = String(code || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 2 === 0;
        const side = preferRight ? 1 : -1;
        const candidates = [
            new THREE.Vector3(1.7 * side, 0, 2.45),
            new THREE.Vector3(-1.7 * side, 0, 2.45),
            new THREE.Vector3(0, 0, 2.1),
            new THREE.Vector3(1.5 * side, 0, 0.55)
        ];
        if (typeof checkCollision !== 'function') return candidates[0];

        const floorOffset = typeof AVATAR_FLOOR_OFFSET === 'number' ? AVATAR_FLOOR_OFFSET : 0.05;
        return candidates.find((candidate) => {
            const world = group.localToWorld(candidate.clone());
            return !checkCollision(world.x, world.y + floorOffset + 1, world.z, {
                includeActors: false,
                collisionRadius: 0.48
            });
        }) || new THREE.Vector3(0, 0, 2.1);
    }

    function createAttendant(code, store, settings) {
        const group = getGroupForStore(code);
        if (!group || typeof createProceduralAvatar !== 'function' || typeof THREE === 'undefined') return null;
        const actor = createProceduralAvatar(`${settings.assistant_name} · ${store.name || code}`, 'female-formal');
        const localPosition = resolveAttendantLocalPosition(group, code);
        const worldPosition = group.localToWorld(localPosition.clone());
        const worldForwardPoint = group.localToWorld(new THREE.Vector3(localPosition.x, 0, localPosition.z + 1));
        const forward = worldForwardPoint.sub(worldPosition);
        const floorOffset = typeof AVATAR_FLOOR_OFFSET === 'number' ? AVATAR_FLOOR_OFFSET : 0.05;
        actor.mesh.position.set(worldPosition.x, worldPosition.y + floorOffset, worldPosition.z);
        actor.mesh.rotation.y = Math.atan2(forward.x, forward.z);
        actor.attendantHomeRotationY = actor.mesh.rotation.y;
        actor.attendantLastFacingAt = performance.now();
        actor.mesh.visible = true;
        actor.isStoreAttendant = true;
        actor.storeCode = code;
        actor.storeGroup = group;
        actor.label.classList.add('store-attendant-label');
        actor.label.textContent = `ASISTENTE · ${store.name || code}`;
        actor.mesh.traverse((object) => {
            object.userData.playerId = '';
            object.userData.isStoreAttendant = true;
            object.userData.storeCode = code;
            object.userData.assistantName = settings.assistant_name;
        });
        window.mallStoreAttendantTargets.push(actor.mesh);
        attendantsByCode.set(code, actor);
        return actor;
    }

    async function loadEnabledSettings() {
        const stores = window.supabaseStoresCache || [];
        let rows = null;
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            const result = await supabaseClient.from('store_bot_settings').select('*').eq('enabled', true);
            if (!result.error) rows = result.data || [];
        }

        settingsByCode.clear();
        if (rows) {
            rows.forEach((row) => {
                const store = stores.find((item) => String(item.id) === String(row.store_id));
                if (!store || !isAssistantEligibleStore(store)) return;
                settingsByCode.set(canonicalCode(store.local_code || store.id), { ...DEFAULT_SETTINGS, ...row });
            });
        } else {
            stores.forEach((store) => {
                const pilot = getPilotSettings(store);
                if (pilot) settingsByCode.set(canonicalCode(store.local_code || store.id), pilot);
            });
        }
        settingsByCode.set(MALL_ASSISTANT_CODE, mallAssistantSettings);
        return settingsByCode;
    }

    async function loadMallAssistantSettings() {
        let row = null;
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            const result = await mallAssistantScopeQuery(
                supabaseClient
                    .from('mall_assistant_settings')
                    .select('*')
            )
                .eq('id', 1)
                .maybeSingle();
            if (!result.error && result.data) row = result.data;
        }
        mallAssistantSettings = { ...DEFAULT_MALL_SETTINGS, ...(row || {}) };
        settingsByCode.set(MALL_ASSISTANT_CODE, mallAssistantSettings);
        return mallAssistantSettings;
    }

    async function syncAttendants() {
        await loadEnabledSettings();
        [...attendantsByCode.keys()].forEach((code) => {
            if (!settingsByCode.has(code)) removeAttendant(code);
        });
        settingsByCode.forEach((settings, code) => {
            if (window.mallPerformanceProfile?.isLowEndMobile) return;
            const store = getStoreRecord(code);
            if (!isAssistantEligibleStore(store)) return;
            const existing = attendantsByCode.get(code);
            if (existing) {
                existing.label.textContent = `ASISTENTE · ${store.name || code}`;
                return;
            }
            createAttendant(code, store, settings);
        });
    }

    function streamConstrainedDeviceAttendants(nowMs) {
        if (!window.mallPerformanceProfile?.isLowEndMobile || !attendantStreamProbe || typeof camera === 'undefined') return;
        if (nowMs - lastAttendantStreamAt < 1200) return;
        lastAttendantStreamAt = nowMs;

        settingsByCode.forEach((settings, code) => {
            const store = getStoreRecord(code);
            const group = getGroupForStore(code);
            if (!isAssistantEligibleStore(store) || !group) return;
            group.getWorldPosition(attendantStreamProbe);
            const distance = camera.position.distanceTo(attendantStreamProbe);
            if (distance <= 34 && !attendantsByCode.has(code)) createAttendant(code, store, settings);
        });

        [...attendantsByCode.entries()].forEach(([code, actor]) => {
            if (camera.position.distanceTo(actor.mesh.position) > 46) removeAttendant(code);
        });
    }

    function getConversation(code) {
        if (!conversationsByCode.has(code)) {
            const storageKey = `mall_store_assistant_session_${code}`;
            let sessionId = sessionStorage.getItem(storageKey);
            if (!sessionId) {
                sessionId = typeof crypto.randomUUID === 'function'
                    ? crypto.randomUUID()
                    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                sessionStorage.setItem(storageKey, sessionId);
            }
            conversationsByCode.set(code, { sessionId, turns: 0, messages: [], handoffShown: false });
        }
        return conversationsByCode.get(code);
    }

    function appendMessage(role, text) {
        const list = document.getElementById('store-assistant-messages');
        if (!list) return;
        const item = document.createElement('div');
        item.className = `store-assistant-message is-${role}`;
        item.textContent = String(text || '');
        list.appendChild(item);
        list.scrollTop = list.scrollHeight;
    }

    function renderConversation(code) {
        const list = document.getElementById('store-assistant-messages');
        if (!list) return;
        const conversation = getConversation(code);
        const settings = settingsByCode.get(code) || DEFAULT_SETTINGS;
        const isMallAssistant = code === MALL_ASSISTANT_CODE;
        if (!conversation.messages.length) {
            conversation.messages.push({ role: 'bot', text: settings.greeting || DEFAULT_SETTINGS.greeting });
        }
        list.innerHTML = '';
        conversation.messages.forEach((message) => appendMessage(message.role, message.text));
        const leadForm = document.getElementById('store-assistant-lead-form');
        const feedbackForm = document.getElementById('mall-feedback-form');
        const feedbackToggle = document.getElementById('mall-feedback-toggle');
        if (leadForm) leadForm.hidden = isMallAssistant || !conversation.handoffShown;
        if (feedbackForm) feedbackForm.hidden = !isMallAssistant || (!conversation.handoffShown && !conversation.feedbackOpen);
        if (feedbackToggle) feedbackToggle.hidden = !isMallAssistant;
    }

    function showHandoff() {
        const code = activeStoreCode;
        if (!code) return;
        const conversation = getConversation(code);
        const isMallAssistant = code === MALL_ASSISTANT_CODE;
        if (!conversation.handoffShown) {
            const settings = settingsByCode.get(code) || DEFAULT_SETTINGS;
            conversation.handoffShown = true;
            conversation.messages.push({ role: 'bot', text: settings.handoff_message || DEFAULT_HANDOFF });
            appendMessage('bot', settings.handoff_message || DEFAULT_HANDOFF);
        }
        if (isMallAssistant) {
            conversation.feedbackOpen = true;
            document.getElementById('mall-feedback-form').hidden = false;
            document.getElementById('mall-feedback-toggle').hidden = true;
        } else {
            document.getElementById('store-assistant-lead-form').hidden = false;
        }
        document.getElementById('store-assistant-form').classList.add('is-locked');
        document.getElementById('store-assistant-quick-actions').classList.add('is-locked');
    }

    function localDirectAnswer(question, storeData, settings) {
        const q = normalizeText(question);
        const store = storeData?.storeRecord || {};
        const products = (storeData?.products || []).filter((product) => product?.n && product.n !== 'Consultar catálogo');
        const phone = storeData?.contactPhone || store.whatsapp || store.contact_phone;
        const email = storeData?.contactEmail || store.contact_email;
        const storeBrief = normalizeSentence(settings.store_brief || '');
        if (/\b(whatsapp|telefono|celular|contacto|contactar)\b/.test(q) && (phone || email)) {
            return `Puedes contactar a ${storeData.name}${phone ? ` por WhatsApp al ${phone}` : ''}${email ? `${phone ? ' o' : ''} por correo a ${email}` : ''}.`;
        }
        if (/\b(correo|email|mail)\b/.test(q) && email) return `El correo de ${storeData.name} es ${email}.`;
        if (storeBrief && /\b(de que trata|quienes son|que ofrecen|que hacen|de que se trata|sobre la tienda|sobre ustedes|cuentame de la tienda|cuentame del local|informacion de la tienda|informacion del local)\b/.test(q)) {
            return storeBrief;
        }
        const product = products.find((item) => {
            const productName = normalizeText(item.n);
            return productName && (q.includes(productName) || productName.split(' ').some((part) => part.length > 3 && q.includes(part)));
        });
        if (product) return `${product.n}${product.p && product.p !== '-' ? ` cuesta ${product.p}` : ' está disponible'}.${product.description ? ` ${product.description}` : ''}`;
        if (/\b(producto|productos|catalogo|venden|tienen|ofrecen|precio|precios)\b/.test(q) && products.length) {
            const sample = products.slice(0, 5).map((item) => `${item.n}${item.p && item.p !== '-' ? ` (${item.p})` : ''}`).join(', ');
            return `En ${storeData.name} puedes encontrar: ${sample}. Toca la placa dorada para revisar el catálogo completo.`;
        }
        const questionTerms = new Set(q.split(' ').filter((term) => term.length > 3));
        let best = null;
        let score = 0;
        (settings.faq || []).forEach((item) => {
            const nextScore = normalizeText(item.question).split(' ').filter((term) => term.length > 3 && questionTerms.has(term)).length;
            if (nextScore > score) {
                score = nextScore;
                best = item;
            }
        });
        return score > 0 ? best?.answer : '';
    }

    function localMallAnswer(question, settings) {
        const q = normalizeText(question);
        const brief = normalizeSentence(settings.mall_brief || '');
        if (brief && /\b(que es|de que trata|que ofrece|que hay|locales|tiendas|mall|centro comercial|informacion general|horario|ubicacion|como llegar|servicios)\b/.test(q)) {
            return brief;
        }
        const questionTerms = new Set(q.split(' ').filter((term) => term.length > 3));
        let best = null;
        let score = 0;
        (settings.faq || []).forEach((item) => {
            const nextScore = normalizeText(item.question).split(' ').filter((term) => term.length > 3 && questionTerms.has(term)).length;
            if (nextScore > score) {
                score = nextScore;
                best = item;
            }
        });
        return score > 0 ? best?.answer : '';
    }

    async function invokeAssistant(question, conversation) {
        if (typeof supabaseClient === 'undefined' || !supabaseClient?.functions) throw new Error('Función remota no disponible');
        const conversationHistory = conversation.messages
            .slice(0, -1)
            .filter((message) => message.role === 'user' || message.role === 'bot')
            .slice(-6)
            .map((message) => ({
                role: message.role === 'bot' ? 'assistant' : 'user',
                content: String(message.text || '').slice(0, 400)
            }));
        const { data, error } = await supabaseClient.functions.invoke('store-attendant', {
            body: {
                action: activeStoreCode === MALL_ASSISTANT_CODE ? 'mall_message' : 'message',
                scope: activeStoreCode === MALL_ASSISTANT_CODE ? 'mall' : 'store',
                mall_id: window.mallContext?.id || null,
                store_code: activeStoreCode === MALL_ASSISTANT_CODE ? '' : activeStoreCode,
                session_id: conversation.sessionId,
                question,
                conversation_history: conversationHistory
            }
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data;
    }

    async function askQuestion(rawQuestion) {
        if (assistantBusy || !activeStoreCode || !activeStoreData) return;
        const settings = settingsByCode.get(activeStoreCode) || DEFAULT_SETTINGS;
        const question = String(rawQuestion || '').trim();
        if (!question) return;
        if (question.length > settings.question_max_chars) {
            appendMessage('system', `La pregunta puede tener hasta ${settings.question_max_chars} caracteres.`);
            return;
        }
        const conversation = getConversation(activeStoreCode);
        const isMallAssistant = activeStoreCode === MALL_ASSISTANT_CODE;
        window.mallAnalytics?.track('assistant_question_sent', {
            storeCode: isMallAssistant ? null : activeStoreCode,
            source: isMallAssistant ? 'mall_assistant' : 'store_assistant',
            itemLabel: isMallAssistant ? 'Informaciones del mall' : (activeStoreData?.name || activeStoreCode)
        });
        if (conversation.turns >= settings.max_turns) {
            showHandoff();
            return;
        }

        conversation.messages.push({ role: 'user', text: question });
        appendMessage('user', question);
        conversation.turns += 1;
        assistantBusy = true;
        document.getElementById('store-assistant-modal').classList.add('is-busy');
        let answer = isMallAssistant
            ? localMallAnswer(question, settings)
            : localDirectAnswer(question, activeStoreData, settings);
        let forceHandoff = false;
        if (!answer) {
            try {
                const result = await invokeAssistant(question, conversation);
                answer = result?.answer || '';
                forceHandoff = !!result?.handoff_required;
            } catch (error) {
                console.warn('Asistente remoto no disponible; usando respuesta local:', error);
                answer = isMallAssistant
                    ? 'No encontré esa información en la inducción del mall. Puedes dejar un reclamo o sugerencia para que la administración lo revise.'
                    : 'No encontré esa información en el catálogo. Puedo registrar tus datos para que la persona encargada de la tienda te responda.';
                forceHandoff = true;
            }
        }
        assistantBusy = false;
        document.getElementById('store-assistant-modal').classList.remove('is-busy');
        answer = limitWords(answer, Number(settings.answer_max_words || 80));
        conversation.messages.push({ role: 'bot', text: answer });
        appendMessage('bot', answer);
        if (forceHandoff || conversation.turns >= settings.max_turns) showHandoff();
    }

    window.openStoreAssistant = async function (storeCode) {
        const code = canonicalCode(storeCode);
        if (!code || !settingsByCode.has(code)) return;
        activeStoreCode = code;
        activeStoreData = typeof getStoreData === 'function' ? await getStoreData(code) : null;
        if (!activeStoreData) return;
        const settings = settingsByCode.get(code) || DEFAULT_SETTINGS;
        document.getElementById('store-assistant-store').textContent = activeStoreData.name || code;
        document.getElementById('store-assistant-title').textContent = settings.assistant_name || 'Asistente';
        document.getElementById('store-assistant-input').maxLength = Number(settings.question_max_chars || 300);
        document.getElementById('store-assistant-char-count').nextSibling.textContent = `/${settings.question_max_chars || 300}`;
        document.getElementById('store-assistant-modal').style.display = 'flex';
        document.getElementById('modal-overlay').style.display = 'block';
        document.getElementById('store-assistant-lead-status').textContent = '';
        document.getElementById('mall-feedback-toggle').hidden = true;
        document.getElementById('mall-feedback-form').hidden = true;
        document.getElementById('store-assistant-form').classList.remove('is-locked');
        document.getElementById('store-assistant-quick-actions').classList.remove('is-locked');
        const quickActions = document.querySelectorAll('#store-assistant-quick-actions [data-assistant-question]');
        if (quickActions[0]) { quickActions[0].textContent = 'Productos'; quickActions[0].dataset.assistantQuestion = '¿Qué productos tienen?'; }
        if (quickActions[1]) { quickActions[1].textContent = 'Precios'; quickActions[1].dataset.assistantQuestion = '¿Cuáles son los precios?'; }
        if (quickActions[2]) { quickActions[2].textContent = 'Contacto'; quickActions[2].dataset.assistantQuestion = '¿Cómo contacto a la tienda?'; }
        renderConversation(code);
        setTimeout(() => document.getElementById('store-assistant-input')?.focus(), 50);
    };

    window.openMallAssistant = async function () {
        const settings = mallAssistantSettings;
        if (!settings.enabled) return;
        activeStoreCode = MALL_ASSISTANT_CODE;
        activeStoreData = { name: 'Mall Emprendimientos', storeRecord: {}, products: [] };
        document.getElementById('store-assistant-store').textContent = 'Informaciones del Mall';
        document.getElementById('store-assistant-title').textContent = settings.assistant_name || DEFAULT_MALL_SETTINGS.assistant_name;
        document.getElementById('store-assistant-input').maxLength = Number(settings.question_max_chars || 300);
        document.getElementById('store-assistant-char-count').textContent = '0';
        document.getElementById('store-assistant-char-count').nextSibling.textContent = `/${settings.question_max_chars || 300}`;
        document.getElementById('store-assistant-lead-form').hidden = true;
        document.getElementById('mall-feedback-toggle').hidden = false;
        document.getElementById('mall-feedback-form').hidden = true;
        document.getElementById('mall-feedback-status').textContent = '';
        document.getElementById('store-assistant-form').classList.remove('is-locked');
        document.getElementById('store-assistant-quick-actions').classList.remove('is-locked');
        const quickActions = document.querySelectorAll('#store-assistant-quick-actions [data-assistant-question]');
        if (quickActions[0]) { quickActions[0].textContent = 'Locales y servicios'; quickActions[0].dataset.assistantQuestion = '¿Qué locales y servicios ofrece el mall?'; }
        if (quickActions[1]) { quickActions[1].textContent = 'Cómo recorrerlo'; quickActions[1].dataset.assistantQuestion = '¿Cómo puedo recorrer el mall?'; }
        if (quickActions[2]) { quickActions[2].textContent = 'Horarios'; quickActions[2].dataset.assistantQuestion = '¿Cuál es el horario del mall?'; }
        document.getElementById('store-assistant-modal').style.display = 'flex';
        document.getElementById('modal-overlay').style.display = 'block';
        renderConversation(MALL_ASSISTANT_CODE);
        setTimeout(() => document.getElementById('store-assistant-input')?.focus(), 50);
        const latestSettings = await loadMallAssistantSettings();
        if (activeStoreCode !== MALL_ASSISTANT_CODE) return;
        if (!latestSettings.enabled) {
            closeAssistant();
            return;
        }
        document.getElementById('store-assistant-title').textContent = latestSettings.assistant_name || DEFAULT_MALL_SETTINGS.assistant_name;
        document.getElementById('store-assistant-input').maxLength = Number(latestSettings.question_max_chars || 300);
        document.getElementById('store-assistant-char-count').nextSibling.textContent = `/${latestSettings.question_max_chars || 300}`;
        renderConversation(MALL_ASSISTANT_CODE);
    };

    window.openMallFeedback = async function () {
        await window.openMallAssistant();
        if (activeStoreCode !== MALL_ASSISTANT_CODE) return;
        const conversation = getConversation(MALL_ASSISTANT_CODE);
        const form = document.getElementById('mall-feedback-form');
        if (!form) return;
        conversation.feedbackOpen = true;
        form.hidden = false;
        document.getElementById('mall-feedback-name')?.focus();
    };

    function closeAssistant() {
        document.getElementById('store-assistant-modal').style.display = 'none';
        document.getElementById('modal-overlay').style.display = 'none';
        document.getElementById('mall-feedback-toggle').hidden = true;
        document.getElementById('mall-feedback-form').hidden = true;
        document.getElementById('store-assistant-form').classList.remove('is-locked');
        document.getElementById('store-assistant-quick-actions').classList.remove('is-locked');
        activeStoreCode = '';
        activeStoreData = null;
    }

    async function submitLead(event) {
        event.preventDefault();
        if (!activeStoreCode) return;
        const conversation = getConversation(activeStoreCode);
        const payload = {
            action: 'lead',
            store_code: activeStoreCode,
            session_id: conversation.sessionId,
            visitor_name: document.getElementById('store-assistant-lead-name').value.trim(),
            email: document.getElementById('store-assistant-lead-email').value.trim(),
            phone: document.getElementById('store-assistant-lead-phone').value.trim(),
            contact_preference: document.getElementById('store-assistant-lead-preference').value,
            question_summary: conversation.messages.filter((item) => item.role === 'user').map((item) => item.text).join(' | ').slice(0, 1000),
            consent: document.getElementById('store-assistant-lead-consent').checked
        };
        const status = document.getElementById('store-assistant-lead-status');
        if (!payload.visitor_name || (!payload.email && !payload.phone) || !payload.consent) {
            status.textContent = 'Ingresa tu nombre, un correo o WhatsApp y marca la autorización.';
            return;
        }
        status.textContent = 'Enviando...';
        try {
            let saved = false;
            if (supabaseClient?.functions) {
                const { data, error } = await supabaseClient.functions.invoke('store-attendant', { body: payload });
                if (!error && data?.ok) saved = true;
            }
            if (!saved) {
                const { data, error } = await supabaseClient.rpc('submit_store_bot_lead', {
                    p_store_code: payload.store_code,
                    p_session_key: payload.session_id,
                    p_visitor_name: payload.visitor_name,
                    p_email: payload.email,
                    p_phone: payload.phone,
                    p_contact_preference: payload.contact_preference,
                    p_question_summary: payload.question_summary,
                    p_consent: payload.consent
                });
                if (error || !data) throw error || new Error('No se pudo guardar el contacto.');
            }
            status.textContent = 'Datos enviados. La persona encargada de la tienda podrá contactarte.';
            event.currentTarget.querySelector('button[type="submit"]').disabled = true;
        } catch (error) {
            console.error('No pude guardar el contacto del asistente:', error);
            status.textContent = 'Aún falta habilitar el registro de contactos en Supabase.';
        }
    }

    async function submitMallFeedback(event) {
        event.preventDefault();
        if (activeStoreCode !== MALL_ASSISTANT_CODE || typeof supabaseClient === 'undefined' || !supabaseClient) return;
        const form = event.currentTarget;
        const payload = {
            p_mall_id: window.mallContext?.id || null,
            p_session_key: getConversation(MALL_ASSISTANT_CODE).sessionId,
            p_category: document.getElementById('mall-feedback-category').value,
            p_visitor_name: document.getElementById('mall-feedback-name').value.trim(),
            p_email: document.getElementById('mall-feedback-email').value.trim(),
            p_phone: document.getElementById('mall-feedback-phone').value.trim(),
            p_message: document.getElementById('mall-feedback-message').value.trim(),
            p_consent: document.getElementById('mall-feedback-consent').checked
        };
        const status = document.getElementById('mall-feedback-status');
        if (payload.p_visitor_name.length < 2 || payload.p_message.length < 5 || !payload.p_consent) {
            status.textContent = 'Ingresa tu nombre, el mensaje y autoriza el envío.';
            return;
        }
        status.textContent = 'Enviando...';
        try {
            const { error } = await supabaseClient.rpc('submit_mall_feedback', payload);
            if (error) throw error;
            window.mallAnalytics?.track('feedback_submitted', {
                source: 'mall_assistant',
                itemLabel: payload.p_category
            });
            status.textContent = 'Gracias. Tu reclamo o sugerencia fue enviado a la administración.';
            form.querySelector('button[type="submit"]').disabled = true;
        } catch (error) {
            console.error('No pude guardar el reclamo o sugerencia:', error);
            status.textContent = 'No se pudo enviar ahora. Verifica que la migración del asistente del mall esté aplicada.';
        }
    }

    function parseFaq(value) {
        return String(value || '').split(/\r?\n/).map((line) => {
            const separator = line.indexOf('|');
            if (separator < 1) return null;
            const question = line.slice(0, separator).trim();
            const answer = line.slice(separator + 1).trim();
            return question && answer ? { question, answer } : null;
        }).filter(Boolean).slice(0, 30);
    }

    function faqToText(faq) {
        return (Array.isArray(faq) ? faq : []).map((item) => `${item.question} | ${item.answer}`).join('\n');
    }

    function setTenantBotStatus(message, kind = '') {
        const status = document.getElementById('tenant-bot-status');
        if (!status) return;
        status.textContent = message;
        status.dataset.kind = kind;
    }

    function setMallAssistantStatus(message, kind = '') {
        const status = document.getElementById('admin-mall-assistant-status');
        if (!status) return;
        status.textContent = message;
        status.dataset.kind = kind;
    }

    async function requireMallAssistantAdmin() {
        if (typeof window.requireAuthoritativeAdminAccess !== 'function') return null;
        return window.requireAuthoritativeAdminAccess();
    }

    async function renderAdminMallFeedback() {
        const list = document.getElementById('admin-mall-feedback-list');
        if (!list || typeof supabaseClient === 'undefined' || !supabaseClient) return;
        const { data, error } = await mallAssistantScopeQuery(
            supabaseClient
                .from('mall_feedback')
                .select('id, category, visitor_name, email, phone, message, status, created_at')
        )
            .order('created_at', { ascending: false })
            .limit(50);
        list.innerHTML = '';
        if (error) {
            list.textContent = 'Ejecuta la migración del asistente del mall para ver reclamos y sugerencias.';
            return;
        }
        if (!data?.length) {
            list.textContent = 'No hay reclamos ni sugerencias registrados.';
            return;
        }
        data.forEach((item) => {
            const card = document.createElement('article');
            card.className = 'admin-mall-feedback-card';
            const heading = document.createElement('strong');
            heading.textContent = `${item.category === 'complaint' ? 'Reclamo' : 'Sugerencia'} · ${item.visitor_name}`;
            const contact = document.createElement('small');
            contact.textContent = [item.email, item.phone].filter(Boolean).join(' · ') || 'Sin contacto';
            const message = document.createElement('p');
            message.textContent = item.message;
            const footer = document.createElement('div');
            footer.className = 'admin-mall-feedback-footer';
            const date = document.createElement('small');
            date.textContent = new Date(item.created_at).toLocaleString('es-CL');
            const status = document.createElement('select');
            status.className = 'admin-select';
            status.setAttribute('aria-label', 'Estado del reclamo o sugerencia');
            ['new', 'reviewing', 'resolved', 'dismissed'].forEach((value) => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = { new: 'Nuevo', reviewing: 'En revisión', resolved: 'Resuelto', dismissed: 'Descartado' }[value];
                option.selected = value === item.status;
                status.appendChild(option);
            });
            status.addEventListener('change', () => void window.updateMallFeedbackStatus(item.id, status.value));
            footer.append(date, status);
            card.append(heading, contact, message, footer);
            list.appendChild(card);
        });
    }

    window.loadAdminMallAssistantPanel = async function () {
        const sessionUser = await requireMallAssistantAdmin();
        if (!sessionUser || typeof supabaseClient === 'undefined' || !supabaseClient) return;
        const { data, error } = await mallAssistantScopeQuery(
            supabaseClient
                .from('mall_assistant_settings')
                .select('*')
        )
            .eq('id', 1)
            .maybeSingle();
        const settings = { ...DEFAULT_MALL_SETTINGS, ...(data || {}) };
        document.getElementById('admin-mall-assistant-enabled').checked = !!settings.enabled;
        document.getElementById('admin-mall-assistant-name').value = settings.assistant_name || DEFAULT_MALL_SETTINGS.assistant_name;
        document.getElementById('admin-mall-assistant-greeting').value = settings.greeting || DEFAULT_MALL_SETTINGS.greeting;
        document.getElementById('admin-mall-assistant-brief').value = settings.mall_brief || '';
        document.getElementById('admin-mall-assistant-faq').value = faqToText(settings.faq);
        mallAssistantSettings = settings;
        settingsByCode.set(MALL_ASSISTANT_CODE, mallAssistantSettings);
        if (error) {
            setMallAssistantStatus('Falta ejecutar supabase/mall_information_assistant_20260830.sql para guardar esta configuración.', 'warning');
        } else {
            setMallAssistantStatus(settings.enabled ? 'El asistente del mall está activo.' : 'El asistente del mall está desactivado.', 'ok');
        }
        await renderAdminMallFeedback();
    };

    window.saveAdminMallAssistantSettings = async function () {
        const sessionUser = await requireMallAssistantAdmin();
        if (!sessionUser || typeof supabaseClient === 'undefined' || !supabaseClient) return;
        const payload = {
            mall_id: window.mallContext?.id || null,
            id: 1,
            enabled: document.getElementById('admin-mall-assistant-enabled').checked,
            assistant_name: document.getElementById('admin-mall-assistant-name').value.trim() || DEFAULT_MALL_SETTINGS.assistant_name,
            greeting: document.getElementById('admin-mall-assistant-greeting').value.trim() || DEFAULT_MALL_SETTINGS.greeting,
            mall_brief: document.getElementById('admin-mall-assistant-brief').value.trim().slice(0, 4000),
            handoff_message: DEFAULT_MALL_SETTINGS.handoff_message,
            faq: parseFaq(document.getElementById('admin-mall-assistant-faq').value),
            max_turns: 4,
            question_max_chars: 300,
            answer_max_words: 80,
            updated_at: new Date().toISOString()
        };
        setMallAssistantStatus('Guardando configuración...');
        const { data, error } = await supabaseClient
            .from('mall_assistant_settings')
            .upsert(payload, { onConflict: 'mall_id,id' })
            .select('*')
            .single();
        if (error) {
            setMallAssistantStatus(`No se pudo guardar: ${error.message}`, 'warning');
            return;
        }
        mallAssistantSettings = { ...DEFAULT_MALL_SETTINGS, ...data };
        settingsByCode.set(MALL_ASSISTANT_CODE, mallAssistantSettings);
        setMallAssistantStatus('Configuración del asistente guardada.', 'ok');
    };

    window.updateMallFeedbackStatus = async function (id, status) {
        const sessionUser = await requireMallAssistantAdmin();
        if (!sessionUser || typeof supabaseClient === 'undefined' || !supabaseClient) return;
        const { error } = await mallAssistantScopeQuery(
            supabaseClient
                .from('mall_feedback')
                .update({ status, updated_at: new Date().toISOString() })
        )
            .eq('id', id);
        if (error) setMallAssistantStatus(`No se pudo actualizar el estado: ${error.message}`, 'warning');
    };

    async function renderTenantLeads(storeId) {
        const list = document.getElementById('tenant-bot-lead-list');
        const count = document.getElementById('tenant-bot-lead-count');
        if (!list || !count || !supabaseClient) return;
        const { data, error } = await supabaseClient
            .from('store_bot_leads')
            .select('id, visitor_name, email, phone, contact_preference, question_summary, status, created_at')
            .eq('store_id', storeId)
            .order('created_at', { ascending: false })
            .limit(20);
        if (error) {
            count.textContent = '0';
            list.innerHTML = '<p class="tenant-empty-message">Ejecuta la migración del asistente para ver contactos.</p>';
            return;
        }
        count.textContent = String(data?.length || 0);
        list.innerHTML = '';
        if (!data?.length) {
            list.innerHTML = '<p class="tenant-empty-message">No hay contactos nuevos.</p>';
            return;
        }
        data.forEach((lead) => {
            const card = document.createElement('article');
            card.className = 'tenant-bot-lead-card';
            const title = document.createElement('strong');
            title.textContent = lead.visitor_name;
            const contact = document.createElement('span');
            contact.textContent = [lead.email, lead.phone].filter(Boolean).join(' · ');
            const question = document.createElement('p');
            question.textContent = lead.question_summary || 'Sin resumen de consulta.';
            const date = document.createElement('small');
            date.textContent = new Date(lead.created_at).toLocaleString('es-CL');
            card.append(title, contact, question, date);
            list.appendChild(card);
        });
    }

    window.loadTenantStoreAssistantPanel = async function (store) {
        if (!store?.id || !supabaseClient) return;
        setTenantBotStatus('Cargando configuración...');
        const { data, error } = await supabaseClient.from('store_bot_settings').select('*').eq('store_id', store.id).maybeSingle();
        const fallback = getPilotSettings(store) || { ...DEFAULT_SETTINGS, enabled: false, store_id: store.id };
        const settings = data ? { ...DEFAULT_SETTINGS, ...data } : fallback;
        document.getElementById('tenant-bot-enabled').checked = !!settings.enabled;
        document.getElementById('tenant-bot-name').value = settings.assistant_name || 'Asistente';
        document.getElementById('tenant-bot-greeting').value = settings.greeting || DEFAULT_SETTINGS.greeting;
        document.getElementById('tenant-bot-store-brief').value = settings.store_brief || '';
        document.getElementById('tenant-bot-faq').value = faqToText(settings.faq);
        if (error) {
            setTenantBotStatus('Modo piloto local. Ejecuta supabase/store_attendant_bot_20260804.sql para guardar la configuración.', 'warning');
        } else {
            setTenantBotStatus(settings.enabled ? 'El asistente está activo.' : 'El asistente está desactivado.', 'ok');
        }
        void renderTenantLeads(store.id);
    };

    window.saveTenantStoreAssistantSettings = async function (store) {
        if (!store?.id || !supabaseClient) return { error: new Error('Supabase no está disponible.') };
        const payload = {
            store_id: store.id,
            enabled: !!document.getElementById('tenant-bot-enabled').checked,
            assistant_name: document.getElementById('tenant-bot-name').value.trim() || 'Asistente',
            greeting: document.getElementById('tenant-bot-greeting').value.trim() || DEFAULT_SETTINGS.greeting,
            store_brief: document.getElementById('tenant-bot-store-brief').value.trim().slice(0, 1200),
            handoff_message: DEFAULT_HANDOFF,
            faq: parseFaq(document.getElementById('tenant-bot-faq').value),
            max_turns: 4,
            question_max_chars: 300,
            answer_max_words: 80,
            updated_at: new Date().toISOString()
        };
        const { data, error } = await supabaseClient.from('store_bot_settings').upsert(payload).select('*').single();
        if (error && /store_bot_settings|schema cache|could not find the table|relation .* does not exist|store_brief/i.test(error.message || '')) {
            setTenantBotStatus('Falta actualizar Supabase para guardar la inducción del asistente. Ejecuta el SQL de store bot actualizado.', 'warning');
            return { skipped: true };
        }
        if (error) return { error };
        settingsByCode.set(canonicalCode(store.local_code || store.id), { ...DEFAULT_SETTINGS, ...data });
        await syncAttendants();
        return { data };
    };

    function updateAttendantFacing(actor, visitorInsideStore, nowMs) {
        if (!actor?.mesh || typeof camera === 'undefined') return;
        const homeRotation = Number.isFinite(actor.attendantHomeRotationY)
            ? actor.attendantHomeRotationY
            : actor.mesh.rotation.y;
        let targetRotation = homeRotation;

        if (visitorInsideStore) {
            const dx = camera.position.x - actor.mesh.position.x;
            const dz = camera.position.z - actor.mesh.position.z;
            if ((dx * dx) + (dz * dz) > 0.04) targetRotation = Math.atan2(dx, dz);
        }

        const previousAt = Number(actor.attendantLastFacingAt || nowMs);
        const elapsedSeconds = Math.min(0.1, Math.max(0.001, (nowMs - previousAt) / 1000));
        const smoothing = 1 - Math.exp(-7 * elapsedSeconds);
        const angleDelta = Math.atan2(
            Math.sin(targetRotation - actor.mesh.rotation.y),
            Math.cos(targetRotation - actor.mesh.rotation.y)
        );
        actor.mesh.rotation.y += angleDelta * smoothing;
        actor.attendantLastFacingAt = nowMs;
    }

    window.updateStoreAttendants = function (nowMs, updateLabels) {
        streamConstrainedDeviceAttendants(nowMs);
        attendantsByCode.forEach((actor) => {
            const maxRenderDistance = (typeof IS_COARSE_POINTER !== 'undefined' && IS_COARSE_POINTER) ? 30 : 55;
            const cameraDistance = typeof camera !== 'undefined' ? camera.position.distanceTo(actor.mesh.position) : 0;
            actor.mesh.visible = cameraDistance <= maxRenderDistance;
            if (!actor.mesh.visible) {
                actor.label.style.display = 'none';
                return;
            }
            if (typeof applyAvatarPose === 'function') applyAvatarPose(actor, 0, nowMs);
            const localCamera = actor.storeGroup && typeof camera !== 'undefined'
                ? actor.storeGroup.worldToLocal(camera.position.clone())
                : null;
            const visitorInsideStore = !!localCamera
                && Math.abs(localCamera.x) <= 5.85
                && localCamera.z >= -8.85
                && localCamera.z <= 8.75
                && localCamera.y >= 0.35
                && localCamera.y <= 5.4;
            updateAttendantFacing(actor, visitorInsideStore, nowMs);
            if (!updateLabels || typeof updateAvatarLabelPosition !== 'function') return;
            if (!visitorInsideStore) {
                actor.label.style.display = 'none';
                return;
            }
            updateAvatarLabelPosition(actor, 2.2, 24);
        });
    };

    function bindUi() {
        document.getElementById('store-assistant-close')?.addEventListener('click', closeAssistant);
        document.getElementById('store-assistant-form')?.addEventListener('submit', (event) => {
            event.preventDefault();
            const input = document.getElementById('store-assistant-input');
            const question = input.value;
            input.value = '';
            document.getElementById('store-assistant-char-count').textContent = '0';
            void askQuestion(question);
        });
        document.getElementById('store-assistant-input')?.addEventListener('input', (event) => {
            document.getElementById('store-assistant-char-count').textContent = String(event.target.value.length);
        });
        document.getElementById('store-assistant-quick-actions')?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-assistant-question]');
            if (button) void askQuestion(button.dataset.assistantQuestion);
        });
        document.getElementById('store-assistant-lead-form')?.addEventListener('submit', submitLead);
        document.getElementById('mall-feedback-form')?.addEventListener('submit', submitMallFeedback);
        document.getElementById('mall-feedback-toggle')?.addEventListener('click', () => {
            const form = document.getElementById('mall-feedback-form');
            const conversation = activeStoreCode === MALL_ASSISTANT_CODE ? getConversation(MALL_ASSISTANT_CODE) : null;
            if (!form || !conversation) return;
            conversation.feedbackOpen = !conversation.feedbackOpen;
            form.hidden = !conversation.feedbackOpen;
            if (conversation.feedbackOpen) document.getElementById('mall-feedback-name')?.focus();
        });
    }

    async function initialize(attempt = 0) {
        await loadMallAssistantSettings();
        if (!Array.isArray(window.supabaseStoresCache) || !window.supabaseStoresCache.length) {
            if (attempt < 20) setTimeout(() => initialize(attempt + 1), 500);
            return;
        }
        await syncAttendants();
    }

    bindUi();
    window.addEventListener('DOMContentLoaded', () => initialize());
})();
