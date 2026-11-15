// Repositorio de caja: apertura y cierre diarios (una sola caja por día)
const db = require('../config/db');

// Crea un error de negocio con .codigo (traducido a HTTP en el controller)
const crearError = (codigo, mensaje) => {
  const error = new Error(mensaje);
  error.codigo = codigo;
  return error;
};

const METODOS_PAGO = ['Efectivo', 'Nequi', 'Daviplata', 'Tarjeta'];

const COLUMNAS_CAJA = `id_caja, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, fondo_inicial,
  id_usuario_apertura, hora_apertura, hora_cierre, id_usuario_cierre,
  efectivo_contado, diferencia`;

const redondear = (valor) => Math.round(Number(valor) * 100) / 100;

// mysql2 devuelve DECIMAL como string: se castea con Number()
const formatearCaja = (fila) => ({
  ...fila,
  fondo_inicial: Number(fila.fondo_inicial),
  efectivo_contado: fila.efectivo_contado === null ? null : Number(fila.efectivo_contado),
  diferencia: fila.diferencia === null ? null : Number(fila.diferencia),
  abierta: fila.hora_cierre === null
});

// Suma lo cobrado en una caja, por método de pago
const obtenerResumenCaja = async (conexion, idCaja) => {
  const [filas] = await conexion.query(
    'SELECT metodo, SUM(valor) AS total FROM Pago WHERE id_caja = ? GROUP BY metodo',
    [idCaja]
  );
  const porMetodo = {};
  METODOS_PAGO.forEach((metodo) => { porMetodo[metodo] = 0; });
  filas.forEach((fila) => { porMetodo[fila.metodo] = redondear(fila.total); });
  const totalVentas = redondear(Object.values(porMetodo).reduce((suma, valor) => suma + valor, 0));
  return { porMetodo, totalVentas };
};

// Caja de hoy con su resumen de cobros; null si aún no se abre
const obtenerCajaDeHoy = async () => {
  const [filas] = await db.query(
    `SELECT ${COLUMNAS_CAJA} FROM Caja WHERE fecha = CURDATE() LIMIT 1`
  );
  if (filas.length === 0) return null;
  const caja = formatearCaja(filas[0]);
  caja.resumen = await obtenerResumenCaja(db, caja.id_caja);
  return caja;
};

// Abre la caja de hoy. fecha UNIQUE impide una segunda apertura el mismo día
const abrirCaja = async ({ fondoInicial, idUsuario }) => {
  try {
    await db.query(
      'INSERT INTO Caja (fecha, fondo_inicial, id_usuario_apertura) VALUES (CURDATE(), ?, ?)',
      [fondoInicial, idUsuario]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw crearError('DUPLICADO', 'La caja de hoy ya fue abierta');
    }
    throw error;
  }
  return obtenerCajaDeHoy();
};

// Cierra la caja de hoy en una transacción (un solo cierre por día)
const cerrarCaja = async ({ efectivoContado, idUsuario }) => {
  const conexion = await db.getConnection();
  try {
    await conexion.beginTransaction();

    const [filas] = await conexion.query(
      `SELECT ${COLUMNAS_CAJA} FROM Caja WHERE fecha = CURDATE() FOR UPDATE`
    );
    if (filas.length === 0) {
      throw crearError('NO_ENCONTRADA', 'No hay caja abierta hoy');
    }
    const caja = formatearCaja(filas[0]);
    if (!caja.abierta) {
      throw crearError('DUPLICADO', 'La caja de hoy ya fue cerrada');
    }

    const resumen = await obtenerResumenCaja(conexion, caja.id_caja);
    const efectivoEsperado = redondear(caja.fondo_inicial + resumen.porMetodo.Efectivo);
    const diferencia = redondear(efectivoContado - efectivoEsperado);

    await conexion.query(
      `UPDATE Caja
       SET hora_cierre = NOW(), id_usuario_cierre = ?, efectivo_contado = ?, diferencia = ?
       WHERE id_caja = ?`,
      [idUsuario, efectivoContado, diferencia, caja.id_caja]
    );

    // Advertencia (no bloquea el cierre): pedidos que quedaron sin cobrar
    const [sinCobrar] = await conexion.query(
      "SELECT COUNT(*) AS cantidad FROM Pedido WHERE pagado = 0 AND estado <> 'Cancelado'"
    );

    const [cerradas] = await conexion.query(
      `SELECT ${COLUMNAS_CAJA} FROM Caja WHERE id_caja = ?`,
      [caja.id_caja]
    );

    await conexion.commit();

    return {
      ...formatearCaja(cerradas[0]),
      resumen,
      efectivo_esperado: efectivoEsperado,
      pedidos_sin_cobrar: Number(sinCobrar[0].cantidad)
    };
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
};

// id de la caja abierta hoy (o null). Lo usará pagoRepository para exigir caja abierta
const obtenerIdCajaAbiertaHoy = async (conexion = db) => {
  const [filas] = await conexion.query(
    'SELECT id_caja FROM Caja WHERE fecha = CURDATE() AND hora_cierre IS NULL LIMIT 1 LOCK IN SHARE MODE'
  );
  return filas.length === 0 ? null : filas[0].id_caja;
};

module.exports = {
  obtenerResumenCaja,
  obtenerCajaDeHoy,
  abrirCaja,
  cerrarCaja,
  obtenerIdCajaAbiertaHoy
};