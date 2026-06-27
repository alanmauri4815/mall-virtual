
        // --- MOTOR DE COLISIONES PRO (CON ALTURA) ---
        const colliders = [];
        function registerCollider(x, z, w, d, minY = -5, maxY = 50) {
            colliders.push({
                minX: x - w / 2, maxX: x + w / 2,
                minZ: z - d / 2, maxZ: z + d / 2,
                minY, maxY
            });
        }
        function checkCollision(nx, ny, nz) {
            for (let c of colliders) {
                if (nx > c.minX && nx < c.maxX && nz > c.minZ && nz < c.maxZ && ny > c.minY && ny < c.maxY) return true;
            }
            return false;
        }

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xaabbcc);
        scene.fog = new THREE.Fog(0xaabbcc, 40, 600);

        const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1500);
        camera.position.set(45, 45, 45);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.toneMapping = THREE.ReinhardToneMapping;
        renderer.setPixelRatio(window.devicePixelRatio);
        document.getElementById('canvas-container').appendChild(renderer.domElement);

        let isWalking = false;
        window.toggleWalkMode = function () {
            isWalking = !isWalking;
            const btn = document.getElementById('walk-btn-ctrl');
            if (isWalking) {
                btn.innerText = "Modo AÃ©reo";
                camera.position.set(0, 1.7, -82); // Entrada Sur (Frente al TÃ³tem)
                controls.target.set(0, 1.80, -78); // Mirando al TÃ³tem (Un pelito arriba)
                controls.enablePan = false;
                controls.minPolarAngle = Math.PI / 2 - 0.7;
                controls.maxPolarAngle = Math.PI / 2 + 0.5;
                controls.minDistance = 0.01; controls.maxDistance = 0.05;

                if (window.innerWidth <= 768) {
                    document.getElementById('mobile-controls-container').style.display = 'flex';
                }
            } else {
                btn.innerText = "Modo Paseo";
                camera.position.set(45, 45, 45);
                controls.target.set(0, 0, 0);
                controls.enablePan = true;
                controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI;
                controls.minDistance = 1; controls.maxDistance = 500;
                document.getElementById('mobile-controls-container').style.display = 'none';
            }
        };

        console.log("ðŸŽ® Controles de Ã³rbita...");
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        scene.add(new THREE.AmbientLight(0xffffff, 2.0));
        scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.5));
        const sun = new THREE.DirectionalLight(0xffffff, 3.0); sun.position.set(150, 200, 150); scene.add(sun);

        const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.3, transparent: true, opacity: 0.7, metalness: 0.2, roughness: 0.05 });
        const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xc9a66b, metalness: 0.9, roughness: 0.1 });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.5 });
        var storeGroups = {}; // Registro global de tiendas para mobiliario 3D


        function createSignTexture(text, isID = false) {
            const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
            const ctx = canvas.getContext('2d');
            if (isID) {
                ctx.fillStyle = '#000000'; ctx.font = 'bold 200px "Inter"';
            } else {
                ctx.fillStyle = '#c9a66b'; ctx.font = 'bold 120px "Cormorant Garamond"';
            }
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(text, canvas.width / 2, canvas.height / 2);
            return new THREE.CanvasTexture(canvas);
        }

        // --- CENTRAL STRUCTURE PARAMETERS ---
        const VAULT_RADIUS = 17;
        const VAULT_LENGTH = 78;
        const VAULT_CENTER_OFFSET = 56.5;
        const DOME_CENTER_Y = 25.5; // Elevado para mayor lujo y espacio
        const CENTRAL_DOME_RADIUS = 28.0;
        const LONGITUDINAL_BEAM_LEVELS = [-16, -13, -10, -7, -4, 0, 4, 7, 10, 13, 16]; // AÃ±adido el 0 para el cenit
        const RING_FAMILY_LEVELS = [0, 4, 7, 10, 13, 16];

        function getVaultAngleForLevel(level) {
            return (level / VAULT_RADIUS) * (Math.PI / 2);
        }

        function getVaultHeightForLevel(level) {
            return DOME_CENTER_Y + Math.cos(getVaultAngleForLevel(level)) * VAULT_RADIUS;
        }

        function getDomeRingRadiusForHeight(height) {
            const verticalDelta = height - DOME_CENTER_Y;
            return Math.sqrt(Math.max((CENTRAL_DOME_RADIUS ** 2) - (verticalDelta ** 2), 0));
        }

        const DOME_RING_TARGETS = RING_FAMILY_LEVELS.map((level) => ({
            level,
            height: getVaultHeightForLevel(level),
            radius: getDomeRingRadiusForHeight(getVaultHeightForLevel(level))
        }));

        function addArchitecturalShell(group, r, l, wingLabel) {
            const innerSign = (wingLabel === 'N' || wingLabel === 'E') ? -1 : 1;
            const outerZ = -innerSign * (l / 2);

            const segments = 16;
            const geometry = new THREE.BufferGeometry();
            const vertices = [];
            const indices = [];

            // Generar vÃ©rtices para el arco exterior (Z = outerZ, radio = 17) y el arco interior (conexiÃ³n con domo)
            for (let i = 0; i <= segments; i++) {
                const anglePos = -16 + (32 * i / segments); // De -16 a 16 (niveles de fierros)
                const angle = (anglePos / r) * (Math.PI / 2);

                // Punto Exterior
                const xOut = Math.sin(angle) * r;
                const yOut = Math.cos(angle) * r;
                vertices.push(xOut, yOut, outerZ);

                // Punto Interior (Cierre con anillos del domo)
                const familyLevel = Math.abs(anglePos);
                const ringTarget = DOME_RING_TARGETS.find(t => t.level === Math.round(familyLevel)) || DOME_RING_TARGETS[0];
                const innerY = ringTarget.height - DOME_CENTER_Y;
                const innerAxisAbs = Math.sqrt(Math.max((CENTRAL_DOME_RADIUS ** 2) - (xOut ** 2) - (innerY ** 2), 0));
                const innerZ = innerSign * (VAULT_CENTER_OFFSET - innerAxisAbs);
                vertices.push(xOut, innerY, innerZ);
            }

            // Crear caras (Quads as Triangles)
            for (let i = 0; i < segments; i++) {
                const v0 = i * 2;
                const v1 = i * 2 + 1;
                const v2 = (i + 1) * 2;
                const v3 = (i + 1) * 2 + 1;
                indices.push(v0, v2, v1);
                indices.push(v1, v2, v3);
            }
            geometry.setIndex(indices);
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.computeVertexNormals();

            const mesh = new THREE.Mesh(geometry, glassMat);
            mesh.side = THREE.DoubleSide;
            group.add(mesh);
        }

        function addVaultShell(group, r, l) {
            const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 32, 1, true, 0, Math.PI), glassMat);
            m.rotation.x = Math.PI / 2; m.rotation.z = -Math.PI / 2; group.add(m);
        }
        function addTransverseRibs(group, r, l, wingLabel) {
            const pillarH = DOME_CENTER_Y - 11.5;
            for (let i = -l / 2; i <= l / 2; i += 4) {
                const rib = new THREE.Mesh(new THREE.TorusGeometry(r, 0.10, 16, 64, Math.PI), darkMat);
                let zPos = i;
                if (wingLabel === 'N' || wingLabel === 'E') zPos = i + 2;
                rib.position.z = zPos; group.add(rib);
                [r, -r].forEach(xSide => {
                    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, pillarH), darkMat);
                    p.position.set(xSide, -pillarH / 2, zPos);
                    group.add(p);
                });
            }
        }
        function addLongitudinalGirders(group, r, l, wingLabel) {
            const innerSign = (wingLabel === 'N' || wingLabel === 'E') ? -1 : 1;
            const outerLocalZ = -innerSign * (l / 2);
            LONGITUDINAL_BEAM_LEVELS.forEach((anglePos, index) => {
                const familyLevel = Math.abs(anglePos);
                const ringTarget = DOME_RING_TARGETS.find((target) => target.level === familyLevel);
                const actualRingHeight = ringTarget.height;
                const innerY = actualRingHeight - DOME_CENTER_Y;
                const angle = (anglePos / r) * (Math.PI / 2);
                const xLocal = Math.sin(angle) * r;
                const outerY = Math.cos(angle) * r;
                const innerAxisAbs = Math.sqrt(Math.max((CENTRAL_DOME_RADIUS ** 2) - (xLocal ** 2) - (innerY ** 2), 0));
                const innerLocalZ = innerSign * (VAULT_CENTER_OFFSET - innerAxisAbs);
                const start = new THREE.Vector3(xLocal, outerY, outerLocalZ);
                const end = new THREE.Vector3(xLocal, innerY, innerLocalZ);
                const direction = new THREE.Vector3().subVectors(end, start);
                const beamLen = direction.length();
                const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
                const beam = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, beamLen), darkMat);
                beam.position.copy(midPoint);
                beam.lookAt(end);
                group.add(beam);
            });
        }
        function addEndCap(group, r, l, p, rx, ry, rz, wingLabel) {
            const capG = new THREE.Group();
            const innerSign = (wingLabel === 'N' || wingLabel === 'E') ? -1 : 1;
            const zStart = -innerSign * (l / 2);
            capG.position.set(0, 0, zStart);
            const convergeZ = -innerSign * 4.5;
            const convergeY = 16.5 - DOME_CENTER_Y; // Elevado para que quede sobre el techo de las tiendas (15m)
            const targetPoint = new THREE.Vector3(0, convergeY, convergeZ);
            const beamLevels = [-16, -13, -10, -7, -4, 0, 4, 7, 10, 13, 16];
            beamLevels.forEach(anglePos => {
                const angle = (anglePos / r) * (Math.PI / 2);
                const xLocal = Math.sin(angle) * r;
                const yLocal = Math.cos(angle) * r;
                const startPoint = new THREE.Vector3(xLocal, yLocal, 0);
                const controlPoint = new THREE.Vector3(xLocal, yLocal, convergeZ);
                const curve = new THREE.QuadraticBezierCurve3(startPoint, controlPoint, targetPoint);
                const points = curve.getPoints(20);
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const meridian = new THREE.Line(geometry, darkMat);
                capG.add(meridian);
                for (let j = 0; j < points.length - 1; j++) {
                    const segStart = points[j]; const segEnd = points[j + 1];
                    const dist = segStart.distanceTo(segEnd);
                    const beamSeg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, dist), darkMat);
                    beamSeg.position.copy(segStart).add(segEnd).multiplyScalar(0.5);
                    beamSeg.lookAt(segEnd);
                    capG.add(beamSeg);
                }
            });
            group.add(capG);
        }

        function createVaultedRoof(x, z, length, wingLabel, rot = false, capPos = 1, capX = 0, capY = 0, capZ = 0, showCap = true) {
            const vaultG = new THREE.Group(); vaultG.position.set(x, DOME_CENTER_Y, z);
            if (rot) vaultG.rotation.y = Math.PI / 2;
            addArchitecturalShell(vaultG, VAULT_RADIUS, length, wingLabel);
            addTransverseRibs(vaultG, VAULT_RADIUS, length, wingLabel);
            addLongitudinalGirders(vaultG, VAULT_RADIUS, length, wingLabel);
            if (showCap) addEndCap(vaultG, 17, length, capPos, capX, capY, capZ, wingLabel);
            scene.add(vaultG);
        }

        // TIENDAS ANCLA E IDENTIFICADORES Giant N,S,E,O
        function createAnchorStore(posX, posZ, width, height, name = "ANCLA", idLetter = "") {
            const g = new THREE.Group(); g.position.set(posX, 0, posZ);
            g.userData = { isAnchor: true, shopCode: idLetter, name: name };
            if (idLetter !== "") {
                const idTex = createSignTexture(idLetter, true);
                const idM = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), new THREE.MeshBasicMaterial({ map: idTex, transparent: true }));
                idM.userData.isSign = true; // Solo el letrero abre el catÃ¡logo
                idM.position.set(0, height + 0.1, -14); idM.rotation.x = -Math.PI / 2; g.add(idM);
            }
            if(idLetter) storeGroups[idLetter] = g;

            const m = (w, h, d, x, y, z, mat) => { const mw = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); mw.position.set(x, y, z); g.add(mw); };
            m(width, 0.2, 30, 0, 0.15, -10, whiteMat); // Suelo elevado (0.15) y blanco puro por peticiÃ³n del usuario
            m(width + 2, 0.2, 30, 0, height, -10, whiteMat); // Techo sÃ³lido

            // Paredes laterales
            m(0.2, height, 30, -width / 2, height / 2, -10, whiteMat);
            m(0.2, height, 30, width / 2, height / 2, -10, whiteMat);

            // Muro trasero SEPARADO: Planta Baja (con hueco) y Planta Alta (CERRADO)
            // 1. Planta Baja (Puerta de 12m de ancho y 5.4m de alto)
            m(width / 2 - 6, 5.4, 0.2, -(width / 4 + 3), 5.4 / 2, -25, whiteMat);
            m(width / 2 - 6, 5.4, 0.2, (width / 4 + 3), 5.4 / 2, -25, whiteMat);
            m(12, 1.4, 0.2, 0, 5.4 - 0.7, -25, whiteMat); // Dintel de la puerta

            // 2. Planta Alta (MURO TOTALMENTE CERRADO para seguridad)
            m(width, height - 5.4, 0.2, 0, 5.4 + (height - 5.4) / 2, -25, whiteMat);

            m(width + 2, 2.5, 0.8, 0, height + 1.25, 5, goldMat);
            const sM = new THREE.Mesh(new THREE.PlaneGeometry(width, 2), new THREE.MeshBasicMaterial({ map: createSignTexture(name), transparent: true }));
            sM.position.set(0, height + 1.25, 5.45); g.add(sM);
            return g;
        }
        // --- TIENDAS ANCLA (RESTAURACIÃ“N ESTRUCTURAL CON SALIDAS) ---
        const sAnchor = createAnchorStore(0, -100, 70, 15, "MALL SUR", "S");
        scene.add(sAnchor);
        registerCollider(-20.5, -125, 29, 1, 0, 15); // Muro Frontal Izq (Sur)
        registerCollider(20.5, -125, 29, 1, 0, 15);  // Muro Frontal Der (Sur)

        const nAnchor = createAnchorStore(0, 100, 70, 15, "MALL NORTE", "N");
        nAnchor.rotateY(Math.PI); scene.add(nAnchor);
        registerCollider(-20.5, 125, 29, 1, 0, 15); // Muro Frontal Izq (Norte - Puerta Boulevard)
        registerCollider(20.5, 125, 29, 1, 0, 15);  // Muro Frontal Der (Norte - Puerta Boulevard)

        const eAnchor = createAnchorStore(100, 0, 70, 15, "MALL ESTE", "E");
        eAnchor.rotateY(-Math.PI / 2); scene.add(eAnchor);
        registerCollider(125, -20.5, 1, 29, 0, 15); // Muro Frontal (Este)
        registerCollider(125, 20.5, 1, 29, 0, 15);

        const wAnchor = createAnchorStore(-100, 0, 70, 15, "MALL OESTE", "O");
        wAnchor.rotateY(Math.PI / 2); scene.add(wAnchor);
        registerCollider(-125, -20.5, 1, 29, 0, 15); // Muro Frontal (Oeste)
        registerCollider(-125, 20.5, 1, 29, 0, 15);

        // --- ANEXO: BOULEVARD & FOOD COURT (ALA NORTE RE-VINCULADA) ---
        function createBoulevardArea() {
            const bX = 0, bZ = 170;
            // 1. Suelo del Boulevard (Terracota)
            const floorGeo = new THREE.PlaneGeometry(120, 90);
            const floorMat = new THREE.MeshStandardMaterial({ color: 0xd2691e, roughness: 0.8 });
            const floor = new THREE.Mesh(floorGeo, floorMat);
            floor.rotation.x = -Math.PI / 2; floor.position.set(bX, 0.1, bZ); scene.add(floor);

            // Conector con el Mall (Ajustado para atravesar la tienda norte)
            const conn = new THREE.Mesh(new THREE.PlaneGeometry(20, 30), floorMat);
            conn.rotation.x = -Math.PI / 2; conn.position.set(0, 0.1, 110); scene.add(conn);

            // 2. Torre de Publicidad Central PRO
            const towerG = new THREE.Group(); towerG.position.set(bX, 0, bZ);
            const adLogos = ["BINANCE", "HONEYGAIN", "QUANTUM", "TRADING"];
            const adColors = [0xf3ba2f, 0xffa500, 0x00ffff, 0xff00ff];
            for (let i = 0; i < 4; i++) {
                const screen = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 7), new THREE.MeshStandardMaterial({ color: adColors[i], metalness: 0.5, roughness: 0.2 }));
                screen.position.y = 2.5 + (i * 6); towerG.add(screen);

                // Pantallas en las 4 caras
                for (let j = 0; j < 4; j++) {
                    const idTex = createSignTexture(adLogos[i], true);
                    const p = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ map: idTex, transparent: true }));
                    p.rotation.y = (Math.PI / 2) * j;
                    p.position.set(
                        Math.sin((Math.PI / 2) * j) * 3.51,
                        2.5 + (i * 6),
                        Math.cos((Math.PI / 2) * j) * 3.51
                    );
                    towerG.add(p);
                }
            }
            scene.add(towerG);
            registerCollider(bX, bZ, 8, 8, 0, 30);

            // 3. Mesas con Parasoles Azules (Food Court)
            function createParasolSet(px, pz) {
                const gr = new THREE.Group(); gr.position.set(px, 0.1, pz);
                const table = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.1), whiteMat); table.position.y = 0.9; gr.add(table);
                const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.5), darkMat); pole.position.y = 1.75; gr.add(pole);
                const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0, 3, 1, 16), new THREE.MeshStandardMaterial({ color: 0x0000ff }));
                canopy.position.y = 3.5; gr.add(canopy);
                scene.add(gr);
                registerCollider(px, pz, 2.5, 2.5, 0, 5);
            }
            [[25, 140], [-25, 140], [25, 180], [-25, 180], [40, 160], [-40, 160]].forEach(p => createParasolSet(p[0], p[1]));

            // 4. Tiendas del Boulevard (Colores Planos y Vivos como pidiÃ³ el usuario)
            const bLabels = ["BURGER", "TACO", "PIZZA", "SUSHI", "CAFE"];
            const bCols = [0xff0055, 0x00ff77, 0x0088ff, 0xffaa00, 0x9955ff];
            for (let i = -2; i <= 2; i++) {
                const sX = i * 25; const sZ = 205;
                const shop = new THREE.Group(); shop.position.set(sX, 0, sZ);
                const box = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 12), new THREE.MeshStandardMaterial({ color: bCols[i + 2] }));
                box.position.y = 5; shop.add(box);

                const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshBasicMaterial({ map: createSignTexture(bLabels[i + 2]) }));
                sign.position.set(0, 8, 6.01); shop.add(sign);

                scene.add(shop);
                registerCollider(sX, sZ, 20, 12, 0, 10);
            }
        }
        createBoulevardArea();

        // --- COLISIÃ“N TORRE CENTRAL Y FUENTE ---
        registerCollider(0, 0, 8, 8, 0, 30); // El nÃºcleo central es sÃ³lido

        // --- MUEBLES PLAZA CENTRAL (SÃ³lidos) ---
        function createTableSet(x, z) {
            const gr = new THREE.Group(); gr.position.set(x, 0.1, z);
            const table = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.1), whiteMat); table.position.y = 1.0; gr.add(table);
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1), darkMat); pole.position.y = 0.5; gr.add(pole);
            scene.add(gr);
            registerCollider(x, z, 2.2, 2.2, 0, 3);
        }
        createTableSet(10, 10); createTableSet(-10, 10); createTableSet(10, -10); createTableSet(-10, -10);

        // --- URBANISMO Y PAISAJISMO EXTERIOR ---
        const grassMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 }); // Verde pasto
        const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 }); // Gris asfalto
        const roadLineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const marbleMat = new THREE.MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.1, metalness: 0.1 }); // MÃ¡rmol Mall

        function createExterior() {
            // Plano de Pasto General
            const grass = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), grassMat);
            grass.rotation.x = -Math.PI / 2;
            grass.position.y = -0.05; // Ligeramente bajo el suelo del mall
            scene.add(grass);

            // Veredas Perimetrales (Anillo de Asfalto Unificado)
            const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), asphaltMat);
            sidewalk.rotation.x = -Math.PI / 2;
            sidewalk.position.y = -0.02;
            scene.add(sidewalk);


            // Estacionamientos (4 Esquinas)
            const pkgPos = [[70, 70], [-70, 70], [70, -70], [-70, -70]];
            pkgPos.forEach(p => {
                const pkg = new THREE.Mesh(new THREE.BoxGeometry(60, 0.2, 60), asphaltMat);
                pkg.position.set(p[0] * 1.8, 0, p[1] * 1.8);
                scene.add(pkg);
                // LÃ­neas de parqueo bÃ¡sicas
                for (let i = -25; i <= 25; i += 5) {
                    const line = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 10), roadLineMat);
                    line.position.set(pkg.position.x + i, 0.15, pkg.position.z); scene.add(line);
                }
            });

            // Palmas Tropicales
            const createPalm = (x, z) => {
                const p = new THREE.Group(); p.position.set(x, 0, z);
                
                // Tronco de Palma (Segmentado para realismo)
                const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 1.0 });
                for(let i=0; i<10; i++) {
                    const radius = 0.35 - (i * 0.015);
                    const segment = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius+0.05, 1.0, 8), trunkMat);
                    segment.position.y = 0.5 + i * 0.9;
                    segment.rotation.y = i * 0.8; 
                    p.add(segment);
                }

                // Hojas de Palma (Frondas arqueadas)
                const palmLeafMat = new THREE.MeshStandardMaterial({ color: 0x2e5a1c, roughness: 0.7 });
                for (let i = 0; i < 14; i++) {
                    const leafGroup = new THREE.Group();
                    leafGroup.position.y = 9.2;
                    leafGroup.rotation.y = (i * Math.PI * 2) / 14;
                    
                    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 5.5), palmLeafMat);
                    leaf.position.z = 2.5;
                    leaf.rotation.x = -0.4 - (Math.random() * 0.2); 
                    leafGroup.add(leaf);
                    p.add(leafGroup);
                }
                scene.add(p);
            };

            // PlantaciÃ³n simÃ©trica de Palmas
            for (let i = -120; i <= 120; i += 40) {
                if (Math.abs(i) < 20) continue;
                createPalm(i, 130); createPalm(i, -130);
                createPalm(130, i); createPalm(-130, i);
            }
        }
        createExterior();
        createBoulevardArea();

        function createSmallIDTexture(text) {
            const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#c9a66b'; ctx.fillRect(0, 0, 512, 128); // Fondo Oro
            ctx.strokeStyle = '#222222'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, 502, 118);
            ctx.fillStyle = '#000000'; ctx.font = 'bold 80px "Inter"';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(text, 256, 64);
            return new THREE.CanvasTexture(canvas);
        }

        // ðŸº URBANISMO INTERIOR: Maceteros con Ãrboles Estilizados
        function createPlanter(x, z) {
            const gr = new THREE.Group(); gr.position.set(x, 0.1, z);
            
            // Macetero de Lujo
            const box = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.8, 2.5), goldMat); 
            box.position.y = 0.4; gr.add(box);
            
            // Tierra / Sustrato
            const dirt = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 2.3), new THREE.MeshStandardMaterial({ color: 0x3d2b1f }));
            dirt.position.y = 0.8; gr.add(dirt);

            // Tronco Tapered
            const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4d3319, roughness: 0.9 });
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.15, 3, 8), trunkMat); 
            trunk.position.y = 2.2; gr.add(trunk);

            // Follaje OrgÃ¡nico (AgrupaciÃ³n de esferas)
            const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.8 });
            const leafMatDark = new THREE.MeshStandardMaterial({ color: 0x1a3a16, roughness: 0.8 });
            
            const foliageConfig = [
                { p: [0, 3.8, 0], s: 0.9 },
                { p: [0.5, 3.5, 0.5], s: 0.65 },
                { p: [-0.5, 3.4, -0.4], s: 0.6 },
                { p: [0.4, 3.3, -0.5], s: 0.7 },
                { p: [-0.4, 3.6, 0.4], s: 0.55 }
            ];
            
            foliageConfig.forEach((f, idx) => {
                const blob = new THREE.Mesh(new THREE.SphereGeometry(f.s, 12, 12), idx % 2 === 0 ? leafMat : leafMatDark);
                blob.position.set(f.p[0], f.p[1], f.p[2]);
                blob.scale.set(1, 0.8, 1); // Ligeramente achatadas para look mÃ¡s arbÃ³reo
                gr.add(blob);
            });

            scene.add(gr);
            registerCollider(x, z, 2.5, 2.5, 0, 4);
        }
        function createBench(x, z, rot) {
            const gr = new THREE.Group(); gr.position.set(x, 0.1, z); gr.rotation.y = rot;
            const base = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 1.5), darkMat); base.position.y = 0.1; gr.add(base);
            const seat = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.4, 1.7), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.1 })); seat.position.y = 0.4; gr.add(seat);
            scene.add(gr);
        }

        // â›² FUENTE CENTRAL
        function createCentralFountain() {
            const gr = new THREE.Group(); gr.position.set(0, 0.1, 0);
            const basin = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.5, 0.8, 32), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.5 })); gr.add(basin);
            const water = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, 0.1, 32), new THREE.MeshPhysicalMaterial({ color: 0x88ccff, transmission: 0.5, transparent: true, opacity: 0.6, roughness: 0 }));
            water.position.y = 0.4; gr.add(water);
            const monolith = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 2), goldMat); monolith.position.y = 3; gr.add(monolith);
            scene.add(gr);
        }

        // ðŸ“º PANTALLAS DIGITALES LED CON ROTACIÃ“N
        const adTexts = [
            { t: "ROLEX: EXCELLENCE", c: "#000000", tc: "#c9a66b" },
            { t: "GUCCI: SPRING 2026", c: "#4a148c", tc: "#ffffff" },
            { t: "TESLA: NEW GEN", c: "#1a237e", tc: "#ffffff" },
            { t: "SAMSUNG: QUANTUM", c: "#004d40", tc: "#00ffcc" },
            { t: "NESPRESSO: COFFEE", c: "#3e2723", tc: "#ecd0a4" }
        ];
        const adTextures = adTexts.map(ad => {
            const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = ad.c; ctx.fillRect(0, 0, 1024, 512); // Fondo Marca
            ctx.strokeStyle = ad.tc; ctx.lineWidth = 30; ctx.strokeRect(20, 20, 984, 472);
            ctx.fillStyle = ad.tc; ctx.font = 'bold 85px "Inter"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(ad.t, 512, 256);
            return new THREE.CanvasTexture(canvas);
        });

        const screenMeshes = [];
        function createDigitalScreen(x, y, z, rot) {
            const gr = new THREE.Group(); gr.position.set(x, y, z); gr.rotation.y = rot;
            const frame = new THREE.Mesh(new THREE.BoxGeometry(10.2, 5.2, 0.4), darkMat); gr.add(frame);
            const screen = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshBasicMaterial({ map: adTextures[0] }));
            screen.position.z = 0.21; gr.add(screen);
            screenMeshes.push(screen);
            scene.add(gr);
        }

        function createEscalatorTexture() {
            const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#888888'; ctx.fillRect(0, 0, 128, 128); // Base metÃ¡lica
            ctx.fillStyle = '#111111';
            // Franjas longitudinales (ranuras dentadas)
            for (let i = 0; i < 128; i += 6) {
                ctx.fillRect(i, 0, 2, 128);
            }
            // Bordes amarillos de seguridad (tÃ­picos)
            ctx.fillStyle = '#ffcc00'; ctx.fillRect(0, 0, 5, 128); ctx.fillRect(123, 0, 5, 128);
            const tex = new THREE.CanvasTexture(canvas);
            tex.wrapT = tex.wrapS = THREE.RepeatWrapping;
            tex.repeat.set(1, 15); // RepeticiÃ³n a lo largo de la rampa
            return tex;
        }

        function createEscalatorSign(text, color) {
            const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 128, 128);
            ctx.fillStyle = color; ctx.font = 'bold 80px "Inter"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(text, 64, 64);
            ctx.strokeStyle = color; ctx.lineWidth = 10; ctx.strokeRect(5, 5, 118, 118);
            return new THREE.CanvasTexture(canvas);
        }

        const escalatorList = [];
        function createEscalator(x, zStart, zEnd, up = true) {
            const h = 5.4;
            let dist = zEnd - zStart;
            const flatLen = 4;
            const gr = new THREE.Group(); gr.position.set(x, -0.53, zStart);
            const dir = Math.sign(dist);

            // Guardar para colisiones (enrasado al suelo -0.53)
            escalatorList.push({ x, zMin: Math.min(zStart, zEnd), zMax: Math.max(zStart, zEnd), up, yStart: -0.53, yEnd: h - 0.53, zStart, zEnd });

            const matGrey = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5 });
            const escText = createEscalatorTexture();
            const matStep = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, map: escText, metalness: 0.8, roughness: 0.2 });

            const diagLenZ = Math.abs(dist) - (flatLen * 2);
            const ang = Math.atan2(h, diagLenZ);
            const diagLenH = Math.sqrt(h * h + diagLenZ * diagLenZ);

            const cw = (w, h_box, d, px, py, pz, mat, rx = 0) => {
                const b = new THREE.Mesh(new THREE.BoxGeometry(w, h_box, d), mat);
                b.position.set(px, py, pz); b.rotation.x = rx; gr.add(b);
            };

            cw(3.5, 1.2, flatLen, 0, 0, flatLen / 2 * dir, matGrey);
            cw(3.5, 1.2, diagLenH, 0, h / 2, (flatLen + diagLenZ / 2) * dir, matGrey, -ang * dir);
            cw(3.5, 1.2, flatLen, 0, h, (flatLen + diagLenZ + flatLen / 2) * dir, matGrey);

            cw(2.5, 0.1, flatLen, 0, 0.65, flatLen / 2 * dir, matStep);
            cw(2.5, 0.1, diagLenH, 0, h / 2 + 0.65, (flatLen + diagLenZ / 2) * dir, matStep, -ang * dir);
            cw(2.5, 0.1, flatLen, 0, h + 0.65, (flatLen + diagLenZ + flatLen / 2) * dir, matStep);

            // Indicador de direcciÃ³n
            const signTex = createEscalatorSign(up ? 'â†‘' : 'â†“', up ? '#00ff44' : '#ff4400');
            const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: signTex }));
            sign.position.set(0, 1.5, (dir > 0 ? 0 : -0.2)); gr.add(sign);

            [1.4, -1.4].forEach(side => {
                cw(0.05, 1.2, flatLen, side, 1.2, flatLen / 2 * dir, glassMat);
                cw(0.05, 1.2, diagLenH, side, h / 2 + 1.2, (flatLen + diagLenZ / 2) * dir, glassMat, -ang * dir);
                cw(0.05, 1.2, flatLen, side, h + 1.2, (flatLen + diagLenZ + flatLen / 2) * dir, glassMat);
                cw(0.15, 0.15, flatLen + 1, side, 1.8, (flatLen / 2 - 0.5) * dir, darkMat);
                cw(0.15, 0.15, diagLenH, side, h / 2 + 1.8, (flatLen + diagLenZ / 2) * dir, darkMat, -ang * dir);
                cw(0.15, 0.15, flatLen + 1, side, h + 1.8, (flatLen + diagLenZ + flatLen / 2 + 0.5) * dir, darkMat);
            });
            scene.add(gr);
        }

        function createGlassElevator(x, z) {
            const gr = new THREE.Group(); gr.position.set(x, 0.1, z);
            // Columnas GuÃ­a (Oro)
            [2.5, -2.5].forEach(px => [2.5, -2.5].forEach(pz => {
                const col = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 22.0), goldMat);
                col.position.set(px, 11.0, pz); gr.add(col);
            }));
            // CÃ¡psula de Cristal
            const cab = new THREE.Group(); cab.position.y = 2.7; // PosiciÃ³n estÃ¡tica elegante
            const body = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 4.5, 16, 1, true), glassMat); cab.add(body);
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.4), goldMat); cap.position.y = 2.25; cab.add(cap);
            const base = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.4), goldMat); base.position.y = -2.25; cab.add(base);
            gr.add(cab);
            scene.add(gr);
        }

        function createBoutique(posX, posZ, rotY, walls, posY = 0, shopCode = "") {
            const sh = new THREE.Group(); sh.position.set(posX, posY, posZ); sh.rotation.y = rotY;
            sh.userData = { isBoutique: true, shopCode: shopCode };
            const f = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 18), new THREE.MeshPhongMaterial({ color: 0x003366 })); f.position.y = 0.02; sh.add(f);
            const cw = (w, h, d, x, y, z, m) => { const mw = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mw.position.set(x, y, z); sh.add(mw); };

            // IluminaciÃ³n Techo (Interior)
            const lightStrip = new THREE.Mesh(new THREE.PlaneGeometry(10, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
            lightStrip.rotation.x = Math.PI / 2; lightStrip.position.y = 4.75; sh.add(lightStrip);

            if (walls.back) cw(12, 4.8, 0.1, 0, 2.4, -9, whiteMat);
            if (walls.left !== false) cw(0.1, 4.8, 18, -6, 2.4, 0, walls.left === 'glass' ? glassMat : whiteMat);
            if (walls.right !== false) cw(0.1, 4.8, 18, 6, 2.4, 0, walls.right === 'glass' ? glassMat : whiteMat);

            const doorH = 3.6; const shopH = 4.8; const frM = darkMat;
            cw(2.8, shopH, 0.05, -4.5, shopH / 2, 9, glassMat);
            cw(2.8, shopH, 0.05, 4.5, shopH / 2, 9, glassMat);
            cw(6, shopH - doorH, 0.05, 0, (shopH + doorH) / 2, 9, glassMat);
            cw(2.9, doorH, 0.05, -1.5, doorH / 2, 9.02, glassMat);
            cw(2.9, doorH, 0.05, 1.5, doorH / 2, 9.02, glassMat);
            cw(12.2, 0.2, 0.2, 0, 0.1, 9.05, frM);
            cw(12.2, 0.2, 0.2, 0, shopH, 9.05, frM);
            cw(0.2, shopH, 0.2, -6, shopH / 2, 9.05, frM);
            cw(0.2, shopH, 0.2, 6, shopH / 2, 9.05, frM);
            cw(0.2, shopH, 0.2, -3, shopH / 2, 9.05, frM);
            cw(0.2, shopH, 0.2, 3, shopH / 2, 9.05, frM);
            cw(6, 0.15, 0.2, 0, doorH, 9.05, frM);
            cw(0.1, 1.4, 0.1, -0.2, 1.8, 9.15, goldMat);
            cw(0.1, 1.4, 0.1, 0.2, 1.8, 9.15, goldMat);

            if (shopCode !== "") {
                const idTex = createSmallIDTexture(shopCode);
                const idPlaque = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: idTex, transparent: true }));
                idPlaque.userData.isSign = true; // Solo el letrero abre el catÃ¡logo
                idPlaque.position.set(-5.0, 4.4, 9.15); sh.add(idPlaque);
            }
            if(shopCode) storeGroups[shopCode] = sh;
            const r = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.3, 18.2), goldMat); r.position.y = 5.2; sh.add(r);

            // --- REGISTRO DE COLISIÃ“N (Paredes laterales, trasera y frontal con hueco de puerta) ---
            const cos = Math.cos(rotY); const sin = Math.sin(rotY);
            const yB = (posY > 5 ? 5.4 : 0);
            
            // 1. Pared Trasera (Fija en profundidad -8.75 para no sobresalir)
            if (walls.back) {
                const rx = posX + sin * (-8.75); const rz = posZ + cos * (-8.75);
                registerCollider(rx, rz, Math.abs(12 * cos) + Math.abs(0.5 * sin), Math.abs(12 * sin) + Math.abs(0.5 * cos), yB, yB + 6);
            }

            // 2. Paredes Laterales (+/- 5.75)
            if (walls.left !== false) {
                const lx = posX + cos * (-5.75); const lz = posZ + sin * (5.75);
                registerCollider(lx, lz, Math.abs(0.5 * cos) + Math.abs(18 * sin), Math.abs(0.5 * sin) + Math.abs(18 * cos), yB, yB + 6);
            }
            if (walls.right !== false) {
                const rx = posX + cos * (5.75); const rz = posZ + sin * (-5.75);
                registerCollider(rx, rz, Math.abs(0.5 * cos) + Math.abs(18 * sin), Math.abs(0.5 * sin) + Math.abs(18 * cos), yB, yB + 6);
            }

            // 3. Pared Frontal (Cristal con puerta de 6m, desplazada 0.25m hacia adentro: 8.75)
            [4.5, -4.5].forEach(offX => {
                const fx = posX + cos * offX + sin * 8.75;
                const fz = posZ + sin * (-offX) + cos * 8.75;
                registerCollider(fx, fz, Math.abs(3 * cos) + Math.abs(0.5 * sin), Math.abs(3 * sin) + Math.abs(0.5 * cos), yB, yB + 6);
            });

            return sh;
        }

        // ðŸ›ï¸ TÃ“TEMS DE INFORMACIÃ“N Y BÃšSQUEDA
        function createInfoTexture() {
            const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, 512, 512);
            ctx.fillStyle = '#c5a059'; ctx.font = 'bold 200px "Inter"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('i', 256, 256);
            ctx.strokeStyle = '#c5a059'; ctx.lineWidth = 20; ctx.strokeRect(10, 10, 492, 492);
            return new THREE.CanvasTexture(canvas);
        }
        const infoTex = createInfoTexture();
        function createInfoTotem(x, z) {
            const gr = new THREE.Group(); gr.position.set(x, 0, z);
            gr.userData = { isTotem: true };
            // Base Pedestal
            const base = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 2), darkMat); base.position.y = 0.2; gr.add(base);
            // Cuerpo Negro
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4.5, 0.4), darkMat); body.position.y = 2.25; gr.add(body);
            // Pantalla (Oro/Brillante)
            const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3), new THREE.MeshBasicMaterial({ map: infoTex }));
            screen.position.set(0, 2.5, 0.21); gr.add(screen);
            const backScreen = screen.clone(); backScreen.rotation.y = Math.PI; backScreen.position.z = -0.21; gr.add(backScreen);
            // Marco Oro
            const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.2, 0.5), goldMat); frame.position.y = 2.5; gr.add(frame);
            scene.add(gr);
            registerCollider(x, z, 2, 2, 0, 5);
        }

        // --- POBLAR TÃ“TEMS ---
        createInfoTotem(0, 10);   // Centro Atrio
        createInfoTotem(0, 80);   // Ala Norte
        createInfoTotem(0, -80);  // Ala Sur
        createInfoTotem(80, 0);   // Ala Este
        createInfoTotem(-80, 0);  // Ala Oeste


        const q = (sx, sz, y) => {
            const gr = new THREE.Group();
            const floorNum = (y === 0) ? 1 : 2;
            const wingH = (sz > 0) ? 'N' : 'S';
            const wingV = (sx > 0) ? 'E' : 'O';

            // CORRECCIÃ“N "MORDIDA DE RATÃ“N": Iniciamos en 23 para cerrar esquinas del atrio
            let oRows, sideRows;
            if (y === 0) {
                // Planta Baja: 5 tiendas, terminan en 83 (71+6 es 77... no, 71+6=77). 
                // Para GAP 12: Ãºltima debe ser 77.
                oRows = [23, 35, 47, 59, 77];
                sideRows = [23, 35, 47, 59, 77];
            } else {
                // Planta Alta: 7 tiendas para cerrar hasta la Gran Tienda (89+6=95)
                oRows = [23, 35, 47, 59, 71, 83, 89];
                sideRows = [23, 35, 47, 59, 71, 83, 89];
            }

            oRows.forEach((o, i) => {
                const code = `${wingH}${floorNum}${String(i + 1).padStart(2, '0')}`;
                gr.add(createBoutique(o * sx, 26 * sz, sz > 0 ? Math.PI : 0, { back: true, left: i === 0 ? 'glass' : true, right: i === 0 ? false : true }, y, code));
            });
            sideRows.forEach((o, i) => {
                const code = `${wingV}${floorNum}${String(i + 1).padStart(2, '0')}`;
                gr.add(createBoutique(26 * sx, o * sz, sx > 0 ? -Math.PI / 2 : Math.PI / 2, { back: true, left: i === 0 ? false : true, right: i === 0 ? 'glass' : true }, y, code));
            });

            // --- MURO PERIMETRAL EXTERIOR (CIERRA HUECOS CENTRALES, DEJA ENTRADAS LIBRES) ---
            const wallM = whiteMat;
            const h = 5.2; const thickness = 0.2;
            const corridorLen = 48; // Recortado para no sobresalir al pasillo central

            // Muro para oRows (atrÃ¡s de las tiendas en el eje horizontal)
            const w1 = new THREE.Mesh(new THREE.BoxGeometry(corridorLen, h, thickness), wallM);
            w1.position.set(59 * sx, y + h / 2, 35 * sz); gr.add(w1);

            // Muro para sideRows (atrÃ¡s de las tiendas en el eje vertical)
            const w2 = new THREE.Mesh(new THREE.BoxGeometry(thickness, h, corridorLen), wallM);
            w2.position.set(35 * sx, y + h / 2, 59 * sz); gr.add(w2);

            return gr;
        };

        // --- POBLAR TRANSPORTES (PARALELOS CON FLUJO INTERCALADO) ---
        // Ala SUR (Desde entrada Sur hacia el Centro)
        createEscalator(3, 30, 17, true);    // Derecha: SUBIDA (Viene del pasillo al atrio)
        createEscalator(-3, 30, 17, false);  // Izquierda: BAJADA (Viene del pasillo al atrio)

        // Ala NORTE (Desde entrada Norte hacia el Centro)
        createEscalator(-3, -30, -17, true); // Derecha: SUBIDA (Viene del pasillo al atrio)
        createEscalator(3, -30, -17, false); // Izquierda: BAJADA (Viene del pasillo al atrio)

        // Registro de escaleras (para depuraciÃ³n y lÃ³gica)
        // [Las coordenadas ya estÃ¡n sincronizadas en la lista interna]




        [0, 5.5].forEach(y => { [1, -1].forEach(sx => { [1, -1].forEach(sz => scene.add(q(sx, sz, y))); }); });

        // --- POBLAR URBANISMO ---
        for (let j = -70; j <= 70; j += 25) { if (Math.abs(j) < 15) continue; createPlanter(0, j); createBench(8, j, 0); createBench(-8, j, 0); }
        for (let k = -70; k <= 70; k += 25) { if (Math.abs(k) < 15) continue; createPlanter(k, 0); createBench(k, 8, Math.PI / 2); createBench(k, -8, Math.PI / 2); }
        createCentralFountain(); // La fuente crece visualmente por el espacio
        createDigitalScreen(0, 22.0, 17, 0);
        createDigitalScreen(0, 22.0, -17, Math.PI);
        createDigitalScreen(17, 22.0, 0, -Math.PI / 2);
        createDigitalScreen(-17, 22.0, 0, Math.PI / 2);

        function createInteriorFloors() {
            const bronzeMat = new THREE.MeshStandardMaterial({ color: 0x332211, roughness: 0.2 });

            const drawFloorWithGrid = (w, d, x, y, z) => {
                const thickness = 0.6; // Grosor estructural de "concreto"
                const f = new THREE.Mesh(new THREE.BoxGeometry(w, thickness, d), marbleMat);
                // Ajustamos para que la superficie superior estÃ© en 'y'
                f.position.set(x, y - thickness / 2, z); scene.add(f);

                // DISEÃ‘O DE LUJO: Doble lÃ­nea (Architectural Grid)
                const step = 8;
                const gap = 0.8;

                for (let i = -200 / 2; i <= 200 / 2; i += step) {
                    if (i >= x - w / 2 - 0.1 && i <= x + w / 2 + 0.1) {
                        [0, gap].forEach(off => {
                            const l = new THREE.Mesh(new THREE.PlaneGeometry(0.04, d), bronzeMat);
                            l.rotation.x = -Math.PI / 2; l.position.set(i + off, y + 0.01, z); scene.add(l);
                        });
                    }
                }
                for (let j = -200 / 2; j <= 200 / 2; j += step) {
                    if (j >= z - d / 2 - 0.1 && j <= z + d / 2 + 0.1) {
                        [0, gap].forEach(off => {
                            const l = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.04), bronzeMat);
                            l.rotation.x = -Math.PI / 2; l.position.set(x, y + 0.01, j + off); scene.add(l);
                        });
                    }
                }
            };

            // PASILLOS EXPANDIDOS (34 de ancho, 190 de largo para tocar Anclas en 95)
            drawFloorWithGrid(34, 190, 0, 0.1, 0);
            drawFloorWithGrid(190, 34, 0, 0.1, 0);

            // PASARELAS NORTE-SUR (Alineadas a fachadas, 6 de ancho, 190 de largo)
            drawFloorWithGrid(6, 190, 14, 5.4, 0);   // ESTE
            drawFloorWithGrid(6, 190, -14, 5.4, 0);  // OESTE

            // PASARELAS ESTE-OESTE (Mantener contacto, 190 de largo)
            drawFloorWithGrid(190, 6, 0, 5.4, 14);  // NORTE
            drawFloorWithGrid(190, 6, 0, 5.4, -14); // SUR

            // PLATAFORMAS DE ACCESO (VestÃ­bulos de 12 de ancho que unen las pasarelas en las entradas a Tiendas Ancla)
            drawFloorWithGrid(34, 12, 0, 5.4, 89);  // Acceso Norte
            drawFloorWithGrid(34, 12, 0, 5.4, -89); // Acceso Sur
            drawFloorWithGrid(12, 34, 89, 5.4, 0);  // Acceso Este
            drawFloorWithGrid(12, 34, -89, 5.4, 0); // Acceso Oeste
        }
        createInteriorFloors();





        function createPlainWalkway(w, d, x, z, rotated = false) {
            // Ya no es necesaria pues tenemos el suelo completo, pero la dejamos por compatibilidad si se llama
            const m = new THREE.Mesh(new THREE.BoxGeometry(rotated ? d : w, 0.2, rotated ? w : d), whiteMat);
            m.position.set(x, 5.41, z); scene.add(m);
        }


        function createRail(x, z, len, rot, hasSign = "") {
            const r = new THREE.Mesh(new THREE.BoxGeometry(rot ? 0.1 : len, 1.2, rot ? len : 0.1), new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3 })); r.position.set(x, 6.1, z); scene.add(r);
            const c = new THREE.Mesh(new THREE.BoxGeometry(rot ? 0.2 : len, 0.1, rot ? len : 0.2), goldMat); c.position.set(x, 6.7, z); scene.add(c);
            if (hasSign !== "") {
                const sM = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: createSignTexture(hasSign), transparent: true }));
                sM.position.set(x, 6.1, z + (rot ? 0 : 0.06)); if (rot) { sM.rotation.y = -Math.PI / 2; sM.position.x += (x > 0 ? 0.06 : -0.06); }
                scene.add(sM);
            }
            // Barandillas a altura 2.2m o 7.6m (evitar bloqueo primer piso)
            registerCollider(x, z, rot ? 0.2 : len, rot ? len : 0.2, 5.5, 8);
        }


        // --- SEGURIDAD Y LUJO: BARANDILLAS HUECO SUR (S) ---
        createRail(8, -17, 6, false); // Segmento derecho
        createRail(-8, -17, 6, false); // Segmento izquierdo
        createRail(0, -83, 22, false);
        createRail(11, -50, 66, true);
        createRail(-11, -50, 66, true);

        // --- SEGURIDAD Y LUJO: BARANDILLAS HUECO NORTE (N) ---
        createRail(8, 17, 6, false); // Segmento derecho
        createRail(-8, 17, 6, false); // Segmento izquierdo
        createRail(0, 83, 22, false);
        createRail(-11, 50, 66, true);
        createRail(11, 50, 66, true);

        // --- SEGURIDAD Y LUJO: BARANDILLAS HUECO OESTE (O) ---
        createRail(-17, 0, 22, true);
        createRail(-83, 0, 22, true);
        createRail(-50, 11, 66, false);
        createRail(-50, -11, 66, false);

        // --- SEGURIDAD Y LUJO: BARANDILLAS HUECO ESTE (E) ---
        createRail(17, 0, 22, true);
        createRail(83, 0, 22, true);
        createRail(50, 11, 66, false);
        createRail(50, -11, 66, false);

        // --- SEGURIDAD Y LUJO: ANILLO CENTRAL (ATRIO) ---
        createRail(0, 11, 22, false);
        createRail(0, -11, 22, false);
        createRail(11, 0, 22, true);
        createRail(-11, 0, 22, true);



















        createVaultedRoof(0, VAULT_CENTER_OFFSET, VAULT_LENGTH, 'N', false, 1, 0, Math.PI, Math.PI, true);
        createVaultedRoof(0, -VAULT_CENTER_OFFSET, VAULT_LENGTH, 'S', false, -1, 0, 0, Math.PI);
        createVaultedRoof(VAULT_CENTER_OFFSET, 0, VAULT_LENGTH, 'E', true, 1, 0, Math.PI, Math.PI);
        createVaultedRoof(-VAULT_CENTER_OFFSET, 0, VAULT_LENGTH, 'O', true, -1, 0, 0, Math.PI);

        const centralDome = new THREE.Mesh(new THREE.SphereGeometry(CENTRAL_DOME_RADIUS, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
        centralDome.position.set(0, DOME_CENTER_Y, 0); scene.add(centralDome);
        const lastRingTarget = DOME_RING_TARGETS[DOME_RING_TARGETS.length - 1];
        const domeRibArc = Math.acos((lastRingTarget.height - DOME_CENTER_Y) / CENTRAL_DOME_RADIUS); // Ãngulo para llegar al Ãºltimo anillo
        for (let i = 0; i < 8; i++) {
            const rib = new THREE.Mesh(new THREE.TorusGeometry(CENTRAL_DOME_RADIUS, 0.10, 16, 64, domeRibArc), darkMat);
            rib.position.set(0, DOME_CENTER_Y, 0);
            rib.rotation.z = Math.PI / 2; // Orientar verticalmente
            rib.rotation.y = (Math.PI / 4) * i; // Distribuir radialmente
            scene.add(rib);
        }
        // Rebuild de anillos desde cero (7 niveles):
        // 1) fierro mÃ¡s alto (0), 2..7) pares siguientes por altura (Â±4, Â±7, Â±10, Â±13, Â±16, Â±19).
        DOME_RING_TARGETS.forEach((target) => {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(target.radius, 0.10, 16, 128), darkMat);
            const ringHeight = target.height;
            ring.position.set(0, ringHeight, 0);
            ring.rotation.x = Math.PI / 2;
            ring.userData.familyLevel = target.level;
            scene.add(ring);
        });


        // --- SISTEMA DE NAVEGACIÃ“N REFORZADO (TECLADO + JOYSTICK) ---
        const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, KeyW: false, KeyS: false, KeyA: false, KeyD: false, ControlLeft: false, ControlRight: false };
        window.addEventListener('keydown', (e) => { if (keys.hasOwnProperty(e.code)) keys[e.code] = true; });
        window.addEventListener('keyup', (e) => { if (keys.hasOwnProperty(e.code)) keys[e.code] = false; });

        // --- LÃ“GICA DE JOYSTICK VIRTUAL ---
        let joystickActive = false;
        let joystickDir = { x: 0, y: 0 };
        const joyZone = document.getElementById('joystick-zone');
        const joyKnob = document.getElementById('joystick-knob');
        const joyRect = joyZone.getBoundingClientRect();
        const joyRadius = 60;

        function handleJoystick(e) {
            e.preventDefault();
            const rect = joyZone.getBoundingClientRect();
            const touch = e.touches ? e.touches[0] : e;
            const centerX = rect.left + joyRadius;
            const centerY = rect.top + joyRadius;
            let dx = touch.clientX - centerX;
            let dy = touch.clientY - centerY;
            const distance = Math.min(Math.sqrt(dx * dx + dy * dy), joyRadius);
            const angle = Math.atan2(dy, dx);

            const moveX = Math.cos(angle) * distance;
            const moveY = Math.sin(angle) * distance;

            joyKnob.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;

            joystickDir.x = moveX / joyRadius;
            joystickDir.y = moveY / joyRadius;
        }

        joyZone.addEventListener('touchstart', (e) => {
            joystickActive = true;
            handleJoystick(e);
        });
        joyZone.addEventListener('touchmove', handleJoystick);
        joyZone.addEventListener('touchend', () => {
            joystickActive = false;
            joystickDir = { x: 0, y: 0 };
            joyKnob.style.transform = `translate(-50%, -50%)`;
        });

        // Touch simulador de teclado para botones de rotaciÃ³n
        const bindKey = (id, key) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; el.classList.add('opacity-50'); });
            el.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; el.classList.remove('opacity-50'); });
            el.addEventListener('mousedown', (e) => { e.preventDefault(); keys[key] = true; });
            el.addEventListener('mouseup', (e) => { e.preventDefault(); keys[key] = false; });
        };
        bindKey('btn-rotate-left', 'ArrowLeft');
        bindKey('btn-rotate-right', 'ArrowRight');
        bindKey('btn-look-up', 'ArrowUp'); // En modo paseo ArrowUp rota hacia arriba si Control estÃ¡ presionado, pero aquÃ­ daremos movilidad total
        bindKey('btn-look-down', 'ArrowDown');

        // LÃ³gica de Look Up/Down para botones especÃ­ficos
        let isBtnLookUp = false;
        let isBtnLookDown = false;
        document.getElementById('btn-look-up').onpointerdown = () => isBtnLookUp = true;
        document.getElementById('btn-look-up').onpointerup = () => isBtnLookUp = false;
        document.getElementById('btn-look-down').onpointerdown = () => isBtnLookDown = true;
        document.getElementById('btn-look-down').onpointerup = () => isBtnLookDown = false;


        let moveSpeed = 0.15;
        let rotSpeed = 0.02;

        function updateKeyboardNavigation() {
            const prevY = camera.position.y;
            const isCtrl = keys.ControlLeft || keys.ControlRight;
            const dir = new THREE.Vector3();
            camera.getWorldDirection(dir);
            const walkDir = dir.clone(); walkDir.y = 0; walkDir.normalize();

            // Vector derecha (perpendicular a la mirada y al eje Y)
            const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), walkDir).normalize();

            let moveAccumX = 0;
            let moveAccumZ = 0;

            // --- DESPLAZAMIENTO (JOYSTICK + TECLADO WASD) ---
            if (joystickActive) {
                moveAccumX += walkDir.x * (-joystickDir.y * moveSpeed) + right.x * (-joystickDir.x * moveSpeed);
                moveAccumZ += walkDir.z * (-joystickDir.y * moveSpeed) + right.z * (-joystickDir.x * moveSpeed);
            }

            if (isCtrl) {
                // MODO MIRADA VERTICAL (PITCH)
                if (keys.ArrowUp) {
                    if (dir.dot(new THREE.Vector3(0, 1, 0)) < 0.95) {
                        const relTarget = controls.target.clone().sub(camera.position);
                        relTarget.applyAxisAngle(right, -rotSpeed);
                        controls.target.copy(camera.position).add(relTarget);
                    }
                }
                if (keys.ArrowDown) {
                    if (dir.dot(new THREE.Vector3(0, -1, 0)) < 0.95) {
                        const relTarget = controls.target.clone().sub(camera.position);
                        relTarget.applyAxisAngle(right, rotSpeed);
                        controls.target.copy(camera.position).add(relTarget);
                    }
                }
            } else {
                // MODO CAMINATA (WALK + YAW)
                if (keys.ArrowUp) {
                    moveAccumX += walkDir.x * moveSpeed;
                    moveAccumZ += walkDir.z * moveSpeed;
                }
                if (keys.ArrowDown) {
                    moveAccumX -= walkDir.x * moveSpeed;
                    moveAccumZ -= walkDir.z * moveSpeed;
                }

                // RotaciÃ³n Horizontal
                if (keys.ArrowLeft) {
                    const relativeTarget = controls.target.clone().sub(camera.position);
                    relativeTarget.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotSpeed);
                    controls.target.copy(camera.position).add(relativeTarget);
                }
                if (keys.ArrowRight) {
                    const relativeTarget = controls.target.clone().sub(camera.position);
                    relativeTarget.applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotSpeed);
                    controls.target.copy(camera.position).add(relativeTarget);
                }

                // Mirada Vertical con botones dedicados
                if (isBtnLookUp) {
                    if (dir.dot(new THREE.Vector3(0, 1, 0)) < 0.95) {
                        const relTarget = controls.target.clone().sub(camera.position);
                        relTarget.applyAxisAngle(right, -rotSpeed);
                        controls.target.copy(camera.position).add(relTarget);
                    }
                }
                if (isBtnLookDown) {
                    if (dir.dot(new THREE.Vector3(0, -1, 0)) < 0.95) {
                        const relTarget = controls.target.clone().sub(camera.position);
                        relTarget.applyAxisAngle(right, rotSpeed);
                        controls.target.copy(camera.position).add(relTarget);
                    }
                }

                // Teclas WASD (Strafe opcional en teclado)
                if (keys.KeyD) { moveAccumX += right.x * moveSpeed; moveAccumZ += right.z * moveSpeed; }
                if (keys.KeyA) { moveAccumX -= right.x * moveSpeed; moveAccumZ -= right.z * moveSpeed; }
                if (keys.KeyW) { moveAccumX += walkDir.x * moveSpeed; moveAccumZ += walkDir.z * moveSpeed; }
                if (keys.KeyS) { moveAccumX -= walkDir.x * moveSpeed; moveAccumZ -= walkDir.z * moveSpeed; }
            }

            // --- APLICACIÃ“N DE MOVIMIENTO CON MOTOR DE COLISIONES ---
            if (Math.abs(moveAccumX) > 0.0001 || Math.abs(moveAccumZ) > 0.0001) {
                const nx = camera.position.x + moveAccumX;
                const ny = camera.position.y;
                const nz = camera.position.z + moveAccumZ;

                // ColisiÃ³n Eje X (deslizamiento)
                if (!checkCollision(nx, ny, camera.position.z)) {
                    camera.position.x = nx;
                    controls.target.x += moveAccumX;
                }
                // ColisiÃ³n Eje Z (deslizamiento)
                if (!checkCollision(camera.position.x, ny, nz)) {
                    camera.position.z = nz;
                    controls.target.z += moveAccumZ;
                }
                isWalking = true;
            }

            // --- REFUERZO DE TECLADO WASD PARA PC ---
            if (keys.KeyW) { camera.position.addScaledVector(walkDir, moveSpeed); controls.target.addScaledVector(walkDir, moveSpeed); }
            if (keys.KeyS) { camera.position.addScaledVector(walkDir, -moveSpeed); controls.target.addScaledVector(walkDir, -moveSpeed); }
            if (keys.KeyA) { camera.position.addScaledVector(right, -moveSpeed); controls.target.addScaledVector(right, -moveSpeed); }
            if (keys.KeyD) { camera.position.addScaledVector(right, moveSpeed); controls.target.addScaledVector(right, moveSpeed); }


            // --- MOTOR DE ESCALERAS MECÃNICAS (V3 GEOMÃ‰TRICA) ---
            let onEscalator = false;
            escalatorList.forEach(e => {
                const dx = Math.abs(camera.position.x - e.x);
                const dz = (camera.position.z >= e.zMin && camera.position.z <= e.zMax);

                if (dx < 1.8 && dz) {
                    onEscalator = true;

                    // 1. TracciÃ³n Horizontal (Z)
                    const distDir = Math.sign(e.zEnd - e.zStart);
                    const speedZ = 0.09;
                    camera.position.z += distDir * speedZ;
                    controls.target.z += distDir * speedZ;

                    // 2. Empuje Vertical Constante (Y) - SegÃºn sugerencia del usuario
                    const speedY = 0.04; // Velocidad de ascenso/descenso
                    const targetHeight = e.up ? 7.1 : 1.8; // Piso 2 o PB

                    if (e.up && camera.position.y < targetHeight) {
                        camera.position.y += speedY;
                        controls.target.y += speedY;
                    } else if (!e.up && camera.position.y > targetHeight) {
                        camera.position.y -= speedY;
                        controls.target.y -= speedY;
                    }
                }
            });

            // BLOQUEO DE ALTURA (SOLO FUERA DE ESCALERAS)
            if (isWalking && !onEscalator) {
                const prevFloorY = camera.position.y;
                const groundY = camera.position.y > 3.0 ? 5.4 : 0.1;
                camera.position.y = groundY + 1.7;
                controls.target.y += (camera.position.y - prevFloorY);
            }
        }



        // --- LÃ“GICA DE GESTIÃ“N COMERCIAL (BASE DE DATOS DINÃMICA) ---
        const categoryData = {
            MODA: { giro: "Boutique de Alta Costura", products: [{ n: "Vestido Gala", p: "$1.850" }, { n: "Bolso de Cuero", p: "$2.200" }, { n: "Perfume Signature", p: "$450" }] },
            TECH: { giro: "TecnologÃ­a e InnovaciÃ³n", products: [{ n: "Smartphone PRO Max", p: "$1.299" }, { n: "Laptop Ultraliviana", p: "$2.450" }, { n: "Reloj Inteligente", p: "$590" }] },
            JOYERIA: { giro: "Alta JoyerÃ­a y RelojerÃ­a", products: [{ n: "Anillo Diamante", p: "$12.500" }, { n: "Collar Oro 18K", p: "$7.200" }, { n: "Reloj Platino", p: "$18.900" }] },
            CAFE: { giro: "CafÃ© de Especialidad y Bistro", products: [{ n: "Pack CafÃ© de Origen", p: "$28" }, { n: "Taza CerÃ¡mica Autor", p: "$35" }, { n: "DegustaciÃ³n Gourmet", p: "$65" }] },
            DEPORTES: { giro: "Equipamiento Deportivo Pro", products: [{ n: "Zapatillas Carbono", p: "$280" }, { n: "Camiseta TÃ©cnica", p: "$85" }, { n: "Bolso Gym Premium", p: "$145" }] }
        };

        function getStoreData(code) {
            // Generador consistente basado en el cÃ³digo
            const hash = code.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
            const categories = Object.keys(categoryData);
            const catKey = categories[hash % categories.length];
            const data = categoryData[catKey];

            let name = "Boutique " + (code.length > 2 ? code.substring(0, 2) : "Premium");
            // Nombres especiales para anclas
            if (code === "N") name = "Nordic Emporium";
            if (code === "S") name = "Southern Luxury";
            if (code === "E") name = "Eastern Gate Mall";
            if (code === "O") name = "Occidental Center";

            return { shopCode: code, name: name, category: data.giro, products: data.products };
        }

        function openModal(data) {
            document.getElementById('modal-title').innerText = data.name;
            document.getElementById('modal-code').innerText = `LOCAL ${data.shopCode}`;
            document.getElementById('modal-category').innerText = `Giro Comercial: ${data.category}`;
            const tbody = document.getElementById('modal-products');
            tbody.innerHTML = '';
            data.products.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${p.n}</td><td class="price">${p.p}</td>`;
                tbody.appendChild(tr);
            });
            document.getElementById('modal-overlay').style.display = 'block';
            document.getElementById('store-modal').style.display = 'block';
        }

        window.sendStoreMessage = function() {
            const name = document.getElementById('contact-name').value;
            const email = document.getElementById('contact-email').value;
            const msg = document.getElementById('contact-message').value;
            const shopCode = document.getElementById('modal-code').innerText;
            
            if(!name || !email || !msg) {
                alert("Por favor completa todos los campos para contactar a la tienda.");
                return;
            }
            
            // SimulaciÃ³n de envÃ­o (luego conectaremos con Supabase si el locatario estÃ¡ registrado)
            alert(`Â¡Mensaje enviado a ${shopCode}!\n\nPronto el locatario se pondrÃ¡ en contacto contigo.`);
            
            // Limpiar campos
            document.getElementById('contact-name').value = '';
            document.getElementById('contact-email').value = '';
            document.getElementById('contact-message').value = '';
        };

        // --- SISTEMA DE INTERACCIÃ“N (RAYCASTING) ---
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        // --- SISTEMA DE BÃšSQUEDA Y MAPAS ---
        let fullStoreInventory = [];
        function precalculateInventory() {
            // Recorre cÃ³digos posibles y precalcula para el buscador
            const codes = [];
            ['N', 'S', 'E', 'O'].forEach(w => {
                [1, 2].forEach(f => {
                    for (let i = 1; i <= 14; i++) codes.push(`${w}${f}${String(i).padStart(2, '0')}`);
                });
            });
            ['N', 'S', 'E', 'O'].forEach(a => codes.push(a));
            codes.forEach(c => fullStoreInventory.push(getStoreData(c)));
        }
        precalculateInventory();

        window.filterStores = function () {
            const q = document.getElementById('search-input').value.toLowerCase();
            const results = document.getElementById('search-results');
            results.innerHTML = '';
            if (!q) return;
            const matches = fullStoreInventory.filter(s => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.products.some(p => p.n.toLowerCase().includes(q))).slice(0, 8);
            matches.forEach(m => {
                const div = document.createElement('div'); div.className = 'search-item';
                div.innerHTML = `<span><strong>${m.name}</strong> (${m.category})</span> <small>${m.shopCode}</small>`;
                div.onclick = () => showInMap(m);
                results.appendChild(div);
            });
        };

        function showInMap(store) {
            const floor = store.shopCode.includes('2') ? 2 : 1;
            document.getElementById('f-btn-1').className = floor === 1 ? 'floor-btn active' : 'floor-btn';
            document.getElementById('f-btn-2').className = floor === 2 ? 'floor-btn active' : 'floor-btn';

            const mapTarget = document.getElementById('map-target-pos');
            mapTarget.innerHTML = '';

            // Decodificar cÃ³digo para mapa 2D (esquemÃ¡tico)
            let x = 50, y = 50;
            const wing = store.shopCode[0];
            const val = parseInt(store.shopCode.substring(2)) || 50; // Para anclas
            const offset = 10 + (val / 2); // Escala para el SVG de 100x100

            if (wing === 'N') y = 50 - offset;
            if (wing === 'S') y = 50 + offset;
            if (wing === 'E') x = 50 + offset;
            if (wing === 'O') x = 50 - offset;

            if (store.shopCode.length === 1) { // Ancla
                if (wing === 'N') y = 5; if (wing === 'S') y = 95; if (wing === 'E') x = 95; if (wing === 'O') x = 5;
            }

            const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            dot.setAttribute("cx", x); dot.setAttribute("cy", y); dot.setAttribute("r", 4);
            dot.setAttribute("fill", "#ff0000");
            const animate = document.createElementNS("http://www.w3.org/2000/svg", "animate");
            animate.setAttribute("attributeName", "r"); animate.setAttribute("values", "2;5;2"); animate.setAttribute("dur", "1s"); animate.setAttribute("repeatCount", "indefinite");
            dot.appendChild(animate);
            mapTarget.appendChild(dot);

            document.getElementById('location-text').innerHTML = `<b style="color:#c5a059;">UbicaciÃ³n:</b> Ala ${wing}, Planta ${floor}. Local ${store.shopCode}`;
        }

        window.openSearch = function () { document.getElementById('search-modal').style.display = 'block'; document.getElementById('modal-overlay').style.display = 'block'; };
        document.getElementById('search-close-btn').onclick = () => { document.getElementById('search-modal').style.display = 'none'; document.getElementById('modal-overlay').style.display = 'none'; };

        window.addEventListener('click', (event) => {
            // No interactuar con el mall si el login o el modal de bÃºsqueda estÃ¡n abiertos
            if (document.getElementById('login-overlay').style.display !== 'none' ||
                document.getElementById('search-modal').style.display === 'block') return;

            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(scene.children, true);
            if (intersects.length > 0) {
                let obj = intersects[0].object;
                let foundStore = null, foundTotem = null, foundPlayer = null;
                while (obj.parent) {
                    if (obj.userData.isSign) {
                        // Encontrar la tienda padre
                        let storeObj = obj;
                        while(storeObj.parent && !storeObj.userData.shopCode) storeObj = storeObj.parent;
                        foundStore = storeObj;
                    }
                    if (obj.userData.isTotem) foundTotem = obj;
                    if (obj.userData.playerId) foundPlayer = obj.userData.playerId;
                    if (foundStore || foundTotem || foundPlayer) break;
                    obj = obj.parent;
                }
                if (foundPlayer) {
                    setChatTarget(foundPlayer);
                    return;
                }
                if (foundTotem) openSearch();
                else if (foundStore) {
                    const data = getStoreData(foundStore.userData.shopCode);
                    if (foundStore.userData.isAnchor) data.name = foundStore.userData.name;
                    openModal(data);
                }
            }
        });

        // --- SUPABASE & MULTIJUGADOR OPTIMIZADO ---
        let supabaseClient = null;
        let myNickname = "";
        let myAvatarStyle = "1";

        window.selectAvatar = function (id, el) {
            myAvatarStyle = id;
            document.querySelectorAll('.avatar-opt').forEach(btn => btn.classList.remove('selected'));
            el.classList.add('selected');
        }

        // Administradores y Chat
        const ADMINS = ['javier', 'javi', 'mauri', 'admin'];
        let chatTarget = "";
        let isAdmin = false;
        let isChatOpen = false;
        let unreadCount = 0;

        window.toggleChat = function () {
            isChatOpen = !isChatOpen;
            document.getElementById('mall-chat').style.display = isChatOpen ? 'flex' : 'none';
            document.getElementById('chat-minimized-btn').style.display = isChatOpen ? 'none' : 'flex';
            if (isChatOpen) {
                unreadCount = 0;
                document.getElementById('chat-badge').style.display = 'none';
                const msgs = document.getElementById('chat-messages');
                msgs.scrollTop = msgs.scrollHeight;
            }
        };

        window.setChatTarget = function (user) {
            if (user === myNickname) return;
            chatTarget = user;
            document.getElementById('chat-target-text').innerText = `ðŸ’¬ Privado con: ${user}`;
            document.getElementById('chat-reset-btn').style.display = isAdmin ? 'inline-block' : 'none';
        }

        window.resetChatTarget = function () {
            if (!isAdmin) return;
            chatTarget = "Todos";
            document.getElementById('chat-target-text').innerText = "ðŸ”Š HABLANDO A: TODOS";
            document.getElementById('chat-reset-btn').style.display = 'none';
        }
        let otherPlayers = {}; // { sessionId: { mesh, label, targetPos, targetRot } }
        let presenceChannel = null;

        // Variables de optimizaciÃ³n (Ahorro de datos)
        let lastSentPos = new THREE.Vector3();
        let lastSentRot = 0;
        const POS_THRESHOLD = 0.3; // No enviar si se mueve menos de 30cm
        const ROT_THRESHOLD = 0.15; // No enviar si rota menos de ~8 grados
        window.startMallExperience = async function () {
            const nick = document.getElementById('nickname-input').value.trim();
            if (!nick) return alert("Por favor, ingresa tu nombre de visitante");
            myNickname = nick;
            isAdmin = ADMINS.includes(myNickname.toLowerCase());

            if (isAdmin) {
                resetChatTarget();
            } else {
                chatTarget = ""; 
                document.getElementById('chat-target-text').innerText = "ðŸ–±ï¸ Clickea un jugador para hablarle";
            }
            
            document.getElementById('login-overlay').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('login-overlay').style.display = 'none';
                // Forzar posiciÃ³n de inicio al entrar
                if (!isWalking) {
                    window.toggleWalkMode();
                } else {
                    camera.position.set(0, 1.7, -82);
                    controls.target.set(0, 1.80, -78);
                    controls.update();
                }
            }, 500);

            // ConfiguraciÃ³n de Supabase
            const SB_URL = "https://wwvkmxqonsnrliedqtqn.supabase.co";
            const SB_KEY = "sb_publishable_6elC2KGVGeqzhkuolO4hFQ_D4OjNdCu";

            console.log("ðŸ› ï¸ Inicializando conexiÃ³n con Supabase...");
            if (typeof supabase !== 'undefined') {
                try {
                    supabaseClient = supabase.createClient(SB_URL, SB_KEY);
                    console.log("ðŸš€ Conexion exitosa con el Metaverso (Modo Ahorro)");
                    initPresence();
                } catch (e) {
                    console.error("âŒ Error al conectar con Supabase:", e);
                }
            }
        };

        const HEARTBEAT_LIMIT = 4000; // Enviar cada 4 seg aunque estÃ© quieto
        let lastUpdateTime = 0;

        function initPresence() {
            presenceChannel = supabaseClient.channel('mall_presence', {
                config: {
                    presence: { key: myNickname },
                    broadcast: { self: true }
                }
            });

            presenceChannel
                .on('presence', { event: 'sync' }, () => {
                    const state = presenceChannel.presenceState();
                    Object.keys(state).forEach(id => {
                        if (id === myNickname) return;
                        if (!otherPlayers[id]) otherPlayers[id] = createAvatar(id);
                    });
                })
                .on('presence', { event: 'leave' }, ({ key }) => {
                    removePlayer(key);
                    addChatMessage("Sistema", `${key} ha salido del mall.`);
                })
                .on('presence', { event: 'join' }, ({ key }) => {
                    if (key !== myNickname) {
                        addChatMessage("Sistema", `${key} ha entrado al mall.`);
                        broadcastMyPosition(); // Responder inmediatamente al que acaba de entrar
                    }
                })
                .on('broadcast', { event: 'chat_msg' }, payload => {
                    const { user, text, to } = payload.payload;
                    if (to !== "Todos" && to !== myNickname && user !== myNickname) return; // Filtrar mensajes que no son para ti
                    addChatMessage(user, text, to);
                })
                .on('broadcast', { event: 'pos_update' }, payload => {
                    const id = payload.payload.user;
                    if (id === myNickname) return;
                    // Pasamos tb el estilo en el payload por si no lo tenÃ­amos en presence inicial
                    if (!otherPlayers[id]) otherPlayers[id] = createAvatar(id, payload.payload.style || "1");
                    const p = otherPlayers[id];
                    const pData = payload.payload;
                    p.targetPos.set(pData.x, pData.y - 1.7, pData.z);
                    p.targetRot = pData.r;
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        await trackMySelf();
                        document.getElementById('chat-minimized-btn').style.display = 'flex';
                        // window.toggleChat(); // El chat ahora comienza cerrado por defecto
                        addChatMessage("Sistema", `Â¡Hola ${myNickname}! Presiona Enter para enviar mensajes.`);
                        broadcastMyPosition();
                    }
                });

            // Intervalo de Broadcast en lugar de Presence Track
            setInterval(() => {
                if (!presenceChannel) return;

                const dist = camera.position.distanceTo(lastSentPos);
                const rotDiff = Math.abs(camera.rotation.y - lastSentRot);
                const now = Date.now();

                // LÃ“GICA DE OPTIMIZACIÃ“N: Solo enviar si hubo cambio o pasÃ³ el tiempo lÃ­mite
                if (dist > POS_THRESHOLD || rotDiff > ROT_THRESHOLD || (now - lastUpdateTime) > HEARTBEAT_LIMIT) {
                    broadcastMyPosition();
                    lastSentPos.copy(camera.position);
                    lastSentRot = camera.rotation.y;
                    lastUpdateTime = now;
                }
            }, 100);
        }

        async function trackMySelf() {
            if (!presenceChannel) return;
            // Solo registrar presencia bÃ¡sica y quÃ© avatar escogimos
            await presenceChannel.track({ nickname: myNickname, style: myAvatarStyle });
        }

        function broadcastMyPosition() {
            if (!presenceChannel) return;
            presenceChannel.send({
                type: 'broadcast',
                event: 'pos_update',
                payload: {
                    user: myNickname,
                    style: myAvatarStyle,
                    x: camera.position.x,
                    y: camera.position.y,
                    z: camera.position.z,
                    r: camera.rotation.y
                }
            });
        }

        function addChatMessage(user, text, to = "Todos") {
            const container = document.getElementById('chat-messages');
            const p = document.createElement('p');
            p.style.margin = '0'; p.style.fontSize = '12px'; p.style.color = '#fff'; p.style.lineHeight = '1.4'; p.style.wordWrap = 'break-word';
            let label = to === "Todos" ? `<strong style="color: #c5a059;">${user}</strong>` : `<strong style="color: #6dbcdb;">[Privado] ${user}</strong>`;
            p.innerHTML = `${label}: ${text.replace(/</g, "&lt;")}`;
            container.appendChild(p);
            container.scrollTop = container.scrollHeight;

            if (!isChatOpen && user !== "Sistema" && user !== myNickname) {
                unreadCount++;
                const badge = document.getElementById('chat-badge');
                badge.innerText = unreadCount;
                badge.style.display = 'flex';
            }
        }

        const chatInput = document.getElementById('chat-input');
        const chatSend = document.getElementById('chat-send');

        function sendChat() {
            const text = chatInput.value.trim();
            if (!text || !presenceChannel) return;

            if (!isAdmin && chatTarget === "") {
                return alert("Para conversar, debes acercarte y darle clic a otro avatar en el Mall primero.");
            }

            presenceChannel.send({
                type: 'broadcast',
                event: 'chat_msg',
                payload: { user: myNickname, text: text, to: chatTarget }
            });
            chatInput.value = '';
            chatInput.blur(); // Quitar el foco para devolver el control a la cÃ¡mara/teclado del mall
        }

        chatSend.onclick = sendChat;
        chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendChat(); e.stopPropagation(); };
        chatInput.addEventListener('keydown', e => e.stopPropagation());
        chatInput.addEventListener('keyup', e => e.stopPropagation());

        function createAvatar(nickname, styleCode = "1") {
            const group = new THREE.Group();

            // Colores por clase
            let skinColor = 0xffcc99; // base
            let shirtColor = 0x222222; // formal
            let pantsColor = 0x111111;

            if (styleCode === "2") { shirtColor = 0xffd700; pantsColor = 0x3344cc; } // deportivo
            if (styleCode === "3") { shirtColor = 0xaa4455; pantsColor = 0x556677; } // casual urbano

            const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 });
            const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });
            const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.9 });
            const blackMat = new THREE.MeshStandardMaterial({ color: 0x000000 });

            // Torso (0.6x0.8x0.3) centro en Y=1.1
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), shirtMat);
            body.position.set(0, 1.1, 0);
            group.add(body);
            body.userData.playerId = nickname;

            // Cabeza (0.5x0.5x0.5) centro en Y=1.75
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.4), skinMat);
            head.position.set(0, 1.75, 0);
            group.add(head);
            head.userData.playerId = nickname;

            // Gafas o visor (para saber hacia dÃ³nde mira) (frontal en el eje Z positivo)
            const visor = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.15), blackMat);
            visor.position.set(0, 1.75, 0.22);
            group.add(visor);
            visor.userData.playerId = nickname;

            // Brazos
            const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), skinMat);
            armL.position.set(-0.45, 1.15, 0); group.add(armL);
            armL.userData.playerId = nickname;

            const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), skinMat);
            armR.position.set(0.45, 1.15, 0); group.add(armR);
            armR.userData.playerId = nickname;

            // Piernas
            const legL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), pantsMat);
            legL.position.set(-0.15, 0.35, 0); group.add(legL);
            legL.userData.playerId = nickname;

            const legR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), pantsMat);
            legR.position.set(0.15, 0.35, 0); group.add(legR);
            legR.userData.playerId = nickname;

            scene.add(group);

            const label = document.createElement('div');
            label.className = 'avatar-label'; label.innerText = nickname;
            document.body.appendChild(label);

            return { 
                mesh: group, 
                label: label, 
                targetPos: new THREE.Vector3(), 
                targetRot: 0,
                limbs: { armL, armR, legL, legR }
            };
        }

        const createAvatarStylized = function (nickname, styleCode = "1") {
            const group = new THREE.Group();

            let palette = {
                skin: 0xf0c7a2,
                shirt: 0x1f232a,
                accent: 0xc5a059,
                pants: 0x171a1f,
                shoes: 0x0b0b0d,
                hair: 0x2a1e18
            };
            if (styleCode === "2") palette = { skin: 0xe7bc97, shirt: 0xf1c232, accent: 0xffffff, pants: 0x274690, shoes: 0xf7f7f7, hair: 0x3a2a1c };
            if (styleCode === "3") palette = { skin: 0xd9ae86, shirt: 0x8c3f58, accent: 0xe3c27a, pants: 0x586674, shoes: 0x231f20, hair: 0x151515 };

            const skinMat = new THREE.MeshStandardMaterial({ color: palette.skin, roughness: 0.72, metalness: 0.02 });
            const shirtMat = new THREE.MeshStandardMaterial({ color: palette.shirt, roughness: 0.78 });
            const accentMat = new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.45, metalness: 0.15 });
            const pantsMat = new THREE.MeshStandardMaterial({ color: palette.pants, roughness: 0.88 });
            const shoesMat = new THREE.MeshStandardMaterial({ color: palette.shoes, roughness: 0.55 });
            const hairMat = new THREE.MeshStandardMaterial({ color: palette.hair, roughness: 0.9 });
            const darkMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.35, metalness: 0.15 });

            const assignPlayerId = (obj) => {
                obj.userData.playerId = nickname;
                return obj;
            };

            const torso = assignPlayerId(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.28), shirtMat));
            torso.position.set(0, 1.18, 0);
            group.add(torso);

            const chest = assignPlayerId(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.3), accentMat));
            chest.position.set(0, 1.2, 0.02);
            group.add(chest);

            const pelvis = assignPlayerId(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.28, 0.24), pantsMat));
            pelvis.position.set(0, 0.72, 0);
            group.add(pelvis);

            const neck = assignPlayerId(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.14, 10), skinMat));
            neck.position.set(0, 1.58, 0);
            group.add(neck);

            const head = assignPlayerId(new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), skinMat));
            head.position.set(0, 1.88, 0.02);
            head.scale.set(1, 1.08, 0.96);
            group.add(head);

            const hair = assignPlayerId(new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), hairMat));
            hair.position.set(0, 1.97, -0.01);
            hair.scale.set(1.02, 0.72, 1.02);
            group.add(hair);

            const visor = assignPlayerId(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.12), darkMat));
            visor.position.set(0, 1.87, 0.2);
            group.add(visor);

            const shoulderBar = assignPlayerId(new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.12, 0.18), shirtMat));
            shoulderBar.position.set(0, 1.42, 0);
            group.add(shoulderBar);

            const armGeometry = new THREE.CylinderGeometry(0.07, 0.08, 0.52, 8);
            const forearmGeometry = new THREE.CylinderGeometry(0.055, 0.065, 0.42, 8);
            const legGeometry = new THREE.CylinderGeometry(0.085, 0.095, 0.62, 8);
            const shinGeometry = new THREE.CylinderGeometry(0.07, 0.08, 0.54, 8);

            const armL = new THREE.Group();
            armL.position.set(-0.36, 1.38, 0);
            group.add(armL);
            const armLUpper = assignPlayerId(new THREE.Mesh(armGeometry, shirtMat));
            armLUpper.position.y = -0.24;
            armLUpper.rotation.z = 0.08;
            armL.add(armLUpper);
            const armLFore = assignPlayerId(new THREE.Mesh(forearmGeometry, skinMat));
            armLFore.position.set(0, -0.58, 0);
            armLFore.rotation.z = 0.04;
            armL.add(armLFore);

            const armR = new THREE.Group();
            armR.position.set(0.36, 1.38, 0);
            group.add(armR);
            const armRUpper = assignPlayerId(new THREE.Mesh(armGeometry, shirtMat));
            armRUpper.position.y = -0.24;
            armRUpper.rotation.z = -0.08;
            armR.add(armRUpper);
            const armRFore = assignPlayerId(new THREE.Mesh(forearmGeometry, skinMat));
            armRFore.position.set(0, -0.58, 0);
            armRFore.rotation.z = -0.04;
            armR.add(armRFore);

            const legL = new THREE.Group();
            legL.position.set(-0.17, 0.58, 0);
            group.add(legL);
            const legLUpper = assignPlayerId(new THREE.Mesh(legGeometry, pantsMat));
            legLUpper.position.y = -0.34;
            legL.add(legLUpper);
            const legLLower = assignPlayerId(new THREE.Mesh(shinGeometry, pantsMat));
            legLLower.position.set(0, -0.82, 0.02);
            legL.add(legLLower);
            const shoeL = assignPlayerId(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.34), shoesMat));
            shoeL.position.set(0, -1.12, 0.08);
            legL.add(shoeL);

            const legR = new THREE.Group();
            legR.position.set(0.17, 0.58, 0);
            group.add(legR);
            const legRUpper = assignPlayerId(new THREE.Mesh(legGeometry, pantsMat));
            legRUpper.position.y = -0.34;
            legR.add(legRUpper);
            const legRLower = assignPlayerId(new THREE.Mesh(shinGeometry, pantsMat));
            legRLower.position.set(0, -0.82, 0.02);
            legR.add(legRLower);
            const shoeR = assignPlayerId(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.34), shoesMat));
            shoeR.position.set(0, -1.12, 0.08);
            legR.add(shoeR);

            scene.add(group);

            const label = document.createElement('div');
            label.className = 'avatar-label';
            label.innerText = nickname;
            document.body.appendChild(label);

            return {
                mesh: group,
                label: label,
                targetPos: new THREE.Vector3(),
                targetRot: 0,
                lastPos: new THREE.Vector3(),
                walkCycle: Math.random() * Math.PI * 2,
                limbs: { armL, armR, legL, legR }
            };
        };

        createAvatar = createAvatarStylized;

        const CHILEAN_NAMES = [
            "Mateo GonzÃ¡lez", "AgustÃ­n MuÃ±oz", "BenjamÃ­n Rojas", "Vicente DÃ­az", "SofÃ­a Morales",
            "Emilia SepÃºlveda", "Florencia Araya", "Isidora PastÃ©n", "Josefa Castro", "Juan PÃ©rez",
            "Diego Soto", "Luis Silva", "Carlos Contreras", "Jorge MartÃ­nez", "VÃ­ctor Tapia",
            "AndrÃ©s Concha", "Patricio Leyton", "Felipe Valenzuela", "NicolÃ¡s Poblete", "SebastiÃ¡n Vera",
            "Matias Fuenzalida", "Cristian HenrÃ­quez", "Rodrigo Saavedra", "Gabriel Maturana", "JoaquÃ­n Orellana",
            "Valentina Gatica", "Martina Lagos", "Catalina Briones", "Antonia Jerez", "Fernanda FarÃ­as",
            "Paz Bustamante", "Trinidad Arancibia", "Maite Vilches", "Isabel Carvajal", "LucÃ­a Pizarro",
            "Elena Godoy", "Rosa Mellado", "Ana MarÃ­a Salinas", "MÃ³nica Olivares", "BÃ¡rbara Espinoza",
            "Francisca Urbina", "Camila Gallegos", "Javiera AlarcÃ³n", "Daniela Varas", "Constanza Rivas"
        ];

        function syncPlayers(state) {
            Object.keys(state).forEach(id => {
                if (id === myNickname) return;
                let remoteStyle = "1";
                if (state[id] && state[id][0] && state[id][0].style) remoteStyle = state[id][0].style;
                if (!otherPlayers[id]) otherPlayers[id] = createAvatar(id, remoteStyle);
                // No configuramos posiciones iniciales aquÃ­ porque vendrÃ¡n vÃ­a Broadcast
            });
        }

        function removePlayer(id) {
            if (otherPlayers[id]) {
                scene.remove(otherPlayers[id].mesh);
                otherPlayers[id].label.remove();
                delete otherPlayers[id];
            }
        }

        function updateOtherPlayers() {
            Object.values(otherPlayers).forEach(p => {
                if (p.mesh) {
                    if (!p.lastPos) p.lastPos = p.mesh.position.clone();
                    const prevPos = p.mesh.position.clone();
                    p.mesh.position.lerp(p.targetPos, 0.08); // Suavizado mayor para compensar saltos
                    p.mesh.rotation.y = p.targetRot;
                    if (p.limbs) {
                        const stepDistance = prevPos.distanceTo(p.mesh.position);
                        p.walkCycle = (p.walkCycle || 0) + Math.min(stepDistance * 16, 0.45);
                        const swing = Math.sin(p.walkCycle) * Math.min(stepDistance * 20, 0.55);
                        p.limbs.legL.rotation.x = swing;
                        p.limbs.legR.rotation.x = -swing;
                        p.limbs.armL.rotation.x = -swing * 0.85;
                        p.limbs.armR.rotation.x = swing * 0.85;
                    }
                    const tempVec = p.mesh.position.clone();
                    tempVec.y += 2.0;
                    tempVec.project(camera);
                    const x = (tempVec.x * 0.5 + 0.5) * window.innerWidth;
                    const y = (tempVec.y * -0.5 + 0.5) * window.innerHeight;
                    p.label.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
                    p.label.style.display = (tempVec.z > 1 || Math.abs(tempVec.x) > 1 || Math.abs(tempVec.y) > 1) ? 'none' : 'block';
                }
            });
        }

        // --- VARIABLES GLOBALES DE PUBLICIDAD ---
        let lastAdUpdate = Date.now();
        let adIndex = 0;

        function animate() {
            requestAnimationFrame(animate);

            const currentTime = Date.now();
            if (currentTime - lastAdUpdate > 5000) {
                adIndex = (adIndex + 1) % adTextures.length;
                screenMeshes.forEach(s => s.material.map = adTextures[adIndex]);
                lastAdUpdate = currentTime;
            }

            updateKeyboardNavigation();
            updateOtherPlayers();
            updateNPCs(); // Actualizar bots

            controls.update(); 
            renderer.render(scene, camera); 
        }

        // --- SISTEMA DE NPCs (MULTITUD ARTIFICIAL) ---
        const npcs = [];
        const NPC_COUNT = 100;

        function initNPCs() {
            for (let i = 0; i < NPC_COUNT; i++) {
                const name = CHILEAN_NAMES[i % CHILEAN_NAMES.length] + (i >= CHILEAN_NAMES.length ? ` ${i}` : "");
                const style = ["1", "2", "3"][Math.floor(Math.random() * 3)];
                const npc = createAvatar(name, style);
                
                // DistribuciÃ³n inicial: Pasillos y pasarelas
                const startY = Math.random() > 0.5 ? 5.4 : 0;
                let startX = (Math.random() - 0.5) * 80;
                let startZ = (Math.random() - 0.5) * 80;
                
                // Asegurar que empiecen en pasillos (cruces centrales)
                if (Math.random() > 0.5) startX = (Math.random() - 0.5) * 20;
                else startZ = (Math.random() - 0.5) * 20;

                npc.mesh.position.set(startX, startY, startZ);
                
                npcs.push({
                    mesh: npc.mesh,
                    label: npc.label,
                    limbs: npc.limbs,
                    target: new THREE.Vector3(startX, startY, startZ),
                    state: 'walking',
                    timer: 0,
                    speed: 0.03 + Math.random() * 0.04,
                    walkCycle: Math.random() * Math.PI * 2
                });
                
                // Etiqueta sutil para NPCs
                npc.label.style.fontSize = "9px";
                npc.label.style.opacity = "0.45";
                npc.label.style.background = "rgba(0,0,0,0.16)";
                npc.label.style.borderColor = "rgba(197,160,89,0.35)";
            }
        }

        function updateNPCs() {
            const now = Date.now();
            npcs.forEach(npc => {
                // --- 1. LÃ“GICA DE ESCALERA PARA BOTS ---
                let onEscalator = false;
                escalatorList.forEach(e => {
                    const dx = Math.abs(npc.mesh.position.x - e.x);
                    const dz = (npc.mesh.position.z >= e.zMin && npc.mesh.position.z <= e.zMax);
                    
                    if (dx < 1.5 && dz) {
                        onEscalator = true;
                        const distDir = Math.sign(e.zEnd - e.zStart);
                        const speedZ = 0.08;
                        const speedY = 0.038;
                        const targetHeight = e.up ? 5.4 : 0;

                        npc.mesh.position.z += distDir * speedZ;
                        if (e.up && npc.mesh.position.y < targetHeight) npc.mesh.position.y += speedY;
                        else if (!e.up && npc.mesh.position.y > targetHeight) npc.mesh.position.y -= speedY;
                        
                        npc.mesh.rotation.y = distDir > 0 ? 0 : Math.PI;
                    }
                });

                if (!onEscalator) {
                    // --- GRAVEDAD Y DETECCIÃ“N DE SUELO (Simplificada para bots) ---
                    const inAtrium = Math.abs(npc.mesh.position.x) < 11 && Math.abs(npc.mesh.position.z) < 11;
                    if (npc.mesh.position.y > 0.1 && inAtrium) {
                         npc.mesh.position.y -= 0.15;
                         if (npc.mesh.position.y < 0) npc.mesh.position.y = 0;
                    }

                    if (npc.state === 'walking') {
                        const dist = npc.mesh.position.distanceTo(npc.target);
                        if (dist < 1.0) {
                            npc.state = 'looking';
                            npc.timer = now + (3000 + Math.random() * 6000);
                        } else {
                            const dir = npc.target.clone().sub(npc.mesh.position);
                            dir.y = 0; dir.normalize();
                            
                            const moveStep = dir.clone().multiplyScalar(npc.speed);
                            const nextX = npc.mesh.position.x + moveStep.x;
                            const nextZ = npc.mesh.position.z + moveStep.z;

                            // Solo mover si no hay colisiÃ³n
                            if (!checkCollision(nextX, npc.mesh.position.y, nextZ)) {
                                npc.mesh.position.x = nextX;
                                npc.mesh.position.z = nextZ;
                                
                                // AnimaciÃ³n de extremidades (humana)
                                npc.walkCycle += npc.speed * 10;
                                const swing = Math.sin(npc.walkCycle) * 0.52;
                                npc.limbs.legL.rotation.x = swing;
                                npc.limbs.legR.rotation.x = -swing;
                                npc.limbs.armL.rotation.x = -swing * 0.85;
                                npc.limbs.armR.rotation.x = swing * 0.85;
                            } else {
                                npc.state = 'looking';
                                npc.timer = now + 1000;
                            }

                            const targetRot = Math.atan2(dir.x, dir.z);
                            let diff = targetRot - npc.mesh.rotation.y;
                            while(diff < -Math.PI) diff += Math.PI * 2;
                            while(diff > Math.PI) diff -= Math.PI * 2;
                            npc.mesh.rotation.y += diff * 0.1;
                        }
                    } else if (npc.state === 'looking') {
                        // Reset limb positions
                        npc.limbs.legL.rotation.x = 0; npc.limbs.legR.rotation.x = 0;
                        npc.limbs.armL.rotation.x = 0; npc.limbs.armR.rotation.x = 0;

                        if (now > npc.timer) {
                            const floor = Math.round(npc.mesh.position.y / 5.4);
                            if (floor === 0) {
                                // Planta Baja: Pasillos
                                if (Math.random() > 0.5) npc.target.set((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 170);
                                else npc.target.set((Math.random() - 0.5) * 170, 0, (Math.random() - 0.5) * 10);
                            } else {
                                // Planta Alta: Pasarelas
                                const side = Math.floor(Math.random() * 4);
                                if (side === 0) npc.target.set((Math.random() - 0.5) * 70, 5.4, 25);
                                if (side === 1) npc.target.set((Math.random() - 0.5) * 70, 5.4, -25);
                                if (side === 2) npc.target.set(25, 5.4, (Math.random() - 0.5) * 70);
                                if (side === 3) npc.target.set(-25, 5.4, (Math.random() - 0.5) * 70);
                            }
                            npc.state = 'walking';
                        }
                    }
                }

                // --- 3. ACTUALIZAR ETIQUETAS ---
                const tempVec = npc.mesh.position.clone();
                tempVec.y += 2.1;
                tempVec.project(camera);
                const x = (tempVec.x * 0.5 + 0.5) * window.innerWidth;
                const y = (tempVec.y * -0.5 + 0.5) * window.innerHeight;
                npc.label.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
                const npcDistance = camera.position.distanceTo(npc.mesh.position);
                const npcVisible = !(tempVec.z > 1 || Math.abs(tempVec.x) > 1 || Math.abs(tempVec.y) > 1);
                npc.label.style.display = (npcVisible && npcDistance < 22) ? 'block' : 'none';
            });
        }
        initNPCs();

        // --- VÃNCULOS DE CIERRE (MÃ‰TODO ROBUSTO) ---
        function closeModal() {
            document.getElementById('modal-overlay').style.display = 'none';
            document.getElementById('store-modal').style.display = 'none';
            document.getElementById('search-modal').style.display = 'none';
        }
        window.closeModal = closeModal;

        document.getElementById('modal-close-btn-fixed').addEventListener('click', closeModal);
        document.getElementById('modal-overlay').addEventListener('click', closeModal);
        document.getElementById('search-close-btn').addEventListener('click', closeModal);

        // --- INICIALIZACIÃ“N ---
        precalculateInventory();
        animate();

        setTimeout(() => { if (document.getElementById('loader')) document.getElementById('loader').remove(); }, 1500);
    
