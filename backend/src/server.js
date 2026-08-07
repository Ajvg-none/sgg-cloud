// backend/src/server.js
require('dotenv').config(); // Cargar variables de entorno al inicio

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
const logger = require('./config/logger');

// Rutas
const authRoutes = require('./routes/authRoutes');
const storeRoutes = require('./routes/storeRoutes');
const agentRoutes = require('./routes/agentRoutes');
const labRoutes = require('./routes/labRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Cron Jobs
const { startOrphanCleanupCron } = require('./cron/orphanCleanup');

// ============================================================
// 3. INICIALIZAR EXPRESS
// ============================================================
const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Confiar en el primer proxy (necesario detrás de Nginx, Render, Railway, Cloudflare)
// Esto hace que req.ip y rate-limit vean la IP real del cliente
app.set('trust proxy', 1);

// ============================================================
// 4. SEGURIDAD: HELMET (headers HTTP seguros)
// ============================================================
app.use(helmet());

// ============================================================
// 5. CORS RESTRINGIDO
// ============================================================
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Permitir requests sin header Origin (curl, apps móviles, agente local server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    logger.warn(`[CORS] Origen bloqueado: ${origin}`);
    return callback(new Error('No permitido por CORS'));
  },
  credentials: true,
}));

// ============================================================
// 6. RATE LIMITING (protección contra fuerza bruta / abuso)
// ============================================================
const commonHeaders = { standardHeaders: 'draft-7', legacyHeaders: false };

// Login: muy estricto para evitar fuerza bruta
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 intentos por IP
  ...commonHeaders,
  message: { error: 'Demasiados intentos de inicio de sesión. Espera 15 minutos.' },
});

// Agente: permisivo porque hace polling frecuente
const agentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 1000, // margen amplio para polling de varios labs
  ...commonHeaders,
  message: { error: 'Demasiadas solicitudes del agente.' },
});

// General para el resto de la API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // 100 req/min por IP
  ...commonHeaders,
  skip: (req) =>
    req.originalUrl.startsWith('/api/agent') ||
    req.originalUrl === '/api/auth/login',
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' },
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/agent', agentLimiter);
app.use('/api', apiLimiter);

// ============================================================
// 7. PARSERS DE BODY
// ============================================================
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ============================================================
// 8. RUTAS
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/admin', adminRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'SGG Backend', uptime: process.uptime() });
});

// ============================================================
// 9. CRON JOBS
// ============================================================
startOrphanCleanupCron();

// ============================================================
// 10. 404 PARA RUTAS NO ENCONTRADAS
// ============================================================
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

// ============================================================
// 11. MANEJO GLOBAL DE ERRORES
// ============================================================
app.use((err, req, res, next) => {
  logger.error(`[ErrorHandler] ${err.message}`, { stack: err.stack, url: req.originalUrl });
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: status < 500 ? err.message : 'Error interno del servidor.',
  });
});

// ============================================================
// 12. INICIAR SERVIDOR
// ============================================================
const server = app.listen(PORT, () => {
  logger.info(`🚀 Servidor corriendo en el puerto ${PORT} (${NODE_ENV})`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/api/health`);
});

// ============================================================
// 13. GRACEFUL SHUTDOWN (cierre limpio en Render/Docker/VPS)
// ============================================================
const shutdown = (signal) => {
  logger.info(`📴 ${signal} recibido. Iniciando cierre elegante...`);
  server.close(() => {
    logger.info('🔒 Servidor HTTP cerrado.');
    process.exit(0);
  });
  // Forzar salida si no logra cerrar en 10 segundos
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