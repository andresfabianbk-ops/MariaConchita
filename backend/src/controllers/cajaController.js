// Controlador de caja: HTTP de apertura, cierre y consulta de la caja del día
const {
  consultarCajaHoy,
  abrirCajaDelDia,
  cerrarCajaDelDia
} = require('../services/cajaService');

// Traduce el .codigo de los errores de negocio a un status HTTP
const mapearStatus = (codigo) => {
  switch (codigo) {
    case 'DATOS_INVALIDOS': return 400;
    case 'NO_AUTORIZADO': return 401;
    case 'NO_ENCONTRADA': return 404;
    case 'DUPLICADO': return 409;
    case 'OPERACION_NO_PERMITIDA': return 403;
    default: return 500;
  }
};

// Responde { mensaje }; en 500 no expone el mensaje crudo de MySQL
const responderError = (res, error) => {
  const status = mapearStatus(error.codigo);
  if (status === 500) {
    console.error('Error en caja:', error);
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
  return res.status(status).json({ mensaje: error.message });
};

// GET /api/caja/hoy → caja de hoy o { abierta: false }
const getCajaHoy = async (req, res) => {
  try {
    const caja = await consultarCajaHoy();
    res.status(200).json(caja);
  } catch (error) {
    responderError(res, error);
  }
};

// POST /api/caja/apertura → body { fondoInicial }
const postApertura = async (req, res) => {
  try {
    const caja = await abrirCajaDelDia({
      fondoInicial: (req.body || {}).fondoInicial,
      idUsuario: req.usuario.id_usuario
    });
    res.status(201).json(caja);
  } catch (error) {
    responderError(res, error);
  }
};

// POST /api/caja/cierre → body { efectivoContado }
const postCierre = async (req, res) => {
  try {
    const caja = await cerrarCajaDelDia({
      efectivoContado: (req.body || {}).efectivoContado,
      idUsuario: req.usuario.id_usuario
    });
    res.status(200).json(caja);
  } catch (error) {
    responderError(res, error);
  }
};

module.exports = { getCajaHoy, postApertura, postCierre };