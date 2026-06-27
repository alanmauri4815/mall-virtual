const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// Buscamos el lugar después de añadir las curvas para insertar el metal de cierre
const searchStr = 'esc.add(cTop);';
const insertStr = `esc.add(cTop);

                    // Pedacito de metal para cerrar la estructura y recibir la goma del pasamanos
                    const returnH = 0.5;
                    const returnBox = new THREE.Mesh(new THREE.BoxGeometry(0.18, returnH, 0.2), escMat);
                    // Posicionamos el metal justo bajo el extremo inferior de la curva
                    returnBox.position.set(side, (rise + 1.62) - 2 * curveR * Math.cos(pitch) - returnH / 2, runLen + 2 * curveR * Math.sin(pitch));
                    esc.add(returnBox);`;

if (content.includes(searchStr)) {
    // Usamos replace con una función para que se aplique a ambos lados (laneOffset y -laneOffset)
    const newContent = content.replace(/esc\.add\(cTop\);/g, insertStr);
    fs.writeFileSync('index.html', newContent);
    console.log('Estructura metálica de retorno añadida con éxito');
} else {
    console.log('ERROR: No se pudo encontrar el punto de inserción para el metal.');
}
