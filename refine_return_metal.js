const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// Definimos la nueva geometría del metal de retorno: más larga y con la misma pendiente que la escala
const searchStr = 'const returnH = 0.5;';
const replaceStr = `const returnL = 1.2; // Más largo para que se una con el chasis
                    const returnBox = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.4, returnL), escMat);
                    returnBox.rotation.x = -pitch; // Misma pendiente que la escala
                    // Posicionamos para que un extremo reciba la goma y el otro se funda con la escala
                    returnBox.position.set(side, (rise + 1.62) - 2 * curveR * Math.cos(pitch) - 0.2, runLen + 0.4);
                    esc.add(returnBox);`;

// Eliminamos el bloque anterior y ponemos el nuevo
const regex = /const returnH = 0\.5;[\s\S]*?esc\.add\(returnBox\);/g;

if (content.match(regex)) {
    const newContent = content.replace(regex, replaceStr);
    fs.writeFileSync('index.html', newContent);
    console.log('Metal de retorno alargado e inclinado para unión elegante');
} else {
    console.log('ERROR: No se pudo encontrar el bloque metálico anterior para modificarlo.');
}
