// Registra un nuevo empleado desde el formulario
const registrarEmpleado = async (evento) => {
  evento.preventDefault();

  const datosEmpleado = {
    tipoDocumento: document.getElementById('tipoDocumento').value,
    numeroDocumento: document.getElementById('numeroDocumento').value,
    nombres: document.getElementById('nombres').value,
    apellidos: document.getElementById('apellidos').value,
    fechaNacimiento: document.getElementById('fechaNacimiento').value,
    correo: document.getElementById('correo').value,
    celular: document.getElementById('celular').value,
    cargo: document.getElementById('cargo').value,
    contrasena: document.getElementById('contrasena').value
  };

  try {
    const respuesta = await fetch(`${API_URL}/empleados`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datosEmpleado)
    });

    if (!respuesta.ok) {
      const error = await respuesta.json();
      throw new Error(error.error);
    }

    alert('Empleado registrado correctamente');
    document.getElementById('form-registro').reset();
  } catch (error) {
    alert(error.message);
  }
};

// Alterna la visibilidad del campo de contraseña en el registro
const inicializarToggleContrasena = () => {
  const toggle = document.getElementById('toggle-contrasena');
  const input = document.getElementById('contrasena');
  if (!toggle || !input) return;

  toggle.addEventListener('click', () => {
    const esPassword = input.type === 'password';
    input.type = esPassword ? 'text' : 'password';
    toggle.textContent = esPassword ? '🙈' : '👁';
  });
};

document.addEventListener('DOMContentLoaded', () => {
  inicializarToggleContrasena();

  const formRegistro = document.getElementById('form-registro');
  if (formRegistro) formRegistro.addEventListener('submit', registrarEmpleado);
});
