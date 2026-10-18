const express = require('express');
const router = express.Router();
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');
const { getTurnoActual, postIniciarTurno, putFinalizarTurno, postRegistrarTurno, getTurnos
} = require('../controllers/turnoController');

// Turno propio: cualquier empleado con token
router.get('/actual', verificarToken, getTurnoActual);
router.post('/iniciar', verificarToken, postIniciarTurno);
router.put('/finalizar', verificarToken, putFinalizarTurno);

// Terminal compartida (panel web)
const rolesTerminal = verificarRol('Administrador', 'Cajero', 'Cocinero');
router.post('/registrar', verificarToken, rolesTerminal, postRegistrarTurno);

// Reporte de asistencia: solo Administrador
router.get('/', verificarToken, verificarRol('Administrador'), getTurnos);

module.exports = router;