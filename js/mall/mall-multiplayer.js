        // --- SUPABASE & MULTIJUGADOR OPTIMIZADO ---
        let supabaseClient = null;
        let currentEscalatorState = null;
        let escalatorExitCooldown = null;
        let avatarLabelMode = 'far';
        const AVATAR_LABEL_NEAR_DISTANCE = 18;
        const AVATAR_LABEL_FAR_DISTANCE = 40;
        const AVATAR_LABEL_NPC_FAR_DISTANCE = 35;
        const AVATAR_CAMERA_HIDE_DISTANCE = 0;

        function syncAvatarLabelModeButton() {
            const btn = document.getElementById('avatar-label-mode-btn');
            if (!btn) return;
            btn.innerText = avatarLabelMode === 'far' ? 'Nombres: Lejos' : 'Nombres: Cerca';
        }

        window.toggleAvatarLabelMode = function () {
            avatarLabelMode = avatarLabelMode === 'far' ? 'near' : 'far';
            syncAvatarLabelModeButton();
            closeControlsMenu();
        };

        function shouldShowAvatarLabel(worldPos, projectedPos, farDistance = Infinity) {
            if (projectedPos.z > 1 || Math.abs(projectedPos.x) > 1 || Math.abs(projectedPos.y) > 1) return false;
            const distToCam = camera.position.distanceTo(worldPos);
            const distanceLimit = avatarLabelMode === 'far' ? farDistance : AVATAR_LABEL_NEAR_DISTANCE;
            return distToCam <= distanceLimit;
        }

        syncAvatarLabelModeButton();
        syncWalkModeButton();
        syncControlsMenu();
        const SUPABASE_URL = 'https://kcfuixvrwbnizspgtmtr.supabase.co';
        const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_-H23KD1xJafE_DFpBFZlyA_CL9sNlpG';

        try {
            supabaseClient = supabase.createClient(
                SUPABASE_URL,
                SUPABASE_PUBLISHABLE_KEY
            );
        } catch(e) { console.error("Error inicializando Supabase:", e); }

        const TELEGRAM_BOT_USERNAME = 'Mall_Emprendimiento_bot';
        const TELEGRAM_EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/telegram-bot`;

        let passwordRecoveryAudience = 'member';
        let passwordRecoverySessionReady = false;
        let tenantPasswordSetupContinueToMall = false;

        function setPasswordRecoveryStatus(message = "", tone = "muted") {
            const el = document.getElementById('password-recovery-status');
            if (!el) return;
            const palette = {
                muted: '#888',
                success: '#7fcf8d',
                error: '#ff8866',
                warn: '#c5a059'
            };
            el.textContent = message;
            el.style.color = palette[tone] || palette.muted;
        }

        function setTenantPasswordSetupStatus(message = "", tone = "muted") {
            const el = document.getElementById('tenant-password-setup-status');
            if (!el) return;
            const palette = {
                muted: '#888',
                success: '#7fcf8d',
                error: '#ff8866',
                warn: '#c5a059'
            };
            el.textContent = message;
            el.style.color = palette[tone] || palette.muted;
        }

        function cleanupPasswordRecoveryUrl() {
            const url = new URL(window.location.href);
            url.searchParams.delete('recovery');
            url.searchParams.delete('account');
            history.replaceState({}, document.title, url.pathname + url.search + url.hash.replace(/#.*/, ''));
            if (window.location.hash) {
                history.replaceState({}, document.title, url.pathname + url.search);
            }
        }

        function enterPasswordResetMode(audience = 'member') {
            passwordRecoveryAudience = audience;
            passwordRecoverySessionReady = true;
            const modal = document.getElementById('password-recovery-modal');
            const requestPanel = document.getElementById('password-recovery-request-panel');
            const resetPanel = document.getElementById('password-recovery-reset-panel');
            const title = document.getElementById('password-recovery-title');
            if (title) title.textContent = "Nueva contraseña";
            if (requestPanel) requestPanel.style.display = 'none';
            if (resetPanel) resetPanel.style.display = 'flex';
            if (modal) modal.style.display = 'block';
            setPasswordRecoveryStatus("Ingresa y confirma la nueva contraseña para terminar la recuperación.", "warn");
        }

        function hasRecoveryTokensInUrl() {
            const search = new URLSearchParams(window.location.search);
            const hash = new URLSearchParams(String(window.location.hash || "").replace(/^#/, ''));
            return search.get('recovery') === '1' && (
                hash.get('type') === 'recovery' ||
                !!hash.get('access_token') ||
                !!hash.get('refresh_token')
            );
        }

        async function maybeHandlePasswordRecoveryEntry() {
            if (!supabaseClient || !hasRecoveryTokensInUrl()) return;
            const search = new URLSearchParams(window.location.search);
            enterPasswordResetMode(search.get('account') || 'member');
        }

        function buildPasswordRecoveryRedirectUrl(audience = 'member') {
            const url = new URL(window.location.href);
            url.searchParams.set('recovery', '1');
            url.searchParams.set('account', audience);
            url.hash = '';
            return url.toString();
        }

        window.openPasswordRecovery = function(audience = 'member') {
            passwordRecoveryAudience = audience;
            passwordRecoverySessionReady = false;
            const modal = document.getElementById('password-recovery-modal');
            const requestPanel = document.getElementById('password-recovery-request-panel');
            const resetPanel = document.getElementById('password-recovery-reset-panel');
            const title = document.getElementById('password-recovery-title');
            const copy = document.getElementById('password-recovery-copy');
            const identifierInput = document.getElementById('password-recovery-identifier');
            if (title) title.textContent = "Recuperar contraseña";
            if (copy) copy.textContent = audience === 'tenant'
                ? "Ingresa correo, marca o código de local. Te enviaremos un enlace para redefinir la contraseña del locatario."
                : "Ingresa correo o nick del visitante inscrito. Te enviaremos un enlace para redefinir la contraseña.";
            if (identifierInput) {
                identifierInput.value = audience === 'tenant'
                    ? (document.getElementById('tenant-login-email-main')?.value || document.getElementById('tenant-email')?.value || "")
                    : (document.getElementById('member-login-email')?.value || document.getElementById('nickname-input')?.value || "");
            }
            if (requestPanel) requestPanel.style.display = 'flex';
            if (resetPanel) resetPanel.style.display = 'none';
            if (modal) modal.style.display = 'block';
            setPasswordRecoveryStatus("", "muted");
        };

        window.closePasswordRecovery = function() {
            const modal = document.getElementById('password-recovery-modal');
            if (modal) modal.style.display = 'none';
            if (!passwordRecoverySessionReady) return;
            cleanupPasswordRecoveryUrl();
        };

        async function continueTenantEntryAfterPasswordSetup() {
            if (!tenantPasswordSetupContinueToMall || !currentTenantUser) return;
            tenantPasswordSetupContinueToMall = false;
            const tenantName = myOwnedStore?.name || currentTenantUser.user_metadata?.brand_name || currentTenantUser.email?.split('@')[0] || "Locatario";
            await enterMallWithIdentity({ nickname: `Locatario ${tenantName}`, role: "tenant", user: currentTenantUser });
            applyUserRole(currentUserProfile, currentTenantUser);
        }

        function tenantHasDismissedPasswordSetup(user = currentTenantUser) {
            return !!user?.user_metadata?.hide_tenant_password_setup_prompt;
        }

        async function persistTenantPasswordSetupPreference(shouldHide = false) {
            if (!supabaseClient || !currentTenantUser) return { error: null };
            const nextMetadata = {
                ...(currentTenantUser.user_metadata || {}),
                hide_tenant_password_setup_prompt: !!shouldHide
            };
            const { data, error } = await supabaseClient.auth.updateUser({ data: nextMetadata });
            if (!error && data?.user) {
                currentTenantUser = data.user;
            } else if (!error) {
                currentTenantUser = { ...currentTenantUser, user_metadata: nextMetadata };
            }
            return { error: error || null };
        }

        window.openTenantPasswordSetup = function(options = {}) {
            tenantPasswordSetupContinueToMall = !!options.continueToMall;
            const modal = document.getElementById('tenant-password-setup-modal');
            const newPass = document.getElementById('tenant-password-setup-new');
            const confirmPass = document.getElementById('tenant-password-setup-confirm');
            const hideFuture = document.getElementById('tenant-password-setup-hide-future');
            if (newPass) newPass.value = "";
            if (confirmPass) confirmPass.value = "";
            if (hideFuture) hideFuture.checked = tenantHasDismissedPasswordSetup();
            setTenantPasswordSetupStatus("Cámbiala ahora si quieres dejar de usar la clave temporal.", "warn");
            if (modal) modal.style.display = 'block';
        };

        window.closeTenantPasswordSetup = function() {
            const modal = document.getElementById('tenant-password-setup-modal');
            if (modal) modal.style.display = 'none';
            setTenantPasswordSetupStatus("", "muted");
        };

        window.skipTenantPasswordSetup = async function() {
            const shouldHide = !!document.getElementById('tenant-password-setup-hide-future')?.checked;
            if (shouldHide) {
                const { error } = await persistTenantPasswordSetupPreference(true);
                if (error) {
                    setTenantPasswordSetupStatus("No pude guardar la preferencia 'No mostrar más': " + error.message, "error");
                    return;
                }
            }
            closeTenantPasswordSetup();
            await continueTenantEntryAfterPasswordSetup();
        };

        window.submitTenantPasswordSetup = async function() {
            if (!supabaseClient || !currentTenantUser) return setTenantPasswordSetupStatus("Primero inicia sesión como locatario.", "error");
            const newPass = document.getElementById('tenant-password-setup-new')?.value || "";
            const confirmPass = document.getElementById('tenant-password-setup-confirm')?.value || "";
            const shouldHide = !!document.getElementById('tenant-password-setup-hide-future')?.checked;
            if (newPass.length < 6) return setTenantPasswordSetupStatus("La nueva contraseña debe tener al menos 6 caracteres.", "error");
            if (newPass !== confirmPass) return setTenantPasswordSetupStatus("Las contraseñas no coinciden.", "error");

            setTenantPasswordSetupStatus("Guardando tu nueva contraseña...", "muted");
            const { error } = await supabaseClient.auth.updateUser({ password: newPass });
            if (error) return setTenantPasswordSetupStatus("No se pudo actualizar la contraseña: " + error.message, "error");

            setTenantPasswordSetupStatus("Contraseña actualizada. Entrando al mall...", "success");
            if (shouldHide) {
                const preferenceWrite = await persistTenantPasswordSetupPreference(true);
                if (preferenceWrite.error) {
                    return setTenantPasswordSetupStatus("La clave se actualizó, pero no pude guardar 'No mostrar más': " + preferenceWrite.error.message, "error");
                }
            }

            setTimeout(async () => {
                closeTenantPasswordSetup();
                await continueTenantEntryAfterPasswordSetup();
            }, 500);
        };

        window.sendPasswordRecovery = async function() {
            if (!supabaseClient) return setPasswordRecoveryStatus("No hay conexión con Supabase.", "error");
            const identifier = document.getElementById('password-recovery-identifier')?.value.trim() || "";
            if (!identifier) return setPasswordRecoveryStatus("Ingresa un correo valido.", "error");

            setPasswordRecoveryStatus("Buscando cuenta y enviando enlace...", "muted");

            const email = passwordRecoveryAudience === 'tenant'
                ? await resolveTenantEmail(identifier)
                : await resolveMemberEmail(identifier);

            if (!email || !email.includes('@')) {
                return setPasswordRecoveryStatus("Por seguridad, la recuperacion requiere correo directo.", "error");
            }

            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: buildPasswordRecoveryRedirectUrl(passwordRecoveryAudience)
            });

            if (error) {
                return setPasswordRecoveryStatus("No se pudo enviar el enlace: " + error.message, "error");
            }

            setPasswordRecoveryStatus(`Enlace enviado a ${email}. Revisa tu correo y vuelve desde ese link para crear una nueva contraseña.`, "success");
        };

        window.submitRecoveredPassword = async function() {
            if (!supabaseClient) return setPasswordRecoveryStatus("No hay conexión con Supabase.", "error");
            const newPass = document.getElementById('password-recovery-new-pass')?.value || "";
            const confirmPass = document.getElementById('password-recovery-new-pass-confirm')?.value || "";
            if (newPass.length < 6) return setPasswordRecoveryStatus("La nueva contraseña debe tener al menos 6 caracteres.", "error");
            if (newPass !== confirmPass) return setPasswordRecoveryStatus("Las contraseñas no coinciden.", "error");

            const { error } = await supabaseClient.auth.updateUser({ password: newPass });
            if (error) return setPasswordRecoveryStatus("No se pudo actualizar la contraseña: " + error.message, "error");

            setPasswordRecoveryStatus("Contraseña actualizada. Vuelve a iniciar sesión con la nueva clave.", "success");
            cleanupPasswordRecoveryUrl();
            passwordRecoverySessionReady = false;

            setTimeout(async () => {
                await supabaseClient.auth.signOut();
                window.closePasswordRecovery();
                if (passwordRecoveryAudience === 'tenant') {
                    setEntryMode('tenant');
                } else {
                    setEntryMode('member');
                }
            }, 900);
        };

        if (supabaseClient?.auth?.onAuthStateChange) {
            supabaseClient.auth.onAuthStateChange((event) => {
                if (event === 'PASSWORD_RECOVERY') {
                    const search = new URLSearchParams(window.location.search);
                    enterPasswordResetMode(search.get('account') || passwordRecoveryAudience || 'member');
                }
            });
        }

        setTimeout(() => {
            maybeHandlePasswordRecoveryEntry();
        }, 250);

