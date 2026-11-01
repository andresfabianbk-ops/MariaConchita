/* ==========================================================================
   api.js — Conexión con el backend: notificaciones y wrapper de fetch.
   Cargar después de config.js y sesion.js. Lo usan todas las páginas web.
   ========================================================================== */

// Muestra una notificación simple (éxito o error), usando la paleta de marca
function mostrarNotificacion(mensaje, tipo = 'error') {
  const notificacion = document.createElement('div');
  notificacion.textContent = mensaje;
  notificacion.style.cssText = `
    position: fixed; top: var(--esp-5); right: var(--esp-5); z-index: 9999;
    padding: var(--esp-3) var(--esp-5); border-radius: var(--radio-m);
    font-family: var(--fuente-cuerpo); font-size: 0.9rem;
    box-shadow: var(--sombra-modal);
    color: ${tipo === 'exito' ? 'var(--exito)' : 'var(--peligro)'};
    background: ${tipo === 'exito' ? 'var(--exito-fondo)' : 'var(--peligro-fondo)'};
    border: 1px solid ${tipo === 'exito' ? 'var(--exito)' : 'var(--peligro)'};
  `;
  document.body.appendChild(notificacion);
  setTimeout(() => notificacion.remove(), 3500);
}

// Wrapper de fetch: maneja token, parseo de JSON y errores del backend de forma centralizada
async function peticionApi(ruta, opciones = {}) {
  try {
    const respuesta = await fetch(`${API_URL}${ruta}`, {
      ...opciones,
      headers: obtenerHeaders()
    });
    const datos = await respuesta.json().catch(() => ({}));

    if (respuesta.status === 401) {
      limpiarSesion();
      mostrarBloqueoSesion(datos.mensaje || 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.');
      const errorSesion = new Error('Sesión no válida');
      errorSesion.sesionInvalida = true; // marca para no mostrar además el aviso rojo
      throw errorSesion;
    }

    if (!respuesta.ok) {
      throw new Error(datos.mensaje || 'Ocurrió un error inesperado');
    }

    return datos;
  } catch (error) {
    if (!error.sesionInvalida) mostrarNotificacion(error.message, 'error'); // el bloqueo de sesión ya informó
    throw error; // se re-lanza para que quien llamó decida si detener su flujo
  }
}