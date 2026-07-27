// backend/src/routes/agentRoutes.js
const express = require('express');
const router = express.Router();
const apiKeyAuth = require('../middleware/apiKeyAuth');
const { getPending, completeWarranty, heartbeat } = require('../controllers/agentController');

// Todas las rutas del agente requieren autenticación por API Key
router.use(apiKeyAuth);

// GET /api/agent/pending
router.get('/pending', getPending);

// POST /api/agent/complete
router.post('/complete', completeWarranty);

// POST /api/agent/heartbeat
router.post('/heartbeat', heartbeat);

module.exports = router;