// Importa la lógica de negocio
const {
  crearEmpleado, listarEmpleados, iniciarSesion, editarEmpleado, desactivarEmpleado, activarEmpleado, cambiarContrasena } = require('../services/empleadoService');

// Traduce el código de error de negocio a un status HTTP
function mapearStatus(codigo) {
  switch (codigo) {
    case 'DATOS_INVALIDOS':
      return 400;
    case 'NO_AUTORIZADO':
      return 401;
    case 'NO_ENCONTRADA':
      return 404;
    case 'DUPLICADO':
      return 409;
    default:
      return 500;
  }
}

// Maneja la petición HTTP para registrar un empleado
const postEmpleado = async (req, res) => {
  try {
    const empleado = await crearEmpleado(req.body);
    res.status(201).json(empleado);
  } catch (error) {
    res.status(mapearStatus(error.codigo)).json({ mensaje: error.message });
  }
};

// Maneja la petición HTTP para listar empleados
const getEmpleados = async (req, res) => {
  try {
    const empleados = await listarEmpleados();
    res.status(200).json(empleados);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// Maneja la petición HTTP de login
const postLogin = async (req, res) => {
  try {
    const { correo, contrasena } = req.body;
    const resultado = await iniciarSesion(correo, contrasena);
    res.status(200).json(resultado);
  } catch (error) {
    res.status(mapearStatus(error.codigo)).json({ mensaje: error.message });
  }
};

// PUT /api/empleados/:id → editar datos del empleado
const putEmpleado = async (req, res) => {
  try {
    const { id } = req.params;
    const empleado = await editarEmpleado(id, req.body);
    res.status(200).json(empleado);
  } catch (error) {
    res.status(mapearStatus(error.codigo)).json({ mensaje: error.message });
  }
};

// PUT /api/empleados/:id/desactivar → desactivar empleado (borrado lógico)
const putDesactivarEmpleado = async (req, res) => {
  try {
    const { id } = req.params;
    await desactivarEmpleado(id);
    res.status(200).json({ mensaje: 'Empleado desactivado correctamente' });
  } catch (error) {
    res.status(mapearStatus(error.codigo)).json({ mensaje: error.message });
  }
};

// PUT /api/empleados/:id/activar → reactivar empleado
const putActivarEmpleado = async (req, res) => {
  try {
    const { id } = req.params;
    await activarEmpleado(id);
    res.status(200).json({ mensaje: 'Empleado activado correctamente' });
  } catch (error) {
    res.status(mapearStatus(error.codigo)).json({ mensaje: error.message });
  }
};

// PUT /api/empleados/:id/contrasena → cambiar contraseña
const putContrasena = async (req, res) => {
  try {
    const { id } = req.params;
    const { contrasenaNueva } = req.body;
    await cambiarContrasena(id, contrasenaNueva);
    res.status(200).json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    res.status(mapearStatus(error.codigo)).json({ mensaje: error.message });
  }
};

module.exports = { postEmpleado, getEmpleados, postLogin, putEmpleado, putDesactivarEmpleado, putActivarEmpleado, putContrasena };