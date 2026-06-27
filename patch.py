import os

fpath = r'c:\Users\javii\Downloads\Web Tienda Virtual\index.html'
with open(fpath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 1. grassMat & asphaltMat after darkMat
for i, l in enumerate(lines):
    if 'const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.5 });' in l:
        lines.insert(i+1, '        const grassMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 }); // Verde pasto\n')
        lines.insert(i+2, '        const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 }); // Gris asfalto\n')
        break

# 2. createSmallIDTexture
func_lines = [
    '        function createSmallIDTexture(text) {\n',
    "            const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;\n",
    "            const ctx = canvas.getContext('2d');\n",
    "            ctx.fillStyle = '#c9a66b'; ctx.fillRect(0, 0, 512, 128); // Fondo Oro\n",
    "            ctx.strokeStyle = '#222222'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, 502, 118);\n",
    "            ctx.fillStyle = '#000000'; ctx.font = 'bold 80px \"Inter\"';\n",
    "            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';\n",
    "            ctx.fillText(text, 256, 64);\n",
    "            return new THREE.CanvasTexture(canvas);\n",
    '        }\n\n'
]
for i, l in enumerate(lines):
    if '        function createSignTexture(text, isID = false) {' in l:
        for fl in reversed(func_lines):
            lines.insert(i, fl)
        break

# 3. flatLen: 0 in addAnchorDiagonalEscalator
for i, l in enumerate(lines):
    if 'axis: worldAxis, pathLenZ: runLen, diagLenZ: runLen,' in l:
        lines[i] = l.replace('axis: worldAxis, pathLenZ: runLen, diagLenZ: runLen,', 'axis: worldAxis, flatLen: 0, pathLenZ: runLen, diagLenZ: runLen,')
        lines.insert(i, '                    xStart: worldStart.x, xEnd: worldEnd.x,\n                    zStart: worldStart.z, zEnd: worldEnd.z,\n')
        break

# 4. Console log ESCALATORS
for i, l in enumerate(lines):
    if '// [Las coordenadas ya están sincronizadas en la lista interna]' in l:
        lines.insert(i+1, '        console.log(`[ESCALATORS] Total: ${escalatorList.length} | Up: ${escalatorList.filter(e => e.up).length} | Down: ${escalatorList.filter(e => !e.up).length}`);\n')
        break

# 5. NaN Guard
for i, l in enumerate(lines):
    if 'const inAtrium = Math.abs(npc.mesh.position.x) < 11 && Math.abs(npc.mesh.position.z) < 11;' in l:
        lines.insert(i, '                    // Guardia anti-NaN: si la Y se corrompe, resetear al suelo\n                    if (isNaN(npc.mesh.position.y)) {\n                        npc.mesh.position.y = getAvatarGroundY(0);\n                    }\n')
        break

with open(r'c:\Users\javii\Downloads\Web Tienda Virtual\index.html', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Patch applied successfully')
