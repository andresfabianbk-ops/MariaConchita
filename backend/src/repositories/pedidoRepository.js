// Acceso a datos de pedidos (mesa y domicilio) — MySQL real vía mysql2
const db = require('../config/db');

// Busca una mesa por número; si no existe, la crea automáticamente (Ocupada por defecto)
const obtenerOCrearMesa = async (numero) => {
  const [existente] = await db.query('SELECT id_mesa FROM Mesa WHERE numero = ?', [numero]);
  if (existente.length > 0) return existente[0].id_mesa;

  const [resultado] = await db.query(
    'INSERT INTO Mesa (numero, estado) VALUES (?, "Ocupada")',
    [numero]
  );
  return resultado.insertId;
};

// Busca un cliente por teléfono; si no existe, lo crea. Devuelve el id_cliente real
const obtenerOCrearCliente = async (nombre, telefono) => {
  const [existente] = await db.query('SELECT id_cliente FROM Cliente WHERE telefono = ?', [telefono]);
  if (existente.length > 0) return existente[0].id_cliente;

  const [resultado] = await db.query(
    'INSERT INTO Cliente (nombre, telefono) VALUES (?, ?)',
    [nombre, telefono]
  );
  return resultado.insertId;
};

// Crea un pedido completo (Pedido + DetallePedido + DetalleIngredienteExcluido) en una transacción
// datosPedido: { mesa } para pedido en mesa, o { cliente: { nombreCliente, telefono, direccion } } para domicilio
// productos: array con { id, precio, cantidad, idsIngredientesExcluidos }
const guardarPedido = async (datosPedido) => {
  const conexion = await db.getConnection();

  try {
    await conexion.beginTransaction();

    let idCliente = null;
    let idMesa = null;

    if (datosPedido.mesa) {
      idMesa = await obtenerOCrearMesa(datosPedido.mesa);
    } else if (datosPedido.cliente) {
      idCliente = await obtenerOCrearCliente(
        datosPedido.cliente.nombreCliente,
        datosPedido.cliente.telefono
      );
    } else {
      throw new Error('El pedido debe tener mesa o datos de cliente');
    }

    const [resultadoPedido] = await conexion.query(
      'INSERT INTO Pedido (id_cliente, id_mesa, estado, pagado) VALUES (?, ?, "Pendiente", 0)',
      [idCliente, idMesa]
    );
    const idPedido = resultadoPedido.insertId;

    for (const producto of datosPedido.productos) {
      const [resultadoDetalle] = await conexion.query(
        'INSERT INTO DetallePedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
        [idPedido, producto.id, producto.cantidad, producto.precio]
      );
      const idDetalle = resultadoDetalle.insertId;

      const idsExcluidos = producto.idsIngredientesExcluidos || [];
      for (const idInsumo of idsExcluidos) {
        await conexion.query(
          'INSERT INTO DetalleIngredienteExcluido (id_detalle, id_insumo) VALUES (?, ?)',
          [idDetalle, idInsumo]
        );
      }
    }

    // Si es pedido a domicilio, registra también la dirección
    if (datosPedido.cliente && datosPedido.cliente.direccion) {
      await conexion.query(
        'INSERT INTO Domicilio (id_pedido, direccion, estado) VALUES (?, ?, "En camino")',
        [idPedido, datosPedido.cliente.direccion]
      );
    }

    await conexion.commit();
    return await obtenerPedidoPorId(idPedido);
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
};

// Arma la cláusula SELECT + JOIN compartida por obtenerPedidos y obtenerPedidoPorId
const construirConsultaPedidos = () => `
  SELECT
    p.id_pedido,
    p.fecha,
    p.estado,
    p.pagado,
    m.numero AS mesa,
    c.nombre AS nombreCliente,
    c.telefono,
    dom.direccion,
    dp.id_detalle,
    dp.id_producto,
    dp.cantidad,
    dp.precio_unitario,
    pr.nombre AS nombreProducto,
    cat.nombre AS categoria
  FROM Pedido p
  LEFT JOIN Mesa m ON p.id_mesa = m.id_mesa
  LEFT JOIN Cliente c ON p.id_cliente = c.id_cliente
  LEFT JOIN Domicilio dom ON dom.id_pedido = p.id_pedido
  JOIN DetallePedido dp ON dp.id_pedido = p.id_pedido
  JOIN Producto pr ON pr.id_producto = dp.id_producto
  JOIN Categoria cat ON cat.id_categoria = pr.id_categoria
`;

// Retorna un mapa { id_detalle: ['Cebolla', 'Tomate'] } con los ingredientes excluidos de cada línea
const obtenerExclusionesPorDetalle = async () => {
  const [filas] = await db.query(`
    SELECT die.id_detalle, i.nombre AS ingrediente
    FROM DetalleIngredienteExcluido die
    JOIN Insumo i ON i.id_insumo = die.id_insumo
  `);

  const exclusionesPorDetalle = {};
  filas.forEach((fila) => {
    if (!exclusionesPorDetalle[fila.id_detalle]) exclusionesPorDetalle[fila.id_detalle] = [];
    exclusionesPorDetalle[fila.id_detalle].push(fila.ingrediente);
  });
  return exclusionesPorDetalle;
};

// Agrupa las filas planas del JOIN (una fila por producto) en un array de pedidos
// con su lista de productos anidada, reconstruyendo "Sin: ..." desde DetalleIngredienteExcluido
const agruparFilasEnPedidos = (filas, exclusionesPorDetalle) => {
  const pedidosPorId = {};

  filas.forEach((fila) => {
    if (!pedidosPorId[fila.id_pedido]) {
      pedidosPorId[fila.id_pedido] = {
        id_pedido: fila.id_pedido,
        fecha: fila.fecha,
        estado: fila.estado,
        pagado: Boolean(fila.pagado),
        mesa: fila.mesa || null,
        cliente: fila.nombreCliente
          ? { nombreCliente: fila.nombreCliente, telefono: fila.telefono, direccion: fila.direccion }
          : null,
        productos: []
      };
    }

    const excluidos = exclusionesPorDetalle[fila.id_detalle] || [];

    pedidosPorId[fila.id_pedido].productos.push({
      id: fila.id_producto,
      nombre: fila.nombreProducto,
      categoria: fila.categoria,
      cantidad: fila.cantidad,
      precio: fila.precio_unitario,
      observaciones: excluidos.length > 0 ? 'Sin: ' + excluidos.join(', ') : ''
    });
  });

  return Object.values(pedidosPorId);
};

// Retorna todos los pedidos, agrupados con sus productos
const obtenerPedidos = async () => {
  const [filas] = await db.query(`${construirConsultaPedidos()} ORDER BY p.id_pedido ASC`);
  const exclusiones = await obtenerExclusionesPorDetalle();
  return agruparFilasEnPedidos(filas, exclusiones);
};

// Retorna un pedido puntual por su id_pedido real
const obtenerPedidoPorId = async (idPedido) => {
  const [filas] = await db.query(`${construirConsultaPedidos()} WHERE p.id_pedido = ?`, [idPedido]);
  const exclusiones = await obtenerExclusionesPorDetalle();
  const pedidos = agruparFilasEnPedidos(filas, exclusiones);
  return pedidos[0] || null;
};

// Actualiza el estado de un pedido por su id_pedido real
const actualizarEstadoPedido = async (idPedido, nuevoEstado) => {
  const [resultado] = await db.query(
    'UPDATE Pedido SET estado = ? WHERE id_pedido = ?',
    [nuevoEstado, idPedido]
  );
  if (resultado.affectedRows === 0) return null;
  return await obtenerPedidoPorId(idPedido);
};

// Marca un pedido como pagado por su id_pedido real
const marcarPedidoPagado = async (idPedido) => {
  const [resultado] = await db.query(
    'UPDATE Pedido SET pagado = 1 WHERE id_pedido = ?',
    [idPedido]
  );
  if (resultado.affectedRows === 0) return null;
  return await obtenerPedidoPorId(idPedido);
};

module.exports = {
  guardarPedido,
  obtenerPedidos,
  obtenerPedidoPorId,
  actualizarEstadoPedido,
  marcarPedidoPagado
};