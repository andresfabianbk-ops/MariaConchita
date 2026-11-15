// Router de Express para el módulo de reportes (RF10)
const { Router } = require('express');
const { getReporte, getReporteExcel } = require('../controllers/reporteController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = Router();

// GET /api/reportes/:tipo → resumen, productos o inventario (solo Administrador)
router.get('/:tipo', verificarToken, verificarRol('Administrador'), getReporte);
// GET /api/reportes/:tipo/excel → descarga .xlsx (solo Administrador)
router.get('/:tipo/excel', verificarToken, verificarRol('Administrador'), getReporteExcel);

module.exports = router;