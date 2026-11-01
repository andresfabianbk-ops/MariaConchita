/* ==========================================================================
   sesion.js — Manejo de sesión del panel web. Solo define funciones, no se autoejecuta.
   Cargar después de config.js y antes de comun.js, admin.js o login.js.
   Las claves 'token' y 'empleado' de localStorage solo se tocan en este archivo.
   ========================================================================== */

const CLAVE_TOKEN = 'token';
const CLAVE_EMPLEADO = 'empleado';

// Ruta absoluta de index.html, calculada desde la URL de este script (frontend/js/sesion.js)
const URL_INDEX = new URL('../index.html', document.currentScript.src).href;

// Cargo → página de inicio (relativa a index.html). El Mesero usa solo la app Android
const PAGINA_INICIO_POR_CARGO = {
  Administrador: 'pages/admin/dashboard.html',
  Cajero: 'pages/caja.html',
  Cocinero: 'pages/cocina.html'
};

// Guarda los datos de la sesión que devuelve el login
function guardarSesion(token, empleado) {
  localStorage.setItem(CLAVE_TOKEN, token);
  localStorage.setItem(CLAVE_EMPLEADO, JSON.stringify(empleado));
}

function obtenerToken() {
  return localStorage.getItem(CLAVE_TOKEN);
}

// Devuelve el empleado guardado, o null si no hay o está dañado
function obtenerEmpleado() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_EMPLEADO));
  } catch (error) {
    return null;
  }
}

function limpiarSesion() {
  localStorage.removeItem(CLAVE_TOKEN);
  localStorage.removeItem(CLAVE_EMPLEADO);
}

// Valida credenciales en el backend y guarda la sesión solo si el cargo entra al panel web.
// Devuelve la URL de inicio del cargo; si algo falla lanza Error con el mensaje a mostrar
async function autenticarEmpleado(correo, contrasena) {
  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}/empleados/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, contrasena })
    });
  } catch (error) {
    throw new Error('Error de conexión con el servidor');
  }

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new Error(datos.mensaje || 'Ocurrió un error inesperado');
  }

  const cargo = datos.empleado?.cargo;
  if (cargo === 'Mesero') {
    throw new Error('El Mesero debe iniciar sesión desde la app Android');
  }
  const pagina = PAGINA_INICIO_POR_CARGO[cargo];
  if (!pagina) {
    throw new Error('Rol no reconocido');
  }

  guardarSesion(datos.token, datos.empleado); // solo se guarda si el cargo es válido
  return new URL(pagina, URL_INDEX).href;
}

// Cierra la sesión: borra los datos del login y vuelve al inicio de sesión
function cerrarSesion() {
  limpiarSesion();
  window.location.replace(URL_INDEX); // replace evita que la página protegida quede en el historial
}

// Conecta todos los elementos marcados con data-cerrar-sesion a cerrarSesion()
function inicializarCerrarSesion() {
  document.querySelectorAll('[data-cerrar-sesion]').forEach((enlace) => {
    enlace.addEventListener('click', (evento) => {
      evento.preventDefault();
      cerrarSesion();
    });
  });
}

// Ventana a pantalla completa que bloquea la página y obliga a volver al inicio de sesión
function mostrarBloqueoSesion(mensaje) {
  if (document.getElementById('bloqueo-sesion')) return; // evita duplicados si fallan varias peticiones a la vez

  const fondo = document.createElement('div');
  fondo.id = 'bloqueo-sesion';
  fondo.style.cssText = `
    position: fixed; inset: 0; z-index: 10000;
    display: flex; align-items: center; justify-content: center;
    background: var(--crema); font-family: var(--fuente-cuerpo);
  `;

  const caja = document.createElement('div');
  caja.style.cssText = `
    background: var(--blanco); padding: var(--esp-6); max-width: 380px;
    border-radius: var(--radio-l); box-shadow: var(--sombra-modal); text-align: center;
  `;

  const titulo = document.createElement('h2');
  titulo.textContent = 'Sesión no válida';
  titulo.style.cssText = 'font-family: var(--fuente-titulo); color: var(--negro-suave); margin-bottom: var(--esp-3);';

  const texto = document.createElement('p');
  texto.textContent = mensaje;
  texto.style.cssText = 'color: var(--gris-texto); margin-bottom: var(--esp-5);';

  const botonAceptar = document.createElement('button');
  botonAceptar.type = 'button';
  botonAceptar.textContent = 'Aceptar';
  botonAceptar.style.cssText = `
    background: var(--naranja); color: var(--blanco); border: none; cursor: pointer;
    padding: var(--esp-3) var(--esp-6); border-radius: var(--radio-m); font-weight: 600;
  `;
  botonAceptar.addEventListener('click', cerrarSesion); // limpia lo que quede y vuelve a index.html

  caja.append(titulo, texto, botonAceptar);
  fondo.appendChild(caja);
  document.body.appendChild(fondo);
  botonAceptar.focus();
}

// Devuelve true si hay sesión; si no, bloquea la página con el mensaje
function verificarSesion() {
  if (obtenerToken()) return true;
  mostrarBloqueoSesion('No has iniciado sesión. Inicia sesión para ver esta página.');
  return false;
}

// Arma los headers estándar para peticiones autenticadas
function obtenerHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${obtenerToken()}`
  };
}

// Si el navegador restaura la página desde caché (botón atrás), se vuelve a verificar
window.addEventListener('pageshow', (evento) => {
  if (evento.persisted) verificarSesion();
});