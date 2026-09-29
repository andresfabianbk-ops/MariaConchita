// Controlador HTTP del módulo Categoría.
const categoriaService = require('../services/categoriaService');

/**
 * Traduce el código de error de negocio a un status HTTP.
 * Evita repetir esta lógica en cada función del controller.
 */
function mapearStatus(codigo) {
  switch (codigo) {
    case 'DATOS_INVALIDOS':
      return 400;
    case 'NO_ENCONTRADA':
      return 404;
    case 'DUPLICADO':
    case 'CATEGORIA_EN_USO':
      return 409; // Conflict: la petición es válida pero choca con el estado actual de los datos
    default:
      return 500;
  }
}

// POST /api/categorias
async function postCategoria(req, res) {
  try {
    const { nombre } = req.body;
    const categoria = await categoriaService.crearCategoria(nombre);
    res.status(201).json(categoria);
  } catch (error) {
    res.status(mapearStatus(error.codigo)).json({ mensaje: error.message });
  }
}

// GET /api/categorias
async function getCategorias(req, res) {
  try {
    const categorias = await categoriaService.listarCategorias();
    res.status(200).json(categorias);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener las categorías' });
  }
}

// PUT /api/categorias/:id
async function putCategoria(req, res) {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    const categoria = await categoriaService.actualizarCategoria(id, nombre);
    res.status(200).json(categoria);
  } catch (error) {
    res.status(mapearStatus(error.codigo)).json({ mensaje: error.message });
  }
}

// DELETE /api/categorias/:id
async function deleteCategoria(req, res) {
  try {
    const { id } = req.params;
    await categoriaService.eliminarCategoria(id);
    res.status(200).json({ mensaje: 'Categoría eliminada correctamente' });
  } catch (error) {
    res.status(mapearStatus(error.codigo)).json({ mensaje: error.message });
  }
}

module.exports = {
  postCategoria,
  getCategorias,
  putCategoria,
  deleteCategoria
};