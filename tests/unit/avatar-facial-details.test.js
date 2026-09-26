const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.resolve(__dirname, '../../js/mall/mall-ui.js'), 'utf8');
const page = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
const styles = fs.readFileSync(path.resolve(__dirname, '../../css/mall.css'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(source.includes('function addGameReadyFacialDetails'), 'Missing facial-detail builder.');
assert(source.includes('mall-persona-masculino-casual-v7-mejorada.glb'), 'Male catalog must use the validated facial-geometry export.');
assert(source.includes('mall-persona-femenino-casual-v5-mejorada.glb'), 'Female catalog must use the validated facial-geometry export.');
assert(!source.includes('applyGameReadyFaceShader') && !source.includes('mall-face-uv'), 'UV face overlays must not conflict with baked facial geometry.');
assert(source.includes('/^AvatarEyeWhite$/i'), 'Eye whites must use their dedicated mesh material.');
assert(source.includes('/^AvatarIris$/i') && source.includes('getGameReadyEyeColor(appearance.eyeColor)'), 'Iris material must use the selected eye color.');
assert(source.includes('/^AvatarPupil$/i'), 'Pupils must use their dedicated mesh material.');
assert(source.includes('texture.flipY = false'), 'GLTF eye textures must preserve their authored UV orientation.');
assert(source.includes('/^AvatarBrow$/i'), 'Brows must use their dedicated mesh material.');
assert(source.includes('eyeColor: "brown"'), 'Legacy profiles need a default eye color.');
assert(source.includes('["brown", "hazel", "green", "blue"].includes(eyeColor)'), 'The profile parser must validate synchronized eye colors.');
assert(source.includes('AVATAR_HAIR_STYLES'), 'Avatar profiles must expose the supported hair geometry catalog.');
assert(source.includes('hairStyle: "short01"'), 'Legacy profiles need a default hair style.');
assert(source.includes('isCatalogHair'), 'Only the selected catalog hair mesh should be visible.');
assert(source.includes('material.visible = node.visible'), 'Hair material visibility must match its selected mesh.');
assert(source.includes('node.visible = catalogHairStyle === selectedHairStyle'), 'Only the selected catalog hair mesh must be rendered.');
assert(source.includes('const hairStyleChanged'), 'A hair-style selection must rebuild the existing avatar instance.');
assert(source.includes('const catalogHairStyle'), 'Hair selection must support GLTF node and mesh naming.');
assert(source.includes('standing-idle.glb'), 'The selected Standing Idle clip must drive avatar rest poses.');
assert(source.includes('addGameReadyFacialDetails(extractGameReadyRig(root), styleCode);'), 'Mirror preview must receive facial details.');
assert(source.includes('actor.facialDetails = addGameReadyFacialDetails(actor.gameReadyRig, actor.styleCode);'), 'Mall avatar must receive facial details.');

function assertAppearanceOptions(kind, values) {
    for (const value of values) {
        const option = new RegExp(`data-avatar-kind="${kind}"[^>]*data-avatar-value="${value}"|data-avatar-value="${value}"[^>]*data-avatar-kind="${kind}"`);
        assert(option.test(page), `Customizer must expose ${kind} option ${value}.`);
    }
}

assertAppearanceOptions('skinTone', ['fair', 'light', 'olive', 'latino', 'asian', 'medium', 'deep', 'rich']);
assertAppearanceOptions('hairStyle', ['short01', 'short02', 'short03', 'short04', 'bob01', 'long01', 'ponytail01', 'braid01', 'afro01']);
assertAppearanceOptions('hairColor', ['black', 'brown', 'blonde', 'auburn']);
assertAppearanceOptions('eyeColor', ['brown', 'hazel', 'green', 'blue']);
assertAppearanceOptions('age', ['young', 'adult', 'senior']);
assertAppearanceOptions('height', ['155', '160', '165', '170', '175', '180', '185', '190']);
assertAppearanceOptions('outfit', ['elegant', 'casual', 'work', 'sport']);
assert(page.includes('data-avatar-hair-for="male"') && page.includes('data-avatar-hair-for="female"') && page.includes('data-avatar-hair-for="all"'), 'Customizer must identify hair styles available for each presentation.');
assert(!page.includes('data-avatar-value="formal"'), 'Customizer must not offer the obsolete outfit value.');
assert(page.includes('id="avatar-mirror-canvas"') && page.includes('class="avatar-mirror"'), 'Customizer must include the canvas and container for the 3D preview.');
assert(page.includes('onclick="applyAvatarCustomizer()"') && page.includes('onclick="closeAvatarCustomizer()"'), 'Customizer must let visitors apply or cancel their preview changes.');
assert(source.includes('function refreshAvatarMirror') && source.includes('refreshAvatarMirror(getAvatarProfileStyleCode(profile))'), 'Appearance changes must refresh the live avatar model preview.');
assert(styles.includes('.avatar-customizer-layout') && styles.includes('#avatar-mirror-canvas'), 'The avatar preview layout must be styled.');
assert(styles.includes('position: sticky;') && styles.includes('.avatar-mirror'), 'The preview should stay visible while scrolling the options on narrow screens.');

console.log('Avatar facial-detail contract passed.');
