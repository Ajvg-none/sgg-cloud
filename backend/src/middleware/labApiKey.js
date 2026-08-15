// backend/src/middleware/labApiKey.js
const prisma = require('../config/prisma');
const logger = require('../config/logger');

/**
 * Middleware de autenticación para el agente local de VCA.
 *
 * El agente debe enviar la API key del laboratorio en el header:
 *   x-lab-api-key: API_KEY_DEL_LABORATORIO
 *
 * También acepta (como alternativa):
 *   Authorization: Bearer API_KEY_DEL_LABORATORIO
 *
 * Si la key es válida, adjunta el laboratorio a `req.lab`
 * y actualiza `lastHeartbeat` para saber cuándo fue la última conexión.
 */
const labApiKeyAuth = async (req, res, next) => {
  try {
    // 1. Leer la API key desde los headers
    const headerKey = req.headers['x-lab-api-key'];

    const authHeader = req.headers.authorization;
    const bearerKey =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : null;

    const apiKey = headerKey || bearerKey;

    // 2. Si no hay key, denegar acceso
    if (!apiKey) {
      return res.status(401).json({
        error:
          'Falta la API key del laboratorio. Usa el header x-lab-api-key.',
      });
    }

    // 3. Buscar el laboratorio por API key
    const lab = await prisma.lab.findUnique({
      where: { apiKey },
    });

    // 4. Si no existe o está inactivo, denegar acceso
    if (!lab || !lab.active) {
      return res.status(401).json({
        error: 'API key inválida o laboratorio inactivo.',
      });
    }

    // 5. Actualizar heartbeat (fuego y olvido, no bloquea la respuesta)
    prisma.lab
      .update({
        where: { id: lab.id },
        data: { lastHeartbeat: new Date() },
      })
      .catch((err) => {
        logger.warn(
          `[labApiKeyAuth] No se pudo actualizar heartbeat: ${err.message}`
        );
      });

    // 6. Adjuntar el laboratorio a la petición
    req.lab = lab;

    return next();
  } catch (error) {
    logger.error(`[labApiKeyAuth] Error: ${error.message}`);
    return res.status(500).json({
      error: 'Error autenticando al agente del laboratorio.',
    });
  }
};

module.exports = labApiKeyAuth;