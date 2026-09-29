package com.example.mariacochitaapp.activities

import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.example.mariacochitaapp.R
import com.example.mariacochitaapp.models.ItemPedido
import com.example.mariacochitaapp.network.PedidoService
import com.example.mariacochitaapp.ui.VistaPedidoHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import com.example.mariacochitaapp.utils.NotificationHelper
import com.example.mariacochitaapp.services.MonitorPedidoService
import android.content.Intent

class PedidoActivity : AppCompatActivity() {

    private val productosDisponibles = listOf(
        Pair("Hamburguesa", 15000),
        Pair("Papas Fritas", 8000),
        Pair("Hot Dog", 10000),
        Pair("Gaseosa", 4000)
    )

    private val pedidoActual = mutableListOf<ItemPedido>()
    private lateinit var contenedorResumen: LinearLayout
    private lateinit var spinnerMesa: Spinner

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
        val btnEnviar = findViewById<Button>(R.id.btnEnviarPedido)

        configurarSpinnerMesa()

        VistaPedidoHelper.renderizarProductos(
            this,
            contenedorProductos,
            productosDisponibles
        ) { nombre, precio ->
            agregarProducto(nombre, precio)
        }

        btnEnviar.setOnClickListener {
            enviarPedido(spinnerMesa.selectedItem.toString())
        }
    }

    // Configura el spinner de mesas y fuerza el texto en negro (evita el gris del tema)
    private fun configurarSpinnerMesa() {
        val mesas = listOf("Seleccione mesa", "Mesa 1", "Mesa 2", "Mesa 3")
        spinnerMesa.adapter =
            ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, mesas)
        spinnerMesa.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(
                parent: AdapterView<*>?,
                view: View?,
                position: Int,
                id: Long
            ) {
                (view as? TextView)?.setTextColor(com.example.mariacochitaapp.utils.Colores.NEGRO)
            }

            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }
    }

    // Agrega un producto al pedido actual o incrementa su cantidad si ya existe
    private fun agregarProducto(nombre: String, precio: Int) {
        val existente = pedidoActual.find { it.nombre == nombre }
        if (existente != null) {
            existente.cantidad++
        } else {
            pedidoActual.add(ItemPedido(nombre, precio, 1))
        }
        actualizarResumen()
    }

    // Redibuja el resumen del pedido actual
    private fun actualizarResumen() {
        VistaPedidoHelper.renderizarResumen(this, contenedorResumen, pedidoActual) { item ->
            pedidoActual.remove(item)
            actualizarResumen()
        }
    }

    // Valida y envía el pedido al backend
    private fun enviarPedido(mesa: String) {
        if (mesa == "Seleccione mesa") {
            Toast.makeText(this, "Seleccione una mesa", Toast.LENGTH_SHORT).show()
            return
        }
        if (pedidoActual.isEmpty()) {
            Toast.makeText(this, "Agregue al menos un producto", Toast.LENGTH_SHORT).show()
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            PedidoService.enviarPedido(
                mesa = mesa,
                productos = pedidoActual,
                onExito = {
                    PedidoService.obtenerIdUltimoPedido(
                        onResultado = { idPedido ->
                            CoroutineScope(Dispatchers.Main).launch {
                                Toast.makeText(
                                    this@PedidoActivity,
                                    "Pedido enviado a cocina",
                                    Toast.LENGTH_SHORT
                                ).show()
                                pedidoActual.clear()
                                actualizarResumen()
                                spinnerMesa.setSelection(0)

                                val intentServicio = Intent(
                                    this@PedidoActivity,
                                    MonitorPedidoService::class.java
                                )
                                intentServicio.putExtra("idPedido", idPedido)
                                startForegroundService(intentServicio)
                            }
                        },
                        onError = { }
                    )
                },
                onError = {
                    CoroutineScope(Dispatchers.Main).launch {
                        Toast.makeText(
                            this@PedidoActivity,
                            "Error de conexión con el servidor",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }
            )
        }
    }
}