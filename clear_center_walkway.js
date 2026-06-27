const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// 1. Revertimos la extensión del chasis central (shell)
const searchShellExt = 'const shell = new THREE.Mesh(new THREE.BoxGeometry(escWidth, 0.92, bodyLen + 0.8), escMat);';
const replaceShellOrig = 'const shell = new THREE.Mesh(new THREE.BoxGeometry(escWidth, 0.92, bodyLen), escMat);';

const searchPosExt = 'shell.position.set(0, (rise / 2) + 0.4 * Math.sin(pitch), (runLen / 2) + 0.4 * Math.cos(pitch));';
const replacePosOrig = 'shell.position.set(0, rise / 2, runLen / 2);';

let newContent = content.replace(searchShellExt, replaceShellOrig).replace(searchPosExt, replacePosOrig);

// 2. Modificamos el bloque de retorno para que sea doble (uno a cada lado) y deje libre el centro
const searchReturn = /const returnL = 1\.2;[\s\S]*?esc\.add\(returnBox\);/g;
const replaceReturn = `const returnL = 1.2;
                    // Creamos dos aletas laterales en lugar de un bloque central
                    [side, -side].forEach(xPos => {
                        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.4, returnL), escMat);
                        wing.rotation.x = -pitch;
                        wing.position.set(xPos, (rise + 1.62) - 2 * curveR * Math.cos(pitch) - 0.2, runLen + 0.4);
                        esc.add(wing);
                    });`;

newContent = newContent.replace(searchReturn, replaceReturn);

// CRLF Handling
if (newContent === content) {
    newContent = newContent.replace(searchShellExt.replace(/\n/g, '\r\n'), replaceShellOrig.replace(/\n/g, '\r\n'))
                        .replace(searchPosExt.replace(/\n/g, '\r\n'), replacePosOrig.replace(/\n/g, '\r\n'))
                        .replace(searchReturn, replaceReturn);
}

fs.writeFileSync('index.html', newContent);
console.log('Centro liberado y extensiones laterales aplicadas con éxito');
