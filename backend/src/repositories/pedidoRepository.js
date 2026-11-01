// Acceso a datos de pedidos (mesa y domicilio) — MySQL real vía mysql2
const db = require('../config/db');
const { COSTO_ENVIO_DOMICILIO } = require('../config/constantes');

// Crea un error de negocio con su código; el controller lo traduce a HTTP con mapearStatus
const crearError = (codigo, mensaje) => {
  const error = new Error(mensaje);
  error.codigo = codigo;
  return error;
};

// Busca una mesa por número; si no existe, la crea automáticamente (Ocupada por defecto)
// Usa la conexión de la transacción para que un rollback también deshaga la mesa creada
const obtenerOCrearMesa = async (conexion, numero) => {
  const [existente] = await conexion.query('SELECT id_mesa FROM Mesa WHERE numero = ?', [numero]);
  if (existente.length > 0) return existente[0].id_mesa;

  const [resultado] = await conexion.query(
    'INSERT INTO Mesa (numero, estado) VALUES (?, "Ocupada")',
    [numero]
  );
  return resultado.insertId;
};

// Busca un cliente por teléfono; si no existe, lo crea. Devuelve el id_cliente real
// Usa la conexión de la transacción para que un rollback también deshaga el cliente creado
const obtenerOCrearCliente = async (conexion, nombre, telefono) => {
  const [existente] = await conexion.query('SELECT id_cliente FROM Cliente WHERE telefono = ?', [telefono]);
  if (existente.length > 0) return existente[0].id_cliente;

  const [resultado] = await conexion.query(
    'INSERT INTO Cliente (nombre, telefono) VALUES (?, ?)',
    [nombre, telefono]
  );
  return resultado.insertId;
};

/// Valida los productos del pedido contra la BD y devuelve las líneas listas para guardar.
// El precio sale de Producto (nunca del cliente). Se ejecuta dentro de la transacción
const prepararLineas = async (conexion, productos) => {
  const idsProductos = [...new Set(productos.map((producto) => Number(producto.id)))];

  const [filasProductos] = await conexion.query(
    'SELECT id_producto, nombre, precio, disponible FROM Producto WHERE id_producto IN (?)',
    [idsProductos]
  );
  const productosPorId = new Map(filasProductos.map((fila) => [fila.id_producto, fila]));

  const [filasReceta] = await conexion.query(
    'SELECT id_producto, id_insumo, cantidad_requerida, es_excluible FROM RecetaProducto WHERE id_producto IN (?)',
    [idsProductos]
  );
  // Mapa { id_producto → Map(id_insumo → { cantidadRequerida, excluible }) }
  const recetasPorProducto = new Map();
  filasReceta.forEach((fila) => {
    if (!recetasPorProducto.has(fila.id_producto)) recetasPorProducto.set(fila.id_producto, new Map());
    recetasPorProducto.get(fila.id_producto).set(fila.id_insumo, {
      cantidadRequerida: Number(fila.cantidad_requerida),
      excluible: Boolean(fila.es_excluible)
    });
  });

  return productos.map((producto) => {
    const idProducto = Number(producto.id);
    const datosProducto = productosPorId.get(idProducto);

    if (!datosProducto) {
      throw crearError('NO_ENCONTRADA', `El producto con id ${idProducto} no existe`);
    }
    if (!datosProducto.disponible) {
      throw crearError('OPERACION_NO_PERMITIDA', `El producto "${datosProducto.nombre}" no está disponible`);
    }

    // Solo se pueden quitar ingredientes de la receta marcados como excluibles
    const receta = recetasPorProducto.get(idProducto) || new Map();
    const idsExcluidos = [...new Set((producto.idsIngredientesExcluidos || []).map(Number))];
    idsExcluidos.forEach((idInsumo) => {
      if (receta.get(idInsumo)?.excluible !== true) {
        throw crearError('DATOS_INVALIDOS', `No se puede quitar ese ingrediente de "${datosProducto.nombre}"`);
      }
    });

    return {
      idProducto,
      precio: Number(datosProducto.precio),
      cantidad: Number(producto.cantidad),
      idsExcluidos,
      receta
    };
  });
};

