// backend/src/routes/labRoutes.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const requireRole = require('../middleware/role');
const { reprintTicket } = require('../controllers/labController');

// 🔒 PROTECCIÓN GLOBAL: Solo LABORATORIO y ADMIN
router.use(authenticateToken);
router.use(requireRole(['LABORATORIO', 'ADMIN']));

// POST /api/lab/print/:warrantyId
router.post('/print/:warrantyId', reprintTicket);

module.exports = router;