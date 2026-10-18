package com.example.mariacochitaapp.network

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import com.example.mariacochitaapp.BuildConfig
import java.io.IOException

// Encapsula las llamadas de red relacionadas con empleados
object EmpleadoService {

    private val URL_LOGIN = "${BuildConfig.API_URL}/empleados/login"
    private val client = OkHttpClient()

    // Valida el login contra el backend (correo + contraseña).
    // onExito recibe el cargo del empleado si las credenciales son correctas.
    // onError recibe un mensaje describiendo la causa (credenciales inválidas o fallo de conexión).
    fun validarLogin(correo: String, contrasena: String, onExito: (String) -> Unit, onError: (String) -> Unit) {
        val cuerpoJson = JSONObject().apply {
            put("correo", correo)
            put("contrasena", contrasena)
        }

        try {
            val body = cuerpoJson.toString().toRequestBody("application/json".toMediaType())
            val request = Request.Builder().url(URL_LOGIN).post(body).build()
            val respuesta = client.newCall(request).execute()

            if (!respuesta.isSuccessful) {
                onError("Credenciales inválidas")
                return
            }

            val cuerpo = respuesta.body?.string() ?: ""
            val datos = JSONObject(cuerpo)
            val cargo = datos.getJSONObject("empleado").getString("cargo")
            onExito(cargo)
        } catch (_: Exception) {
            onError("Error de conexión con el servidor")
        }
    }
}