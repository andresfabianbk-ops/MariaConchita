// Acceso a datos del módulo Categoría. Sin lógica de negocio: solo consultas SQL.
const db = require('../config/db');

/**
 * Inserta una nueva categoría.
 * @param {string} nombre
 * @returns {number} id_categoria generado
 */
async function crearCategoria(nombre) {
  const [resultado] = await db.query(
    'INSERT INTO Categoria (nombre) VALUES (?)',
    [nombre]
  );
  return resultado.insertId;
}

/**
 * Lista todas las categorías.
 * @returns {Array}
 */
async function listarCategorias() {
  const [filas] = await db.query('SELECT * FROM Categoria');
  return filas;
}

/**
 * Actualiza el nombre de una categoría existente.
 * @param {number} id
 * @param {string} nombre
 * @returns {number} filas afectadas (0 si el id no existe)
 */
async function actualizarCategoria(id, nombre) {
  const [resultado] = await db.query(
    'UPDATE Categoria SET nombre = ? WHERE id_categoria = ?',
    [nombre, id]
  );
  return resultado.affectedRows;
}

/**
 * Elimina una categoría por id.
 * @param {number} id
 * @returns {number} filas afectadas (0 si el id no existe)
 */
async function eliminarCategoria(id) {
  const [resultado] = await db.query(
    'DELETE FROM Categoria WHERE id_categoria = ?',
    [id]
  );
  return resultado.affectedRows;
}

/**
 * Cuenta cuántos productos tienen asignada esta categoría.
 * Usado por el service para decidir si se puede eliminar (integridad referencial).
 * @param {number} id
 * @returns {number}
 */
async function contarProductosPorCategoria(id) {
  const [filas] = await db.query(
    'SELECT COUNT(*) AS total FROM Producto WHERE id_categoria = ?',
    [id]
  );
  return filas[0].total;
}

module.exports = {
  crearCategoria,
  listarCategorias,
  actualizarCategoria,
  eliminarCategoria,
  contarProductosPorCategoria
};