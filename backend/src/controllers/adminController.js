// backend/src/controllers/adminController.js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const logger = require('../config/logger');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ============================================================
// GESTIÓN DE LABORATORIOS (RF-07.1)
// ============================================================

/**
 * POST /api/admin/labs
 * Crea un nuevo laboratorio. Genera automáticamente la API Key.
 */
const createLab = async (req, res) => {
  try {
    const { name, agentIp, agentPort, vcaNetworkPath } = req.body;

    if (!name || !agentIp || !agentPort || !vcaNetworkPath) {
      return res.status(400).json({
        error: 'Todos los campos son obligatorios: name, agentIp, agentPort, vcaNetworkPath.',
      });
    }

    // Generar API Key única (RF-07.1)
    const apiKey = crypto.randomBytes(32).toString('hex');

    const lab = await prisma.lab.create({
      data: {
        name,
        ipAgente: agentIp,
        puertoAgente: String(agentPort),
        rutaVcaRed: vcaNetworkPath,
        apiKey,
      },
    });

    logger.info(`✅ Laboratorio creado: ${lab.name}`, { labId: lab.id });

    return res.status(201).json({
      message: 'Laboratorio creado exitosamente.',
      lab: {
        id: lab.id,
        name: lab.name,
        agentIp: lab.ipAgente,
        agentPort: lab.puertoAgente,
        vcaNetworkPath: lab.rutaVcaRed,
        apiKey: lab.apiKey,
      },
    });
  } catch (error) {
    logger.error(`[createLab] Error: ${error.message}`);
    return res.status(500).json({ error: 'Error al crear el laboratorio.' });
  }
};

/**
 * GET /api/admin/labs
 * Lista todos los laboratorios.
 */
const getLabs = async (req, res) => {
  try {
    const labs = await prisma.lab.findMany({
      select: {
        id: true,
        name: true,
        ipAgente: true,
        puertoAgente: true,
        rutaVcaRed: true,
        apiKey: true,
        createdAt: true,
        _count: {
          select: { stores: true, warranties: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({
      labs: labs.map((lab) => ({
        id: lab.id,
        name: lab.name,
        agentIp: lab.ipAgente,
        agentPort: lab.puertoAgente,
        vcaNetworkPath: lab.rutaVcaRed,
        apiKey: lab.apiKey,
        createdAt: lab.createdAt,
        _count: lab._count,
      })),
    });
  } catch (error) {
    logger.error(`[getLabs] Error: ${error.message}`);
    return res.status(500).json({ error: 'Error al obtener los laboratorios.' });
  }
};

/**
 * PUT /api/admin/labs/:id
 * Actualiza un laboratorio existente.
 */
const updateLab = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, agentIp, agentPort, vcaNetworkPath } = req.body;

    const lab = await prisma.lab.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(agentIp && { ipAgente: agentIp }),
        ...(agentPort && { puertoAgente: String(agentPort) }),
        ...(vcaNetworkPath && { rutaVcaRed: vcaNetworkPath }),
      },
    });

    logger.info(`✅ Laboratorio actualizado: ${lab.name}`, { labId: lab.id });

    return res.status(200).json({
      message: 'Laboratorio actualizado exitosamente.',
      lab: {
        id: lab.id,
        name: lab.name,
        agentIp: lab.ipAgente,
        agentPort: lab.puertoAgente,
        vcaNetworkPath: lab.rutaVcaRed,
        apiKey: lab.apiKey,
        active: lab.active,
      },
    });
  } catch (error) {
    logger.error(`[updateLab] Error: ${error.message}`);
    return res.status(500).json({ error: 'Error al actualizar el laboratorio.' });
  }
};

/**
 * DELETE /api/admin/labs/:id
 * Elimina un laboratorio (solo si no tiene tiendas asociadas).
 */
const deleteLab = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que no tenga tiendas asociadas
    const storesCount = await prisma.store.count({
      where: { labId: id },
    });

    if (storesCount > 0) {
      return res.status(400).json({
        error: `No se puede eliminar el laboratorio: tiene ${storesCount} tienda(s) asociada(s). Reasígnalas primero.`,
      });
    }

    await prisma.lab.delete({
      where: { id },
    });

    logger.info(`✅ Laboratorio eliminado: ${id}`);

    return res.status(200).json({
      message: 'Laboratorio eliminado exitosamente.',
    });
  } catch (error) {
    logger.error(`[deleteLab] Error: ${error.message}`);
    return res.status(500).json({ error: 'Error al eliminar el laboratorio.' });
  }
};

