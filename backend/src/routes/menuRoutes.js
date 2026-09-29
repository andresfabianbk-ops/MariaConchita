// Router de Express para el módulo de menú
const { Router } = require('express');
const { getMenu, postProducto, putProducto, deleteProducto, getProductosAdmin } = require('../controllers/menuController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = Router();

// GET /api/menu → obtener menú completo agrupado por categoría (público, sin protección)
router.get('/', getMenu);

// GET /api/menu/productos → listar todos los productos (Admin, incluye inactivos)
router.get('/productos', verificarToken, verificarRol('Administrador'), getProductosAdmin);

// POST /api/menu/productos → crear producto (solo Administrador)
router.post('/productos', verificarToken, verificarRol('Administrador'), postProducto);

// PUT /api/menu/productos/:id → editar producto (solo Administrador)
router.put('/productos/:id', verificarToken, verificarRol('Administrador'), putProducto);

// DELETE /api/menu/productos/:id → desactivar producto (solo Administrador)
router.delete('/productos/:id', verificarToken, verificarRol('Administrador'), deleteProducto);



module.exports = router;