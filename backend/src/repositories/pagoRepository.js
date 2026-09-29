// Repositorio de pagos: acceso real a MySQL (Factura + Pago)
const db = require('../config/db');

// Busca si ya existe una factura para un pedido
const buscarFacturaPorPedido = async (idPedido, conexion = db) => {
  const [filas] = await conexion.query(
    'SELECT id_factura FROM Factura WHERE id_pedido = ?',
    [idPedido]
  );
  return filas[0] || null;
};

// Crea una factura para un pedido
const crearFactura = async (idPedido, total, conexion) => {
  const [resultado] = await conexion.query(
    'INSERT INTO Factura (id_pedido, total) VALUES (?, ?)',
    [idPedido, total]
  );
  return resultado.insertId;
};

// Inserta el pago asociado a una factura
const insertarPago = async (idFactura, metodo, valor, conexion) => {
  const [resultado] = await conexion.query(
    'INSERT INTO Pago (id_factura, metodo, valor) VALUES (?, ?, ?)',
    [idFactura, metodo, valor]
  );
  return resultado.insertId;
};

// Guarda un pago: resuelve la factura (la crea si no existe) y registra el pago, todo en una transacción
const guardarPago = async ({ metodo, valor, idPedido }) => {
  const conexion = await db.getConnection();
  try {
    await conexion.beginTransaction();

    let factura = await buscarFacturaPorPedido(idPedido, conexion);
    let idFactura;
    if (factura) {
      idFactura = factura.id_factura;
    } else {
      idFactura = await crearFactura(idPedido, valor, conexion);
    }

    const idPago = await insertarPago(idFactura, metodo, valor, conexion);

    await conexion.commit();
    return { id_pago: idPago, id_factura: idFactura, metodo, valor };
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
  return filas;
};

module.exports = { guardarPago, obtenerPagos };