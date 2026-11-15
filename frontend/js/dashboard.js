// Dashboard del Administrador: cifras de hoy (GET /dashboard/resumen)

async function cargarResumenDashboard() {
  try {
    const resumen = await peticionApi('/dashboard/resumen');

    document.getElementById('dash-ventas-hoy').textContent = Number(resumen.ventasHoy).toLocaleString('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    });
    document.getElementById('dash-pedidos-activos').textContent = resumen.pedidosActivos;
    document.getElementById('dash-insumos-alerta').textContent = resumen.insumosEnAlerta;
    document.getElementById('dash-empleados-turno').textContent = resumen.empleadosConTurno;
  } catch (error) {
    // El error ya se notificó dentro de peticionApi; las tarjetas conservan el "—"
  }
}

function inicializarDashboard() {
  if (!document.getElementById('dash-ventas-hoy')) return; // otra página del panel

  cargarResumenDashboard();

  // Al volver a la pestaña se refrescan las cifras
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) cargarResumenDashboard();
  });
}