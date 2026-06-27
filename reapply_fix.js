const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const searchStr = 'handrail.rotation.x = -pitch;\n                    esc.add(handrail);\n                });';
const insertStr = `handrail.rotation.x = -pitch;
                    esc.add(handrail);

                    // Curvas de goma realistas según diseño del usuario
                    const curveR = 0.65;
                    const torusGeom = new THREE.TorusGeometry(curveR, 0.06, 12, 24, Math.PI);
                    
                    // Curva inferior: Ajustada para cerrar el hueco y acercar a la escala
                    const cBot = new THREE.Mesh(torusGeom, darkMat);
                    // Bajamos un poquito (-0.05) para el encaje exacto
                    cBot.position.set(side, 1.62 - curveR * Math.cos(pitch) - 0.05, -curveR * Math.sin(pitch) + 0.3);
                    cBot.rotation.y = Math.PI / 2;
                    cBot.rotation.x = -pitch - 1.1; 
                    esc.add(cBot);

                    // Curva superior: Corregida para apuntar hacia abajo y hacia la escala
                    const cTop = new THREE.Mesh(torusGeom, darkMat);
                    // Ajustamos posición: Pegamos la curva a la escala (Offset +0.2)
                    cTop.position.set(side, (rise + 1.62) - curveR * Math.cos(pitch) - 0.05, (runLen - curveR * Math.sin(pitch)) + 0.2);
                    cTop.rotation.y = Math.PI / 2;
                    cTop.rotation.x = -pitch + 2.1; // Continuamos girando hacia la posición ideal
                    esc.add(cTop);
                });`;

if (content.includes(searchStr)) {
    const newContent = content.replace(searchStr, insertStr);
    fs.writeFileSync('index.html', newContent);
    console.log('Cambio aplicado con éxito');
} else {
    console.log('No se encontró la cadena de búsqueda. Intentando con terminaciones de línea alternativas...');
    const searchStrWin = searchStr.replace(/\n/g, '\r\n');
    if (content.includes(searchStrWin)) {
        const newContent = content.replace(searchStrWin, insertStr.replace(/\n/g, '\r\n'));
        fs.writeFileSync('index.html', newContent);
        console.log('Cambio aplicado con éxito (CRLF)');
    } else {
        console.log('FALLO: No se encontró el punto de inserción.');
    }
}
