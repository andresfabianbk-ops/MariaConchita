package com.example.mariacochitaapp.services

import android.app.Service
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.example.mariacochitaapp.network.PedidoService
import com.example.mariacochitaapp.utils.NotificationHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

// Servicio en segundo plano: consulta el estado del pedido cada 5 segundos
// y notifica al Mesero cuando cocina lo marca como "Listo"
class MonitorPedidoService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var idPedidoMonitoreado = -1
    private var ultimoEstadoNotificado = ""
    private var numeroMesa = "?"

    private val tareaConsulta = object : Runnable {
        override fun run() {
            // La consulta de red se ejecuta en un hilo de fondo, nunca en el principal
            CoroutineScope(Dispatchers.IO).launch {
                consultarEstado()
            }
            handler.postDelayed(this, 5000)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        idPedidoMonitoreado = intent?.getIntExtra("id_pedido", -1) ?: -1

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

        handler.post(tareaConsulta)
        return START_STICKY
    }

    // Consulta el backend y notifica cuando cambia a "En preparación" o "Listo"
    private fun consultarEstado() {
        if (idPedidoMonitoreado == -1) return

        PedidoService.consultarMesa(
            idPedido = idPedidoMonitoreado,
            onResultado = { mesa -> numeroMesa = mesa },
            onError = { }
        )

        PedidoService.consultarEstado(
            idPedido = idPedidoMonitoreado,
            onResultado = { estado ->
                if (estado != ultimoEstadoNotificado) {
                    when (estado) {
                        "En preparación" -> {
                            NotificationHelper.mostrarNotificacion(
                                this,
                                idPedidoMonitoreado,
                                "Pedido en preparación",
                                "La cocina ya está preparando el pedido de la mesa $numeroMesa"
                            )
                            ultimoEstadoNotificado = estado
                        }
                        "Listo" -> {
                            NotificationHelper.mostrarNotificacion(
                                this,
                                idPedidoMonitoreado,
                                "Pedido listo",
                                "Ya puede recoger el pedido de la mesa $numeroMesa"
                            )
                            ultimoEstadoNotificado = estado
                            stopSelf()
                        }
                    }
                }
            },
            onError = { }
        )
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(tareaConsulta)
    }

    override fun onBind(intent: Intent?): IBinder? = null
}