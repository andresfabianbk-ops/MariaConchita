// Router de Express para el módulo de empleados
const { Router } = require('express');
const {
  postEmpleado,
  getEmpleados,
  postLogin,
  putEmpleado,
  putDesactivarEmpleado,
  putActivarEmpleado,
  putContrasena
} = require('../controllers/empleadoController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');
const { contarEmpleados } = require('../repositories/empleadoRepository');

const router = Router();

// Permite crear el primer empleado sin token; a partir del segundo, exige Administrador autenticado
async function permitirPrimerRegistroOAdmin(req, res, next) {
  try {
    const total = await contarEmpleados();
    if (total === 0) {
      return next(); // no hay empleados todavía, se permite el registro inicial
    }
    verificarToken(req, res, () => verificarRol('Administrador')(req, res, next));
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al validar el registro' });
  }
}

// POST /api/empleados/login → iniciar sesión (público, sin protección)
router.post('/login', postLogin);

// POST /api/empleados → registrar empleado (excepción: sin token si es el primer empleado del sistema)
router.post('/', permitirPrimerRegistroOAdmin, postEmpleado);

// A partir de aquí, todas las rutas requieren estar autenticado y ser Administrador
router.use(verificarToken, verificarRol('Administrador'));

// GET /api/empleados → listar empleados
router.get('/', getEmpleados);

// PUT /api/empleados/:id → editar datos del empleado
router.put('/:id', putEmpleado);

// PUT /api/empleados/:id/desactivar → desactivar empleado
router.put('/:id/desactivar', putDesactivarEmpleado);

// PUT /api/empleados/:id/activar → reactivar empleado
router.put('/:id/activar', putActivarEmpleado);

// PUT /api/empleados/:id/contrasena → cambiar contraseña
router.put('/:id/contrasena', putContrasena);

module.exports = router;