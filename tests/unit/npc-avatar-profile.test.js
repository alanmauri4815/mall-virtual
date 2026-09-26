const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../../js/mall/mall-npc.js'), 'utf8');
const profileStart = source.indexOf('const NPC_PEOPLE =');
const profileEnd = source.indexOf('const npcs =', profileStart);
assert.ok(profileStart >= 0 && profileEnd > profileStart, 'NPC profile configuration must exist');

const context = { result: null };
vm.runInNewContext(`${source.slice(profileStart, profileEnd)}
result = {
    people: NPC_PEOPLE.map(person => ({ ...person })),
    samples: NPC_PEOPLE.map((_, index) => getNPCIdentity(index))
};`, context);

assert.ok(context.result.people.length >= 40, 'The visible crowd needs enough named identities');
assert.equal(new Set(context.result.people.map(person => person.name)).size, context.result.people.length,
    'NPC names must be unique in the configured crowd');
assert.ok(context.result.people.some(person => person.body === 'male'));
assert.ok(context.result.people.some(person => person.body === 'female'));
context.result.samples.forEach((identity, index) => {
    assert.match(identity.style, new RegExp(`^av2\\.${context.result.people[index].body}\\.`));
    assert.equal(identity.style.split('.').length, 9, 'NPC style must persist its selected hair geometry');
});

assert.match(source, /const npcAvatar = createGameReadyAvatar\(name, style\)/,
    'NPCs must use the same skinned avatar factory as visitors');
assert.match(source, /Object\.assign\(npcAvatar, \{[\s\S]*?npcs\.push\(npcAvatar\)/,
    'Navigation state must be attached to the same actor that receives asynchronous Mixamo assets');
assert.match(source, /const NPC_SEATED_ROOT_LIFT = 0\.36;/,
    'A seated NPC must lift its visual root above the bench surface.');

const uiSource = fs.readFileSync(path.resolve(__dirname, '../../js/mall/mall-ui.js'), 'utf8');
assert.match(uiSource, /const anchorCenter = anchors\.left\.clone\(\)\.add\(anchors\.right\)\.multiplyScalar\(0\.5\);/,
    'The visual root correction must be computed from both planted feet.');
assert.match(uiSource, /const footCorrection = anchorCenter\.sub\(feet\.center\);/,
    'The visual root must counteract stand-up animation drift from the planted-foot midpoint.');
assert.match(uiSource, /\(motion === 'idle' && !!actor\.seatFootAnchors\)/,
    'The foot anchors must remain active through the standing settle pose.');
assert.match(uiSource, /actor\.gltfRoot\.position\.set\(\s*actor\.seatVisualOffset\.x,\s*actor\.gltfBaseY \+ actor\.seatVisualOffset\.y,\s*actor\.seatVisualOffset\.z\s*\)/,
    'The visual root must retain its correction while the planted-foot anchors are active.');
assert.doesNotMatch(uiSource, /lockGameReadyFootHorizontal/,
    'Foot bones must not be translated independently during the stand-up transition.');

console.log('npc-avatar-profile.test.js: ok');
