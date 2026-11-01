/* ==========================================================================
   pedidos.js — Registro de pedidos a domicilio (Cajero y Administrador)
   Cargar después de config.js, sesion.js, api.js, ui.js (escaparHtml) y comun.js (formatearPrecio)
   ========================================================================== */

// Cargos que pueden usar esta página (el backend también lo valida en cada ruta)
const CARGOS_PERMITIDOS = ['Cajero', 'Administrador'];

// Solo para mostrar el costo de envío; el valor real lo asigna el backend al crear el pedido
const COSTO_ENVIO_MOSTRADO = 2000;

const INTERVALO_CONSULTA_PEDIDOS = 5000;
let temporizadorPedidos = null;
let consultandoPedidos = false;

// Menú por categorías que devuelve GET /api/menu
let menu = [];

// Lista plana de productos, con su categoría para identificarlos sin ambigüedad en cocina
let productosDisponibles = [];

// Líneas del pedido actual: { clave, id, nombre, categoria, precio, cantidad, observaciones, idsIngredientesExcluidos }
let pedidoActual = [];

// Producto que espera personalización mientras el modal está abierto
let productoPendiente = null;

// Evita enviar el mismo pedido dos veces con un doble clic
let enviandoPedido = false;

// Obtiene el menú desde el backend y lo deja listo para renderizar
const cargarMenu = async () => {
  const contenedor = document.getElementById('lista-productos');
  try {
    menu = await peticionApi('/menu');
    productosDisponibles = menu.flatMap((categoria) =>
      categoria.productos.map((producto) => ({ ...producto, categoria: categoria.categoria }))
    );
    renderizarProductos();
  } catch (error) {
    // peticionApi ya mostró el aviso del error
    contenedor.innerHTML = '<p>No se pudo cargar el menú. Recargue la página.</p>';
  }
};

