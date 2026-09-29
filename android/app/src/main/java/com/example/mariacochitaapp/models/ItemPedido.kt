package com.example.mariacochitaapp.models

// Modelo de un producto agregado al pedido
data class ItemPedido(val nombre: String, val precio: Int, var cantidad: Int)