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
    const { orderNumber, orderData } = req.body;
    const storeId = req.user.storeId;

    // 1. Validar datos básicos del body
    if (!orderNumber || !orderData) {
      return res.status(400).json({ error: 'orderNumber y orderData son obligatorios.' });
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

    // 3. VALIDACIONES OBLIGATORIAS de orderData (RF-02.5)
    const errors = [];
    
    // Helpers de validación
    const isNum = (val) => val !== null && val !== undefined && !isNaN(parseFloat(val));
    const isPositive = (val) => isNum(val) && parseFloat(val) > 0;
    const isAxis = (val) => isNum(val) && parseFloat(val) >= 0 && parseFloat(val) <= 180;

    // Validar Ejes (0-180)
    if (!isAxis(orderData.od_eje)) errors.push('OD Eje debe ser un número entre 0 y 180.');
    if (!isAxis(orderData.oi_eje)) errors.push('OI Eje debe ser un número entre 0 y 180.');

    // Validar Alturas (> 0)
    if (!isPositive(orderData.altura_od)) errors.push('OD Altura debe ser un número mayor a 0.');
    if (!isPositive(orderData.altura_oi)) errors.push('OI Altura debe ser un número mayor a 0.');

    // Validar DP (> 0) - Solo si el campo viene en el payload y no es null
    const dpFields = ['od_dp_centro', 'od_dp_cerca', 'oi_dp_centro', 'oi_dp_cerca', 'pupillary_distance_total'];
    dpFields.forEach(field => {
      if (orderData[field] !== null && orderData[field] !== undefined && !isPositive(orderData[field])) {
        errors.push(`El campo ${field} debe ser un número mayor a 0.`);
      }
    });

    // Validar que Esferas, Cilindros y Adiciones sean números (pueden ser negativos o 0)
    const numericFields = ['od_esfera', 'od_cilindro', 'od_adicion', 'oi_esfera', 'oi_cilindro', 'oi_adicion'];
    numericFields.forEach(field => {
      if (orderData[field] !== null && orderData[field] !== undefined && !isNum(orderData[field])) {
        errors.push(`El campo ${field} debe ser un número válido.`);
      }
    });

    // Si hay errores, detener el proceso y devolver la lista
    if (errors.length > 0) {
      return res.status(400).json({ 
        error: 'Errores de validación en los datos de la orden.', 
        details: errors 
      });
    }

    // 4. Crear el registro en Warranty (RF-02.4 y RF-04.1)
    const warranty = await prisma.warranty.create({
      data: {
        storeId: store.id,
        labId: store.labId,
        orderNumber: String(orderNumber),
        orderData: orderData, // Prisma lo serializa automáticamente a JSONB
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

module.exports = { getOrder, createWarranty };