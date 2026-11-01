// Pantalla de cocina (Cocinero y Administrador): cola de pedidos pendientes y en preparación

// Cargos que pueden usar esta pantalla
const CARGOS_PERMITIDOS = ['Cocinero', 'Administrador'];
// Cocina atiende estos estados; "Listo" ya salió de cocina
const ESTADOS_COCINA = 'Pendiente,En preparación';
const INTERVALO_CONSULTA_COCINA = 5000;

let temporizadorCocina = null;
let consultandoCocina = false;
let ultimaFirmaCocina = '';

// Arma la tarjeta de un pedido con todos los textos escapados
const construirTarjetaCocina = (pedido) => {
  const estado = pedido.estado || 'Pendiente';
  const claseEstado = estado === 'En preparación' ? 'estado-preparacion' : 'estado-pendiente';

  const encabezado = pedido.cliente
    ? `Domicilio - ${escaparHtml(pedido.cliente.nombreCliente)}`
    : `Mesa ${escaparHtml(String(pedido.mesa))}`;

  const productos = pedido.productos.map((producto) => {
    const categoria = producto.categoria ? `${escaparHtml(producto.categoria)} - ` : '';
    const sin = producto.observaciones
      ? ` <span class="producto-sin">${escaparHtml(producto.observaciones)}</span>`
      : '';
    return `<li>${categoria}${escaparHtml(producto.nombre)} x${Number(producto.cantidad)}${sin}</li>`;
  }).join('');

  let boton = '';
  if (estado === 'Pendiente') {
    boton = `<button type="button" class="btn-preparacion" data-accion-pedido="preparacion" data-id-pedido="${pedido.id_pedido}">Confirmar - En preparación</button>`;
  } else if (estado === 'En preparación') {
    boton = `<button type="button" class="btn-listo" data-accion-pedido="listo" data-id-pedido="${pedido.id_pedido}">Confirmar - Listo para recoger</button>`;
  }

  return `
    <div class="pedido-cocina-card">
      <h3>#${pedido.id_pedido} - ${encabezado}</h3>
      <span class="estado ${claseEstado}">${escaparHtml(estado)}</span>
      <ul>${productos}</ul>
      ${boton}
    </div>
  `;
};

// Dibuja la cola en orden de llegada; solo repinta si cambió algún pedido o estado
const renderizarPedidosCocina = (pedidos) => {
  const contenedor = document.getElementById('lista-cocina');
  if (!contenedor || !Array.isArray(pedidos)) return;

  const ordenados = [...pedidos].sort((a, b) => a.id_pedido - b.id_pedido);
  const firma = ordenados.map((p) => `${p.id_pedido}:${p.estado}`).join('|');
  if (firma === ultimaFirmaCocina) return;
  ultimaFirmaCocina = firma;

  contenedor.innerHTML = ordenados.length > 0
    ? ordenados.map(construirTarjetaCocina).join('')
    : '<p class="cocina-vacia">No hay pedidos en cola.</p>';
};

// Muestra u oculta el aviso de conexión perdida (style.display: el CSS puede anular hidden)
const mostrarAvisoConexionCocina = (visible) => {
  const aviso = document.getElementById('aviso-conexion-cocina');
  if (aviso) aviso.style.display = visible ? 'flex' : 'none';
};

// Consulta periódica: no corre con la pestaña oculta y no solapa peticiones
const iniciarConsultaCocina = () => {
  if (temporizadorCocina) return;
  temporizadorCocina = setInterval(() => {
    if (!document.hidden) cargarPedidosCocina();
  }, INTERVALO_CONSULTA_COCINA);
};

// También sirve para congelar la pantalla en pruebas (se llama desde la consola)
const detenerConsultaCocina = () => {
  clearInterval(temporizadorCocina);
  temporizadorCocina = null;
};

// Pide la cola al backend; si falla detiene la consulta y avisa hasta que una carga exitosa la reactive
const cargarPedidosCocina = async () => {
  if (consultandoCocina) return;
  consultandoCocina = true;

  try {
    const pedidos = await peticionApi(`/pedidos?estado=${encodeURIComponent(ESTADOS_COCINA)}`);
    renderizarPedidosCocina(pedidos);
    mostrarAvisoConexionCocina(false);
    iniciarConsultaCocina();
  } catch (error) {
    detenerConsultaCocina();
    mostrarAvisoConexionCocina(true);
  } finally {
    consultandoCocina = false;
  }
};

// Estado destino y texto del aviso de cada botón de la tarjeta
const ACCIONES_COCINA = {
  preparacion: { estado: 'En preparación', mensaje: 'en preparación' },
  listo: { estado: 'Listo', mensaje: 'listo para recoger' }
};

// Cambia el estado de un pedido; el backend valida el orden y responde 403 si ya avanzó
const cambiarEstadoPedidoCocina = async (idPedido, accion, boton) => {
  const datosAccion = ACCIONES_COCINA[accion];
  if (!datosAccion) return;

  boton.disabled = true;
  try {
    await peticionApi(`/pedidos/${idPedido}`, {
      method: 'PUT',
      body: JSON.stringify({ estado: datosAccion.estado })
    });
    mostrarNotificacion(`Pedido #${idPedido} ${datosAccion.mensaje}`, 'exito');
  } catch (error) {
    // peticionApi ya mostró el aviso de error; se reactiva el botón por si la tarjeta no cambia
    boton.disabled = false;
  } finally {
    await cargarPedidosCocina();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (!verificarSesion()) return;

  if (!CARGOS_PERMITIDOS.includes(obtenerEmpleado()?.cargo)) {
    mostrarBloqueoSesion('No tienes permiso para ver esta página.');
    return;
  }

  inicializarCerrarSesion();
  document.getElementById('btn-reintentar-cocina').addEventListener('click', cargarPedidosCocina);

  // Botones de las tarjetas (un solo listener delegado)
  document.getElementById('lista-cocina').addEventListener('click', (evento) => {
    const boton = evento.target.closest('button[data-accion-pedido]');
    if (!boton || boton.disabled) return;
    cambiarEstadoPedidoCocina(Number(boton.dataset.idPedido), boton.dataset.accionPedido, boton);
  });

  // Al volver a la pestaña, refresca de inmediato si la consulta sigue activa
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && temporizadorCocina) cargarPedidosCocina();
  });

  cargarPedidosCocina();
});