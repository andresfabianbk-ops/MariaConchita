// Lógica de negocio del módulo Categoría.
const categoriaRepository = require('../repositories/categoriaRepository');

/**
 * Crea una categoría nueva.
 * Valida que el nombre no esté vacío y maneja el error de nombre duplicado (UNIQUE).
 * @param {string} nombre
 */
async function crearCategoria(nombre) {
  const nombreLimpio = (nombre || '').trim();

  if (!nombreLimpio) {
    const error = new Error('El nombre de la categoría es obligatorio');
    error.codigo = 'DATOS_INVALIDOS';
    throw error;
  }

  try {
    const id = await categoriaRepository.crearCategoria(nombreLimpio);
    return { id_categoria: id, nombre: nombreLimpio };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      const errorDuplicado = new Error('Ya existe una categoría con ese nombre');
      errorDuplicado.codigo = 'DUPLICADO';
      throw errorDuplicado;
    }
    throw error;
  }
}

/**
 * Lista todas las categorías.
 */
async function listarCategorias() {
  return categoriaRepository.listarCategorias();
}

/**
 * Actualiza el nombre de una categoría.
 * @param {number} id
 * @param {string} nombre
 */
async function actualizarCategoria(id, nombre) {
  const nombreLimpio = (nombre || '').trim();

  if (!nombreLimpio) {
    const error = new Error('El nombre de la categoría es obligatorio');
    error.codigo = 'DATOS_INVALIDOS';
    throw error;
  }

  try {
    const filasAfectadas = await categoriaRepository.actualizarCategoria(id, nombreLimpio);

    if (filasAfectadas === 0) {
      const error = new Error('Categoría no encontrada');
      error.codigo = 'NO_ENCONTRADA';
      throw error;
    }

    return { id_categoria: Number(id), nombre: nombreLimpio };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      const errorDuplicado = new Error('Ya existe una categoría con ese nombre');
      errorDuplicado.codigo = 'DUPLICADO';
      throw errorDuplicado;
    }
    throw error;
  }
}

/**
 * Elimina una categoría, siempre que no tenga productos asociados.
 * Regla de negocio: no se elimina una categoría con productos (evita productos huérfanos).
 * @param {number} id
 */
async function eliminarCategoria(id) {
  const totalProductos = await categoriaRepository.contarProductosPorCategoria(id);

  if (totalProductos > 0) {
    const error = new Error(
      `No se puede eliminar: la categoría tiene ${totalProductos} producto(s) asociado(s)`
    );
    error.codigo = 'CATEGORIA_EN_USO';
    throw error;
  }

  const filasAfectadas = await categoriaRepository.eliminarCategoria(id);

  if (filasAfectadas === 0) {
    const error = new Error('Categoría no encontrada');
    error.codigo = 'NO_ENCONTRADA';
    throw error;
  }

  return true;
}

module.exports = {
  crearCategoria,
  listarCategorias,
  actualizarCategoria,
  eliminarCategoria
};