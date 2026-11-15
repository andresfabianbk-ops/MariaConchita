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


/* ---------- Ventana de confirmación reutilizable ---------- */

// Crea la ventana una sola vez y la deja oculta en el <body>
function crearVentanaConfirmacion() {
  const fondo = document.createElement('div');
  fondo.className = 'confirmacion';
  fondo.innerHTML = `
    <div class="confirmacion__ventana" role="alertdialog" aria-modal="true"
         aria-labelledby="confirmacion-titulo" aria-describedby="confirmacion-mensaje">
      <h2 class="confirmacion__titulo" id="confirmacion-titulo"></h2>
      <p class="confirmacion__mensaje" id="confirmacion-mensaje"></p>
      <div class="confirmacion__acciones">
        <button type="button" class="confirmacion__boton confirmacion__boton--cancelar" data-confirmacion="cancelar"></button>
        <button type="button" class="confirmacion__boton confirmacion__boton--confirmar" data-confirmacion="confirmar"></button>
      </div>
    </div>`;
  document.body.appendChild(fondo);
  return fondo;
}

// Pide confirmación con una ventana propia. Devuelve una promesa: true si confirma;
// false si cancela, pulsa Escape o hace clic fuera. Uso: if (!(await confirmarAccion({...}))) return;
function confirmarAccion({
  titulo = 'Confirmar acción',
  mensaje = '',
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  peligro = false
} = {}) {
  const fondo = document.querySelector('.confirmacion') || crearVentanaConfirmacion();
  const botonCancelar = fondo.querySelector('[data-confirmacion="cancelar"]');
  const botonConfirmar = fondo.querySelector('[data-confirmacion="confirmar"]');
  const elementoPrevio = document.activeElement;

  // textContent y no innerHTML: el mensaje puede llevar nombres que vienen de la base de datos
  fondo.querySelector('.confirmacion__titulo').textContent = titulo;
  fondo.querySelector('.confirmacion__mensaje').textContent = mensaje;
  botonCancelar.textContent = textoCancelar;
  botonConfirmar.textContent = textoConfirmar;
  botonConfirmar.classList.toggle('confirmacion__boton--peligro', peligro);

  fondo.classList.add('visible');
  botonCancelar.focus(); // el foco empieza en cancelar para evitar confirmaciones por error

  return new Promise((resolver) => {
    const cerrar = (resultado) => {
      fondo.classList.remove('visible');
      fondo.removeEventListener('click', alHacerClic);
      document.removeEventListener('keydown', alPulsarTecla, true);
      if (elementoPrevio && elementoPrevio.focus) elementoPrevio.focus();
      resolver(resultado);
    };

    const alHacerClic = (evento) => {
      if (evento.target === fondo) return cerrar(false); // clic fuera de la ventana
      const boton = evento.target.closest('[data-confirmacion]');
      if (boton) cerrar(boton.dataset.confirmacion === 'confirmar');
    };

    // Fase de captura: Escape cierra solo esta ventana y no otro modal que esté debajo
    const alPulsarTecla = (evento) => {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        evento.stopPropagation();
        cerrar(false);
      } else if (evento.key === 'Tab') {
        evento.preventDefault(); // con dos botones, Tab alterna entre ellos
        (document.activeElement === botonCancelar ? botonConfirmar : botonCancelar).focus();
      }
    };

    fondo.addEventListener('click', alHacerClic);
    document.addEventListener('keydown', alPulsarTecla, true);
  });
}

// ---------- Marcar turno (terminal compartida) ----------

// Ventana para que cualquier empleado marque inicio o cierre de turno con documento y contraseña.
// POST /turnos/registrar (la sesión de la terminal ya está abierta: la ruta exige token).
// Usa las clases de admin.css, por eso se agrega dentro de .app-admin.
function abrirMarcarTurno() {
  if (document.getElementById('ventana-turno')) return;

  const fondo = document.createElement('div');
  fondo.id = 'ventana-turno';
  fondo.className = 'fondo-modal visible';
  fondo.innerHTML = `
    <form class="modal" role="dialog" aria-modal="true" aria-labelledby="turno-titulo" autocomplete="off">
      <div class="modal__encabezado">
        <h2 class="modal__titulo" id="turno-titulo">Marcar turno</h2>
      </div>
      <div class="modal__cuerpo">
        <div class="form-grid form-grid--simple">
          <div class="campo">
            <label for="turno-documento">Número de documento</label>
            <input type="text" id="turno-documento" inputmode="numeric" maxlength="10" required>
          </div>
          <div class="campo">
            <label for="turno-contrasena">Contraseña</label>
            <input type="password" id="turno-contrasena" autocomplete="new-password" required>
          </div>
          <p id="turno-mensaje" role="status" aria-live="polite"></p>
        </div>
      </div>
      <div class="modal__pie">
        <button type="button" class="btn btn-secundario" data-turno-cerrar>Cerrar</button>
        <button type="submit" class="btn btn-secundario" data-accion-turno="cierre">Cerrar turno</button>
        <button type="submit" class="btn btn-primario" data-accion-turno="inicio">Iniciar turno</button>
      </div>
    </form>`;

  const formulario = fondo.querySelector('form');
  const campoDocumento = fondo.querySelector('#turno-documento');
  const campoContrasena = fondo.querySelector('#turno-contrasena');
  const mensaje = fondo.querySelector('#turno-mensaje');

  const alPulsarTecla = (evento) => {
    if (evento.key !== 'Escape') return;
    evento.stopPropagation();
    cerrar();
  };
  const cerrar = () => {
    document.removeEventListener('keydown', alPulsarTecla, true);
    fondo.remove();
  };

  // Solo dígitos en el documento
  campoDocumento.addEventListener('input', () => {
    campoDocumento.value = campoDocumento.value.replace(/\D/g, '');
  });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const accion = evento.submitter?.dataset.accionTurno;
    if (!accion) return;

    const botones = formulario.querySelectorAll('button');
    botones.forEach((boton) => { boton.disabled = true; });
    mensaje.textContent = '';

    try {
      const resultado = await peticionApi('/turnos/registrar', {
        method: 'POST',
        body: JSON.stringify({
          numeroDocumento: campoDocumento.value.trim(),
          contrasena: campoContrasena.value,
          accion
        })
      });
      const hora = new Date(resultado.hora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
      const tipo = accion === 'inicio' ? 'Inicio' : 'Cierre';
      mensaje.style.color = 'var(--exito)';
      mensaje.textContent = `${resultado.empleado}: ${tipo} de turno registrado a las ${hora}.` + (resultado.aviso ? ` ${resultado.aviso}` : '');
      campoDocumento.value = '';
    } catch (error) {
      // peticionApi ya muestra el error en la notificación superior; no se repite en la ventana
      mensaje.textContent = '';
    } finally {
      campoContrasena.value = ''; // la contraseña nunca queda en pantalla
      botones.forEach((boton) => { boton.disabled = false; });
      campoDocumento.focus();
    }
  });

  fondo.querySelector('[data-turno-cerrar]').addEventListener('click', cerrar);
  fondo.addEventListener('click', (evento) => {
    if (evento.target === fondo) cerrar();
  });
  document.addEventListener('keydown', alPulsarTecla, true);

  (document.querySelector('.app-admin') || document.body).appendChild(fondo);
  campoDocumento.focus();
}