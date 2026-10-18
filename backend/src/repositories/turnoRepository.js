// Repositorio de turnos: registro de ingreso y salida (asistencia) en MySQL
const db = require('../config/db');

// Último turno del empleado (cerrado o no); se consulta antes de abrir uno nuevo para detectar cierres vacíos
const obtenerUltimoTurnoDeUsuario = async (idUsuario) => {
  const [filas] = await db.query(
    'SELECT id_turno, hora_inicio, hora_fin FROM Turno WHERE id_usuario = ? ORDER BY hora_inicio DESC LIMIT 1',
    [idUsuario]
  );
  return filas[0] || null;
};

// Turno abierto (hora_fin NULL) del empleado con fecha de hoy, o null si no tiene
const obtenerTurnoAbiertoDeHoy = async (idUsuario) => {
  const [filas] = await db.query(
    `SELECT id_turno, id_usuario, hora_inicio FROM Turno
     WHERE id_usuario = ? AND hora_fin IS NULL AND DATE(hora_inicio) = CURDATE()
     ORDER BY hora_inicio DESC LIMIT 1`,
    [idUsuario]
  );
  return filas[0] || null;
};

// Abre un turno con la hora del servidor; devuelve el id del turno creado
const abrirTurno = async (idUsuario) => {
  const [resultado] = await db.query(
    'INSERT INTO Turno (id_usuario, hora_inicio) VALUES (?, NOW())',
    [idUsuario]
  );
  return resultado.insertId;
};

// Cierra un turno abierto con la hora del servidor; devuelve filas afectadas
const cerrarTurno = async (idTurno) => {
  const [resultado] = await db.query(
    'UPDATE Turno SET hora_fin = NOW() WHERE id_turno = ? AND hora_fin IS NULL',
    [idTurno]
  );
  return resultado.affectedRows;
};

// Lista de turnos para el Administrador, con filtros opcionales por fecha y empleado.
// hora_fin NULL significa que el empleado no marcó el cierre
const listarTurnos = async ({ fechaDesde, fechaHasta, idUsuario } = {}) => {
  const condiciones = [];
  const parametros = [];
  if (fechaDesde) { condiciones.push('DATE(t.hora_inicio) >= ?'); parametros.push(fechaDesde); }
  if (fechaHasta) { condiciones.push('DATE(t.hora_inicio) <= ?'); parametros.push(fechaHasta); }
  if (idUsuario) { condiciones.push('t.id_usuario = ?'); parametros.push(idUsuario); }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [filas] = await db.query(
    `SELECT t.id_turno, t.id_usuario, u.nombres, u.apellidos, r.nombre AS cargo,
            t.hora_inicio, t.hora_fin
     FROM Turno t
     JOIN Usuario u ON u.id_usuario = t.id_usuario
     JOIN Rol r ON r.id_rol = u.id_rol
     ${where}
     ORDER BY t.hora_inicio DESC
     LIMIT 200`,
    parametros
  );
  return filas;
};

module.exports = {
  obtenerUltimoTurnoDeUsuario,
  obtenerTurnoAbiertoDeHoy,
  abrirTurno,
  cerrarTurno,
  listarTurnos
};