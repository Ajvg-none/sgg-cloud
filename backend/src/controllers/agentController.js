// backend/src/controllers/agentController.js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const logger = require('../config/logger');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
* GET /api/agent/pending
* Devuelve las garantías PENDING del laboratorio autenticado.
* Las marca como PROCESSING con timestamp (RF-04.2).
*/
const getPending = async (req, res) => {
const labId = req.lab.id;
try {
// Iniciar transacción para evitar race conditions
const result = await prisma.$transaction(async (tx) => {
// 1. Buscar garantías PENDING de este laboratorio
const pendingWarranties = await tx.warranty.findMany({
  where: {
    labId,
    status: 'PENDING',
  },
  select: {
    id: true,
    orderNumber: true,
    orderData: true,
    storeId: true,
    warrantyType: true, 
  },
  take: 10,
});

if (pendingWarranties.length === 0) {
return [];
}

// 2. Marcarlas como PROCESSING con timestamp
const warrantyIds = pendingWarranties.map((w) => w.id);
await tx.warranty.updateMany({
where: {
id: { in: warrantyIds },
},
data: {
status: 'PROCESSING',
processingStartedAt: new Date(),
},
});

logger.info(`[getPending] ${pendingWarranties.length} garantía(s) marcada(s) como PROCESSING`, {
labId,
warrantyIds,
});

// 3. Devolver los datos completos (incluyendo orderData y store)
const warrantiesWithDetails = await tx.warranty.findMany({
  where: {
    id: { in: warrantyIds },
  },
  select: {
    id: true,
    orderNumber: true,
    orderData: true,
    storeId: true,
    status: true,
    processingStartedAt: true,
    warrantyType: true, // ✅ AGREGAR ESTA LÍNEA
    store: {
      select: {
        name: true,
        accn: true,
      },
    },
  },
});

return warrantiesWithDetails;
});

return res.status(200).json({
warranties: result,
count: result.length,
});
} catch (error) {
logger.error(`[getPending] Error: ${error.message}`, {
labId,
});
return res.status(500).json({
error: 'Error al obtener las garantías pendientes.',
});
}
};

/**
* POST /api/agent/complete
* Marca una garantía como COMPLETED después de que el agente la procesó.
*/
const completeWarranty = async (req, res) => {
const { warrantyId } = req.body;
const labId = req.lab.id;
try {
if (!warrantyId) {
return res.status(400).json({
error: 'warrantyId es obligatorio.',
});
}

// Buscar la garantía y verificar que pertenezca a este laboratorio
const warranty = await prisma.warranty.findFirst({
where: {
id: warrantyId,
labId,
},
});

if (!warranty) {
logger.warn(`[completeWarranty] Garantía no encontrada o no pertenece al laboratorio`, {
warrantyId,
labId,
});
return res.status(404).json({
error: 'Garantía no encontrada o no pertenece a este laboratorio.',
});
}

if (warranty.status !== 'PROCESSING') {
logger.warn(`[completeWarranty] Garantía no está en estado PROCESSING`, {
warrantyId,
currentStatus: warranty.status,
});
return res.status(400).json({
error: `La garantía está en estado ${warranty.status}, no puede completarse.`,
});
}

// Actualizar a COMPLETED
const updatedWarranty = await prisma.warranty.update({
where: { id: warrantyId },
data: {
status: 'COMPLETED',
processedAt: new Date(),
processingStartedAt: null, // Limpiar el timestamp
},
});

logger.info(`✅ Garantía completada: ${warrantyId}`, {
labId,
orderNumber: warranty.orderNumber,
});

return res.status(200).json({
message: 'Garantía marcada como completada.',
warranty: {
id: updatedWarranty.id,
orderNumber: updatedWarranty.orderNumber,
status: updatedWarranty.status,
processedAt: updatedWarranty.processedAt,
},
});
} catch (error) {
logger.error(`[completeWarranty] Error: ${error.message}`, {
warrantyId,
labId,
});
return res.status(500).json({
error: 'Error al completar la garantía.',
});
}
};

/**
* POST /api/agent/heartbeat
* El agente reporta que está vivo. Actualiza lastHeartbeat del lab.
*/
const heartbeat = async (req, res) => {
const labId = req.lab.id;
try {
await prisma.lab.update({
where: { id: labId },
data: { lastHeartbeat: new Date() },
});
return res.status(200).json({ message: 'Heartbeat registrado.' });
} catch (error) {
logger.error(`[heartbeat] Error: ${error.message}`, { labId });
return res.status(500).json({ error: 'Error al registrar heartbeat.' });
}
};

module.exports = {
getPending,
completeWarranty,
heartbeat,
};