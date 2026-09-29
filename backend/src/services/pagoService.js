//Importa las funciones del repositorio de pagos
const { guardarPago, obtenerPagos } = require('../repositories/pagoRepository');

// Logica de nogocio: registra un pago con validacion basica

const registrarPago = (datosPago) => {
    if (!datosPago.valor || datosPago.valor <= 0) {
        throw new Error('El valor del pago debe ser mayor a cero');
    }
    if (!datosPago.metodo){
        throw new Error('Debe especificar el metodo de pago');
    }
    return awaitguardarPago(datosPago);
};

// logica de negocio: obtiene todos los pagos registrados
const listarPagos = async () => {
    return obtenerPagos();
}; 

module.exports = { registrarPago, listarPagos };
