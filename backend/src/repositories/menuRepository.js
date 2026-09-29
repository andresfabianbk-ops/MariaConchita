// Repositorio de menú: consultas reales a la base de datos MySQL
const db = require('../config/db');

// Retorna todas las categorías con sus productos
const obtenerCategoriasConProductos = async () => {
  const [categorias] = await db.query('SELECT id_categoria, nombre FROM Categoria');
  const [productos] = await db.query(`
    SELECT id_producto AS id, nombre, precio, id_categoria
    FROM Producto
    WHERE disponible = TRUE
  `);
  return { categorias, productos };
};

// Retorna TODOS los productos (disponibles e inactivos) para el panel de Administrador
const listarProductosAdmin = async () => {
  const [productos] = await db.query(`
    SELECT id_producto, nombre, precio, id_categoria, disponible
    FROM Producto
    ORDER BY nombre
  `);
  return productos;
};

// Retorna los ingredientes (insumos) de la receta de un producto
const obtenerIngredientesPorProducto = async () => {
  const [filas] = await db.query(`
    SELECT rp.id_producto, i.id_insumo, i.nombre AS ingrediente,  rp.es_excluible
    FROM RecetaProducto rp
    JOIN Insumo i ON rp.id_insumo = i.id_insumo
  `);
  return filas;
};

// Inserta un nuevo producto
const crearProducto = async (nombre, precio, id_categoria, disponible = true) => {
  const [resultado] = await db.query(
    'INSERT INTO Producto (nombre, precio, id_categoria, disponible) VALUES (?, ?, ?, ?)',
    [nombre, precio, id_categoria, disponible]
  );
  return resultado.insertId;
};

// Busca un producto por id (usado para validar existencia antes de editar/eliminar)
const obtenerProductoPorId = async (id) => {
  const [filas] = await db.query('SELECT * FROM Producto WHERE id_producto = ?', [id]);
  return filas[0] || null;
};

// Actualiza los campos editables de un producto
const actualizarProducto = async (id, nombre, precio, id_categoria, disponible) => {
  const [resultado] = await db.query(
    'UPDATE Producto SET nombre = ?, precio = ?, id_categoria = ?, disponible = ? WHERE id_producto = ?',
    [nombre, precio, id_categoria, disponible, id]
  );
  return resultado.affectedRows;
};

// Borrado lógico: marca el producto como no disponible en vez de eliminarlo físicamente
// (evita romper integridad con DetallePedido/RecetaProducto históricos)
const desactivarProducto = async (id) => {
  const [resultado] = await db.query(
    'UPDATE Producto SET disponible = FALSE WHERE id_producto = ?',
    [id]
  );
  return resultado.affectedRows;
};

module.exports = { obtenerCategoriasConProductos, obtenerIngredientesPorProducto, crearProducto, obtenerProductoPorId, actualizarProducto, desactivarProducto, listarProductosAdmin };