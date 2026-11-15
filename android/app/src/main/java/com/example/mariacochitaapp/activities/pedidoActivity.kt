package com.example.mariacochitaapp.activities

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.example.mariacochitaapp.R
import com.example.mariacochitaapp.models.ItemPedido
import com.example.mariacochitaapp.network.PedidoService
import com.example.mariacochitaapp.network.TurnoService
import com.example.mariacochitaapp.network.AvisoTurno
import com.example.mariacochitaapp.ui.VistaPedidoHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import com.example.mariacochitaapp.utils.NotificationHelper
import com.example.mariacochitaapp.services.MonitorPedidoService
import android.content.Intent
import com.example.mariacochitaapp.models.ProductoMenu
import com.example.mariacochitaapp.network.MenuService
import com.example.mariacochitaapp.models.Ingrediente
import com.example.mariacochitaapp.models.PedidoLocal
import com.example.mariacochitaapp.utils.SesionApp
import com.example.mariacochitaapp.utils.Colores
import com.example.mariacochitaapp.utils.PedidosLocales
import androidx.appcompat.app.AlertDialog

class PedidoActivity : AppCompatActivity() {

    private val pedidoActual = mutableListOf<ItemPedido>()
    private lateinit var contenedorResumen: LinearLayout
    private lateinit var spinnerMesa: Spinner
    private lateinit var btnEnviar: Button
    private lateinit var vistaPedidos: LinearLayout
    private lateinit var vistaEspera: ScrollView
    private lateinit var contenedorEspera: LinearLayout
    private lateinit var tabPedidos: TextView
    private lateinit var tabEspera: TextView

    private lateinit var btnTurno: TextView

    private var turnoAbierto: Boolean? = null // null = aún no se sabe

    // Refresco automático (cada 5 s) de los estados mientras la pestaña "En espera" está a la vista
    private val manejador = Handler(Looper.getMainLooper())
    private val tareaRefrescarEspera = object : Runnable {
        override fun run() {
            refrescarEstadosEspera()
            manejador.postDelayed(this, 5000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_pedido)
        NotificationHelper.crearCanal(this)

        if (android.os.Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1)
            }
        }

        spinnerMesa = findViewById(R.id.spinnerMesa)
        val contenedorProductos = findViewById<LinearLayout>(R.id.contenedorProductos)
        contenedorResumen = findViewById(R.id.contenedorResumen)
        btnEnviar = findViewById(R.id.btnEnviarPedido)

        vistaPedidos = findViewById(R.id.vistaPedidos)
        vistaEspera = findViewById(R.id.vistaEspera)
        contenedorEspera = findViewById(R.id.contenedorEspera)
        tabPedidos = findViewById(R.id.tabPedidos)
        tabEspera = findViewById(R.id.tabEspera)
        findViewById<TextView>(R.id.textoMesero).text = SesionApp.obtenerNombre(this) ?: ""
        findViewById<TextView>(R.id.btnCerrarSesion).setOnClickListener { confirmarCierreSesion() }
        btnTurno = findViewById(R.id.btnTurno)
        btnTurno.isEnabled = false
        btnTurno.setOnClickListener { alTocarTurno() }
        consultarTurno()

        configurarSpinnerMesa()

        tabPedidos.setOnClickListener { mostrarPestana(true) }
        tabEspera.setOnClickListener { mostrarPestana(false) }
        // Abre en "En espera" si viene de tocar la notificación; si no, en "Pedidos"
        mostrarPestana(!intent.getBooleanExtra("abrir_en_espera", false))

        cargarMenu(contenedorProductos)

