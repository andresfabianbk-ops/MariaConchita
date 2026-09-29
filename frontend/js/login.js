// Valida el login y redirige según el cargo del empleado
const iniciarSesion = async (evento) => {
  evento.preventDefault();

  const correo = document.getElementById('correo').value;
  const contrasena = document.getElementById('contrasena').value;

  try {
    const respuesta = await fetch(`${API_URL}/empleados/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, contrasena })
    });

    const datos = await respuesta.json();

    if (!respuesta.ok) {
      alert(datos.error || 'Credenciales inválidas');
      return;
    }

    // Guarda el token para futuras peticiones autenticadas
    localStorage.setItem('token', datos.token);
    localStorage.setItem('empleado', JSON.stringify(datos.empleado));

    // Redirige según el cargo del empleado
    switch (datos.empleado.cargo) {
      case 'Cajero':
        window.location.href = 'pages/caja.html';
        break;
      case 'Cocinero':
        window.location.href = 'pages/cocina.html';
        break;
      case 'Administrador':
        window.location.href = 'pages/admin/dashboard.html';
        break;
      case 'Mesero':
        alert('El Mesero debe iniciar sesión desde la app Android');
        break;
      default:
        alert('Rol no reconocido');
    }
  } catch (error) {
    alert('Error de conexión con el servidor');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const formLogin = document.getElementById('form-login');
  if (formLogin) formLogin.addEventListener('submit', iniciarSesion);
});