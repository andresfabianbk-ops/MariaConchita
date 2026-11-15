// Importa la lógica de negocio del dashboard
const { obtenerResumenDashboard } = require('../services/dashboardService');

// Traduce el código de error de negocio a un status HTTP
function mapearStatus(codigo) {
  switch (codigo) {
    case 'DATOS_INVALIDOS':
      return 400;
    default:
      return 500;
  }
}

// GET /api/dashboard/resumen → cifras de hoy para las tarjetas del panel
const getResumenDashboard = async (req, res) => {
  try {
    const resumen = await obtenerResumenDashboard();
    res.status(200).json(resumen);
  } catch (error) {
    res.status(mapearStatus(error.codigo)).json({ mensaje: error.message });
  }
};

module.exports = { getResumenDashboard };