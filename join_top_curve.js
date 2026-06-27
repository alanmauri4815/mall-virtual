const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// Ajustamos la posición de cTop para que su extremo superior coincida con la barra
const searchTop = 'cTop.position.set(side, (rise + 1.62) + curveR * Math.cos(pitch), runLen + curveR * Math.sin(pitch));';
const replaceTop = 'cTop.position.set(side, (rise + 1.62) - curveR * Math.cos(pitch), runLen + curveR * Math.sin(pitch));';

let newContent = content;
if (newContent.includes(searchTop)) {
    newContent = newContent.replace(searchTop, replaceTop);
} else {
    // Por si acaso
    const searchTopOld = 'cTop.position.set(side, (rise + 1.62) - curveR * Math.cos(pitch) + 0.25, (runLen - curveR * Math.sin(pitch)) + 0.45);';
    newContent = newContent.replace(searchTopOld, replaceTop);
}

// CRLF Handling
if (newContent === content) {
    newContent = newContent.replace(searchTop.replace(/\n/g, '\r\n'), replaceTop.replace(/\n/g, '\r\n'));
}

fs.writeFileSync('index.html', newContent);
console.log('Curva superior unida con la barra recta');
