// Constantes de negocio del backend

// Costo fijo de envío de un pedido a domicilio (en pesos).
// Se copia a Domicilio.costo_envio al crear el pedido, así un cambio futuro no altera pedidos anteriores
const COSTO_ENVIO_DOMICILIO = 2000;

module.exports = { COSTO_ENVIO_DOMICILIO };