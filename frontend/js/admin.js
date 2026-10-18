/* ==========================================================================
   Base de conexión al backend: token, headers y notificaciones
   ========================================================================== */

// Arma los headers estándar para peticiones autenticadas
function obtenerHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// Muestra una notificación simple (éxito o error), usando la paleta de marca
function mostrarNotificacion(mensaje, tipo = 'error') {
  const notificacion = document.createElement('div');
  notificacion.textContent = mensaje;
  notificacion.style.cssText = `
    position: fixed; top: var(--esp-5); right: var(--esp-5); z-index: 9999;
    padding: var(--esp-3) var(--esp-5); border-radius: var(--radio-m);
    font-family: var(--fuente-cuerpo); font-size: 0.9rem;
    box-shadow: var(--sombra-modal);
    color: ${tipo === 'exito' ? 'var(--exito)' : 'var(--peligro)'};
    background: ${tipo === 'exito' ? 'var(--exito-fondo)' : 'var(--peligro-fondo)'};
    border: 1px solid ${tipo === 'exito' ? 'var(--exito)' : 'var(--peligro)'};
  `;
  document.body.appendChild(notificacion);
  setTimeout(() => notificacion.remove(), 3500);
}

// Wrapper de fetch: maneja token, parseo de JSON y errores del backend de forma centralizada
async function peticionApi(ruta, opciones = {}) {
  try {
    const respuesta = await fetch(`${API_URL}${ruta}`, {
      ...opciones,
      headers: obtenerHeaders()
    });
    const datos = await respuesta.json();

    if (respuesta.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('empleado');
    mostrarBloqueoSesion('Tu sesión expiró o no es válida. Inicia sesión de nuevo.');
    throw new Error('Sesión no válida');
    
    }

    if (!respuesta.ok) {
      throw new Error(datos.mensaje || 'Ocurrió un error inesperado');
    }

    return datos;
  } catch (error) {
    mostrarNotificacion(error.message, 'error');
    throw error; // se re-lanza para que quien llamó decida si detener su flujo
  }
}

/* ==========================================================================
   Módulo: Categorías
   ========================================================================== */

let categoriasCache = []; // se reutiliza también para poblar el <select> de Producto

// Trae las categorías reales del backend y las renderiza
async function cargarCategorias() {
  try {
    categoriasCache = await peticionApi('/categorias');
    renderizarCategorias(categoriasCache);
    poblarSelectCategoriasProducto('prod-categoria');
    poblarSelectCategoriasProducto('filtro-categoria-producto', true);
  } catch (error) {
    // El error ya se notificó dentro de peticionApi
  }
}

