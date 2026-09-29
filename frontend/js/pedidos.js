// Menú real del restaurante, organizado por categorías (RF01 - Gestión de menú digital)
// El campo "ingredientes" lista los componentes que el cliente puede pedir quitar
// Ahora se carga dinámicamente desde el backend (GET /api/menu) en vez de estar hardcodeado
let menu = [];

// Lista plana de todos los productos, incluyendo su categoría para identificarlos sin ambigüedad
// (ej: "Pollo" de Mazorcadas vs "Pollo Desmechado" de Arepas se ven distintos en cocina)
// Se recalcula cada vez que se carga el menú desde el backend
let productosDisponibles = [];

// Almacena los productos agregados al pedido actual
let pedidoActual = [];

// Guarda el producto que está pendiente de personalizar mientras el modal está abierto
let productoPendiente = null;

// Obtiene el menú desde el backend y lo deja listo para renderizar
const cargarMenu = async () => {
  try {
    const respuesta = await fetch(`${API_URL}/menu`);
    if (!respuesta.ok) throw new Error('Error al cargar el menú');

    menu = await respuesta.json();
    productosDisponibles = menu.flatMap(categoria =>
      categoria.productos.map(producto => ({ ...producto, categoria: categoria.categoria }))
    );

    renderizarProductos();
  } catch (error) {
    const contenedor = document.getElementById('lista-productos');
    if (contenedor) contenedor.innerHTML = '<p>No se pudo cargar el menú. Intente de nuevo.</p>';
    console.error(error.message);
  }
};

// Renderiza el menú completo agrupado por categoría
const renderizarProductos = () => {
  const contenedor = document.getElementById('lista-productos');
  if (!contenedor) return;

  contenedor.innerHTML = menu.map(categoria => `
    <div class="categoria-menu">
      <h3 class="categoria-titulo">${categoria.categoria}</h3>
      <div class="categoria-productos">
        ${categoria.productos.map(producto => `
          <div class="producto-card">
            <span>${producto.nombre} - ${formatearPrecio(producto.precio)}</span>
            <button onclick="abrirPersonalizacion(${producto.id})">+</button>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
};

// Abre el modal de personalización si el producto tiene ingredientes,
// o lo agrega directo si no aplica (ej: bebidas, adiciones)
const abrirPersonalizacion = (idProducto) => {
  const producto = productosDisponibles.find(p => p.id === idProducto);

  if (!producto.ingredientes || producto.ingredientes.length === 0) {
    agregarProducto(producto, []);
    return;
  }

  productoPendiente = producto;

  const modal = document.getElementById('modal-personalizar');
  document.getElementById('personalizar-titulo').textContent = producto.nombre;
  document.getElementById('personalizar-ingredientes').innerHTML = producto.ingredientes.map((ing) => `
    <label class="ingrediente-item">
      <input type="checkbox" value="${ing.id_insumo}" id="ing-${ing.id_insumo}" ${ing.es_excluible ? '' : 'disabled'}>
      ${ing.nombre}${ing.es_excluible ? '' : ' <span class="ingrediente-base">(base)</span>'}
    </label>
  `).join('');

  modal.style.display = 'flex';
};

// Confirma la personalización: arma la lista de ingredientes desmarcados y agrega al pedido
const confirmarPersonalizacion = () => {
  const checkboxes = document.querySelectorAll('#personalizar-ingredientes input[type="checkbox"]');
  const idsExcluidos = Array.from(checkboxes)
    .filter(c => c.checked)
    .map(c => Number(c.value));

  agregarProducto(productoPendiente, idsExcluidos);
  cerrarPersonalizacion();
};

// Cierra el modal sin agregar el producto
const cerrarPersonalizacion = () => {
  document.getElementById('modal-personalizar').style.display = 'none';
  productoPendiente = null;
};

// Agrega un producto al resumen del pedido, con sus ingredientes quitados (si aplica)
const agregarProducto = (producto, idsExcluidos) => {
  const nombresExcluidos = producto.ingredientes
    .filter(ing => idsExcluidos.includes(ing.id_insumo))
    .map(ing => ing.nombre);

  const observaciones = nombresExcluidos.length > 0
    ? 'Sin: ' + nombresExcluidos.join(', ')
    : '';

  const existente = pedidoActual.find(p => p.id === producto.id && p.observaciones === observaciones);

  if (existente) {
    existente.cantidad += 1;
  } else {
    pedidoActual.push({ ...producto, cantidad: 1, observaciones, idsIngredientesExcluidos: idsExcluidos });
  }

  renderizarResumen();
};

// Elimina un producto específico del resumen (por posición, ya que puede haber duplicados personalizados)
const eliminarProducto = (indice) => {
  pedidoActual.splice(indice, 1);
  renderizarResumen();
};

// Renderiza el resumen del pedido actual
const renderizarResumen = () => {
  const resumen = document.getElementById('resumen-pedido');
  if (!resumen) return;

  resumen.innerHTML = pedidoActual.map((p, i) => `
    <li>
      <span>
        ${p.categoria} - ${p.nombre} x${p.cantidad} - ${formatearPrecio(p.precio * p.cantidad)}
        ${p.observaciones ? `<br><small class="observacion-item">${p.observaciones}</small>` : ''}
      </span>
      <button class="btn-eliminar" onclick="eliminarProducto(${i})">✕</button>
    </li>
  `).join('');
};

// Envía el pedido a domicilio registrado al backend
const enviarPedido = async () => {
  const nombreCliente = document.getElementById('cliente-nombre').value;
  const telefono = document.getElementById('cliente-telefono').value;
  const direccion = document.getElementById('cliente-direccion').value;

  if (!nombreCliente || !telefono || !direccion) {
    alert('Complete los datos del cliente');
    return;
  }
  if (pedidoActual.length === 0) {
    alert('Agregue al menos un producto');
    return;
  }

  try {
    const respuesta = await fetch(`${API_URL}/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente: { nombreCliente, telefono, direccion },
        productos: pedidoActual
      })
    });

    if (!respuesta.ok) throw new Error('Error al enviar el pedido');

    alert('Pedido enviado a cocina');
    pedidoActual = [];
    renderizarResumen();

    // Limpia los datos del cliente para el siguiente pedido
    document.getElementById('cliente-nombre').value = '';
    document.getElementById('cliente-telefono').value = '';
    document.getElementById('cliente-direccion').value = '';
  } catch (error) {
    alert(error.message);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  cargarMenu();

  const btnEnviar = document.getElementById('btn-enviar-pedido');
  if (btnEnviar) btnEnviar.addEventListener('click', enviarPedido);

  const btnConfirmarPersonalizar = document.getElementById('btn-confirmar-personalizar');
  if (btnConfirmarPersonalizar) btnConfirmarPersonalizar.addEventListener('click', confirmarPersonalizacion);

  const btnCancelarPersonalizar = document.getElementById('btn-cancelar-personalizar');
  if (btnCancelarPersonalizar) btnCancelarPersonalizar.addEventListener('click', cerrarPersonalizacion);
});