// Caja del restaurante: apertura y cierre diarios (guardados en el backend),
// cobro de pedidos y factura imprimible

const CARGOS_PERMITIDOS_CAJA = ['Cajero', 'Administrador'];
const INTERVALO_PEDIDOS_MS = 5000;
const NOMBRES_METODOS = ['Efectivo', 'Nequi', 'Daviplata', 'Tarjeta'];

let cajaActual = null;        // respuesta de GET /caja/hoy
let pedidosCobrables = [];    // pedidos que se pueden cobrar ahora
let temporizadorPedidos = null;
let cargandoPedidos = false;
let abriendoCaja = false;
let cerrandoCaja = false;
let cobrando = false;

// ---------- Estados de la página ----------

// Muestra solo uno de los tres estados: apertura, caja (abierta) o cerrada
const mostrarEstado = (estado) => {
  const contenedores = {
    apertura: 'contenedor-apertura',
    caja: 'contenedor-caja',
    cerrada: 'contenedor-cerrada'
  };
  Object.entries(contenedores).forEach(([nombre, id]) => {
    document.getElementById(id).style.display = nombre === estado ? 'flex' : 'none';
  });
};

const filaResumen = (texto, valor) =>
  `<li><span>${texto}</span><span>${formatearPrecio(valor)}</span></li>`;

const filasPorMetodo = (resumen) =>
  NOMBRES_METODOS.map((metodo) => filaResumen(metodo, resumen.porMetodo[metodo])).join('');

// Caja abierta: no muestra el efectivo esperado (el cajero cuenta a ciegas)
const renderizarCajaAbierta = () => {
  document.getElementById('info-caja').textContent =
    `Caja abierta con fondo inicial de ${formatearPrecio(cajaActual.fondo_inicial)}`;
  document.getElementById('resumen-caja').innerHTML =
    filaResumen('Fondo inicial', cajaActual.fondo_inicial) +
    filasPorMetodo(cajaActual.resumen) +
    filaResumen('Total vendido', cajaActual.resumen.totalVentas);
};

// Caja cerrada: resumen final de solo lectura
const renderizarCajaCerrada = () => {
  // El efectivo esperado se deduce de lo guardado: contado - diferencia
  const esperado = Math.round((cajaActual.efectivo_contado - cajaActual.diferencia) * 100) / 100;
  document.getElementById('info-cierre').textContent = `Caja del ${cajaActual.fecha} cerrada.`;
  document.getElementById('resumen-cierre').innerHTML =
    filaResumen('Fondo inicial', cajaActual.fondo_inicial) +
    filasPorMetodo(cajaActual.resumen) +
    filaResumen('Total vendido', cajaActual.resumen.totalVentas) +
    filaResumen('Efectivo esperado', esperado) +
    filaResumen('Efectivo contado', cajaActual.efectivo_contado) +
    filaResumen('Diferencia', cajaActual.diferencia);
};

// Decide qué estado mostrar según la caja de hoy
const aplicarCaja = (caja) => {
  cajaActual = caja;
  if (!caja.id_caja) {
    detenerConsultaPedidos();
    mostrarEstado('apertura');
    return;
  }
  if (caja.abierta) {
    renderizarCajaAbierta();
    mostrarEstado('caja');
    iniciarConsultaPedidos();
    cargarPedidosCobrables();
    return;
  }
  detenerConsultaPedidos();
  renderizarCajaCerrada();
  mostrarEstado('cerrada');
};

const cargarEstadoCaja = async () => {
  try {
    aplicarCaja(await peticionApi('/caja/hoy'));
  } catch (error) {
    // peticionApi ya mostró el aviso de error
  }
};

// ---------- Apertura y cierre ----------

const abrirCajaDelDia = async () => {
  if (abriendoCaja) return;
  const texto = document.getElementById('fondo-inicial').value.trim();
  if (texto === '') {
    mostrarNotificacion('Ingrese el fondo inicial', 'error');
    return;
  }
  abriendoCaja = true;
  try {
    const caja = await peticionApi('/caja/apertura', {
      method: 'POST',
      body: JSON.stringify({ fondoInicial: Number(texto) })
    });
    document.getElementById('fondo-inicial').value = '';
    mostrarNotificacion('Caja abierta', 'exito');
    aplicarCaja(caja);
  } catch (error) {
    // Si otra persona ya abrió la caja, se muestra el estado real
    await cargarEstadoCaja();
  } finally {
    abriendoCaja = false;
  }
};

const abrirModalCierre = () => {
  const modal = document.getElementById('modal-cierre');
  document.getElementById('efectivo-contado').value = '';
  modal.hidden = false;
  document.getElementById('efectivo-contado').focus();
};

const cerrarModalCierre = () => {
  document.getElementById('modal-cierre').hidden = true;
};

