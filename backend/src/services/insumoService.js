// Servicio de insumos: valida los datos y delega en el repositorio
const {
  obtenerInsumos,
  registrarMovimiento,
  crearInsumo,
  actualizarInsumo
} = require('../repositories/insumoRepository');

// Crea un error de negocio con .codigo (traducido a HTTP en el controller)
const crearError = (codigo, mensaje) => {
  const error = new Error(mensaje);
  error.codigo = codigo;
  return error;
};

const TIPOS_MANUALES = ['Entrada', 'Salida por merma'];
const CANTIDAD_MAXIMA = 9999999.999; // límite de DECIMAL(10,3)
const MOTIVO_MAXIMO = 150;           // VARCHAR(150) en MovimientoInventario

// Lista los insumos con su nivel de stock
const listarInsumos = async () => obtenerInsumos();

// Valida y registra una entrada o una merma manual
const registrarMovimientoInsumo = async ({ idInsumo, tipo, cantidad, motivo } = {}) => {
  const id = Number(idInsumo);
  if (!Number.isInteger(id) || id <= 0) {
    throw crearError('DATOS_INVALIDOS', 'El id del insumo no es válido');
  }

  if (!TIPOS_MANUALES.includes(tipo)) {
    throw crearError('DATOS_INVALIDOS', "El tipo debe ser 'Entrada' o 'Salida por merma'");
  }

  if (cantidad === undefined || cantidad === null || cantidad === '' || typeof cantidad === 'boolean') {
    throw crearError('DATOS_INVALIDOS', 'La cantidad es obligatoria');
  }
  const numero = Number(cantidad);
  const cantidadValida =
    Number.isFinite(numero) &&
    numero > 0 &&
    numero <= CANTIDAD_MAXIMA &&
    Math.round(numero * 1000) / 1000 === numero;
  if (!cantidadValida) {
    throw crearError('DATOS_INVALIDOS', 'La cantidad debe ser un número mayor que 0, con máximo 3 decimales');
  }

  if (motivo !== undefined && motivo !== null && typeof motivo !== 'string') {
    throw crearError('DATOS_INVALIDOS', 'El motivo debe ser texto');
  }
  const motivoLimpio = typeof motivo === 'string' ? motivo.trim() : '';
  if (tipo === 'Salida por merma' && motivoLimpio === '') {
    throw crearError('DATOS_INVALIDOS', 'El motivo es obligatorio en una merma');
  }
  if (motivoLimpio.length > MOTIVO_MAXIMO) {
    throw crearError('DATOS_INVALIDOS', `El motivo no puede superar ${MOTIVO_MAXIMO} caracteres`);
  }

  return registrarMovimiento({
    idInsumo: id,
    tipo,
    cantidad: numero,
    motivo: motivoLimpio === '' ? null : motivoLimpio
  });
};

const UNIDADES_PERMITIDAS = ['g', 'litro', 'ml', 'unidad']; // kg no se usa (decisión 6)
const NOMBRE_MAXIMO = 100;           // VARCHAR(100) en Insumo
const COSTO_MAXIMO = 99999999.99;    // límite de DECIMAL(10,2)

// Valida un número >= 0 con un máximo y una cantidad de decimales
const convertirNumero = (valor, nombreCampo, maximo, decimales) => {
  if (typeof valor === 'boolean' || valor === undefined || valor === null || valor === '') {
    throw crearError('DATOS_INVALIDOS', `${nombreCampo} es obligatorio`);
  }
  const numero = Number(valor);
  const factor = 10 ** decimales;
  const esValido =
    Number.isFinite(numero) &&
    numero >= 0 &&
    numero <= maximo &&
    Math.round(numero * factor) / factor === numero;
  if (!esValido) {
    throw crearError(
      'DATOS_INVALIDOS',
      `${nombreCampo} debe ser un número mayor o igual a 0, con máximo ${decimales} decimales`
    );
  }
  return numero;
};

// Valida y normaliza los datos de un insumo (sirve para crear y para editar)
const validarDatosInsumo = ({ nombre, unidadMedida, stockMinimo, costoUnitario } = {}) => {
  const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
  if (nombreLimpio === '') {
    throw crearError('DATOS_INVALIDOS', 'El nombre es obligatorio');
  }
  if (nombreLimpio.length > NOMBRE_MAXIMO) {
    throw crearError('DATOS_INVALIDOS', `El nombre no puede superar ${NOMBRE_MAXIMO} caracteres`);
  }

  if (!UNIDADES_PERMITIDAS.includes(unidadMedida)) {
    throw crearError('DATOS_INVALIDOS', `La unidad debe ser una de: ${UNIDADES_PERMITIDAS.join(', ')}`);
  }

  const minimo = convertirNumero(stockMinimo, 'El stock mínimo', CANTIDAD_MAXIMA, 3);

  // El costo es opcional: vacío se guarda como NULL
  const costo = (costoUnitario === undefined || costoUnitario === null || costoUnitario === '')
    ? null
    : convertirNumero(costoUnitario, 'El costo', COSTO_MAXIMO, 2);

  return { nombre: nombreLimpio, unidadMedida, stockMinimo: minimo, costoUnitario: costo };
};

// Crea un insumo nuevo (stock 0; el stock se carga con una Entrada)
const crearInsumoNuevo = async (datos) => crearInsumo(validarDatosInsumo(datos));

// Edita un insumo existente
const editarInsumo = async ({ idInsumo, ...datos } = {}) => {
  const id = Number(idInsumo);
  if (!Number.isInteger(id) || id <= 0) {
    throw crearError('DATOS_INVALIDOS', 'El id del insumo no es válido');
  }
  return actualizarInsumo(id, validarDatosInsumo(datos));
};

module.exports = { listarInsumos, registrarMovimientoInsumo, crearInsumoNuevo, editarInsumo };