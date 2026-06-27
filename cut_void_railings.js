const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// Definimos la lógica de corte para las barandas de cabecera
const searchRailings = `                // Cabeceras cortas del hueco
                drawRail(anchorEscalatorVoidWidth, railThickness, 0, slabZCenter + voidHalfL + railThickness / 2);
                drawRail(anchorEscalatorVoidWidth, railThickness, 0, slabZCenter - (voidHalfL + railThickness / 2));`;

const replaceRailings = `                // Cabeceras cortas del hueco (CON CORTES PARA PASO)
                if (!longAxisOnX) {
                    const holeW = 3.6; // Ancho del hueco para la escala
                    const centerPartW = (laneOffset - holeW / 2) * 2;
                    const zFront = slabZCenter + voidHalfL + railThickness / 2;
                    const zBack = slabZCenter - (voidHalfL + railThickness / 2);

                    [zFront, zBack].forEach(zPos => {
                        // Tramo central (entre las dos escalas)
                        drawRail(centerPartW, railThickness, 0, zPos);
                        
                        // Tramos de las esquinas (pequeños pedazos en los bordes exteriores)
                        const cornerW = voidHalfW - (laneOffset + holeW / 2);
                        if (cornerW > 0.1) {
                            drawRail(cornerW, railThickness, voidHalfW - cornerW/2, zPos);
                            drawRail(cornerW, railThickness, -voidHalfW + cornerW/2, zPos);
                        }
                    });
                } else {
                    // Si el diseño cambia a horizontal, por ahora dejamos las completas
                    drawRail(anchorEscalatorVoidWidth, railThickness, 0, slabZCenter + voidHalfL + railThickness / 2);
                    drawRail(anchorEscalatorVoidWidth, railThickness, 0, slabZCenter - (voidHalfL + railThickness / 2));
                }`;

let newContent = content.replace(searchRailings, replaceRailings);

// CRLF Handling
if (newContent === content) {
    newContent = content.replace(searchRailings.replace(/\n/g, '\r\n'), replaceRailings.replace(/\n/g, '\r\n'));
}

fs.writeFileSync('index.html', newContent);
console.log('Barandas de seguridad recortadas para permitir el flujo de personas');
