package com.example.mariacochitaapp.utils

import android.content.Context

// Guarda la sesión del Mesero (token JWT y nombre) en SharedPreferences
object SesionApp {

    private const val ARCHIVO = "sesion_mesero"
    private const val CLAVE_TOKEN = "token"
    private const val CLAVE_NOMBRE = "nombre"

    fun guardar(context: Context, token: String, nombre: String) {
        context.getSharedPreferences(ARCHIVO, Context.MODE_PRIVATE).edit()
            .putString(CLAVE_TOKEN, token)
            .putString(CLAVE_NOMBRE, nombre)
            .apply()
    }

    fun obtenerToken(context: Context): String? =
        context.getSharedPreferences(ARCHIVO, Context.MODE_PRIVATE).getString(CLAVE_TOKEN, null)

    fun obtenerNombre(context: Context): String? =
        context.getSharedPreferences(ARCHIVO, Context.MODE_PRIVATE).getString(CLAVE_NOMBRE, null)

    fun cerrar(context: Context) {
        context.getSharedPreferences(ARCHIVO, Context.MODE_PRIVATE).edit().clear().apply()
    }
}