// backend/src/routes/labRoutes.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const requireRole = require('../middleware/role');
const {
  reprintTicket,
  regenerateVca,
  agentStatus,
  testPrint,
  getMyLabWarranties,
  updateLabConfig,
} = require('../controllers/labController');

// Proteccion: solo LABORATORIO y ADMIN
router.use(authenticateToken);
router.use(requireRole(['LABORATORIO', 'ADMIN']));

// Reimpresion
router.post('/print/:warrantyId', reprintTicket);

// Nueva: regenerar VCA sin imprimir
router.post('/regenerate-vca/:warrantyId', regenerateVca);

// Estado del agente
router.get('/agent-status', agentStatus);

// Prueba de impresion
router.post('/test-print', testPrint);

// Garantias del laboratorio
router.get('/warranties', getMyLabWarranties);

// Configuracion del lab (ruta VCA)
router.put('/config', updateLabConfig);

module.exports = router;
