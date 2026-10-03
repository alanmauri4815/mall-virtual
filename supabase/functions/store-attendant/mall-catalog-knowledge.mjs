const STOP_WORDS = new Set([
  'a', 'al', 'algo', 'algun', 'alguna', 'algunas', 'algunos', 'algun', 'con',
  'como', 'cual', 'cuales', 'cuando', 'cuanto', 'cuantos', 'de', 'del', 'desde',
  'donde', 'el', 'ella', 'ellas', 'ellos', 'en', 'entre', 'era', 'eres', 'es',
  'esta', 'estan', 'este', 'esto', 'estos', 'fue', 'hay', 'la', 'las', 'le',
  'les', 'lo', 'los', 'mas', 'me', 'mi', 'mis', 'muy', 'necesito', 'no', 'o',
  'para', 'por', 'que', 'quiero', 'quisiera', 'se', 'si', 'sobre', 'su', 'sus',
  'tiene', 'tienen', 'un', 'una', 'unas', 'uno', 'unos', 'ustedes', 'vende',
  'venden', 'vender', 'y', 'yo'
]);

const DIRECTORY_QUERY = /\b(local|locales|tienda|tiendas|comercio|comercios|directorio|piso|ubicacion)\b/;
const PRODUCT_QUERY = /\b(producto|productos|catalogo|venden|vende|ofrecen|ofrece|tienen|tiene|precio|precios|comprar|despacho|envio|envios)\b/;
const GIFT_QUERY = /\b(regalo|regalos|regalar|regalarle|novia|novio|cumpleanos|aniversario|sorprender)\b/;
const GIFTABLE_CATEGORY = /\b(joyeria|joyas|accesorios|moda|vestuario|ropa|belleza|cosmetica|chocolate|artesania|perfumeria|calzado|tejidos)\b/;
const PRIVATE_TRAINING_CONTENT = /\b(arriendo|arrendamiento|alquiler|renta|canon|lease|arrendador|arrendatari[oa]|propietari[oa]|owner|rut|cedula|contrasena|password|credenciales|token|telegram|cuenta bancaria|datos personales|datos? privados|informacion personal|confidencial)\b/i;
const MAX_CONTEXT_CHARS = 14000;

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();
}

function clean(value, limit = 360) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

export function sanitizePublicTraining(value, limit = 360) {
  const text = clean(value, limit);
  if (!text || PRIVATE_TRAINING_CONTENT.test(normalize(text))) return '';
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[correo omitido]')
    .replace(/(?<![$\w])(?:\+?\d[\d\s().-]{7,}\d)(?!\w)/g, '[teléfono omitido]');
}

