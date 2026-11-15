// Repositorio de pagos: acceso real a MySQL (Factura + Pago)
const db = require('../config/db');
const { obtenerIdCajaAbiertaHoy } = require('./cajaRepository');

// Crea un error de negocio con .codigo (traducido a HTTP en el controller)
const crearError = (codigo, mensaje) => {
  const error = new Error(mensaje);
  error.codigo = codigo;
  return error;
};

// Busca si ya existe una factura para un pedido
const buscarFacturaPorPedido = async (idPedido, conexion) => {
  const [filas] = await conexion.query(
    'SELECT id_factura FROM Factura WHERE id_pedido = ?',
    [idPedido]
  );
  return filas[0] || null;
};

// Bloquea el pedido (FOR UPDATE) y trae lo necesario para validar el cobro
const bloquearPedido = async (conexion, idPedido) => {
  const [filas] = await conexion.query(
    `SELECT p.id_pedido, p.id_mesa, p.estado, p.pagado, dom.estado AS estado_domicilio
     FROM Pedido p
     LEFT JOIN Domicilio dom ON dom.id_pedido = p.id_pedido
     WHERE p.id_pedido = ?
     FOR UPDATE`,
    [idPedido]
  );
  return filas[0] || null;
};

// Calcula el total a cobrar: productos (precio congelado) + costo de envío si es domicilio
const calcularTotalPedido = async (conexion, idPedido) => {
  const [filas] = await conexion.query(
    `SELECT
       (SELECT COALESCE(SUM(precio_unitario * cantidad), 0) FROM DetallePedido WHERE id_pedido = ?) AS subtotal,
       (SELECT COALESCE(SUM(costo_envio), 0) FROM Domicilio WHERE id_pedido = ?) AS envio`,
    [idPedido, idPedido]
  );
  const subtotal = Number(filas[0].subtotal);
  const envio = Number(filas[0].envio);
  return Math.round((subtotal + envio) * 100) / 100;
};

// Crea una factura para un pedido
const crearFactura = async (idPedido, total, conexion) => {
  const [resultado] = await conexion.query(
    'INSERT INTO Factura (id_pedido, total) VALUES (?, ?)',
    [idPedido, total]
  );
  return resultado.insertId;
};

// Inserta el pago asociado a una factura y a la caja del día
const insertarPago = async (idFactura, metodo, valor, idCaja, conexion) => {
  const [resultado] = await conexion.query(
    'INSERT INTO Pago (id_factura, metodo, valor, id_caja) VALUES (?, ?, ?, ?)',
    [idFactura, metodo, valor, idCaja]
  );
  return resultado.insertId;
};

// Libera la mesa si ya no le quedan pedidos sin pagar (ni cancelados)
const liberarMesaSiCorresponde = async (conexion, idMesa) => {
  const [pendientes] = await conexion.query(
    `SELECT COUNT(*) AS cantidad
     FROM Pedido
     WHERE id_mesa = ? AND pagado = 0 AND estado <> 'Cancelado'`,
    [idMesa]
  );
  if (Number(pendientes[0].cantidad) === 0) {
    await conexion.query("UPDATE Mesa SET estado = 'Libre' WHERE id_mesa = ?", [idMesa]);
  }
};

// Guarda un pago en una sola transacción: valida el pedido, calcula el total,
// crea la factura si no existe, registra el pago, marca el pedido pagado y libera la mesa
const guardarPago = async ({ idPedido, metodo }) => {
  const conexion = await db.getConnection();
  try {
    await conexion.beginTransaction();

    const pedido = await bloquearPedido(conexion, idPedido);
    if (!pedido) {
      throw crearError('NO_ENCONTRADA', 'Pedido no encontrado');
    }
    if (pedido.estado === 'Cancelado') {
      throw crearError('OPERACION_NO_PERMITIDA', 'No se puede cobrar un pedido cancelado');
    }
    if (pedido.pagado) {
      throw crearError('DUPLICADO', 'El pedido ya fue pagado');
    }
    if (pedido.estado_domicilio !== null && pedido.estado_domicilio !== 'Entregado') {
      throw crearError('OPERACION_NO_PERMITIDA', 'El domicilio debe estar entregado para cobrarlo');
    }

    const idCaja = await obtenerIdCajaAbiertaHoy(conexion);
    if (idCaja === null) {
      throw crearError('OPERACION_NO_PERMITIDA', 'La caja de hoy no está abierta');
    }

    const total = await calcularTotalPedido(conexion, idPedido);

    const factura = await buscarFacturaPorPedido(idPedido, conexion);
    const idFactura = factura ? factura.id_factura : await crearFactura(idPedido, total, conexion);

    const idPago = await insertarPago(idFactura, metodo, total, idCaja, conexion);
    await conexion.query('UPDATE Pedido SET pagado = 1 WHERE id_pedido = ?', [idPedido]);

    if (pedido.id_mesa !== null) {
      await liberarMesaSiCorresponde(conexion, pedido.id_mesa);
    }

    await conexion.commit();
    return { id_pago: idPago, id_factura: idFactura, id_pedido: idPedido, metodo, valor: total };
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
};

// Retorna todos los pagos
const obtenerPagos = async () => {
  const [filas] = await db.query('SELECT * FROM Pago');
  return filas.map((fila) => ({ ...fila, valor: Number(fila.valor) }));
};

module.exports = { guardarPago, obtenerPagos };