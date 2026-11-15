package com.example.mariacochitaapp.models

// Modelo de un producto agregado al pedido
data class ItemPedido(
    val idProducto: Int,
    val nombre: String,
    val precio: Int,
    var cantidad: Int,
    val excluidos: List<Ingrediente> = emptyList()
)