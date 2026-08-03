require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const LAB_ID = 'cmsaiyakl0000n0uqpbwehnw1';
const CSV = path.join(__dirname, '..', '..', 'tiendas.csv');

function parseRows(raw) {
  const items = [];
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = line.split(/\t|,/).map((f) => f.trim().replace(/^"|"$/g, '').trim());
    if (fields.length < 2) continue;
    const [name, accn] = fields;
    if (!name || name.toLowerCase() === 'nombre') continue;
    items.push({ name, accn });
  }
  return items;
}

(async () => {
  const client = await pool.connect();
  try {
    const raw = fs.readFileSync(CSV, 'utf8');
    const items = parseRows(raw);
    console.log(`Filas parseadas: ${items.length}`);

    let inserted = 0;
    let skippedEmpty = 0;
    let skippedInvalid = 0;
    let skippedDup = 0;
    const seen = new Set();
    const dupList = [];

    await client.query('BEGIN');
    for (const item of items) {
      if (!/^\d{3}$/.test(item.accn)) {
        skippedEmpty++;
        console.log(`  SKIP (accn inválido): ${item.name} -> "${item.accn}"`);
        continue;
      }
      if (seen.has(item.accn)) {
        skippedDup++;
        dupList.push(`${item.name} (${item.accn})`);
        console.log(`  SKIP (accn duplicado): ${item.name} (${item.accn})`);
        continue;
      }
      seen.add(item.accn);
      await client.query(
        'INSERT INTO stores (id, name, accn, lab_id, active, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, true, now(), now())',
        [item.name, item.accn, LAB_ID]
      );
      inserted++;
    }
    await client.query('COMMIT');

    console.log(`\n✔ Insertadas: ${inserted}`);
    console.log(`  Omitidas (accn vacío/inválido): ${skippedEmpty}`);
    console.log(`  Omitidas (accn duplicado): ${skippedDup}${dupList.length ? ' -> ' + dupList.join('; ') : ''}`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('ERR (rollback):', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
