// backend/src/middleware/apiKeyAuth.js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const logger = require('../config/logger');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Middleware de autenticación para el Agente de Impresión.
 * Valida la API Key enviada en el header 'X-API-Key'.
 * Si es válida, añade req.lab con la información del laboratorio.
 */
const apiKeyAuth = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      logger.warn('[apiKeyAuth] Solicitud sin API Key', {
        ip: req.ip,
        path: req.path,
      });
      return res.status(401).json({
        error: 'API Key requerida. Envíala en el header X-API-Key.',
      });
    }

    // Buscar laboratorio con esa API Key
    const lab = await prisma.lab.findFirst({
      where: { apiKey },
      select: {
        id: true,
        name: true,
        ipAgente: true,
        puertoAgente: true,
        rutaVcaRed: true,
      },
    });

    if (!lab) {
      logger.warn('[apiKeyAuth] API Key inválida', {
        ip: req.ip,
        apiKey: apiKey.substring(0, 8) + '...',
      });
      return res.status(403).json({
        error: 'API Key inválida.',
      });
    }

    // Adjuntar información del laboratorio al request
    req.lab = lab;
    
    logger.info(`[apiKeyAuth] Agente autenticado: ${lab.name}`, {
      labId: lab.id,
      ip: req.ip,
    });

    next();
  } catch (error) {
    logger.error(`[apiKeyAuth] Error: ${error.message}`);
    return res.status(500).json({
      error: 'Error al validar la API Key.',
    });
  }
};

module.exports = apiKeyAuth;