const confirmarCierre = async () => {
  if (cerrandoCaja) return;
  const texto = document.getElementById('efectivo-contado').value.trim();
  if (texto === '') {
    mostrarNotificacion('Ingrese el efectivo contado', 'error');
    return;
  }
  cerrandoCaja = true;
  try {
    const caja = await peticionApi('/caja/cierre', {
      method: 'POST',
      body: JSON.stringify({ efectivoContado: Number(texto) })
    });
    cerrarModalCierre();
    const aviso = caja.pedidos_sin_cobrar > 0
      ? `Caja cerrada. Quedaron ${caja.pedidos_sin_cobrar} pedidos sin cobrar.`
      : 'Caja cerrada.';
    mostrarNotificacion(aviso, 'exito');
    aplicarCaja(caja);
  } catch (error) {
    cerrarModalCierre();
    await cargarEstadoCaja();
  } finally {
    cerrandoCaja = false;
  }
};

// ---------- Pedidos por cobrar ----------

// Cobrable: sin pagar, no cancelado y, si es domicilio, ya entregado
const esCobrable = (pedido) => {
  const esDomicilio = pedido.cliente !== null;
  return !pedido.pagado &&
    pedido.estado !== 'Cancelado' &&
    (!esDomicilio || pedido.estado_domicilio === 'Entregado');
};

const etiquetaPedido = (pedido) =>
  pedido.cliente !== null
    ? `#${pedido.id_pedido} - Domicilio - ${escaparHtml(pedido.cliente.nombreCliente)}`
    : `#${pedido.id_pedido} - Mesa ${pedido.mesa}`;

const renderizarListaCobrables = () => {
  const select = document.getElementById('select-pedido');
  const seleccionado = select.value;
  select.innerHTML = '<option value="">Seleccione un pedido</option>' +
    pedidosCobrables.map((pedido) =>
      `<option value="${pedido.id_pedido}">${etiquetaPedido(pedido)} - ${formatearPrecio(pedido.total)}</option>`
    ).join('');
  select.value = seleccionado; // si el pedido ya no existe, queda en ''
  mostrarDetallePedido();
};

const cargarPedidosCobrables = async () => {
  if (cargandoPedidos) return;
  cargandoPedidos = true;
  try {
    const pedidos = await peticionApi('/pedidos');
    pedidosCobrables = pedidos.filter(esCobrable);
    renderizarListaCobrables();
  } catch (error) {
    // peticionApi ya avisó; se detiene la consulta para no repetir el aviso cada 5 s
    detenerConsultaPedidos();
  } finally {
    cargandoPedidos = false;
  }
};

const iniciarConsultaPedidos = () => {
  detenerConsultaPedidos();
  temporizadorPedidos = setInterval(() => {
    if (!document.hidden) cargarPedidosCobrables();
  }, INTERVALO_PEDIDOS_MS);
};

const detenerConsultaPedidos = () => {
  if (temporizadorPedidos !== null) {
    clearInterval(temporizadorPedidos);
    temporizadorPedidos = null;
  }
};

const buscarPedidoSeleccionado = () => {
  const idSeleccionado = Number(document.getElementById('select-pedido').value);
  return pedidosCobrables.find((pedido) => pedido.id_pedido === idSeleccionado) || null;
};

// Detalle del pedido seleccionado: productos, subtotal, INC y total
const mostrarDetallePedido = () => {
  const detalle = document.getElementById('detalle-pedido');
  const pedido = buscarPedidoSeleccionado();
  if (!pedido) {
    detalle.style.display = 'none';
    return;
  }

    // INC 8% solo sobre productos (ya incluido en su precio); el envío va aparte sin INC
  const totalProductos = pedido.total - pedido.costo_envio;
  const subtotal = totalProductos / 1.08;
  const inc = totalProductos - subtotal;
  const filaEnvio = pedido.costo_envio > 0
    ? `<li><span>Envío a domicilio</span><span>${formatearPrecio(pedido.costo_envio)}</span></li>`
    : '';

  detalle.innerHTML = `
    <ul class="detalle-productos">
      ${pedido.productos.map((producto) => `
        <li><span>${producto.categoria ? escaparHtml(producto.categoria) + ' - ' : ''}${escaparHtml(producto.nombre)} x${producto.cantidad}${producto.observaciones ? ` (${escaparHtml(producto.observaciones)})` : ''}</span><span>${formatearPrecio(producto.precio * producto.cantidad)}</span></li>
      `).join('')}
    
    <ul class="detalle-totales">
      <li><span>Subtotal</span><span>${formatearPrecio(subtotal)}</span></li>
      <li><span>INC (8% incluido)</span><span>${formatearPrecio(inc)}</span></li>
      ${filaEnvio}
      <li class="detalle-total-final"><span>Total a pagar</span><span>${formatearPrecio(pedido.total)}</span></li>
    </ul>
  `;
  detalle.style.display = 'block';
};

// ---------- Cobro y factura ----------

