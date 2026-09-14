(function registerMallFurnitureLayouts(globalScope) {
    // OS-10 ocupa el cuadrado mundial X 17..29 / Z -29..-17. En el
    // componente horizontal eso equivale a X -6..6 / Z -3..9.
    const os10UsableZone = Object.freeze({
        minX: -5.7,
        maxX: 5.7,
        minZ: -2.7,
        maxZ: 8.7
    });

    const os10BranchFurniture = Object.freeze([
        Object.freeze({ type: 'shelf-wall', x: 0, z: -2.25, width: 9.4, depth: 0.62, height: 3.75 }),
        Object.freeze({ type: 'center-island', x: -4.1, z: -0.5, width: 2.35, depth: 1.2, height: 0.9, glassCap: false }),
        Object.freeze({ type: 'center-island', x: 4.1, z: -0.5, width: 2.35, depth: 1.2, height: 0.9, glassCap: true }),
        Object.freeze({ type: 'front-vitrine', x: -4.55, z: 1.0 }),
        Object.freeze({ type: 'cash-desk', x: 4.15, z: 0.25 })
    ]);

    globalScope.MALL_STORE_FURNITURE_LAYOUTS = Object.freeze({
        'OS-10': Object.freeze({
            description: 'Mobiliario unico dentro del cuadrado fisico confirmado de OS-10.',
            physicalSpaces: Object.freeze({
                phys_b_f1_xp_zn_horizontal_01: Object.freeze({
                    safeBounds: os10UsableZone,
                    items: os10BranchFurniture
                })
            })
        })
    });
})(window);
