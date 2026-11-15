// Controlador de insumos: HTTP de la consulta de stock y los movimientos manuales
const {
  listarInsumos,
  registrarMovimientoInsumo,
  crearInsumoNuevo,
  editarInsumo
} = require('../services/insumoService');

// Traduce el .codigo de los errores de negocio a un status HTTP
const mapearStatus = (codigo) => {
  switch (codigo) {
    case 'DATOS_INVALIDOS': return 400;
    case 'NO_ENCONTRADA': return 404;
    case 'OPERACION_NO_PERMITIDA': return 403;
    case 'DUPLICADO': return 409;
    default: return 500;
  }
};

// Responde { mensaje }; en 500 no expone el mensaje crudo de MySQL
const responderError = (res, error) => {
  const status = mapearStatus(error.codigo);
  if (status === 500) {
    console.error('Error en insumos:', error);
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
  return res.status(status).json({ mensaje: error.message });
};

// GET /api/insumos → lista de insumos con su nivel de stock
const getInsumos = async (req, res) => {
  try {
    const insumos = await listarInsumos();
    res.status(200).json(insumos);
  } catch (error) {
    responderError(res, error);
  }
};

// POST /api/insumos/:id/movimientos → body { tipo, cantidad, motivo }
const postMovimiento = async (req, res) => {
  try {
    const { tipo, cantidad, motivo } = req.body || {};
    const resultado = await registrarMovimientoInsumo({
      idInsumo: req.params.id,
      tipo,
      cantidad,
      motivo
    });
    res.status(201).json(resultado);
  } catch (error) {
    responderError(res, error);
  }
};

// POST /api/insumos — crea un insumo nuevo (stock 0)
const postInsumo = async (req, res) => {
  try {
    const { nombre, unidadMedida, stockMinimo, costoUnitario } = req.body;
    const insumo = await crearInsumoNuevo({ nombre, unidadMedida, stockMinimo, costoUnitario });
    return res.status(201).json(insumo);
  } catch (error) {
    return responderError(res, error);
  }
};

// PUT /api/insumos/:id — edita un insumo existente
const putInsumo = async (req, res) => {
  try {
    const { nombre, unidadMedida, stockMinimo, costoUnitario } = req.body;
    const insumo = await editarInsumo({
      idInsumo: req.params.id,
      nombre,
      unidadMedida,
      stockMinimo,
      costoUnitario
    });
    return res.status(200).json(insumo);
  } catch (error) {
    return responderError(res, error);
  }
};

module.exports = { getInsumos, postMovimiento, postInsumo, putInsumo };