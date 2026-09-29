// Importa las funciones del repositorio
const { guardarPedido, obtenerPedidos, actualizarEstadoPedido, marcarPedidoPagado } = require('../repositories/pedidoRepository');

// Lógica de negocio: crea un pedido con validación básica
const crearPedido = (datosPedido) => {
  if (!datosPedido.productos || datosPedido.productos.length === 0) {
    throw new Error('El pedido debe tener al menos un producto');
  }
  const nuevoPedido = { ...datosPedido, estado: 'Pendiente', pagado: false };
  return guardarPedido(nuevoPedido);
};

// Lógica de negocio: lista los pedidos
const listarPedidos = () => {
  return obtenerPedidos();
};

// Lógica de negocio: cambia el estado de un pedido
const cambiarEstadoPedido = (indice, nuevoEstado) => {
  const estadosValidos = ['Pendiente', 'En preparación', 'Listo', 'Entregado'];
  if (!estadosValidos.includes(nuevoEstado)) {
    throw new Error('Estado no válido');
  }
  const pedido = actualizarEstadoPedido(indice, nuevoEstado);
  if (!pedido) {
    throw new Error('Pedido no encontrado');
  }
  return pedido;
};

// Lógica de negocio: marca un pedido como pagado
const pagarPedido = (indice) => {
  const pedido = marcarPedidoPagado(indice);
  if (!pedido) {
    throw new Error('Pedido no encontrado');
  }
  return pedido;
};

module.exports = { crearPedido, listarPedidos, cambiarEstadoPedido, pagarPedido };