// Descuenta del inventario lo que consume el pedido (receta × cantidad, sin los ingredientes excluidos)
// y registra una 'Salida por venta' por insumo. Devuelve las alertas de stock bajo.
// Si el stock no alcanza solo se alerta (puede quedar negativo); no se bloquea el pedido
const descontarInventario = async (conexion, idPedido, lineas) => {
  // Consumo total por insumo: Map(id_insumo → cantidad)
  const consumoPorInsumo = new Map();
  lineas.forEach((linea) => {
    linea.receta.forEach((ingrediente, idInsumo) => {
      if (linea.idsExcluidos.includes(idInsumo)) return; // ingrediente quitado: no se descuenta
      const consumo = ingrediente.cantidadRequerida * linea.cantidad;
      consumoPorInsumo.set(idInsumo, (consumoPorInsumo.get(idInsumo) || 0) + consumo);
    });
  });

  const idsAfectados = [];
  for (const [idInsumo, total] of consumoPorInsumo) {
    const cantidad = Math.round(total * 1000) / 1000; // los insumos usan 3 decimales
    if (cantidad <= 0) continue;

    await conexion.query(
      'UPDATE Insumo SET stock_actual = stock_actual - ?, fecha_actualizacion = NOW() WHERE id_insumo = ?',
      [cantidad, idInsumo]
    );
    await conexion.query(
      'INSERT INTO MovimientoInventario (id_insumo, tipo, cantidad, motivo, id_pedido) VALUES (?, "Salida por venta", ?, ?, ?)',
      [idInsumo, cantidad, `Pedido #${idPedido}`, idPedido]
    );
    idsAfectados.push(idInsumo);
  }

  if (idsAfectados.length === 0) return [];

  const [filasAlerta] = await conexion.query(
    'SELECT nombre, unidad_medida, stock_actual, stock_minimo FROM Insumo WHERE id_insumo IN (?) AND stock_actual <= stock_minimo',
    [idsAfectados]
  );
  return filasAlerta.map((fila) => ({
    insumo: fila.nombre,
    unidad_medida: fila.unidad_medida,
    stock_actual: Number(fila.stock_actual),
    stock_minimo: Number(fila.stock_minimo)
  }));
};

