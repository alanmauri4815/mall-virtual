const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const uiSource = fs.readFileSync(path.resolve(__dirname, '../../js/mall/mall-ui.js'), 'utf8');

function readGlbJson(relativePath) {
    const file = fs.readFileSync(path.resolve(__dirname, '../..', relativePath));
    const jsonLength = file.readUInt32LE(12);
    return JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8'));
}

const avatarCatalog = [
    'assets/avatars/mall-persona-masculino-casual-v7-mejorada.glb',
    'assets/avatars/mall-persona-masculino-elegant-v7-mejorada.glb',
    'assets/avatars/mall-persona-masculino-work-v7-mejorada.glb',
    'assets/avatars/mall-persona-femenino-casual-v5-mejorada.glb',
    'assets/avatars/mall-persona-femenino-elegant-v5-mejorada.glb',
    'assets/avatars/mall-persona-femenino-sport-v5-mejorada.glb'
];
const avatar = readGlbJson(avatarCatalog[0]);
const avatarBones = new Set((avatar.nodes || []).map((node) => node.name).filter(Boolean));
const expectedHairNodes = {
    'mall-persona-masculino': ['AvatarHair.afro01', 'AvatarHair.short01', 'AvatarHair.short02', 'AvatarHair.short03', 'AvatarHair.short04'],
    'mall-persona-femenino': ['AvatarHair.afro01', 'AvatarHair.bob01', 'AvatarHair.long01', 'AvatarHair.ponytail01', 'AvatarHair.braid01']
};
for (const relativePath of avatarCatalog) {
    const candidate = readGlbJson(relativePath);
    const label = path.basename(relativePath);
    const materialNames = new Set((candidate.materials || []).map((material) => material.name));
    assert.equal(candidate.skins?.length, 1, `${label} standard avatar must include one skin`);
    ['AvatarBody', 'AvatarOutfit', 'AvatarHair', 'AvatarShoes'].forEach((name) => {
        assert.ok(materialNames.has(name), `${label} standard avatar is missing ${name}`);
    });
    const unskinnedMeshes = (candidate.nodes || []).filter((node) => node.mesh !== undefined && node.skin === undefined);
    assert.deepEqual(unskinnedMeshes, [], `${label} body, outfit, hair, and shoes must share the skin`);
    const expectedHair = label.includes('masculino')
        ? expectedHairNodes['mall-persona-masculino']
        : expectedHairNodes['mall-persona-femenino'];
    const nodeNames = new Set((candidate.nodes || []).map((node) => node.name));
    expectedHair.forEach((hairName) => {
        assert.ok(nodeNames.has(hairName), `${label} is missing selectable hair ${hairName}`);
    });
}
const avatarUrlBlock = uiSource.match(/const GAME_READY_AVATAR_URLS = \{([\s\S]*?)\n        \};/);
assert.ok(avatarUrlBlock, 'Avatar model catalog must be declared');
for (const relativePath of avatarCatalog) {
    assert.match(avatarUrlBlock[1], new RegExp(path.basename(relativePath).replace('.', '\\.')),
        `${relativePath} must be selectable from the avatar catalog`);
}
assert.doesNotMatch(avatarUrlBlock[1], /mall-persona-masculino-v2\.glb/,
    'The rigid prototype outfit must not be exposed as a selectable avatar');

[
    'assets/avatars/animations/idle.glb',
    'assets/avatars/animations/standing-idle.glb',
    'assets/avatars/animations/female-walk.glb',
    'assets/avatars/animations/backward.glb',
    'assets/avatars/animations/turn-left.glb',
    'assets/avatars/animations/sitting.glb',
    'assets/avatars/animations/stand.glb'
].forEach((relativePath) => {
    const action = readGlbJson(relativePath);
    const missingBones = [...new Set((action.animations?.[0]?.channels || [])
        .map((channel) => action.nodes?.[channel.target.node]?.name)
        .filter((name) => name && !name.endsWith('_end'))
        .filter((name) => !name.startsWith('Human.rig'))
        .filter((name) => !avatarBones.has(name)))];
    assert.deepEqual(missingBones, [], `${relativePath} has bones missing from the standard avatar`);
});

console.log('mixamo-avatar-compatibility.test.js: ok');
