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

// Indica cómo recuperar la contraseña (no hay recuperación por correo en esta versión)
const mostrarAyudaContrasena = (evento) => {
  evento.preventDefault();
  mostrarAvisoLogin('Pide a un Administrador que restablezca tu contraseña desde Empleados. Si eres el Administrador, contacta a quien administra el servidor.');
};

const iniciarSesion = async (evento) => {
  evento.preventDefault();
  ocultarAvisoLogin();

  const correo = document.getElementById('correo').value.trim();
  const contrasena = document.getElementById('contrasena').value.trim();

  try {
    const recordar = document.getElementById('recordar').checked;
    const urlInicio = await autenticarEmpleado(correo, contrasena, recordar); // guarda la sesión solo si el cargo entra al panel
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
    const enlaceRecuperar = document.querySelector('.link-recuperar');
    if (enlaceRecuperar) enlaceRecuperar.addEventListener('click', mostrarAyudaContrasena);
  }
});