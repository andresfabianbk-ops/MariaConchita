// Importa las funciones del repositorio
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { guardarEmpleado, obtenerEmpleados, buscarPorCorreo, obtenerEmpleadoPorId, actualizarEmpleado, cambiarEstadoEmpleado, actualizarContrasena, existeCorreoDuplicado, contarEmpleados} = require('../repositories/empleadoRepository');

// Lógica de negocio: registra un empleado con validación completa
const crearEmpleado = async (datosEmpleado) => {
  const totalEmpleados = await contarEmpleados();
  if (totalEmpleados === 0) {
    datosEmpleado.cargo = 'Administrador'; // regla de negocio: el primer usuario del sistema siempre es Administrador
  }

  const { tipoDocumento, numeroDocumento, nombres, apellidos,
    fechaNacimiento, correo, telefono, contrasena, cargo, estado } = datosEmpleado;

  if (!tipoDocumento || !numeroDocumento) {
    const error = new Error('El empleado debe tener tipo y número de documento');
    error.codigo = 'DATOS_INVALIDOS';
    throw error;
  }
  if (!nombres || !apellidos) {
    const error = new Error('El empleado debe tener nombres y apellidos');
    error.codigo = 'DATOS_INVALIDOS';
    throw error;
  }
  if (!fechaNacimiento) {
    const error = new Error('El empleado debe tener fecha de nacimiento');
    error.codigo = 'DATOS_INVALIDOS';
    throw error;
  }
  if (!correo) {
    const error = new Error('El empleado debe tener correo');
    error.codigo = 'DATOS_INVALIDOS';
    throw error;
  }
  if (!contrasena) {
    const error = new Error('El empleado debe tener contraseña');
    error.codigo = 'DATOS_INVALIDOS';
    throw error;
  }
  if (!cargo) {
    const error = new Error('Debe especificar el cargo (Administrador, Mesero, Cajero, Cocinero)');
    error.codigo = 'DATOS_INVALIDOS';
    throw error;
  }

  const contrasenaHasheada = await bcrypt.hash(contrasena, 10);
  const datosConHash = { ...datosEmpleado, contrasena: contrasenaHasheada };

  const empleadoCreado = await guardarEmpleado(datosConHash);
  const { contrasena: _contrasenaOmitida, ...empleadoSinContrasena } = empleadoCreado;
  return empleadoSinContrasena;
  
};

// Lógica de negocio: lista los empleados registrados
const listarEmpleados = async () => {
  const empleados = await obtenerEmpleados();
  return empleados.map(({ contrasena, ...resto }) => resto);
};

// Valida credenciales y genera un token JWT si son correctas
const iniciarSesion = async (correo, contrasenaPlano) => {
  if (!correo || !contrasenaPlano) {
  const error = new Error('Debe ingresar correo y contraseña');
  error.codigo = 'DATOS_INVALIDOS';
  throw error;
  }

  const empleado = await buscarPorCorreo(correo);
  if (!empleado) {
    const error = new Error('Credenciales inválidas');
    error.codigo = 'NO_AUTORIZADO';
    throw error;
  }

  const coincide = await bcrypt.compare(contrasenaPlano, empleado.contrasena);
  if (!coincide) {
    const error = new Error('Credenciales inválidas');
    error.codigo = 'NO_AUTORIZADO';
    throw error;
  }

  const token = jwt.sign(
    { id_usuario: empleado.id_usuario, cargo: empleado.cargo },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  const { contrasena, ...empleadoSinContrasena } = empleado;
  return { token, empleado: empleadoSinContrasena };
};

// Valida existencia y edita los datos de un empleado (no incluye contraseña)
const editarEmpleado = async (id, datosEmpleado) => {
  const { nombres, apellidos, correo, celular, cargo } = datosEmpleado;

  const empleadoExistente = await obtenerEmpleadoPorId(id);
  if (!empleadoExistente) {
    const error = new Error('Empleado no encontrado');
    error.codigo = 'NO_ENCONTRADA';
    throw error;
  }

  if (!nombres || !apellidos) {
    const error = new Error('El empleado debe tener nombres y apellidos');
    error.codigo = 'DATOS_INVALIDOS';
    throw error;
  }
  if (!correo) {
    const error = new Error('El empleado debe tener correo');
    error.codigo = 'DATOS_INVALIDOS';
    throw error;
  }
  if (!cargo) {
    const error = new Error('Debe especificar el cargo');
    error.codigo = 'DATOS_INVALIDOS';
    throw error;
  }

  const correoDuplicado = await existeCorreoDuplicado(correo, id);
  if (correoDuplicado) {
    const error = new Error('Ya existe otro empleado registrado con ese correo');
    error.codigo = 'DUPLICADO';
    throw error;
  }

  await actualizarEmpleado(id, { nombres, apellidos, correo, celular, cargo });
  return { id_usuario: Number(id), nombres, apellidos, correo, celular, cargo };
};

// Desactiva un empleado (borrado lógico, en vez de eliminar el registro)
const desactivarEmpleado = async (id) => {
  const empleadoExistente = await obtenerEmpleadoPorId(id);
  if (!empleadoExistente) {
    const error = new Error('Empleado no encontrado');
    error.codigo = 'NO_ENCONTRADA';
    throw error;
  }

  await cambiarEstadoEmpleado(id, 'Inactivo');
  return true;
};

// Reactiva un empleado previamente desactivado
const activarEmpleado = async (id) => {
  const empleadoExistente = await obtenerEmpleadoPorId(id);
  if (!empleadoExistente) {
    const error = new Error('Empleado no encontrado');
    error.codigo = 'NO_ENCONTRADA';
    throw error;
  }

  await cambiarEstadoEmpleado(id, 'Activo');
  return true;
};

// Cambia la contraseña de un empleado (hashea antes de guardar)
const cambiarContrasena = async (id, contrasenaNueva) => {
  const empleadoExistente = await obtenerEmpleadoPorId(id);
  if (!empleadoExistente) {
    const error = new Error('Empleado no encontrado');
    error.codigo = 'NO_ENCONTRADA';
    throw error;
  }

  if (!contrasenaNueva || contrasenaNueva.length < 6) {
    const error = new Error('La contraseña debe tener al menos 6 caracteres');
    error.codigo = 'DATOS_INVALIDOS';
    throw error;
  }

  const contrasenaHasheada = await bcrypt.hash(contrasenaNueva, 10);
  await actualizarContrasena(id, contrasenaHasheada);
  return true;
};

module.exports = { crearEmpleado, listarEmpleados, iniciarSesion, editarEmpleado, desactivarEmpleado, activarEmpleado, cambiarContrasena };