        btnEnviar.setOnClickListener {
            enviarPedido(spinnerMesa.selectedItemPosition)
        }
    }

    // Si la app ya estaba abierta y el Mesero toca la notificación, la lleva a "En espera"
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.getBooleanExtra("abrir_en_espera", false)) {
            mostrarPestana(false)
        }
    }

    // Retoma el refresco si la pestaña "En espera" estaba a la vista
    override fun onResume() {
        super.onResume()
        if (vistaEspera.visibility == View.VISIBLE) {
            manejador.removeCallbacks(tareaRefrescarEspera)
            manejador.post(tareaRefrescarEspera)
        }
    }

    // Detiene el refresco al salir de la pantalla
    override fun onPause() {
        super.onPause()
        manejador.removeCallbacks(tareaRefrescarEspera)
    }

    // Muestra la pestaña de tomar pedido o la de pedidos en espera y resalta la activa
    private fun mostrarPestana(verPedidos: Boolean) {
        vistaPedidos.visibility = if (verPedidos) View.VISIBLE else View.GONE
        vistaEspera.visibility = if (verPedidos) View.GONE else View.VISIBLE

        tabPedidos.setBackgroundColor(if (verPedidos) Colores.NARANJA else Colores.BLANCO)
        tabPedidos.setTextColor(if (verPedidos) Colores.BLANCO else Colores.NEGRO)
        tabEspera.setBackgroundColor(if (verPedidos) Colores.BLANCO else Colores.NARANJA)
        tabEspera.setTextColor(if (verPedidos) Colores.NEGRO else Colores.BLANCO)

        manejador.removeCallbacks(tareaRefrescarEspera)
        if (!verPedidos) {
            actualizarPedidosEnEspera(emptyMap())
            manejador.post(tareaRefrescarEspera)
        }
    }

    // Redibuja la pestaña "En espera" con los pedidos guardados en este celular y sus estados
    private fun actualizarPedidosEnEspera(estados: Map<Int, String>) {
        VistaPedidoHelper.renderizarPedidosEnEspera(
            this,
            contenedorEspera,
            PedidosLocales.listar(this),
            estados,
            onCancelar = { pedido -> confirmarCancelacion(pedido) },
            onEntregar = { pedido -> entregarPedido(pedido.idPedido) }
        )
    }

    // Pide confirmación antes de cancelar un pedido
    private fun confirmarCancelacion(pedido: PedidoLocal) {
        AlertDialog.Builder(this)
            .setTitle("Cancelar pedido #${pedido.idPedido}")
            .setMessage("¿Cancelar el pedido de la mesa ${pedido.mesa}?")
            .setPositiveButton("Sí, cancelar") { _, _ -> cancelarPedido(pedido.idPedido) }
            .setNegativeButton("No", null)
            .show()
    }

    // Cancela el pedido en el backend y refresca la lista (el pedido cancelado se quita solo)
    private fun cancelarPedido(idPedido: Int) {
        val token = SesionApp.obtenerToken(this)
        if (token == null) {
            volverAlLogin()
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            PedidoService.cancelarPedido(
                token = token,
                idPedido = idPedido,
                onExito = {
                    CoroutineScope(Dispatchers.Main).launch {
                        Toast.makeText(this@PedidoActivity, "Pedido #$idPedido cancelado", Toast.LENGTH_SHORT).show()
                        refrescarEstadosEspera()
                    }
                },
                onError = { mensaje, codigo ->
                    CoroutineScope(Dispatchers.Main).launch {
                        if (codigo == 401) {
                            volverAlLogin()
                        } else {
                            Toast.makeText(this@PedidoActivity, mensaje, Toast.LENGTH_LONG).show()
                        }
                    }
                }
            )
        }
    }

    // Marca el pedido como entregado en el backend y refresca la lista (el pedido entregado se quita solo)
    private fun entregarPedido(idPedido: Int) {
        val token = SesionApp.obtenerToken(this)
        if (token == null) {
            volverAlLogin()
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            PedidoService.marcarEntregado(
                token = token,
                idPedido = idPedido,
                onExito = {
                    CoroutineScope(Dispatchers.Main).launch {
                        Toast.makeText(this@PedidoActivity, "Pedido #$idPedido entregado", Toast.LENGTH_SHORT).show()
                        refrescarEstadosEspera()
                    }
                },
                onError = { mensaje, codigo ->
                    CoroutineScope(Dispatchers.Main).launch {
                        if (codigo == 401) {
                            volverAlLogin()
                        } else {
                            Toast.makeText(this@PedidoActivity, mensaje, Toast.LENGTH_LONG).show()
                        }
                    }
                }
            )
        }
    }

    // Consulta al backend el estado de los pedidos activos y redibuja la pestaña "En espera"
    private fun refrescarEstadosEspera() {
        val token = SesionApp.obtenerToken(this)
        if (token == null) {
            volverAlLogin()
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            PedidoService.listarPedidosActivos(
                token = token,
                onExito = { estados ->
                    CoroutineScope(Dispatchers.Main).launch {
                        // Los pedidos que ya no están activos (entregados o cancelados) dejan de recordarse
                        PedidosLocales.listar(this@PedidoActivity)
                            .filter { it.idPedido !in estados.keys }
                            .forEach { PedidosLocales.eliminar(this@PedidoActivity, it.idPedido) }
                        actualizarPedidosEnEspera(estados)
                    }
                },
                onError = { _, codigo ->
                    CoroutineScope(Dispatchers.Main).launch {
                        // Los demás errores se ignoran: se reintenta en 5 segundos
                        if (codigo == 401) volverAlLogin()
                    }
                }
            )
        }
    }

    // Configura el spinner de mesas y fuerza el texto en negro (evita el gris del tema)
    private fun configurarSpinnerMesa() {
        val mesas = listOf("Seleccione mesa") + (1..10).map { "Mesa $it" }
        spinnerMesa.adapter =
            ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, mesas)
        spinnerMesa.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(
                parent: AdapterView<*>?,
                view: View?,
                position: Int,
                id: Long
            ) {
                (view as? TextView)?.setTextColor(Colores.NEGRO)
            }

            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }
    }

    // Si el producto tiene ingredientes abre el modal para quitar; si no, lo agrega directo
    private fun alTocarProducto(producto: ProductoMenu) {
        if (producto.ingredientes.isEmpty()) {
            agregarProducto(producto, emptyList())
        } else {
            VistaPedidoHelper.mostrarModalIngredientes(this, producto) { excluidos ->
                agregarProducto(producto, excluidos)
            }
        }
    }

    // Suma 1 si ya hay una línea con el mismo producto y las mismas exclusiones; si no, crea una línea nueva
    private fun agregarProducto(producto: ProductoMenu, excluidos: List<Ingrediente>) {
        val idsExcluidos = excluidos.map { it.idInsumo }.toSet()
        val existente = pedidoActual.find {
            it.idProducto == producto.id && it.excluidos.map { e -> e.idInsumo }.toSet() == idsExcluidos
        }
        if (existente != null) {
            existente.cantidad++
        } else {
            pedidoActual.add(
                ItemPedido(producto.id, "${producto.nombre} (${producto.categoria})", producto.precio, 1, excluidos)
            )
        }
        actualizarResumen()
    }

    // Carga el menú desde el backend y lo dibuja; si falla, avisa con un Toast
    private fun cargarMenu(contenedorProductos: LinearLayout) {
        CoroutineScope(Dispatchers.IO).launch {
            MenuService.obtenerMenu(
                onExito = { categorias ->
                    CoroutineScope(Dispatchers.Main).launch {
                        VistaPedidoHelper.renderizarProductos(
                            this@PedidoActivity,
                            contenedorProductos,
                            categorias
                        ) { producto ->
                            alTocarProducto(producto)
                        }
                    }
                },
                onError = { mensaje ->
                    CoroutineScope(Dispatchers.Main).launch {
                        Toast.makeText(this@PedidoActivity, mensaje, Toast.LENGTH_LONG).show()
                    }
                }
            )
        }
    }

    // Redibuja el resumen del pedido actual
    private fun actualizarResumen() {
        VistaPedidoHelper.renderizarResumen(this, contenedorResumen, pedidoActual) { item ->
            pedidoActual.remove(item)
            actualizarResumen()
        }
    }

    // Valida y envía el pedido al backend con el token del Mesero (mesa: número de mesa, 0 = sin seleccionar)
    private fun enviarPedido(mesa: Int) {
        if (mesa == 0) {
            Toast.makeText(this, "Seleccione una mesa", Toast.LENGTH_SHORT).show()
            return
        }
        if (pedidoActual.isEmpty()) {
            Toast.makeText(this, "Agregue al menos un producto", Toast.LENGTH_SHORT).show()
            return
        }

        val token = SesionApp.obtenerToken(this)
        if (token == null) {
            volverAlLogin()
            return
        }

        val productos = pedidoActual.toList()
        btnEnviar.isEnabled = false
        CoroutineScope(Dispatchers.IO).launch {
            PedidoService.enviarPedido(
                token = token,
                mesa = mesa,
                productos = productos,
                onExito = { idPedido ->
                    CoroutineScope(Dispatchers.Main).launch {
                        btnEnviar.isEnabled = true
                        val aviso = if (idPedido > 0) "Pedido #$idPedido enviado a cocina" else "Pedido enviado a cocina"
                        Toast.makeText(this@PedidoActivity, aviso, Toast.LENGTH_SHORT).show()

                        // Se recuerda el pedido en este celular para seguirlo en "En espera"
                        if (idPedido > 0) {
                            PedidosLocales.guardar(this@PedidoActivity, PedidoLocal(idPedido, mesa, productos))
                            // Arranca (o reinicia) el servicio que avisa cuando cocina marca el pedido como Listo
                            startForegroundService(Intent(this@PedidoActivity, MonitorPedidoService::class.java))
                        }

                        pedidoActual.clear()
                        actualizarResumen()
                        spinnerMesa.setSelection(0)
                    }
                },
                onError = { mensaje, codigo ->
                    CoroutineScope(Dispatchers.Main).launch {
                        btnEnviar.isEnabled = true
                        if (codigo == 401) {
                            volverAlLogin()
                        } else {
                            Toast.makeText(this@PedidoActivity, mensaje, Toast.LENGTH_LONG).show()
                        }
                    }
                }
            )
        }
    }

    // Pide confirmación antes de cerrar la sesión; avisa si hay pedidos en espera en este celular o un turno abierto
    private fun confirmarCierreSesion() {
        val avisos = mutableListOf<String>()
        if (PedidosLocales.listar(this).isNotEmpty()) {
            avisos.add("Los pedidos en espera de este celular dejarán de mostrarse y no recibirá sus avisos de 'Listo'.")
        }
        if (turnoAbierto == true) {
            avisos.add("Tu turno sigue abierto. Si no lo finalizas, podría registrarse como cierre vacío.")
        }
        val mensaje = if (avisos.isEmpty()) "¿Desea salir de la sesión?" else avisos.joinToString("\n\n")
        AlertDialog.Builder(this)
            .setTitle("Cerrar sesión")
            .setMessage(mensaje)
            .setPositiveButton("Cerrar sesión") { _, _ -> cerrarSesion() }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    // Detiene el monitor, borra los pedidos y la sesión de este celular y vuelve al login
    private fun cerrarSesion() {
        stopService(Intent(this, MonitorPedidoService::class.java))
        PedidosLocales.limpiar(this)
        SesionApp.cerrar(this)
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }

    // Texto del botón según el estado del turno
    private fun actualizarBotonTurno() {
        btnTurno.text = when (turnoAbierto) {
            true -> "Finalizar turno"
            false -> "Iniciar turno"
            null -> "Turno"
        }
        btnTurno.isEnabled = true
    }

    // Consulta si el Mesero ya tiene turno abierto hoy
    private fun consultarTurno() {
        val token = SesionApp.obtenerToken(this) ?: run { volverAlLogin(); return }
        CoroutineScope(Dispatchers.IO).launch {
            TurnoService.consultarActual(
                token,
                onExito = { abierto ->
                    runOnUiThread {
                        turnoAbierto = abierto
                        actualizarBotonTurno()
                    }
                },
                onError = { mensaje, codigo ->
                    runOnUiThread { manejarErrorTurno(mensaje, codigo) }
                }
            )
        }
    }

    // Si no se conoce el estado reintenta la consulta; si no, inicia o finaliza
    private fun alTocarTurno() {
        when (turnoAbierto) {
            null -> consultarTurno()
            true -> confirmarFinalizarTurno()
            false -> iniciarTurno()
        }
    }

    private fun iniciarTurno() {
        val token = SesionApp.obtenerToken(this) ?: run { volverAlLogin(); return }
        btnTurno.isEnabled = false
        CoroutineScope(Dispatchers.IO).launch {
            TurnoService.iniciar(
                token,
                onExito = { resultado ->
                    runOnUiThread {
                        turnoAbierto = true
                        actualizarBotonTurno()
                        Toast.makeText(this@PedidoActivity, "Turno iniciado", Toast.LENGTH_SHORT).show()
                        // Provisional: el diálogo del aviso llega en el Paso 3
                        resultado.aviso?.let { mostrarAvisoTurno(it) }
                    }
                },
                onError = { mensaje, codigo ->
                    runOnUiThread { manejarErrorTurno(mensaje, codigo) }
                }
            )
        }
    }


    private fun finalizarTurno() {
        val token = SesionApp.obtenerToken(this) ?: run { volverAlLogin(); return }
        btnTurno.isEnabled = false
        CoroutineScope(Dispatchers.IO).launch {
            TurnoService.finalizar(
                token,
                onExito = {
                    runOnUiThread {
                        turnoAbierto = false
                        actualizarBotonTurno()
                        Toast.makeText(this@PedidoActivity, "Turno finalizado", Toast.LENGTH_SHORT).show()
                    }
                },
                onError = { mensaje, codigo ->
                    runOnUiThread { manejarErrorTurno(mensaje, codigo) }
                }
            )
        }
    }

    // 401 vuelve al login; 409 y 404 sincronizan el botón con el servidor; otros errores solo avisan
    private fun manejarErrorTurno(mensaje: String, codigo: Int) {
        when (codigo) {
            401 -> { volverAlLogin(); return }
            409 -> { turnoAbierto = true; actualizarBotonTurno() }
            404 -> { turnoAbierto = false; actualizarBotonTurno() }
            else -> btnTurno.isEnabled = true
        }
        Toast.makeText(this, mensaje, Toast.LENGTH_LONG).show()
    }

    // Aviso del backend: turno anterior sin cierre, o cuenta bloqueada por llegar al límite del mes
    private fun mostrarAvisoTurno(aviso: AvisoTurno) {
        AlertDialog.Builder(this)
            .setTitle(if (aviso.bloqueado) "Cuenta bloqueada" else "Turno anterior sin cierre")
            .setMessage(aviso.mensaje)
            .setPositiveButton("Entendido", null)
            .setCancelable(false)
            .show()
    }

    // Evita cerrar el turno por un toque accidental
    private fun confirmarFinalizarTurno() {
        AlertDialog.Builder(this)
            .setTitle("Finalizar turno")
            .setMessage("¿Registrar el cierre de tu turno?")
            .setPositiveButton("Sí, finalizar") { _, _ -> finalizarTurno() }
            .setNegativeButton("No", null)
            .show()
    }

    // Cierra la sesión guardada y regresa a la pantalla de login
    private fun volverAlLogin() {
        SesionApp.cerrar(this)
        Toast.makeText(this, "Sesión no válida, inicie sesión de nuevo", Toast.LENGTH_LONG).show()
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}