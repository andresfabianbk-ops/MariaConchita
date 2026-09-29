// Almacena movimientos de caja del turno actual
let movimientosCaja = [];
let cajaAbierta = false;

// Abre la caja con el fondo inicial y muestra el contenedor de cobro
const abrirCaja = () => {
  const fondo = document.getElementById('fondo-inicial').value;

  if (!fondo || fondo <= 0) {
    alert('Ingrese un fondo inicial válido');
    return;
  }

  cajaAbierta = true;
  movimientosCaja.push({ tipo: 'Apertura', valor: Number(fondo) });
  renderizarMovimientos();

  // Oculta el formulario de apertura y muestra el de cobro
  document.getElementById('contenedor-apertura').style.display = 'none';
  document.getElementById('contenedor-caja').style.display = 'flex';

  cargarPedidosPendientes();
};

// Carga los pedidos pendientes de cobro, conservando la selección actual del cajero
// Soporta pedidos de mesa (Android) y de domicilio (Cajero); oculta los ya pagados
const cargarPedidosPendientes = async () => {
  const select = document.getElementById('select-pedido');
  if (!select) return;

  const valorSeleccionado = select.value;

  try {
    const respuesta = await fetch(`${API_URL}/pedidos`);
    const pedidos = await respuesta.json();

    select.innerHTML = '<option value="">Seleccione un pedido</option>' +
      pedidos.map((p) => {
        if (p.pagado) return '';
        const etiqueta = p.cliente ? p.cliente.nombreCliente : `Mesa ${p.mesa}`;
        return `<option value="${p.id_pedido}">${etiqueta} - ${formatearPrecio(calcularTotalPedido(p))}</option>`;
      }).join('');

    select.value = valorSeleccionado;
  } catch (error) {
    console.error('Error al cargar pedidos', error);
  }
};

// Muestra el detalle del pedido seleccionado: productos, subtotal, INC y total
const mostrarDetallePedido = async () => {
  const select = document.getElementById('select-pedido');
  const detalle = document.getElementById('detalle-pedido');
  if (!select || !detalle) return;

  const id_pedido = select.value;

  if (id_pedido === '') {
    detalle.style.display = 'none';
    return;
  }

  try {
    const respuesta = await fetch(`${API_URL}/pedidos`);
    const pedidos = await respuesta.json();
    const pedido = pedidos.find(p => p.id_pedido === id_pedido);

    // El total ya incluye el INC del 8%; se calcula el subtotal a partir del total
    const total = calcularTotalPedido(pedido);
    const subtotal = total / 1.08;
    const inc = total - subtotal;

    detalle.innerHTML = `
      <ul class="detalle-productos">
        ${pedido.productos.map(p => `
          <li><span>${p.categoria ? p.categoria + ' - ' : ''}${p.nombre} x${p.cantidad}${p.observaciones ? ` (${p.observaciones})` : ''}</span><span>${formatearPrecio(p.precio * p.cantidad)}</span></li>
        `).join('')}
      </ul>
      <ul class="detalle-totales">
        <li><span>Subtotal</span><span>${formatearPrecio(subtotal)}</span></li>
        <li><span>INC (8% incluido)</span><span>${formatearPrecio(inc)}</span></li>
        <li class="detalle-total-final"><span>Total a pagar</span><span>${formatearPrecio(total)}</span></li>
      </ul>
    `;
    detalle.style.display = 'block';
  } catch (error) {
    console.error('Error al cargar detalle del pedido', error);
  }
};

