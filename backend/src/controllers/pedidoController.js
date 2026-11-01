// Importa la lógica de negocio
const { crearPedido, listarPedidos, cambiarEstadoPedido, cancelarPedido, confirmarCancelacion, despacharPedido, entregarPedidoAlCliente } = require('../services/pedidoService');
// Traduce el código de error de negocio a un status HTTP
function mapearStatus(codigo) {
  switch (codigo) {
    case 'DATOS_INVALIDOS':
      return 400;
    case 'NO_AUTORIZADO':
      return 401;
    case 'NO_ENCONTRADA':
      return 404;
    case 'DUPLICADO':
      return 409;
    case 'OPERACION_NO_PERMITIDA':
      return 403;
    default:
      return 500;
  }
}

// Responde un error: los de negocio con su status y mensaje; los inesperados como 500 sin exponer detalles
const responderError = (res, error) => {
  const status = mapearStatus(error.codigo);
  if (status === 500) {
    console.error('Error en pedidos:', error); // el detalle queda en la consola del servidor
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
  res.status(status).json({ mensaje: error.message });
};

// Maneja la petición HTTP para crear un pedido
const postPedido = async (req, res) => {
  try {
    const pedido = await crearPedido(req.body);
    res.status(201).json(pedido);
  } catch (error) {
    responderError(res, error);
  }
};

// Maneja la petición HTTP para listar pedidos
const getPedidos = async (req, res) => {
  try {
    res.status(200).json(await listarPedidos(req.query));
  } catch (error) {
    responderError(res, error);
  }
};

// Maneja la petición HTTP para actualizar el estado de un pedido
const putEstadoPedido = async (req, res) => {
  try {
    const idPedido = Number(req.params.id);
    const pedido = await cambiarEstadoPedido(idPedido, req.body?.estado);
    res.status(200).json(pedido);
  } catch (error) {
    responderError(res, error);
  }
};

// Maneja la petición HTTP para cancelar un pedido
const putCancelarPedido = async (req, res) => {
  try {
    const idPedido = Number(req.params.id);
    const pedido = await cancelarPedido(idPedido);
    res.status(200).json(pedido);
  } catch (error) {
    responderError(res, error);
  }
};

// Maneja la petición HTTP en la que la cocina confirma el aviso de cancelación
const putConfirmarCancelacion = async (req, res) => {
  try {
    const idPedido = Number(req.params.id);
    const pedido = await confirmarCancelacion(idPedido);
    res.status(200).json(pedido);
  } catch (error) {
    responderError(res, error);
  }
};

// Maneja la petición HTTP para despachar un pedido a domicilio (se entrega al domiciliario)
const putDespacharPedido = async (req, res) => {
  try {
    const idPedido = Number(req.params.id);
    const pedido = await despacharPedido(idPedido);
    res.status(200).json(pedido);
  } catch (error) {
    responderError(res, error);
  }
};

// Maneja la petición HTTP para registrar la entrega del domicilio al cliente
const putEntregaDomicilio = async (req, res) => {
  try {
    const idPedido = Number(req.params.id);
    const pedido = await entregarPedidoAlCliente(idPedido);
    res.status(200).json(pedido);
  } catch (error) {
    responderError(res, error);
  }
};

module.exports = { postPedido, getPedidos, putEstadoPedido, putCancelarPedido, putConfirmarCancelacion, putDespacharPedido, putEntregaDomicilio };