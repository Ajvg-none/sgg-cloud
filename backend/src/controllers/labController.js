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
 * Reimprime el ticket de una garantía ya completada.
 * RF-06.1: Solo usuarios con rol LABORATORIO o ADMIN pueden solicitar reimpresión.
 * RF-06.2: Reenvía los datos del ticket al agente local sin regenerar el VCA.
 */
const reprintTicket = async (req, res) => {
  try {
    const { warrantyId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // 1. Verificar rol (LABORATORIO o ADMIN)
    if (!['LABORATORIO', 'ADMIN'].includes(userRole)) {
      logger.warn(`[reprintTicket] Usuario sin permisos intentó reimprimir`, {
        userId,
        userRole,
        warrantyId,
      });
      return res.status(403).json({
        error: 'Solo usuarios de Laboratorio o Administrador pueden reimprimir tickets.',
      });
    }

    // 2. Buscar la garantía
    const warranty = await prisma.warranty.findUnique({
      where: { id: parseInt(warrantyId) },
      include: {
        lab: {
          select: {
            id: true,
            name: true,
            agentIp: true,
            agentPort: true,
          },
        },
      },
    });

    if (!warranty) {
      logger.warn(`[reprintTicket] Garantía no encontrada`, { warrantyId });
      return res.status(404).json({
        error: 'Garantía no encontrada.',
      });
    }

    // 3. Verificar que la garantía esté COMPLETED
    if (warranty.status !== 'COMPLETED') {
      logger.warn(`[reprintTicket] Garantía no está completada`, {
        warrantyId,
        status: warranty.status,
      });
      return res.status(400).json({
        error: `La garantía está en estado ${warranty.status}. Solo se pueden reimprimir garantías completadas.`,
      });
    }

    // 4. Verificar que el laboratorio tenga configuración de agente
    if (!warranty.lab || !warranty.lab.agentIp || !warranty.lab.agentPort) {
      logger.error(`[reprintTicket] Laboratorio sin configuración de agente`, {
        warrantyId,
        labId: warranty.labId,
      });
      return res.status(400).json({
        error: 'El laboratorio no tiene configurada la IP y puerto del agente.',
      });
    }

    // 5. Generar el buffer ESC/POS usando la función legacy
    let ticketBuffer;
    try {
      ticketBuffer = generateEscPosBuffer(warranty.orderData);
      logger.info(`[reprintTicket] Buffer ESC/POS generado exitosamente`, {
        warrantyId,
        bufferSize: ticketBuffer.length,
      });
    } catch (error) {
      logger.error(`[reprintTicket] Error generando buffer ESC/POS: ${error.message}`, {
        warrantyId,
      });
      return res.status(500).json({
        error: 'Error al generar el buffer de impresión.',
        details: error.message,
      });
    }

    // 6. Enviar el buffer al agente local
    const agentUrl = `http://${warranty.lab.agentIp}:${warranty.lab.agentPort}/print`;
    const bufferBase64 = ticketBuffer.toString('base64');

    try {
      logger.info(`[reprintTicket] Enviando buffer al agente local`, {
        warrantyId,
        agentUrl,
        labName: warranty.lab.name,
      });

      const response = await axios.post(
        agentUrl,
        {
          buffer: bufferBase64,
          warrantyId: warranty.id,
          orderNumber: warranty.orderNumber,
        },
        {
          timeout: 10000, // 10 segundos de timeout
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status === 200) {
        logger.info(`✅ Ticket reimpreso exitosamente`, {
          warrantyId,
          orderNumber: warranty.orderNumber,
          labName: warranty.lab.name,
          userId,
        });

        return res.status(200).json({
          message: 'Ticket enviado a impresión exitosamente.',
          warranty: {
            id: warranty.id,
            orderNumber: warranty.orderNumber,
            lab: warranty.lab.name,
          },
        });
      } else {
        throw new Error(`Respuesta inesperada del agente: ${response.status}`);
      }
    } catch (error) {
      logger.error(`[reprintTicket] Error enviando al agente: ${error.message}`, {
        warrantyId,
        agentUrl,
        errorCode: error.code,
      });

      // Diferenciar entre errores de conexión y otros errores
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return res.status(503).json({
          error: 'No se pudo conectar con el agente de impresión. Verifica que el agente esté corriendo.',
          details: error.message,
        });
      }

      return res.status(500).json({
        error: 'Error al enviar el ticket al agente de impresión.',
        details: error.message,
      });
    }
  } catch (error) {
    logger.error(`[reprintTicket] Error inesperado: ${error.message}`, {
      warrantyId: req.params.warrantyId,
      userId: req.user.id,
    });
    return res.status(500).json({
      error: 'Error interno del servidor al procesar la reimpresión.',
    });
  }
};

module.exports = {
  reprintTicket,
};