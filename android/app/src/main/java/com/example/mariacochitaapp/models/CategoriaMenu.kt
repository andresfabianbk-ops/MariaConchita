package com.example.mariacochitaapp.models

// Ingrediente de un producto; los base (esExcluible = false) no se pueden quitar
data class Ingrediente(val idInsumo: Int, val nombre: String, val esExcluible: Boolean)

// Producto del menú tal como lo entrega GET /api/menu
data class ProductoMenu(
    val id: Int,
    val nombre: String,
    val precio: Int,
    val categoria: String,
    val ingredientes: List<Ingrediente>
)

// Categoría del menú con sus productos disponibles
data class CategoriaMenu(val nombre: String, val productos: List<ProductoMenu>)