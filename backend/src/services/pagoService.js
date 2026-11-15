// Servicio de pagos: valida los datos y delega la transacción al repositorio
const { guardarPago, obtenerPagos } = require('../repositories/pagoRepository');

// Valores exactos del ENUM Pago.metodo
const METODOS_VALIDOS = ['Efectivo', 'Nequi', 'Daviplata', 'Tarjeta'];

// Crea un error de negocio con .codigo (traducido a HTTP en el controller)
const crearError = (codigo, mensaje) => {
  const error = new Error(mensaje);
  error.codigo = codigo;
  return error;
};

// Registra el pago de un pedido. El valor NO viene del cliente: lo calcula el repositorio
const registrarPago = async ({ idPedido, metodo } = {}) => {
  const id = Number(idPedido);
  if (!Number.isInteger(id) || id <= 0) {
    throw crearError('DATOS_INVALIDOS', 'Debe indicar un pedido válido');
  }
  if (!METODOS_VALIDOS.includes(metodo)) {
    throw crearError('DATOS_INVALIDOS', 'Método de pago no válido');
  }
  return await guardarPago({ idPedido: id, metodo });
};

// Obtiene todos los pagos registrados
const listarPagos = async () => {
  return await obtenerPagos();
};

module.exports = { registrarPago, listarPagos };