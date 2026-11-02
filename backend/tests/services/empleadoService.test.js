// Pruebas unitarias de empleadoService: repository, bcrypt y jwt se simulan
jest.mock('../../src/repositories/empleadoRepository', () => ({
  guardarEmpleado: jest.fn(),
  obtenerEmpleados: jest.fn(),
  buscarPorCorreo: jest.fn(),
  obtenerEmpleadoPorId: jest.fn(),
  actualizarEmpleado: jest.fn(),
  cambiarEstadoEmpleado: jest.fn(),
  reiniciarCierresVacios: jest.fn(),
  actualizarContrasena: jest.fn(),
  existeCorreoDuplicado: jest.fn(),
  contarEmpleados: jest.fn(),
  existeDocumentoDuplicado: jest.fn(),
  registrarIntentoFallido: jest.fn(),
  reiniciarIntentosFallidos: jest.fn(),
  contarOtrosAdministradoresActivos: jest.fn()
}));
jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));
jest.mock('jsonwebtoken', () => ({ sign: jest.fn() }));

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const repo = require('../../src/repositories/empleadoRepository');
const {
  crearEmpleado,
  listarEmpleados,
  iniciarSesion,
  editarEmpleado,
  bloquearEmpleado,
  activarEmpleado,
  cambiarContrasena
} = require('../../src/services/empleadoService');

process.env.JWT_SECRET = 'secreto-de-prueba';

// Fecha AAAA-MM-DD con N años menos que hoy (los tests no caducan)
const fechaHaceAnios = (anios) => {
  const hoy = new Date();
  const f = new Date(hoy.getFullYear() - anios, hoy.getMonth(), hoy.getDate());
  const mm = String(f.getMonth() + 1).padStart(2, '0');
  const dd = String(f.getDate()).padStart(2, '0');
  return `${f.getFullYear()}-${mm}-${dd}`;
};

// Datos válidos de creación (objeto nuevo en cada llamada porque el service lo modifica)
const datosValidos = () => ({
  tipoDocumento: 'CC',
  numeroDocumento: '1234567',
  nombres: 'Juan',
  apellidos: 'Perez',
  fechaNacimiento: fechaHaceAnios(30),
  correo: 'juan@correo.com',
  celular: '3001234567',
  contrasena: 'clave123',
  cargo: 'Cajero'
});

beforeEach(() => {
  jest.resetAllMocks();
});

describe('crearEmpleado', () => {
  test('1. sin empleados registrados, el primero se guarda como Administrador', async () => {
    repo.contarEmpleados.mockResolvedValue(0);
    repo.existeCorreoDuplicado.mockResolvedValue(false);
    repo.existeDocumentoDuplicado.mockResolvedValue(false);
    bcrypt.hash.mockResolvedValue('hash123');
    repo.guardarEmpleado.mockResolvedValue({ id_usuario: 1, cargo: 'Administrador', contrasena: 'hash123' });

    const datos = datosValidos();
    datos.cargo = 'Mesero';
    await crearEmpleado(datos);

    expect(repo.guardarEmpleado).toHaveBeenCalledWith(expect.objectContaining({ cargo: 'Administrador' }));
  });

  test('2. tipo de documento inválido lanza DATOS_INVALIDOS', async () => {
    repo.contarEmpleados.mockResolvedValue(1);
    const datos = { ...datosValidos(), tipoDocumento: 'TI' };

    await expect(crearEmpleado(datos)).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    expect(repo.guardarEmpleado).not.toHaveBeenCalled();
  });

  test('3. menor de 18 años lanza DATOS_INVALIDOS', async () => {
    repo.contarEmpleados.mockResolvedValue(1);
    const datos = { ...datosValidos(), fechaNacimiento: fechaHaceAnios(10) };

    await expect(crearEmpleado(datos)).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    expect(repo.guardarEmpleado).not.toHaveBeenCalled();
  });

  test('4. contraseña de menos de 6 caracteres lanza DATOS_INVALIDOS', async () => {
    repo.contarEmpleados.mockResolvedValue(1);
    const datos = { ...datosValidos(), contrasena: '123' };

    await expect(crearEmpleado(datos)).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    expect(repo.guardarEmpleado).not.toHaveBeenCalled();
  });

  test('5. correo ya existente lanza DUPLICADO', async () => {
    repo.contarEmpleados.mockResolvedValue(1);
    repo.existeCorreoDuplicado.mockResolvedValue(true);

    await expect(crearEmpleado(datosValidos())).rejects.toMatchObject({ codigo: 'DUPLICADO' });
    expect(repo.guardarEmpleado).not.toHaveBeenCalled();
  });

  test('6. documento ya existente lanza DUPLICADO', async () => {
    repo.contarEmpleados.mockResolvedValue(1);
    repo.existeCorreoDuplicado.mockResolvedValue(false);
    repo.existeDocumentoDuplicado.mockResolvedValue(true);

    await expect(crearEmpleado(datosValidos())).rejects.toMatchObject({ codigo: 'DUPLICADO' });
    expect(repo.guardarEmpleado).not.toHaveBeenCalled();
  });

  test('7. datos válidos guardan el hash y la respuesta no trae contrasena', async () => {
    repo.contarEmpleados.mockResolvedValue(1);
    repo.existeCorreoDuplicado.mockResolvedValue(false);
    repo.existeDocumentoDuplicado.mockResolvedValue(false);
    bcrypt.hash.mockResolvedValue('hash123');
    repo.guardarEmpleado.mockResolvedValue({ id_usuario: 2, nombres: 'Juan', contrasena: 'hash123' });

    const resultado = await crearEmpleado(datosValidos());

    expect(bcrypt.hash).toHaveBeenCalledWith('clave123', 10);
    expect(repo.guardarEmpleado).toHaveBeenCalledWith(expect.objectContaining({ contrasena: 'hash123' }));
    expect(resultado).not.toHaveProperty('contrasena');
    expect(resultado.id_usuario).toBe(2);
  });
});

