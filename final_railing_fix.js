const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// 1. Reducimos el ancho de la baranda central para liberar totalmente el desembarque (de 12.8 a 12.0)
const searchCenterW = 'const centerW = 6.4 * 2;';
const replaceCenterW = 'const centerW = 6.0 * 2; // Reducido para evitar solapamiento con el desembarque';

// 2. Corregimos el bucle de las aletas para evitar duplicados (eliminamos el forEach interno innecesario)
const searchWings = /\[side, -side\]\.forEach\(xPos => \{[\s\S]*?const wing = new THREE\.Mesh\(new THREE\.BoxGeometry\(0\.22, 0\.4, returnL\), escMat\);[\s\S]*?wing\.rotation\.x = -pitch;[\s\S]*?wing\.position\.set\(xPos,[\s\S]*?esc\.add\(wing\);[\s\S]*?\}\);/g;

const replaceWings = `const wing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.4, returnL), escMat);
                    wing.rotation.x = -pitch;
                    wing.position.set(side, (rise + 1.62) - 2 * curveR * Math.cos(pitch) - 0.2, runLen + 0.4);
                    esc.add(wing);`;

let newContent = content.replace(searchCenterW, replaceCenterW).replace(searchWings, replaceWings);

// CRLF Handling
if (newContent === content) {
    newContent = content.replace(searchCenterW, replaceCenterW).replace(searchWings, replaceWings);
}

fs.writeFileSync('index.html', newContent);
console.log('Cirugía estética completada: Baranda central recortada y duplicados eliminados.');
