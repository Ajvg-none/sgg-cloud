// backend/prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando seed...\n');

  // === LABORATORIOS ===
  const labCentral = await prisma.lab.upsert({
    where: { apiKey: 'sk-lab-central-abc123def456' },
    update: {},
    create: {
      name: 'Laboratorio Central',
      ipAgente: '192.168.1.100',
      puertoAgente: '3001',
      rutaVcaRed: '\\\\192.168.1.100\\Lensware\\VCA',
      apiKey: 'sk-lab-central-abc123def456',
      active: true,
    },
  });
  console.log('✅ Lab:', labCentral.name);

  const labNorte = await prisma.lab.upsert({
    where: { apiKey: 'sk-lab-norte-ghi789jkl012' },
    update: {},
    create: {
      name: 'Laboratorio Norte',
      ipAgente: '192.168.2.100',
      puertoAgente: '3001',
      rutaVcaRed: '\\\\192.168.2.100\\Lensware\\VCA',
      apiKey: 'sk-lab-norte-ghi789jkl012',
      active: true,
    },
  });
  console.log('✅ Lab:', labNorte.name);

  // === TIENDAS ===
  const createStoreWithUser = async (name, accn, lab, username, password) => {
    const store = await prisma.store.upsert({
      where: { accn },
      update: { labId: lab.id },
      create: { name, accn, labId: lab.id, active: true },
    });

    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { username },
      update: { password: hashed, role: 'TIENDA', storeId: store.id, labId: null, active: true },
      create: { username, password: hashed, role: 'TIENDA', storeId: store.id, active: true },
    });
    console.log(`✅ Tienda: ${name} (${accn}) → ${username} / ${password}`);
    return store;
  };

  await createStoreWithUser('Óptica Centro', '001', labCentral, 'tienda001', 'tienda123');
  await createStoreWithUser('Óptica Norte', '002', labNorte, 'tienda002', 'tienda123');
  await createStoreWithUser('Óptica Sur', '003', labCentral, 'tienda003', 'tienda123');

  // === USUARIOS LABORATORIO ===
  const createLabUser = async (username, password, lab) => {
    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { username },
      update: { password: hashed, role: 'LABORATORIO', labId: lab.id, storeId: null, active: true },
      create: { username, password: hashed, role: 'LABORATORIO', labId: lab.id, active: true },
    });
    console.log(`✅ Lab User: ${username} / ${password} → ${lab.name}`);
  };

  await createLabUser('lab_central', 'lab123', labCentral);
  await createLabUser('lab_norte', 'lab123', labNorte);

  // === ADMIN ===
  const adminHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', password: adminHash, role: 'ADMIN', active: true },
  });
  console.log('✅ Admin: admin / admin123');

  console.log('\n🎉 Seed completado!');
}

main()
  .catch((e) => {
    console.error('❌ Error seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
