package com.example.mariacochitaapp.network

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import com.example.mariacochitaapp.BuildConfig
import android.util.Log
import java.io.IOException

// Encapsula las llamadas de red relacionadas con empleados
object EmpleadoService {

    private val URL_LOGIN = "${BuildConfig.API_URL}/empleados/login"
    private val client = OkHttpClient()

    // Valida el login contra el backend (correo + contraseña).
    // onExito recibe el cargo del empleado si las credenciales son correctas.
    // onError recibe un mensaje describiendo la causa (credenciales inválidas o fallo de conexión).
    // Valida el login contra el backend (correo + contraseña).
    // onExito recibe el token JWT y el objeto empleado de la respuesta.
    // onError recibe el mensaje del backend o un texto de fallo de conexión.
    fun validarLogin(
        correo: String,
        contrasena: String,
        onExito: (token: String, empleado: JSONObject) -> Unit,
        onError: (String) -> Unit
    ) {
        val cuerpoJson = JSONObject().apply {
            put("correo", correo)
            put("contrasena", contrasena)
        }

        try {
            val body = cuerpoJson.toString().toRequestBody("application/json".toMediaType())
            val request = Request.Builder().url(URL_LOGIN).post(body).build()

            client.newCall(request).execute().use { respuesta ->
                val cuerpo = respuesta.body?.string() ?: ""

                if (!respuesta.isSuccessful) {
                    val mensaje = try {
                        JSONObject(cuerpo).getString("mensaje")
                    } catch (_: Exception) {
                        "Error del servidor (${respuesta.code})"
                    }
                    onError(mensaje)
                    return
                }

                val datos = JSONObject(cuerpo)
                onExito(datos.getString("token"), datos.getJSONObject("empleado"))
            }
        } catch (e: Exception) {
            Log.e("EmpleadoService", "Fallo en validarLogin", e)
            onError("Error de conexión con el servidor")
        }
    }
}