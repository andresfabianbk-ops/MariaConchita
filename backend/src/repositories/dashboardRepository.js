// Consultas de solo lectura del dashboard del Administrador
const db = require('../config/db');

// Pedidos que siguen en curso: ni entregados ni cancelados
const contarPedidosActivos = async () => {
  const [filas] = await db.query(
    `SELECT COUNT(*) AS total
     FROM Pedido
     WHERE estado NOT IN ('Entregado', 'Cancelado')`
  );
  return Number(filas[0].total);
};

// Empleados Activos con turno abierto hoy (un cierre vacío de días anteriores no cuenta)
const contarEmpleadosConTurnoHoy = async () => {
  const [filas] = await db.query(
    `SELECT COUNT(DISTINCT t.id_usuario) AS total
     FROM Turno t
     INNER JOIN Usuario u ON u.id_usuario = t.id_usuario
     WHERE t.hora_fin IS NULL
       AND t.hora_inicio >= CURDATE()
       AND u.estado = 'Activo'`
  );
  return Number(filas[0].total);
};

module.exports = { contarPedidosActivos, contarEmpleadosConTurnoHoy };