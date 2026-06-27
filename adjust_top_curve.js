const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// Ajustamos la curva superior (cTop) para que parezca un gancho que baja hacia la barra y el chasis
const searchTop = 'cTop.position.set(side, (rise + 1.62) - curveR * Math.cos(pitch) - 0.15, (runLen - curveR * Math.sin(pitch)) + 0.3);';
const replaceTop = 'cTop.position.set(side, (rise + 1.62) - curveR * Math.cos(pitch) + 0.25, (runLen - curveR * Math.sin(pitch)) + 0.45);';

const searchRot = 'cTop.rotation.x = -pitch + 2.1; // Continuamos girando hacia la posición ideal';
const replaceRot = 'cTop.rotation.x = -pitch + 2.4; // Ajuste para enganchar hacia abajo y hacia el chasis';

let newContent = content;
newContent = newContent.replace(searchTop, replaceTop);
newContent = newContent.replace(searchRot, replaceRot);

// CRLF Handling
if (newContent === content) {
    newContent = newContent.replace(searchTop.replace(/\n/g, '\r\n'), replaceTop.replace(/\n/g, '\r\n'));
    newContent = newContent.replace(searchRot.replace(/\n/g, '\r\n'), replaceRot.replace(/\n/g, '\r\n'));
}

fs.writeFileSync('index.html', newContent);
console.log('Prototipo de curva superior (2° piso) aplicado');
