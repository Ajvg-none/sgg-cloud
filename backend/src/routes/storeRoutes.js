// backend/src/routes/storeRoutes.js
const express = require('express');
const router = express.Router();

// Importamos los middlewares de seguridad
const authenticateToken = require('../middleware/auth');
const requireRole = require('../middleware/role');

// Importamos las funciones del controlador de tienda
const { getOrder, createWarranty } = require('../controllers/storeController');

// 🔒 PROTECCIÓN GLOBAL DE ESTE ROUTER:
// Todas las rutas definidas después de estas líneas requerirán:
// 1. Un token JWT válido (authenticateToken)
// 2. Que el rol del usuario sea 'TIENDA' (requireRole)
router.use(authenticateToken);
router.use(requireRole(['TIENDA']));

// Rutas
// GET /api/store/order/:orderNumber
router.get('/order/:orderNumber', getOrder);

// POST /api/store/warranties
router.post('/warranties', createWarranty);

module.exports = router;