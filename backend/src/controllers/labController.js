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
          select: { id: true, name: true, ipAgente: true, puertoAgente: true, apiKey: true },
        },
      },
    });

    if (!warranty) return res.status(404).json({ error: 'Garantía no encontrada.' });
    if (warranty.status !== 'COMPLETED') return res.status(400).json({ error: `Estado: ${warranty.status}. Solo se reimprimen completadas.` });
    if (!warranty.lab?.ipAgente || !warranty.lab?.puertoAgente) return res.status(400).json({ error: 'Lab sin agente configurado.' });

    let ticketBuffer;
    try {
      const orderForPrint = { ...warranty.orderData, warrantyType: warranty.warrantyType };
      ticketBuffer = generateEscPosBuffer(orderForPrint);
    } catch (error) {
      return res.status(500).json({ error: 'Error al generar buffer.', details: error.message });
    }

    const agentUrl = `http://${warranty.lab.ipAgente}:${warranty.lab.puertoAgente}/print`;
    const bufferBase64 = ticketBuffer.toString('base64');

    try {
      await axios.post(agentUrl, {
        buffer: bufferBase64, warrantyId: warranty.id, orderNumber: warranty.orderNumber,
      }, {
        timeout: 10000,
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
 * POST /api/lab/regenerate-vca/:warrantyId
 */
const regenerateVca = async (req, res) => {
  try {
    const { warrantyId } = req.params;

    const warranty = await prisma.warranty.findUnique({
      where: { id: warrantyId },
      include: {
        lab: { select: { id: true, name: true, ipAgente: true, puertoAgente: true, apiKey: true } },
        store: { select: { name: true, accn: true } },
      },
    });

    if (!warranty || warranty.status !== 'COMPLETED') return res.status(400).json({ error: 'Garantía no encontrada o no completada.' });
    if (!warranty.lab?.ipAgente || !warranty.lab?.puertoAgente) return res.status(400).json({ error: 'Lab sin agente configurado.' });

    const agentUrl = `http://${warranty.lab.ipAgente}:${warranty.lab.puertoAgente}/api/vca`;

    await axios.post(agentUrl, {
      warrantyId: warranty.id, orderNumber: warranty.orderNumber,
      orderData: warranty.orderData, accn: warranty.store?.accn || '000', tiendaNombre: warranty.store?.name || 'TIENDA',
    }, { timeout: 10000, headers: { 'Content-Type': 'application/json', 'X-API-Key': warranty.lab.apiKey } });

    return res.status(200).json({ message: 'VCA regenerado.' });
  } catch (error) {
    logger.error(`[regenerateVca] ${error.message}`);
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') return res.status(503).json({ error: 'No se pudo conectar con el agente.' });
    return res.status(500).json({ error: 'Error al regenerar VCA.', details: error.message });
  }
};

/**
 * GET /api/lab/agent-status
 */
const agentStatus = async (req, res) => {
  try {
    const lab = await prisma.lab.findUnique({
      where: { id: req.user.labId },
      select: { id: true, ipAgente: true, puertoAgente: true, rutaVcaRed: true, lastHeartbeat: true },
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
      agentIp: lab.ipAgente,
      agentPort: lab.puertoAgente,
      vcaNetworkPath: lab.rutaVcaRed,
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
      select: { ipAgente: true, puertoAgente: true, apiKey: true },
    });

    if (!lab?.ipAgente || !lab?.puertoAgente) return res.status(400).json({ error: 'Lab sin agente configurado.' });

    const ticketBuffer = generateEscPosBuffer({
      orden_numero: 'TEST-0000', cliente_nombre: 'PRUEBA DE IMPRESION',
      od_esfera: '0.00', od_cilindro: '0.00', od_eje: '0',
      oi_esfera: '0.00', oi_cilindro: '0.00', oi_eje: '0',
      observaciones: 'Ticket de prueba - SGG',
    }, []);

    const agentUrl = `http://${lab.ipAgente}:${lab.puertoAgente}/print`;
    await axios.post(agentUrl, { buffer: ticketBuffer.toString('base64'), warrantyId: 'test', orderNumber: 'TEST-0000' }, {
      timeout: 10000, headers: { 'Content-Type': 'application/json', 'X-API-Key': lab.apiKey },
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
 * PUT /api/lab/config
 */
const updateLabConfig = async (req, res) => {
  try {
    const { vcaNetworkPath } = req.body;
    if (!vcaNetworkPath) return res.status(400).json({ error: 'Ruta VCA obligatoria.' });

    await prisma.lab.update({
      where: { id: req.user.labId },
      data: { rutaVcaRed: vcaNetworkPath },
    });

    return res.status(200).json({ message: 'Configuración actualizada.', vcaNetworkPath });
  } catch (error) {
    logger.error(`[updateLabConfig] ${error.message}`);
    return res.status(500).json({ error: 'Error al actualizar.' });
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

module.exports = { reprintTicket, regenerateVca, agentStatus, testPrint, getMyLabWarranties, updateLabConfig, getMyStores };
