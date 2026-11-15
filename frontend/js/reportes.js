/* ==========================================================================
   reportes.js — Módulo de Reportes (solo reportes.html): genera el reporte de
   la pestaña activa, lo dibuja y lo exporta (PDF con window.print, Excel .xlsx).
   Depende de config.js, sesion.js, api.js y ui.js; se carga antes de admin.js.
   ========================================================================== */

const reportesGenerados = {}; // por tipo: { desde, hasta } del último reporte dibujado

// Panel donde se dibuja cada tipo de reporte
const PANEL_REPORTE = {
  resumen: 'panel-resumen',
  productos: 'panel-productos-top',
  inventario: 'panel-inventario'
};

const formatearPesos = (valor) =>
  Number(valor).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const formatearUnidades = (valor) =>
  Number(valor).toLocaleString('es-CO', { maximumFractionDigits: 3 });

// AAAA-MM-DD → DD/MM/AAAA
const formatearDia = (dia) => String(dia).split('-').reverse().join('/');

// AAAA-MM-DD con la hora local (toISOString usaría UTC y en Bogotá después de las 7 p. m. daría el día siguiente)
const formatearFechaLocal = (fecha) => {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
};

// Pesos o, si el backend envía null (insumo sin costo), una insignia "Sin costo"
const pesosOSinCosto = (valor) =>
  valor === null ? '<span class="insignia insignia--alerta">Sin costo</span>' : formatearPesos(valor);

// Pestaña activa → tipo de reporte (resumen, productos o inventario)
const obtenerTipoActivo = () =>
  document.querySelector('.pestana.activa[data-tipo-reporte]').dataset.tipoReporte;

/* ---------- Piezas de HTML (los textos de la BD se escapan al armar las filas) ---------- */