// Crea un pedido completo (Pedido + DetallePedido + DetalleIngredienteExcluido + Domicilio) en una transacción
// datosPedido: { mesa } para pedido en mesa (app Android), o { cliente: { nombreCliente, telefono, direccion } } para domicilio
// productos: array con { id, cantidad, idsIngredientesExcluidos }; el precio se ignora y se lee de Producto
const guardarPedido = async (datosPedido) => {
  const conexion = await db.getConnection();

  try {
    await conexion.beginTransaction();

    const lineas = await prepararLineas(conexion, datosPedido.productos);

    let idCliente = null;
    let idMesa = null;

    if (datosPedido.mesa) {
      idMesa = await obtenerOCrearMesa(conexion, datosPedido.mesa);
    } else if (datosPedido.cliente) {
      idCliente = await obtenerOCrearCliente(
        conexion,
        datosPedido.cliente.nombreCliente.trim(),
        datosPedido.cliente.telefono.trim()
      );
    } else {
      throw crearError('DATOS_INVALIDOS', 'El pedido debe tener mesa o datos de cliente');
    }

    const [resultadoPedido] = await conexion.query(
      'INSERT INTO Pedido (id_cliente, id_mesa, estado, pagado) VALUES (?, ?, "Pendiente", 0)',
      [idCliente, idMesa]
    );
    const idPedido = resultadoPedido.insertId;

    for (const linea of lineas) {
      const [resultadoDetalle] = await conexion.query(
        'INSERT INTO DetallePedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
        [idPedido, linea.idProducto, linea.cantidad, linea.precio]
      );
      const idDetalle = resultadoDetalle.insertId;

      for (const idInsumo of linea.idsExcluidos) {
        await conexion.query(
          'INSERT INTO DetalleIngredienteExcluido (id_detalle, id_insumo) VALUES (?, ?)',
          [idDetalle, idInsumo]
        );
      }
    }

    // Solo el pedido a domicilio (de cliente) registra dirección y costo de envío fijo
    if (idCliente !== null) {
      await conexion.query(
        'INSERT INTO Domicilio (id_pedido, direccion, costo_envio, estado) VALUES (?, ?, ?, "Pendiente")',
        [idPedido, datosPedido.cliente.direccion.trim(), COSTO_ENVIO_DOMICILIO]
      );
    }
        
    // Descuenta el inventario y obtiene las alertas de stock bajo (misma transacción)
    
    const alertasStock = await descontarInventario(conexion, idPedido, lineas);
    
    await conexion.commit();
    const pedido = await obtenerPedidoPorId(idPedido);
    return { ...pedido, alertas_stock: alertasStock };
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
    dom.costo_envio,
    dom.estado AS estado_domicilio,
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

// Retorna un mapa { id_detalle: ['Cebolla', 'Tomate'] } con los ingredientes excluidos de las líneas indicadas
const obtenerExclusionesPorDetalle = async (idsDetalle) => {
  if (idsDetalle.length === 0) return {};

  const [filas] = await db.query(
    `SELECT die.id_detalle, i.nombre AS ingrediente
     FROM DetalleIngredienteExcluido die
     JOIN Insumo i ON i.id_insumo = die.id_insumo
     WHERE die.id_detalle IN (?)`,
    [idsDetalle]
  );

  const exclusionesPorDetalle = {};
  filas.forEach((fila) => {
    if (!exclusionesPorDetalle[fila.id_detalle]) exclusionesPorDetalle[fila.id_detalle] = [];
    exclusionesPorDetalle[fila.id_detalle].push(fila.ingrediente);
  });
  return exclusionesPorDetalle;
};

// Agrupa las filas planas del JOIN (una fila por producto) en un array de pedidos
// con su lista de productos anidada, reconstruyendo "Sin: ..." desde DetalleIngredienteExcluido.
// Los montos DECIMAL (strings en mysql2) se castean a Number y se calcula el total (productos + envío)
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
        costo_envio: fila.costo_envio === null ? 0 : Number(fila.costo_envio),
        estado_domicilio: fila.estado_domicilio || null,
        productos: [],
        total: 0
      };
    }

    const excluidos = exclusionesPorDetalle[fila.id_detalle] || [];

    pedidosPorId[fila.id_pedido].productos.push({
      id: fila.id_producto,
      nombre: fila.nombreProducto,
      categoria: fila.categoria,
      cantidad: fila.cantidad,
      precio: Number(fila.precio_unitario),
      observaciones: excluidos.length > 0 ? 'Sin: ' + excluidos.join(', ') : ''
    });
  });

  const pedidos = Object.values(pedidosPorId);
  pedidos.forEach((pedido) => {
    const subtotal = pedido.productos.reduce((suma, producto) => suma + producto.precio * producto.cantidad, 0);
    pedido.total = Math.round((subtotal + pedido.costo_envio) * 100) / 100;
  });
  return pedidos;
};

// Retorna los pedidos agrupados con sus productos, con filtros opcionales
// filtros: { tipo: 'domicilio' | 'mesa', estados: ['Listo', ...], abiertos: true | cancelacionPendiente: true}
// abiertos = domicilios que aún no llegaron al cliente y no están cancelados
const obtenerPedidos = async (filtros = {}) => {
  const condiciones = [];
  const parametros = [];

  if (filtros.tipo === 'domicilio') condiciones.push('dom.id_domicilio IS NOT NULL');
  if (filtros.tipo === 'mesa') condiciones.push('p.id_mesa IS NOT NULL');
  if (filtros.estados) {
    condiciones.push('p.estado IN (?)');
    parametros.push(filtros.estados);
  }
  if (filtros.abiertos) {
    condiciones.push(`dom.id_domicilio IS NOT NULL AND dom.estado <> 'Entregado' AND p.estado <> 'Cancelado'`);
  }
  if (filtros.cancelacionPendiente) {
    condiciones.push(`p.estado = 'Cancelado' AND p.cancelacion_pendiente_cocina = 1`);
  }
  
  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const [filas] = await db.query(
    `${construirConsultaPedidos()} ${where} ORDER BY p.id_pedido ASC`,
    parametros
  );
  const exclusiones = await obtenerExclusionesPorDetalle(filas.map((fila) => fila.id_detalle));
  return agruparFilasEnPedidos(filas, exclusiones);
};

