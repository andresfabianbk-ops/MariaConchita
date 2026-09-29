// Router de Express para el módulo de categorías.
const { Router } = require('express');
const {
  postCategoria,
  getCategorias,
  putCategoria,
  deleteCategoria
} = require('../controllers/categoriaController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = Router();

// Todas las rutas de este módulo requieren estar autenticado y tener rol Administrador
router.use(verificarToken, verificarRol('Administrador'));

// POST /api/categorias → crear categoría
router.post('/', postCategoria);

// GET /api/categorias → listar categorías
router.get('/', getCategorias);

// PUT /api/categorias/:id → actualizar categoría
router.put('/:id', putCategoria);

// DELETE /api/categorias/:id → eliminar categoría
router.delete('/:id', deleteCategoria);

module.exports = router;