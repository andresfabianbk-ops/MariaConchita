// Importa la lógica de negocio
const { obtenerMenuCompleto, registrarProducto, editarProducto, eliminarProducto, obtenerProductosAdmin } = require('../services/menuService');

// Traduce el código de error de negocio a un status HTTP
function mapearStatus(codigo) {
  switch (codigo) {
    case 'DATOS_INVALIDOS':
      return 400;
    case 'NO_ENCONTRADA':
      return 404;
    default:
      return 500;
  }
}

// Maneja la petición HTTP para obtener el menú completo
const getMenu = async (req, res) => {
  try {
    const menu = await obtenerMenuCompleto();
    res.status(200).json(menu);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/menu/productos → lista todos los productos (disponibles e inactivos) para el panel de Administrador
const getProductosAdmin = async (req, res) => {
  try {
    const productos = await obtenerProductosAdmin();
    res.status(200).json(productos);
  } catch (error) {
    res.status(mapearStatus(error.codigo)).json({ mensaje: error.message });
  }
};

// POST /api/menu/productos → crear producto
const postProducto = async (req, res) => {
  try {
    const { nombre, precio, id_categoria, disponible } = req.body;
    const producto = await registrarProducto(nombre, precio, id_categoria, disponible);
    res.status(201).json(producto);
  } catch (error) {
    res.status(mapearStatus(error.codigo)).json({ mensaje: error.message });
  }
};

// PUT /api/menu/productos/:id → editar producto
const putProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, precio, id_categoria, disponible } = req.body;
    const producto = await editarProducto(id, nombre, precio, id_categoria, disponible);
    res.status(200).json(producto);
  } catch (error) {
    res.status(mapearStatus(error.codigo)).json({ mensaje: error.message });
  }
};

// DELETE /api/menu/productos/:id → borrado lógico (disponible = false)
const deleteProducto = async (req, res) => {
  try {
    const { id } = req.params;
    await eliminarProducto(id);
    res.status(200).json({ mensaje: 'Producto desactivado correctamente' });
  } catch (error) {
    res.status(mapearStatus(error.codigo)).json({ mensaje: error.message });
  }
};

module.exports = { getMenu, postProducto, putProducto, deleteProducto, getProductosAdmin };