/* ==========================================================================
   ui.js — Piezas de interfaz comunes del panel: escape de HTML, filtros de
   escritura, sidebar, modales y pestañas. No depende de la API.
   Cargar después de api.js y antes de admin.js.
   ========================================================================== */

// Evita que texto con < o > rompa el HTML al insertarlo en una tabla
function escaparHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Filtros de escritura: data-solo-digitos (documento, celular) y data-solo-letras (nombres, apellidos)
function inicializarFiltrosEscritura() {
  document.addEventListener('input', (evento) => {
    const campo = evento.target;
    if (campo.matches('[data-solo-digitos]')) {
      campo.value = campo.value.replace(/\D/g, '');
    }
    if (campo.matches('[data-solo-letras]')) {
      campo.value = campo.value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'-]/g, ''); // letras, tildes, ñ, espacios, apóstrofe y guion
    }
  });
}

/* ---------- Sidebar: colapsar (escritorio) / abrir (móvil) ---------- */

function inicializarSidebar() {
  const shell = document.querySelector('.app-shell');
  const botonToggle = document.querySelector('[data-accion="toggle-sidebar"]');
  if (!shell || !botonToggle) return;

  const esMovil = () => window.matchMedia('(max-width: 900px)').matches;

  botonToggle.addEventListener('click', () => {
    shell.classList.toggle(esMovil() ? 'sidebar-abierta' : 'sidebar-colapsada');
    const visible = esMovil()
      ? shell.classList.contains('sidebar-abierta')
      : !shell.classList.contains('sidebar-colapsada');
    botonToggle.setAttribute('aria-expanded', String(visible));
  });

  // Botón X del sidebar en móvil
  document.querySelector('.sidebar__cerrar')?.addEventListener('click', () => {
    shell.classList.remove('sidebar-abierta');
  });

  // Cerrar sidebar móvil al tocar fuera de ella
  document.addEventListener('click', (evento) => {
    if (!esMovil() || !shell.classList.contains('sidebar-abierta')) return;
    const dentroSidebar = evento.target.closest('.sidebar');
    const esBoton = evento.target.closest('[data-accion="toggle-sidebar"]');
    if (!dentroSidebar && !esBoton) shell.classList.remove('sidebar-abierta');
  });
}

/* ---------- Modales genéricos (abrir/cerrar por atributos data-*) ---------- */

function inicializarModales() {
  document.querySelectorAll('[data-abrir-modal]').forEach((boton) => {
    boton.addEventListener('click', () => {
      const modal = document.getElementById(boton.dataset.abrirModal);
      if (modal) modal.classList.add('visible');
    });
  });

  document.querySelectorAll('[data-cerrar-modal]').forEach((boton) => {
    boton.addEventListener('click', () => cerrarModal(boton.closest('.fondo-modal')));
  });

  document.querySelectorAll('.fondo-modal').forEach((fondo) => {
    fondo.addEventListener('click', (evento) => {
      if (evento.target === fondo) cerrarModal(fondo);
    });
  });

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') {
      document.querySelectorAll('.fondo-modal.visible').forEach(cerrarModal);
    }
  });
}

function cerrarModal(fondo) {
  if (!fondo) return;
  fondo.classList.remove('visible');
  const formulario = fondo.querySelector('form');
  if (formulario) {
    formulario.reset();
    formulario.querySelectorAll('.campo.con-error').forEach((c) => c.classList.remove('con-error'));
  }
}

/* ---------- Pestañas: cada pestaña muestra el panel indicado en aria-controls ---------- */

function inicializarPestanas() {
  document.querySelectorAll('.pestanas').forEach((contenedor) => {
    const pestanas = contenedor.querySelectorAll('.pestana');

    pestanas.forEach((pestana) => {
      pestana.addEventListener('click', () => {
        pestanas.forEach((otra) => {
          const activa = otra === pestana;
          otra.classList.toggle('activa', activa);
          otra.setAttribute('aria-selected', String(activa));
          const panel = document.getElementById(otra.getAttribute('aria-controls'));
          if (panel) panel.hidden = !activa;
        });
      });
    });
  });
}