// Retorna un pedido puntual por su id_pedido real
const obtenerPedidoPorId = async (idPedido) => {
  const [filas] = await db.query(`${construirConsultaPedidos()} WHERE p.id_pedido = ?`, [idPedido]);
  const exclusiones = await obtenerExclusionesPorDetalle(filas.map((fila) => fila.id_detalle));
  const pedidos = agruparFilasEnPedidos(filas, exclusiones);
  return pedidos[0] || null;
};

// Avanza el estado de un pedido solo si está en el estado de origen esperado.
// Un pedido a domicilio no pasa a 'Entregado' por aquí: se despacha con despacharPedidoDomicilio
const avanzarEstadoPedido = async (idPedido, nuevoEstado, estadoOrigen) => {
  const [filas] = await db.query(
    `SELECT p.estado, dom.id_domicilio
     FROM Pedido p
     LEFT JOIN Domicilio dom ON dom.id_pedido = p.id_pedido
     WHERE p.id_pedido = ?`,
    [idPedido]
  );
  if (filas.length === 0) {
    throw crearError('NO_ENCONTRADA', 'Pedido no encontrado');
  }

  const pedido = filas[0];
  if (pedido.estado !== estadoOrigen) {
    throw crearError('OPERACION_NO_PERMITIDA', `El pedido está en "${pedido.estado}"; no se puede pasar a "${nuevoEstado}"`);
  }
  if (nuevoEstado === 'Entregado' && pedido.id_domicilio !== null) {
    throw crearError('OPERACION_NO_PERMITIDA', 'Un pedido a domicilio se entrega con la opción de despachar');
  }

  // La condición AND estado = ? evita pisar un cambio hecho por otra petición en el mismo instante
  const [resultado] = await db.query(
    'UPDATE Pedido SET estado = ? WHERE id_pedido = ? AND estado = ?',
    [nuevoEstado, idPedido, estadoOrigen]
  );
  if (resultado.affectedRows === 0) {
    throw crearError('OPERACION_NO_PERMITIDA', 'El estado del pedido cambió; intente de nuevo');
  }
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

// Cancela un pedido 'Pendiente' y devuelve al inventario lo que se descontó al crearlo.
// La devolución se lee de MovimientoInventario (salidas reales del pedido), no se recalcula desde la receta
const cancelarPedidoYDevolverStock = async (idPedido) => {
  const conexion = await db.getConnection();

  try {
    await conexion.beginTransaction();

    // FOR UPDATE bloquea la fila: dos cancelaciones simultáneas no pueden devolver el stock dos veces
    const [filas] = await conexion.query(
      'SELECT estado FROM Pedido WHERE id_pedido = ? FOR UPDATE',
      [idPedido]
    );
    if (filas.length === 0) {
      throw crearError('NO_ENCONTRADA', 'Pedido no encontrado');
    }
    if (filas[0].estado !== 'Pendiente') {
      throw crearError('OPERACION_NO_PERMITIDA', 'Solo se puede cancelar un pedido en estado Pendiente');
    }

    // Queda en 1 hasta que cocina confirme que vio la cancelación
    await conexion.query(
      'UPDATE Pedido SET estado = "Cancelado", cancelacion_pendiente_cocina = 1 WHERE id_pedido = ?',
      [idPedido]
    );

    // Salidas por venta del pedido, sumadas por insumo
    const [salidas] = await conexion.query(
      `SELECT id_insumo, SUM(cantidad) AS cantidad
       FROM MovimientoInventario
       WHERE id_pedido = ? AND tipo = 'Salida por venta'
       GROUP BY id_insumo`,
      [idPedido]
    );

    for (const salida of salidas) {
      const cantidad = Number(salida.cantidad);
      await conexion.query(
        'UPDATE Insumo SET stock_actual = stock_actual + ?, fecha_actualizacion = NOW() WHERE id_insumo = ?',
        [cantidad, salida.id_insumo]
      );
      await conexion.query(
        'INSERT INTO MovimientoInventario (id_insumo, tipo, cantidad, motivo, id_pedido) VALUES (?, "Entrada", ?, ?, ?)',
        [salida.id_insumo, cantidad, `Cancelación pedido #${idPedido}`, idPedido]
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

// Cocina confirma que vio la cancelación; solo aplica a cancelados con aviso pendiente
const confirmarCancelacionCocina = async (idPedido) => {
  const [resultado] = await db.query(
    `UPDATE Pedido SET cancelacion_pendiente_cocina = 0
     WHERE id_pedido = ? AND estado = 'Cancelado' AND cancelacion_pendiente_cocina = 1`,
    [idPedido]
  );

  if (resultado.affectedRows === 0) {
    const [filas] = await db.query('SELECT estado FROM Pedido WHERE id_pedido = ?', [idPedido]);
    if (filas.length === 0) {
      throw crearError('NO_ENCONTRADA', 'Pedido no encontrado');
    }
    throw crearError('OPERACION_NO_PERMITIDA', 'El pedido no tiene una cancelación pendiente de confirmar');
  }

  return await obtenerPedidoPorId(idPedido);
};

// Despacha un pedido a domicilio: se entrega al domiciliario.
// Pedido 'Listo' → 'Entregado' y Domicilio 'Pendiente' → 'En camino', en una transacción
const despacharPedidoDomicilio = async (idPedido) => {
  const conexion = await db.getConnection();

  try {
    await conexion.beginTransaction();

    const [filas] = await conexion.query(
      `SELECT p.estado, dom.estado AS estado_domicilio
       FROM Pedido p
       LEFT JOIN Domicilio dom ON dom.id_pedido = p.id_pedido
       WHERE p.id_pedido = ? FOR UPDATE`,
      [idPedido]
    );
    if (filas.length === 0) {
      throw crearError('NO_ENCONTRADA', 'Pedido no encontrado');
    }

    const { estado, estado_domicilio } = filas[0];
    if (estado_domicilio === null) {
      throw crearError('OPERACION_NO_PERMITIDA', 'Solo los pedidos a domicilio se despachan');
    }
    if (estado !== 'Listo') {
      throw crearError('OPERACION_NO_PERMITIDA', 'El pedido debe estar Listo para despacharlo');
    }
    if (estado_domicilio !== 'Pendiente') {
      throw crearError('OPERACION_NO_PERMITIDA', 'El domicilio ya fue despachado');
    }

    await conexion.query('UPDATE Pedido SET estado = "Entregado" WHERE id_pedido = ?', [idPedido]);
    await conexion.query('UPDATE Domicilio SET estado = "En camino" WHERE id_pedido = ?', [idPedido]);

    await conexion.commit();
    return await obtenerPedidoPorId(idPedido);
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
};

// Registra que el domicilio llegó al cliente: Domicilio 'En camino' → 'Entregado'
const registrarEntregaDomicilio = async (idPedido) => {
  const [resultado] = await db.query(
    'UPDATE Domicilio SET estado = "Entregado" WHERE id_pedido = ? AND estado = "En camino"',
    [idPedido]
  );

  if (resultado.affectedRows === 0) {
    const [filas] = await db.query('SELECT estado FROM Domicilio WHERE id_pedido = ?', [idPedido]);
    if (filas.length === 0) {
      throw crearError('NO_ENCONTRADA', 'Domicilio no encontrado');
    }
    throw crearError('OPERACION_NO_PERMITIDA', 'El domicilio debe estar En camino para registrar la entrega');
  }
  return await obtenerPedidoPorId(idPedido);
};

module.exports = {
  guardarPedido,
  obtenerPedidos,
  obtenerPedidoPorId,
  avanzarEstadoPedido,
  marcarPedidoPagado,
  cancelarPedidoYDevolverStock,
  despacharPedidoDomicilio,
  registrarEntregaDomicilio,
  confirmarCancelacionCocina
};