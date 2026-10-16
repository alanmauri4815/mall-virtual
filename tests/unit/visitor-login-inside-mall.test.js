const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const uiSource = fs.readFileSync(path.join(projectRoot, 'js', 'mall', 'mall-ui.js'), 'utf8');

assert.match(
    html,
    /id="guest-account-actions"[\s\S]*?data-mall-action="openLoginChooser"[\s\S]*?Login/
);
assert.match(
    html,
    /id="login-choice-panel"[\s\S]*?data-mall-action="entryMember"[\s\S]*?data-mall-action="entryTenant"/
);

const setEntryMode = uiSource.match(/window\.setEntryMode = function\(mode\) \{([\s\S]*?)\n        \};/);
assert.ok(setEntryMode, 'The shared entry chooser must remain available.');
assert.match(
    setEntryMode[1],
    /hasEnteredMall[\s\S]*currentAccessRole === ['"]guest['"][\s\S]*mode === ['"]login-choice['"][\s\S]*mode === ['"]member['"][\s\S]*if \(!keepAnonymousRoleUntilAuthentication\) currentAccessRole = mode;/,
    'Opening or selecting the visitor login form inside an anonymous session must not grant member role early.'
);

const memberTransitionStart = uiSource.indexOf('function applyMemberSessionToCurrentMall(');
const memberRegisterStart = uiSource.indexOf('window.memberRegister = async function', memberTransitionStart);
const memberTransition = uiSource.slice(memberTransitionStart, memberRegisterStart);
assert.ok(memberTransitionStart >= 0 && memberRegisterStart > memberTransitionStart, 'Authenticated member sessions must have an explicit transition helper.');
assert.match(memberTransition, /currentAccessRole = 'member';/);
assert.match(memberTransition, /applyUserRole\(currentUserProfile, user\);/);
assert.match(memberTransition, /loadMemberBenefitsSummary\(\)/);
assert.match(memberTransition, /trackMySelf\(\)/);
assert.match(memberTransition, /broadcastMyPosition\(\)/);
assert.doesNotMatch(
    memberTransition,
    /resetMallEntrySpawnPoint|forceInformationDeskVisitorSpawn|forceEntrySpawn|camera\.position\.(?:set|copy)/,
    'Switching to a member account from inside the mall must preserve camera and visitor position.'
);

