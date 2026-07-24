// backend/src/routes/storeRoutes.js
const express = require('express');
const router = express.Router();

// Middlewares de seguridad
const authenticateToken = require('../middleware/auth');
const requireRole = require('../middleware/role');

// Controladores
const {
  getOrder,
  createWarranty,
  getMyWarranties,
  getWarrantyDetail,
} = require('../controllers/storeController');

// 🔒 PROTECCIÓN GLOBAL: aplica a TODAS las rutas de este router
router.use(authenticateToken);
router.use(requireRole(['TIENDA']));

// --- Rutas existentes (Fase 4) ---
router.get('/order/:orderNumber', getOrder);
router.post('/warranties', createWarranty);

// --- Rutas nuevas (Fase 5 - RF-03) ---
router.get('/warranties', getMyWarranties);
router.get('/warranties/:id', getWarrantyDetail);

module.exports = router;