// Router de Express para el dashboard del Administrador
const { Router } = require('express');
const { getResumenDashboard } = require('../controllers/dashboardController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = Router();

// GET /api/dashboard/resumen → solo Administrador
router.get('/resumen', verificarToken, verificarRol('Administrador'), getResumenDashboard);

module.exports = router;