const construirTabla = (columnas, filas) => `
  <div class="tabla-envoltorio">
    <table class="tabla">
      <thead><tr>${columnas.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${filas.map((fila) => `<tr>${fila.map((celda) => `<td>${celda}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </div>`;

const construirTarjeta = (titulo, contenido) => `
  <div class="tarjeta">
    <div class="tarjeta__encabezado">
      <h2 class="tarjeta__encabezado-titulo">${escaparHtml(titulo)}</h2>
    </div>
    ${contenido}
  </div>`;

const envolverResultado = (contenido) => `<div style="display:grid; gap:16px;">${contenido}</div>`;

// Aviso arriba del reporte: los insumos sin costo cuentan como $0 y la ganancia puede estar inflada
const construirAvisoSinCosto = (insumosSinCosto) => {
  if (!insumosSinCosto || insumosSinCosto.length === 0) return '';
  return `
    <div class="tarjeta">
      <div class="tarjeta__cuerpo">
        <span class="insignia insignia--alerta">Aviso</span>
        Estos insumos no tienen costo y cuentan como $0 en los totales, por lo que la ganancia
        puede estar sobrestimada: ${insumosSinCosto.map(escaparHtml).join(', ')}.
      </div>
    </div>`;
};

const renderizarSinDatos = (reporte) => `
  <div class="tarjeta">
    <div class="estado-vacio">
      <h2 class="estado-vacio__titulo">Sin datos en el rango</h2>
      <p class="estado-vacio__texto">No hay registros entre ${escaparHtml(formatearDia(reporte.desde))} y ${escaparHtml(formatearDia(reporte.hasta))}. Prueba con otras fechas.</p>
    </div>
  </div>`;

/* ---------- Un renderizador por tipo de reporte ---------- */

const renderizarResumen = (reporte) => {
  const periodo = `${formatearDia(reporte.desde)} a ${formatearDia(reporte.hasta)}`;

  const indicadores = construirTabla(['Indicador', 'Valor'], [
    ['Pedidos', formatearUnidades(reporte.ventas.pedidos)],
    ['Ventas', formatearPesos(reporte.ventas.total)],
    ['Ingresos', formatearPesos(reporte.ingresos.total)],
    ['Egresos', formatearPesos(reporte.egresos.total)],
    ['Pérdidas por mermas', formatearPesos(reporte.perdidas.total)],
    ['<strong>Ganancia</strong>', `<strong>${formatearPesos(reporte.ganancia)}</strong>`]
  ]);

  const ventasPorDia = construirTabla(['Día', 'Pedidos', 'Total'],
    reporte.ventasPorDia.map((d) => [formatearDia(d.dia), formatearUnidades(d.pedidos), formatearPesos(d.total)]));

  const porMetodo = construirTabla(['Método', 'Pagos', 'Total'],
    reporte.ingresos.porMetodo.map((m) => [escaparHtml(m.metodo), formatearUnidades(m.pagos), formatearPesos(m.total)]));

  const egresos = construirTabla(['Concepto', 'Total'], [
    ...reporte.egresos.conceptos.map((c) => [escaparHtml(c.concepto), formatearPesos(c.total)]),
    ['<strong>Total egresos</strong>', `<strong>${formatearPesos(reporte.egresos.total)}</strong>`]
  ]);

  return envolverResultado(
    construirAvisoSinCosto(reporte.insumosSinCosto) +
    construirTarjeta(`Resumen general · ${periodo}`, indicadores) +
    construirTarjeta('Ventas por día', ventasPorDia) +
    construirTarjeta('Ingresos por método de pago', porMetodo) +
    construirTarjeta('Egresos', egresos)
  );
};

const renderizarProductos = (reporte) => {
  const periodo = `${formatearDia(reporte.desde)} a ${formatearDia(reporte.hasta)}`;
  const ranking = construirTabla(['#', 'Producto', 'Unidades', 'Total vendido'],
    reporte.productos.map((p, i) => [i + 1, escaparHtml(p.nombre), formatearUnidades(p.unidades), formatearPesos(p.total)]));

  return envolverResultado(construirTarjeta(`Productos más vendidos · ${periodo}`, ranking));
};

const renderizarInventario = (reporte) => {
  const periodo = `${formatearDia(reporte.desde)} a ${formatearDia(reporte.hasta)}`;

  const insumos = construirTabla(
    ['Insumo', 'Unidad', 'Costo unitario', 'Cant. comprada', 'Total compras', 'Cant. merma', 'Total merma'],
    reporte.insumos.map((i) => [
      escaparHtml(i.nombre),
      escaparHtml(i.unidad_medida),
      pesosOSinCosto(i.costo_unitario),
      formatearUnidades(i.cantidad_comprada),
      pesosOSinCosto(i.total_compras),
      formatearUnidades(i.cantidad_merma),
      pesosOSinCosto(i.total_merma)
    ]));

  const totales = construirTabla(['Concepto', 'Total'], [
    ['Total compras', formatearPesos(reporte.totales.compras)],
    ['Total mermas', formatearPesos(reporte.totales.mermas)]
  ]);

  return envolverResultado(
    construirAvisoSinCosto(reporte.insumosSinCosto) +
    construirTarjeta(`Compras y mermas · ${periodo}`, insumos) +
    construirTarjeta('Totales', totales)
  );
};

const RENDERIZADORES = {
  resumen: renderizarResumen,
  productos: renderizarProductos,
  inventario: renderizarInventario
};

/* ---------- Generar ---------- */

// Pide el reporte de la pestaña activa con las fechas del filtro y lo dibuja en su panel
async function generarReporte() {
  const desde = document.getElementById('rep-desde').value;
  const hasta = document.getElementById('rep-hasta').value;

  // Validaciones rápidas para avisar sin ir al servidor (el backend vuelve a validar)
  if (!desde || !hasta) return mostrarNotificacion('Selecciona las dos fechas');
  if (desde > hasta) return mostrarNotificacion('La fecha inicial no puede ser posterior a la final');

  const tipo = obtenerTipoActivo(); // se fija antes del await por si cambia de pestaña mientras responde
  const boton = document.getElementById('btn-generar-reporte');
  boton.disabled = true; // evita doble envío mientras responde el servidor
  try {
    const reporte = await peticionApi(`/reportes/${tipo}?desde=${desde}&hasta=${hasta}`);
    const panel = document.getElementById(PANEL_REPORTE[tipo]);
    panel.innerHTML = reporte.hayDatos ? RENDERIZADORES[tipo](reporte) : renderizarSinDatos(reporte);
    reportesGenerados[tipo] = { desde, hasta };
  } catch (error) {
    // El mensaje ya se muestra dentro de peticionApi
  } finally {
    boton.disabled = false;
  }
}

/* ---------- Exportar ---------- */

// peticionApi solo lee JSON y un enlace directo no envía el token: se descarga con fetch y blob
async function descargarExcel(tipo, desde, hasta) {
  const respuesta = await fetch(`${API_URL}/reportes/${tipo}/excel?desde=${desde}&hasta=${hasta}`, {
    headers: obtenerHeaders()
  });

  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => ({}));
    if (respuesta.status === 401) {
      limpiarSesion();
      mostrarBloqueoSesion(datos.mensaje);
      return;
    }
    throw new Error(datos.mensaje || 'No se pudo descargar el Excel');
  }

  const url = URL.createObjectURL(await respuesta.blob());
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `reporte-${tipo}-${desde}-${hasta}.xlsx`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

// Exporta el reporte ya generado de la pestaña activa (con las fechas con que se generó)
async function exportarReporte() {
  const tipo = obtenerTipoActivo();
  const generado = reportesGenerados[tipo];
  if (!generado) return mostrarNotificacion('Genera primero el reporte');

  const formato = document.querySelector('input[name="formato"]:checked').value;
  if (formato === 'pdf') return window.print();

  const boton = document.getElementById('btn-exportar-reporte');
  boton.disabled = true;
  try {
    await descargarExcel(tipo, generado.desde, generado.hasta);
  } catch (error) {
    mostrarNotificacion(error.message || 'No se pudo descargar el Excel');
  } finally {
    boton.disabled = false;
  }
}

/* ---------- Punto de entrada ---------- */

function inicializarReportes() {
  if (!document.getElementById('panel-resumen')) return; // solo actúa en reportes.html

  // Por defecto: del día 1 del mes actual a hoy
  const hoy = new Date();
  document.getElementById('rep-desde').value = formatearFechaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  document.getElementById('rep-hasta').value = formatearFechaLocal(hoy);

  document.getElementById('btn-generar-reporte').addEventListener('click', generarReporte);
  document.getElementById('btn-exportar-reporte').addEventListener('click', exportarReporte);
}