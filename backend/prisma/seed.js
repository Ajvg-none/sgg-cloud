// backend/prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// 1. Configurar el pool de PostgreSQL nativo
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 2. Crear el adapter de Prisma
const adapter = new PrismaPg(pool);

// 3. Instanciar PrismaClient pasándole el adapter
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...');

  // 1. Crear Laboratorio
  const lab = await prisma.lab.upsert({
    where: { apiKey: 'lab-test-api-key-123' },
    update: {},
    create: {
      name: 'Laboratorio Central',
      ipAgente: '192.168.1.100',
      puertoAgente: '3001',
      rutaVcaRed: '\\\\192.168.1.100\\Lensware\\VCA',
      apiKey: 'lab-test-api-key-123',
      active: true,
    },
  });
  console.log('✅ Laboratorio creado:', lab.name);

  // 2. Crear Tienda
  const store = await prisma.store.upsert({
    where: { accn: '001' },
    update: {},
    create: {
      name: 'Óptica Centro',
      accn: '001',
      labId: lab.id,
      active: true,
    },
  });
  console.log('✅ Tienda creada:', store.name);

  // 3. Crear Usuario Admin
  const adminPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      role: 'ADMIN',
      active: true,
    },
  });
  console.log('✅ Usuario Admin creado: admin');

  // 4. Crear Usuario Tienda
  const storePassword = await bcrypt.hash('tienda123', 10);
  await prisma.user.upsert({
    where: { username: 'tienda' },
    update: {},
    create: {
      username: 'tienda001',
      password: storePassword,
      role: 'TIENDA',
      storeId: store.id,
      active: true,
    },
  });
  console.log('✅ Usuario Tienda creado: tienda001');

  console.log('🎉 Seed completado exitosamente!');
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end(); // Importante: cerrar también el pool de pg
  });