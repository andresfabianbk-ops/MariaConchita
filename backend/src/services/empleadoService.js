// Importa las funciones del repositorio
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { guardarEmpleado, 
  obtenerEmpleados, 
  buscarPorCorreo, 
  obtenerEmpleadoPorId, 
  actualizarEmpleado, 
  cambiarEstadoEmpleado, 
  reiniciarCierresVacios, 
  actualizarContrasena, 
  existeCorreoDuplicado, 
  contarEmpleados,
  existeDocumentoDuplicado, 
  registrarIntentoFallido, 
  reiniciarIntentosFallidos, 
  contarOtrosAdministradoresActivos} = require('../repositories/empleadoRepository');

  const MAX_INTENTOS_LOGIN = 3;



const TIPOS_DOCUMENTO_VALIDOS = ['CC', 'PPT', 'PEP'];
const CARGOS_VALIDOS = ['Administrador', 'Mesero', 'Cajero', 'Cocinero'];
const LETRAS = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ';
// 2 a 50 caracteres: empieza y termina en letra; adentro admite espacios, apóstrofe y guion
const REGEX_NOMBRE = new RegExp(`^[${LETRAS}][${LETRAS}\\s'-]{0,48}[${LETRAS}]$`);
const REGEX_DOCUMENTO = /^\d{5,10}$/;
const REGEX_CELULAR = /^\d{10}$/;
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Lanza un error de negocio con código DATOS_INVALIDOS
const lanzarDatosInvalidos = (mensaje) => {
  const error = new Error(mensaje);
  error.codigo = 'DATOS_INVALIDOS';
  throw error;
};

// Validador único: en creación revisa todo; en edición solo los campos editables
const validarDatosEmpleado = (datos, { esCreacion }) => {
  const { tipoDocumento, numeroDocumento, nombres, apellidos,
    fechaNacimiento, correo, celular, contrasena, cargo } = datos;

  if (esCreacion) {
    if (!TIPOS_DOCUMENTO_VALIDOS.includes(tipoDocumento)) {
      lanzarDatosInvalidos('Tipo de documento inválido (CC, PPT o PEP)');
    }
    if (!REGEX_DOCUMENTO.test(String(numeroDocumento ?? ''))) {
      lanzarDatosInvalidos('El documento debe tener entre 5 y 10 dígitos');
    }

    const fechaTexto = String(fechaNacimiento ?? '');
    if (!REGEX_FECHA.test(fechaTexto)) {
      lanzarDatosInvalidos('La fecha de nacimiento debe tener formato AAAA-MM-DD');
    }
    const [anio, mes, dia] = fechaTexto.split('-').map(Number);
    const fecha = new Date(anio, mes - 1, dia);
    if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
      lanzarDatosInvalidos('La fecha de nacimiento no es válida');
    }
    const hoy = new Date();
    if (fecha > hoy) {
      lanzarDatosInvalidos('La fecha de nacimiento no puede ser futura');
    }
    let edad = hoy.getFullYear() - anio;
    if (hoy.getMonth() < mes - 1 || (hoy.getMonth() === mes - 1 && hoy.getDate() < dia)) {
      edad--;
    }
    if (edad < 18) {
      lanzarDatosInvalidos('El empleado debe ser mayor de 18 años');
    }

    if (String(contrasena ?? '').length < 6) {
      lanzarDatosInvalidos('La contraseña debe tener mínimo 6 caracteres');
    }
  }

  if (!REGEX_NOMBRE.test(String(nombres ?? ''))) {
    lanzarDatosInvalidos('Nombres: solo letras, de 2 a 50 caracteres');
  }
  if (!REGEX_NOMBRE.test(String(apellidos ?? ''))) {
    lanzarDatosInvalidos('Apellidos: solo letras, de 2 a 50 caracteres');
  }
  const correoTexto = String(correo ?? '');
  if (correoTexto.length > 100 || !REGEX_CORREO.test(correoTexto)) {
    lanzarDatosInvalidos('El correo no tiene un formato válido (máximo 100 caracteres)');
  }
  // El celular es opcional; si viene con valor, debe tener 10 dígitos
  if (celular !== undefined && celular !== null && String(celular) !== '' && !REGEX_CELULAR.test(String(celular))) {
    lanzarDatosInvalidos('El celular debe tener 10 dígitos');
  }
  if (!CARGOS_VALIDOS.includes(cargo)) {
    lanzarDatosInvalidos('Debe especificar el cargo (Administrador, Mesero, Cajero, Cocinero)');
  }
};

