const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// Aplicamos el ángulo basado en la cuerda perpendicular: PI/2 - pitch
const searchRot = 'cTop.rotation.x = pitch + Math.PI / 2;';
const replaceRot = 'cTop.rotation.x = Math.PI / 2 - pitch; // Cuerda diametral perpendicular a la barra';

let newContent = content;
if (newContent.includes(searchRot)) {
    newContent = newContent.replace(searchRot, replaceRot);
} else {
    // Por si acaso el archivo tiene la versión anterior
    const searchRotOld = 'cTop.rotation.x = -pitch + 2.6; // Giramos un poco más para unir con la barra';
    newContent = newContent.replace(searchRotOld, replaceRot);
}

// CRLF Handling
if (newContent === content) {
    newContent = newContent.replace(searchRot.replace(/\n/g, '\r\n'), replaceRot.replace(/\n/g, '\r\n'));
}

fs.writeFileSync('index.html', newContent);
console.log('Ángulo de perpendicularidad aplicado al 2° piso');
