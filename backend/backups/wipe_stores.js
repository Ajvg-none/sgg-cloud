require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const w = await client.query('DELETE FROM warranties');
    const u = await client.query("DELETE FROM users WHERE role = 'TIENDA'");
    const s = await client.query('DELETE FROM stores');
    await client.query('COMMIT');
    console.log(`✔ warranties borradas: ${w.rowCount}`);
    console.log(`✔ usuarios TIENDA borrados: ${u.rowCount}`);
    console.log(`✔ stores borrados: ${s.rowCount}`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('ERR (rollback aplicado):', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
