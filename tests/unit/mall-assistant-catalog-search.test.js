const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const searchMallCatalog = require(path.join(
  __dirname,
  '..',
  '..',
  'js',
  'mall',
  'mall-assistant-catalog-search.js'
));

const stores = [
  { id: 'store-1', local_code: 'S-101', name: 'Luna Moda', category: 'Vestuario y accesorios' },
  { id: 'store-2', local_code: 'E-201', name: 'Casa Nube', category: 'Decoración' },
];
const products = [
  { store_id: 'store-1', name: 'Abrigo Italiano', price: '$26.000', description: 'Abrigo elegante para el invierno.' },
  { store_id: 'store-1', name: 'Aros de acero', price: '$14.500', description: 'Aros livianos para uso diario.' },
  { local_code: 'E-201', name: 'Jarrón de cerámica', price: '$12.000', description: 'Pieza artesanal para decorar el hogar.' },
  { local_code: 'E-201', name: 'Collar artesanal de piedra', price: '$8.000', description: 'Collar hecho a mano con piedras naturales.' },
];

const budgetAnswer = searchMallCatalog('Quiero comprar un regalo para un amigo que no pase de los 15000 pesos', stores, products);
assert.match(budgetAnswer, /Aros de acero/);
assert.match(budgetAnswer, /Collar artesanal de piedra/);
assert.doesNotMatch(budgetAnswer, /Abrigo Italiano/);
assert.match(budgetAnswer, /15\.000/);
const formattedBudgetAnswer = searchMallCatalog('Busco un regalo que no supere los $15.000', stores, products);
assert.match(formattedBudgetAnswer, /Aros de acero/);
assert.doesNotMatch(formattedBudgetAnswer, /Abrigo Italiano/);
const implicitBudgetAnswer = searchMallCatalog('Quiero un regalo para mi amigo por $15.000', stores, products);
assert.match(implicitBudgetAnswer, /Aros de acero/);
assert.doesNotMatch(implicitBudgetAnswer, /Abrigo Italiano/);

const jewelryAnswer = searchMallCatalog('¿Qué locales venden joyas o artesanía tipo collares o aros?', stores, products);
assert.match(jewelryAnswer, /Collar artesanal de piedra/);
assert.match(jewelryAnswer, /Aros de acero/);
assert.doesNotMatch(jewelryAnswer, /Jarrón de cerámica/);
assert.match(jewelryAnswer, /Luna Moda/);

assert.equal(searchMallCatalog('¿Qué locales hay en el mall?', stores, products), null);
assert.match(searchMallCatalog('¿Qué productos cuestan menos de $5.000?', stores, products), /No encontré productos/);

const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
assert.ok(html.indexOf('mall-assistant-catalog-search.js') < html.indexOf('mall-store-assistant.js'));
assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'mall', 'mall-store-assistant.js'), 'utf8'), /mallCatalogRequests\.getData\(\)/);

console.log('Mall assistant searches published products locally and respects visitors\' budgets.');
