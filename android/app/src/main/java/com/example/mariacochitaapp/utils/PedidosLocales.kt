package com.example.mariacochitaapp.utils

import android.content.Context
import com.example.mariacochitaapp.models.Ingrediente
import com.example.mariacochitaapp.models.ItemPedido
import com.example.mariacochitaapp.models.PedidoLocal
import org.json.JSONArray
import org.json.JSONObject

// Guarda en SharedPreferences los pedidos enviados desde este celular
// (el backend no registra qué mesero tomó cada pedido)
object PedidosLocales {

    private const val ARCHIVO = "pedidos_mesero"
    private const val CLAVE_LISTA = "lista"

    fun guardar(context: Context, pedido: PedidoLocal) {
        val lista = leerArreglo(context)
        lista.put(aJson(pedido))
        escribirArreglo(context, lista)
    }

    fun listar(context: Context): List<PedidoLocal> {
        val lista = leerArreglo(context)
        val pedidos = mutableListOf<PedidoLocal>()
        for (i in 0 until lista.length()) {
            pedidos.add(deJson(lista.getJSONObject(i)))
        }
        return pedidos
    }

    fun eliminar(context: Context, idPedido: Int) {
        val lista = leerArreglo(context)
        val restantes = JSONArray()
        for (i in 0 until lista.length()) {
            val objeto = lista.getJSONObject(i)
            if (objeto.getInt("idPedido") != idPedido) restantes.put(objeto)
        }
        escribirArreglo(context, restantes)
    }

    // Borra todos los pedidos recordados (se usa al cerrar sesión)
    fun limpiar(context: Context) {
        escribirArreglo(context, JSONArray())
    }

    private fun leerArreglo(context: Context): JSONArray {
        val texto = context.getSharedPreferences(ARCHIVO, Context.MODE_PRIVATE)
            .getString(CLAVE_LISTA, null)
        return try {
            JSONArray(texto ?: "[]")
        } catch (_: Exception) {
            JSONArray()
        }
    }

    private fun escribirArreglo(context: Context, lista: JSONArray) {
        context.getSharedPreferences(ARCHIVO, Context.MODE_PRIVATE).edit()
            .putString(CLAVE_LISTA, lista.toString())
            .apply()
    }

    private fun aJson(pedido: PedidoLocal): JSONObject {
        val items = JSONArray()
        pedido.items.forEach { item ->
            val excluidos = JSONArray()
            item.excluidos.forEach { excluido ->
                excluidos.put(JSONObject().apply {
                    put("idInsumo", excluido.idInsumo)
                    put("nombre", excluido.nombre)
                    put("esExcluible", excluido.esExcluible)
                })
            }
            items.put(JSONObject().apply {
                put("idProducto", item.idProducto)
                put("nombre", item.nombre)
                put("precio", item.precio)
                put("cantidad", item.cantidad)
                put("excluidos", excluidos)
            })
        }
        return JSONObject().apply {
            put("idPedido", pedido.idPedido)
            put("mesa", pedido.mesa)
            put("items", items)
        }
    }

    private fun deJson(objeto: JSONObject): PedidoLocal {
        val items = mutableListOf<ItemPedido>()
        val jsonItems = objeto.getJSONArray("items")
        for (i in 0 until jsonItems.length()) {
            val jsonItem = jsonItems.getJSONObject(i)
            val excluidos = mutableListOf<Ingrediente>()
            val jsonExcluidos = jsonItem.getJSONArray("excluidos")
            for (j in 0 until jsonExcluidos.length()) {
                val jsonExcluido = jsonExcluidos.getJSONObject(j)
                excluidos.add(
                    Ingrediente(
                        jsonExcluido.getInt("idInsumo"),
                        jsonExcluido.getString("nombre"),
                        jsonExcluido.getBoolean("esExcluible")
                    )
                )
            }
            items.add(
                ItemPedido(
                    jsonItem.getInt("idProducto"),
                    jsonItem.getString("nombre"),
                    jsonItem.getInt("precio"),
                    jsonItem.getInt("cantidad"),
                    excluidos
                )
            )
        }
        return PedidoLocal(objeto.getInt("idPedido"), objeto.getInt("mesa"), items)
    }
}