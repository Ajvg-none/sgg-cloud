// backend/src/middleware/apiKeyAuth.js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const logger = require('../config/logger');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const apiKeyAuth = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ error: 'API Key requerida. Envíala en el header X-API-Key.' });
    }
    const lab = await prisma.lab.findFirst({
      where: { apiKey, active: true },  // ← solo labs activos
      select: {
        id: true,
        name: true,
        active: true,
        agentIp: true,
        agentPort: true,
        vcaNetworkPath: true,
        printerName: true,
        printEnabled: true,
        vcaEnabled: true,
        pollInterval: true,
      },
    });
    if (!lab) {
      return res.status(403).json({ error: 'API Key inválida o laboratorio desactivado.' });
    }
    req.lab = lab;
    next();
  } catch (error) {
    logger.error(`[apiKeyAuth] Error: ${error.message}`);
    return res.status(500).json({ error: 'Error al validar la API Key.' });
  }
};

module.exports = apiKeyAuth;