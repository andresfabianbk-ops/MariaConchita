package com.example.mariacochitaapp.ui

import android.content.Context
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import com.example.mariacochitaapp.models.ItemPedido
import com.example.mariacochitaapp.utils.Colores

// Construye dinámicamente las vistas de productos disponibles y del resumen del pedido
object VistaPedidoHelper {

    // Dibuja la lista de productos disponibles con su botón "+"
    fun renderizarProductos(
        context: Context,
        contenedor: LinearLayout,
        productos: List<Pair<String, Int>>,
        onAgregar: (String, Int) -> Unit
    ) {
        productos.forEach { (nombre, precio) ->
            val fila = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                setPadding(16, 16, 16, 16)
                setBackgroundColor(Colores.BLANCO)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { setMargins(0, 0, 0, 8) }
            }

            val texto = TextView(context).apply {
                text = "$nombre - $$precio"
                setTextColor(Colores.NEGRO)
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                gravity = Gravity.CENTER_VERTICAL
            }

            val boton = Button(context).apply {
                text = "+"
                setBackgroundColor(Colores.NARANJA)
                setTextColor(Colores.BLANCO)
                setOnClickListener { onAgregar(nombre, precio) }
            }

            fila.addView(texto)
            fila.addView(boton)
            contenedor.addView(fila)
        }
    }

    // Dibuja el resumen del pedido actual, con botón de eliminar por ítem
    fun renderizarResumen(
        context: Context,
        contenedor: LinearLayout,
        pedidoActual: MutableList<ItemPedido>,
        onEliminar: (ItemPedido) -> Unit
    ) {
        contenedor.removeAllViews()
        pedidoActual.forEach { item ->
            val fila = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                setPadding(0, 8, 0, 8)
            }
            val texto = TextView(context).apply {
                text = "${item.nombre} x${item.cantidad} - $${item.precio * item.cantidad}"
                setTextColor(Colores.NEGRO)
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                gravity = Gravity.CENTER_VERTICAL
            }
            val btnEliminar = TextView(context).apply {
                text = "✕"
                setTextColor(Colores.ROJO)
                setPadding(16, 0, 0, 0)
                setOnClickListener { onEliminar(item) }
            }
            fila.addView(texto)
            fila.addView(btnEliminar)
            contenedor.addView(fila)
        }
    }
}