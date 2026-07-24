// backend/src/server.js
require('dotenv').config(); // Cargar variables de entorno al inicio

const express = require('express');
const cors = require('cors');
const logger = require('./config/logger');

// 1. IMPORTAR RUTAS
const authRoutes = require('./routes/authRoutes');
const storeRoutes = require('./routes/storeRoutes');
const agentRoutes = require('./routes/agentRoutes');
const labRoutes = require('./routes/labRoutes');
const adminRoutes = require('./routes/adminRoutes');

// 2. IMPORTAR CRON JOBS
const { startOrphanCleanupCron } = require('./cron/orphanCleanup');

// 3. INICIALIZAR EXPRESS (¡ESTO DEBE IR ANTES DE CUALQUIER app.use!)
const app = express();
const PORT = process.env.PORT || 3000;

// 4. MIDDLEWARES GLOBALES
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. REGISTRAR RUTAS
app.use('/api/auth', authRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/admin', adminRoutes);

// Ruta de prueba (Health Check básico)
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'SGG Backend is running' });
});

// 6. INICIAR CRON JOBS (Después de que la app esté configurada)
startOrphanCleanupCron();

// 7. INICIAR EL SERVIDOR
app.listen(PORT, () => {
  logger.info(`🚀 Servidor corriendo en el puerto ${PORT}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/api/health`);
});

// Manejo de errores no capturados (opcional pero recomendado)
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});