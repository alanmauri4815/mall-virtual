const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const world = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-world.js'), 'utf8');
assert.match(world, /const mazeCenter = \{ x: -37, z: 179 \}/, 'El laberinto debe conservar el desplazamiento 1m norte y 1m oeste');

function readMazeRows(name) {
    const match = world.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n                \\];`));
    assert.ok(match, `No se encontro la definicion ${name}`);
    return [...match[1].matchAll(/'([.#]+)'/g)].map(([, row]) => row);
}

const horizontalWalls = readMazeRows('horizontalWalls');
const verticalWalls = readMazeRows('verticalWalls');
const rows = horizontalWalls.length - 1;
const columns = horizontalWalls[0].length;
assert.equal(rows, 18);
assert.equal(columns, 17);
assert.ok(horizontalWalls.every((row) => row.length === columns));
assert.ok(verticalWalls.every((row) => row.length === columns + 1));

const start = [0, 0];
const finish = [rows - 1, columns - 1];
const queue = [start];
const visited = new Set(['0,0']);

function visit(row, col, nextRow, nextCol, opening) {
    if (opening !== '.') return;
    const key = `${nextRow},${nextCol}`;
    if (!visited.has(key)) {
        visited.add(key);
        queue.push([nextRow, nextCol]);
    }
}

while (queue.length) {
    const [row, col] = queue.shift();
    if (row > 0) visit(row, col, row - 1, col, horizontalWalls[row][col]);
    if (row < rows - 1) visit(row, col, row + 1, col, horizontalWalls[row + 1][col]);
    if (col > 0) visit(row, col, row, col - 1, verticalWalls[row][col]);
    if (col < columns - 1) visit(row, col, row, col + 1, verticalWalls[row][col + 1]);
}

assert.equal(visited.size, rows * columns, 'El laberinto debe mantener todas sus celdas conectadas');
assert.equal(visited.has(finish.join(',')), true, 'La meta debe ser alcanzable desde la entrada');
assert.equal(verticalWalls[0][0], '.', 'La abertura de entrada debe permanecer libre');
assert.equal(verticalWalls[rows - 1][columns], '.', 'La abertura de salida debe permanecer libre');

console.log(`Maze route verified: ${visited.size} connected cells from ENTRADA to META.`);
