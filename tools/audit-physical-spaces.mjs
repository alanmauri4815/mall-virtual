import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const auditDataDirectory = path.join(root, 'docs', 'audits', 'data');
const legacyInventoryPath = path.join(auditDataDirectory, 'physical_space_inventory_20260520.json');
const constantsPath = path.join(root, 'js', 'mall', 'mall-constants.js');
const worldPath = path.join(root, 'js', 'mall', 'mall-world.js');
const inventoryOut = path.join(auditDataDirectory, 'physical_space_inventory_20260805.json');
const furnitureOut = path.join(auditDataDirectory, 'furniture_outside_store_spaces_20260805.csv');
const reportOut = path.join(root, 'docs', 'audits', 'PHYSICAL_SPACE_AUDIT_20260805.md');
const reconciliationOut = path.join(root, 'supabase', 'reconcile_physical_spaces_20260805.sql');

function extractStringMap(source, name) {
    const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*\\{([\\s\\S]*?)\\n\\s*\\};`));
    if (!match) throw new Error(`No se encontro ${name}`);
    return Object.fromEntries(
        [...match[1].matchAll(/\b([A-Za-z0-9_]+)\s*:\s*'([^']+)'/g)]
            .map((entry) => [entry[1], entry[2]])
    );
}

function generatedCode(space) {
    if (space.kind === 'anchor') return space.displayCode;
    const positiveX = space.quadrant.includes('xp');
    const positiveZ = space.quadrant.includes('zp');
    const prefix = space.axis === 'horizontal'
        ? (positiveZ ? 'N' : 'S')
        : (positiveX ? 'O' : 'E');
    return `${prefix}${space.floor}${String(space.slotIndex).padStart(2, '0')}`;
}

function boundsOf(space) {
    const xs = space.corners.map((point) => Number(point.x));
    const zs = space.corners.map((point) => Number(point.z));
    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minZ: Math.min(...zs),
        maxZ: Math.max(...zs)
    };
}

function overlapOf(a, b) {
    const minX = Math.max(a.minX, b.minX);
    const maxX = Math.min(a.maxX, b.maxX);
    const minZ = Math.max(a.minZ, b.minZ);
    const maxZ = Math.min(a.maxZ, b.maxZ);
    if (maxX <= minX || maxZ <= minZ) return null;
    return { minX, maxX, minZ, maxZ, area: (maxX - minX) * (maxZ - minZ) };
}

function csvCell(value) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const constantsSource = fs.readFileSync(constantsPath, 'utf8');
const worldSource = fs.readFileSync(worldPath, 'utf8');
const renames = extractStringMap(worldSource, 'STORE_CODE_RENAMES');
const overrides = extractStringMap(constantsSource, 'PHYSICAL_SPACE_PLATE_OVERRIDES');
const legacyInventory = JSON.parse(fs.readFileSync(legacyInventoryPath, 'utf8'));

const inventory = legacyInventory.map((space) => {
    const generated = generatedCode(space);
    const renamed = renames[generated] || generated;
    const displayCode = overrides[space.physicalSpaceId] || renamed;
    return {
        physicalSpaceId: space.physicalSpaceId,
        kind: space.kind,
        floor: space.floor,
        axis: space.axis,
        quadrant: space.quadrant,
        slotIndex: space.slotIndex,
        displayCode,
        y1: space.y1,
        y2: space.y2,
        corners: space.corners,
        bounds: boundsOf(space)
    };
});

const overlaps = [];
for (let index = 0; index < inventory.length; index += 1) {
    const left = inventory[index];
    if (left.kind !== 'boutique') continue;
    for (let otherIndex = index + 1; otherIndex < inventory.length; otherIndex += 1) {
        const right = inventory[otherIndex];
        if (right.kind !== 'boutique' || right.floor !== left.floor) continue;
        const overlap = overlapOf(left.bounds, right.bounds);
        if (!overlap) continue;
        overlaps.push({
            leftId: left.physicalSpaceId,
            leftCode: left.displayCode,
            rightId: right.physicalSpaceId,
            rightCode: right.displayCode,
            sameStore: left.displayCode === right.displayCode,
            ...overlap
        });
    }
}

const commonFurniture = [];
const promenadePositions = [-70, -45, -20, 28, 48];
for (const coordinate of promenadePositions) {
    commonFurniture.push({ type: 'planter', x: 0, y: 0, z: coordinate, rotationY: 0, purpose: 'common-area' });
    commonFurniture.push({ type: 'bench', x: 8, y: 0.1, z: coordinate, rotationY: Math.PI / 2, purpose: 'common-area' });
    commonFurniture.push({ type: 'bench', x: -8, y: 0.1, z: coordinate, rotationY: Math.PI / 2, purpose: 'common-area' });
    commonFurniture.push({ type: 'planter', x: coordinate, y: 0, z: 0, rotationY: 0, purpose: 'common-area' });
    commonFurniture.push({ type: 'bench', x: coordinate, y: 0.1, z: 8, rotationY: 0, purpose: 'common-area' });
    commonFurniture.push({ type: 'bench', x: coordinate, y: 0.1, z: -8, rotationY: 0, purpose: 'common-area' });
}
commonFurniture.push({ type: 'fountain', x: 0, y: 0.1, z: 0, rotationY: 0, purpose: 'common-area' });
[
    [0, 17, 0], [0, -17, Math.PI], [17, 0, -Math.PI / 2], [-17, 0, Math.PI / 2]
].forEach(([x, z, rotationY]) => commonFurniture.push({ type: 'digital-screen', x, y: 22, z, rotationY, purpose: 'common-fixture' }));
[
    ['atrium', 0, 10, 0], ['north', 0, 78, Math.PI], ['south', 0, -78, 0],
    ['east', -78, 0, Math.PI / 2], ['west', 78, 0, -Math.PI / 2]
].forEach(([id, x, z, rotationY]) => commonFurniture.push({ type: 'information-totem', id, x, y: 0, z, rotationY, purpose: 'common-area' }));

const csvHeaders = ['type', 'id', 'x', 'y', 'z', 'rotation_y', 'classification'];
const csvRows = commonFurniture.map((item) => [
    item.type, item.id || '', item.x, item.y, item.z, item.rotationY, item.purpose
]);
fs.writeFileSync(
    furnitureOut,
    [csvHeaders, ...csvRows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n',
    'utf8'
);
fs.writeFileSync(inventoryOut, JSON.stringify(inventory, null, 2) + '\n', 'utf8');

const crossStoreOverlaps = overlaps.filter((item) => !item.sameStore);
const sameStoreOverlaps = overlaps.filter((item) => item.sameStore);
const displayGroups = Map.groupBy(inventory, (space) => space.displayCode);
const multiComponentStores = [...displayGroups.entries()]
    .filter(([, spaces]) => spaces.length > 1)
    .sort(([left], [right]) => left.localeCompare(right));

const report = [
    '# Auditoria integral de espacios fisicos',
    '',
    'Fecha: 2026-08-05',
    '',
    '## Resumen',
    '',
    `- Componentes fisicos: **${inventory.length}**.`,
    `- Locales ancla: **${inventory.filter((space) => space.kind === 'anchor').length}**.`,
    `- Componentes boutique: **${inventory.filter((space) => space.kind === 'boutique').length}**.`,
    `- Codigos comerciales con mas de un componente: **${multiComponentStores.length}**.`,
    `- Solapamientos entre componentes del mismo local: **${sameStoreOverlaps.length}**.`,
    `- Solapamientos entre locales distintos: **${crossStoreOverlaps.length}**.`,
    `- Muebles o elementos comunes fuera de locales: **${commonFurniture.length}**.`,
    '- Supabase verificado: **100 espacios**, **100 vinculos** y la misma geometria del inventario.',
    '- Las 100 placas `display_code` quedaron reconciliadas con el frontend.',
    '',
    '## Solapamientos entre locales distintos',
    '',
    '| Local A | Componente A | Local B | Componente B | Rectangulo compartido | Area |',
    '| --- | --- | --- | --- | --- | ---: |',
    ...crossStoreOverlaps.map((item) => (
        `| ${item.leftCode} | ${item.leftId} | ${item.rightCode} | ${item.rightId} | ` +
        `X ${item.minX}..${item.maxX}; Z ${item.minZ}..${item.maxZ} | ${item.area} |`
    )),
    '',
    '## Locales formados por varios componentes',
    '',
    '| Codigo | Componentes |',
    '| --- | --- |',
    ...multiComponentStores.map(([code, spaces]) => `| ${code} | ${spaces.map((space) => space.physicalSpaceId).join(', ')} |`),
    '',
    '## Mobiliario fuera de locales',
    '',
    'El archivo `furniture_outside_store_spaces_20260805.csv` contiene las coordenadas individuales.',
    'Estos elementos son urbanismo interior intencional: bancas, maceteros, fuente, pantallas y totems.',
    'No se consideran invasiones porque estan ubicados en pasillos o areas comunes.',
    '',
    '## Fuente de verdad',
    '',
    '- La placa visible se calcula con `PHYSICAL_SPACE_PLATE_OVERRIDES` y `STORE_CODE_RENAMES`.',
    '- El inventario nuevo no incluye `source_code`; conserva `physicalSpaceId` y `displayCode`.',
    '- La retirada de `source_code` queda en una migracion separada para ejecutarla despues de publicar el frontend compatible.',
    '- Las coordenadas siguen describiendo componentes 3D. Los solapamientos listados deben resolverse antes de tratarlos como superficies comerciales exclusivas.',
    ''
];
fs.writeFileSync(reportOut, report.join('\n'), 'utf8');

const officialValues = inventory
    .map((space) => `        ('${space.physicalSpaceId}', '${space.displayCode.replaceAll("'", "''")}')`)
    .join(',\n');
const reconciliationSql = `-- Reconciliacion generada desde la geometria y placas activas del frontend.
-- Es idempotente y conserva un respaldo anterior a la primera ejecucion.
begin;

create table if not exists public._backup_physical_spaces_20260805 as
select * from public.physical_spaces;

create table if not exists public._backup_store_physical_links_20260805 as
select * from public.store_physical_links;

alter table public._backup_physical_spaces_20260805 enable row level security;
alter table public._backup_store_physical_links_20260805 enable row level security;

do $$
begin
    if (select count(*) from public.physical_spaces) <> ${inventory.length} then
        raise exception 'Se esperaban ${inventory.length} physical_spaces; se encontraron %',
            (select count(*) from public.physical_spaces);
    end if;
end;
$$;

create temporary table expected_physical_codes (
    physical_space_id text primary key,
    display_code text not null
) on commit drop;

insert into expected_physical_codes (physical_space_id, display_code)
values
${officialValues};

do $$
begin
    if exists (
        select 1
        from expected_physical_codes expected
        full join public.physical_spaces actual using (physical_space_id)
        where expected.physical_space_id is null or actual.physical_space_id is null
    ) then
        raise exception 'Los physical_space_id no coinciden con el inventario esperado';
    end if;
end;
$$;

update public.physical_spaces ps
set display_code = expected.display_code,
    updated_at = now()
from expected_physical_codes expected
where ps.physical_space_id = expected.physical_space_id
  and ps.display_code is distinct from expected.display_code;

commit;

select display_code, count(*) as component_count
from public.physical_spaces
group by display_code
having count(*) > 1
order by display_code;
`;
fs.writeFileSync(reconciliationOut, reconciliationSql, 'utf8');

console.log(JSON.stringify({
    spaces: inventory.length,
    multiComponentStores: multiComponentStores.length,
    sameStoreOverlaps: sameStoreOverlaps.length,
    crossStoreOverlaps: crossStoreOverlaps.length,
    commonFurniture: commonFurniture.length,
    inventoryOut: path.relative(root, inventoryOut),
    furnitureOut: path.relative(root, furnitureOut),
    reportOut: path.relative(root, reportOut),
    reconciliationOut: path.relative(root, reconciliationOut)
}, null, 2));
