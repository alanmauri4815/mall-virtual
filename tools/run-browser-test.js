const fs = require('node:fs');
const path = require('node:path');

if (!process.env.PLAYWRIGHT_CHROME_PATH && process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const candidates = [
        path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    process.env.PLAYWRIGHT_CHROME_PATH = candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

require('../tests/browser/mobile-performance.browser.test.js');
