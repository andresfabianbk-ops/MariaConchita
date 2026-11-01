/* ==========================================================================
   turnos.js — Registro de turnos (ingreso/salida) en empleados.html.
   Depende de api.js (peticionApi) y ui.js (escaparHtml). Se carga antes de admin.js.
   ========================================================================== */

   // Formatea una fecha/hora del backend en la zona del navegador (vacío si no hay valor)
function formatearFechaHora(valor) {
  if (!valor) return '';
  return new Date(valor).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

// Llena el selector de empleados del registro de turnos con empleadosCache
function llenarFiltroEmpleadosTurnos() {
  const select = document.getElementById('filtro-turno-empleado');
  if (!select) return;
  const seleccionado = select.value;
  select.innerHTML = '<option value="">Todos los empleados</option>' + empleadosCache.map((e) =>
    `<option value="${e.id}">${escaparHtml(e.nombres)} ${escaparHtml(e.apellidos)}</option>`
  ).join('');
  select.value = seleccionado;
}

// Pide los turnos al backend con los filtros elegidos y los pinta
async function cargarTurnos() {
  const parametros = new URLSearchParams();
  const idUsuario = document.getElementById('filtro-turno-empleado').value;
  const fecha = document.getElementById('filtro-turno-fecha').value;
  if (idUsuario) parametros.set('idUsuario', idUsuario);
  if (fecha) { // un solo día: el backend filtra por rango, se envía el mismo valor en ambos extremos
    parametros.set('fechaDesde', fecha);
    parametros.set('fechaHasta', fecha);
  }
  const consulta = parametros.toString();

  try {
    const turnos = await peticionApi(`/turnos${consulta ? '?' + consulta : ''}`);
    renderizarTurnos(turnos);
  } catch (error) {
    // El error ya se notificó dentro de peticionApi
  }
}

// Pinta la tabla de turnos; un cierre vacío indica que el empleado no marcó el cierre
function renderizarTurnos(turnos) {
  const tbody = document.getElementById('tbody-turnos');
  const estadoVacio = document.getElementById('estado-vacio-turnos');
  estadoVacio.style.display = turnos.length ? 'none' : '';
  tbody.innerHTML = turnos.map((t) => `
    <tr>
      <td>${escaparHtml(t.nombres)} ${escaparHtml(t.apellidos)}</td>
      <td>${escaparHtml(t.cargo)}</td>
      <td>${formatearFechaHora(t.hora_inicio)}</td>
      <td>${formatearFechaHora(t.hora_fin)}</td>
    </tr>`).join('');
}

// Punto de entrada: solo actúa si estamos en empleados.html
function inicializarTurnos() {
  if (!document.getElementById('tbody-turnos')) return;

  cargarTurnos();
  ['filtro-turno-empleado', 'filtro-turno-fecha'].forEach((idControl) => {
    document.getElementById(idControl).addEventListener('change', cargarTurnos);
  });
}
