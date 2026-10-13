// backend/src/server.js
require('dotenv').config();

// ============================================================
// 1. VALIDACIÓN DE VARIABLES DE ENTORNO CRÍTICAS
// ============================================================
const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];
const recommendedVars = ['GESVISION_URL', 'GESVISION_USER', 'GESVISION_PASS', 'FRONTEND_URL'];

const missing = requiredVars.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error(`❌ Faltan variables de entorno críticas: ${missing.join(', ')}`);
  process.exit(1);
}

const missingRecommended = recommendedVars.filter((v) => !process.env[v]);
if (missingRecommended.length > 0) {
  console.warn(`⚠️ Variables recomendadas no configuradas: ${missingRecommended.join(', ')}`);
}

// ============================================================
// 2. IMPORTACIONES
// ============================================================
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const path = require('path');
const logger = require('./config/logger');

// Rutas
const authRoutes = require('./routes/authRoutes');
const storeRoutes = require('./routes/storeRoutes');
const labRoutes = require('./routes/labRoutes');
const adminRoutes = require('./routes/adminRoutes');

// ✅ NUEVO (PASO 6): Rutas del agente local de VCA
const agentRoutes = require('./routes/agentRoutes');

// Rutas de firma digital QZ Tray
const qzRoutes = require('./routes/qzRoutes');

// Cron Jobs
const { startOrphanCleanupCron } = require('./cron/orphanCleanup');

// 3. INICIALIZAR EXPRESS
const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.set('trust proxy', 1);

// ✅ MIDDLEWARES GLOBALES
// Helmet con CSP desactivada: la SPA se sirve desde el mismo backend y QZ Tray
// se comunica por WebSocket local; una CSP estricta rompería ambos flujos.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS restringido por lista blanca en FRONTEND_URL (admite varios orígenes separados por coma).
// Sin FRONTEND_URL configurado se mantiene el comportamiento permisivo previo.
// Las llamadas server-to-server (agente local de VCA) no envían Origin y no se ven afectadas.
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      logger.warn(`[CORS] Origen bloqueado: ${origin}`);
      return callback(new Error('Origen no permitido por CORS'));
    },
  })
);

// Rate limit solo para el login (fuerza bruta de credenciales)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.' },
});
app.use('/api/auth/login', loginLimiter);

// 5. REGISTRAR RUTAS DE API
app.use('/api/auth', authRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/admin', adminRoutes);

// ✅ NUEVO (PASO 6): Rutas del agente local de VCA
// (Se autentican con la API key del laboratorio, no con JWT)
app.use('/api/agent', agentRoutes);

// Firma digital QZ Tray: el frontend pide certificado y firmas para imprimir sin diálogos
app.use('/api/qz', qzRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'SGG Backend', uptime: process.uptime() });
});

// ======================================================
// 6. Servir el frontend (React/Vite) y Fallback SPA
// ======================================================
const frontendDistPath = path.join(__dirname, '../../frontend/dist');

app.use(express.static(frontendDistPath));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// ✅ MIDDLEWARE DE ERRORES (debe ir al final, después de todas las rutas)
// No se filtra err.message al cliente: el detalle queda solo en el log.
app.use((err, req, res, next) => {
  logger.error(`[Route Error] ${err.message}`, { stack: err.stack, path: req.path });
  res.status(500).json({ error: 'Internal Server Error' });
});

// ======================================================
// 7. INICIAR CRON JOBS
// ======================================================
startOrphanCleanupCron();

// 8. INICIAR EL SERVIDOR
const server = app.listen(PORT, () => {
  logger.info(`🚀 Servidor corriendo en el puerto ${PORT}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/api/health`);
});

// ============================================================
// 13. GRACEFUL SHUTDOWN
// ============================================================
const shutdown = (signal) => {
  logger.info(`📴 ${signal} recibido. Iniciando cierre elegante...`);
  if (server) {
    server.close(() => {
      logger.info('🔒 Servidor HTTP cerrado.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
  setTimeout(() => {
    logger.error('⚠️ Cierre forzado tras 10 segundos.');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ============================================================
// 14. ERRORES NO CAPTURADOS
// ============================================================
process.on('unhandledRejection', (reason) => {
  logger.error(`[unhandledRejection] ${reason}`, { stack: reason?.stack });
});

process.on('uncaughtException', (err) => {
  logger.error(`[uncaughtException] ${err.message}`, { stack: err.stack });
  shutdown('uncaughtException');
});