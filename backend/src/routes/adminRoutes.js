// backend/src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const authenticateToken = require('../middleware/auth');
const requireRole = require('../middleware/role');
const {
  // Laboratorios
  createLab,
  getLabs,
  updateLab,
  deleteLab,
  regenerateLabApiKey,
  // Tiendas
  createStore,
  getStores,
  updateStore,
  // Usuarios
  resetUserPassword,
  // Dashboard
  getWarrantiesDashboard,
  // Logs
  getLogs,
  // CSV
  importCsv,
} = require('../controllers/adminController');

// 🔒 PROTECCIÓN GLOBAL: Solo ADMIN
router.use(authenticateToken);
router.use(requireRole(['ADMIN']));

// Multer en memoria para CSV (no guarda en disco)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB máximo
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos CSV'));
    }
  },
});

// ============================================================
// RUTAS DE LABORATORIOS
// ============================================================
router.get('/labs', getLabs);
router.post('/labs', createLab);
router.put('/labs/:id', updateLab);
router.delete('/labs/:id', deleteLab);
router.post('/labs/:id/regenerate-key', regenerateLabApiKey);

// ============================================================
// RUTAS DE TIENDAS
// ============================================================
router.get('/stores', getStores);
router.post('/stores', createStore);
router.put('/stores/:id', updateStore);

// ============================================================
// RUTAS DE USUARIOS
// ============================================================
router.post('/users/:userId/reset-password', resetUserPassword);

// ============================================================
// DASHBOARD DE GARANTÍAS
// ============================================================
router.get('/warranties', getWarrantiesDashboard);

// ============================================================
// LOGS
// ============================================================
router.get('/logs', getLogs);

// ============================================================
// IMPORTACIÓN CSV
// ============================================================
router.post('/import-csv', upload.single('file'), importCsv);

module.exports = router;