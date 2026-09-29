// Importa las funciones del repositorio
const { obtenerCategoriasConProductos, obtenerIngredientesPorProducto, crearProducto, obtenerProductoPorId, actualizarProducto, desactivarProducto, listarProductosAdmin } = require('../repositories/menuRepository');

// Arma el menú agrupado por categoría, con los ingredientes de cada producto
const obtenerMenuCompleto = async () => {
  const { categorias, productos } = await obtenerCategoriasConProductos();
  const ingredientes = await obtenerIngredientesPorProducto();

  return categorias.map(categoria => ({
    categoria: categoria.nombre,
    productos: productos
      .filter(p => p.id_categoria === categoria.id_categoria)
      .map(p => ({
        id: p.id,
        nombre: p.nombre,
        precio: p.precio,
        ingredientes: ingredientes
          .filter(i => i.id_producto === p.id)
          .map(i => ({ id_insumo: i.id_insumo, nombre: i.ingrediente, es_excluible: !!i.es_excluible  }))
      }))
  }));
};

// Devuelve todos los productos (disponibles e inactivos) para el panel de Administrador
const obtenerProductosAdmin = async () => {
  return await listarProductosAdmin();
};

// Valida y crea un nuevo producto
const registrarProducto = async (nombre, precio, id_categoria, disponible) => {
  const nombreLimpio = (nombre || '').trim();

  if (!nombreLimpio) {
    const error = new Error('El nombre del producto es obligatorio');
    error.codigo = 'DATOS_INVALIDOS';
    throw error;
  }

  if (typeof precio !== 'number' || precio <= 0) {
    const error = new Error('El precio debe ser un número mayor a 0');
    error.codigo = 'DATOS_INVALIDOS';
    throw error;
  }

  if (!id_categoria) {
    const error = new Error('Debe indicar la categoría del producto');
    error.codigo = 'DATOS_INVALIDOS';
    throw error;
  }

  try {
    const id = await crearProducto(nombreLimpio, precio, id_categoria, disponible ?? true);
    return { id_producto: id, nombre: nombreLimpio, precio, id_categoria, disponible: disponible ?? true };
  } catch (error) {
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      const errorCategoria = new Error('La categoría indicada no existe');
      errorCategoria.codigo = 'DATOS_INVALIDOS';
      throw errorCategoria;
    }
    throw error;
  }
};

// Valida existencia y actualiza un producto
const editarProducto = async (id, nombre, precio, id_categoria, disponible) => {
  const productoExistente = await obtenerProductoPorId(id);

  if (!productoExistente) {
    const error = new Error('Producto no encontrado');
    error.codigo = 'NO_ENCONTRADA';
    throw error;
  }

  const nombreLimpio = (nombre || '').trim();

  if (!nombreLimpio) {
    const error = new Error('El nombre del producto es obligatorio');
    error.codigo = 'DATOS_INVALIDOS';
    throw error;
  }

  if (typeof precio !== 'number' || precio <= 0) {
    const error = new Error('El precio debe ser un número mayor a 0');
    error.codigo = 'DATOS_INVALIDOS';
    throw error;
  }

  await actualizarProducto(id, nombreLimpio, precio, id_categoria, disponible);
  return { id_producto: Number(id), nombre: nombreLimpio, precio, id_categoria, disponible };
};

// Borrado lógico: marca el producto como no disponible
const eliminarProducto = async (id) => {
  const productoExistente = await obtenerProductoPorId(id);

  if (!productoExistente) {
    const error = new Error('Producto no encontrado');
    error.codigo = 'NO_ENCONTRADA';
    throw error;
  }

  await desactivarProducto(id);
  return true;
};



module.exports = { obtenerMenuCompleto, registrarProducto, editarProducto, eliminarProducto, obtenerProductosAdmin };
