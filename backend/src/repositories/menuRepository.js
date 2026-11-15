// Repositorio de menú: consultas reales a la base de datos MySQL
const db = require('../config/db');

// Crea un error de negocio con .codigo (traducido a HTTP en el controller)
const crearError = (codigo, mensaje) => {
  const error = new Error(mensaje);
  error.codigo = codigo;
  return error;
};

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

// Retorna la receta completa (cantidad y unidad) de todos los productos, para el panel de Administrador
const obtenerRecetasAdmin = async () => {
  const [filas] = await db.query(`
    SELECT rp.id_producto, rp.id_insumo, i.nombre AS insumo, i.unidad_medida,
           rp.cantidad_requerida, rp.es_excluible
    FROM RecetaProducto rp
    JOIN Insumo i ON rp.id_insumo = i.id_insumo
    ORDER BY i.nombre
  `);
  return filas.map((fila) => ({
    id_producto: fila.id_producto,
    id_insumo: fila.id_insumo,
    insumo: fila.insumo,
    unidad_medida: fila.unidad_medida,
    cantidad_requerida: Number(fila.cantidad_requerida), // mysql2 devuelve DECIMAL como string
    es_excluible: !!fila.es_excluible
  }));
};

// Reemplaza la receta de un producto dentro de una transacción ya abierta (recibe la conexión)
const guardarRecetaProducto = async (conexion, idProducto, receta) => {
  if (receta.length > 0) {
    const ids = receta.map((item) => item.id_insumo);
    const [existentes] = await conexion.query('SELECT id_insumo FROM Insumo WHERE id_insumo IN (?)', [ids]);
    if (existentes.length !== new Set(ids).size) {
      throw crearError('DATOS_INVALIDOS', 'Algún insumo de la receta no existe');
    }
  }

  await conexion.query('DELETE FROM RecetaProducto WHERE id_producto = ?', [idProducto]);

  if (receta.length > 0) {
    const filas = receta.map((item) => [idProducto, item.id_insumo, item.cantidad_requerida, item.es_excluible ? 1 : 0]);
    await conexion.query(
      'INSERT INTO RecetaProducto (id_producto, id_insumo, cantidad_requerida, es_excluible) VALUES ?',
      [filas]
    );
  }
};

// Inserta un nuevo producto junto con su receta (transacción: se guardan los dos o ninguno)
const crearProducto = async (nombre, precio, id_categoria, disponible = true, receta = []) => {
  const conexion = await db.getConnection();

  try {
    await conexion.beginTransaction();
    const [resultado] = await conexion.query(
      'INSERT INTO Producto (nombre, precio, id_categoria, disponible) VALUES (?, ?, ?, ?)',
      [nombre, precio, id_categoria, disponible]
    );
    await guardarRecetaProducto(conexion, resultado.insertId, receta);
    await conexion.commit();
    return resultado.insertId;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
};

// Busca un producto por id (usado para validar existencia antes de editar/eliminar)
const obtenerProductoPorId = async (id) => {
  const [filas] = await db.query('SELECT * FROM Producto WHERE id_producto = ?', [id]);
  return filas[0] || null;
};

// Actualiza los campos editables de un producto. Si llega receta (incluso vacía) la reemplaza;
// si es undefined no la toca
const actualizarProducto = async (id, nombre, precio, id_categoria, disponible, receta) => {
  const conexion = await db.getConnection();

  try {
    await conexion.beginTransaction();
    const [resultado] = await conexion.query(
      'UPDATE Producto SET nombre = ?, precio = ?, id_categoria = ?, disponible = ? WHERE id_producto = ?',
      [nombre, precio, id_categoria, disponible, id]
    );
    if (receta !== undefined) {
      await guardarRecetaProducto(conexion, id, receta);
    }
    await conexion.commit();
    return resultado.affectedRows;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
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

module.exports = { obtenerCategoriasConProductos, obtenerIngredientesPorProducto, crearProducto, obtenerProductoPorId, actualizarProducto, desactivarProducto, listarProductosAdmin, obtenerRecetasAdmin };