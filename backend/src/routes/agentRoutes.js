// backend/src/routes/agentRoutes.js
const express = require('express');
const router = express.Router();
const apiKeyAuth = require('../middleware/apiKeyAuth');
const { getPending, completeWarranty } = require('../controllers/agentController');

// Todas las rutas del agente requieren autenticación por API Key
router.use(apiKeyAuth);

// GET /api/agent/pending
router.get('/pending', getPending);

// POST /api/agent/complete
router.post('/complete', completeWarranty);

module.exports = router;