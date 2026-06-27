const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// Actualizamos el desplazamiento a 0.3 para buscar la unión con la barra recta
const searchBot = 'cBot.position.set(side + (side > 0 ? 0.2 : -0.2), 1.62 - curveR * Math.cos(pitch) - 0.05, -curveR * Math.sin(pitch) + 0.3);';
const replaceBot = 'cBot.position.set(side + (side > 0 ? 0.3 : -0.3), 1.62 - curveR * Math.cos(pitch) - 0.05, -curveR * Math.sin(pitch) + 0.3);';

const searchTop = 'cTop.position.set(side + (side > 0 ? 0.2 : -0.2), (rise + 1.62) - curveR * Math.cos(pitch) - 0.05, (runLen - curveR * Math.sin(pitch)) + 0.2);';
const replaceTop = 'cTop.position.set(side + (side > 0 ? 0.3 : -0.3), (rise + 1.62) - curveR * Math.cos(pitch) - 0.05, (runLen - curveR * Math.sin(pitch)) + 0.2);';

let newContent = content;
newContent = newContent.replace(searchBot, replaceBot);
newContent = newContent.replace(searchTop, replaceTop);

// CRLF Handling
if (newContent === content) {
    newContent = newContent.replace(searchBot.replace(/\n/g, '\r\n'), replaceBot.replace(/\n/g, '\r\n'));
    newContent = newContent.replace(searchTop.replace(/\n/g, '\r\n'), replaceTop.replace(/\n/g, '\r\n'));
}

fs.writeFileSync('index.html', newContent);
console.log('Curvas desplazadas a 0.3 para alinear con la barra');