const memberLoginStart = uiSource.indexOf('window.memberLogin = async function');
const guestEntryStart = uiSource.indexOf('window.startMallExperience = async function', memberLoginStart);
const memberLogin = uiSource.slice(memberLoginStart, guestEntryStart);
assert.ok(memberLoginStart >= 0 && guestEntryStart > memberLoginStart);
assert.ok(
    memberLogin.indexOf('if (error)') < memberLogin.indexOf('applyMemberSessionToCurrentMall(user, email)'),
    'Invalid credentials must return before the authenticated member transition.'
);
assert.match(memberLogin, /if \(alreadyInsideMall\) \{\s*finalizeMallEntryUi\(\);/);
assert.match(memberLogin, /await enterMallWithIdentity\([\s\S]*?role: "member"/);

const memberRegisterEnd = uiSource.indexOf('window.sendMemberPhoneOtp = async function', memberRegisterStart);
const memberRegister = uiSource.slice(memberRegisterStart, memberRegisterEnd);
assert.match(memberRegister, /applyMemberSessionToCurrentMall\(data\.user, email, currentMemberProfile\)/);

assert.match(uiSource, /window\.tenantLogin = async function/);
assert.match(uiSource, /const enterAsAdmin = hasAdminAccess \|\| currentUserRole === ['"]admin['"]/);

function createEntryContext(overrides = {}) {
    const testState = {};
    const elementIds = [
        'guest-entry-panel', 'login-choice-panel', 'member-entry-panel', 'tenant-entry-panel',
        'guest-entry-button', 'entry-secondary-actions', 'entry-account-card',
        'welcome-access-title', 'welcome-access-copy', 'member-login-email', 'member-login-pass'
    ];
    const elements = new Map(elementIds.map((id) => [id, {
        hidden: false,
        textContent: '',
        value: id === 'member-login-email' ? 'visitor@example.invalid' : '',
        dataset: {},
        style: {}
    }]));
    return {
        hasEnteredMall: true,
        mallEntryCompleted: true,
        currentAccessRole: 'guest',
        memberLoginInFlight: false,
        currentMemberProfile: null,
        authoritativeAdminUserId: '',
        window: { mallMazePlayerName: 'Visitante1234', mallAnalytics: { startMallSession() {} } },
        document: { getElementById: (id) => elements.get(id) || null },
        syncAvatarSelectionUi() {},
        closeMallAccountAccess() {},
        clearAuthoritativeAdminAccess() {},
        withRequestTimeout: (promise) => promise,
        resolveMemberEmail: async (email) => email,
        setMemberStatus(message, isError) {
            testState.memberLoginStatus = { message, isError };
            return message;
        },
        testState,
        ...overrides
    };
}

const setEntryModeStart = uiSource.indexOf('window.setEntryMode = function(mode) {');
const loginChooserStart = uiSource.indexOf('window.openLoginChooser = function', setEntryModeStart);
const setEntryModeSource = uiSource.slice(setEntryModeStart, loginChooserStart);
const memberLoginSource = uiSource.slice(memberLoginStart, guestEntryStart);

(async () => {
const invalidLoginState = { memberTransitionCalls: 0 };
const invalidLoginContext = createEntryContext({
    supabaseClient: {
        auth: {
            async signInWithPassword() {
                return { data: { user: null }, error: { message: 'Invalid login credentials' } };
            }
        }
    },
    applyMemberSessionToCurrentMall() {
        invalidLoginState.memberTransitionCalls += 1;
        return true;
    }
});
invalidLoginContext.document.getElementById('member-login-pass').value = 'incorrect-password';
const invalidLoginPromise = vm.runInNewContext(
    `${setEntryModeSource}\nwindow.setEntryMode('login-choice');\nwindow.setEntryMode('member');\n${memberLoginSource}\nwindow.memberLogin();`,
    invalidLoginContext
);
await invalidLoginPromise;
assert.equal(invalidLoginContext.currentAccessRole, 'guest');
assert.equal(invalidLoginContext.testState.memberLoginStatus.isError, true);
assert.equal(invalidLoginState.memberTransitionCalls, 0);
assert.equal(invalidLoginContext.memberLoginInFlight, false);

const successfulLoginState = { memberTransitionCalls: 0, finalizeCalls: 0, reentryCalls: 0 };
const successfulLoginContext = createEntryContext({
    supabaseClient: {
        auth: {
            async signInWithPassword() {
                return { data: { user: { id: 'member-1', email: 'visitor@example.invalid' } }, error: null };
            }
        }
    },
    applyMemberSessionToCurrentMall() {
        successfulLoginState.memberTransitionCalls += 1;
        successfulLoginState.currentAccessRole = 'member';
        return true;
    },
    hydrateMemberSessionAfterLogin: async () => {},
    finalizeMallEntryUi() { successfulLoginState.finalizeCalls += 1; },
    enterMallWithIdentity() { successfulLoginState.reentryCalls += 1; return Promise.resolve(true); }
});
successfulLoginContext.document.getElementById('member-login-pass').value = 'valid-password';
const successfulLoginPromise = vm.runInNewContext(
    `${memberLoginSource}\nwindow.memberLogin();`,
    successfulLoginContext
);
await successfulLoginPromise;
assert.equal(successfulLoginState.currentAccessRole, 'member', JSON.stringify({ successfulLoginState, status: successfulLoginContext.testState.memberLoginStatus }));
assert.equal(successfulLoginState.memberTransitionCalls, 1);
assert.equal(successfulLoginState.finalizeCalls, 1);
assert.equal(successfulLoginState.reentryCalls, 0);

const memberTransitionSource = uiSource.slice(memberTransitionStart, memberRegisterStart);
const transitionState = { benefitLoads: 0, presenceTracks: 0, positionBroadcasts: 0 };
const transitionContext = createEntryContext({
    currentUserProfile: null,
    getMemberDisplayName: () => 'Socio Uno',
    applyUserRole(profile) { transitionState.appliedProfile = profile; },
    loadMemberBenefitsSummary() { transitionState.benefitLoads += 1; return Promise.resolve(); },
    trackMySelf() { transitionState.presenceTracks += 1; return Promise.resolve(); },
    broadcastMyPosition() { transitionState.positionBroadcasts += 1; },
    window: {
        mallMazePlayerName: 'Visitante1234',
        mallAnalytics: { startMallSession() {} }
    }
});
const cameraPositionBeforeTransition = { x: -12, y: 1.7, z: 45 };
transitionContext.camera = { position: { ...cameraPositionBeforeTransition } };
const transitionAlreadyInside = vm.runInNewContext(
    `${memberTransitionSource}\napplyMemberSessionToCurrentMall({ id: 'member-1', email: 'visitor@example.invalid' }, 'visitor@example.invalid', { nickname: 'Socio Uno' });`,
    transitionContext
);
assert.equal(transitionAlreadyInside, true);
assert.equal(transitionContext.currentAccessRole, 'member');
assert.equal(transitionContext.window.mallMazePlayerName, 'Socio Uno');
assert.equal(transitionState.appliedProfile.role, 'registered_visitor');
assert.equal(transitionState.benefitLoads, 1);
assert.equal(transitionState.presenceTracks, 1);
assert.equal(transitionState.positionBroadcasts, 1);
assert.deepEqual(transitionContext.camera.position, cameraPositionBeforeTransition);

const tenantContext = createEntryContext();
vm.runInNewContext(`${setEntryModeSource}\nwindow.setEntryMode('tenant');`, tenantContext);
assert.equal(tenantContext.currentAccessRole, 'tenant');

console.log('Visitor login inside the mall preserves anonymous access until authentication and transitions without re-entry.');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
