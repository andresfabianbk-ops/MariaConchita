// Router de Express para el módulo de caja
const { Router } = require('express');
const { getCajaHoy, postApertura, postCierre } = require('../controllers/cajaController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = Router();

// GET /api/caja/hoy → estado de la caja de hoy (o { abierta: false })
router.get('/hoy', verificarToken, verificarRol('Administrador', 'Cajero'), getCajaHoy);

// POST /api/caja/apertura → abrir la caja de hoy ({ fondoInicial })
router.post('/apertura', verificarToken, verificarRol('Administrador', 'Cajero'), postApertura);

// POST /api/caja/cierre → cerrar la caja de hoy ({ efectivoContado })
router.post('/cierre', verificarToken, verificarRol('Administrador', 'Cajero'), postCierre);

module.exports = router;