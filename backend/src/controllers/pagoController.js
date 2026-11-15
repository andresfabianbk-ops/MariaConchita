// Controlador de pagos: recibe la petición HTTP y la traduce a la lógica de negocio
const { registrarPago, listarPagos } = require('../services/pagoService');

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

// Responde con el status del error; en 500 no expone el mensaje crudo de MySQL
const responderError = (res, error) => {
  const status = mapearStatus(error.codigo);
  if (status === 500) {
    console.error('Error en pagos:', error);
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
  return res.status(status).json({ mensaje: error.message });
};

// POST /api/pagos → registrar el pago de un pedido
const postPago = async (req, res) => {
  try {
    const pago = await registrarPago(req.body);
    res.status(201).json(pago);
  } catch (error) {
    responderError(res, error);
  }
};

// GET /api/pagos → listar pagos
const getPagos = async (req, res) => {
  try {
    const pagos = await listarPagos();
    res.status(200).json(pagos);
  } catch (error) {
    responderError(res, error);
  }
};

module.exports = { postPago, getPagos };