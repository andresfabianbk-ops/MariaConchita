/* ==========================================================================
   empleados.js — Gestión de empleados en empleados.html.
   Depende de api.js (peticionApi) y ui.js (escaparHtml, cerrarModal).
   Se carga después de turnos.js y antes de admin.js.
   ========================================================================== */

   /* ==========================================================================
   Módulo: Empleados
   ========================================================================== */

let empleadosCache = [];
let idEmpleadoRestablecer = null;

// Unifica los nombres de campo (snake_case o camelCase) que devuelva el backend
function normalizarEmpleado(e) {
  return {
    id: e.id_usuario ?? e.id,
    nombres: e.nombres,
    apellidos: e.apellidos,
    tipoDocumento: e.tipo_documento ?? e.tipoDocumento,
    numeroDocumento: e.numero_documento ?? e.numeroDocumento,
    fechaNacimiento: e.fecha_nacimiento ?? e.fechaNacimiento,
    correo: e.correo,
    celular: e.celular,
    cargo: e.cargo ?? e.rol ?? e.nombre_rol,
    estado: e.estado
  };
}

async function cargarEmpleados() {
  try {
    const datos = await peticionApi('/empleados');
    empleadosCache = datos.map(normalizarEmpleado);
    llenarFiltroEmpleadosTurnos(); // mantiene el selector de turnos al día
    aplicarFiltrosEmpleados();
  } catch (error) {
    // El error ya se notificó dentro de peticionApi
  }
}

