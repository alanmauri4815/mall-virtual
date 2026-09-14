const assert = require('node:assert/strict');

global.window = global;
require('../../js/mall/mall-furniture.js');

const layouts = global.MALL_STORE_FURNITURE_LAYOUTS;
const os10 = layouts?.['OS-10'];
const expectedPhysicalSpaces = [
    'phys_b_f1_xp_zn_horizontal_01'
];
const fixedDimensions = {
    'cash-desk': [2.8, 1.15],
    'front-vitrine': [1.65, 0.9]
};
const supportedTypes = new Set([
    'shelf-wall',
    'center-island',
    'cash-desk',
    'front-vitrine'
]);

assert.ok(os10, 'OS-10 must have a furniture layout');
assert.deepEqual(Object.keys(os10.physicalSpaces).sort(), expectedPhysicalSpaces.sort());

Object.entries(os10.physicalSpaces).forEach(([physicalSpaceId, layout]) => {
    assert.ok(layout.items.length > 0, `${physicalSpaceId} must contain furniture`);

    layout.items.forEach((item) => {
        assert.ok(supportedTypes.has(item.type), `Unsupported furniture type: ${item.type}`);
        const [baseWidth, baseDepth] = fixedDimensions[item.type] || [item.width, item.depth];
        const rotationY = Number(item.rotationY) || 0;
        const width = Math.abs(baseWidth * Math.cos(rotationY)) + Math.abs(baseDepth * Math.sin(rotationY));
        const depth = Math.abs(baseWidth * Math.sin(rotationY)) + Math.abs(baseDepth * Math.cos(rotationY));
        const bounds = layout.safeBounds;

        assert.ok(item.x - width / 2 >= bounds.minX, `${physicalSpaceId}: ${item.type} exceeds minX`);
        assert.ok(item.x + width / 2 <= bounds.maxX, `${physicalSpaceId}: ${item.type} exceeds maxX`);
        assert.ok(item.z - depth / 2 >= bounds.minZ, `${physicalSpaceId}: ${item.type} exceeds minZ`);
        assert.ok(item.z + depth / 2 <= bounds.maxZ, `${physicalSpaceId}: ${item.type} exceeds maxZ`);
    });
});

const horizontalLayout = os10.physicalSpaces.phys_b_f1_xp_zn_horizontal_01;
horizontalLayout.items.forEach((item) => {
    const [baseWidth, baseDepth] = fixedDimensions[item.type] || [item.width, item.depth];
    const minWorldX = 23 + item.x - baseWidth / 2;
    const maxWorldX = 23 + item.x + baseWidth / 2;
    const minWorldZ = -26 + item.z - baseDepth / 2;
    const maxWorldZ = -26 + item.z + baseDepth / 2;
    assert.ok(minWorldX >= 17 && maxWorldX <= 29, `${item.type} leaves OS-10 on X`);
    assert.ok(minWorldZ >= -29 && maxWorldZ <= -17, `${item.type} leaves OS-10 on Z`);
});

console.log('OS-10 furniture layout is isolated and inside safe bounds.');
