// Valida el login y redirige según el cargo del empleado

// Muestra un mensaje de error en línea dentro de la tarjeta de login
const mostrarAvisoLogin = (mensaje) => {
  const aviso = document.getElementById('aviso-login');
  aviso.textContent = mensaje;
  aviso.hidden = false;
};

// Oculta el aviso de error del login
const ocultarAvisoLogin = () => {
  const aviso = document.getElementById('aviso-login');
  aviso.hidden = true;
  aviso.textContent = '';
};

const iniciarSesion = async (evento) => {
  evento.preventDefault();
  ocultarAvisoLogin();

  const correo = document.getElementById('correo').value;
  const contrasena = document.getElementById('contrasena').value;

  try {
    const urlInicio = await autenticarEmpleado(correo, contrasena); // guarda la sesión solo si el cargo entra al panel
    window.location.href = urlInicio;
  } catch (error) {
    mostrarAvisoLogin(error.message);
  }
};
document.addEventListener('DOMContentLoaded', () => {
  const formLogin = document.getElementById('form-login');
  if (formLogin) {
    formLogin.addEventListener('submit', iniciarSesion);
    formLogin.addEventListener('reset', ocultarAvisoLogin);
  }
});