function renderizarEmpleados(empleados) {
  const estadoVacio = document.getElementById('estado-vacio-empleados');
  const tabla = document.getElementById('tabla-empleados');
  const tbody = document.getElementById('tbody-empleados');
  if (!tbody) return;

  const hayDatos = empleados.length > 0;
  estadoVacio.style.display = hayDatos ? 'none' : '';
  tabla.style.display = hayDatos ? '' : 'none';

  tbody.innerHTML = empleados.map((e) => {
    const iniciales = ((e.nombres?.[0] ?? '') + (e.apellidos?.[0] ?? '')).toUpperCase();
    const activo = e.estado === 'Activo';
    return `
    <tr data-id-empleado="${e.id}">
      <td>
        <div class="celda-producto">
          <div class="avatar" style="width:36px; height:36px; font-size:0.8rem;">${escaparHtml(iniciales)}</div>
          <div>
            <div class="celda-producto__nombre">${escaparHtml(e.nombres)} ${escaparHtml(e.apellidos)}</div>
            <div class="celda-producto__categoria">${escaparHtml(e.correo)}</div>
          </div>
        </div>
      </td>
      <td>${escaparHtml(e.tipoDocumento)} ${escaparHtml(e.numeroDocumento)}</td>
      <td>${escaparHtml(e.cargo)}</td>
      <td>
        <label class="interruptor">
          <input type="checkbox" data-toggle-estado-empleado="${e.id}" ${activo ? 'checked' : ''}>
          <span class="interruptor__riel"></span>
        </label>
        <span class="texto-atenuado">${activo ? 'Activo' : escaparHtml(e.estado)}</span>
      </td>
      <td>
        <div class="tabla__acciones">
          <button class="btn-icono" data-restablecer-empleado="${e.id}" aria-label="Restablecer contraseña" title="Restablecer contraseña">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </button>
          <button class="btn-icono" data-editar-empleado="${e.id}" aria-label="Editar empleado" title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');

  asignarEventosEmpleados();
}

function asignarEventosEmpleados() {
  // Editar: precarga el modal y oculta la contraseña (se cambia con "Restablecer")
  document.querySelectorAll('[data-editar-empleado]').forEach((boton) => {
    boton.addEventListener('click', () => {
      const empleado = empleadosCache.find((e) => e.id == boton.dataset.editarEmpleado);
      if (!empleado) return;

      document.getElementById('emp-id').value = empleado.id;
      document.getElementById('emp-nombres').value = empleado.nombres;
      document.getElementById('emp-apellidos').value = empleado.apellidos;
      document.getElementById('emp-tipo-documento').value = empleado.tipoDocumento;
      document.getElementById('emp-numero-documento').value = empleado.numeroDocumento;
      document.getElementById('emp-fecha-nacimiento').value = String(empleado.fechaNacimiento ?? '').slice(0, 10);
      document.getElementById('emp-celular').value = empleado.celular ?? '';
      document.getElementById('emp-correo').value = empleado.correo;
      document.getElementById('emp-rol').value = empleado.cargo;
      document.getElementById('campo-clave').style.display = 'none';
// El backend no actualiza estos campos: se muestran pero no se pueden editar
      document.getElementById('emp-tipo-documento').disabled = true;
      document.getElementById('emp-numero-documento').disabled = true;
      document.getElementById('emp-fecha-nacimiento').disabled = true;
      document.getElementById('titulo-modal-persona').textContent = 'Editar empleado';

      document.getElementById('modal-persona').classList.add('visible');
    });
  });

  // Restablecer contraseña: guarda el id y abre su modal
  document.querySelectorAll('[data-restablecer-empleado]').forEach((boton) => {
    boton.addEventListener('click', () => {
      const empleado = empleadosCache.find((e) => e.id == boton.dataset.restablecerEmpleado);
      if (!empleado) return;

      idEmpleadoRestablecer = empleado.id;
      document.querySelector('[data-nombre-a-restablecer]').textContent = `${empleado.nombres} ${empleado.apellidos}`;
      document.getElementById('modal-restablecer').classList.add('visible');
    });
  });

  // Switch Activo/Inactivo: borrado lógico / reactivación inmediata
  document.querySelectorAll('[data-toggle-estado-empleado]').forEach((interruptor) => {
    interruptor.addEventListener('change', async () => {
      const id = interruptor.dataset.toggleEstadoEmpleado;
      const accion = interruptor.checked ? 'activar' : 'bloquear';

      try {
        await peticionApi(`/empleados/${id}/${accion}`, { method: 'PUT' });
                mostrarNotificacion(interruptor.checked ? 'Empleado desbloqueado' : 'Empleado bloqueado', 'exito');
        await cargarEmpleados();
      } catch (error) {
        interruptor.checked = !interruptor.checked; // revierte si falla
      }
    });
  });
}

// Botón "Agregar empleado": deja el modal en modo crear
function inicializarBotonAgregarEmpleado() {
  document.querySelectorAll('[data-abrir-modal="modal-persona"]').forEach((boton) => {
    boton.addEventListener('click', () => {
      document.getElementById('form-empleado').reset();
      document.getElementById('emp-id').value = '';
      document.getElementById('campo-clave').style.display = '';
// El backend no actualiza estos campos: se muestran pero no se pueden editar
      document.getElementById('emp-tipo-documento').disabled = false;
      document.getElementById('emp-numero-documento').disabled = false;
      document.getElementById('emp-fecha-nacimiento').disabled = false;
      document.getElementById('titulo-modal-persona').textContent = 'Agregar empleado';
    });
  });
}

// Submit del modal: crea (POST) o edita (PUT) según emp-id
function inicializarFormularioEmpleado() {
  document.getElementById('form-empleado').addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const id = document.getElementById('emp-id').value;
    const datos = {
      tipoDocumento: document.getElementById('emp-tipo-documento').value,
      numeroDocumento: document.getElementById('emp-numero-documento').value.trim(),
      nombres: document.getElementById('emp-nombres').value.trim(),
      apellidos: document.getElementById('emp-apellidos').value.trim(),
      fechaNacimiento: document.getElementById('emp-fecha-nacimiento').value,
      correo: document.getElementById('emp-correo').value.trim(),
      celular: document.getElementById('emp-celular').value.trim() || null,
      cargo: document.getElementById('emp-rol').value
    };

    if (!datos.nombres || !datos.apellidos || !datos.numeroDocumento || !datos.fechaNacimiento || !datos.correo) {
      mostrarNotificacion('Completa todos los campos obligatorios', 'error');
      return;
    }

    try {
      if (id) {
        await peticionApi(`/empleados/${id}`, { method: 'PUT', body: JSON.stringify(datos) });
        mostrarNotificacion('Empleado actualizado correctamente', 'exito');
      } else {
        datos.contrasena = document.getElementById('emp-clave').value;
        if (datos.contrasena.length < 6) {
          mostrarNotificacion('La contraseña debe tener mínimo 6 caracteres', 'error');
          return;
        }
        await peticionApi('/empleados', { method: 'POST', body: JSON.stringify(datos) });
        mostrarNotificacion('Empleado creado correctamente', 'exito');
      }

      cerrarModal(document.getElementById('modal-persona'));
      cargarEmpleados();
    } catch (error) {
      // El error ya se notificó dentro de peticionApi
    }
  });
}

// Submit del modal de restablecer contraseña
function inicializarFormularioRestablecer() {
  document.getElementById('form-restablecer').addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const contrasena = document.getElementById('nueva-clave').value;
    if (contrasena.length < 6) {
      mostrarNotificacion('La contraseña debe tener mínimo 6 caracteres', 'error');
      return;
    }

    try {
      await peticionApi(`/empleados/${idEmpleadoRestablecer}/contrasena`, {
        method: 'PUT',
        body: JSON.stringify({ contrasenaNueva: contrasena })
      });
      mostrarNotificacion('Contraseña restablecida correctamente', 'exito');
      cerrarModal(document.getElementById('modal-restablecer'));
    } catch (error) {
      // El error ya se notificó dentro de peticionApi
    }
  });
}


// Punto de entrada: solo actúa si estamos en empleados.html
function inicializarEmpleados() {
  if (!document.getElementById('tbody-empleados')) return;

  cargarEmpleados();
  inicializarBotonAgregarEmpleado();
  inicializarFormularioEmpleado();
  inicializarFormularioRestablecer();

  ['buscar-empleado', 'filtro-rol-empleado', 'filtro-estado-empleado'].forEach((idControl) => {
    const control = document.getElementById(idControl);
    control.addEventListener(control.tagName === 'SELECT' ? 'change' : 'input', aplicarFiltrosEmpleados);
  });
      
}

// Filtra en memoria por texto, rol y estado
function aplicarFiltrosEmpleados() {
  const texto = (document.getElementById('buscar-empleado')?.value || '').trim().toLowerCase();
  const rol = document.getElementById('filtro-rol-empleado')?.value || '';
  const estado = document.getElementById('filtro-estado-empleado')?.value || '';

  const filtrados = empleadosCache.filter((empleado) => {
    const textoEmpleado = `${empleado.nombres} ${empleado.apellidos} ${empleado.correo} ${empleado.numeroDocumento}`.toLowerCase();
    return textoEmpleado.includes(texto)
      && (!rol || empleado.cargo === rol)
      && (!estado || empleado.estado === estado);
  });

  renderizarEmpleados(filtrados);
}
