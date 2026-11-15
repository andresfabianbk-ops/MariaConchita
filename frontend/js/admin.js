
document.addEventListener('DOMContentLoaded', () => {
  if (!verificarSesion()) return; // sin sesión no se inicializa nada ni se piden datos
  if (typeof renderizarMenuLateral === 'function') renderizarMenuLateral(); // genera el menú según el cargo; debe ir antes de inicializarSidebar
  inicializarSidebar();
  inicializarCerrarSesion();
  inicializarModales();
  inicializarFiltrosEscritura();
  inicializarPestanas();
  if (typeof inicializarEmpleados === 'function') inicializarEmpleados(); // solo existe en empleados.html
  if (typeof inicializarTurnos === 'function') inicializarTurnos(); // solo existe en empleados.html
  if (typeof inicializarMenu === 'function') inicializarMenu(); // solo existe en menu.html
  if (typeof inicializarInventario === 'function') inicializarInventario(); // solo existe en inventario.html
  if (typeof inicializarReportes === 'function') inicializarReportes(); // solo existe en reportes.html
  if (typeof inicializarDashboard === 'function') inicializarDashboard(); // solo existe en dashboard.html
});