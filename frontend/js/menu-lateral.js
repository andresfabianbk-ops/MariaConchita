/* ==========================================================================
   menu-lateral.js — Menú lateral único: se genera según el cargo del empleado
   en sesión. Depende de sesion.js (obtenerEmpleado, URL_INDEX) y ui.js (escaparHtml).
   Cargar después de ui.js y antes de admin.js; admin.js lo llama antes de inicializarSidebar.
   ========================================================================== */

// Iconos del menú (trazos SVG, 24x24; el color lo pone el CSS con currentColor)
const ICONOS_MENU = {
  inicio: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  menu: '<path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M14 3v5h5"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>',
  inventario: '<path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  pedidos: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  caja: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2H10a2 2 0 0 0-2 2v16"/>',
  empleados: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  reportes: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  cocina: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  cerrar: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'
};

// Enlaces disponibles; "pagina" es relativa a index.html, igual que PAGINA_INICIO_POR_CARGO de sesion.js
const ENLACES_MENU = {
  inicio: { texto: 'Inicio', pagina: 'pages/admin/dashboard.html' },
  menu: { texto: 'Menú digital', pagina: 'pages/admin/menu.html' },
  inventario: { texto: 'Inventario', pagina: 'pages/admin/inventario.html' },
  pedidos: { texto: 'Pedidos', pagina: 'pages/pedidos.html' },
  caja: { texto: 'Caja', pagina: 'pages/caja.html' },
  empleados: { texto: 'Gestión de Empleados', pagina: 'pages/admin/empleados.html' },
  reportes: { texto: 'Reportes', pagina: 'pages/admin/reportes.html' },
  cocina: { texto: 'Cocina', pagina: 'pages/cocina.html' }
};

// Qué ve cada cargo: [título del grupo, [enlaces]]. Esto solo organiza la interfaz;
// el acceso real a cada ruta lo controla el backend con verificarRol
const MENU_POR_CARGO = {
  Administrador: [
    ['General', ['inicio']],
    ['Operación', ['menu', 'inventario', 'pedidos', 'caja']],
    ['Personal y accesos', ['empleados']],
    ['Análisis', ['reportes']]
  ],
  Cajero: [['Operación', ['pedidos', 'caja']]],
  Cocinero: [['Operación', ['cocina']]]
};

const iconoMenu = (nombre) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONOS_MENU[nombre] ?? ''}</svg>`;

// Un enlace del menú; marca la página actual con aria-current
const construirEnlaceMenu = (clave) => {
  const enlace = ENLACES_MENU[clave];
  const url = new URL(enlace.pagina, URL_INDEX);
  const actual = url.pathname === window.location.pathname ? ' aria-current="page"' : '';
  return `
    <a class="sidebar__enlace" href="${url.href}"${actual}>
      ${iconoMenu(clave)}
      <span class="sidebar__enlace-texto">${escaparHtml(enlace.texto)}</span>
    </a>`;
};

// Rellena <aside id="sidebar"> con el menú del cargo en sesión
function renderizarMenuLateral() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const cargo = obtenerEmpleado()?.cargo;
  const grupos = MENU_POR_CARGO[cargo] || []; // cargo desconocido: solo marca y cerrar sesión

  const navegacion = grupos.map(([titulo, claves]) => `
    <div class="sidebar__grupo-titulo">${escaparHtml(titulo)}</div>
    ${claves.map(construirEnlaceMenu).join('')}`).join('');

  sidebar.innerHTML = `
    <button class="sidebar__cerrar" aria-label="Cerrar menú">${iconoMenu('cerrar')}</button>

    <div class="sidebar__marca">
      <img class="sidebar__logo" src="${new URL('img/logo.png', URL_INDEX).href}" alt="Logo MariaConchita">
      <div>
        <div class="sidebar__nombre">MariaConchita</div>
        <div class="sidebar__rol">${escaparHtml(cargo ?? '')}</div>
      </div>
    </div>

    <nav class="sidebar__nav" aria-label="Navegación principal">${navegacion}</nav>

    <div class="sidebar__pie">
      <button type="button" class="sidebar__enlace" data-marcar-turno aria-label="Marcar turno">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
        <span class="sidebar__enlace-texto">Marcar turno</span>
      </button>
      <a class="sidebar__salir" href="${URL_INDEX}" data-cerrar-sesion>
        ${iconoMenu('salir')}
        <span class="sidebar__enlace-texto">Cerrar sesión</span>
      </a>
    </div>`;
  
  
  // "Marcar turno" abre la ventana de ui.js; en móvil y en Cocina el menú se cierra antes
  sidebar.querySelector('[data-marcar-turno]').addEventListener('click', () => {
    document.querySelector('.app-shell')?.classList.remove('sidebar-abierta');
    abrirMarcarTurno();
  });
}