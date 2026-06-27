const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// Modificamos la posición X de la curva inferior (cBot)
const searchBot = 'cBot.position.set(side, 1.62 - curveR * Math.cos(pitch) - 0.05, -curveR * Math.sin(pitch) + 0.3);';
const replaceBot = 'cBot.position.set(side + (side > 0 ? 0.1 : -0.1), 1.62 - curveR * Math.cos(pitch) - 0.05, -curveR * Math.sin(pitch) + 0.3);';

// Modificamos la posición X de la curva superior (cTop)
const searchTop = 'cTop.position.set(side, (rise + 1.62) - curveR * Math.cos(pitch) - 0.05, (runLen - curveR * Math.sin(pitch)) + 0.2);';
const replaceTop = 'cTop.position.set(side + (side > 0 ? 0.1 : -0.1), (rise + 1.62) - curveR * Math.cos(pitch) - 0.05, (runLen - curveR * Math.sin(pitch)) + 0.2);';

let newContent = content;
if (newContent.includes(searchBot)) {
    newContent = newContent.replace(searchBot, replaceBot);
    console.log('Curva inferior ajustada');
} else {
    const searchBotWin = searchBot.replace(/\n/g, '\r\n');
    if (newContent.includes(searchBotWin)) {
        newContent = newContent.replace(searchBotWin, replaceBot.replace(/\n/g, '\r\n'));
        console.log('Curva inferior ajustada (CRLF)');
    }
}

if (newContent.includes(searchTop)) {
    newContent = newContent.replace(searchTop, replaceTop);
    console.log('Curva superior ajustada');
} else {
    const searchTopWin = searchTop.replace(/\n/g, '\r\n');
    if (newContent.includes(searchTopWin)) {
        newContent = newContent.replace(searchTopWin, replaceTop.replace(/\n/g, '\r\n'));
        console.log('Curva superior ajustada (CRLF)');
    }
}

if (newContent !== content) {
    fs.writeFileSync('index.html', newContent);
    console.log('Cambios guardados con éxito');
} else {
    console.log('ERROR: No se pudieron encontrar las líneas de las curvas.');
}
