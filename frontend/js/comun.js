// Formatea un número como precio con separador de miles (ej: 15000 -> $15.000)
const formatearPrecio = (valor) => {
  return '$' + Math.round(valor).toLocaleString('es-CO');
};

// Calcula el total de un pedido sumando sus productos
const calcularTotalPedido = (pedido) => {
  return pedido.productos.reduce((total, p) => total + (p.precio * p.cantidad), 0);
};

// Filtros de escritura: data-solo-digitos (documento, celular) y data-solo-letras (nombres, apellidos)
document.addEventListener('input', (evento) => {
  const campo = evento.target;
  if (campo.matches('[data-solo-digitos]')) {
    campo.value = campo.value.replace(/\D/g, '');
  }
  if (campo.matches('[data-solo-letras]')) {
    campo.value = campo.value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'-]/g, ''); // letras, tildes, ñ, espacios, apóstrofe y guion
  }
});