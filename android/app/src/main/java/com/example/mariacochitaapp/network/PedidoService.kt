package com.example.mariacochitaapp.network

import com.example.mariacochitaapp.models.ItemPedido
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import com.example.mariacochitaapp.BuildConfig
import android.util.Log

// Encapsula las llamadas de red relacionadas con pedidos
object PedidoService {

    private val URL_PEDIDOS = "${BuildConfig.API_URL}/pedidos"
    private val client = OkHttpClient()

    // Envía el pedido armado al backend. onExito/onError se ejecutan en el hilo de red.
    // Envía el pedido al backend con el token del Mesero (llamar desde Dispatchers.IO).
    // Cuerpo: { mesa: número, productos: [{ id, cantidad, idsIngredientesExcluidos }] }; el precio lo lee el backend.
    // onExito recibe el id_pedido creado (-1 si no se pudo leer); onError recibe el mensaje y el código HTTP (0 si no hubo respuesta).
    fun enviarPedido(
        token: String,
        mesa: Int,
        productos: List<ItemPedido>,
        onExito: (idPedido: Int) -> Unit,
        onError: (mensaje: String, codigo: Int) -> Unit
    ) {
        val productosJson = JSONArray()
        productos.forEach { item ->
            productosJson.put(JSONObject().apply {
                put("id", item.idProducto)
                put("cantidad", item.cantidad)
                put("idsIngredientesExcluidos", JSONArray(item.excluidos.map { it.idInsumo }))
            })
        }
        val cuerpo = JSONObject().apply {
            put("mesa", mesa)
            put("productos", productosJson)
        }

        try {
            val body = cuerpo.toString().toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url(URL_PEDIDOS)
                .header("Authorization", "Bearer $token")
                .post(body)
                .build()

            client.newCall(request).execute().use { respuesta ->
                val texto = respuesta.body?.string() ?: ""
                if (!respuesta.isSuccessful) {
                    val mensaje = try {
                        JSONObject(texto).getString("mensaje")
                    } catch (_: Exception) {
                        "Error del servidor (${respuesta.code})"
                    }
                    onError(mensaje, respuesta.code)
                    return
                }
                // El pedido ya está creado: si no se puede leer el id no se reporta error (evita duplicados al reintentar)
                val idPedido = try {
                    JSONObject(texto).optInt("id_pedido", -1)
                } catch (_: Exception) {
                    -1
                }
                onExito(idPedido)
            }
        } catch (e: Exception) {
            Log.e("PedidoService", "Fallo al enviar el pedido", e)
            onError("Error de conexión con el servidor", 0)
        }
    }

    // Consulta los pedidos de mesa activos (Pendiente, En preparación, Listo) con el token del Mesero.
    // onExito recibe un mapa id_pedido → estado. Llamar desde Dispatchers.IO.
    fun listarPedidosActivos(
        token: String,
        onExito: (Map<Int, String>) -> Unit,
        onError: (mensaje: String, codigo: Int) -> Unit
    ) {
        try {
            val url = URL_PEDIDOS.toHttpUrl().newBuilder()
                .addQueryParameter("tipo", "mesa")
                .addQueryParameter("estado", "Pendiente,En preparación,Listo")
                .build()
            val request = Request.Builder()
                .url(url)
                .header("Authorization", "Bearer $token")
                .get()
                .build()

            client.newCall(request).execute().use { respuesta ->
                val texto = respuesta.body?.string() ?: ""
                if (!respuesta.isSuccessful) {
                    val mensaje = try {
                        JSONObject(texto).getString("mensaje")
                    } catch (_: Exception) {
                        "Error del servidor (${respuesta.code})"
                    }
                    onError(mensaje, respuesta.code)
                    return
                }

                val estados = mutableMapOf<Int, String>()
                val pedidos = JSONArray(texto)
                for (i in 0 until pedidos.length()) {
                    val pedido = pedidos.getJSONObject(i)
                    estados[pedido.getInt("id_pedido")] = pedido.getString("estado")
                }
                onExito(estados)
            }
        } catch (e: Exception) {
            Log.e("PedidoService", "Fallo al listar pedidos activos", e)
            onError("Error de conexión con el servidor", 0)
        }
    }

    // Cancela un pedido Pendiente con el token del Mesero (llamar desde Dispatchers.IO).
    fun cancelarPedido(
        token: String,
        idPedido: Int,
        onExito: () -> Unit,
        onError: (mensaje: String, codigo: Int) -> Unit
    ) {
        try {
            val request = Request.Builder()
                .url("$URL_PEDIDOS/$idPedido/cancelar")
                .header("Authorization", "Bearer $token")
                .put("".toRequestBody(null))
                .build()

            client.newCall(request).execute().use { respuesta ->
                val texto = respuesta.body?.string() ?: ""
                if (!respuesta.isSuccessful) {
                    val mensaje = try {
                        JSONObject(texto).getString("mensaje")
                    } catch (_: Exception) {
                        "Error del servidor (${respuesta.code})"
                    }
                    onError(mensaje, respuesta.code)
                    return
                }
                onExito()
            }
        } catch (e: Exception) {
            Log.e("PedidoService", "Fallo al cancelar el pedido", e)
            onError("Error de conexión con el servidor", 0)
        }
    }

    // Marca un pedido Listo como Entregado con el token del Mesero (llamar desde Dispatchers.IO).
    fun marcarEntregado(
        token: String,
        idPedido: Int,
        onExito: () -> Unit,
        onError: (mensaje: String, codigo: Int) -> Unit
    ) {
        try {
            val cuerpo = JSONObject().apply { put("estado", "Entregado") }
            val request = Request.Builder()
                .url("$URL_PEDIDOS/$idPedido")
                .header("Authorization", "Bearer $token")
                .put(cuerpo.toString().toRequestBody("application/json".toMediaType()))
                .build()

            client.newCall(request).execute().use { respuesta ->
                val texto = respuesta.body?.string() ?: ""
                if (!respuesta.isSuccessful) {
                    val mensaje = try {
                        JSONObject(texto).getString("mensaje")
                    } catch (_: Exception) {
                        "Error del servidor (${respuesta.code})"
                    }
                    onError(mensaje, respuesta.code)
                    return
                }
                onExito()
            }
        } catch (e: Exception) {
            Log.e("PedidoService", "Fallo al marcar el pedido como entregado", e)
            onError("Error de conexión con el servidor", 0)
        }
    }
}