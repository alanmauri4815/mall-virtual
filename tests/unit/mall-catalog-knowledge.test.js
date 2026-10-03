const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const modulePath = pathToFileURL(path.join(
  __dirname,
  '..',
  '..',
  'supabase',
  'functions',
  'store-attendant',
  'mall-catalog-knowledge.mjs'
));

(async () => {
  const { buildMallCatalogKnowledge, sanitizePublicTraining } = await import(modulePath.href);
  const edgeSource = fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'functions', 'store-attendant', 'index.ts'), 'utf8');
  const assistantMigration = fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'mall_assistant_private_instructions_20261003.sql'), 'utf8');
  const assistantSource = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'mall', 'mall-store-assistant.js'), 'utf8');
  const htmlSource = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
  const records = {
    stores: [
      {
        id: 'store-1',
        local_code: 'S-101',
        name: 'Luna Moda',
        category: 'Vestuario y accesorios',
        whatsapp: '+56911112222',
        address: 'Local 101',
        contact_email: 'privado@example.com',
        owner_id: 'owner-secret',
        monthly_amount: 999999,
      },
      {
        id: 'store-2',
        local_code: 'E-201',
        name: 'Casa Nube',
        category: 'Decoración',
        telegram_chat_id: 'telegram-secret',
      },
    ],
    products: [
      {
        local_code: 'S-101',
        name: 'Abrigo Italiano',
        price: '$26.000',
        description: 'Abrigo de invierno, forrado y elegante para ocasiones especiales.',
        sort_order: 1,
        created_at: 'private-timestamp',
      },
      {
        local_code: 'E-201',
        name: 'Jarrón de cerámica',
        price: '$12.000',
        description: 'Pieza artesanal para decorar el hogar.',
        sort_order: 1,
      },
      {
        local_code: 'E-201',
        name: 'Collar artesanal de piedra',
        price: '$8.000',
        description: 'Collar hecho a mano con piedras naturales.',
        sort_order: 2,
      },
    ],
    locations: [
      { store_id: 'store-1', floor_label: '1', is_primary: true },
      { store_id: 'store-2', floor_label: '2', is_primary: true },
    ],
    shippingRates: [
      { store_id: 'store-1', commune: 'Providencia', shipping_cost: 2500, is_active: true },
      { store_id: 'store-1', commune: 'Las Condes', shipping_cost: 3000, is_active: false },
    ],
    profiles: [
      {
        store_id: 'store-1',
        store_brief: 'Tienda especializada en prendas elegantes para toda ocasión.',
        faq: [
          { question: '¿Hacen cambios?', answer: 'Sí, se aceptan cambios dentro de diez días.' },
          { question: 'Dato reservado', answer: 'El arriendo mensual es $999999.' },
          { question: 'Contacto', answer: 'Escribe a privada@example.com o llama al +56999998888.' },
        ],
      },
    ],
  };

  const semanticMatch = buildMallCatalogKnowledge('Busco un abrigo elegante para regalo', records);
  assert.match(semanticMatch.context, /Abrigo Italiano/);
  assert.match(semanticMatch.context, /Luna Moda/);
  assert.match(semanticMatch.context, /segundo piso|primer piso/);
  assert.match(semanticMatch.context, /Providencia: \$2500/);
  assert.match(semanticMatch.context, /prendas elegantes/);
  assert.match(semanticMatch.context, /se aceptan cambios/);
  assert.doesNotMatch(semanticMatch.context, /Las Condes: \$3000/);
  assert.equal(semanticMatch.isCatalogQuery, true);
  const giftSuggestion = buildMallCatalogKnowledge('Quiero comprar algo lindo para mi novia, ¿qué me recomiendas?', records);
  assert.match(giftSuggestion.directAnswer, /Abrigo Italiano/);
  assert.match(giftSuggestion.directAnswer, /Luna Moda/);
  assert.match(giftSuggestion.directAnswer, /\$26\.000/);
  const jewelrySearch = buildMallCatalogKnowledge('¿Qué locales venden joyas o artesanía tipo collares o aros?', records);
  assert.match(jewelrySearch.directAnswer, /Casa Nube/);
  assert.match(jewelrySearch.directAnswer, /Collar artesanal de piedra/);
  assert.doesNotMatch(jewelrySearch.directAnswer, /Jarrón de cerámica/);
  assert.match(jewelrySearch.directAnswer, /Luna Moda/);
  assert.doesNotMatch(jewelrySearch.directAnswer, /BIENVENIDO AL MALL CREACIONES/);
  assert.match(edgeSource, /buildMallCatalogKnowledge\(question, mallCatalog\)/);
  assert.match(edgeSource, /getCachedMallCatalog\(admin, mallId\)/);
  assert.match(edgeSource, /select\("id, local_code, name, category, whatsapp, contact_phone, social_url, address, maps_url"\)/);
  assert.match(edgeSource, /select\("local_code, name, price, description, sort_order"\)[\s\S]*?eq\("mall_id", mallId\)/);
  assert.match(edgeSource, /select\("store_id, store_brief, faq"\)[\s\S]*?eq\("enabled", true\)/);
  assert.match(edgeSource, /store_shipping_rates[\s\S]*?eq\("is_active", true\)/);
  assert.match(edgeSource, /physical_spaces[\s\S]*?select\("physical_space_id, floor_label"\)/);
  assert.match(edgeSource, /knowledgeFingerprint/);
  assert.match(edgeSource, /sanitizePublicTraining\(settings\.mall_brief, 4000\)/);
  assert.match(edgeSource, /Prioriza las coincidencias concretas de locales, rubros y productos del catálogo/);
  assert.match(edgeSource, /mall_assistant_instructions/);
  assert.match(edgeSource, /persuasivo sin presionar/);
  assert.match(edgeSource, /instructions: mallInstructions/);
  assert.match(assistantSource, /admin-mall-assistant-instructions/);
  assert.match(assistantSource, /from\('mall_assistant_instructions'\)/);
  assert.match(htmlSource, /id="admin-mall-assistant-instructions"/);
  assert.match(assistantMigration, /is_mall_admin_for\(mall_id\)/);
  assert.match(assistantMigration, /to authenticated\s+using/);
  assert.doesNotMatch(assistantMigration, /to anon\s+using/);
  assert.match(assistantSource, /if \(\/\\b\(local\|locales\|tienda\|tiendas\|comercio\|comercios\|directorio\|piso\|producto\|productos\|catalogo/);
  assert.match(assistantSource, /Estoy consultando los catálogos del mall/);

  const exactMatch = buildMallCatalogKnowledge('¿Cuánto cuesta el Abrigo Italiano?', records);
  assert.match(exactMatch.directAnswer, /\$26\.000/);
  assert.match(exactMatch.directAnswer, /Luna Moda/);
  const storeFaq = buildMallCatalogKnowledge('¿Hacen cambios en Luna Moda?', records);
  assert.match(storeFaq.directAnswer, /se aceptan cambios/);
  assert.equal(sanitizePublicTraining('El arriendo cuesta $900.000'), '');
  assert.doesNotMatch(sanitizePublicTraining('Contacta a persona@example.com'), /persona@example\.com/);

  const directory = buildMallCatalogKnowledge('¿Qué locales hay en el mall?', records);
  assert.match(directory.context, /Luna Moda/);
  assert.match(directory.context, /Casa Nube/);

  const publicContext = `${semanticMatch.context}\n${exactMatch.directAnswer}`;
  for (const privateValue of ['privado@example.com', 'owner-secret', 'arriendo mensual', 'private-timestamp', 'privada@example.com', '+56999998888']) {
    assert.doesNotMatch(publicContext, new RegExp(privateValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  console.log('Mall catalog retrieval finds exact and descriptive product matches while omitting private store fields.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
