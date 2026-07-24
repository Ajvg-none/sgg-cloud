/**
 * ⚠️ ADVERTENCIA: DEUDA TÉCNICA TEMPORAL
 * 
 * Este archivo existe ÚNICAMENTE para que los archivos legacy copiados 
 * (orderSync.js, lensware.js) puedan cargarse en memoria sin crashear 
 * durante la Fase 0 y Fase 1.
 * 
 * ESTAS FUNCIONES NO SE USARÁN EN PRODUCCIÓN.
 * En la FASE 3, toda la lógica de base de datos se migrará a Prisma 
 * y este archivo será ELIMINADO por completo.
 */

const logger = require('../config/logger');

// Mocks de modelos del sistema viejo
const Tienda = {
  getAccnByTiendaId: async (id) => {
    logger.warn(`[MOCK] Tienda.getAccnByTiendaId llamado para ID: ${id}. Retornando '000' temporalmente.`);
    return '000'; // Se reemplazará por Prisma en Fase 3
  },
  findById: async (id) => ({ id, nombre: 'Tienda Mock', laboratorio_asignado_id: 'lab-mock' }),
  create: async (id, name) => ({ id, nombre: name, laboratorio_asignado_id: null })
};

const Laboratorio = {
  findById: async (id) => ({ id, nombre: 'Lab Mock', impresion_activa: true })
};

const OrdenTrabajo = {
  upsert: async (data, client) => {
    logger.warn('[MOCK] OrdenTrabajo.upsert llamado. No persiste en BD.');
    return { id: 'mock-order-id', ...data };
  }
};

const OrdenItem = {
  createMany: async (client, orderId, items) => {
    logger.warn(`[MOCK] OrdenItem.createMany llamado para orden ${orderId}. No persiste en BD.`);
  }
};

// Mock del pool de base de datos (pg)
const mockPool = {
  connect: async () => ({
    query: async () => ({ rows: [] }),
    release: () => {}
  })
};

// Mock del cache de productos
const productCache = {
  cache: new Map(),
  get: (key) => productCache.cache.get(key) || null,
  set: (key, value) => productCache.cache.set(key, value)
};

module.exports = {
  Tienda,
  Laboratorio,
  OrdenTrabajo,
  OrdenItem,
  pool: mockPool,
  productCache: { productCache }
};