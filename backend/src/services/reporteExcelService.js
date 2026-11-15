// Servicio de exportación a Excel de los reportes (RF10): arma el .xlsx en memoria con exceljs
const ExcelJS = require('exceljs');
const { generarReporte } = require('./reporteService');

const FORMATO_PESOS = '"$"#,##0';
const COLOR_ENCABEZADO = 'FFC4612A'; // naranja de marca
const TEXTO_SIN_COSTO = 'Sin costo';

const NOMBRES_HOJA = {
  resumen: 'Resumen general',
  productos: 'Productos más vendidos',
  inventario: 'Compras y mermas'
};

// Título del reporte y periodo en las dos primeras filas
const agregarTitulo = (hoja, titulo, desde, hasta) => {
  hoja.addRow([titulo]).font = { bold: true, size: 14 };
  hoja.addRow([`Periodo: ${desde} a ${hasta}`]);
};

// Fila en blanco + nombre de sección en negrita
const agregarSeccion = (hoja, texto) => {
  hoja.addRow([]);
  hoja.addRow([texto]).font = { bold: true, size: 12 };
};

// Línea "etiqueta | valor" con la etiqueta en negrita
const agregarDato = (hoja, etiqueta, valor, formato) => {
  const fila = hoja.addRow([etiqueta, valor]);
  fila.getCell(1).font = { bold: true };
  if (formato) fila.getCell(2).numFmt = formato;
};

// Tabla con encabezado naranja; columnas = [{ titulo, ancho, formato }], filas = arreglos de valores
const agregarTabla = (hoja, columnas, filas) => {
  const encabezado = hoja.addRow(columnas.map((c) => c.titulo));
  encabezado.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ENCABEZADO } };
  });
  filas.forEach((valores) => {
    const fila = hoja.addRow(valores);
    columnas.forEach((c, i) => {
      if (c.formato) fila.getCell(i + 1).numFmt = c.formato;
    });
  });
  // El ancho de cada columna es el mayor entre todas las tablas de la hoja
  columnas.forEach((c, i) => {
    const columna = hoja.getColumn(i + 1);
    columna.width = Math.max(columna.width || 0, c.ancho);
  });
};

// Aviso con los insumos sin costo (cuentan como $0 en los totales)
const agregarAvisoSinCosto = (hoja, insumosSinCosto) => {
  if (!insumosSinCosto || insumosSinCosto.length === 0) return;
  hoja.addRow([]);
  hoja.addRow([`Insumos sin costo (cuentan como $0 en los totales): ${insumosSinCosto.join(', ')}`]);
};

const armarResumen = (hoja, reporte) => {
  agregarSeccion(hoja, 'Indicadores');
  agregarDato(hoja, 'Pedidos', reporte.ventas.pedidos);
  agregarDato(hoja, 'Ventas', reporte.ventas.total, FORMATO_PESOS);
  agregarDato(hoja, 'Ingresos', reporte.ingresos.total, FORMATO_PESOS);
  agregarDato(hoja, 'Egresos', reporte.egresos.total, FORMATO_PESOS);
  agregarDato(hoja, 'Pérdidas por mermas', reporte.perdidas.total, FORMATO_PESOS);
  agregarDato(hoja, 'Ganancia', reporte.ganancia, FORMATO_PESOS);

  agregarSeccion(hoja, 'Ventas por día');
  agregarTabla(
    hoja,
    [
      { titulo: 'Día', ancho: 28 },
      { titulo: 'Pedidos', ancho: 14 },
      { titulo: 'Total', ancho: 16, formato: FORMATO_PESOS }
    ],
    reporte.ventasPorDia.map((d) => [d.dia, d.pedidos, d.total])
  );

  agregarSeccion(hoja, 'Ingresos por método de pago');
  agregarTabla(
    hoja,
    [
      { titulo: 'Método', ancho: 28 },
      { titulo: 'Pagos', ancho: 14 },
      { titulo: 'Total', ancho: 16, formato: FORMATO_PESOS }
    ],
    reporte.ingresos.porMetodo.map((m) => [m.metodo, m.pagos, m.total])
  );

  agregarSeccion(hoja, 'Egresos');
  agregarTabla(
    hoja,
    [
      { titulo: 'Concepto', ancho: 28 },
      { titulo: 'Total', ancho: 14, formato: FORMATO_PESOS }
    ],
    reporte.egresos.conceptos.map((c) => [c.concepto, c.total])
  );

  agregarAvisoSinCosto(hoja, reporte.insumosSinCosto);
};

const armarProductos = (hoja, reporte) => {
  agregarSeccion(hoja, 'Ranking');
  agregarTabla(
    hoja,
    [
      { titulo: '#', ancho: 6 },
      { titulo: 'Producto', ancho: 32 },
      { titulo: 'Unidades', ancho: 14 },
      { titulo: 'Total vendido', ancho: 18, formato: FORMATO_PESOS }
    ],
    reporte.productos.map((p, i) => [i + 1, p.nombre, p.unidades, p.total])
  );
};

const armarInventario = (hoja, reporte) => {
  // Los valores null (insumo sin costo) se muestran como "Sin costo"
  const conCosto = (valor) => (valor === null ? TEXTO_SIN_COSTO : valor);

  agregarSeccion(hoja, 'Compras y mermas por insumo');
  agregarTabla(
    hoja,
    [
      { titulo: 'Insumo', ancho: 28 },
      { titulo: 'Unidad', ancho: 14 },
      { titulo: 'Costo unitario', ancho: 18, formato: FORMATO_PESOS },
      { titulo: 'Cant. comprada', ancho: 16 },
      { titulo: 'Total compras', ancho: 16, formato: FORMATO_PESOS },
      { titulo: 'Cant. merma', ancho: 14 },
      { titulo: 'Total merma', ancho: 16, formato: FORMATO_PESOS }
    ],
    reporte.insumos.map((i) => [
      i.nombre,
      i.unidad_medida,
      conCosto(i.costo_unitario),
      i.cantidad_comprada,
      conCosto(i.total_compras),
      i.cantidad_merma,
      conCosto(i.total_merma)
    ])
  );

  agregarSeccion(hoja, 'Totales');
  agregarDato(hoja, 'Total compras', reporte.totales.compras, FORMATO_PESOS);
  agregarDato(hoja, 'Total mermas', reporte.totales.mermas, FORMATO_PESOS);

  agregarAvisoSinCosto(hoja, reporte.insumosSinCosto);
};

const ARMADORES = {
  resumen: armarResumen,
  productos: armarProductos,
  inventario: armarInventario
};

// Devuelve el .xlsx en memoria; los errores de validación (DATOS_INVALIDOS) vienen de generarReporte
const generarExcel = async (tipo, desde, hasta) => {
  const reporte = await generarReporte(tipo, desde, hasta);

  const libro = new ExcelJS.Workbook();
  libro.creator = 'Restaurante MariaConchita';
  libro.created = new Date();

  const hoja = libro.addWorksheet(NOMBRES_HOJA[tipo]);
  agregarTitulo(hoja, NOMBRES_HOJA[tipo], desde, hasta);

  if (!reporte.hayDatos) {
    hoja.addRow([]);
    hoja.addRow(['Sin datos en el rango seleccionado']);
  } else {
    ARMADORES[tipo](hoja, reporte);
  }

  return libro.xlsx.writeBuffer();
};

module.exports = { generarExcel };