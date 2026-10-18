// Repositorio de empleados: consultas reales a la base de datos MySQL
const db = require('../config/db');

// Guarda un nuevo empleado en la base de datos
const guardarEmpleado = async (empleado) => {
  try {
    const [resultado] = await db.query(
      `INSERT INTO Usuario 
      (tipo_documento, numero_documento, nombres, apellidos, fecha_nacimiento, correo, celular, contrasena, id_rol, estado) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT id_rol FROM Rol WHERE nombre = ?), ?)`,
      [
        empleado.tipoDocumento,
        empleado.numeroDocumento,
        empleado.nombres,
        empleado.apellidos,
        empleado.fechaNacimiento,
        empleado.correo,
        empleado.celular,
        empleado.contrasena,
        empleado.cargo,
        empleado.estado || 'Activo'
      ]
    );
    return { id_usuario: resultado.insertId, ...empleado };
  } catch (error) {
    // Traduce el error de llave única de MySQL a un error de negocio
    if (error.code === 'ER_DUP_ENTRY') {
      const campo = error.message.includes('correo') ? 'correo' : 'número de documento';
      const duplicado = new Error(`Ya existe un empleado con ese ${campo}`);
      duplicado.codigo = 'DUPLICADO';
      throw duplicado;
    }
    throw error;
  }
};

// Retorna todos los empleados registrados
const obtenerEmpleados = async () => {
  const [filas] = await db.query(`
    SELECT u.id_usuario, u.tipo_documento AS tipoDocumento, u.numero_documento AS numeroDocumento,
           u.nombres, u.apellidos, u.fecha_nacimiento AS fechaNacimiento, u.correo, u.celular,
           u.contrasena, r.nombre AS cargo, u.estado
    FROM Usuario u
    JOIN Rol r ON u.id_rol = r.id_rol
  `);
  return filas;
};

// Busca un empleado por correo, incluyendo la contraseña hasheada (para validar login)
const buscarPorCorreo = async (correo) => {
  const [filas] = await db.query(`
    SELECT u.id_usuario, u.nombres, u.apellidos, u.correo, u.contrasena, r.nombre AS cargo, u.estado
    FROM Usuario u
    JOIN Rol r ON u.id_rol = r.id_rol
    WHERE u.correo = ?
  `, [correo]);
  return filas[0] || null;
};

// Busca un empleado por id, incluyendo su cargo (para validar existencia y para el service)
const obtenerEmpleadoPorId = async (id) => {
  const [filas] = await db.query(`
    SELECT u.id_usuario, u.tipo_documento AS tipoDocumento, u.numero_documento AS numeroDocumento,
           u.nombres, u.apellidos, u.fecha_nacimiento AS fechaNacimiento, u.correo, u.celular,
           r.nombre AS cargo, u.estado
    FROM Usuario u
    JOIN Rol r ON u.id_rol = r.id_rol
    WHERE u.id_usuario = ?
  `, [id]);
  return filas[0] || null;
};

// Actualiza los datos editables de un empleado (no incluye contraseña)
const actualizarEmpleado = async (id, empleado) => {
  const [resultado] = await db.query(
    `UPDATE Usuario
     SET nombres = ?, apellidos = ?, correo = ?, celular = ?, id_rol = (SELECT id_rol FROM Rol WHERE nombre = ?)
     WHERE id_usuario = ?`,
    [empleado.nombres, empleado.apellidos, empleado.correo, empleado.celular, empleado.cargo, id]
  );
  return resultado.affectedRows;
};

// Cambia el estado del empleado (Activo/Inactivo) — reemplaza el borrado físico
const cambiarEstadoEmpleado = async (id, estado) => {
  const [resultado] = await db.query(
    'UPDATE Usuario SET estado = ? WHERE id_usuario = ?',
    [estado, id]
  );
  return resultado.affectedRows;
};

// Actualiza la contraseña ya hasheada (el hasheo lo hace el service, no el repository)
const actualizarContrasena = async (id, contrasenaHasheada) => {
  const [resultado] = await db.query(
    'UPDATE Usuario SET contrasena = ? WHERE id_usuario = ?',
    [contrasenaHasheada, id]
  );
  return resultado.affectedRows;
};

// Verifica si ya existe otro usuario (distinto a idExcluir) con ese correo
const existeCorreoDuplicado = async (correo, idExcluir) => {
  const [filas] = await db.query(
    'SELECT COUNT(*) AS total FROM Usuario WHERE correo = ? AND id_usuario != ?',
    [correo, idExcluir]
  );
  return filas[0].total > 0;
};

// Cuenta cuántos empleados existen en total (usado para permitir el primer registro sin token)
const contarEmpleados = async () => {
  const [filas] = await db.query('SELECT COUNT(*) AS total FROM Usuario');
  return filas[0].total;
};

// Busca un empleado por documento para validar su identidad al marcar turno (incluye hash: solo uso interno)
const buscarPorDocumento = async (numeroDocumento) => {
  const [filas] = await db.query(
    `SELECT u.id_usuario, u.nombres, u.apellidos, u.contrasena, u.estado, r.nombre AS cargo
     FROM Usuario u
     JOIN Rol r ON r.id_rol = u.id_rol
     WHERE u.numero_documento = ?`,
    [numeroDocumento]
  );
  return filas[0] || null;
};

// Suma un cierre de turno vacío al contador del mes y devuelve el total del mes.
// Si el mes guardado no es el actual, el contador parte de 0 (reinicio mensual sin cron)
const registrarCierreVacio = async (idUsuario) => {
  await db.query(
    `UPDATE Usuario
     SET cierres_vacios = IF(mes_cierres_vacios = DATE_FORMAT(CURDATE(), '%Y-%m'), cierres_vacios, 0) + 1,
         mes_cierres_vacios = DATE_FORMAT(CURDATE(), '%Y-%m')
     WHERE id_usuario = ?`,
    [idUsuario]
  );
  const [filas] = await db.query(
    'SELECT cierres_vacios FROM Usuario WHERE id_usuario = ?',
    [idUsuario]
  );
  return Number(filas[0].cierres_vacios);
};

// Deja el contador de cierres vacíos en 0 (se usa al desbloquear con Activar)
const reiniciarCierresVacios = async (idUsuario) => {
  await db.query(
    'UPDATE Usuario SET cierres_vacios = 0, mes_cierres_vacios = NULL WHERE id_usuario = ?',
    [idUsuario]
  );
};

module.exports = { guardarEmpleado,
  obtenerEmpleados,
  buscarPorCorreo,
  obtenerEmpleadoPorId,
  actualizarEmpleado,
  cambiarEstadoEmpleado,
  actualizarContrasena,
  existeCorreoDuplicado,
  contarEmpleados,
  buscarPorDocumento,
  registrarCierreVacio,
  reiniciarCierresVacios };