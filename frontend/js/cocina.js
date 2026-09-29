// Carga los pedidos en cola para la vista de cocina
const cargarPedidosCocina = async () => {
  const contenedor = document.getElementById('lista-cocina');
  if (!contenedor) return;

  try {
    const respuesta = await fetch(`${API_URL}/pedidos`);
    const pedidos = await respuesta.json();

    // Los pedidos "Listo" ya salieron de cocina (el mesero los recoge), se ocultan de la cola
    contenedor.innerHTML = pedidos.map((p) => {
      const estado = p.estado || 'Pendiente';
      if (estado === 'Listo') return '';

      const claseEstado = estado === 'En preparación' ? 'estado-preparacion' : 'estado-pendiente';

      const encabezado = p.cliente
        ? `Domicilio - ${p.cliente.nombreCliente}`
        : `Mesa ${p.mesa}`;

      return `
        <div class="pedido-cocina-card">
          <h3>${encabezado}</h3>
          <span class="estado ${claseEstado}">${estado}</span>
          <ul>${p.productos.map(prod => `<li>${prod.categoria ? prod.categoria + ' - ' : ''}${prod.nombre} x${prod.cantidad}${prod.observaciones ? ` (${prod.observaciones})` : ''}</li>`).join('')}</ul>
          ${estado === 'Pendiente' ? `<button class="btn-preparacion" onclick="marcarEnPreparacion(${p.id_pedido})">Confirmar - En preparación</button>` : ''}
          ${estado === 'En preparación' ? `<button class="btn-listo" onclick="marcarListo(${p.id_pedido})">Confirmar - Listo para recoger</button>` : ''}
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error al cargar pedidos de cocina', error);
  }
};

// Marca un pedido como "En preparación"
const marcarEnPreparacion = (idPedido) => {
  actualizarEstadoPedido(idPedido, 'En preparación');
};

// Marca un pedido como "Listo" y alerta al mesero
const marcarListo = (idPedido) => {
  actualizarEstadoPedido(idPedido, 'Listo');
  alert('Alerta enviada al mesero: pedido listo para recoger');
};

// Actualiza el estado de un pedido en el backend
const actualizarEstadoPedido = async (idPedido, nuevoEstado) => {
  try {
    await fetch(`${API_URL}/pedidos/${idPedido}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado })
    });
    cargarPedidosCocina();
  } catch (error) {
    console.error('Error al actualizar estado', error);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  cargarPedidosCocina();
  setInterval(cargarPedidosCocina, 5000);
});