describe('listarEmpleados', () => {
  test('8. ningún empleado de la lista trae contrasena', async () => {
    repo.obtenerEmpleados.mockResolvedValue([
      { id_usuario: 1, nombres: 'Ana', contrasena: 'h1' },
      { id_usuario: 2, nombres: 'Luis', contrasena: 'h2' }
    ]);

    const lista = await listarEmpleados();

    expect(lista).toHaveLength(2);
    lista.forEach((e) => expect(e).not.toHaveProperty('contrasena'));
  });
});

describe('iniciarSesion', () => {
  const empleadoActivo = (cargo = 'Cajero') => ({
    id_usuario: 5,
    cargo,
    estado: 'Activo',
    contrasena: 'hashGuardado'
  });

  test('9. falta correo o contraseña lanza DATOS_INVALIDOS', async () => {
    await expect(iniciarSesion('', 'x')).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    await expect(iniciarSesion('a@b.com', '')).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    expect(repo.buscarPorCorreo).not.toHaveBeenCalled();
  });

  test('10. correo inexistente lanza NO_AUTORIZADO', async () => {
    repo.buscarPorCorreo.mockResolvedValue(null);

    await expect(iniciarSesion('a@b.com', 'x')).rejects.toMatchObject({ codigo: 'NO_AUTORIZADO' });
  });

  test('11. cuenta Bloqueado lanza NO_AUTORIZADO con mensaje de bloqueo', async () => {
    repo.buscarPorCorreo.mockResolvedValue({ ...empleadoActivo(), estado: 'Bloqueado' });

    await expect(iniciarSesion('a@b.com', 'x')).rejects.toMatchObject({
      codigo: 'NO_AUTORIZADO',
      message: expect.stringContaining('bloqueada')
    });
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  test('12. clave incorrecta en el 1.er intento no bloquea la cuenta', async () => {
    repo.buscarPorCorreo.mockResolvedValue(empleadoActivo());
    bcrypt.compare.mockResolvedValue(false);
    repo.registrarIntentoFallido.mockResolvedValue(1);

    await expect(iniciarSesion('a@b.com', 'mala')).rejects.toMatchObject({ codigo: 'NO_AUTORIZADO' });
    expect(repo.cambiarEstadoEmpleado).not.toHaveBeenCalled();
  });

  test('13. 3.er intento fallido de un Cajero bloquea la cuenta', async () => {
    repo.buscarPorCorreo.mockResolvedValue(empleadoActivo('Cajero'));
    bcrypt.compare.mockResolvedValue(false);
    repo.registrarIntentoFallido.mockResolvedValue(3);

    await expect(iniciarSesion('a@b.com', 'mala')).rejects.toMatchObject({ codigo: 'NO_AUTORIZADO' });
    expect(repo.cambiarEstadoEmpleado).toHaveBeenCalledWith(5, 'Bloqueado');
  });

  test('14. 3.er intento fallido del único Administrador no lo bloquea', async () => {
    repo.buscarPorCorreo.mockResolvedValue(empleadoActivo('Administrador'));
    bcrypt.compare.mockResolvedValue(false);
    repo.registrarIntentoFallido.mockResolvedValue(3);
    repo.contarOtrosAdministradoresActivos.mockResolvedValue(0);

    await expect(iniciarSesion('a@b.com', 'mala')).rejects.toMatchObject({
      codigo: 'NO_AUTORIZADO',
      message: 'Credenciales inválidas'
    });
    expect(repo.cambiarEstadoEmpleado).not.toHaveBeenCalled();
  });

  test('15. credenciales correctas devuelven token y empleado sin hash', async () => {
    repo.buscarPorCorreo.mockResolvedValue(empleadoActivo('Cajero'));
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue('token-falso');

    const resultado = await iniciarSesion('a@b.com', 'correcta');

    expect(repo.reiniciarIntentosFallidos).toHaveBeenCalledWith(5);
    expect(jwt.sign).toHaveBeenCalledWith(
      { id_usuario: 5, cargo: 'Cajero' },
      'secreto-de-prueba',
      { expiresIn: '8h' }
    );
    expect(resultado.token).toBe('token-falso');
    expect(resultado.empleado).not.toHaveProperty('contrasena');
  });
});

describe('editarEmpleado', () => {
  const datosEdicion = {
    nombres: 'Juan',
    apellidos: 'Perez',
    correo: 'juan@correo.com',
    celular: '3001234567',
    cargo: 'Cajero'
  };

  test('16. empleado inexistente lanza NO_ENCONTRADA', async () => {
    repo.obtenerEmpleadoPorId.mockResolvedValue(null);

    await expect(editarEmpleado(1, datosEdicion, 2)).rejects.toMatchObject({ codigo: 'NO_ENCONTRADA' });
    expect(repo.actualizarEmpleado).not.toHaveBeenCalled();
  });

  test('17. correo de otro empleado lanza DUPLICADO', async () => {
    repo.obtenerEmpleadoPorId.mockResolvedValue({ id_usuario: 1 });
    repo.existeCorreoDuplicado.mockResolvedValue(true);

    await expect(editarEmpleado(1, datosEdicion, 2)).rejects.toMatchObject({ codigo: 'DUPLICADO' });
    expect(repo.actualizarEmpleado).not.toHaveBeenCalled();
  });
});

describe('bloquearEmpleado', () => {
  test('18. bloquearse a sí mismo lanza OPERACION_NO_PERMITIDA', async () => {
    await expect(bloquearEmpleado(3, 3)).rejects.toMatchObject({ codigo: 'OPERACION_NO_PERMITIDA' });
    await expect(bloquearEmpleado('3', 3)).rejects.toMatchObject({ codigo: 'OPERACION_NO_PERMITIDA' });
    expect(repo.cambiarEstadoEmpleado).not.toHaveBeenCalled();
  });

  test('19. empleado inexistente lanza NO_ENCONTRADA', async () => {
    repo.obtenerEmpleadoPorId.mockResolvedValue(null);

    await expect(bloquearEmpleado(4, 3)).rejects.toMatchObject({ codigo: 'NO_ENCONTRADA' });
    expect(repo.cambiarEstadoEmpleado).not.toHaveBeenCalled();
  });
});

describe('activarEmpleado', () => {
  test('20. pone estado Activo y reinicia cierres e intentos fallidos', async () => {
    repo.obtenerEmpleadoPorId.mockResolvedValue({ id_usuario: 4 });

    const resultado = await activarEmpleado(4, 1);

    expect(repo.cambiarEstadoEmpleado).toHaveBeenCalledWith(4, 'Activo', 1);
    expect(repo.reiniciarCierresVacios).toHaveBeenCalledWith(4);
    expect(repo.reiniciarIntentosFallidos).toHaveBeenCalledWith(4);
    expect(resultado).toBe(true);
  });
});

describe('cambiarContrasena', () => {
  test('21. empleado inexistente o clave corta lanzan error con su código', async () => {
    repo.obtenerEmpleadoPorId.mockResolvedValueOnce(null);
    await expect(cambiarContrasena(1, 'clave123', 2)).rejects.toMatchObject({ codigo: 'NO_ENCONTRADA' });

    repo.obtenerEmpleadoPorId.mockResolvedValueOnce({ id_usuario: 1 });
    await expect(cambiarContrasena(1, '123', 2)).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });

    expect(repo.actualizarContrasena).not.toHaveBeenCalled();
  });

  test('22. clave válida guarda el hash y devuelve true', async () => {
    repo.obtenerEmpleadoPorId.mockResolvedValue({ id_usuario: 1 });
    bcrypt.hash.mockResolvedValue('hashNuevo');

    const resultado = await cambiarContrasena(1, 'claveNueva1', 2);

    expect(bcrypt.hash).toHaveBeenCalledWith('claveNueva1', 10);
    expect(repo.actualizarContrasena).toHaveBeenCalledWith(1, 'hashNuevo', 2);
    expect(resultado).toBe(true);
  });
});