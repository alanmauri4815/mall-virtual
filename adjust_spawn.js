const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

const searchStr = "camera.position.set(0, 1.7, -82);\n                    controls.target.set(0, 1.80, -78);";
const replaceStr = "camera.position.set(0, 1.7, -85);\n                    controls.target.set(0, 1.7, -100);";

let newContent = content;
if (newContent.includes(searchStr)) {
    newContent = newContent.replace(searchStr, replaceStr);
    console.log('Spawn ajustado');
} else {
    const searchStrWin = searchStr.replace(/\n/g, '\r\n');
    if (newContent.includes(searchStrWin)) {
        newContent = newContent.replace(searchStrWin, replaceStr.replace(/\n/g, '\r\n'));
        console.log('Spawn ajustado (CRLF)');
    } else {
        console.log('ERROR: No se pudo encontrar el bloque de posicionamiento inicial.');
    }
}

if (newContent !== content) {
    fs.writeFileSync('index.html', newContent);
    console.log('Cambios guardados con éxito');
}