/**
 * POST /api/admin/labs/:id/regenerate-key
 * Regenera la API Key de un laboratorio.
 */
const regenerateLabApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    const newApiKey = crypto.randomBytes(32).toString('hex');

    const lab = await prisma.lab.update({
      where: { id },
      data: { apiKey: newApiKey },
    });

    logger.info(`🔑 API Key regenerada para laboratorio: ${lab.name}`, { labId: lab.id });

    return res.status(200).json({
      message: 'API Key regenerada exitosamente.',
      apiKey: newApiKey,
    });
  } catch (error) {
    logger.error(`[regenerateLabApiKey] Error: ${error.message}`);
    return res.status(500).json({ error: 'Error al regenerar la API Key.' });
  }
};

// ============================================================
// GESTIÓN DE TIENDAS (RF-07.2)
// ============================================================

/**
 * POST /api/admin/stores
 * Crea una nueva tienda con usuario asociado.
 */
const createStore = async (req, res) => {
  try {
    const { name, accn, labId, password, email } = req.body;

    if (!name || !accn || !labId || !password) {
      return res.status(400).json({
        error: 'Los campos name, accn, labId y password son obligatorios.',
      });
    }

    // Validar ACCN: 3 dígitos numéricos (RF-07.2)
    if (!/^\d{3}$/.test(accn)) {
      return res.status(400).json({
        error: 'El ACCN debe ser exactamente 3 dígitos numéricos.',
      });
    }

    // Verificar que el ACCN sea único
    const existingStore = await prisma.store.findFirst({
      where: { accn },
    });
    if (existingStore) {
      return res.status(400).json({
        error: `Ya existe una tienda con el ACCN ${accn}.`,
      });
    }

    // Verificar que el laboratorio exista
    const lab = await prisma.lab.findUnique({
      where: { id: labId },
    });
    if (!lab) {
      return res.status(404).json({
        error: 'El laboratorio especificado no existe.',
      });
    }

    // Hashear contraseña (RF-01.4)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear tienda y usuario en transacción
    const result = await prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          name,
          accn,
          labId,
          active: true,
        },
      });

      const user = await tx.user.create({
        data: {
          username: email || `${accn}@tienda.local`,
          password: hashedPassword,
          role: 'TIENDA',
          storeId: store.id,
        },
      });

      return { store, user };
    });

    logger.info(`✅ Tienda creada: ${name} (ACCN: ${accn})`, {
      storeId: result.store.id,
      labId,
    });

    return res.status(201).json({
      message: 'Tienda y usuario creados exitosamente.',
      store: result.store,
      user: {
        id: result.user.id,
        username: result.user.username,
        role: result.user.role,
      },
    });
  } catch (error) {
    logger.error(`[createStore] Error: ${error.message}`);
    return res.status(500).json({ error: 'Error al crear la tienda.' });
  }
};

/**
 * GET /api/admin/stores
 * Lista todas las tiendas con información de su laboratorio.
 */
const getStores = async (req, res) => {
  try {
    const stores = await prisma.store.findMany({
      include: {
        lab: {
          select: { id: true, name: true },
        },
        _count: {
          select: { warranties: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({ stores });
  } catch (error) {
    logger.error(`[getStores] Error: ${error.message}`);
    return res.status(500).json({ error: 'Error al obtener las tiendas.' });
  }
};

/**
 * PUT /api/admin/stores/:id
 * Actualiza una tienda (ACCN, laboratorio, estado).
 */
const updateStore = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, accn, labId, active } = req.body;

    // Validar ACCN si se proporciona
    if (accn && !/^\d{3}$/.test(accn)) {
      return res.status(400).json({
        error: 'El ACCN debe ser exactamente 3 dígitos numéricos.',
      });
    }

    // Verificar unicidad de ACCN si se cambia
    if (accn) {
      const existing = await prisma.store.findFirst({
        where: {
          accn,
          id: { not: id },
        },
      });
      if (existing) {
        return res.status(400).json({
          error: `Ya existe otra tienda con el ACCN ${accn}.`,
        });
      }
    }

    const store = await prisma.store.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(accn && { accn }),
        ...(labId && { labId }),
        ...(active !== undefined && { active }),
      },
    });

    logger.info(`✅ Tienda actualizada: ${store.name}`, { storeId: store.id });

    return res.status(200).json({
      message: 'Tienda actualizada exitosamente.',
      store,
    });
  } catch (error) {
    logger.error(`[updateStore] Error: ${error.message}`);
    return res.status(500).json({ error: 'Error al actualizar la tienda.' });
  }
};

