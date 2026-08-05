// list-warehouses.js
// Script de utilidad: lista todos los warehouses (tiendas) de GesVision para el usuario autenticado.
// Uso: node list-warehouses.js  (desde la raíz del proyecto)

// 1. Cargar el entorno del backend ANTES de requerir el cliente (el .env real vive en backend/.env)
require('dotenv').config({ path: require('path').join(__dirname, 'backend', '.env') });

const gesvision = require('./backend/src/legacy/gesvisionApi');

const PAGE_SIZE = 50;

async function main() {
  const all = [];
  let skip = 0;

  while (true) {
    const batch = await gesvision.request('GET', `/warehouses?skip=${skip}&limit=${PAGE_SIZE}`);
    const items = Array.isArray(batch) ? batch : (batch && batch.data) || [];

    all.push(...items);

    if (items.length < PAGE_SIZE) break; // página parcial o vacía → no hay más
    skip += PAGE_SIZE;
  }

  const table = all.map((w) => ({
    id: w.id,
    code: w.code,
    name: w.name,
    alias: w.alias,
  }));

  console.table(table);
  console.log(`Total de warehouses encontrados: ${all.length}`);
}

main().catch((err) => {
  console.error('Error al listar warehouses:', err.response?.data || err.message || err);
  process.exit(1);
});
