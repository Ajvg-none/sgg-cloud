require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function clean() {
  console.log('🔍 Buscando garantías de prueba con número corto (ej: "335-1")...\n');
  
  const selectRes = await pool.query(`
    SELECT id, order_number, revision 
    FROM warranties 
    WHERE order_number LIKE '%-%' 
      AND order_number NOT LIKE '1132%'
  `);
  
  console.log('Filas encontradas para eliminar:');
  console.log(selectRes.rows);

  if (selectRes.rows.length > 0) {
    console.log('\n🗑️ Eliminando filas corruptas...');
    const deleteRes = await pool.query(`
      DELETE FROM warranties 
      WHERE order_number LIKE '%-%' 
        AND order_number NOT LIKE '1132%'
    `);
    console.log(`✅ Eliminadas ${deleteRes.rowCount} fila(s).`);
  } else {
    console.log('✅ No hay filas corruptas que limpiar.');
  }
  
  pool.end();
}

clean().catch(e => { 
  console.error('❌ Error:', e.message); 
  pool.end(); 
});