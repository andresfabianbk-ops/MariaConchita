// Lógica de negocio de turnos: cada empleado marca su propio inicio y cierre (asistencia)
const bcrypt = require('bcrypt');
const {
  obtenerUltimoTurnoDeUsuario,
  obtenerTurnoAbiertoDeHoy,
  abrirTurno,
  cerrarTurno,
  listarTurnos
} = require('../repositories/turnoRepository');
const {
  buscarPorDocumento,
  obtenerEmpleadoPorId,
  registrarCierreVacio,
  cambiarEstadoEmpleado
} = require('../repositories/empleadoRepository');

// Cierres de turno vacíos acumulados en el mes que provocan el bloqueo
const LIMITE_CIERRES_VACIOS = 3;

// Crea un error de negocio con su código (el controller lo traduce a HTTP)
const crearError = (mensaje, codigo) => {
  const error = new Error(mensaje);
  error.codigo = codigo;
  return error;
};

// Un empleado bloqueado o inactivo no puede marcar turno
const verificarPuedeMarcar = (empleado) => {
  if (empleado.estado === 'Bloqueado') {
    throw crearError('Cuenta bloqueada por cierres de turno vacíos. Comunícate con el Administrador', 'CUENTA_BLOQUEADA');
  }
  if (empleado.estado !== 'Activo') {
    throw crearError('Empleado no habilitado', 'CREDENCIALES_INVALIDAS');
  }
};

// Marca el inicio de turno: crea un turno nuevo con la fecha actual.
// Si el turno anterior quedó sin cierre, suma un cierre vacío, avisa y bloquea al llegar al límite del mes
const marcarInicio = async (empleado) => {
  if (await obtenerTurnoAbiertoDeHoy(empleado.id_usuario)) {
    throw crearError('Ya marcaste tu inicio de turno hoy', 'DUPLICADO');
  }

  const ultimoTurno = await obtenerUltimoTurnoDeUsuario(empleado.id_usuario);
  let aviso = null;
  if (ultimoTurno && ultimoTurno.hora_fin === null) {
    const cierresVaciosMes = await registrarCierreVacio(empleado.id_usuario);
    const bloqueado = cierresVaciosMes >= LIMITE_CIERRES_VACIOS;
    if (bloqueado) {
      await cambiarEstadoEmpleado(empleado.id_usuario, 'Bloqueado');
    }
    aviso = {
      mensaje: bloqueado
        ? `No registraste el cierre de tu turno anterior. Llegaste a ${LIMITE_CIERRES_VACIOS} cierres vacíos este mes: tu cuenta quedó bloqueada, comunícate con el Administrador`
        : `No registraste el cierre de tu turno anterior. Cierres vacíos este mes: ${cierresVaciosMes} de ${LIMITE_CIERRES_VACIOS}`,
      fechaTurnoSinCierre: ultimoTurno.hora_inicio,
      cierresVaciosMes,
      bloqueado
    };
  }

  const idTurno = await abrirTurno(empleado.id_usuario);
  return { id_turno: idTurno, aviso };
};

// Marca el cierre de turno: solo cierra un turno abierto de hoy
const marcarCierre = async (empleado) => {
  const turnoAbierto = await obtenerTurnoAbiertoDeHoy(empleado.id_usuario);
  if (!turnoAbierto) {
    throw crearError('No tienes un turno abierto hoy', 'NO_ENCONTRADA');
  }
  await cerrarTurno(turnoAbierto.id_turno);
};

// Obtiene al empleado autenticado y verifica que pueda marcar
const obtenerEmpleadoQueMarca = async (idUsuario) => {
  const empleado = await obtenerEmpleadoPorId(idUsuario);
  if (!empleado) {
    throw crearError('Empleado no encontrado', 'NO_ENCONTRADA');
  }
  verificarPuedeMarcar(empleado);
  return empleado;
};

// Inicio de turno del empleado con sesión
const iniciarTurno = async (idUsuario) => {
  const empleado = await obtenerEmpleadoQueMarca(idUsuario);
  return marcarInicio(empleado);
};

// Cierre de turno del empleado con sesión
const finalizarTurno = async (idUsuario) => {
  const empleado = await obtenerEmpleadoQueMarca(idUsuario);
  await marcarCierre(empleado);
  return true;
};

// Devuelve el turno abierto de hoy del empleado autenticado, o null si no tiene
const consultarTurnoActual = (idUsuario) => obtenerTurnoAbiertoDeHoy(idUsuario);

// Marca inicio o cierre de un empleado en una terminal compartida:
// se identifica con documento y contraseña, y la acción llega explícita ('inicio' o 'cierre')
const registrarTurnoEmpleado = async (numeroDocumento, contrasena, accion) => {
  if (!/^\d{1,10}$/.test(String(numeroDocumento ?? '')) || !contrasena) {
    throw crearError('Documento y contraseña son obligatorios', 'DATOS_INVALIDOS');
  }
  if (accion !== 'inicio' && accion !== 'cierre') {
    throw crearError("La acción debe ser 'inicio' o 'cierre'", 'DATOS_INVALIDOS');
  }

  const empleado = await buscarPorDocumento(String(numeroDocumento));
  const credencialesValidas = empleado
    && empleado.estado !== 'Inactivo'
    && await bcrypt.compare(String(contrasena), empleado.contrasena);
  if (!credencialesValidas) {
    // mensaje genérico: no revela si el documento existe o está inactivo
    throw crearError('Documento o contraseña incorrectos', 'CREDENCIALES_INVALIDAS');
  }
  verificarPuedeMarcar(empleado);

  let aviso = null;
  if (accion === 'inicio') {
    ({ aviso } = await marcarInicio(empleado));
  } else {
    await marcarCierre(empleado);
  }

  return {
    accion,
    empleado: `${empleado.nombres} ${empleado.apellidos}`,
    hora: new Date(),
    aviso
  };
};

// Lista de turnos para el Administrador, con filtros opcionales (hora_fin NULL = sin cierre)
const consultarTurnos = async ({ fechaDesde, fechaHasta, idUsuario } = {}) => {
  const formatoFecha = /^\d{4}-\d{2}-\d{2}$/;
  if ((fechaDesde && !formatoFecha.test(fechaDesde)) || (fechaHasta && !formatoFecha.test(fechaHasta))) {
    throw crearError('Las fechas deben tener formato AAAA-MM-DD', 'DATOS_INVALIDOS');
  }
  if (idUsuario && !Number.isInteger(Number(idUsuario))) {
    throw crearError('El empleado indicado no es válido', 'DATOS_INVALIDOS');
  }

  return listarTurnos({
    fechaDesde,
    fechaHasta,
    idUsuario: idUsuario ? Number(idUsuario) : undefined
  });
};

module.exports = {
  iniciarTurno,
  finalizarTurno,
  consultarTurnoActual,
  registrarTurnoEmpleado,
  consultarTurnos
};