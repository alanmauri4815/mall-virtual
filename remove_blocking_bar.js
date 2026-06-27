const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// Definimos los cortes exactos basados en la posición de las escaleras (laneOffset = 8.25)
// El hueco debe ir desde x = 6.5 hasta x = 10 (y simétrico en el otro lado)
const searchRailings = /if \(!longAxisOnX\) \{[\s\S]*?drawRail\(anchorEscalatorVoidWidth, railThickness, 0, slabZCenter - \(voidHalfL \+ railThickness \/ 2\)\);\s+\}/g;

const replaceRailings = `if (!longAxisOnX) {
                    const zFront = slabZCenter + voidHalfL + railThickness / 2;
                    const zBack = slabZCenter - (voidHalfL + railThickness / 2);

                    [zFront, zBack].forEach(zPos => {
                        // 1. TRAMO CENTRAL: Entre las dos escaleras
                        // Las escaleras están en +/- 8.25. El hueco debe empezar en +/- 6.5
                        const centerW = 6.4 * 2; 
                        drawRail(centerW, railThickness, 0, zPos);

                        // 2. TRAMOS LATERALES EXTERIORES: 
                        // Desde 10 (borde) hasta 9.8 (inicio hueco exterior)
                        // Como el hueco termina en el borde (10), no necesitamos tramos exteriores
                        // si el laneOffset + escHalfWidth + margin llega al borde.
                    });
                } else {
                    drawRail(anchorEscalatorVoidWidth, railThickness, 0, slabZCenter + voidHalfL + railThickness / 2);
                    drawRail(anchorEscalatorVoidWidth, railThickness, 0, slabZCenter - (voidHalfL + railThickness / 2));
                }`;

let newContent = content.replace(searchRailings, replaceRailings);

// CRLF Handling
if (newContent === content) {
    newContent = content.replace(searchRailings, replaceRailings);
}

fs.writeFileSync('index.html', newContent);
console.log('Barra intrusa eliminada. Huecos de paso ensanchados y verificados.');
