package com.example.mariacochitaapp.models

// Pedido enviado desde este celular, guardado localmente para seguirlo en la pestaña "En espera"
data class PedidoLocal(val idPedido: Int, val mesa: Int, val items: List<ItemPedido>)