/**
 * POST /api/admin/users/:userId/reset-password
 * Resetea la contraseña de un usuario (RF-07.4, RF-01.5).
 */
const resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        error: 'La nueva contraseña debe tener al menos 6 caracteres.',
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    logger.info(`🔑 Contraseña reseteada para usuario: ${userId}`);

    return res.status(200).json({
      message: 'Contraseña reseteada exitosamente.',
    });
  } catch (error) {
    logger.error(`[resetUserPassword] Error: ${error.message}`);
    return res.status(500).json({ error: 'Error al resetear la contraseña.' });
  }
};

// ============================================================
// DASHBOARD DE GARANTÍAS (RF-07.3)
// ============================================================

/**
 * GET /api/admin/warranties
 * Dashboard con filtros y paginación.
 * Query params: storeId, labId, status, startDate, endDate, page, limit
 */
const getWarrantiesDashboard = async (req, res) => {
  try {
    const {
      storeId,
      labId,
      status,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    // Construir filtro dinámico
    const where = {};

    if (storeId) where.storeId = storeId;
    if (labId) where.labId = labId;
    if (status) where.status = status;
    if (search) where.orderNumber = { contains: search, mode: 'insensitive' };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Consulta paralela: total + datos paginados
    const [total, warranties] = await Promise.all([
      prisma.warranty.count({ where }),
      prisma.warranty.findMany({
        where,
        include: {
          store: {
            select: { id: true, name: true, accn: true },
          },
          lab: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
    ]);

    return res.status(200).json({
      warranties,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error(`[getWarrantiesDashboard] Error: ${error.message}`);
    return res.status(500).json({ error: 'Error al obtener el dashboard.' });
  }
};

// ============================================================
// SISTEMA DE LOGS (RF-10.3)
// ============================================================

const fs = require('fs');
const path = require('path');

/**
 * GET /api/admin/logs
 * Lee los archivos de log recientes (últimos N líneas).
 * Query params: lines (default 200), level (info|warn|error)
 */
const getLogs = async (req, res) => {
  try {
    const { lines = 200, level } = req.query;
    const logsDir = path.join(__dirname, '../../logs');

    // Verificar que exista la carpeta de logs
    if (!fs.existsSync(logsDir)) {
      return res.status(200).json({
        logs: [],
        message: 'No hay archivos de log disponibles.',
      });
    }

    // Obtener archivos .log ordenados por fecha (más reciente primero)
    const logFiles = fs
      .readdirSync(logsDir)
      .filter((f) => f.endsWith('.log'))
      .sort()
      .reverse();

    if (logFiles.length === 0) {
      return res.status(200).json({
        logs: [],
        message: 'No hay archivos de log.',
      });
    }

    // Leer el archivo más reciente
    const latestLogFile = path.join(logsDir, logFiles[0]);
    const content = fs.readFileSync(latestLogFile, 'utf-8');
    let allLines = content.split('\n').filter((line) => line.trim() !== '');

    // Filtrar por nivel si se especifica
    if (level) {
      const levelUpper = level.toUpperCase();
      allLines = allLines.filter((line) => line.includes(`"level":"${levelUpper}"`) || line.includes(`"level":"${level.toLowerCase()}"`));
    }

    // Tomar las últimas N líneas
    const recentLines = allLines.slice(-parseInt(lines));

    // Parsear cada línea como JSON (si es posible)
    const parsedLogs = recentLines.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });

    return res.status(200).json({
      logs: parsedLogs,
      file: logFiles[0],
      totalLines: allLines.length,
    });
  } catch (error) {
    logger.error(`[getLogs] Error: ${error.message}`);
    return res.status(500).json({ error: 'Error al leer los logs.' });
  }
};


// ============================================================
// IMPORTACIÓN CSV (RF-11)
// ============================================================

const csv = require('csv-parser');
const { Readable } = require('stream');

/**
 * POST /api/admin/import-csv
 * Importa garantías históricas desde un archivo CSV.
 * Columnas esperadas: orden_numero, tienda_nombre, datos_corregidos (JSON), observaciones, fecha_creacion
 */
const importCsv = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No se recibió ningún archivo CSV.',
      });
    }

    const results = [];
    const errors = [];
    let processedCount = 0;

    // Crear stream desde el buffer del archivo
    const stream = Readable.from(req.file.buffer.toString('utf-8'));

    // Pre-cargar todas las tiendas para búsqueda rápida
    const allStores = await prisma.store.findMany({
      select: { id: true, name: true, accn: true, labId: true },
    });
    const storeMap = new Map();
    allStores.forEach((s) => {
      storeMap.set(s.name.toLowerCase(), s);
      storeMap.set(s.accn, s);
    });

    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (row) => {
          processedCount++;
          try {
            const orderNumber = row.orden_numero?.trim();
            const storeName = row.tienda_nombre?.trim();
            const datosCorregidosRaw = row.datos_corregidos;
            const observaciones = row.observaciones || '';
            const fechaCreacion = row.fecha_creacion;

            // Validaciones
            if (!orderNumber) {
              errors.push({ row: processedCount, error: 'Falta orden_numero' });
              return;
            }
            if (!storeName) {
              errors.push({ row: processedCount, error: 'Falta tienda_nombre' });
              return;
            }

            // Buscar tienda por nombre o ACCN (RF-11.3)
            const store =
              storeMap.get(storeName.toLowerCase()) || storeMap.get(storeName);
            if (!store) {
              errors.push({
                row: processedCount,
                error: `Tienda no encontrada: ${storeName}`,
              });
              return;
            }

            // Parsear JSON de datos_corregidos
            let orderData;
            try {
              orderData = JSON.parse(datosCorregidosRaw || '{}');
            } catch (e) {
              errors.push({
                row: processedCount,
                error: `datos_corregidos no es JSON válido: ${e.message}`,
              });
              return;
            }

            results.push({
              storeId: store.id,
              labId: store.labId,
              orderNumber,
              orderData,
              observaciones,
              createdAt: fechaCreacion ? new Date(fechaCreacion) : new Date(),
              status: 'COMPLETED', // RF-11.4: no las procesa el agente
            });
          } catch (e) {
            errors.push({ row: processedCount, error: e.message });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Insertar en BD si hay resultados válidos
    let insertedCount = 0;
    if (results.length > 0) {
      // Insertar en lotes de 100 para no saturar la BD
      for (let i = 0; i < results.length; i += 100) {
        const batch = results.slice(i, i + 100);
        await prisma.warranty.createMany({
          data: batch,
        });
        insertedCount += batch.length;
      }
    }

    logger.info(`📥 Importación CSV completada`, {
      processed: processedCount,
      inserted: insertedCount,
      errors: errors.length,
    });

    return res.status(200).json({
      message: 'Importación completada.',
      summary: {
        processed: processedCount,
        inserted: insertedCount,
        errors: errors.length,
      },
      errors,
    });
  } catch (error) {
    logger.error(`[importCsv] Error: ${error.message}`);
    return res.status(500).json({ error: 'Error al procesar el archivo CSV.' });
  }
};

module.exports = {
    // Laboratorios
  createLab,
  getLabs,
  updateLab,
  deleteLab,
  regenerateLabApiKey,
  // Tiendas
  createStore,
  getStores,
  updateStore,
  // Usuarios
  resetUserPassword,
  // Dashboard
  getWarrantiesDashboard,
  // Logs
  getLogs,
  // CSV ← AGREGAR AQUÍ
  importCsv
};