function tokens(value) {
  return normalize(value).split(' ').filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function catalogTokens(value) {
  const result = new Set(tokens(value));
  const query = normalize(value);
  if (/\b(joya|joyas|joyeria|joyerias|collar|collares|aro|aros|anillo|anillos|pulsera|pulseras)\b/.test(query)) {
    ['joya', 'joyas', 'joyeria', 'joyerias', 'collar', 'collares', 'aro', 'aros', 'anillo', 'anillos', 'pulsera', 'pulseras', 'accesorios'].forEach((token) => result.add(token));
  }
  if (/\b(artesanal|artesanales|hecho a mano)\b/.test(query)) {
    ['artesania', 'artesanias', 'artesanal', 'artesanales', 'hecho', 'mano'].forEach((token) => result.add(token));
  }
  return [...result];
}

function containsPhrase(text, phrase) {
  if (!phrase) return false;
  return ` ${text} `.includes(` ${phrase} `);
}

function overlapScore(queryTokens, value, weight) {
  const valueTokens = new Set(tokens(value));
  return queryTokens.reduce((score, token) => score + (valueTokens.has(token) ? weight : 0), 0);
}

function locationLabel(locations) {
  const floors = [...new Set(locations.map((item) => clean(item.floor_label, 30)).filter(Boolean))];
  return floors.map((floor) => floor === '1' ? 'primer piso' : floor === '2' ? 'segundo piso' : `piso ${floor}`).join(', ');
}

export function buildMallCatalogKnowledge(question, records = {}) {
  const query = normalize(question);
  const queryTokens = catalogTokens(question);
  const profilesByStore = new Map((Array.isArray(records.profiles) ? records.profiles : []).map((profile) => [String(profile.store_id), profile]));
  const stores = (Array.isArray(records.stores) ? records.stores : []).map((row) => {
    const id = clean(row.id, 120);
    const profile = profilesByStore.get(id) || {};
    const faq = (Array.isArray(profile.faq) ? profile.faq : []).slice(0, 12).map((item) => ({
      question: sanitizePublicTraining(item?.question, 220),
      answer: sanitizePublicTraining(item?.answer, 360),
    })).filter((item) => item.question && item.answer);
    return {
      id,
      code: clean(row.local_code, 40),
      name: clean(row.name, 120),
      category: clean(row.category, 120),
      whatsapp: clean(row.whatsapp, 60),
      phone: clean(row.contact_phone, 60),
      social: clean(row.social_url, 180),
      address: clean(row.address, 180),
      maps: clean(row.maps_url, 240),
      brief: sanitizePublicTraining(profile.store_brief, 700),
      faq,
      floor: locationLabel((records.locations || []).filter((item) => item.store_id === id)),
      shipping: (records.shippingRates || [])
        .filter((item) => item.store_id === id && item.is_active === true)
        .map((item) => `${clean(item.commune, 100)}: $${clean(item.shipping_cost, 40)}`)
        .slice(0, 20),
      products: [],
    };
  });

  const storesByIdentifier = new Map();
  for (const store of stores) {
    storesByIdentifier.set(normalize(store.id), store);
    storesByIdentifier.set(normalize(store.code), store);
  }

  for (const row of Array.isArray(records.products) ? records.products : []) {
    const store = storesByIdentifier.get(normalize(row.local_code));
    if (!store) continue;
    store.products.push({
      name: clean(row.name, 140),
      price: clean(row.price, 50),
      description: clean(row.description, 360),
      sortOrder: Number(row.sort_order) || 0,
    });
  }
  for (const store of stores) store.products.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'));

  const explicitStores = stores.map((store) => {
    const name = normalize(store.name);
    const code = normalize(store.code);
    const explicitName = name.length > 3 && containsPhrase(query, name);
    const explicitCode = code && containsPhrase(query, code);
    const cueName = name.split(' ').length === 1 && new RegExp(`\\b(local|tienda|en|de|visitar|conocer) ${name}\\b`).test(query);
    return {
      store,
      explicit: explicitName || explicitCode || cueName,
      score: (explicitName || explicitCode || cueName ? 20 : 0)
        + overlapScore(queryTokens, `${store.name} ${store.code}`, 5)
        + overlapScore(queryTokens, store.category, 2)
        + overlapScore(queryTokens, `${store.brief} ${store.faq.map((item) => `${item.question} ${item.answer}`).join(' ')}`, 1),
    };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.store.name.localeCompare(b.store.name, 'es'));

  const productHits = stores.flatMap((store) => store.products.map((product) => {
    const productName = normalize(product.name);
    const exactName = productName.length > 3 && containsPhrase(query, productName);
    const score = (exactName ? 30 : 0)
      + overlapScore(queryTokens, product.name, 6)
      + overlapScore(queryTokens, product.description, 2);
    return { store, product, score, exactName };
  })).filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name, 'es'));
  const faqHits = stores.flatMap((store) => store.faq.map((faq) => {
    const questionMatch = normalize(faq.question);
    const exactQuestion = questionMatch.length > 3 && containsPhrase(query, questionMatch);
    const score = (exactQuestion ? 20 : 0)
      + overlapScore(queryTokens, faq.question, 4)
      + overlapScore(queryTokens, faq.answer, 1);
    return { store, faq, score, exactQuestion };
  })).filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.store.name.localeCompare(b.store.name, 'es'));

  const directoryQuery = DIRECTORY_QUERY.test(query);
  const productQuery = PRODUCT_QUERY.test(query);
  const includeProducts = productQuery || productHits.length > 0;
  const explicitStore = explicitStores.find((item) => item.explicit)?.store || null;
  let selectedStores;
  if (directoryQuery && !productQuery) {
    selectedStores = stores.slice().sort((a, b) => a.floor.localeCompare(b.floor, 'es') || a.code.localeCompare(b.code, 'es'));
  } else if (explicitStore) {
    selectedStores = [explicitStore];
    for (const hit of productHits) {
      if (hit.store.id !== explicitStore.id || selectedStores.length >= 6) continue;
      if (!selectedStores.includes(hit.store)) selectedStores.push(hit.store);
    }
  } else if (productHits.length) {
    selectedStores = [...new Map(productHits.slice(0, 12).map((hit) => [hit.store.id, hit.store])).values()];
  } else {
    selectedStores = explicitStores.slice(0, 8).map((item) => item.store);
  }

  if (productQuery && !explicitStore && !productHits.length) {
    selectedStores = explicitStores.length
      ? explicitStores.slice(0, 12).map((item) => item.store)
      : stores.slice().sort((a, b) => a.code.localeCompare(b.code, 'es'));
  }

  const selectedStoreIds = new Set(selectedStores.map((store) => store.id));
  let selectedProducts = [];
  if (explicitStore && productQuery && !productHits.some((hit) => hit.store.id === explicitStore.id)) {
    selectedProducts = explicitStore.products.slice(0, 36).map((product) => ({ store: explicitStore, product }));
  } else if (explicitStore && productQuery) {
    const exactLocalHits = productHits.filter((hit) => hit.store.id === explicitStore.id);
    selectedProducts = exactLocalHits.length
      ? exactLocalHits.slice(0, 24).map((hit) => ({ store: hit.store, product: hit.product }))
      : explicitStore.products.slice(0, 24).map((product) => ({ store: explicitStore, product }));
  } else if (productHits.length) {
    selectedProducts = productHits.slice(0, 18).map((hit) => ({ store: hit.store, product: hit.product }));
  } else if (productQuery) {
    selectedProducts = selectedStores.flatMap((store) => store.products.slice(0, 2).map((product) => ({ store, product }))).slice(0, 40);
  }

  const storeLines = selectedStores.slice(0, directoryQuery ? 100 : 10).map((store) => {
    const details = [
      `${store.name || 'Local sin nombre'}${store.code ? ` (${store.code})` : ''}`,
      store.category && `Rubro: ${store.category}`,
      store.floor && `Ubicación: ${store.floor}`,
      store.address && `Dirección/retiro: ${store.address}`,
      store.whatsapp && `WhatsApp público: ${store.whatsapp}`,
      store.phone && `Teléfono público: ${store.phone}`,
      store.social && `Red social pública: ${store.social}`,
      store.maps && `Mapa: ${store.maps}`,
      store.shipping.length && `Despacho activo: ${store.shipping.join('; ')}`,
      store.brief && `Información pública del local: ${store.brief}`,
      ...store.faq.slice(0, 4).map((item) => `FAQ pública: ${item.question} | ${item.answer}`),
    ].filter(Boolean);
    return `- ${details.join(' | ')}`;
  });
  const productLines = selectedProducts.map(({ store, product }) =>
    `- ${product.name} | Local: ${store.name} (${store.code || 'sin código'}) | Precio publicado: ${product.price || 'no informado'}${product.description ? ` | Descripción: ${product.description}` : ''}`
  );

  let context = [
    `Directorio relevante (${stores.length} locales registrados):`,
    ...(storeLines.length ? storeLines : ['- No hay locales coincidentes en los datos públicos.']),
    ...(includeProducts ? ['', 'Productos relevantes del catálogo:', ...(productLines.length ? productLines : ['- No se encontró una coincidencia clara en el catálogo cargado.'])] : []),
  ].join('\n').slice(0, MAX_CONTEXT_CHARS);

  const exactProduct = productHits.find((hit) => hit.exactName);
  const exactFaq = faqHits.find((hit) => hit.exactQuestion || hit.score >= 8);
  const productStores = new Set(productHits.slice(0, 6).map((hit) => hit.store.id));
  const categoryStores = explicitStores
    .map((item) => item.store)
    .filter((store) => !productStores.has(store.id))
    .slice(0, 4);
  const productSuggestions = productHits.slice(0, 6).map(({ store, product }) =>
    `${product.name}${product.price ? ` (${product.price})` : ''}, en ${store.name}`
  );
  const categorySuggestions = categoryStores.map((store) =>
    `${store.name}${store.category ? ` (${store.category})` : ''}${store.floor ? `, ${store.floor}` : ''}`
  );
  const catalogDirectoryAnswer = directoryQuery && productQuery && (productSuggestions.length || categorySuggestions.length)
    ? `Para esa búsqueda, encontré ${[...productSuggestions, ...categorySuggestions].join('; ')}. Puedes abrir cada catálogo para ver más opciones.`
    : null;
  const giftStores = GIFT_QUERY.test(query)
    ? stores.filter((store) => GIFTABLE_CATEGORY.test(normalize(`${store.name} ${store.category}`))).slice(0, 4)
    : [];
  const giftProducts = productHits.length
    ? productHits.slice(0, 3).map(({ store, product }) => ({ store, product }))
    : giftStores.flatMap((store) => store.products.slice(0, 1).map((product) => ({ store, product }))).slice(0, 3);
  const giftAnswer = giftProducts.length
    ? `¡Qué lindo detalle! Puedes revisar ${giftProducts.map(({ store, product }) => `${product.name}${product.price ? ` (${product.price})` : ''}, en ${store.name}`).join('; ')}. Si me dices tu presupuesto o qué estilo le gusta, afino la recomendación.`
    : giftStores.length
      ? `¡Qué lindo detalle! Te sugiero mirar ${giftStores.map((store) => `${store.name}${store.category ? ` (${store.category})` : ''}`).join('; ')}. Si me dices tu presupuesto o qué estilo le gusta, afino la recomendación.`
      : null;
  const directAnswer = exactProduct
    ? `${exactProduct.product.name} está en ${exactProduct.store.name}${exactProduct.product.price ? ` y cuesta ${exactProduct.product.price}` : '; su precio no está publicado'}.${exactProduct.product.description ? ` ${exactProduct.product.description}` : ''}`
    : exactFaq
    ? `En ${exactFaq.store.name}: ${exactFaq.faq.answer}`
    : catalogDirectoryAnswer || giftAnswer;

  let fallbackAnswer;
  if (productHits.length) {
    const options = productHits.slice(0, 3).map(({ store, product }) =>
      `${product.name}${product.price ? ` (${product.price})` : ''}, en ${store.name}`
    );
    fallbackAnswer = `Encontré estas opciones: ${options.join('; ')}. Si buscas otra característica, dime cuál y te oriento.`;
  } else if (directoryQuery && stores.length) {
    const names = stores.slice(0, 12).map((store) => `${store.name}${store.floor ? `, ${store.floor}` : ''}`);
    fallbackAnswer = `Puedo orientarte con estos locales: ${names.join('; ')}${stores.length > names.length ? '; y hay más opciones en el directorio' : ''}.`;
  } else if (faqHits[0]?.score >= 4) {
    fallbackAnswer = `En ${faqHits[0].store.name}: ${faqHits[0].faq.answer}`;
  } else if (explicitStore) {
    const samples = explicitStore.products.slice(0, 4).map((product) => `${product.name}${product.price ? ` (${product.price})` : ''}`);
    fallbackAnswer = `${explicitStore.name}${explicitStore.category ? ` es un local de ${explicitStore.category}` : ''}${explicitStore.floor ? ` ubicado en ${explicitStore.floor}` : ''}${explicitStore.brief ? `. ${explicitStore.brief}` : ''}${samples.length ? `. En su catálogo aparecen ${samples.join(', ')}` : ''}.`;
  } else {
    fallbackAnswer = 'No encontré una coincidencia clara en la información pública cargada. Prueba con otro nombre de producto o dime qué tipo de artículo buscas.';
  }

  return {
    context,
    directAnswer,
    fallbackAnswer,
    isCatalogQuery: directoryQuery || productQuery || Boolean(explicitStore) || productHits.length > 0,
    matchedProductCount: productHits.length,
    selectedStoreCount: selectedStoreIds.size,
  };
}
