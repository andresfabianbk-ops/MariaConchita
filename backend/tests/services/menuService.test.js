// Pruebas unitarias de menuService: el repositorio se simula, no se usa MySQL
jest.mock('../../src/repositories/menuRepository', () => ({
  obtenerCategoriasConProductos: jest.fn(),
  obtenerIngredientesPorProducto: jest.fn(),
  crearProducto: jest.fn(),
  obtenerProductoPorId: jest.fn(),
  actualizarProducto: jest.fn(),
  desactivarProducto: jest.fn(),
  listarProductosAdmin: jest.fn()
}));

const repo = require('../../src/repositories/menuRepository');
const {
  obtenerMenuCompleto,
  registrarProducto,
  editarProducto,
  eliminarProducto
} = require('../../src/services/menuService');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('obtenerMenuCompleto', () => {
  test('1. agrupa productos por categoría y convierte es_excluible a booleano', async () => {
    repo.obtenerCategoriasConProductos.mockResolvedValue({
      categorias: [{ id_categoria: 1, nombre: 'Platos' }],
      productos: [{ id: 10, nombre: 'Bandeja', precio: '25000.00', id_categoria: 1 }]
    });
    repo.obtenerIngredientesPorProducto.mockResolvedValue([
      { id_producto: 10, id_insumo: 5, ingrediente: 'Arroz', es_excluible: 1 }
    ]);

    const menu = await obtenerMenuCompleto();

    expect(menu).toEqual([
      {
        categoria: 'Platos',
        productos: [
          {
            id: 10,
            nombre: 'Bandeja',
            precio: '25000.00',
            ingredientes: [{ id_insumo: 5, nombre: 'Arroz', es_excluible: true }]
          }
        ]
      }
    ]);
  });

  test('2. categoría sin productos devuelve lista vacía', async () => {
    repo.obtenerCategoriasConProductos.mockResolvedValue({
      categorias: [{ id_categoria: 2, nombre: 'Bebidas' }],
      productos: []
    });
    repo.obtenerIngredientesPorProducto.mockResolvedValue([]);

    const menu = await obtenerMenuCompleto();

    expect(menu).toEqual([{ categoria: 'Bebidas', productos: [] }]);
  });
});

describe('registrarProducto', () => {
  test('3. nombre vacío o solo espacios lanza DATOS_INVALIDOS', async () => {
    await expect(registrarProducto('   ', 5000, 1)).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    await expect(registrarProducto('', 5000, 1)).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    expect(repo.crearProducto).not.toHaveBeenCalled();
  });

  test('4. precio 0, negativo o string lanza DATOS_INVALIDOS', async () => {
    await expect(registrarProducto('Sopa', 0, 1)).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    await expect(registrarProducto('Sopa', -100, 1)).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    await expect(registrarProducto('Sopa', '5000', 1)).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    expect(repo.crearProducto).not.toHaveBeenCalled();
  });

  test('5. sin id_categoria lanza DATOS_INVALIDOS', async () => {
    await expect(registrarProducto('Sopa', 5000, undefined)).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    expect(repo.crearProducto).not.toHaveBeenCalled();
  });

  test('6. datos válidos sin disponible crea con disponible true y nombre sin espacios', async () => {
    repo.crearProducto.mockResolvedValue(7);

    const resultado = await registrarProducto('  Sopa  ', 5000, 1);

    expect(repo.crearProducto).toHaveBeenCalledWith('Sopa', 5000, 1, true);
    expect(resultado).toEqual({ id_producto: 7, nombre: 'Sopa', precio: 5000, id_categoria: 1, disponible: true });
  });

  test('7. categoría inexistente (ER_NO_REFERENCED_ROW_2) lanza DATOS_INVALIDOS', async () => {
    repo.crearProducto.mockRejectedValue({ code: 'ER_NO_REFERENCED_ROW_2' });

    await expect(registrarProducto('Sopa', 5000, 99)).rejects.toMatchObject({
      codigo: 'DATOS_INVALIDOS',
      message: 'La categoría indicada no existe'
    });
  });
});

describe('editarProducto', () => {
  test('8. producto inexistente lanza NO_ENCONTRADA y no actualiza', async () => {
    repo.obtenerProductoPorId.mockResolvedValue(null);

    await expect(editarProducto(1, 'Sopa', 5000, 1, true)).rejects.toMatchObject({ codigo: 'NO_ENCONTRADA' });
    expect(repo.actualizarProducto).not.toHaveBeenCalled();
  });

  test('9. nombre vacío o precio inválido lanza DATOS_INVALIDOS', async () => {
    repo.obtenerProductoPorId.mockResolvedValue({ id_producto: 1 });

    await expect(editarProducto(1, '  ', 5000, 1, true)).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    await expect(editarProducto(1, 'Sopa', -1, 1, true)).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    expect(repo.actualizarProducto).not.toHaveBeenCalled();
  });

  test('10. datos válidos actualiza y devuelve id_producto numérico', async () => {
    repo.obtenerProductoPorId.mockResolvedValue({ id_producto: 1 });
    repo.actualizarProducto.mockResolvedValue(1);

    const resultado = await editarProducto('1', ' Sopa ', 6000, 2, false);

    expect(repo.actualizarProducto).toHaveBeenCalledWith('1', 'Sopa', 6000, 2, false);
    expect(resultado).toEqual({ id_producto: 1, nombre: 'Sopa', precio: 6000, id_categoria: 2, disponible: false });
  });
});

describe('eliminarProducto', () => {
  test('11. producto inexistente lanza NO_ENCONTRADA', async () => {
    repo.obtenerProductoPorId.mockResolvedValue(null);

    await expect(eliminarProducto(1)).rejects.toMatchObject({ codigo: 'NO_ENCONTRADA' });
    expect(repo.desactivarProducto).not.toHaveBeenCalled();
  });

  test('12. producto existente se desactiva y devuelve true', async () => {
    repo.obtenerProductoPorId.mockResolvedValue({ id_producto: 1 });
    repo.desactivarProducto.mockResolvedValue(1);

    const resultado = await eliminarProducto(1);

    expect(repo.desactivarProducto).toHaveBeenCalledWith(1);
    expect(resultado).toBe(true);
  });
});