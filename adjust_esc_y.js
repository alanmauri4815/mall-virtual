const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// Buscamos el bloque de definición de Y dentro de la función
const searchStr = 'const bottomY = 0.05;\n                const topY = anchorSlabTopY + 0.02;';
const replaceStr = 'const bottomY = -0.05;\n                const topY = anchorSlabTopY - 0.08;';

if (content.includes(searchStr)) {
    const newContent = content.replace(searchStr, replaceStr);
    fs.writeFileSync('index.html', newContent);
    console.log('Escalera bajada 0.1 unidades con éxito');
} else {
    // Intento con CRLF por si acaso
    const searchStrWin = searchStr.replace(/\n/g, '\r\n');
    if (content.includes(searchStrWin)) {
        const newContent = content.replace(searchStrWin, replaceStr.replace(/\n/g, '\r\n'));
        fs.writeFileSync('index.html', newContent);
        console.log('Escalera bajada 0.1 unidades con éxito (CRLF)');
    } else {
        console.log('ERROR: No se pudo encontrar el bloque de alturas de la escalera.');
    }
}
