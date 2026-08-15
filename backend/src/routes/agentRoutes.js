// backend/src/routes/agentRoutes.js
const express = require('express');
const router = express.Router();

const prisma = require('../config/prisma');
const labApiKeyAuth = require('../middleware/labApiKey');
const logger = require('../config/logger');
const { generateVCAContent } = require('../legacy/lensware');

// Separador Windows (backslash) sin usar secuencias de escape
const WIN_SEP = String.fromCharCode(92);

// 🔒 Todas las rutas de este router requieren API key de laboratorio
router.use(labApiKeyAuth);

/**
 * Limpia una parte del nombre de archivo.
 * @param {*} value - Valor a sanitizar.
 * @returns {string}
 */
function safeFilePart(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 100);
}

/**
 * Construye la ruta destino informativa usando vcaNetworkPath.
 * @param {string|null} basePath - Ruta base configurada en el laboratorio.
 * @param {string} filename - Nombre del archivo VCA.
 * @returns {string}
 */
function buildTargetPath(basePath, filename) {
  if (!basePath) return filename;

  const cleanBase = String(basePath).replace(/[\\/]+$/, '');
  return cleanBase + WIN_SEP + filename;
}

/**
 * GET /api/agent/vca/pending
 *
 * Devuelve los archivos VCA pendientes de entregar
 * para el laboratorio autenticado con su API key.
 */
router.get('/vca/pending', async (req, res) => {
  try {
    const lab = req.lab;

    // Si el laboratorio tiene VCA deshabilitado, no devuelve nada
    if (!lab.vcaEnabled) {
      return res.status(200).json({
        labId: lab.id,
        labName: lab.name,
        pollInterval: lab.pollInterval,
        files: [],
        message: 'VCA deshabilitado para este laboratorio.',
      });
    }

    // Buscar garantías pendientes de entrega de VCA
    const warranties = await prisma.warranty.findMany({
      where: {
        labId: lab.id,
        vcaDeliveredAt: null,
      },
      include: {
        store: {
          select: { id: true, name: true, accn: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    const files = [];

    for (const warranty of warranties) {
      const items = Array.isArray(warranty.orderData?.items)
        ? warranty.orderData.items
        : [];

      // Orden normalizada para el generador VCA
      const orderForVca = {
        ...warranty.orderData,
        tienda_id: warranty.storeId,
        tienda_nombre:
          warranty.store?.name ||
          warranty.orderData?.tienda_nombre ||
          '',
        accn:
          warranty.store?.accn ||
          warranty.orderData?.accn ||
          '000',
        orden_numero: warranty.orderNumber,
        codigo_completo:
          warranty.orderData?.codigo_completo || warranty.orderNumber,
      };

      let content;

      try {
        content = await generateVCAContent(orderForVca, items);
      } catch (vcaErr) {
        logger.error(
          `[agent/vca/pending] Error generando VCA para warranty ${warranty.id}: ${vcaErr.message}`
        );
        continue;
      }

      const filename =
        'Pedido_' +
        safeFilePart(warranty.orderNumber) +
        '_' +
        safeFilePart(warranty.storeId) +
        '.vca';

      files.push({
        warrantyId: warranty.id,
        orderNumber: warranty.orderNumber,
        revision: warranty.revision,
        storeId: warranty.storeId,
        storeName: warranty.store?.name || null,
        accn: warranty.store?.accn || null,
        filename,
        targetPath: buildTargetPath(lab.vcaNetworkPath, filename),
        content,
        createdAt: warranty.createdAt,
      });
    }

    return res.status(200).json({
      labId: lab.id,
      labName: lab.name,
      pollInterval: lab.pollInterval,
      vcaNetworkPath: lab.vcaNetworkPath,
      files,
    });
  } catch (error) {
    logger.error(`[agent/vca/pending] Error: ${error.message}`);
    return res.status(500).json({
      error: 'Error al obtener archivos VCA pendientes.',
    });
  }
});

/**
 * POST /api/agent/vca/:warrantyId/delivered
 *
 * El agente local confirma que ya guardó el archivo VCA.
 */
router.post('/vca/:warrantyId/delivered', async (req, res) => {
  try {
    const { warrantyId } = req.params;
    const lab = req.lab;

    const warranty = await prisma.warranty.findFirst({
      where: {
        id: warrantyId,
        labId: lab.id,
      },
      select: {
        id: true,
        orderNumber: true,
        vcaDeliveredAt: true,
      },
    });

    if (!warranty) {
      return res.status(404).json({
        error: 'Garantía no encontrada para este laboratorio.',
      });
    }

    await prisma.warranty.update({
      where: { id: warranty.id },
      data: { vcaDeliveredAt: new Date() },
    });

    logger.info(
      `[agent/vca/delivered] VCA entregado: ${warranty.orderNumber} (lab ${lab.id})`,
      { localPath: req.body?.localPath || null }
    );

    return res.status(200).json({
      ok: true,
      warrantyId: warranty.id,
    });
  } catch (error) {
    logger.error(`[agent/vca/delivered] Error: ${error.message}`);
    return res.status(500).json({
      error: 'Error al marcar VCA como entregado.',
    });
  }
});

module.exports = router;