const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// Actualizamos el Spawn a la vista de detalle lateral del 2° piso
const searchSpawn = "camera.position.set(0, 7.1, -85);\n                    controls.target.set(0, 7.1, -100);";
const replaceSpawn = "camera.position.set(10, 6, -96);\n                    controls.target.set(6, 5.5, -97);";

let newContent = content.replace(searchSpawn, replaceSpawn);

// CRLF Handling
if (newContent === content) {
    newContent = content.replace(searchSpawn.replace(/\n/g, '\r\n'), replaceSpawn.replace(/\n/g, '\r\n'));
}

fs.writeFileSync('index.html', newContent);
console.log('Nuevo punto de inspección detallada configurado');