const registrarPago = async () => {
  if (cobrando) return;
  const pedido = buscarPedidoSeleccionado();
  const metodo = document.getElementById('metodo-pago').value;

  if (!pedido) {
    mostrarNotificacion('Seleccione un pedido', 'error');
    return;
  }
  if (!metodo) {
    mostrarNotificacion('Seleccione un método de pago', 'error');
    return;
  }

  cobrando = true;
  const boton = document.getElementById('btn-registrar-pago');
  boton.disabled = true;
  try {
    // El backend calcula el total y crea la factura
    const pago = await peticionApi('/pagos', {
      method: 'POST',
      body: JSON.stringify({ idPedido: pedido.id_pedido, metodo })
    });
    mostrarNotificacion('Pago registrado', 'exito');
    document.getElementById('metodo-pago').value = '';
    document.getElementById('select-pedido').value = '';
    mostrarFactura(pedido, pago.metodo, pago.valor);
  } catch (error) {
    // peticionApi ya avisó el error
  } finally {
    cobrando = false;
    boton.disabled = false;
    await cargarEstadoCaja(); // actualiza el resumen y la lista de cobrables
  }
};

// Llena y abre la factura imprimible del pedido cobrado
const mostrarFactura = (pedido, metodo, valorCobrado) => {
  // INC 8% solo sobre productos (incluido en su precio); el envío va aparte sin INC
  const totalProductos = valorCobrado - pedido.costo_envio;
  const subtotal = totalProductos / 1.08;
  const inc = totalProductos - subtotal;

  document.getElementById('factura-fecha').textContent = new Date().toLocaleString('es-CO');
  document.getElementById('factura-cliente').textContent = pedido.cliente !== null
    ? `Cliente: ${pedido.cliente.nombreCliente}`
    : `Mesa: ${pedido.mesa}`;
  document.getElementById('factura-metodo').textContent = `Método de pago: ${metodo}`;

  const filasProductos = pedido.productos.map((producto) => `
    <tr>
      <td>${producto.cantidad}</td>
      <td>${producto.categoria ? escaparHtml(producto.categoria) + ' - ' : ''}${escaparHtml(producto.nombre)}${producto.observaciones ? `<br><small>${escaparHtml(producto.observaciones)}</small>` : ''}</td>
      <td>${formatearPrecio(producto.precio)}</td>
      <td>${formatearPrecio(producto.precio * producto.cantidad)}</td>
    </tr>
  `).join('');
  
  document.getElementById('factura-items').innerHTML = filasProductos;

  document.getElementById('factura-base').textContent = formatearPrecio(subtotal);
  document.getElementById('factura-inc').textContent = formatearPrecio(inc);
  document.getElementById('factura-fila-envio').style.display = pedido.costo_envio > 0 ? '' : 'none';
  document.getElementById('factura-envio').textContent = formatearPrecio(pedido.costo_envio);
  document.getElementById('factura-total').textContent = formatearPrecio(valorCobrado);

  document.getElementById('modal-factura').hidden = false;
};

const cerrarFactura = () => {
  document.getElementById('modal-factura').hidden = true;
};

// ---------- Arranque ----------

document.addEventListener('DOMContentLoaded', () => {
  if (!verificarSesion()) return;

  const empleado = obtenerEmpleado();
  if (!empleado || !CARGOS_PERMITIDOS_CAJA.includes(empleado.cargo)) {
    mostrarBloqueoSesion('Esta página es solo para Cajero o Administrador.');
    return;
  }

  renderizarMenuLateral();
  inicializarSidebar();
  inicializarCerrarSesion();

  document.getElementById('btn-abrir-caja').addEventListener('click', abrirCajaDelDia);
  document.getElementById('btn-registrar-pago').addEventListener('click', registrarPago);
  document.getElementById('btn-cerrar-caja').addEventListener('click', abrirModalCierre);
  document.getElementById('btn-confirmar-cierre').addEventListener('click', confirmarCierre);
  document.getElementById('btn-cancelar-cierre').addEventListener('click', cerrarModalCierre);
  document.getElementById('select-pedido').addEventListener('change', mostrarDetallePedido);
  document.getElementById('btn-imprimir-factura').addEventListener('click', () => window.print());
  document.getElementById('btn-cerrar-factura').addEventListener('click', cerrarFactura);

  // Clic en el fondo oscuro cierra el modal
  document.getElementById('modal-cierre').addEventListener('click', (evento) => {
    if (evento.target === evento.currentTarget) cerrarModalCierre();
  });
  document.getElementById('modal-factura').addEventListener('click', (evento) => {
    if (evento.target === evento.currentTarget) cerrarFactura();
  });

  // Escape cierra el modal que esté abierto
  document.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape') return;
    cerrarModalCierre();
    cerrarFactura();
  });

  // Al volver a la pestaña se reanuda la consulta de pedidos si la caja está abierta
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && cajaActual && cajaActual.abierta) {
      iniciarConsultaPedidos();
      cargarPedidosCobrables();
    }
  });

  cargarEstadoCaja();
});