// URL base del backend
const API_URL = 'http://192.168.1.54:3000/api';

// Formatea un número como precio con separador de miles (ej: 15000 -> $15.000)
const formatearPrecio = (valor) => {
  return '$' + Math.round(valor).toLocaleString('es-CO');
};

// Calcula el total de un pedido sumando sus productos
const calcularTotalPedido = (pedido) => {
  return pedido.productos.reduce((total, p) => total + (p.precio * p.cantidad), 0);
};
