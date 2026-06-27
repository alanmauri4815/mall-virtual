const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// Eliminamos el desplazamiento de 0.3 para unir con la barra (volvemos a 'side')
const searchBot = 'cBot.position.set(side + (side > 0 ? 0.3 : -0.3), 1.62 - curveR * Math.cos(pitch) - 0.15, -curveR * Math.sin(pitch) + 0.3);';
const replaceBot = 'cBot.position.set(side, 1.62 - curveR * Math.cos(pitch) - 0.15, -curveR * Math.sin(pitch) + 0.3);';

const searchTop = 'cTop.position.set(side + (side > 0 ? 0.3 : -0.3), (rise + 1.62) - curveR * Math.cos(pitch) - 0.15, (runLen - curveR * Math.sin(pitch)) + 0.2);';
const replaceTop = 'cTop.position.set(side, (rise + 1.62) - curveR * Math.cos(pitch) - 0.15, (runLen - curveR * Math.sin(pitch)) + 0.2);';

let newContent = content;
newContent = newContent.replace(searchBot, replaceBot);
newContent = newContent.replace(searchTop, replaceTop);

// CRLF Handling
if (newContent === content) {
    newContent = newContent.replace(searchBot.replace(/\n/g, '\r\n'), replaceBot.replace(/\n/g, '\r\n'));
    newContent = newContent.replace(searchTop.replace(/\n/g, '\r\n'), replaceTop.replace(/\n/g, '\r\n'));
}

fs.writeFileSync('index.html', newContent);
console.log('Curvas alineadas en el eje X con las barras rectas');
