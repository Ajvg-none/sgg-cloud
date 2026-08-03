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
 * Calcula automáticamente el sufijo de revisión (ej: "113200000336-1")
 * y lo inyecta en orderData para que el agente lo use en VCA y Tickets.
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
    if (!store.accn || !/^\d{3}$/.test(store.accn)) {
      return res.status(400).json({
        error: 'La tienda debe tener un código ACCN de 3 dígitos numéricos configurado para crear garantías.'
      });
    }
    if (!store.labId) {
      return res.status(400).json({ error: 'La tienda no tiene un laboratorio asignado.' });
    }

    // 3. Lógica de Revisión con Reintento por Concurrencia
    const MAX_RETRIES = 3;
    let attempts = 0;
    let createdWarranty = null;

    // ✅ FIX DEFINITIVO: La base es codigo_completo (que tiene el número LARGO de GesVision)
    const baseOrderNumber = String(orderData.codigo_completo || orderData.orden_numero || orderNumber).split('-')[0];

    while (attempts < MAX_RETRIES) {
      try {
        createdWarranty = await prisma.$transaction(async (tx) => {
          // a) Buscar TODAS las garantías para esta orden base
          const existingWarranties = await tx.warranty.findMany({
            where: {
              OR: [
                { orderNumber: baseOrderNumber },
                { orderNumber: { startsWith: baseOrderNumber + '-' } }
              ]
            },
            select: { revision: true }
          });

          // b) Encontrar la revisión máxima actual
          let maxRevision = 0;
          existingWarranties.forEach(w => {
            if (w.revision > maxRevision) {
              maxRevision = w.revision;
            }
          });

          // c) Calcular nuevos valores
          const newRevision = maxRevision + 1;
          const newOrderNumber = `${baseOrderNumber}-${newRevision}`; // ej: "113200000336-1"

          // d) ✅ FIX: Inyectar el número COMPLETO + sufijo en AMBOS campos
          const updatedOrderData = {
            ...orderData,
            orden_numero: newOrderNumber,
            codigo_completo: newOrderNumber // ← Sobreescribe para que los renderizadores lo lean completo
          };

          // e) Crear la garantía
          return await tx.warranty.create({
            data: {
              storeId: store.id,
              labId: store.labId,
              orderNumber: newOrderNumber,
              revision: newRevision,
              orderData: updatedOrderData,
              warrantyType,
              storeObservations: storeObservations || null,
              status: 'PENDING'
            }
          });
        });
        
        // Si la transacción fue exitosa, salimos del bucle
        break; 

      } catch (error) {
        // Si hay conflicto de unicidad (dos usuarios crearon al mismo tiempo), reintentar
        if (error.code === 'P2002') {
          attempts++;
          logger.warn(`[createWarranty] Conflicto de concurrencia en orden ${baseOrderNumber}, reintento ${attempts}/${MAX_RETRIES}`);
          
          if (attempts >= MAX_RETRIES) {
            throw new Error('Conflicto de concurrencia al crear la garantía después de múltiples intentos.');
          }
          
          // Pausa exponencial pequeña antes de reintentar
          await new Promise(resolve => setTimeout(resolve, 100 * attempts));
        } else {
          throw error; // Cualquier otro error se lanza inmediatamente
        }
      }
    }

    logger.info(`✅ Garantía creada: ${createdWarranty.id} para orden ${createdWarranty.orderNumber} (Rev: ${createdWarranty.revision}) por tienda ${store.name}`);

    return res.status(201).json({
      message: 'Garantía creada exitosamente y encolada para el laboratorio.',
      warranty: {
        id: createdWarranty.id,
        orderNumber: createdWarranty.orderNumber,
        revision: createdWarranty.revision,
        status: createdWarranty.status,
        createdAt: createdWarranty.createdAt
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