// Lógica de negocio: registra un empleado con validación completa
const crearEmpleado = async (datosEmpleado) => {
  const totalEmpleados = await contarEmpleados();
  if (totalEmpleados === 0) {
    datosEmpleado.cargo = 'Administrador'; // regla de negocio: el primer usuario del sistema siempre es Administrador
  }

    validarDatosEmpleado(datosEmpleado, { esCreacion: true });

  // Duplicados antes del INSERT (no dependen del nombre del índice único)
  if (await existeCorreoDuplicado(datosEmpleado.correo, 0)) {
    const error = new Error('Ya existe un empleado con ese correo');
    error.codigo = 'DUPLICADO';
    throw error;
  }
  if (await existeDocumentoDuplicado(datosEmpleado.numeroDocumento)) {
    const error = new Error('Ya existe un empleado con ese número de documento');
    error.codigo = 'DUPLICADO';
    throw error;
  }

  const { contrasena } = datosEmpleado;

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

    if (empleado.estado === 'Bloqueado') {
    const error = new Error('Tu cuenta está bloqueada. Contacta a un Administrador');
    error.codigo = 'NO_AUTORIZADO';
    throw error;
  }

  if (empleado.estado !== 'Activo') {
    const error = new Error('Credenciales inválidas');
    error.codigo = 'NO_AUTORIZADO';
    throw error;
  }

  const coincide = await bcrypt.compare(contrasenaPlano, empleado.contrasena);
  if (!coincide) {
    const intentos = await registrarIntentoFallido(empleado.id_usuario);
    if (intentos >= MAX_INTENTOS_LOGIN) {
      // Un Administrador solo se bloquea si hay otro Administrador Activo que pueda desbloquearlo
      const puedeBloquearse = empleado.cargo !== 'Administrador'
        || (await contarOtrosAdministradoresActivos(empleado.id_usuario)) > 0;
      if (puedeBloquearse) {
        await cambiarEstadoEmpleado(empleado.id_usuario, 'Bloqueado');
        const error = new Error(`Superaste ${MAX_INTENTOS_LOGIN} intentos fallidos. Tu cuenta quedó bloqueada; contacta a un Administrador`);
        error.codigo = 'NO_AUTORIZADO';
        throw error;
      }
    }
    const error = new Error('Credenciales inválidas');
    error.codigo = 'NO_AUTORIZADO';
    throw error;
  }

  await reiniciarIntentosFallidos(empleado.id_usuario); // login correcto: el contador vuelve a 0

  const token = jwt.sign(
    { id_usuario: empleado.id_usuario, cargo: empleado.cargo },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  const { contrasena, ...empleadoSinContrasena } = empleado;
  return { token, empleado: empleadoSinContrasena };
};

// Valida existencia y edita los datos de un empleado (no incluye contraseña)
const editarEmpleado = async (id, datosEmpleado, idModificador) => {
  const { nombres, apellidos, correo, celular, cargo } = datosEmpleado;

  const empleadoExistente = await obtenerEmpleadoPorId(id);
  if (!empleadoExistente) {
    const error = new Error('Empleado no encontrado');
    error.codigo = 'NO_ENCONTRADA';
    throw error;
  }

  validarDatosEmpleado(datosEmpleado, { esCreacion: false });

  const correoDuplicado = await existeCorreoDuplicado(correo, id);
  if (correoDuplicado) {
    const error = new Error('Ya existe otro empleado registrado con ese correo');
    error.codigo = 'DUPLICADO';
    throw error;
  }

  await actualizarEmpleado(id, { nombres, apellidos, correo, celular, cargo }, idModificador);
  return { id_usuario: Number(id), nombres, apellidos, correo, celular, cargo };
};

// Bloquea un empleado (no puede iniciar sesión ni marcar turno); se desbloquea con activarEmpleado
const bloquearEmpleado = async (id, idSolicitante) => {
  // Un usuario no puede bloquearse a sí mismo: podría quedar el sistema sin administrador activo
  if (Number(id) === Number(idSolicitante)) {
    const error = new Error('No puedes bloquear tu propio usuario');
    error.codigo = 'OPERACION_NO_PERMITIDA';
    throw error;
  }

  const empleadoExistente = await obtenerEmpleadoPorId(id);
  if (!empleadoExistente) {
    const error = new Error('Empleado no encontrado');
    error.codigo = 'NO_ENCONTRADA';
    throw error;
  }

  await cambiarEstadoEmpleado(id, 'Bloqueado'), idSolicitante;
  return true;
};

// Reactiva un empleado previamente desactivado
const activarEmpleado = async (id, idModificador) => {
  const empleadoExistente = await obtenerEmpleadoPorId(id);
  if (!empleadoExistente) {
    const error = new Error('Empleado no encontrado');
    error.codigo = 'NO_ENCONTRADA';
    throw error;
  }

  await cambiarEstadoEmpleado(id, 'Activo',  idModificador);
  await reiniciarCierresVacios(id); // desbloqueo: el contador del mes vuelve a 0
    await reiniciarIntentosFallidos(id); // el desbloqueo también reinicia los intentos de login
  return true;
};

// Devuelve al empleado vigente de una sesión (cargo y estado reales de la BD) o null si ya no existe
const obtenerEmpleadoDeSesion = async (idUsuario) => {
  return obtenerEmpleadoPorId(idUsuario);
};

// Cambia la contraseña de un empleado (hashea antes de guardar)
async function cambiarContrasena(id, contrasenaNueva, idModificador) {
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
  await actualizarContrasena(id, contrasenaHasheada, idModificador);
  return true;
}

module.exports = { crearEmpleado, listarEmpleados, iniciarSesion, editarEmpleado, bloquearEmpleado, activarEmpleado, cambiarContrasena, obtenerEmpleadoDeSesion };
