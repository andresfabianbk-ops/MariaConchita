// Router de Express para el módulo de pedidos
const { Router } = require('express');
const {
  postPedido,
  getPedidos,
  putEstadoPedido,
  putCancelarPedido,
  putConfirmarCancelacion,
  putDespacharPedido,
  putEntregaDomicilio
} = require('../controllers/pedidoController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = Router();

// POST /api/pedidos → crear pedido (domicilio desde la web; mesa desde la app del Mesero)
router.post('/', verificarToken, verificarRol('Administrador', 'Cajero', 'Mesero'), postPedido);

// GET /api/pedidos → listar pedidos (filtros: tipo, estado, abiertos)
router.get('/', verificarToken, verificarRol('Administrador', 'Cajero', 'Cocinero', 'Mesero'), getPedidos);

// PUT /api/pedidos/:id → avanzar al siguiente estado (En preparación, Listo, Entregado)
router.put('/:id', verificarToken, verificarRol('Administrador', 'Cajero', 'Cocinero'), putEstadoPedido);

// PUT /api/pedidos/:id/cancelar → cancelar pedido Pendiente y devolver stock
router.put('/:id/cancelar', verificarToken, verificarRol('Administrador', 'Cajero'), putCancelarPedido);

// PUT /api/pedidos/:id/confirmar-cancelacion → la cocina confirma el aviso de cancelación
router.put('/:id/confirmar-cancelacion', verificarToken, verificarRol('Administrador', 'Cocinero'), putConfirmarCancelacion);

// PUT /api/pedidos/:id/despachar → entregar el pedido a domicilio al domiciliario
router.put('/:id/despachar', verificarToken, verificarRol('Administrador', 'Cajero'), putDespacharPedido);

// PUT /api/pedidos/:id/entrega → registrar que el domicilio llegó al cliente
router.put('/:id/entrega', verificarToken, verificarRol('Administrador', 'Cajero'), putEntregaDomicilio);

module.exports = router;