// Construye la tabla de categorías (con acordeón de productos) o muestra el estado vacío
function renderizarCategorias(categorias) {
  const panel = document.querySelector('#panel-categorias .tarjeta');
  if (!panel) return;

  const estadoVacio = panel.querySelector('.estado-vacio');
  let tablaExistente = panel.querySelector('[data-tabla-categorias]');

  if (categorias.length === 0) {
    if (estadoVacio) estadoVacio.style.display = '';
    if (tablaExistente) tablaExistente.remove();
    return;
  }

  if (estadoVacio) estadoVacio.style.display = 'none';
  if (tablaExistente) tablaExistente.remove();

  const envoltorio = document.createElement('div');
  envoltorio.className = 'tabla-envoltorio';
  envoltorio.setAttribute('data-tabla-categorias', '');

  const filas = categorias.map((categoria) => `
    <tr data-id-categoria="${categoria.id_categoria}" class="fila-categoria-expandible">
      <td>
        <button class="btn-expandir" data-expandir-categoria="${categoria.id_categoria}" aria-label="Ver productos">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
        </button>
        ${categoria.nombre}
      </td>
      <td>
        <div class="tabla__acciones">
          <button class="btn-icono" data-editar-categoria="${categoria.id_categoria}" aria-label="Editar categoría" title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          <button class="btn-icono" data-eliminar-categoria="${categoria.id_categoria}" aria-label="Eliminar categoría" title="Eliminar">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  envoltorio.innerHTML = `
    <table class="tabla">
      <thead><tr><th>Categoría</th><th></th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
  `;

  // Delegación de eventos: un solo listener en el tbody para expandir/colapsar
  const tbody = envoltorio.querySelector('tbody');
  tbody.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-expandir-categoria]');
    if (!boton) return;

    const idCategoria = boton.dataset.expandirCategoria;
    const filaCategoria = boton.closest('tr');
    const filaExpandida = tbody.querySelector(`[data-fila-productos="${idCategoria}"]`);

    // Si ya está expandida, colapsa
    if (filaExpandida) {
      filaExpandida.remove();
      boton.classList.remove('btn-expandir--abierto');
      return;
    }

    // Colapsa cualquier otra fila expandida abierta (solo una a la vez)
    tbody.querySelectorAll('[data-fila-productos]').forEach((fila) => fila.remove());
    tbody.querySelectorAll('.btn-expandir--abierto').forEach((b) => b.classList.remove('btn-expandir--abierto'));

    const productosDeCategoria = productosCache.filter((p) => p.id_categoria == idCategoria);

    const contenido = productosDeCategoria.length === 0
      ? '<p class="texto-atenuado">Sin productos en esta categoría</p>'
      : `<ul class="lista-productos-acordeon">
          ${productosDeCategoria.map((p) => `<li>${p.nombre} — $ ${Number(p.precio).toLocaleString('es-CO')}</li>`).join('')}
        </ul>`;

    const nuevaFila = document.createElement('tr');
    nuevaFila.setAttribute('data-fila-productos', idCategoria);
    nuevaFila.innerHTML = `<td colspan="2" class="celda-acordeon">${contenido}</td>`;
    filaCategoria.after(nuevaFila);

    boton.classList.add('btn-expandir--abierto');
  });

  panel.appendChild(envoltorio);
  asignarEventosCategorias();
}

// Puebla un <select> de categoría con datos reales (reutilizable: modal y filtro)
function poblarSelectCategoriasProducto(idSelect = 'prod-categoria', incluirTodas = false) {
  const select = document.getElementById(idSelect);
  if (!select) return;

  const opciones = categoriasCache
    .map((categoria) => `<option value="${categoria.id_categoria}">${categoria.nombre}</option>`)
    .join('');

  select.innerHTML = incluirTodas
    ? `<option value="">Todas las categorías</option>${opciones}`
    : opciones;
}

// Asigna los listeners de editar/eliminar a los botones recién creados
function asignarEventosCategorias() {
  document.querySelectorAll('[data-editar-categoria]').forEach((boton) => {
    boton.addEventListener('click', () => {
      const id = boton.dataset.editarCategoria;
      const categoria = categoriasCache.find((c) => c.id_categoria == id);
      if (!categoria) return;

      const formulario = document.querySelector('#modal-categoria form');
      formulario.dataset.idCategoria = id;
      document.getElementById('cat-nombre').value = categoria.nombre;
      document.getElementById('titulo-modal-categoria').textContent = 'Editar categoría';

      document.getElementById('modal-categoria').classList.add('visible');
    });
  });

  document.querySelectorAll('[data-eliminar-categoria]').forEach((boton) => {
    boton.addEventListener('click', async () => {
      const id = boton.dataset.eliminarCategoria;
      const categoria = categoriasCache.find((c) => c.id_categoria == id);
      if (!categoria) return;

      const confirmar = confirm(`¿Seguro que deseas eliminar la categoría "${categoria.nombre}"?`);
      if (!confirmar) return;

      try {
        await peticionApi(`/categorias/${id}`, { method: 'DELETE' });
        mostrarNotificacion('Categoría eliminada correctamente', 'exito');
        cargarCategorias();
      } catch (error) {
        // El mensaje 409 (categoría en uso) ya se muestra dentro de peticionApi
      }
    });
  });
}

// Conecta el botón "Agregar categoría" para abrir el modal en modo crear
function inicializarBotonAgregarCategoria() {
  document.querySelectorAll('[data-abrir-modal="modal-categoria"]').forEach((boton) => {
    boton.addEventListener('click', () => {
      const formulario = document.querySelector('#modal-categoria form');
      formulario.reset();
      delete formulario.dataset.idCategoria;
      document.getElementById('titulo-modal-categoria').textContent = 'Agregar categoría';
    });
  });
}

// Conecta el submit del formulario de categoría (crear o editar según dataset.idCategoria)
function inicializarFormularioCategoria() {
  const formulario = document.querySelector('#modal-categoria form');
  if (!formulario) return;

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const nombre = document.getElementById('cat-nombre').value.trim();
    if (!nombre) return;

    const idCategoria = formulario.dataset.idCategoria;

    try {
      if (idCategoria) {
        await peticionApi(`/categorias/${idCategoria}`, {
          method: 'PUT',
          body: JSON.stringify({ nombre })
        });
        mostrarNotificacion('Categoría actualizada correctamente', 'exito');
      } else {
        await peticionApi('/categorias', {
          method: 'POST',
          body: JSON.stringify({ nombre })
        });
        mostrarNotificacion('Categoría creada correctamente', 'exito');
      }

      cerrarModal(document.getElementById('modal-categoria'));
      cargarCategorias();
    } catch (error) {
      // El mensaje de error (ej. duplicado) ya se muestra dentro de peticionApi
    }
  });
}

// Cierra la sesión: borra los datos que guarda el login y vuelve al inicio de sesión
function cerrarSesion() {
  localStorage.removeItem('token');
  localStorage.removeItem('empleado');
  window.location.replace('../../index.html'); // replace evita que la página protegida quede en el historial
}

// Conecta todos los elementos marcados con data-cerrar-sesion a cerrarSesion()
function inicializarCerrarSesion() {
  document.querySelectorAll('[data-cerrar-sesion]').forEach((enlace) => {
    enlace.addEventListener('click', (evento) => {
      evento.preventDefault();
      cerrarSesion();
    });
  });
}

// Ventana a pantalla completa que bloquea la página y obliga a volver al inicio de sesión
function mostrarBloqueoSesion(mensaje) {
  if (document.getElementById('bloqueo-sesion')) return; // evita duplicados si fallan varias peticiones a la vez

  const fondo = document.createElement('div');
  fondo.id = 'bloqueo-sesion';
  fondo.style.cssText = `
    position: fixed; inset: 0; z-index: 10000;
    display: flex; align-items: center; justify-content: center;
    background: var(--crema); font-family: var(--fuente-cuerpo);
  `;

  const caja = document.createElement('div');
  caja.style.cssText = `
    background: var(--blanco); padding: var(--esp-6); max-width: 380px;
    border-radius: var(--radio-l); box-shadow: var(--sombra-modal); text-align: center;
  `;

  const titulo = document.createElement('h2');
  titulo.textContent = 'Sesión no válida';
  titulo.style.cssText = 'font-family: var(--fuente-titulo); color: var(--negro-suave); margin-bottom: var(--esp-3);';

  const texto = document.createElement('p');
  texto.textContent = mensaje;
  texto.style.cssText = 'color: var(--gris-texto); margin-bottom: var(--esp-5);';

  const botonAceptar = document.createElement('button');
  botonAceptar.type = 'button';
  botonAceptar.textContent = 'Aceptar';
  botonAceptar.style.cssText = `
    background: var(--naranja); color: var(--blanco); border: none; cursor: pointer;
    padding: var(--esp-3) var(--esp-6); border-radius: var(--radio-m); font-weight: 600;
  `;
  botonAceptar.addEventListener('click', cerrarSesion); // limpia lo que quede y vuelve a index.html

  caja.append(titulo, texto, botonAceptar);
  fondo.appendChild(caja);
  document.body.appendChild(fondo);
  botonAceptar.focus();
}

// Devuelve true si hay sesión; si no, bloquea la página con el mensaje
function verificarSesion() {
  if (localStorage.getItem('token')) return true;
  mostrarBloqueoSesion('No has iniciado sesión. Inicia sesión para ver esta página.');
  return false;
}

// Si el navegador restaura la página desde caché (botón atrás), se vuelve a verificar
window.addEventListener('pageshow', (evento) => {
  if (evento.persisted) verificarSesion();
});

// Filtros de escritura: data-solo-digitos (documento, celular) y data-solo-letras (nombres, apellidos)
document.addEventListener('input', (evento) => {
  const campo = evento.target;
  if (campo.matches('[data-solo-digitos]')) {
    campo.value = campo.value.replace(/\D/g, '');
  }
  if (campo.matches('[data-solo-letras]')) {
    campo.value = campo.value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'-]/g, ''); // letras, tildes, ñ, espacios, apóstrofe y guion
  }
});


document.addEventListener('DOMContentLoaded', () => {
  if (!verificarSesion()) return; // sin sesión no se inicializa nada ni se piden datos
  inicializarSidebar();
  inicializarCerrarSesion()
  inicializarModales();
  inicializarPestanas();
  inicializarValidacionFormularios();
  inicializarInterruptores();
  inicializarEmpleados();
  cargarCategorias();                    
  inicializarBotonAgregarCategoria();    
  inicializarFormularioCategoria();
  cargarProductos();
  inicializarBotonAgregarProducto();
  inicializarFiltrosProductos();
});

/* ---------- Sidebar: colapsar (escritorio) / abrir (móvil) ---------- */

function inicializarSidebar() {
  const shell = document.querySelector('.app-shell');
  const botonToggle = document.querySelector('[data-accion="toggle-sidebar"]');
  if (!shell || !botonToggle) return;

  botonToggle.addEventListener('click', () => {
    const esMovil = window.matchMedia('(max-width: 900px)').matches;
    shell.classList.toggle(esMovil ? 'sidebar-abierta' : 'sidebar-colapsada');
  });

  // Cerrar sidebar móvil al tocar fuera de ella
  document.addEventListener('click', (evento) => {
    const esMovil = window.matchMedia('(max-width: 900px)').matches;
    if (!esMovil || !shell.classList.contains('sidebar-abierta')) return;
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

/* ---------- Pestañas (categorías de menú, tipos de reporte, etc.) ---------- */

function inicializarPestanas() {
  document.querySelectorAll('.pestanas').forEach((contenedor) => {
    const pestanas = contenedor.querySelectorAll('.pestana');
    pestanas.forEach((pestana) => {
      pestana.addEventListener('click', () => {
        pestanas.forEach((p) => p.classList.remove('activa'));
        pestana.classList.add('activa');
      });
    });
  });
}

/* ---------- Validación de formularios (solo UI: campos requeridos) ---------- */

function inicializarValidacionFormularios() {
  document.querySelectorAll('form[data-validar]').forEach((formulario) => {
    formulario.addEventListener('submit', (evento) => {
      evento.preventDefault(); // Diseño front-end: sin envío real al backend
      let esValido = true;

      formulario.querySelectorAll('[required]').forEach((campoInput) => {
        const campo = campoInput.closest('.campo');
        if (!campo) return;
        const vacio = !campoInput.value || !campoInput.value.trim();
        campo.classList.toggle('con-error', vacio);
        if (vacio) esValido = false;
      });

      if (esValido) cerrarModal(formulario.closest('.fondo-modal'));
    });

    // Quita el error apenas el usuario empieza a corregir el campo
    formulario.querySelectorAll('[required]').forEach((campoInput) => {
      campoInput.addEventListener('input', () => {
        campoInput.closest('.campo')?.classList.remove('con-error');
      });
    });
  });
}

/* ---------- Interruptores (toggles) de disponibilidad / activo ---------- */

function inicializarInterruptores() {
  document.querySelectorAll('.interruptor input').forEach((interruptor) => {
    interruptor.addEventListener('change', () => {
      const fila = interruptor.closest('tr');
      const badge = fila?.querySelector('.badge[data-badge-disponibilidad]');
      if (!badge) return;
      const activo = interruptor.checked;
      badge.textContent = activo ? 'Disponible' : 'No disponible';
      badge.classList.toggle('badge--exito', activo);
      badge.classList.toggle('badge--neutral', !activo);
    });
  });
}

/* ==========================================================================
   Módulo: Productos
   ========================================================================== */

let productosCache = [];

// Trae los productos reales del backend (incluye inactivos) y los renderiza
async function cargarProductos() {
  try {
    productosCache = await peticionApi('/menu/productos');
    renderizarProductos(productosCache);
  } catch (error) {
    // El error ya se notificó dentro de peticionApi
  }
}

// Busca el nombre de categoría a partir del id (usa categoriasCache ya cargado)
function nombreCategoriaPorId(idCategoria) {
  const categoria = categoriasCache.find((c) => c.id_categoria == idCategoria);
  return categoria ? categoria.nombre : 'Sin categoría';
}

// Construye la tabla de productos o muestra el estado vacío
function renderizarProductos(productos) {
  const panel = document.querySelector('#panel-productos .tarjeta');
  if (!panel) return;

  const estadoVacio = panel.querySelector('.estado-vacio');
  let tablaExistente = panel.querySelector('[data-tabla-productos]');

  if (productos.length === 0) {
    if (estadoVacio) estadoVacio.style.display = '';
    if (tablaExistente) tablaExistente.remove();
    return;
  }

  if (estadoVacio) estadoVacio.style.display = 'none';
  if (tablaExistente) tablaExistente.remove();

  const envoltorio = document.createElement('div');
  envoltorio.className = 'tabla-envoltorio';
  envoltorio.setAttribute('data-tabla-productos', '');

  const filas = productos.map((producto) => `
    <tr data-id-producto="${producto.id_producto}">
      <td>
        <div class="celda-producto">
          <div class="celda-producto__miniatura"></div>
          <div>
            <div class="celda-producto__nombre">${producto.nombre}</div>
            <div class="celda-producto__categoria">${nombreCategoriaPorId(producto.id_categoria)}</div>
          </div>
        </div>
      </td>
      <td>$ ${Number(producto.precio).toLocaleString('es-CO')}</td>
      <td>
        <label class="interruptor">
          <input type="checkbox" data-toggle-disponible="${producto.id_producto}" ${producto.disponible ? 'checked' : ''}>
          <span class="interruptor__riel"></span>
        </label>
      </td>
      <td>
        <div class="tabla__acciones">
          <button class="btn-icono" data-editar-producto="${producto.id_producto}" aria-label="Editar producto" title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          <button class="btn-icono" data-eliminar-producto="${producto.id_producto}" aria-label="Eliminar producto" title="Eliminar">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  envoltorio.innerHTML = `
    <table class="tabla">
      <thead><tr><th>Producto</th><th>Precio</th><th>Disponible</th><th></th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
  `;

  panel.appendChild(envoltorio);
  asignarEventosProductos();
}

// Filtra productosCache en memoria según búsqueda, categoría y disponibilidad, y re-renderiza
function aplicarFiltrosProductos() {
  const texto = document.getElementById('buscar-producto').value.trim().toLowerCase();
  const idCategoria = document.getElementById('filtro-categoria-producto').value;
  const disponible = document.getElementById('filtro-disponible-producto').value;

  const filtrados = productosCache.filter((producto) => {
    const coincideTexto = producto.nombre.toLowerCase().includes(texto);
    const coincideCategoria = !idCategoria || producto.id_categoria == idCategoria;
    const coincideDisponible = disponible === '' || Number(producto.disponible) === Number(disponible);
    return coincideTexto && coincideCategoria && coincideDisponible;
  });

  renderizarProductos(filtrados);
}

// Asigna los listeners de los 3 controles de filtro de Productos
function inicializarFiltrosProductos() {
  document.getElementById('buscar-producto')?.addEventListener('input', aplicarFiltrosProductos);
  document.getElementById('filtro-categoria-producto')?.addEventListener('change', aplicarFiltrosProductos);
  document.getElementById('filtro-disponible-producto')?.addEventListener('change', aplicarFiltrosProductos);
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

// Asigna los listeners de editar/eliminar/disponibilidad a los elementos recién creados
function asignarEventosProductos() {
  // Editar: abre el modal precargado con los datos del producto
  document.querySelectorAll('[data-editar-producto]').forEach((boton) => {
    boton.addEventListener('click', () => {
      const id = boton.dataset.editarProducto;
      const producto = productosCache.find((p) => p.id_producto == id);
      if (!producto) return;

      const formulario = document.getElementById('form-producto');
      formulario.dataset.idProducto = id;

      document.getElementById('prod-nombre').value = producto.nombre;
      document.getElementById('prod-precio').value = producto.precio;
      document.getElementById('prod-categoria').value = producto.id_categoria;
      document.getElementById('prod-disponible').checked = !!producto.disponible;
      document.getElementById('titulo-modal-producto').textContent = 'Editar producto';

      document.getElementById('modal-producto').classList.add('visible');
    });
  });

  // Eliminar (borrado lógico): pide confirmación y llama al DELETE
  document.querySelectorAll('[data-eliminar-producto]').forEach((boton) => {
    boton.addEventListener('click', async () => {
      const id = boton.dataset.eliminarProducto;
      const producto = productosCache.find((p) => p.id_producto == id);
      if (!producto) return;

      const confirmar = confirm(`¿Seguro que deseas eliminar "${producto.nombre}" del menú digital?`);
      if (!confirmar) return;

      try {
        await peticionApi(`/menu/productos/${id}`, { method: 'DELETE' });
        mostrarNotificacion('Producto desactivado correctamente', 'exito');
        productosCache = await peticionApi('/menu/productos');
        aplicarFiltrosProductos();
      } catch (error) {
        // El error ya se notificó dentro de peticionApi
      }
    });
  });

  // Interruptor de disponibilidad: PUT inmediato al cambiar
  document.querySelectorAll('[data-toggle-disponible]').forEach((interruptor) => {
    interruptor.addEventListener('change', async () => {
      const id = interruptor.dataset.toggleDisponible;
      const producto = productosCache.find((p) => p.id_producto == id);
      if (!producto) return;

      try {
        await peticionApi(`/menu/productos/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
            nombre: producto.nombre,
            precio: Number(producto.precio),
            id_categoria: producto.id_categoria,
            disponible: interruptor.checked
          })
        });
        mostrarNotificacion('Disponibilidad actualizada', 'exito');
        productosCache = await peticionApi('/menu/productos');
        aplicarFiltrosProductos();
      } catch (error) {
        interruptor.checked = !interruptor.checked; // revierte el switch si falla
      }
    });
  });
}

// Conecta el botón "Agregar producto" para abrir el modal en modo crear
function inicializarBotonAgregarProducto() {
  document.querySelectorAll('[data-abrir-modal="modal-producto"]').forEach((boton) => {
    boton.addEventListener('click', () => {
      if (boton.hasAttribute('data-editar-producto')) return;

      const formulario = document.getElementById('form-producto');
      formulario.reset();
      delete formulario.dataset.idProducto;
      document.getElementById('titulo-modal-producto').textContent = 'Agregar producto';
    });
  });
}

// Envía el formulario de producto: crea o edita según si hay id_producto guardado
document.getElementById('form-producto')?.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const formulario = evento.target;
  const idProducto = formulario.dataset.idProducto;

  const datosProducto = {
    nombre: document.getElementById('prod-nombre').value.trim(),
    precio: Number(document.getElementById('prod-precio').value),
    id_categoria: Number(document.getElementById('prod-categoria').value),
    disponible: document.getElementById('prod-disponible').checked
  };

  try {
    if (idProducto) {
      await peticionApi(`/menu/productos/${idProducto}`, {
        method: 'PUT',
        body: JSON.stringify(datosProducto)
      });
      mostrarNotificacion('Producto actualizado correctamente', 'exito');
    } else {
      await peticionApi('/menu/productos', {
        method: 'POST',
        body: JSON.stringify(datosProducto)
      });
      mostrarNotificacion('Producto creado correctamente', 'exito');
    }

    document.getElementById('modal-producto').classList.remove('visible');
    cargarProductos();
  } catch (error) {
    // El error ya se notificó dentro de peticionApi
  }
});

// Resetea el formulario cada vez que se abre el modal para "Agregar producto"
document.querySelectorAll('[data-abrir-modal="modal-producto"]').forEach((boton) => {
  boton.addEventListener('click', () => {
    // Si el botón viene de una fila de edición, no lo toca (data-editar-producto ya precargó el formulario)
    if (boton.hasAttribute('data-editar-producto')) return;

    const formulario = document.getElementById('form-producto');
    formulario.reset();
    delete formulario.dataset.idProducto;
    document.getElementById('titulo-modal-producto').textContent = 'Agregar producto';
  });
});

/* ==========================================================================
   Módulo: Empleados
   ========================================================================== */

let empleadosCache = [];
let idEmpleadoRestablecer = null;

// Evita que texto con < o > rompa el HTML al insertarlo en la tabla
function escaparHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

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
        <span class="texto-atenuado">${activo ? 'Activo' : 'Inactivo'}</span>
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

// Filtra empleadosCache en memoria (texto, rol, estado) y re-renderiza
function aplicarFiltrosEmpleados() {
  const texto = document.getElementById('buscar-empleado').value.trim().toLowerCase();
  const rol = document.getElementById('filtro-rol-empleado').value;
  const estado = document.getElementById('filtro-estado-empleado').value;

  const filtrados = empleadosCache.filter((e) => {
    const base = `${e.nombres} ${e.apellidos} ${e.correo} ${e.numeroDocumento}`.toLowerCase();
    return base.includes(texto)
      && (!rol || e.cargo === rol)
      && (!estado || e.estado === estado);
  });

  renderizarEmpleados(filtrados);
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
      const accion = interruptor.checked ? 'activar' : 'desactivar';

      try {
        await peticionApi(`/empleados/${id}/${accion}`, { method: 'PUT' });
        mostrarNotificacion(interruptor.checked ? 'Empleado activado' : 'Empleado desactivado', 'exito');
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