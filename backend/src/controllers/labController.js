// backend/src/controllers/labController.js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const axios = require('axios');
const logger = require('../config/logger');
const { generateEscPosBuffer } = require('../legacy/printer');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * POST /api/lab/print/:warrantyId
 */
const reprintTicket = async (req, res) => {
  try {
    const { warrantyId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!['LABORATORIO', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({ error: 'Solo Laboratorio o Administrador pueden reimprimir.' });
    }

    const warranty = await prisma.warranty.findUnique({
      where: { id: warrantyId },
      include: {
        lab: {
          // ✅ FIX: Incluir apiKey para autenticarse contra el agente con la clave propia del lab
          select: { id: true, name: true, agentIp: true, agentPort: true, apiKey: true },
        },
        // ✅ FIX: Incluir datos de la tienda para imprimir el nombre de la sucursal
        store: {
          select: { name: true, accn: true },
        },
      },
    });

    if (!warranty) return res.status(404).json({ error: 'Garantía no encontrada.' });
    if (warranty.status !== 'COMPLETED') return res.status(400).json({ error: `Estado: ${warranty.status}. Solo se reimprimen completadas.` });
    if (!warranty.lab?.agentIp || !warranty.lab?.agentPort) return res.status(400).json({ error: 'Lab sin agente configurado.' });

    // Asegurar que items sea un array
    const items = warranty.orderData?.items || [];

    const orderForPrint = {
      ...warranty.orderData,
      warrantyType: warranty.warrantyType,
      items: items,
      // ✅ FIX: Pasar nombre de tienda y ACCN para que el ticket muestre la sucursal
      tienda_nombre: warranty.store?.name || '',
      accn: warranty.store?.accn || '000',
    };

    let ticketBuffer;
    try {
      ticketBuffer = await generateEscPosBuffer(orderForPrint, items);
    } catch (error) {
      logger.error(`Error generando buffer para reimpresión: ${error.message}`);
      return res.status(500).json({ error: 'Error al generar buffer.', details: error.message });
    }

    const agentUrl = `http://${warranty.lab.agentIp}:${warranty.lab.agentPort}/print`;
    const bufferBase64 = ticketBuffer.toString('base64');

    try {
      await axios.post(agentUrl, {
        ticket: bufferBase64, warrantyId: warranty.id, orderNumber: warranty.orderNumber,
      }, {
        timeout: 10000,
        // ✅ FIX: Usar la apiKey propia del laboratorio (la misma que el agente tiene en config.json)
        headers: { 'Content-Type': 'application/json', 'X-API-Key': warranty.lab.apiKey },
      });
      return res.status(200).json({ message: 'Ticket enviado.', warranty: { id: warranty.id, orderNumber: warranty.orderNumber, lab: warranty.lab.name } });
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return res.status(503).json({ error: 'No se pudo conectar con el agente.' });
      }
      return res.status(500).json({ error: 'Error al enviar al agente.', details: error.message });
    }
  } catch (error) {
    logger.error(`[reprintTicket] ${error.message}`);
    return res.status(500).json({ error: 'Error interno.' });
  }
};

/**
 * POST /api/lab/warranties/:warrantyId/process
 * Procesa una garantía: genera ticket → imprime, genera VCA → guarda, marca COMPLETED.
 * Unifica impresión y VCA en una sola acción desde el panel del laboratorio.
 */
