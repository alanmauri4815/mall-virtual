const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const denoExecutable = path.join(
    root,
    'node_modules',
    'deno',
    process.platform === 'win32' ? 'deno.exe' : 'deno'
);
const functionNames = [
    'admin-create-tenant',
    'member-promotion-email',
    'store-attendant',
    'telegram-bot'
];

if (!fs.existsSync(denoExecutable)) {
    throw new Error('Deno is not installed. Run npm install before test:edge.');
}

for (const functionName of functionNames) {
    const functionDirectory = path.join(root, 'supabase', 'functions', functionName);
    const result = spawnSync(denoExecutable, [
        'check',
        '--config', path.join(functionDirectory, 'deno.json'),
        path.join(functionDirectory, 'index.ts')
    ], {
        cwd: functionDirectory,
        encoding: 'utf8',
        stdio: 'pipe'
    });

    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(`Deno check failed for ${functionName} with exit code ${result.status}.`);
    }
    console.log(`Deno check passed: ${functionName}`);
}
