// Importa las funciones del repositorio
const {
  guardarPedido,
  obtenerPedidos,
  avanzarEstadoPedido,
  cancelarPedidoYDevolverStock,
  despacharPedidoDomicilio,
  registrarEntregaDomicilio,
  confirmarCancelacionCocina
} = require('../repositories/pedidoRepository');

// Crea un error de negocio con su código; el controller lo traduce a HTTP con mapearStatus
const crearError = (codigo, mensaje) => {
  const error = new Error(mensaje);
  error.codigo = codigo;
  return error;
};

// Estado de origen requerido para cada estado que se asigna con PUT /pedidos/:id.
// 'Cancelado' y el despacho/entrega de domicilios tienen su propia operación
const ESTADO_ORIGEN_REQUERIDO = {
  'En preparación': 'Pendiente',
  'Listo': 'En preparación',
  'Entregado': 'Listo'
};
const ESTADOS_ASIGNABLES = Object.keys(ESTADO_ORIGEN_REQUERIDO);

const textoValido = (valor) => typeof valor === 'string' && valor.trim().length > 0;

const enteroPositivo = (valor) => Number.isInteger(Number(valor)) && Number(valor) > 0;

const validarIdPedido = (idPedido) => {
  if (!Number.isInteger(idPedido) || idPedido <= 0) {
    throw crearError('DATOS_INVALIDOS', 'Id de pedido no válido');
  }
};

// Lógica de negocio: crea un pedido (mesa o domicilio) con validación
const crearPedido = async (datosPedido) => {
  if (!datosPedido || !Array.isArray(datosPedido.productos) || datosPedido.productos.length === 0) {
    throw crearError('DATOS_INVALIDOS', 'El pedido debe tener al menos un producto');
  }

  const productosValidos = datosPedido.productos.every(
    (producto) => enteroPositivo(producto.id) && enteroPositivo(producto.cantidad)
  );
  if (!productosValidos) {
    throw crearError('DATOS_INVALIDOS', 'Cada producto debe tener id y cantidad mayores a cero');
  }

  const { mesa, cliente } = datosPedido;
  if (!mesa && !cliente) {
    throw crearError('DATOS_INVALIDOS', 'El pedido debe tener mesa o datos de cliente');
  }

  // Pedido a domicilio: los tres datos del cliente son obligatorios
  if (!mesa && !(textoValido(cliente.nombreCliente) && textoValido(cliente.telefono) && textoValido(cliente.direccion))) {
    throw crearError('DATOS_INVALIDOS', 'Complete nombre, teléfono y dirección del cliente');
  }

  return guardarPedido(datosPedido);
};

const ESTADOS_PEDIDO = ['Pendiente', 'En preparación', 'Listo', 'Entregado', 'Cancelado'];

// Lógica de negocio: lista los pedidos con filtros opcionales del query string:
// tipo=domicilio|mesa, estado=Listo,Pendiente (varios separados por coma) y abiertos=1
// (domicilios que no han llegado al cliente ni están cancelados)
const listarPedidos = async (consulta = {}) => {
  const { tipo, estado, abiertos, cancelacionPendiente } = consulta;
  const filtros = {};

  if (tipo !== undefined) {
    if (!['domicilio', 'mesa'].includes(tipo)) {
      throw crearError('DATOS_INVALIDOS', 'Tipo de pedido no válido');
    }
    filtros.tipo = tipo;
  }

  if (estado !== undefined) {
    const estados = String(estado).split(',').map((e) => e.trim());
    if (!estados.every((e) => ESTADOS_PEDIDO.includes(e))) {
      throw crearError('DATOS_INVALIDOS', 'Estado no válido');
    }
    filtros.estados = estados;
  }

  if (['1', 'true'].includes(String(abiertos))) {
    if (tipo === 'mesa') {
      throw crearError('DATOS_INVALIDOS', 'El filtro abiertos solo aplica a domicilios');
    }
    filtros.abiertos = true;
  }

  if (['1', 'true'].includes(String(cancelacionPendiente))) {
    filtros.cancelacionPendiente = true;
  }

  return obtenerPedidos(filtros);
};

// Lógica de negocio: avanza el estado de un pedido (Pendiente → En preparación → Listo → Entregado)
const cambiarEstadoPedido = async (idPedido, nuevoEstado) => {
  validarIdPedido(idPedido);
  if (nuevoEstado === 'Cancelado') {
    throw crearError('OPERACION_NO_PERMITIDA', 'Para cancelar un pedido use la opción de cancelar');
  }
  if (!ESTADOS_ASIGNABLES.includes(nuevoEstado)) {
    throw crearError('DATOS_INVALIDOS', 'Estado no válido');
  }
  return avanzarEstadoPedido(idPedido, nuevoEstado, ESTADO_ORIGEN_REQUERIDO[nuevoEstado]);
};

// Lógica de negocio: cancela un pedido Pendiente y devuelve el stock al inventario
const cancelarPedido = async (idPedido) => {
  validarIdPedido(idPedido);
  return cancelarPedidoYDevolverStock(idPedido);
};

// Lógica de negocio: la cocina confirma que vio el aviso de cancelación
const confirmarCancelacion = async (idPedido) => {
  validarIdPedido(idPedido);
  return confirmarCancelacionCocina(idPedido);
};

// Lógica de negocio: entrega un pedido a domicilio al domiciliario (Listo → Entregado, domicilio En camino)
const despacharPedido = async (idPedido) => {
  validarIdPedido(idPedido);
  return despacharPedidoDomicilio(idPedido);
};

// Lógica de negocio: registra que el domicilio llegó al cliente (En camino → Entregado)
const entregarPedidoAlCliente = async (idPedido) => {
  validarIdPedido(idPedido);
  return registrarEntregaDomicilio(idPedido);
};

module.exports = {
  crearPedido,
  listarPedidos,
  cambiarEstadoPedido,
  cancelarPedido,
  confirmarCancelacion,
  despacharPedido,
  entregarPedidoAlCliente  
};