// backend/src/routes/labRoutes.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const requireRole = require('../middleware/role');
const {
  processWarranty,
  reprintTicket,
  agentStatus,
  testPrint,
  getMyLabWarranties,
  getMyStores,
} = require('../controllers/labController');

// Proteccion: solo LABORATORIO y ADMIN
router.use(authenticateToken);
router.use(requireRole(['LABORATORIO', 'ADMIN']));

// Procesar garantia (imprimir ticket + generar VCA + marcar COMPLETED)
router.post('/warranties/:warrantyId/process', processWarranty);

// Reimpresion
router.post('/print/:warrantyId', reprintTicket);

// Estado del agente
router.get('/agent-status', agentStatus);

// Prueba de impresion
router.post('/test-print', testPrint);

// Garantias del laboratorio
router.get('/warranties', getMyLabWarranties);

// Tiendas del laboratorio
router.get('/stores', getMyStores);

module.exports = router;