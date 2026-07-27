// backend/src/controllers/storeController.js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const syncService = require('../services/syncService');
const logger = require('../config/logger');

// Configurar Prisma con driver adapter (Prisma v7)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Obtiene y sincroniza una orden de GesVision.
 */
const getOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;

    if (!orderNumber) {
      return res.status(400).json({ error: 'El número de orden es obligatorio.' });
    }

    logger.info(`📦 Tienda ${req.user.storeId} solicitando orden ${orderNumber}`);
    const orderData = await syncService.syncOrder(orderNumber);

    return res.status(200).json({
      message: 'Orden sincronizada exitosamente.',
      order: orderData
    });
  } catch (error) {
    logger.error(`❌ Error en getOrder: ${error.message}`);
    return res.status(500).json({ 
      error: 'Error al sincronizar la orden.',
      details: error.message
    });
  }
};

/**
 * Crea una nueva garantía con los datos editados por la tienda.
 * (Tarea 4.1)
 */
const createWarranty = async (req, res) => {
  try {
    const { orderNumber, orderData, warrantyType, storeObservations } = req.body;
    const storeId = req.user.storeId;

    // 1. Validar datos básicos del body
    if (!orderNumber || !orderData) {
      return res.status(400).json({ error: 'orderNumber y orderData son obligatorios.' });
    }

    if (!warrantyType) {
      return res.status(400).json({ error: 'El tipo de garantía es obligatorio.' });
    }

    if (storeObservations && storeObservations.length > 300) {
      return res.status(400).json({ error: 'Las observaciones no pueden exceder 300 caracteres.' });
    }

    // 2. Obtener la tienda para validar ACCN y obtener labId
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, labId: true, accn: true, name: true }
    });

    if (!store) {
      return res.status(404).json({ error: 'Tienda no encontrada.' });
    }

    // Validar que el ACCN exista y sea exactamente 3 dígitos numéricos
    if (!store.accn || !/^\d{3}$/.test(store.accn)) {
      return res.status(400).json({ 
        error: 'La tienda debe tener un código ACCN de 3 dígitos numéricos configurado para crear garantías.' 
      });
    }

    if (!store.labId) {
      return res.status(400).json({ 
        error: 'La tienda no tiene un laboratorio asignado.' 
      });
    }

    // 4. Crear el registro en Warranty (RF-02.4 y RF-04.1)
    const warranty = await prisma.warranty.create({
      data: {
        storeId: store.id,
        labId: store.labId,
        orderNumber: String(orderNumber),
        orderData: orderData,
        warrantyType,
        storeObservations: storeObservations || null,
        status: 'PENDING'
      }
    });

    logger.info(`✅ Garantía creada: ${warranty.id} para orden ${orderNumber} por tienda ${store.name}`);

    return res.status(201).json({
      message: 'Garantía creada exitosamente y encolada para el laboratorio.',
      warranty: {
        id: warranty.id,
        orderNumber: warranty.orderNumber,
        status: warranty.status,
        createdAt: warranty.createdAt
      }
    });

  } catch (error) {
    logger.error(`❌ Error en createWarranty: ${error.message}`);
    return res.status(500).json({ error: 'Error interno del servidor al crear la garantía.' });
    }
};


// ============================================================
// FASE 5: LISTADO HISTÓRICO PARA TIENDAS (RF-03)
// ============================================================

/**
 * GET /api/store/warranties
 * Devuelve todas las garantías de la tienda autenticada.
 * Política de acceso: SOLO ve las suyas (RF-03.3).
 */
const getMyWarranties = async (req, res) => {
  try {
    const storeId = req.user.storeId || req.user.store?.id;

    if (!storeId) {
      return res.status(400).json({
        error: 'No se pudo identificar la tienda del usuario autenticado.'
      });
    }

    const warranties = await prisma.warranty.findMany({
      where: { storeId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        orderData: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ warranties });
  } catch (error) {
    logger.error(`[getMyWarranties] Error: ${error.message}`, {
      userId: req.user.id,
    });
    return res.status(500).json({ error: 'Error al obtener las garantías.' });
  }
};

/**
 * GET /api/store/warranties/:id
 * Devuelve el detalle de una garantía específica.
 * Verifica que la garantía pertenezca a la tienda autenticada (RF-03.3).
 */
const getWarrantyDetail = async (req, res) => {
  try {
    const storeId = req.user.storeId || req.user.store?.id;
    const { id } = req.params;

    if (!storeId) {
      return res.status(400).json({
        error: 'No se pudo identificar la tienda del usuario autenticado.'
      });
    }

    const warranty = await prisma.warranty.findFirst({
      where: {
        id,
        storeId, // ← Filtro forzado por backend (RF-03.3)
      },
    });

    if (!warranty) {
      return res.status(404).json({
        error: 'Garantía no encontrada o no pertenece a tu tienda.',
      });
    }

    return res.status(200).json({ warranty });
  } catch (error) {
    logger.error(`[getWarrantyDetail] Error: ${error.message}`, {
      userId: req.user.id,
      warrantyId: req.params.id,
    });
    return res.status(500).json({ error: 'Error al obtener el detalle de la garantía.' });
  }
};

module.exports = { getOrder, createWarranty, getMyWarranties,getWarrantyDetail,  };