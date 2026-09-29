// Router de Express para el módulo de pedidos
const { Router } = require('express');
const { postPedido, getPedidos, putEstadoPedido, putPagarPedido } = require('../controllers/pedidoController');

const router = Router();

// POST /api/pedidos → crear pedido
router.post('/', postPedido);

// GET /api/pedidos → listar pedidos
router.get('/', getPedidos);

// PUT /api/pedidos/:id → actualizar estado del pedido
router.put('/:id', putEstadoPedido);

// PUT /api/pedidos/:id/pagar → marcar pedido como pagado
router.put('/:id/pagar', putPagarPedido);

module.exports = router;