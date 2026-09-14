const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'js', 'mall', 'mall-maze-game.js'), 'utf8');

class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    clone() {
        return new Vector3(this.x, this.y, this.z);
    }

    copy(vector) {
        this.x = vector.x;
        this.y = vector.y;
        this.z = vector.z;
        return this;
    }

    add(vector) {
        this.x += vector.x;
        this.y += vector.y;
        this.z += vector.z;
        return this;
    }

    sub(vector) {
        this.x -= vector.x;
        this.y -= vector.y;
        this.z -= vector.z;
        return this;
    }
}

function makeElement() {
    return {
        hidden: true,
        textContent: '',
        dataset: {},
        listeners: {},
        addEventListener(type, handler) {
            this.listeners[type] = handler;
        }
    };
}

const elements = {
    'maze-timer': makeElement(),
    'maze-timer-value': makeElement(),
    'maze-timer-status': makeElement(),
    'maze-panic-button': makeElement(),
    'maze-time-limit': makeElement(),
    'maze-time-limit-continue': makeElement(),
    'maze-time-limit-exit': makeElement(),
    'maze-complete': makeElement(),
    'maze-complete-time': makeElement(),
    'maze-record-message': makeElement(),
    'maze-record-list': makeElement(),
    'maze-complete-continue': makeElement(),
    'maze-complete-exit': makeElement()
};
const camera = { position: new Vector3(-0.2, 1.7, 0) };
const controls = { target: new Vector3(0, 1.7, -1), update() {} };
const windowObject = {
    mallMazeDefinition: {
        bounds: { minX: 0, maxX: 10, minZ: -5, maxZ: 5 },
        start: { x: 1, z: 0 },
        finish: { x: 9, z: 0 },
        startRadius: 1,
        finishRadius: 1,
        entryGate: { x: 0, z: 0, width: 0.9 },
        panicStations: [{ id: 'panic-1', x: 5, z: 0, radius: 1.15 }]
    },
    resetMallNavigationInputs() {},
    mallMovementLockedUntil: 0,
    mallMazePlayerName: 'Visitante de prueba'
};
const sandbox = {
    console,
    document: {
        body: { dataset: {} },
        getElementById: (id) => elements[id]
    },
    performance: { now: () => 2000 },
    window: windowObject,
    camera,
    controls,
    THREE: { Vector3 },
    localStorage: {
        values: new Map(),
        getItem(key) { return this.values.get(key) || null; },
        setItem(key, value) { this.values.set(key, value); }
    },
    Date,
    Math
};
vm.runInNewContext(source, sandbox, { filename: 'mall-maze-game.js' });

const game = windowObject.mallMazeGame;
assert.equal(game.getState().status, 'idle');

windowObject.updateMallMazeGame(0);
assert.equal(game.getState().status, 'idle');
assert.equal(elements['maze-timer'].hidden, true, 'No debe aparecer antes de cruzar la entrada');

camera.position.x = 0.2;
windowObject.updateMallMazeGame(1000);
assert.equal(game.getState().status, 'running');
assert.equal(game.getState().startedAt, 1000);
assert.equal(elements['maze-timer'].hidden, false);

camera.position.x = 5;
windowObject.updateMallMazeGame(901001);
assert.equal(game.getState().status, 'limit-prompt');
assert.equal(elements['maze-time-limit'].hidden, false, 'Debe preguntar al cumplir 15 minutos dentro');

elements['maze-time-limit-continue'].listeners.click();
assert.equal(game.getState().status, 'running');

camera.position.x = 5;
windowObject.updateMallMazeGame(3000);
assert.equal(elements['maze-panic-button'].hidden, false, 'La estación de ayuda debe habilitar la salida');
elements['maze-panic-button'].listeners.click();
assert.equal(game.getState().status, 'idle');
assert.equal(camera.position.x, -2.2, 'La salida debe dejar al jugador fuera del laberinto');
assert.equal(elements['maze-timer'].hidden, true);
assert.equal(elements['maze-time-limit'].hidden, true);

camera.position.x = -0.2;
windowObject.updateMallMazeGame(4000);
camera.position.x = 0.2;
windowObject.updateMallMazeGame(5000);
assert.equal(game.getState().status, 'running');
camera.position.x = 12;
windowObject.updateMallMazeGame(6000);
assert.equal(game.getState().status, 'idle', 'Salir por el perímetro debe cerrar el intento');
assert.equal(elements['maze-timer'].hidden, true);

camera.position.x = -0.2;
windowObject.updateMallMazeGame(7000);
camera.position.x = 0.2;
windowObject.updateMallMazeGame(8000);
camera.position.x = 9;
windowObject.updateMallMazeGame(9000);
assert.equal(game.getState().status, 'complete');
assert.equal(elements['maze-complete'].hidden, false, 'La meta debe mostrar el tiempo final');
assert.equal(elements['maze-complete-time'].textContent, '00:01');
assert.match(elements['maze-record-message'].textContent, /Nuevo récord/);
assert.match(elements['maze-record-list'].textContent, /Visitante de prueba/);
elements['maze-complete-continue'].listeners.click();
assert.equal(elements['maze-complete'].hidden, true);
camera.position.x = 12;
windowObject.updateMallMazeGame(10000);
assert.equal(game.getState().status, 'idle', 'Un recorrido terminado debe poder reiniciarse al salir');

console.log('Maze game behavior verified: threshold start, 15-minute prompt, and panic exit.');
