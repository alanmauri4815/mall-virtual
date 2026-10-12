const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const ui = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-ui.js'), 'utf8');
const constants = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-constants.js'), 'utf8');

assert.match(
    ui,
    /raycaster\.setFromCamera\(mouse,\s*window\.getMallRenderCamera\?\.\(\)\s*\|\|\s*camera\)/,
    'Scene interactions must raycast from the camera currently used to render the mall.'
);
assert.match(
    constants,
    /window\.getMallRenderCamera\s*=\s*\(\)\s*=>\s*isThirdPersonView\s*\?\s*thirdPersonCamera\s*:\s*camera/,
    'Third-person interactions must use the third-person render camera.'
);

console.log('Mall interaction raycasting uses the active render camera.');
