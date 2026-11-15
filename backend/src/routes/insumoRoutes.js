// Router de Express para el módulo de insumos (inventario)
const { Router } = require('express');
const { getInsumos, postMovimiento, postInsumo, putInsumo } = require('../controllers/insumoController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = Router();

// GET /api/insumos → insumos con su nivel de stock (solo Administrador)
router.get('/', verificarToken, verificarRol('Administrador'), getInsumos);

// POST /api/insumos/:id/movimientos → entrada o merma ({ tipo, cantidad, motivo })
router.post('/:id/movimientos', verificarToken, verificarRol('Administrador'), postMovimiento);

// POST /api/insumos → crea un insumo ({ nombre, unidadMedida, stockMinimo, costoUnitario })
router.post('/', verificarToken, verificarRol('Administrador'), postInsumo);

// PUT /api/insumos/:id → edita un insumo (mismo body que al crear)
router.put('/:id', verificarToken, verificarRol('Administrador'), putInsumo);

module.exports = router;