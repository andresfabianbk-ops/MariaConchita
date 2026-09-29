package com.example.mariacochitaapp.utils

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat

// Crea el canal de notificaciones (obligatorio desde Android 8) y muestra avisos
object NotificationHelper {

    private const val CANAL_ID = "canal_pedidos"

    // Crea el canal de notificaciones, debe llamarse antes de mostrar cualquier notificación
    fun crearCanal(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val canal = NotificationChannel(
                CANAL_ID,
                "Pedidos listos",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Avisa cuando un pedido está listo para recoger"
            }
            val manager = context.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(canal)
        }
    }

    // Muestra una notificación al usuario
    fun mostrarNotificacion(context: Context, id: Int, titulo: String, mensaje: String) {
        val notificacion = NotificationCompat.Builder(context, CANAL_ID)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(titulo)
            .setContentText(mensaje)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()

        val manager = context.getSystemService(NotificationManager::class.java)
        manager.notify(id, notificacion)
    }

    fun getCanalId() = CANAL_ID
}