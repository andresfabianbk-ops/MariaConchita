// Importa la lógica de negocio
const { crearPedido, listarPedidos, cambiarEstadoPedido, pagarPedido } = require('../services/pedidoService');

// Maneja la petición HTTP para crear un pedido
const postPedido = async (req, res) => {
  try {
    const pedido = await crearPedido(req.body);
    res.status(201).json(pedido);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Maneja la petición HTTP para listar pedidos
const getPedidos = async (req, res) => {
  res.status(200).json(await listarPedidos());
};

// Maneja la petición HTTP para actualizar el estado de un pedido
const putEstadoPedido = async (req, res) => {
  try {
    const idpedido = Number(req.params.id);
    const pedido = await cambiarEstadoPedido(idpedido, req.body.estado);
    res.status(200).json(pedido);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Maneja la petición HTTP para marcar un pedido como pagado
const putPagarPedido = async (req, res) => {
  try {
    const idpedido = Number(req.params.id);
    const pedido = await pagarPedido(indice);
    res.status(200).json(pedido);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = { postPedido, getPedidos, putEstadoPedido, putPagarPedido };