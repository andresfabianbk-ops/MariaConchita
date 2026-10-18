// Importa la lógica de negocio de turnos
const { iniciarTurno, finalizarTurno, consultarTurnoActual, registrarTurnoEmpleado, consultarTurnos
} = require('../services/turnoService');

// Traduce el código de error de negocio a un status HTTP
function mapearStatus(codigo) {
  switch (codigo) {
    case 'DATOS_INVALIDOS':
      return 400;
    case 'CREDENCIALES_INVALIDAS':
      return 403; // no 401: el frontend lo interpreta como sesión expirada
    case 'CUENTA_BLOQUEADA':
      return 403; // no 401: el frontend lo interpreta como sesión expirada
    case 'NO_ENCONTRADA':
      return 404;
    case 'DUPLICADO':
      return 409;
    default:
      return 500;
  }
}

// GET /api/turnos/actual → turno abierto propio (o null)
const getTurnoActual = async (req, res) => {
  try {
    const turno = await consultarTurnoActual(req.usuario.id_usuario);
    res.status(200).json(turno);
  } catch (error) {
    res.status(mapearStatus(error.codigo)).json({ mensaje: error.message });
  }
};

// POST /api/turnos/iniciar → abrir turno propio
const postIniciarTurno = async (req, res) => {
  try {
    const turno = await iniciarTurno(req.usuario.id_usuario);
    res.status(201).json(turno);
  } catch (error) {
    res.status(mapearStatus(error.codigo)).json({ mensaje: error.message });
  }
};

// PUT /api/turnos/finalizar → cerrar turno propio
const putFinalizarTurno = async (req, res) => {
  try {
    await finalizarTurno(req.usuario.id_usuario);
    res.status(200).json({ mensaje: 'Turno finalizado correctamente' });
  } catch (error) {
    res.status(mapearStatus(error.codigo)).json({ mensaje: error.message });
  }
};

// POST /api/turnos/registrar → ingreso/salida de otro empleado (documento + contraseña)
const postRegistrarTurno = async (req, res) => {
  try {
    const { numeroDocumento, contrasena, accion } = req.body;
    const resultado = await registrarTurnoEmpleado(numeroDocumento, contrasena, accion);
    res.status(200).json(resultado);
  } catch (error) {
    res.status(mapearStatus(error.codigo)).json({ mensaje: error.message });
  }
};

// GET /api/turnos → listado para el Administrador (?fechaDesde, ?fechaHasta, ?idUsuario)
const getTurnos = async (req, res) => {
  try {
    const { fechaDesde, fechaHasta, idUsuario } = req.query;
    const turnos = await consultarTurnos({ fechaDesde, fechaHasta, idUsuario });
    res.status(200).json(turnos);
  } catch (error) {
    res.status(mapearStatus(error.codigo)).json({ mensaje: error.message });
  }
};

module.exports = {
  getTurnoActual, postIniciarTurno, putFinalizarTurno, postRegistrarTurno, getTurnos
};