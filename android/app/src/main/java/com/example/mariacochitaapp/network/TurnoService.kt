package com.example.mariacochitaapp.network

import android.util.Log
import com.example.mariacochitaapp.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

// Aviso del backend al iniciar turno cuando el turno anterior quedó sin cierre
data class AvisoTurno(val mensaje: String, val cierresVaciosMes: Int, val bloqueado: Boolean)

// Resultado de iniciar turno: id del turno nuevo y aviso (null si no hubo cierre vacío)
data class ResultadoInicioTurno(val idTurno: Int, val aviso: AvisoTurno?)

// Llamadas OkHttp síncronas a /turnos; se invocan desde Dispatchers.IO
object TurnoService {

    private val cliente = OkHttpClient()
    private val URL_TURNOS = "${BuildConfig.API_URL}/turnos"

    // GET /turnos/actual → true si el Mesero tiene un turno abierto hoy (el backend devuelve el turno o null)
    fun consultarActual(
        token: String,
        onExito: (turnoAbierto: Boolean) -> Unit,
        onError: (mensaje: String, codigo: Int) -> Unit
    ) {
        val peticion = Request.Builder()
            .url("$URL_TURNOS/actual")
            .header("Authorization", "Bearer $token")
            .get()
            .build()
        ejecutar(peticion, { cuerpo ->
            onExito(cuerpo.isNotBlank() && cuerpo.trim() != "null")
        }, onError)
    }

    // POST /turnos/iniciar → 201 {id_turno, aviso}; 409 si ya hay turno abierto hoy
    fun iniciar(
        token: String,
        onExito: (ResultadoInicioTurno) -> Unit,
        onError: (mensaje: String, codigo: Int) -> Unit
    ) {
        val peticion = Request.Builder()
            .url("$URL_TURNOS/iniciar")
            .header("Authorization", "Bearer $token")
            .post("".toRequestBody())
            .build()
        ejecutar(peticion, { cuerpo ->
            val json = JSONObject(cuerpo)
            val aviso = json.optJSONObject("aviso")?.let {
                AvisoTurno(
                    it.optString("mensaje"),
                    it.optInt("cierresVaciosMes"),
                    it.optBoolean("bloqueado")
                )
            }
            onExito(ResultadoInicioTurno(json.optInt("id_turno"), aviso))
        }, onError)
    }

    // PUT /turnos/finalizar → 200; 404 si no hay turno abierto hoy
    fun finalizar(
        token: String,
        onExito: () -> Unit,
        onError: (mensaje: String, codigo: Int) -> Unit
    ) {
        val peticion = Request.Builder()
            .url("$URL_TURNOS/finalizar")
            .header("Authorization", "Bearer $token")
            .put("".toRequestBody())
            .build()
        ejecutar(peticion, { onExito() }, onError)
    }

    // Ejecuta la petición, cierra la respuesta y traduce errores al formato (mensaje, código)
    private fun ejecutar(
        peticion: Request,
        onExito: (cuerpo: String) -> Unit,
        onError: (mensaje: String, codigo: Int) -> Unit
    ) {
        try {
            cliente.newCall(peticion).execute().use { respuesta ->
                val cuerpo = respuesta.body?.string().orEmpty()
                if (respuesta.isSuccessful) {
                    onExito(cuerpo)
                } else {
                    val mensaje = try {
                        JSONObject(cuerpo).optString("mensaje")
                    } catch (e: Exception) {
                        ""
                    }
                    onError(mensaje.ifBlank { "Error del servidor (${respuesta.code})" }, respuesta.code)
                }
            }
        } catch (e: Exception) {
            Log.e("TurnoService", "Error de conexión", e)
            onError("Error de conexión con el servidor", 0)
        }
    }
}