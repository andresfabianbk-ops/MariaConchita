package com.example.mariacochitaapp.services

import android.app.Service
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.example.mariacochitaapp.network.PedidoService
import com.example.mariacochitaapp.utils.NotificationHelper
import com.example.mariacochitaapp.utils.PedidosLocales
import com.example.mariacochitaapp.utils.SesionApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import com.example.mariacochitaapp.activities.PedidoActivity

// Servicio en primer plano: cada 5 segundos consulta el estado de los pedidos enviados desde este celular
// y notifica al Mesero cuando cocina marca alguno como "Listo". Se detiene solo cuando no queda ningún pedido activo.
class MonitorPedidoService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private val alcance = CoroutineScope(Dispatchers.IO + SupervisorJob())

    // Pedidos que ya se avisaron como "Listo" (evita notificar dos veces el mismo)
    private val pedidosNotificados = mutableSetOf<Int>()

    // Evita lanzar una consulta nueva mientras la anterior sigue en curso
    @Volatile
    private var consultando = false

    private val tareaConsulta = object : Runnable {
        override fun run() {
            consultarPedidos()
            handler.postDelayed(this, 5000)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notificacionServicio = NotificationCompat.Builder(this, NotificationHelper.getCanalId())
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle("Mariaconchita")
            .setContentText("Esperando confirmación de cocina...")
            .build()

        if (android.os.Build.VERSION.SDK_INT >= 34) {
            startForeground(1, notificacionServicio, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(1, notificacionServicio)
        }

        // Si el servicio ya estaba activo (nuevo pedido enviado), reinicia el ciclo sin duplicarlo
        handler.removeCallbacks(tareaConsulta)
        handler.post(tareaConsulta)

        // Sin reinicio automático: reiniciado por el sistema no tendría contexto
        return START_NOT_STICKY
    }

    // Descarga los pedidos activos con el token del Mesero (una sola llamada por ciclo)
    private fun consultarPedidos() {
        if (consultando) return

        val token = SesionApp.obtenerToken(this)
        if (token == null) {
            stopSelf()
            return
        }

        consultando = true
        alcance.launch {
            PedidoService.listarPedidosActivos(
                token = token,
                onExito = { estados ->
                    consultando = false
                    procesarEstados(estados)
                },
                onError = { _, codigo ->
                    consultando = false
                    // Token vencido: el servicio ya no sirve; los demás errores se reintentan en 5 s
                    if (codigo == 401) stopSelf()
                }
            )
        }
    }

    // Notifica los pedidos que pasaron a "Listo" y se detiene si ya no hay pedidos activos de este celular
    private fun procesarEstados(estados: Map<Int, String>) {
        val activos = PedidosLocales.listar(this).filter { it.idPedido in estados.keys }

        if (activos.isEmpty()) {
            stopSelf()
            return
        }

        activos
            .filter { estados[it.idPedido] == "Listo" && it.idPedido !in pedidosNotificados }
            .forEach { pedido ->
                NotificationHelper.mostrarNotificacion(
                    this,
                    1000 + pedido.idPedido,
                    "Pedido #${pedido.idPedido} listo",
                    "Ya puede recoger el pedido de la mesa ${pedido.mesa}",
                    Intent(this, PedidoActivity::class.java).apply {
                        // Reutiliza la pantalla si ya está abierta y la lleva a "En espera"
                        flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                        putExtra("abrir_en_espera", true)
                    }
                )
                pedidosNotificados.add(pedido.idPedido)
            }
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(tareaConsulta)
        alcance.cancel()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}