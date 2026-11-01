
document.addEventListener('DOMContentLoaded', () => {
  if (!verificarSesion()) return; // sin sesión no se inicializa nada ni se piden datos
  inicializarSidebar();
  inicializarCerrarSesion();
  inicializarModales();
  inicializarFiltrosEscritura();
  inicializarPestanas();
  if (typeof inicializarEmpleados === 'function') inicializarEmpleados(); // solo existe en empleados.html
  if (typeof inicializarTurnos === 'function') inicializarTurnos(); // solo existe en empleados.html
  if (typeof inicializarMenu === 'function') inicializarMenu(); // solo existe en menu.html
});