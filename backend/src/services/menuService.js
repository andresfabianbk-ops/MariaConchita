// Importa las funciones del repositorio
const { obtenerCategoriasConProductos, obtenerIngredientesPorProducto, crearProducto, obtenerProductoPorId, actualizarProducto, desactivarProducto, listarProductosAdmin, obtenerRecetasAdmin } = require('../repositories/menuRepository');

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

// Devuelve todos los productos (disponibles e inactivos) con su receta, para el panel de Administrador
const obtenerProductosAdmin = async () => {
  const productos = await listarProductosAdmin();
  const recetas = await obtenerRecetasAdmin();

  return productos.map((producto) => ({
    ...producto,
    receta: recetas
      .filter((item) => item.id_producto === producto.id_producto)
      .map(({ id_producto, ...ingrediente }) => ingrediente) // el id del producto ya está en el padre
  }));
};

const CANTIDAD_MAXIMA_RECETA = 9999999.999; // límite de DECIMAL(10,3)

// Valida y normaliza la receta: undefined = no tocarla; un arreglo (incluso vacío) la reemplaza
const validarReceta = (receta) => {
  if (receta === undefined) return undefined;

  if (!Array.isArray(receta)) {
    const error = new Error('La receta debe ser una lista de ingredientes');
    error.codigo = 'DATOS_INVALIDOS';
    throw error;
  }

  const idsVistos = new Set();

  return receta.map((item) => {
    const idInsumo = Number(item?.id_insumo);
    if (!Number.isInteger(idInsumo) || idInsumo <= 0) {
      const error = new Error('Cada ingrediente debe indicar un insumo válido');
      error.codigo = 'DATOS_INVALIDOS';
      throw error;
    }

    if (idsVistos.has(idInsumo)) {
      const error = new Error('Un insumo no puede repetirse en la receta');
      error.codigo = 'DATOS_INVALIDOS';
      throw error;
    }
    idsVistos.add(idInsumo);

    const bruto = item.cantidad_requerida;
    const cantidad = Number(bruto);
    const cantidadValida =
      bruto !== undefined && bruto !== null && bruto !== '' && typeof bruto !== 'boolean' &&
      Number.isFinite(cantidad) &&
      cantidad > 0 &&
      cantidad <= CANTIDAD_MAXIMA_RECETA &&
      Math.round(cantidad * 1000) / 1000 === cantidad;
    if (!cantidadValida) {
      const error = new Error('La cantidad de cada ingrediente debe ser mayor a 0, con máximo 3 decimales');
      error.codigo = 'DATOS_INVALIDOS';
      throw error;
    }

    if (typeof item.es_excluible !== 'boolean') {
      const error = new Error('es_excluible debe ser verdadero o falso');
      error.codigo = 'DATOS_INVALIDOS';
      throw error;
    }

    return { id_insumo: idInsumo, cantidad_requerida: cantidad, es_excluible: item.es_excluible };
  });
};

// Valida y crea un nuevo producto
const registrarProducto = async (nombre, precio, id_categoria, disponible, receta) => {
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

  const recetaValidada = validarReceta(receta);

  try {
    const id = await crearProducto(nombreLimpio, precio, id_categoria, disponible ?? true, recetaValidada);
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
const editarProducto = async (id, nombre, precio, id_categoria, disponible, receta) => {
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

  const recetaValidada = validarReceta(receta);

  await actualizarProducto(id, nombreLimpio, precio, id_categoria, disponible, recetaValidada);
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
