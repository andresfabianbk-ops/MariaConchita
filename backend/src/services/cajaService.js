// Servicio de caja: valida los montos y delega en el repositorio
const {
  obtenerCajaDeHoy,
  abrirCaja,
  cerrarCaja
} = require('../repositories/cajaRepository');

// Crea un error de negocio con .codigo (traducido a HTTP en el controller)
const crearError = (codigo, mensaje) => {
  const error = new Error(mensaje);
  error.codigo = codigo;
  return error;
};

// Valida un monto de dinero: obligatorio, >= 0, máximo DECIMAL(10,2) y 2 decimales
const convertirMonto = (valor, nombreCampo) => {
  if (valor === undefined || valor === null || valor === '' || typeof valor === 'boolean') {
    throw crearError('DATOS_INVALIDOS', `${nombreCampo} es obligatorio`);
  }
  const numero = Number(valor);
  const esValido =
    Number.isFinite(numero) &&
    numero >= 0 &&
    numero <= 99999999.99 &&
    Math.round(numero * 100) / 100 === numero;
  if (!esValido) {
    throw crearError(
      'DATOS_INVALIDOS',
      `${nombreCampo} debe ser un número mayor o igual a 0, con máximo 2 decimales`
    );
  }
  return numero;
};

// Estado de la caja de hoy; si no se ha abierto devuelve { abierta: false }
const consultarCajaHoy = async () => {
  const caja = await obtenerCajaDeHoy();
  return caja || { abierta: false };
};

const abrirCajaDelDia = async ({ fondoInicial, idUsuario } = {}) => {
  const fondo = convertirMonto(fondoInicial, 'El fondo inicial');
  return abrirCaja({ fondoInicial: fondo, idUsuario });
};

const cerrarCajaDelDia = async ({ efectivoContado, idUsuario } = {}) => {
  const contado = convertirMonto(efectivoContado, 'El efectivo contado');
  return cerrarCaja({ efectivoContado: contado, idUsuario });
};

module.exports = { consultarCajaHoy, abrirCajaDelDia, cerrarCajaDelDia };