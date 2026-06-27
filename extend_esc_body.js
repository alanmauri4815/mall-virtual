const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// 1. Aumentamos la longitud del chasis (shell) y ajustamos su posición para extenderlo arriba
const searchShell = 'const shell = new THREE.Mesh(new THREE.BoxGeometry(escWidth, 0.92, bodyLen), escMat);';
const replaceShell = 'const shell = new THREE.Mesh(new THREE.BoxGeometry(escWidth, 0.92, bodyLen + 0.8), escMat);';

const searchPos = 'shell.position.set(0, rise / 2, runLen / 2);';
// Desplazamos el centro para que la extensión de 0.8 sea solo hacia el extremo superior
const replacePos = 'shell.position.set(0, (rise / 2) + 0.4 * Math.sin(pitch), (runLen / 2) + 0.4 * Math.cos(pitch));';

let newContent = content.replace(searchShell, replaceShell).replace(searchPos, replacePos);

// CRLF Handling
if (newContent === content) {
    newContent = content.replace(searchShell.replace(/\n/g, '\r\n'), replaceShell.replace(/\n/g, '\r\n'))
                        .replace(searchPos.replace(/\n/g, '\r\n'), replacePos.replace(/\n/g, '\r\n'));
}

fs.writeFileSync('index.html', newContent);
console.log('Chasis de la escala extendido y unido con el retorno superior');
