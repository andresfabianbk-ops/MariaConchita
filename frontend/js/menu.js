/* ==========================================================================
   menu.js — Menú digital: categorías y productos. Solo se carga en menu.html.
   Depende de api.js (peticionApi) y ui.js (escaparHtml, cerrarModal).
   ========================================================================== */


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
        ${escaparHtml(categoria.nombre)}
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
          ${productosDeCategoria.map((p) => `<li>${escaparHtml(p.nombre)} — $ ${Number(p.precio).toLocaleString('es-CO')}</li>`).join('')}
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
    .map((categoria) => `<option value="${categoria.id_categoria}">${escaparHtml(categoria.nombre)}</option>`)
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
            <div class="celda-producto__nombre">${escaparHtml(producto.nombre)}</div>
            <div class="celda-producto__categoria">${escaparHtml(nombreCategoriaPorId(producto.id_categoria))}</div>
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
      const formulario = document.getElementById('form-producto');
      formulario.reset();
      delete formulario.dataset.idProducto;
      document.getElementById('titulo-modal-producto').textContent = 'Agregar producto';
    });
  });
}

// Envía el formulario de producto: crea o edita según si hay id_producto guardado
function inicializarFormularioProducto() {
  const formulario = document.getElementById('form-producto');
  if (!formulario) return;

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const idProducto = formulario.dataset.idProducto;

    const datosProducto = {
      nombre: document.getElementById('prod-nombre').value.trim(),
      precio: Number(document.getElementById('prod-precio').value),
      id_categoria: Number(document.getElementById('prod-categoria').value),
      disponible: document.getElementById('prod-disponible').checked
    };

    try {
      if (idProducto) {
        await peticionApi(`/menu/productos/${idProducto}`, { method: 'PUT', body: JSON.stringify(datosProducto) });
        mostrarNotificacion('Producto actualizado correctamente', 'exito');
      } else {
        await peticionApi('/menu/productos', { method: 'POST', body: JSON.stringify(datosProducto) });
        mostrarNotificacion('Producto creado correctamente', 'exito');
      }
      cerrarModal(document.getElementById('modal-producto'));
      cargarProductos();
    } catch (error) {
      // El error ya se notificó dentro de peticionApi
    }
  });
}

// Punto de entrada del menú: solo actúa en menu.html. Categorías primero, para que
// los productos ya encuentren el nombre de su categoría (corrige "Sin categoría").
async function inicializarMenu() {
  if (!document.getElementById('panel-productos')) return;
  inicializarBotonAgregarCategoria();
  inicializarFormularioCategoria();
  inicializarBotonAgregarProducto();
  inicializarFormularioProducto();
  inicializarFiltrosProductos();
  await cargarCategorias();
  await cargarProductos();
}