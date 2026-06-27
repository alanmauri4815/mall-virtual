const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// Aplicamos la lógica de perpendicularidad y unión exacta para el 2° Piso
const searchTop = 'cTop.position.set(side, (rise + 1.62) - curveR * Math.cos(pitch) + 0.25, (runLen - curveR * Math.sin(pitch)) + 0.45);';
// Nueva posición basada en la cuerda diametral perpendicular
const replaceTop = 'cTop.position.set(side, (rise + 1.62) + curveR * Math.cos(pitch), runLen + curveR * Math.sin(pitch));';

const searchRot = 'cTop.rotation.x = -pitch + 2.6; // Giramos un poco más para unir con la barra';
// Nueva rotación: pitch + PI/2 (perpendicular a la barra)
const replaceRot = 'cTop.rotation.x = pitch + Math.PI / 2;';

let newContent = content;
newContent = newContent.replace(searchTop, replaceTop);
newContent = newContent.replace(searchRot, replaceRot);

// CRLF Handling
if (newContent === content) {
    newContent = newContent.replace(searchTop.replace(/\n/g, '\r\n'), replaceTop.replace(/\n/g, '\r\n'));
    newContent = newContent.replace(searchRot.replace(/\n/g, '\r\n'), replaceRot.replace(/\n/g, '\r\n'));
}

fs.writeFileSync('index.html', newContent);
console.log('Geometría de precisión aplicada al 2° piso (Cuerda perpendicular)');