// Registra el pago de un pedido seleccionado
const registrarPago = async () => {
  if (!cajaAbierta) {
    alert('Debe abrir la caja antes de registrar pagos');
    return;
  }

  const metodo = document.getElementById('metodo-pago').value;
  const select = document.getElementById('select-pedido');
  const idPedido = select.value;

  if (idPedido === '') {
    alert('Seleccione un pedido');
    return;
  }
  if (!metodo) {
    alert('Seleccione un método de pago');
    return;
  }

  // Extrae el total real del texto de la opción seleccionada (quitando puntos de miles)
  const textoOpcion = select.options[select.selectedIndex].text;
  const valorPago = Number(textoOpcion.split('$')[1].replace(/\./g, ''));

  try {
    const respuesta = await fetch(`${API_URL}/pagos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metodo, valor: valorPago, idPedido: idPedido })
    });

    if (!respuesta.ok) throw new Error('Error al registrar el pago');

    movimientosCaja.push({ tipo: 'Ingreso', valor: valorPago, metodo });
    renderizarMovimientos();

    // Limpia el detalle del pedido y resetea la selección
    document.getElementById('detalle-pedido').style.display = 'none';
    document.getElementById('metodo-pago').value = '';

    // Marca el pedido como pagado en el backend (persiste tras recargar)
    await fetch(`${API_URL}/pedidos/${idPedido}/pagar`, { method: 'PUT' });
    cargarPedidosPendientes();

    if (confirm('Pago registrado. ¿Generar factura?')) {
      generarFactura(idPedido, metodo);
    }
  } catch (error) {
    alert(error.message);
  }
};

// Genera y muestra la factura imprimible del pedido cobrado
const generarFactura = async (idPedido, metodoPago) => {
  try {
    const respuesta = await fetch(`${API_URL}/pedidos`);
    const pedidos = await respuesta.json();
    const pedido = pedidos.find

    const total = calcularTotalPedido(pedido);
    const subtotal = total / 1.08;
    const inc = total - subtotal;

    document.getElementById('factura-fecha').textContent = new Date().toLocaleString('es-CO');
    document.getElementById('factura-cliente').textContent = pedido.cliente
      ? `Cliente: ${pedido.cliente.nombreCliente}`
      : `Mesa: ${pedido.mesa}`;

    document.getElementById('factura-items').innerHTML = pedido.productos.map(p => `
      <tr>
        <td>${p.cantidad}</td>
        <td>${p.categoria ? p.categoria + ' - ' : ''}${p.nombre}${p.observaciones ? `<br><small>${p.observaciones}</small>` : ''}</td>
        <td>${formatearPrecio(p.precio)}</td>
        <td>${formatearPrecio(p.precio * p.cantidad)}</td>
      </tr>
    `).join('');

    document.getElementById('factura-base').textContent = formatearPrecio(subtotal);
    document.getElementById('factura-inc').textContent = formatearPrecio(inc);
    document.getElementById('factura-total').textContent = formatearPrecio(total);
    document.getElementById('factura-metodo').textContent = `Método de pago: ${metodoPago}`;

    document.getElementById('modal-factura').style.display = 'flex';
  } catch (error) {
    alert('Error al generar la factura');
  }
};

// Renderiza los movimientos de caja del turno
const renderizarMovimientos = () => {
  const resumen = document.getElementById('resumen-caja');
  if (!resumen) return;

  resumen.innerHTML = movimientosCaja.map(m => `
    <li><span>${m.tipo}${m.metodo ? ' - ' + m.metodo : ''}</span><span>${formatearPrecio(m.valor)}</span></li>
  `).join('');
};

// Cierra la caja, muestra el total y vuelve al formulario de apertura
const cerrarCaja = () => {
  const total = movimientosCaja.reduce((sum, m) => sum + m.valor, 0);
  alert('Caja cerrada. Total: ' + formatearPrecio(total));
  movimientosCaja = [];
  cajaAbierta = false;
  renderizarMovimientos();

  document.getElementById('contenedor-caja').style.display = 'none';
  document.getElementById('contenedor-apertura').style.display = 'flex';
  document.getElementById('fondo-inicial').value = '';
};

document.addEventListener('DOMContentLoaded', () => {
  const btnAbrirCaja = document.getElementById('btn-abrir-caja');
  if (btnAbrirCaja) btnAbrirCaja.addEventListener('click', abrirCaja);

  const btnRegistrarPago = document.getElementById('btn-registrar-pago');
  if (btnRegistrarPago) btnRegistrarPago.addEventListener('click', registrarPago);

  const btnCerrarCaja = document.getElementById('btn-cerrar-caja');
  if (btnCerrarCaja) btnCerrarCaja.addEventListener('click', cerrarCaja);

  const selectPedido = document.getElementById('select-pedido');
  if (selectPedido) selectPedido.addEventListener('change', mostrarDetallePedido);

  const btnCerrarFactura = document.getElementById('btn-cerrar-factura');
  if (btnCerrarFactura) {
    btnCerrarFactura.addEventListener('click', () => {
      document.getElementById('modal-factura').style.display = 'none';
    });
  }

  const btnImprimirFactura = document.getElementById('btn-imprimir-factura');
  if (btnImprimirFactura) {
    btnImprimirFactura.addEventListener('click', () => window.print());
  }

  // Refresca la lista de pedidos pendientes cada 5 segundos, solo si la caja está abierta
  setInterval(() => {
    if (cajaAbierta) cargarPedidosPendientes();
  }, 5000);
});