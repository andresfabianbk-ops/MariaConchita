// Pantalla de cocina (Cocinero y Administrador): cola de pedidos pendientes y en preparación

// Cargos que pueden usar esta pantalla
const CARGOS_PERMITIDOS = ['Cocinero', 'Administrador'];
// Cocina atiende estos estados; "Listo" ya salió de cocina
const ESTADOS_COCINA = 'Pendiente,En preparación';
const INTERVALO_CONSULTA_COCINA = 5000;

let temporizadorCocina = null;
let consultandoCocina = false;
let ultimaFirmaCocina = '';
let ultimaFirmaCancelaciones = '';

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

// Muestra el modal bloqueante con los pedidos cancelados que cocina aún debe confirmar
const renderizarCancelaciones = (pedidos) => {
  const modal = document.getElementById('modal-cancelaciones');
  const lista = document.getElementById('lista-cancelaciones');
  if (!modal || !lista || !Array.isArray(pedidos)) return;

  const ordenados = [...pedidos].sort((a, b) => a.id_pedido - b.id_pedido);
  const firma = ordenados.map((p) => p.id_pedido).join('|');

  if (firma !== ultimaFirmaCancelaciones) {
    ultimaFirmaCancelaciones = firma;
    lista.innerHTML = ordenados.map((pedido) => {
      const destino = pedido.cliente
        ? `Domicilio - ${escaparHtml(pedido.cliente.nombreCliente)}`
        : `Mesa ${escaparHtml(String(pedido.mesa))}`;
      return `
        <li class="cancelacion-item">
          <span class="cancelacion-item__texto">Pedido #${pedido.id_pedido} - ${destino}</span>
          <button type="button" class="btn-confirmar-cancelacion" data-accion-cancelacion="confirmar" data-id-pedido="${pedido.id_pedido}">Confirmar</button>
        </li>
      `;
    }).join('');
  }

  const hayAvisos = ordenados.length > 0;
  modal.style.display = hayAvisos ? 'flex' : 'none';
  document.body.classList.toggle('modal-cancelaciones-abierto', hayAvisos);
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
    const [pedidos, cancelaciones] = await Promise.all([
      peticionApi(`/pedidos?estado=${encodeURIComponent(ESTADOS_COCINA)}`),
      peticionApi('/pedidos?cancelacionPendiente=1')
    ]);
    renderizarPedidosCocina(pedidos);
    renderizarCancelaciones(cancelaciones);
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

// El cocinero confirma que vio la cancelación; el backend responde 403 si ya estaba confirmada
const confirmarCancelacionCocina = async (idPedido, boton) => {
  boton.disabled = true;
  try {
    await peticionApi(`/pedidos/${idPedido}/confirmar-cancelacion`, { method: 'PUT' });
    mostrarNotificacion(`Cancelación del pedido #${idPedido} confirmada`, 'exito');
  } catch (error) {
    // peticionApi ya mostró el aviso de error
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

  renderizarMenuLateral();
  inicializarMenuCocina();
  inicializarCerrarSesion();
  document.getElementById('btn-reintentar-cocina').addEventListener('click', cargarPedidosCocina);

  // Botones de las tarjetas (un solo listener delegado)
  document.getElementById('lista-cocina').addEventListener('click', (evento) => {
    const boton = evento.target.closest('button[data-accion-pedido]');
    if (!boton || boton.disabled) return;
    cambiarEstadoPedidoCocina(Number(boton.dataset.idPedido), boton.dataset.accionPedido, boton);
  });

    // Botones Confirmar del aviso de cancelación (listener delegado)
  document.getElementById('lista-cancelaciones').addEventListener('click', (evento) => {
    const boton = evento.target.closest('button[data-accion-cancelacion]');
    if (!boton || boton.disabled) return;
    confirmarCancelacionCocina(Number(boton.dataset.idPedido), boton);
  });

  // El aviso es obligatorio: Escape no puede cerrarlo
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && document.body.classList.contains('modal-cancelaciones-abierto')) {
      evento.preventDefault();
    }
  });

  // Al volver a la pestaña, refresca de inmediato si la consulta sigue activa
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && temporizadorCocina) cargarPedidosCocina();
  });

  cargarPedidosCocina();
});

// Menú lateral de Cocina: siempre oculto; solo se abre con la hamburguesa
function inicializarMenuCocina() {
  const contenedor = document.querySelector('.app-shell');
  const boton = document.querySelector('[data-accion="toggle-sidebar"]');
  if (!contenedor || !boton) return;

  const alternar = (abrir) => {
    contenedor.classList.toggle('sidebar-abierta', abrir);
    boton.setAttribute('aria-expanded', String(abrir));
  };

  boton.addEventListener('click', () => alternar(!contenedor.classList.contains('sidebar-abierta')));
  document.querySelector('.overlay-sidebar').addEventListener('click', () => alternar(false));
  document.querySelector('.sidebar__cerrar')?.addEventListener('click', () => alternar(false));
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && contenedor.classList.contains('sidebar-abierta')) alternar(false);
  });
}