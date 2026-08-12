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
const path = require('path'); // <-- NUEVO: Necesario para servir archivos estáticos
const logger = require('./config/logger');

// Rutas
const authRoutes = require('./routes/authRoutes');
const storeRoutes = require('./routes/storeRoutes');
const agentRoutes = require('./routes/agentRoutes');
const labRoutes = require('./routes/labRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Cron Jobs
const { startOrphanCleanupCron } = require('./cron/orphanCleanup');

// 3. INICIALIZAR EXPRESS
const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Confiar en el primer proxy (necesario detrás de Nginx, Render, Railway, Cloudflare)
// Esto hace que req.ip y rate-limit vean la IP real del cliente
app.set('trust proxy', 1);

// 5. REGISTRAR RUTAS DE API (TODAS las que empiezan con /api)
app.use('/api/auth', authRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/admin', adminRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'SGG Backend', uptime: process.uptime() });
});

// ======================================================
// 6. NUEVO BLOQUE: Servir el frontend (React/Vite) y Fallback SPA
// ======================================================
// NOTA: Este bloque debe ir DESPUÉS de todas las rutas /api
// y ANTES de app.listen()

const frontendDistPath = path.join(__dirname, '../../frontend/dist');

// 6a. Servir archivos estáticos (CSS, JS, imágenes, etc.)
app.use(express.static(frontendDistPath));

// 6b. Middleware de fallback para SPA (Express 5 compatible)
// Atrapa TODAS las rutas que NO empiecen con /api y envía index.html
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next(); // Las rutas /api ya fueron manejadas arriba, pero por si acaso
  }
  // Cualquier otra ruta (/, /store, /dashboard, etc.) devuelve el index.html
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});
// ======================================================

// 7. INICIAR CRON JOBS (Después de que la app esté configurada)
startOrphanCleanupCron();

// 8. INICIAR EL SERVIDOR
const server = app.listen(PORT, () => {
  logger.info(`🚀 Servidor corriendo en el puerto ${PORT}`);
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