// Router de Express para el módulo de pagos
const { Router } = require('express');
const { postPago, getPagos } = require('../controllers/pagoController');

const router = Router();

// POST /api/pagos → registrar pago
router.post('/', postPago);

// GET /api/pagos → listar pagos
router.get('/', getPagos);

module.exports = router;
