const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// Actualizamos el desplazamiento a 0.2
const searchBot = 'cBot.position.set(side + (side > 0 ? 0.1 : -0.1), 1.62 - curveR * Math.cos(pitch) - 0.05, -curveR * Math.sin(pitch) + 0.3);';
const replaceBot = 'cBot.position.set(side + (side > 0 ? 0.2 : -0.2), 1.62 - curveR * Math.cos(pitch) - 0.05, -curveR * Math.sin(pitch) + 0.3);';

const searchTop = 'cTop.position.set(side, (rise + 1.62) - curveR * Math.cos(pitch) - 0.05, (runLen - curveR * Math.sin(pitch)) + 0.2);';
// Nota: En el paso anterior me equivoqué y no apliqué el +0.1 a cTop en el script (aunque dije que lo haría). 
// Esta vez me aseguraré de que ambos tengan el +0.2.
const replaceTop = 'cTop.position.set(side + (side > 0 ? 0.2 : -0.2), (rise + 1.62) - curveR * Math.cos(pitch) - 0.05, (runLen - curveR * Math.sin(pitch)) + 0.2);';

// Si cTop no tenía el ajuste previo:
const searchTopOriginal = 'cTop.position.set(side, (rise + 1.62) - curveR * Math.cos(pitch) - 0.05, (runLen - curveR * Math.sin(pitch)) + 0.2);';

let newContent = content;
newContent = newContent.replace(searchBot, replaceBot);
// Intento con la versión que pueda tener el archivo
if (newContent.includes(searchTopOriginal)) {
    newContent = newContent.replace(searchTopOriginal, replaceTop);
} else {
    // Por si ya tenía un ajuste previo de 0.1
    const searchTop01 = 'cTop.position.set(side + (side > 0 ? 0.1 : -0.1), (rise + 1.62) - curveR * Math.cos(pitch) - 0.05, (runLen - curveR * Math.sin(pitch)) + 0.2);';
    newContent = newContent.replace(searchTop01, replaceTop);
}

// CRLF Handling
if (newContent === content) {
    const searchBotWin = searchBot.replace(/\n/g, '\r\n');
    const replaceBotWin = replaceBot.replace(/\n/g, '\r\n');
    newContent = newContent.replace(searchBotWin, replaceBotWin);
    
    if (newContent.includes(searchTopOriginal.replace(/\n/g, '\r\n'))) {
        newContent = newContent.replace(searchTopOriginal.replace(/\n/g, '\r\n'), replaceTop.replace(/\n/g, '\r\n'));
    } else {
        const searchTop01Win = 'cTop.position.set(side + (side > 0 ? 0.1 : -0.1), (rise + 1.62) - curveR * Math.cos(pitch) - 0.05, (runLen - curveR * Math.sin(pitch)) + 0.2);'.replace(/\n/g, '\r\n');
        newContent = newContent.replace(searchTop01Win, replaceTop.replace(/\n/g, '\r\n'));
    }
}

fs.writeFileSync('index.html', newContent);
console.log('Curvas desplazadas a 0.2 unidades hacia afuera');
