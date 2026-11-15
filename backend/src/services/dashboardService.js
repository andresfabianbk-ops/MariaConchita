// Reglas de negocio del dashboard: junta las cifras de hoy que muestra el panel
const { obtenerIngresosPorMetodo } = require('../repositories/reporteRepository');
const { obtenerInsumos } = require('../repositories/insumoRepository');
const { contarPedidosActivos, contarEmpleadosConTurnoHoy } = require('../repositories/dashboardRepository');

// Fecha de hoy en Bogotá como AAAA-MM-DD (el servidor puede tener otra zona horaria)
const obtenerFechaHoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

const obtenerResumenDashboard = async () => {
  const hoy = obtenerFechaHoy();

  const [ingresos, insumos, pedidosActivos, empleadosConTurno] = await Promise.all([
    obtenerIngresosPorMetodo(hoy, hoy),
    obtenerInsumos(),
    contarPedidosActivos(),
    contarEmpleadosConTurnoHoy()
  ]);

  return {
    ventasHoy: ingresos.reduce((suma, fila) => suma + Number(fila.total), 0),
    pedidosActivos,
    insumosEnAlerta: insumos.filter((insumo) => insumo.nivel !== 'Normal').length,
    empleadosConTurno
  };
};

module.exports = { obtenerResumenDashboard };