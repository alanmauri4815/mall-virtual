const fs = require('fs');
const readline = require('readline');

const inputFile = 'index.html';
const outputFile = 'index_fixed.html';

const rl = readline.createInterface({
    input: fs.createReadStream(inputFile),
    terminal: false
});

const out = fs.createWriteStream(outputFile);

let inCorruptedZone = false;
let foundStart = false;
let linesCopied = 0;

rl.on('line', (line) => {
    // Patrón de la corrupción
    const isCorrupt = line.includes("['S', 'N', 'E', 'O'].includes(idLetter)");

    if (!foundStart && isCorrupt) {
        console.log('Detectada zona de corrupción. Aplicando parche...');
        foundStart = true;
        inCorruptedZone = true;
        // Inyectamos el código correcto UNA SOLA VEZ
        out.write("            if (['S', 'N', 'E', 'O'].includes(idLetter)) {\n");
    } else if (inCorruptedZone && !isCorrupt) {
        // Hemos salido de la zona de corrupción
        // Solo salimos si la línea tiene contenido real y no es un residuo de la corrupción
        if (line.trim().length > 0 && !line.includes('if (idLetter')) {
            inCorruptedZone = false;
            console.log('Saliendo de la zona de corrupción. Rescatando el resto del archivo...');
            out.write(line + "\n");
        }
    } else if (!inCorruptedZone) {
        out.write(line + "\n");
        linesCopied++;
    }
});

rl.on('close', () => {
    console.log('Rescate completado. Archivo generado: ' + outputFile);
    process.exit(0);
});
