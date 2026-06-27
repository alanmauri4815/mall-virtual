const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const searchStr = 'addAnchorGateway(anchorFrontWallZ, 1);';
const insertStr = `addAnchorGateway(anchorFrontWallZ, 1);
            const addAnchorVoidRailings = () => {
                const railH = 1.1;
                const railThickness = 0.08;
                const handrailSize = 0.12;
                const glassMat = new THREE.MeshStandardMaterial({ color: 0xbfd7ef, transparent: true, opacity: 0.35, metalness: 0.1, roughness: 0.1 });
                const handrailMat = darkMat;

                const drawRail = (w, d, x, z) => {
                    const glass = new THREE.Mesh(new THREE.BoxGeometry(w, railH, d), glassMat);
                    glass.position.set(x, anchorSlabTopY + railH / 2, z);
                    g.add(glass);
                    const hr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, handrailSize, d + 0.05), handrailMat);
                    hr.position.set(x, anchorSlabTopY + railH + handrailSize / 2, z);
                    g.add(hr);

                    // Registro de colisión física (Mundial) corregido para 2do piso
                    const cosR = Math.cos(rotY);
                    const sinR = Math.sin(rotY);
                    const worldX = posX + (x * cosR + z * sinR);
                    const worldZ = posZ + (-x * sinR + z * cosR);
                    
                    const isRotated = Math.abs(sinR) > 0.5;
                    const baseW = isRotated ? d : w;
                    const baseD = isRotated ? w : d;

                    colliders.push({
                        xMin: worldX - baseW / 2 - 0.2,
                        xMax: worldX + baseW / 2 + 0.2,
                        zMin: worldZ - baseD / 2 - 0.2,
                        zMax: worldZ + baseD / 2 + 0.2,
                        yMin: anchorSlabTopY,
                        yMax: anchorSlabTopY + railH + 0.5
                    });
                };

                const voidHalfW = anchorEscalatorVoidWidth / 2;
                const voidHalfL = anchorEscalatorVoidLength / 2;
                const slabZCenter = -10;

                // Laterales largos del hueco
                drawRail(railThickness, anchorEscalatorVoidLength, voidHalfW + railThickness / 2, slabZCenter);
                drawRail(railThickness, anchorEscalatorVoidLength, -(voidHalfW + railThickness / 2), slabZCenter);
                // Cabeceras cortas del hueco
                drawRail(anchorEscalatorVoidWidth, railThickness, 0, slabZCenter + voidHalfL + railThickness / 2);
                drawRail(anchorEscalatorVoidWidth, railThickness, 0, slabZCenter - (voidHalfL + railThickness / 2));
            };
            addAnchorVoidRailings();`;

if (content.includes(searchStr)) {
    const newContent = content.replace(searchStr, insertStr);
    fs.writeFileSync('index.html', newContent);
    console.log('Barandillas restauradas con éxito');
} else {
    console.log('No se encontró el punto de inserción para las barandillas.');
}
