// Servicio de reportes (RF10): valida el rango de fechas y arma cada reporte con el repositorio
const {
  obtenerResumenVentas,
  obtenerVentasPorDia,
  obtenerIngresosPorMetodo,
  obtenerProductosMasVendidos,
  obtenerMovimientosPorInsumo
} = require('../repositories/reporteRepository');

// Crea un error de negocio con .codigo (traducido a HTTP en el controller)
const crearError = (codigo, mensaje) => {
  const error = new Error(mensaje);
  error.codigo = codigo;
  return error;
};

const TIPOS_REPORTE = ['resumen', 'productos', 'inventario'];
const DIAS_MAXIMOS = 366;
const LIMITE_PRODUCTOS = 10;
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

// Redondea a 2 decimales (cantidad con 3 decimales × costo con 2 puede dar 5)
const redondear = (numero) => Math.round(numero * 100) / 100;

// Suma un campo numérico de una lista; los null (insumo sin costo) cuentan como 0
const sumar = (lista, campo) => redondear(lista.reduce((acumulado, item) => acumulado + (item[campo] ?? 0), 0));

// Convierte AAAA-MM-DD a fecha; rechaza texto sin formato y fechas inexistentes (ej. 2026-02-30)
const convertirFecha = (texto, nombreCampo) => {
  if (typeof texto !== 'string' || !FORMATO_FECHA.test(texto)) {
    throw crearError('DATOS_INVALIDOS', `${nombreCampo} es obligatoria y debe tener formato AAAA-MM-DD`);
  }
  const fecha = new Date(`${texto}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== texto) {
    throw crearError('DATOS_INVALIDOS', `${nombreCampo} no es una fecha válida`);
  }
  return fecha;
};

// Valida las dos fechas, su orden y el máximo de días del rango
const validarRango = (desde, hasta) => {
  const fechaDesde = convertirFecha(desde, 'La fecha inicial');
  const fechaHasta = convertirFecha(hasta, 'La fecha final');

  if (fechaDesde > fechaHasta) {
    throw crearError('DATOS_INVALIDOS', 'La fecha inicial no puede ser posterior a la final');
  }
  const dias = Math.round((fechaHasta - fechaDesde) / MS_POR_DIA) + 1;
  if (dias > DIAS_MAXIMOS) {
    throw crearError('DATOS_INVALIDOS', `El rango no puede superar ${DIAS_MAXIMOS} días`);
  }
};

// Calcula por insumo el valor de lo comprado y de la merma (null si el insumo no tiene costo cargado)
const detallarInsumos = (movimientos) => movimientos.map((movimiento) => ({
  id_insumo: movimiento.id_insumo,
  nombre: movimiento.nombre,
  unidad_medida: movimiento.unidad_medida,
  costo_unitario: movimiento.costo_unitario,
  cantidad_comprada: movimiento.cantidad_comprada,
  total_compras: movimiento.costo_unitario === null
    ? null
    : redondear(movimiento.cantidad_comprada * movimiento.costo_unitario),
  cantidad_merma: movimiento.cantidad_merma,
  total_merma: movimiento.costo_unitario === null
    ? null
    : redondear(movimiento.cantidad_merma * movimiento.costo_unitario)
}));

// Nombres de los insumos con movimientos pero sin costo (su valor no entra en los totales)
const nombresSinCosto = (insumos) => insumos
  .filter((insumo) => insumo.costo_unitario === null)
  .map((insumo) => insumo.nombre);

// Resumen general: ventas, ingresos, egresos (lista de conceptos, ampliable), pérdidas y ganancia
const armarResumen = async (desde, hasta) => {
  const [ventas, ventasPorDia, porMetodo, movimientos] = await Promise.all([
    obtenerResumenVentas(desde, hasta),
    obtenerVentasPorDia(desde, hasta),
    obtenerIngresosPorMetodo(desde, hasta),
    obtenerMovimientosPorInsumo(desde, hasta)
  ]);

  const insumos = detallarInsumos(movimientos);
  const totalIngresos = sumar(porMetodo, 'total');
  const conceptosEgresos = [
    { concepto: 'Compras de insumos', total: sumar(insumos, 'total_compras') }
    // Aquí se sumarán después nómina, arriendo, servicios y otros gastos
  ];
  const totalEgresos = sumar(conceptosEgresos, 'total');

  return {
    tipo: 'resumen',
    desde,
    hasta,
    hayDatos: ventas.pedidos > 0 || movimientos.length > 0,
    ventas,
    ventasPorDia,
    ingresos: { total: totalIngresos, porMetodo },
    egresos: { total: totalEgresos, conceptos: conceptosEgresos },
    perdidas: { total: sumar(insumos, 'total_merma') }, // mermas: se muestran aparte de los egresos
    ganancia: redondear(totalIngresos - totalEgresos),
    insumosSinCosto: nombresSinCosto(insumos)
  };
};

// Productos más vendidos del periodo
const armarProductos = async (desde, hasta) => {
  const productos = await obtenerProductosMasVendidos(desde, hasta, LIMITE_PRODUCTOS);
  return { tipo: 'productos', desde, hasta, hayDatos: productos.length > 0, productos };
};

// Compras y mermas por insumo
const armarInventario = async (desde, hasta) => {
  const movimientos = await obtenerMovimientosPorInsumo(desde, hasta);
  const insumos = detallarInsumos(movimientos);

  return {
    tipo: 'inventario',
    desde,
    hasta,
    hayDatos: insumos.length > 0,
    insumos,
    totales: { compras: sumar(insumos, 'total_compras'), mermas: sumar(insumos, 'total_merma') },
    insumosSinCosto: nombresSinCosto(insumos)
  };
};

// Genera el reporte pedido: valida el tipo y el rango y lo arma según el tipo
const generarReporte = async (tipo, desde, hasta) => {
  if (!TIPOS_REPORTE.includes(tipo)) {
    throw crearError('DATOS_INVALIDOS', `El tipo de reporte debe ser uno de: ${TIPOS_REPORTE.join(', ')}`);
  }
  validarRango(desde, hasta);

  if (tipo === 'resumen') return armarResumen(desde, hasta);
  if (tipo === 'productos') return armarProductos(desde, hasta);
  return armarInventario(desde, hasta);
};

module.exports = { generarReporte, TIPOS_REPORTE };