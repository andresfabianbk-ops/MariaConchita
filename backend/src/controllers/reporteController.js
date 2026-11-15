// Controlador de reportes: HTTP de la generación de reportes (RF10)
const { generarReporte } = require('../services/reporteService');
const { generarExcel } = require('../services/reporteExcelService');

// Traduce el .codigo de los errores de negocio a un status HTTP
const mapearStatus = (codigo) => {
  switch (codigo) {
    case 'DATOS_INVALIDOS': return 400;
    default: return 500;
  }
};

// Responde { mensaje }; en 500 no expone el mensaje crudo de MySQL
const responderError = (res, error) => {
  const status = mapearStatus(error.codigo);
  if (status === 500) {
    console.error('Error en reportes:', error);
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
  return res.status(status).json({ mensaje: error.message });
};

// GET /api/reportes/:tipo?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
const getReporte = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const reporte = await generarReporte(req.params.tipo, desde, hasta);
    res.status(200).json(reporte);
  } catch (error) {
    responderError(res, error);
  }
};
// GET /api/reportes/:tipo/excel?desde&hasta → descarga el reporte en .xlsx
const getReporteExcel = async (req, res) => {
  try {
    const { tipo } = req.params;
    const { desde, hasta } = req.query;
    const buffer = await generarExcel(tipo, desde, hasta);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-${tipo}-${desde}-${hasta}.xlsx"`);
    res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    responderError(res, error);
  }
};

module.exports = { getReporte, getReporteExcel };