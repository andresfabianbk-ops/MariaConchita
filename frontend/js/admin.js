/* ==========================================================================
   Base de conexión al backend: token, headers y notificaciones
   ========================================================================== */

const API_BASE = 'http://localhost:3000/api'; // TODO (P8): mover a configuración por entorno

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
    const respuesta = await fetch(`${API_BASE}${ruta}`, {
      ...opciones,
      headers: obtenerHeaders()
    });
    const datos = await respuesta.json();

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

document.addEventListener('DOMContentLoaded', () => {
  inicializarSidebar();
  inicializarModales();
  inicializarPestanas();
  inicializarValidacionFormularios();
  inicializarInterruptores();
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
  document.getElementById('buscar-producto').addEventListener('input', aplicarFiltrosProductos);
  document.getElementById('filtro-categoria-producto').addEventListener('change', aplicarFiltrosProductos);
  document.getElementById('filtro-disponible-producto').addEventListener('change', aplicarFiltrosProductos);
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
document.getElementById('form-producto').addEventListener('submit', async (evento) => {
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
