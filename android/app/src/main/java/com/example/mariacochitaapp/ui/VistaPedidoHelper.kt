package com.example.mariacochitaapp.ui

import android.content.Context
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import com.example.mariacochitaapp.models.ItemPedido
import com.example.mariacochitaapp.models.PedidoLocal
import com.example.mariacochitaapp.utils.Colores
import android.graphics.Typeface
import com.example.mariacochitaapp.models.CategoriaMenu
import com.example.mariacochitaapp.models.ProductoMenu
import android.widget.CheckBox
import android.widget.ScrollView
import androidx.appcompat.app.AlertDialog
import com.example.mariacochitaapp.models.Ingrediente

// Construye dinámicamente las vistas de productos disponibles y del resumen del pedido
object VistaPedidoHelper {

    // Formatea un precio con separador de miles y sin decimales: 53300 -> $53.300
    private fun formatearPrecio(valor: Number): String {
        val simbolos = java.text.DecimalFormatSymbols().apply { groupingSeparator = '.' }
        return "\$" + java.text.DecimalFormat("#,##0", simbolos).format(valor.toDouble())
    }

    // Dibuja el menú por categorías: título de la categoría y, debajo, cada producto con su botón "+"
    fun renderizarProductos(
        context: Context,
        contenedor: LinearLayout,
        categorias: List<CategoriaMenu>,
        onAgregar: (ProductoMenu) -> Unit
    ) {
        contenedor.removeAllViews()
        categorias.forEach { categoria ->
            val titulo = TextView(context).apply {
                text = categoria.nombre
                setTextColor(Colores.NEGRO)
                textSize = 18f
                setTypeface(typeface, Typeface.BOLD)
                setPadding(0, 16, 0, 8)
            }
            contenedor.addView(titulo)

            categoria.productos.forEach { producto ->
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
                    text = "${producto.nombre} - ${formatearPrecio(producto.precio)}"
                    setTextColor(Colores.NEGRO)
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                    gravity = Gravity.CENTER_VERTICAL
                }

                val boton = Button(context).apply {
                    text = "+"
                    setBackgroundColor(Colores.NARANJA)
                    setTextColor(Colores.BLANCO)
                    setOnClickListener { onAgregar(producto) }
                }

                fila.addView(texto)
                fila.addView(boton)
                contenedor.addView(fila)
            }
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
                text = "${item.nombre} x${item.cantidad} - ${formatearPrecio(item.precio * item.cantidad)}" +
                if (item.excluidos.isNotEmpty()) "\nSin: ${item.excluidos.joinToString(", ") { it.nombre }}" else ""
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

    // Modal para elegir los ingredientes a quitar de un producto. Los base salen deshabilitados.
    fun mostrarModalIngredientes(
        context: Context,
        producto: ProductoMenu,
        onConfirmar: (List<Ingrediente>) -> Unit
    ) {
        val cajas = mutableListOf<Pair<CheckBox, Ingrediente>>()
        val lista = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 16, 48, 0)
        }
        producto.ingredientes.forEach { ingrediente ->
            val caja = CheckBox(context).apply {
                text = if (ingrediente.esExcluible) ingrediente.nombre else "${ingrediente.nombre} (base)"
                isEnabled = ingrediente.esExcluible
            }
            cajas.add(Pair(caja, ingrediente))
            lista.addView(caja)
        }

        AlertDialog.Builder(context)
            .setTitle("${producto.nombre}: marque lo que desea quitar")
            .setView(ScrollView(context).apply { addView(lista) })
            .setPositiveButton("Agregar") { _, _ ->
                onConfirmar(cajas.filter { it.first.isChecked }.map { it.second })
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }


    // Dibuja una tarjeta por cada pedido enviado desde este celular, con su estado actual del servidor
    fun renderizarPedidosEnEspera(
        context: Context,
        contenedor: LinearLayout,
        pedidos: List<PedidoLocal>,
        estados: Map<Int, String> = emptyMap(),
        onCancelar: (PedidoLocal) -> Unit = {},
        onEntregar: (PedidoLocal) -> Unit = {}
    ) {
        contenedor.removeAllViews()

        if (pedidos.isEmpty()) {
            contenedor.addView(TextView(context).apply {
                text = "No hay pedidos en espera"
                setTextColor(Colores.NEGRO)
                gravity = Gravity.CENTER
            })
            return
        }

        pedidos.reversed().forEach { pedido ->
            val tarjeta = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(24, 24, 24, 24)
                setBackgroundColor(Colores.BLANCO)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { setMargins(0, 0, 0, 16) }
            }

            tarjeta.addView(TextView(context).apply {
                text = "Pedido #${pedido.idPedido} - Mesa ${pedido.mesa}"
                setTextColor(Colores.NEGRO)
                textSize = 16f
                setTypeface(typeface, Typeface.BOLD)
            })

            tarjeta.addView(TextView(context).apply {
                text = "Estado: ${estados[pedido.idPedido] ?: "Consultando..."}"
                setTextColor(Colores.NARANJA)
                setTypeface(typeface, Typeface.BOLD)
                setPadding(0, 4, 0, 4)
            })

            pedido.items.forEach { item ->
                tarjeta.addView(TextView(context).apply {
                    text = "${item.cantidad} x ${item.nombre}" +
                            if (item.excluidos.isNotEmpty()) "\nSin: ${item.excluidos.joinToString(", ") { it.nombre }}" else ""
                    setTextColor(Colores.NEGRO)
                    setPadding(0, 8, 0, 0)
                })
            }

            // Solo un pedido Pendiente se puede cancelar
            if (estados[pedido.idPedido] == "Pendiente") {
                tarjeta.addView(Button(context).apply {
                    text = "Cancelar"
                    setBackgroundColor(Colores.ROJO)
                    setTextColor(Colores.BLANCO)
                    setOnClickListener { onCancelar(pedido) }
                })
            }

            // Solo un pedido Listo se puede marcar como entregado
            if (estados[pedido.idPedido] == "Listo") {
                tarjeta.addView(Button(context).apply {
                    text = "Marcar entregado"
                    setBackgroundColor(Colores.NARANJA)
                    setTextColor(Colores.BLANCO)
                    setOnClickListener { onEntregar(pedido) }
                })
            }

            contenedor.addView(tarjeta)
        }
    }
}