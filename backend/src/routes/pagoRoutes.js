// Router de Express para el módulo de pagos
const { Router } = require('express');
const { postPago, getPagos } = require('../controllers/pagoController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = Router();

// POST /api/pagos → registrar el pago de un pedido (solo { idPedido, metodo })
router.post('/', verificarToken, verificarRol('Administrador', 'Cajero'), postPago);

// GET /api/pagos → listar pagos
router.get('/', verificarToken, verificarRol('Administrador', 'Cajero'), getPagos);

module.exports = router;