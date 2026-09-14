const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const productionDirectories = [
    path.join(projectRoot, 'js', 'mall'),
    path.join(projectRoot, 'supabase', 'functions')
];

function collectFiles(directory, predicate) {
    if (!fs.existsSync(directory)) return [];

    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return collectFiles(fullPath, predicate);
        return predicate(fullPath) ? [fullPath] : [];
    });
}

function runNode(args, label) {
    const result = spawnSync(process.execPath, args, {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
    });

    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status !== 0) {
        throw new Error(`${label} failed with exit code ${result.status}`);
    }
}

const productionScripts = productionDirectories
    .flatMap((directory) => collectFiles(directory, (file) => file.endsWith('.js')))
    .filter((file) => !/\.backup-|\.min\.js$/i.test(file))
    .sort();

console.log(`Checking JavaScript syntax in ${productionScripts.length} production files...`);
productionScripts.forEach((file) => {
    runNode(['--check', file], `Syntax check: ${path.relative(projectRoot, file)}`);
});

const tests = collectFiles(path.join(projectRoot, 'tests'), (file) => file.endsWith('.test.js'))
    .filter((file) => !file.endsWith('.browser.test.js'))
    .sort();

console.log(`Running ${tests.length} fast tests...`);
tests.forEach((file) => {
    console.log(`\n> ${path.relative(projectRoot, file)}`);
    runNode([file], path.relative(projectRoot, file));
});

console.log(`\nAll ${tests.length} fast tests and ${productionScripts.length} syntax checks passed.`);