// Renderiza el menú completo agrupado por categoría
const renderizarProductos = () => {
  const contenedor = document.getElementById('lista-productos');

  contenedor.innerHTML = menu.map((categoria) => `
    <div class="categoria-menu">
      <h3 class="categoria-titulo">${escaparHtml(categoria.categoria)}</h3>
      <div class="categoria-productos">
        ${categoria.productos.map((producto) => `
          <div class="producto-card">
            <span>${escaparHtml(producto.nombre)} - ${formatearPrecio(producto.precio)}</span>
            <button type="button" data-id-producto="${producto.id}" aria-label="Agregar ${escaparHtml(producto.nombre)}">+</button>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
};

// Abre el modal de personalización si el producto tiene ingredientes que se puedan quitar;
// si no (ej: bebidas, adiciones) lo agrega directo
const abrirPersonalizacion = (idProducto) => {
  const producto = productosDisponibles.find((p) => p.id === idProducto);
  if (!producto) return;

  const ingredientes = producto.ingredientes || [];
  if (!ingredientes.some((ing) => ing.es_excluible)) {
    agregarProducto(producto, []);
    return;
  }

  productoPendiente = producto;
  document.getElementById('personalizar-titulo').textContent = producto.nombre;
  document.getElementById('personalizar-ingredientes').innerHTML = ingredientes.map((ing) => `
    <label class="ingrediente-item">
      <input type="checkbox" value="${ing.id_insumo}" ${ing.es_excluible ? '' : 'disabled'}>
      ${escaparHtml(ing.nombre)}${ing.es_excluible ? '' : ' <span class="ingrediente-base">(base)</span>'}
    </label>
  `).join('');

  document.getElementById('modal-personalizar').hidden = false;
  document.getElementById('btn-confirmar-personalizar').focus();
};

// Confirma la personalización: toma los ingredientes marcados para quitar y agrega al pedido
const confirmarPersonalizacion = () => {
  if (!productoPendiente) return;

  const idsExcluidos = Array.from(
    document.querySelectorAll('#personalizar-ingredientes input[type="checkbox"]:checked')
  ).map((casilla) => Number(casilla.value));

  agregarProducto(productoPendiente, idsExcluidos);
  cerrarPersonalizacion();
};

// Cierra el modal sin agregar el producto
const cerrarPersonalizacion = () => {
  document.getElementById('modal-personalizar').hidden = true;
  productoPendiente = null;
};

// Agrega un producto al pedido; si ya existe con los mismos ingredientes quitados, suma una unidad
const agregarProducto = (producto, idsExcluidos) => {
  const nombresExcluidos = (producto.ingredientes || [])
    .filter((ing) => idsExcluidos.includes(ing.id_insumo))
    .map((ing) => ing.nombre);

  const observaciones = nombresExcluidos.length > 0 ? 'Sin: ' + nombresExcluidos.join(', ') : '';
  const clave = `${producto.id}|${[...idsExcluidos].sort((a, b) => a - b).join(',')}`;

  const existente = pedidoActual.find((linea) => linea.clave === clave);
  if (existente) {
    existente.cantidad += 1;
  } else {
    pedidoActual.push({
      clave,
      id: producto.id,
      nombre: producto.nombre,
      categoria: producto.categoria,
      precio: Number(producto.precio),
      cantidad: 1,
      observaciones,
      idsIngredientesExcluidos: [...idsExcluidos]
    });
  }

  renderizarResumen();
};

// Suma o resta unidades de una línea; si llega a cero, la quita del pedido
const cambiarCantidad = (indice, cambio) => {
  const linea = pedidoActual[indice];
  if (!linea) return;

  linea.cantidad += cambio;
  if (linea.cantidad <= 0) pedidoActual.splice(indice, 1);
  renderizarResumen();
};

// Quita una línea completa del pedido (por posición: puede haber el mismo producto con distinta personalización)
const eliminarLinea = (indice) => {
  pedidoActual.splice(indice, 1);
  renderizarResumen();
};

// Renderiza el resumen del pedido actual y actualiza los totales
const renderizarResumen = () => {
  const resumen = document.getElementById('resumen-pedido');

  if (pedidoActual.length === 0) {
    resumen.innerHTML = '<li class="resumen-vacio">Aún no hay productos en el pedido</li>';
  } else {
    resumen.innerHTML = pedidoActual.map((linea, i) => `
      <li>
        <div class="resumen-info">
          <span>${escaparHtml(linea.categoria)} - ${escaparHtml(linea.nombre)}</span>
          ${linea.observaciones ? `<small class="observacion-item">${escaparHtml(linea.observaciones)}</small>` : ''}
        </div>
        <div class="resumen-acciones">
          <div class="control-cantidad">
            <button type="button" data-accion="restar" data-indice="${i}" aria-label="Quitar una unidad">−</button>
            <span>${linea.cantidad}</span>
            <button type="button" data-accion="sumar" data-indice="${i}" aria-label="Agregar una unidad">+</button>
          </div>
          <span>${formatearPrecio(linea.precio * linea.cantidad)}</span>
          <button type="button" class="btn-eliminar" data-accion="eliminar" data-indice="${i}" aria-label="Quitar el producto del pedido">✕</button>
        </div>
      </li>
    `).join('');
  }

  actualizarTotales();
};

// Muestra productos, envío y total a cobrar (contraentrega)
const actualizarTotales = () => {
  const subtotal = pedidoActual.reduce((suma, linea) => suma + linea.precio * linea.cantidad, 0);
  const hayProductos = pedidoActual.length > 0;

  document.getElementById('total-productos').textContent = formatearPrecio(subtotal);
  document.getElementById('total-envio').textContent = formatearPrecio(hayProductos ? COSTO_ENVIO_MOSTRADO : 0);
  document.getElementById('total-pedido').textContent = formatearPrecio(hayProductos ? subtotal + COSTO_ENVIO_MOSTRADO : 0);
};

// Envía el pedido a domicilio al backend; el precio y el envío los calcula el servidor
const enviarPedido = async (evento) => {
  evento.preventDefault();
  if (enviandoPedido) return;

  if (pedidoActual.length === 0) {
    mostrarNotificacion('Agregue al menos un producto al pedido');
    return;
  }

  const nombreCliente = document.getElementById('cliente-nombre').value.trim();
  const telefono = document.getElementById('cliente-telefono').value.trim();
  const direccion = document.getElementById('cliente-direccion').value.trim();
  if (!nombreCliente || !telefono || !direccion) {
    mostrarNotificacion('Complete los datos del cliente');
    return;
  }

  const boton = document.getElementById('btn-enviar-pedido');
  enviandoPedido = true;
  boton.disabled = true;
  boton.textContent = 'Enviando...';

  try {
    const pedido = await peticionApi('/pedidos', {
      method: 'POST',
      body: JSON.stringify({
        cliente: { nombreCliente, telefono, direccion },
        productos: pedidoActual.map((linea) => ({
          id: linea.id,
          cantidad: linea.cantidad,
          idsIngredientesExcluidos: linea.idsIngredientesExcluidos
        }))
      })
    });

    let mensaje = `Pedido #${pedido.id_pedido} enviado a cocina. Total a cobrar: ${formatearPrecio(pedido.total)}`;
    const alertas = pedido.alertas_stock || [];
    if (obtenerEmpleado()?.cargo === 'Administrador' && alertas.length > 0) {
      mensaje += `. Stock bajo: ${alertas.map((alerta) => alerta.insumo).join(', ')}`;
    }
    mostrarNotificacion(mensaje, 'exito');

    pedidoActual = [];
    document.getElementById('form-pedido').reset();
    renderizarResumen();
    cargarPedidosAbiertos();
  } catch (error) {
    // peticionApi ya mostró el aviso del error; el pedido y los datos del cliente se conservan
  } finally {
    enviandoPedido = false;
    boton.disabled = false;
    boton.textContent = 'Enviar a cocina';
  }
};

// Grupos en los que se reparten los pedidos abiertos
const GRUPOS_PEDIDOS = {
  cocina: { idLista: 'lista-pedidos-cocina', idContador: 'contador-cocina', vacio: 'No hay pedidos en cocina.' },
  listos: { idLista: 'lista-pedidos-listos', idContador: 'contador-listos', vacio: 'No hay pedidos listos para recoger.' },
  camino: { idLista: 'lista-pedidos-camino', idContador: 'contador-camino', vacio: 'No hay pedidos en camino.' }
};

// Decide a qué grupo pertenece un pedido abierto; el estado del domicilio manda
const clasificarPedido = (pedido) => {
  if (pedido.estado_domicilio === 'En camino') return 'camino';
  if (pedido.estado === 'Listo' && pedido.estado_domicilio === 'Pendiente') return 'listos';
  return 'cocina';
};

const detenerConsultaPedidos = () => {
  clearInterval(temporizadorPedidos);
  temporizadorPedidos = null;
};

// Consulta cada 5 s; no consulta si la pestaña está oculta
const iniciarConsultaPedidos = () => {
  if (temporizadorPedidos) return;
  temporizadorPedidos = setInterval(() => {
    if (!document.hidden) cargarPedidosAbiertos();
  }, INTERVALO_CONSULTA_PEDIDOS);
};

// Pide los domicilios abiertos y los dibuja. Si falla, detiene la consulta
// automática; cualquier carga exitosa (incluido "Actualizar") la reactiva.
const cargarPedidosAbiertos = async () => {
  if (consultandoPedidos) return;
  consultandoPedidos = true;
  const aviso = document.getElementById('aviso-conexion-pedidos');
  try {
    const pedidos = await peticionApi('/pedidos?tipo=domicilio&abiertos=true');
    renderizarPedidosAbiertos(pedidos);
    aviso.hidden = true;
    iniciarConsultaPedidos();
  } catch (error) {
    // peticionApi ya mostró el aviso del error; se conservan las tarjetas anteriores
    aviso.hidden = false;
    detenerConsultaPedidos();
  } finally {
    consultandoPedidos = false;
  }
};

// Cancela un pedido Pendiente; el backend devuelve el stock al inventario
const cancelarPedidoAbierto = async (idPedido, boton) => {
  if (!confirm(`¿Cancelar el pedido #${idPedido}? Esta acción no se puede deshacer.`)) return;

  boton.disabled = true;
  try {
    await peticionApi(`/pedidos/${idPedido}/cancelar`, { method: 'PUT' });
    mostrarNotificacion(`Pedido #${idPedido} cancelado`, 'exito');
  } catch (error) {
    // peticionApi ya mostró el aviso del error
  } finally {
    // Se recarga siempre para mostrar el estado real, haya salido bien o no
    cargarPedidosAbiertos();
  }
};

// Despacha un pedido Listo: sale a domicilio y el domicilio queda "En camino"
const despacharPedidoAbierto = async (idPedido, boton) => {
  boton.disabled = true;
  try {
    await peticionApi(`/pedidos/${idPedido}/despachar`, { method: 'PUT' });
    mostrarNotificacion(`Pedido #${idPedido} despachado`, 'exito');
  } catch (error) {
    // peticionApi ya mostró el aviso del error
  } finally {
    // Se recarga siempre para mostrar el estado real, haya salido bien o no
    cargarPedidosAbiertos();
  }
};

// Registra que el domicilio llegó al cliente; el pedido sale de la lista de abiertos
const registrarEntregaPedido = async (idPedido, boton) => {
  boton.disabled = true;
  try {
    await peticionApi(`/pedidos/${idPedido}/entrega`, { method: 'PUT' });
    mostrarNotificacion(`Pedido #${idPedido} entregado al cliente`, 'exito');
  } catch (error) {
    // peticionApi ya mostró el aviso del error
  } finally {
    // Se recarga siempre para mostrar el estado real, haya salido bien o no
    cargarPedidosAbiertos();
  }
};

// Botones de acción de la tarjeta según el estado (3c y 3d agregan los suyos aquí)
const construirAccionesPedido = (pedido) => {
  const botones = [];
  if (pedido.estado === 'Pendiente' && pedido.estado_domicilio === 'Pendiente') {
    botones.push(`<button type="button" class="btn-cancelar-pedido" data-accion-pedido="cancelar" data-id-pedido="${pedido.id_pedido}">Cancelar pedido</button>`);
  }
  if (pedido.estado === 'Listo' && pedido.estado_domicilio === 'Pendiente') {
    botones.push(`<button type="button" class="btn-accion-pedido" data-accion-pedido="despachar" data-id-pedido="${pedido.id_pedido}">Despachar</button>`);
  }
  if (pedido.estado_domicilio === 'En camino') {
    botones.push(`<button type="button" class="btn-accion-pedido" data-accion-pedido="entrega" data-id-pedido="${pedido.id_pedido}">Registrar entrega</button>`);
  }
  return botones.length === 0 ? '' : `<div class="pedido-abierto__acciones">${botones.join('')}</div>`;
};

// Markup de una tarjeta; los textos del cliente se escapan
const construirTarjetaPedido = (pedido) => {
  const hora = new Date(pedido.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const productos = pedido.productos.map((producto) => `
          <li>${producto.cantidad} × ${escaparHtml(producto.nombre)}${producto.observaciones ? ` <small>(${escaparHtml(producto.observaciones)})</small>` : ''}</li>`).join('');

  return `
      <article class="pedido-abierto" data-id-pedido="${pedido.id_pedido}">
        <header class="pedido-abierto__cabecera">
          <strong>Pedido #${pedido.id_pedido}</strong>
          <span>${hora}</span>
        </header>
        <p class="pedido-abierto__cliente">
          <strong>${escaparHtml(pedido.cliente.nombreCliente)}</strong> · ${escaparHtml(pedido.cliente.telefono)}<br>
          ${escaparHtml(pedido.cliente.direccion)}
        </p>
        <ul class="pedido-abierto__productos">${productos}</ul>
        <footer class="pedido-abierto__pie">
          <span class="etiqueta-estado">Pedido: ${escaparHtml(pedido.estado)}</span>
          <span class="etiqueta-estado">Domicilio: ${escaparHtml(pedido.estado_domicilio)}</span>
          <strong>${formatearPrecio(pedido.total)}</strong>
        </footer>
        ${construirAccionesPedido(pedido)}
      </article>`;
};

// Reparte los pedidos en los tres grupos y actualiza los contadores
const renderizarPedidosAbiertos = (pedidos) => {
  const porGrupo = { cocina: [], listos: [], camino: [] };
  pedidos.forEach((pedido) => porGrupo[clasificarPedido(pedido)].push(pedido));

  Object.entries(GRUPOS_PEDIDOS).forEach(([clave, grupo]) => {
    const lista = porGrupo[clave];
    document.getElementById(grupo.idContador).textContent = lista.length;
    document.getElementById(grupo.idLista).innerHTML = lista.length === 0
      ? `<p>${grupo.vacio}</p>`
      : lista.map(construirTarjetaPedido).join('');
  });
};

document.addEventListener('DOMContentLoaded', () => {
  if (!verificarSesion()) return;

  if (!CARGOS_PERMITIDOS.includes(obtenerEmpleado()?.cargo)) {
    mostrarBloqueoSesion('No tienes permiso para ver esta página.');
    return;
  }

  inicializarCerrarSesion();
  renderizarResumen();
  cargarMenu();
  cargarPedidosAbiertos();

  // Botón "+" de cada producto del menú
  document.getElementById('lista-productos').addEventListener('click', (evento) => {
    const boton = evento.target.closest('button[data-id-producto]');
    if (boton) abrirPersonalizacion(Number(boton.dataset.idProducto));
  });

  // Botones de cantidad y eliminar del resumen
  document.getElementById('resumen-pedido').addEventListener('click', (evento) => {
    const boton = evento.target.closest('button[data-accion]');
    if (!boton) return;

    const indice = Number(boton.dataset.indice);
    if (boton.dataset.accion === 'sumar') cambiarCantidad(indice, 1);
    if (boton.dataset.accion === 'restar') cambiarCantidad(indice, -1);
    if (boton.dataset.accion === 'eliminar') eliminarLinea(indice);
  });

  document.getElementById('form-pedido').addEventListener('submit', enviarPedido);
  document.getElementById('btn-actualizar-pedidos').addEventListener('click', cargarPedidosAbiertos);

  // Botones de acción de las tarjetas de pedidos abiertos (un solo listener delegado)
  document.querySelector('.pedidos-abiertos').addEventListener('click', (evento) => {
    const boton = evento.target.closest('button[data-accion-pedido]');
    if (!boton) return;

    const idPedido = Number(boton.dataset.idPedido);
    if (boton.dataset.accionPedido === 'cancelar') cancelarPedidoAbierto(idPedido, boton);
    if (boton.dataset.accionPedido === 'despachar') despacharPedidoAbierto(idPedido, boton);
    if (boton.dataset.accionPedido === 'entrega') registrarEntregaPedido(idPedido, boton);
  });

  // Al volver a la pestaña, refresca de inmediato si la consulta automática sigue activa
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && temporizadorPedidos) cargarPedidosAbiertos();
  });

  // Modal de personalización: confirmar, cancelar, clic fuera y Escape
  const modal = document.getElementById('modal-personalizar');
  document.getElementById('btn-confirmar-personalizar').addEventListener('click', confirmarPersonalizacion);
  document.getElementById('btn-cancelar-personalizar').addEventListener('click', cerrarPersonalizacion);
  modal.addEventListener('click', (evento) => {
    if (evento.target === modal) cerrarPersonalizacion();
  });
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !modal.hidden) cerrarPersonalizacion();
  });
});