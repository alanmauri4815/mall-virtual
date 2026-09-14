const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..', '..');
const baseUrl = 'http://127.0.0.1:8000';
const allowedOrigin = 'http://127.0.0.1:5500';
const deniedOrigin = 'https://denied.example';

const testEnvironment = {
    SUPABASE_URL: 'http://127.0.0.1:54321',
    SUPABASE_ANON_KEY: 'integration-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'integration-service-role-key',
    MALL_ALLOWED_ORIGIN: allowedOrigin,
    TELEGRAM_BOT_TOKEN: 'integration-telegram-token',
    TELEGRAM_WEBHOOK_SECRET: 'integration-webhook-secret',
    MALL_INTERNAL_NOTIFY_SECRET: 'integration-notify-secret',
    RESEND_API_KEY: 'integration-resend-key',
    PROMOTION_FROM_EMAIL: 'integration@example.com',
    BOT_FROM_EMAIL: 'integration@example.com',
    OPENAI_API_KEY: 'integration-openai-key'
};

const delay = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

async function fetchStatus(options = {}) {
    return fetch(baseUrl, {
        redirect: 'manual',
        ...options,
        headers: {
            origin: allowedOrigin,
            ...(options.headers || {})
        }
    });
}

async function assertPortAvailable() {
    try {
        await fetch(baseUrl, { signal: AbortSignal.timeout(300) });
        throw new Error('Port 8000 is already in use.');
    } catch (error) {
        if (error?.message === 'Port 8000 is already in use.') throw error;
    }
}

function startFunction(relativePath) {
    const file = path.join(root, relativePath);
    const config = path.join(path.dirname(file), 'deno.json');
    const denoExecutable = path.join(
        root,
        'node_modules',
        'deno',
        process.platform === 'win32' ? 'deno.exe' : 'deno'
    );
    const child = spawn(denoExecutable, [
        'run',
        '--config', config,
        '--allow-env',
        '--allow-net',
        file
    ], {
        cwd: root,
        env: { ...process.env, ...testEnvironment },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    child.stdout.on('data', chunk => { output += chunk.toString(); });
    child.stderr.on('data', chunk => { output += chunk.toString(); });
    child.on('error', error => { output += `\n${error.stack || error.message}`; });
    child.testOutput = () => output.slice(-4000);
    return child;
}

async function waitUntilReady(child) {
    for (let attempt = 0; attempt < 80; attempt += 1) {
        if (child.exitCode !== null) {
            throw new Error(`Edge Function exited before serving requests.\n${child.testOutput()}`);
        }
        try {
            const response = await fetchStatus({ method: 'GET', signal: AbortSignal.timeout(500) });
            if (response.status >= 100) return;
        } catch {
            await delay(125);
        }
    }
    throw new Error(`Timed out waiting for Edge Function.\n${child.testOutput()}`);
}

async function stopFunction(child) {
    if (child.exitCode === null) {
        child.kill('SIGTERM');
        await Promise.race([
            new Promise(resolve => child.once('exit', resolve)),
            delay(2000)
        ]);
        if (child.exitCode === null && process.platform === 'win32') {
            spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
                windowsHide: true,
                stdio: 'ignore'
            });
        } else if (child.exitCode === null) {
            child.kill('SIGKILL');
        }
    }

    for (let attempt = 0; attempt < 40; attempt += 1) {
        try {
            await fetch(baseUrl, { signal: AbortSignal.timeout(200) });
            await delay(100);
        } catch {
            return;
        }
    }
    throw new Error('Edge Function did not release port 8000 after shutdown.');
}

async function withFunction(relativePath, checks) {
    await assertPortAvailable();
    const child = startFunction(relativePath);
    try {
        await waitUntilReady(child);
        await checks();
    } finally {
        await stopFunction(child);
    }
}

function assertCors(response, expectedOrigin = allowedOrigin) {
    assert.equal(response.headers.get('access-control-allow-origin'), expectedOrigin);
    assert.match(response.headers.get('access-control-allow-methods') || '', /POST/);
}

async function postJson(body, origin = allowedOrigin, headers = {}) {
    return fetchStatus({
        method: 'POST',
        headers: { origin, 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body)
    });
}

(async () => {
    await withFunction('supabase/functions/admin-create-tenant/index.ts', async () => {
        const preflight = await fetchStatus({ method: 'OPTIONS' });
        assert.equal(preflight.status, 204);
        assertCors(preflight);
        assert.equal((await postJson({}, deniedOrigin)).status, 403);
        assert.equal((await fetchStatus({ method: 'GET' })).status, 405);
        assert.equal((await postJson({})).status, 401);
    });

    await withFunction('supabase/functions/member-promotion-email/index.ts', async () => {
        const preflight = await fetchStatus({ method: 'OPTIONS' });
        assert.equal(preflight.status, 200);
        assertCors(preflight);
        assert.equal((await postJson({}, deniedOrigin)).status, 403);
        assert.equal((await fetchStatus({ method: 'GET' })).status, 405);
        assert.equal((await postJson({})).status, 401);
    });

    await withFunction('supabase/functions/store-attendant/index.ts', async () => {
        const preflight = await fetchStatus({ method: 'OPTIONS' });
        assert.equal(preflight.status, 200);
        assertCors(preflight);
        const deniedPreflight = await fetchStatus({ method: 'OPTIONS', headers: { origin: deniedOrigin } });
        assert.notEqual(deniedPreflight.headers.get('access-control-allow-origin'), deniedOrigin);
        assert.equal((await fetchStatus({ method: 'GET' })).status, 405);
        assert.equal((await postJson({})).status, 400);
    });

    await withFunction('supabase/functions/telegram-bot/index.ts', async () => {
        const preflight = await fetchStatus({ method: 'OPTIONS' });
        assert.equal(preflight.status, 200);
        assert.equal(preflight.headers.get('access-control-allow-origin'), allowedOrigin);
        assert.equal((await fetchStatus({ method: 'GET' })).status, 405);
        assert.equal((await postJson({ update_id: 1 })).status, 401);
        assert.equal((await postJson({ action: 'notify_message', payload: {} })).status, 401);
    });

    console.log('Edge Function HTTP integration passed for CORS, methods and unauthenticated requests.');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
