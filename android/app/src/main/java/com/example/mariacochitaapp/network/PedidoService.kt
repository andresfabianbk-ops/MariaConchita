package com.example.mariacochitaapp.network

import com.example.mariacochitaapp.models.ItemPedido
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import com.example.mariacochitaapp.BuildConfig

// Encapsula las llamadas de red relacionadas con pedidos
object PedidoService {

    private val URL_PEDIDOS = "${BuildConfig.API_URL}/pedidos"
    private val client = OkHttpClient()

    // Envía el pedido armado al backend. onExito/onError se ejecutan en el hilo de red.
    fun enviarPedido(mesa: String, productos: List<ItemPedido>, onExito: () -> Unit, onError: () -> Unit) {
        val productosJson = JSONArray()
        productos.forEach {
            productosJson.put(JSONObject().apply {
                put("nombre", it.nombre)
                put("precio", it.precio)
                put("cantidad", it.cantidad)
            })
        }
        val cuerpo = JSONObject().apply {
            put("mesa", mesa)
            put("productos", productosJson)
        }

        try {
            val body = cuerpo.toString().toRequestBody("application/json".toMediaType())
            val request = Request.Builder().url(URL_PEDIDOS).post(body).build()
            // use{} cierra la respuesta (evita la fuga) y solo se avisa éxito si el backend aceptó el pedido
            client.newCall(request).execute().use { respuesta ->
                if (respuesta.isSuccessful) onExito() else onError()
            }
        } catch (_: IOException) {
            onError()
        }
    }

    // Consulta el id_pedido del último pedido registrado (el recién enviado)
    fun obtenerIdUltimoPedido(onResultado: (Int) -> Unit, onError: () -> Unit) {
        try {
            val request = Request.Builder().url(URL_PEDIDOS).get().build()
            val respuesta = client.newCall(request).execute()
            val cuerpo = respuesta.body?.string() ?: "[]"
            val pedidos = JSONArray(cuerpo)
            if (pedidos.length() == 0) {
                onError()
                return
            }
            val ultimoPedido = pedidos.getJSONObject(pedidos.length() - 1)
            onResultado(ultimoPedido.getInt("id_pedido"))
        } catch (_: Exception) {
            onError()
        }
    }

    // Consulta el estado actual de un pedido por su id_pedido
    fun consultarEstado(idPedido: Int, onResultado: (String) -> Unit, onError: () -> Unit) {
        try {
            val request = Request.Builder().url(URL_PEDIDOS).get().build()
            val respuesta = client.newCall(request).execute()
            val cuerpo = respuesta.body?.string() ?: "[]"
            val pedidos = JSONArray(cuerpo)
            for (i in 0 until pedidos.length()) {
                val pedido = pedidos.getJSONObject(i)
                if (pedido.getInt("id_pedido") == idPedido) {
                    onResultado(pedido.optString("estado", "Pendiente"))
                    return
                }
            }
            onError()
        } catch (_: Exception) {
            onError()
        }
    }

    // Consulta la mesa de un pedido por su id_pedido
    fun consultarMesa(idPedido: Int, onResultado: (String) -> Unit, onError: () -> Unit) {
        try {
            val request = Request.Builder().url(URL_PEDIDOS).get().build()
            val respuesta = client.newCall(request).execute()
            val cuerpo = respuesta.body?.string() ?: "[]"
            val pedidos = JSONArray(cuerpo)
            for (i in 0 until pedidos.length()) {
                val pedido = pedidos.getJSONObject(i)
                if (pedido.getInt("id_pedido") == idPedido) {
                    onResultado(pedido.optString("mesa", "?"))
                    return
                }
            }
            onError()
        } catch (_: Exception) {
            onError()
        }
    }
}