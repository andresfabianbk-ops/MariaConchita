const jwt = require('jsonwebtoken');

/**
 * Middleware: verificarToken
 * Valida que la petición traiga un JWT válido en el header Authorization.
 * Si es válido, agrega los datos decodificados del empleado a req.usuario
 * ({ id_usuario, cargo }) para que los siguientes middlewares/controllers lo usen.
 */
function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ mensaje: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload; // { id_usuario, cargo }
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ mensaje: 'Token expirado, inicie sesión nuevamente' });
    }
    return res.status(401).json({ mensaje: 'Token inválido' });
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