const processWarranty = async (req, res) => {
  try {
    const { warrantyId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const userLabId = req.user.labId;

    if (!['LABORATORIO', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({ error: 'Solo Laboratorio o Administrador pueden procesar garantías.' });
    }

    const warranty = await prisma.warranty.findUnique({
      where: { id: warrantyId },
      include: {
        // ✅ FIX: Incluir apiKey para autenticarse contra el agente con la clave propia del lab
        lab: { select: { id: true, name: true, agentIp: true, agentPort: true, vcaNetworkPath: true, apiKey: true } },
        store: { select: { name: true, accn: true } },
      },
    });

    if (!warranty) return res.status(404).json({ error: 'Garantía no encontrada.' });

    if (userRole === 'LABORATORIO' && warranty.labId !== userLabId) {
      return res.status(403).json({ error: 'Esta garantía no pertenece a tu laboratorio.' });
    }

    const allowedStatuses = ['PENDING', 'PROCESSING', 'ERROR'];
    if (!allowedStatuses.includes(warranty.status)) {
      return res.status(400).json({ error: `Estado: ${warranty.status}. Solo se procesan garantías pendientes, en procesamiento o con error.` });
    }

    const lab = warranty.lab;
    if (!lab?.agentIp || !lab?.agentPort) {
      return res.status(400).json({ error: 'Lab sin agente de impresión configurado.' });
    }

    await prisma.warranty.update({
      where: { id: warrantyId },
      data: { status: 'PROCESSING', processingStartedAt: new Date(), errorMessage: null },
    });

    // *** CORRECCIÓN: Asegurar que items sea un array ***
    const items = warranty.orderData?.items || [];

    const orderForPrint = {
      ...warranty.orderData,
      warrantyType: warranty.warrantyType,
      storeObservations: warranty.storeObservations,
      accn: warranty.store?.accn || '000',
      tienda_nombre: warranty.store?.name || '',
      items: items, // <-- Aseguramos que items esté en el objeto para generateTicketText
    };

    logger.info(`[processWarranty] Iniciando procesamiento de garantía ${warranty.orderNumber} (${warrantyId})`);

    let ticketBuffer;
    try {
      ticketBuffer = await generateEscPosBuffer(orderForPrint, items);
    } catch (err) {
      logger.error(`Error al generar buffer de ticket: ${err.message}`);
      await prisma.warranty.update({
        where: { id: warrantyId },
        data: { status: 'ERROR', errorMessage: `Error al generar ticket: ${err.message}` },
      });
      return res.status(500).json({ error: 'Error al generar buffer de ticket.', details: err.message });
    }

    const agentBaseUrl = `http://${lab.agentIp}:${lab.agentPort}`;
    const axiosConfig = {
      timeout: 15000,
      // ✅ FIX: Usar la apiKey propia del laboratorio (la misma que el agente tiene en config.json)
      headers: { 'Content-Type': 'application/json', 'X-API-Key': lab.apiKey },
    };

    try {
      await axios.post(`${agentBaseUrl}/print`, {
        ticket: ticketBuffer.toString('base64'),
        warrantyId: warranty.id,
        orderNumber: warranty.orderNumber,
      }, axiosConfig);
    } catch (err) {
      const errorMsg = err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT'
        ? 'No se pudo conectar con el agente de impresión.'
        : `Error al enviar ticket al agente: ${err.message}`;
      logger.error(errorMsg);
      await prisma.warranty.update({
        where: { id: warrantyId },
        data: { status: 'ERROR', errorMessage: errorMsg },
      });
      return res.status(503).json({ error: errorMsg });
    }

    try {
      await axios.post(`${agentBaseUrl}/api/vca`, {
        warrantyId: warranty.id,
        orderNumber: warranty.orderNumber,
        orderData: warranty.orderData,
        accn: warranty.store?.accn || '000',
        tiendaNombre: warranty.store?.name || 'TIENDA',
        rutaVcaRed: lab.vcaNetworkPath,
      }, axiosConfig);
    } catch (err) {
      const errorMsg = err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT'
        ? 'Ticket impreso pero no se pudo generar VCA: agente no responde.'
        : `Ticket impreso pero error al generar VCA: ${err.message}`;
      logger.error(errorMsg);
      await prisma.warranty.update({
        where: { id: warrantyId },
        data: { status: 'ERROR', errorMessage: errorMsg },
      });
      return res.status(206).json({ warning: errorMsg, warranty: { id: warranty.id, orderNumber: warranty.orderNumber } });
    }

    await prisma.warranty.update({
      where: { id: warrantyId },
      data: { status: 'COMPLETED', processedAt: new Date(), processingStartedAt: null, errorMessage: null },
    });

    logger.info(`[processWarranty] Garantía ${warranty.orderNumber} procesada exitosamente`);
    return res.status(200).json({
      message: 'Garantía procesada exitosamente.',
      warranty: { id: warranty.id, orderNumber: warranty.orderNumber, status: 'COMPLETED', processedAt: new Date().toISOString() },
    });
  } catch (error) {
    logger.error(`[processWarranty] ${error.message}`);
    return res.status(500).json({ error: 'Error interno al procesar la garantía.' });
  }
};

/**
 * GET /api/lab/agent-status
 */
const agentStatus = async (req, res) => {
  try {
    const lab = await prisma.lab.findUnique({
      where: { id: req.user.labId },
      select: { id: true, agentIp: true, agentPort: true, vcaNetworkPath: true, printerName: true, printEnabled: true, vcaEnabled: true, pollInterval: true, lastHeartbeat: true },
    });

    if (!lab) return res.status(404).json({ error: 'Laboratorio no encontrado.' });

    const now = new Date();
    const secondsSinceLastBeat = lab.lastHeartbeat
      ? Math.floor((now - new Date(lab.lastHeartbeat)) / 1000)
      : null;
    const online = secondsSinceLastBeat !== null && secondsSinceLastBeat < 120;

    return res.status(200).json({
      online,
      lastHeartbeat: lab.lastHeartbeat,
      secondsSinceLastBeat,
      agentIp: lab.agentIp,
      agentPort: lab.agentPort,
      vcaNetworkPath: lab.vcaNetworkPath,
      printerName: lab.printerName,
      printEnabled: lab.printEnabled,
      vcaEnabled: lab.vcaEnabled,
      pollInterval: lab.pollInterval,
    });
  } catch (error) {
    logger.error(`[agentStatus] ${error.message}`);
    return res.status(500).json({ error: 'Error al obtener estado del agente.' });
  }
};

/**
 * POST /api/lab/test-print
 */
const testPrint = async (req, res) => {
  try {
    const lab = await prisma.lab.findUnique({
      where: { id: req.user.labId },
      // ✅ FIX: Incluir apiKey para autenticarse contra el agente con la clave propia del lab
      select: { agentIp: true, agentPort: true, apiKey: true },
    });

    if (!lab?.agentIp || !lab?.agentPort) return res.status(400).json({ error: 'Lab sin agente configurado.' });

    // Crear un objeto de prueba con items como array vacío
    const testOrder = {
      orden_numero: 'TEST-0000',
      cliente_nombre: 'PRUEBA DE IMPRESION',
      od_esfera: '0.00',
      od_cilindro: '0.00',
      od_eje: '0',
      oi_esfera: '0.00',
      oi_cilindro: '0.00',
      oi_eje: '0',
      observaciones: 'Ticket de prueba - SGG',
      items: [], // <-- Aseguramos items
    };

    const ticketBuffer = await generateEscPosBuffer(testOrder, []);
    const agentUrl = `http://${lab.agentIp}:${lab.agentPort}/print`;

    await axios.post(agentUrl, { ticket: ticketBuffer.toString('base64'), warrantyId: 'test', orderNumber: 'TEST-0000' }, {
      timeout: 10000,
      // ✅ FIX: Usar la apiKey propia del laboratorio (la misma que el agente tiene en config.json)
      headers: { 'Content-Type': 'application/json', 'X-API-Key': lab.apiKey },
    });

    return res.status(200).json({ message: 'Ticket de prueba enviado.' });
  } catch (error) {
    logger.error(`[testPrint] ${error.message}`);
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') return res.status(503).json({ error: 'No se pudo conectar con el agente.' });
    return res.status(500).json({ error: 'Error en prueba de impresión.', details: error.message });
  }
};

/**
 * GET /api/lab/warranties
 */
const getMyLabWarranties = async (req, res) => {
  try {
    const labId = req.user.labId;
    const { search, storeId, status, startDate, endDate, page = 1, limit = 20 } = req.query;

    const where = { labId };
    if (status) where.status = status;
    if (storeId) where.storeId = storeId;
    if (search) where.orderNumber = { contains: search, mode: 'insensitive' };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [total, warranties] = await Promise.all([
      prisma.warranty.count({ where }),
      prisma.warranty.findMany({
        where,
        include: { store: { select: { id: true, name: true, accn: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
    ]);

    return res.status(200).json({
      warranties,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    logger.error(`[getMyLabWarranties] ${error.message}`);
    return res.status(500).json({ error: 'Error al obtener garantías.' });
  }
};

/**
 * GET /api/lab/stores
 * Devuelve las tiendas del laboratorio autenticado.
 */
const getMyStores = async (req, res) => {
  try {
    const stores = await prisma.store.findMany({
      where: { labId: req.user.labId, active: true },
      select: { id: true, name: true, accn: true },
      orderBy: { name: 'asc' },
    });
    return res.status(200).json({ stores });
  } catch (error) {
    logger.error(`[getMyStores] ${error.message}`);
    return res.status(500).json({ error: 'Error al obtener tiendas.' });
  }
};

module.exports = {
  processWarranty,
  reprintTicket,
  agentStatus,
  testPrint,
  getMyLabWarranties,
  getMyStores
};