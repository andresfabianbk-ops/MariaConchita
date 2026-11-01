const jwt = require('jsonwebtoken');
const { obtenerEmpleadoDeSesion } = require('../services/empleadoService');

/**
 * Middleware: verificarToken
 * Valida el JWT del header Authorization y consulta al empleado vigente en la BD.
 * El cargo y el estado salen de la BD en cada petición, no del token: un cambio de rol,
 * una desactivación o un bloqueo surten efecto de inmediato.
 * Agrega req.usuario = { id_usuario, cargo } para los siguientes middlewares/controllers.
 */
async function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ mensaje: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ mensaje: 'Token expirado, inicie sesión nuevamente' });
    }
    return res.status(401).json({ mensaje: 'Token inválido' });
  }

  try {
    const empleado = await obtenerEmpleadoDeSesion(payload.id_usuario);
    if (!empleado || empleado.estado !== 'Activo') {
      return res.status(401).json({ mensaje: 'Tu cuenta ya no está habilitada' });
    }
    req.usuario = { id_usuario: empleado.id_usuario, cargo: empleado.cargo };
    next();
  } catch (error) {
    console.error('Error al validar la sesión:', error); // deja el detalle en la consola del servidor
    res.status(500).json({ mensaje: 'Error al validar la sesión' });
  }
}
/**
 * Middleware: verificarRol
 * Higher-order function: recibe los cargos permitidos y retorna el middleware.
 * Debe usarse SIEMPRE después de verificarToken en la cadena de rutas,
 * ya que depende de req.usuario.cargo.
 *
 * Uso: router.post('/', verificarToken, verificarRol('Administrador'), controller.crear);
 */
function verificarRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.cargo)) {
      return res.status(403).json({ mensaje: 'No tiene permisos para esta acción' });
    }
    next();
  };
}

module.exports = { verificarToken, verificarRol };