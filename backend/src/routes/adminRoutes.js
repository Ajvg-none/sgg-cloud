// backend/src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();

// Importamos los middlewares de seguridad
const authenticateToken = require('../middleware/auth');
const requireRole = require('../middleware/role');

// Importamos las funciones del controlador
const { 
  createUser, 
  updateUser, 
  resetPassword 
} = require('../controllers/adminUserController');

// 🔒 PROTECCIÓN GLOBAL DE ESTE ROUTER:
// Todas las rutas que se definan después de estas líneas requerirán:
// 1. Un token JWT válido (authenticateToken)
// 2. Que el rol del usuario sea 'ADMIN' (requireRole)
router.use(authenticateToken);
router.use(requireRole(['ADMIN']));

// Rutas
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.post('/users/:id/reset-password', resetPassword);

module.exports = router;