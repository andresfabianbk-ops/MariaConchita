/* ==========================================================================
   inventario.js — Módulo de Inventario (solo inventario.html): lista de
   insumos con nivel de stock, alerta, filtros, movimientos y crear/editar.
   Depende de api.js y ui.js; se carga antes de admin.js.
   ========================================================================== */

let insumosCache = []; // última lista traída del backend

// Estilo de cada nivel que calcula el backend (clases de la paleta del panel)
const ESTILO_NIVEL = {
  Agotado: { insignia: 'insignia--peligro', barra: 'bajo', texto: 'Agotado' },
  Bajo: { insignia: 'insignia--alerta', barra: 'medio', texto: 'Stock bajo' },
  Normal: { insignia: 'insignia--exito', barra: '', texto: 'Normal' }
};

const MAXIMO_INSUMOS_EN_ALERTA = 8; // para que el banner no crezca sin límite

// Formatea cantidades de insumo (hasta 3 decimales, separador de miles)
const formatearCantidad = (valor) =>
  Number(valor).toLocaleString('es-CO', { maximumFractionDigits: 3 });

// Minúsculas y sin tildes, para que la búsqueda no distinga "Jamón" de "jamon"
const normalizarTexto = (texto) =>
  String(texto ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Lee un input numérico: '' si está vacío (el backend lo valida), Number si tiene valor
const leerNumero = (idCampo) => {
  const valor = document.getElementById(idCampo).value.trim();
  return valor === '' ? '' : Number(valor);
};

/* ---------- Carga de datos ---------- */

// Trae los insumos reales del backend y refresca tabla, alerta y selector
async function cargarInsumos() {
  try {
    insumosCache = await peticionApi('/insumos');
    renderizarInsumos();
    actualizarAlertaStock();
    poblarSelectMovimiento();
  } catch (error) {
    // El error ya se notificó dentro de peticionApi
  }
}

/* ---------- Tabla y filtros ---------- */

// Aplica búsqueda, unidad y nivel sobre la lista en memoria
function obtenerInsumosFiltrados() {
  const busqueda = normalizarTexto(document.getElementById('filtro-busqueda-insumo').value.trim());
  const unidad = document.getElementById('filtro-unidad-insumo').value;
  const nivel = document.getElementById('filtro-nivel-insumo').value;

  return insumosCache.filter((insumo) =>
    (!busqueda || normalizarTexto(insumo.nombre).includes(busqueda)) &&
    (!unidad || insumo.unidad_medida === unidad) &&
    (!nivel || insumo.nivel === nivel)
  );
}

// Porcentaje de la barra: el stock mínimo marca la mitad; con el doble del mínimo está llena
function calcularPorcentajeBarra(insumo) {
  const stock = Number(insumo.stock_actual);
  const minimo = Number(insumo.stock_minimo);
  if (stock <= 0) return 0;
  if (minimo <= 0) return 100;
  return Math.min(100, (stock / (minimo * 2)) * 100);
}

// Dibuja las filas de la tabla o muestra el estado vacío
function renderizarInsumos() {
  const cuerpo = document.getElementById('tabla-insumos');
  const estadoVacio = document.getElementById('estado-vacio-insumos');
  const envoltorio = cuerpo.closest('.tabla-envoltorio');
  const insumos = obtenerInsumosFiltrados();

  estadoVacio.style.display = insumos.length === 0 ? '' : 'none';
  envoltorio.style.display = insumos.length === 0 ? 'none' : '';

  cuerpo.innerHTML = insumos.map((insumo) => {
    const estilo = ESTILO_NIVEL[insumo.nivel] || ESTILO_NIVEL.Normal;
    return `
      <tr>
        <td>${escaparHtml(insumo.nombre)}</td>
        <td>${escaparHtml(insumo.unidad_medida)}</td>
        <td>${formatearCantidad(insumo.stock_actual)}</td>
        <td>${formatearCantidad(insumo.stock_minimo)}</td>
        <td>
          <div class="barra-stock">
            <div class="barra-stock__relleno ${estilo.barra}" style="width: ${calcularPorcentajeBarra(insumo)}%;"></div>
          </div>
        </td>
        <td><span class="insignia ${estilo.insignia}">${estilo.texto}</span></td>
        <td>
          <div class="tabla__acciones">
            <button class="btn-icono" data-movimiento-insumo="${insumo.id_insumo}" aria-label="Registrar movimiento" title="Registrar movimiento">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <button class="btn-icono" data-editar-insumo="${insumo.id_insumo}" aria-label="Editar insumo" title="Editar">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/* ---------- Alerta de stock bajo ---------- */

// Muestra el banner con los insumos Agotado o Bajo (sobre toda la lista, no la filtrada)
function actualizarAlertaStock() {
  const banner = document.getElementById('alerta-stock');
  const texto = document.getElementById('alerta-stock-texto');
  const criticos = insumosCache.filter((i) => i.nivel === 'Agotado' || i.nivel === 'Bajo');

  if (criticos.length === 0) {
    banner.style.display = 'none';
    return;
  }

  const nombres = criticos
    .slice(0, MAXIMO_INSUMOS_EN_ALERTA)
    .map((i) => `${i.nombre} (${ESTILO_NIVEL[i.nivel].texto.toLowerCase()})`)
    .join(', ');
  const restantes = criticos.length - MAXIMO_INSUMOS_EN_ALERTA;

  // textContent y no innerHTML: los nombres vienen de la base de datos
  texto.textContent = `${criticos.length} insumo(s) necesitan una nueva entrada: ${nombres}` +
    (restantes > 0 ? ` y ${restantes} más.` : '.');
  banner.style.display = '';
}

/* ---------- Modal de movimiento ---------- */

// Llena el <select> del modal con los insumos actuales
function poblarSelectMovimiento() {
  const select = document.getElementById('mov-insumo');
  select.innerHTML = '<option value="">Seleccionar insumo...</option>' + insumosCache
    .map((i) => `<option value="${i.id_insumo}">${escaparHtml(i.nombre)} (${escaparHtml(i.unidad_medida)})</option>`)
    .join('');
}

// Abre el modal de movimiento con el insumo de la fila ya seleccionado
function abrirMovimientoDeInsumo(idInsumo) {
  document.getElementById('modal-movimiento').classList.add('visible');
  document.getElementById('mov-insumo').value = idInsumo;
}

// Envía la entrada o merma al backend
function inicializarFormularioMovimiento() {
  const formulario = document.getElementById('form-movimiento');

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const idInsumo = document.getElementById('mov-insumo').value;
    const tipo = document.getElementById('mov-tipo').value;
    const cantidad = Number(document.getElementById('mov-cantidad').value);
    const motivo = document.getElementById('mov-motivo').value.trim();

    // Validaciones rápidas para avisar sin ir al servidor (el backend vuelve a validar)
    if (!idInsumo) return mostrarNotificacion('Selecciona un insumo');
    if (!(cantidad > 0)) return mostrarNotificacion('La cantidad debe ser mayor que 0');
    if (tipo === 'Salida por merma' && motivo === '') {
      return mostrarNotificacion('El motivo es obligatorio en una merma');
    }

    const botonEnviar = formulario.querySelector('[type="submit"]');
    botonEnviar.disabled = true; // evita doble envío mientras responde el servidor
    try {
      await peticionApi(`/insumos/${idInsumo}/movimientos`, {
        method: 'POST',
        body: JSON.stringify({ tipo, cantidad, motivo })
      });
      mostrarNotificacion(tipo === 'Entrada' ? 'Entrada registrada correctamente' : 'Merma registrada correctamente', 'exito');
      cerrarModal(document.getElementById('modal-movimiento'));
      cargarInsumos();
    } catch (error) {
      // El mensaje (ej. merma mayor al stock) ya se muestra dentro de peticionApi
    } finally {
      botonEnviar.disabled = false;
    }
  });
}

/* ---------- Modal de insumo (crear / editar) ---------- */

// Prepara el modal en modo crear (el botón "Nuevo insumo" ya lo abre ui.js)
function inicializarBotonNuevoInsumo() {
  document.querySelectorAll('[data-abrir-modal="modal-insumo"]').forEach((boton) => {
    boton.addEventListener('click', () => {
      const formulario = document.getElementById('form-insumo');
      formulario.reset();
      delete formulario.dataset.idInsumo;
      document.getElementById('titulo-modal-insumo').textContent = 'Nuevo insumo';
    });
  });
}

// Abre el modal en modo editar con los datos del insumo
function abrirEdicionInsumo(idInsumo) {
  const insumo = insumosCache.find((i) => i.id_insumo == idInsumo);
  if (!insumo) return;

  const formulario = document.getElementById('form-insumo');
  formulario.dataset.idInsumo = idInsumo;
  document.getElementById('ins-nombre').value = insumo.nombre;
  document.getElementById('ins-unidad').value = insumo.unidad_medida;
  document.getElementById('ins-minimo').value = insumo.stock_minimo;
  document.getElementById('ins-costo').value = insumo.costo_unitario ?? '';
  document.getElementById('titulo-modal-insumo').textContent = 'Editar insumo';
  document.getElementById('modal-insumo').classList.add('visible');
}

// Crea o edita según formulario.dataset.idInsumo
function inicializarFormularioInsumo() {
  const formulario = document.getElementById('form-insumo');

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const idInsumo = formulario.dataset.idInsumo;
    const cuerpo = {
      nombre: document.getElementById('ins-nombre').value.trim(),
      unidadMedida: document.getElementById('ins-unidad').value,
      stockMinimo: leerNumero('ins-minimo'),
      costoUnitario: leerNumero('ins-costo')
    };

    const botonEnviar = formulario.querySelector('[type="submit"]');
    botonEnviar.disabled = true;
    try {
      await peticionApi(idInsumo ? `/insumos/${idInsumo}` : '/insumos', {
        method: idInsumo ? 'PUT' : 'POST',
        body: JSON.stringify(cuerpo)
      });
      mostrarNotificacion(idInsumo ? 'Insumo actualizado correctamente' : 'Insumo creado correctamente', 'exito');
      cerrarModal(document.getElementById('modal-insumo'));
      cargarInsumos();
    } catch (error) {
      // El mensaje (duplicado, unidad con recetas, validación) ya se muestra dentro de peticionApi
    } finally {
      botonEnviar.disabled = false;
    }
  });
}

/* ---------- Punto de entrada ---------- */

function inicializarInventario() {
  if (!document.getElementById('panel-insumos')) return; // solo actúa en inventario.html

  // Filtros: la búsqueda filtra al escribir; los selects al cambiar
  document.getElementById('filtro-busqueda-insumo').addEventListener('input', renderizarInsumos);
  document.getElementById('filtro-unidad-insumo').addEventListener('change', renderizarInsumos);
  document.getElementById('filtro-nivel-insumo').addEventListener('change', renderizarInsumos);

  // Un solo listener en el tbody para los botones de cada fila
  document.getElementById('tabla-insumos').addEventListener('click', (evento) => {
    const botonMovimiento = evento.target.closest('[data-movimiento-insumo]');
    if (botonMovimiento) return abrirMovimientoDeInsumo(botonMovimiento.dataset.movimientoInsumo);

    const botonEditar = evento.target.closest('[data-editar-insumo]');
    if (botonEditar) abrirEdicionInsumo(botonEditar.dataset.editarInsumo);
  });

  inicializarBotonNuevoInsumo();
  inicializarFormularioMovimiento();
  inicializarFormularioInsumo();
  cargarInsumos();
}