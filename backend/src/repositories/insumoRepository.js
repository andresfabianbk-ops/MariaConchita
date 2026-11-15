// Repositorio de insumos: consulta de stock y movimientos manuales (MySQL)
const db = require('../config/db');

// Crea un error de negocio con .codigo (traducido a HTTP en el controller)
const crearError = (codigo, mensaje) => {
  const error = new Error(mensaje);
  error.codigo = codigo;
  return error;
};

const STOCK_MAXIMO = 9999999.999; // límite de DECIMAL(10,3)

const COLUMNAS_INSUMO =
  'id_insumo, nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario, fecha_actualizacion';

// Nivel de stock: Agotado (<= 0), Bajo (<= mínimo) o Normal
const calcularNivel = (stockActual, stockMinimo) => {
  if (stockActual <= 0) return 'Agotado';
  if (stockActual <= stockMinimo) return 'Bajo';
  return 'Normal';
};

// mysql2 devuelve DECIMAL como string: se castea con Number()
const formatearInsumo = (fila) => {
  const stockActual = Number(fila.stock_actual);
  const stockMinimo = Number(fila.stock_minimo);
  return {
    id_insumo: fila.id_insumo,
    nombre: fila.nombre,
    unidad_medida: fila.unidad_medida,
    stock_actual: stockActual,
    stock_minimo: stockMinimo,
    costo_unitario: fila.costo_unitario === null ? null : Number(fila.costo_unitario),
    fecha_actualizacion: fila.fecha_actualizacion,
    nivel: calcularNivel(stockActual, stockMinimo)
  };
};

// Lista todos los insumos con su nivel de stock
const obtenerInsumos = async () => {
  const [filas] = await db.query(
    `SELECT ${COLUMNAS_INSUMO} FROM Insumo ORDER BY nombre`
  );
  return filas.map(formatearInsumo);
};

// Registra una entrada o una merma en una transacción:
// actualiza el stock del insumo y deja el movimiento en MovimientoInventario
const registrarMovimiento = async ({ idInsumo, tipo, cantidad, motivo }) => {
  const conexion = await db.getConnection();
  try {
    await conexion.beginTransaction();

    const [filas] = await conexion.query(
      `SELECT ${COLUMNAS_INSUMO} FROM Insumo WHERE id_insumo = ? FOR UPDATE`,
      [idInsumo]
    );
    if (filas.length === 0) {
      throw crearError('NO_ENCONTRADA', 'Insumo no encontrado');
    }

    const esMerma = tipo === 'Salida por merma';
    const stockActual = Number(filas[0].stock_actual);
    // Se calcula en milésimas para evitar errores de decimales
    const nuevoStockMilesimas =
      Math.round(stockActual * 1000) + (esMerma ? -1 : 1) * Math.round(cantidad * 1000);

    if (esMerma && nuevoStockMilesimas < 0) {
      throw crearError('OPERACION_NO_PERMITIDA', 'La merma supera el stock actual');
    }
    if (nuevoStockMilesimas > Math.round(STOCK_MAXIMO * 1000)) {
      throw crearError('DATOS_INVALIDOS', 'El stock resultante supera el máximo permitido');
    }

    await conexion.query(
      'UPDATE Insumo SET stock_actual = ?, fecha_actualizacion = NOW() WHERE id_insumo = ?',
      [nuevoStockMilesimas / 1000, idInsumo]
    );

    const [resultado] = await conexion.query(
      'INSERT INTO MovimientoInventario (id_insumo, tipo, cantidad, motivo) VALUES (?, ?, ?, ?)',
      [idInsumo, tipo, cantidad, motivo]
    );

    const [actualizado] = await conexion.query(
      `SELECT ${COLUMNAS_INSUMO} FROM Insumo WHERE id_insumo = ?`,
      [idInsumo]
    );

    await conexion.commit();
    return { id_movimiento: resultado.insertId, insumo: formatearInsumo(actualizado[0]) };
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
};

// Obtiene un insumo por id (con nivel) o null si no existe
const obtenerInsumoPorId = async (idInsumo, conexion = db) => {
  const [filas] = await conexion.query(
    `SELECT ${COLUMNAS_INSUMO} FROM Insumo WHERE id_insumo = ?`,
    [idInsumo]
  );
  return filas.length === 0 ? null : formatearInsumo(filas[0]);
};

// Crea un insumo con stock 0 (el stock se carga con movimientos de Entrada)
const crearInsumo = async ({ nombre, unidadMedida, stockMinimo, costoUnitario }) => {
  try {
    const [resultado] = await db.query(
      'INSERT INTO Insumo (nombre, unidad_medida, stock_minimo, costo_unitario) VALUES (?, ?, ?, ?)',
      [nombre, unidadMedida, stockMinimo, costoUnitario]
    );
    return obtenerInsumoPorId(resultado.insertId);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw crearError('DUPLICADO', 'Ya existe un insumo con ese nombre');
    }
    throw error;
  }
};

// Edita nombre, unidad, stock mínimo y costo. La unidad solo cambia si el insumo no está en recetas
const actualizarInsumo = async (idInsumo, { nombre, unidadMedida, stockMinimo, costoUnitario }) => {
  const conexion = await db.getConnection();
  try {
    await conexion.beginTransaction();

    const [filas] = await conexion.query(
      'SELECT unidad_medida FROM Insumo WHERE id_insumo = ? FOR UPDATE',
      [idInsumo]
    );
    if (filas.length === 0) {
      throw crearError('NO_ENCONTRADA', 'Insumo no encontrado');
    }

    if (filas[0].unidad_medida !== unidadMedida) {
      const [recetas] = await conexion.query(
        'SELECT COUNT(*) AS cantidad FROM RecetaProducto WHERE id_insumo = ?',
        [idInsumo]
      );
      if (Number(recetas[0].cantidad) > 0) {
        throw crearError(
          'OPERACION_NO_PERMITIDA',
          'No se puede cambiar la unidad de un insumo que está en recetas'
        );
      }
    }

    await conexion.query(
      `UPDATE Insumo
       SET nombre = ?, unidad_medida = ?, stock_minimo = ?, costo_unitario = ?, fecha_actualizacion = NOW()
       WHERE id_insumo = ?`,
      [nombre, unidadMedida, stockMinimo, costoUnitario, idInsumo]
    );

    const insumo = await obtenerInsumoPorId(idInsumo, conexion);
    await conexion.commit();
    return insumo;
  } catch (error) {
    await conexion.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      throw crearError('DUPLICADO', 'Ya existe un insumo con ese nombre');
    }
    throw error;
  } finally {
    conexion.release();
  }
};

module.exports = { obtenerInsumos, registrarMovimiento, obtenerInsumoPorId, crearInsumo, actualizarInsumo };