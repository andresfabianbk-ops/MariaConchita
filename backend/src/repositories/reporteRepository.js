// Repositorio de reportes: consultas de solo lectura sobre ventas, pagos, productos e inventario
const db = require('../config/db');

// Rango por días, inclusivo: desde las 00:00 de "desde" hasta el final del día "hasta"
// (se compara con < día siguiente para no perder los registros de las últimas horas)
const filtroFecha = (columna) => `${columna} >= ? AND ${columna} < DATE_ADD(?, INTERVAL 1 DAY)`;

// Total de ventas del periodo: facturas de pedidos no cancelados
const obtenerResumenVentas = async (desde, hasta) => {
  const [filas] = await db.query(`
    SELECT COUNT(*) AS pedidos, COALESCE(SUM(f.total), 0) AS total
    FROM Factura f
    JOIN Pedido p ON p.id_pedido = f.id_pedido
    WHERE p.estado <> 'Cancelado' AND ${filtroFecha('f.fecha')}
  `, [desde, hasta]);
  return { pedidos: Number(filas[0].pedidos), total: Number(filas[0].total) };
};

// Ventas agrupadas por día (el día sale como texto AAAA-MM-DD)
const obtenerVentasPorDia = async (desde, hasta) => {
  const [filas] = await db.query(`
    SELECT DATE_FORMAT(f.fecha, '%Y-%m-%d') AS dia, COUNT(*) AS pedidos, SUM(f.total) AS total
    FROM Factura f
    JOIN Pedido p ON p.id_pedido = f.id_pedido
    WHERE p.estado <> 'Cancelado' AND ${filtroFecha('f.fecha')}
    GROUP BY dia
    ORDER BY dia
  `, [desde, hasta]);
  return filas.map((fila) => ({
    dia: fila.dia,
    pedidos: Number(fila.pedidos),
    total: Number(fila.total) // mysql2 devuelve DECIMAL como string
  }));
};

// Ingresos del periodo: pagos agrupados por método (Efectivo, Nequi, Daviplata, Tarjeta)
const obtenerIngresosPorMetodo = async (desde, hasta) => {
  const [filas] = await db.query(`
    SELECT pa.metodo, COUNT(*) AS pagos, SUM(pa.valor) AS total
    FROM Pago pa
    JOIN Factura f ON f.id_factura = pa.id_factura
    JOIN Pedido p ON p.id_pedido = f.id_pedido
    WHERE p.estado <> 'Cancelado' AND ${filtroFecha('pa.fecha')}
    GROUP BY pa.metodo
    ORDER BY total DESC
  `, [desde, hasta]);
  return filas.map((fila) => ({
    metodo: fila.metodo,
    pagos: Number(fila.pagos),
    total: Number(fila.total)
  }));
};

// Productos más vendidos: pedidos pagados, no cancelados y con factura dentro del periodo
// (usa precio_unitario, congelado al momento del pedido)
const obtenerProductosMasVendidos = async (desde, hasta, limite = 10) => {
  const [filas] = await db.query(`
    SELECT pr.id_producto, pr.nombre,
           SUM(d.cantidad) AS unidades,
           SUM(d.cantidad * d.precio_unitario) AS total
    FROM DetallePedido d
    JOIN Pedido p ON p.id_pedido = d.id_pedido
    JOIN Factura f ON f.id_pedido = p.id_pedido
    JOIN Producto pr ON pr.id_producto = d.id_producto
    WHERE p.pagado = 1 AND p.estado <> 'Cancelado' AND ${filtroFecha('f.fecha')}
    GROUP BY pr.id_producto, pr.nombre
    ORDER BY unidades DESC, total DESC
    LIMIT ?
  `, [desde, hasta, limite]);
  return filas.map((fila) => ({
    id_producto: fila.id_producto,
    nombre: fila.nombre,
    unidades: Number(fila.unidades),
    total: Number(fila.total)
  }));
};

// Compras y mermas por insumo en el periodo.
// Compras = Entradas manuales (id_pedido NULL: las que tienen id_pedido son devoluciones por cancelación)
const obtenerMovimientosPorInsumo = async (desde, hasta) => {
  const [filas] = await db.query(`
    SELECT i.id_insumo, i.nombre, i.unidad_medida, i.costo_unitario,
           COALESCE(SUM(CASE WHEN m.tipo = 'Entrada' AND m.id_pedido IS NULL THEN m.cantidad END), 0) AS cantidad_comprada,
           COALESCE(SUM(CASE WHEN m.tipo = 'Salida por merma' THEN m.cantidad END), 0) AS cantidad_merma
    FROM MovimientoInventario m
    JOIN Insumo i ON i.id_insumo = m.id_insumo
    WHERE ${filtroFecha('m.fecha')}
    GROUP BY i.id_insumo, i.nombre, i.unidad_medida, i.costo_unitario
    HAVING cantidad_comprada > 0 OR cantidad_merma > 0
    ORDER BY i.nombre
  `, [desde, hasta]);
  return filas.map((fila) => ({
    id_insumo: fila.id_insumo,
    nombre: fila.nombre,
    unidad_medida: fila.unidad_medida,
    costo_unitario: fila.costo_unitario === null ? null : Number(fila.costo_unitario), // null = sin costo cargado
    cantidad_comprada: Number(fila.cantidad_comprada),
    cantidad_merma: Number(fila.cantidad_merma)
  }));
};

module.exports = {
  obtenerResumenVentas,
  obtenerVentasPorDia,
  obtenerIngresosPorMetodo,
  obtenerProductosMasVendidos,
  obtenerMovimientosPorInsumo
};