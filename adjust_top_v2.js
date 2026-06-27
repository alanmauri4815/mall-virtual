const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// 1. Ajuste de Spawn al 2° Piso
const searchSpawn = "camera.position.set(0, 1.7, -85);\n                    controls.target.set(0, 1.7, -100);";
const replaceSpawn = "camera.position.set(0, 7.1, -85);\n                    controls.target.set(0, 7.1, -100);";

// 2. Ajuste de Rotación de la curva superior (cTop)
const searchRot = 'cTop.rotation.x = -pitch + 2.4; // Ajuste para enganchar hacia abajo y hacia el chasis';
const replaceRot = 'cTop.rotation.x = -pitch + 2.6; // Giramos un poco más para unir con la barra';

let newContent = content;
newContent = newContent.replace(searchSpawn, replaceSpawn);
newContent = newContent.replace(searchRot, replaceRot);

// CRLF Handling
if (newContent === content) {
    newContent = newContent.replace(searchSpawn.replace(/\n/g, '\r\n'), replaceSpawn.replace(/\n/g, '\r\n'));
    newContent = newContent.replace(searchRot.replace(/\n/g, '\r\n'), replaceRot.replace(/\n/g, '\r\n'));
}

fs.writeFileSync('index.html', newContent);
console.log('Spawn al 2° piso y rotación de curva ajustada');
