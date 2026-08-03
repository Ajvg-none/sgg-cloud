require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  try {
    const c = await p.query('SELECT COUNT(*) AS n FROM stores');
    console.log('total stores:', c.rows[0].n);
    const d = await p.query('SELECT accn, COUNT(*) AS n FROM stores GROUP BY accn HAVING COUNT(*) > 1');
    console.log('accn duplicados:', d.rows.length);
    const bad = await p.query("SELECT name, accn FROM stores WHERE accn !~ '^[0-9]{3}$' OR name = ''");
    console.log('filas invalidas:', bad.rows.length);
    const sample = await p.query('SELECT name, accn, lab_id FROM stores ORDER BY name LIMIT 5');
    sample.rows.forEach(x => console.log('  ', x.name, '|', x.accn, '|', x.lab_id.slice(0, 8)));
    const pend = await p.query("SELECT name, accn FROM stores WHERE name ILIKE '%FORUM SAN BERNARDINO%' OR name ILIKE '%Sole Tolon%' OR name ILIKE '%DES Metropolis%' OR name ILIKE '%El Tolon%'");
    console.log('casos pendientes en BD:');
    pend.rows.forEach(x => console.log('  ', x.name, '|', x.accn));
  } catch (e) {
    console.error('ERR:', e.message);
  } finally {
    p.end();
  }
})();
