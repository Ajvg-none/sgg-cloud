require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function dump(table, file) {
  const res = await pool.query(`SELECT * FROM ${table} ORDER BY 1`);
  fs.writeFileSync(file, JSON.stringify(res.rows, null, 2));
  console.log(`✔ ${table}: ${res.rows.length} filas → ${path.basename(file)}`);
}

(async () => {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = __dirname;
  try {
    await dump('stores', path.join(dir, `stores_${ts}.json`));
    await dump('warranties', path.join(dir, `warranties_${ts}.json`));
    await dump('users', path.join(dir, `users_${ts}.json`));
    console.log('Backup completado.');
  } catch (e) {
    console.error('ERR:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
