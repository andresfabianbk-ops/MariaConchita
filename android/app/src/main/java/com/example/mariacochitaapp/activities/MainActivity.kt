package com.example.mariacochitaapp.activities

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.example.mariacochitaapp.R
import com.example.mariacochitaapp.network.EmpleadoService
import com.example.mariacochitaapp.utils.PasswordToggleHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import com.example.mariacochitaapp.utils.SesionApp

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Si ya hay una sesión guardada, entra directo a la pantalla de pedidos sin pedir login
        if (SesionApp.obtenerToken(this) != null) {
            startActivity(Intent(this, PedidoActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_main)

        val inputCorreo = findViewById<EditText>(R.id.inputCorreo)
        val inputContrasena = findViewById<EditText>(R.id.inputContrasena)
        val btnIngresar = findViewById<Button>(R.id.btnIngresar)
        val btnMostrarContrasena = findViewById<ImageView>(R.id.btnMostrarContrasena)

        PasswordToggleHelper.activar(inputContrasena, btnMostrarContrasena)

        btnIngresar.setOnClickListener {
            val correo = inputCorreo.text.toString().trim()
            val contrasena = inputContrasena.text.toString()

            if (correo.isEmpty() || contrasena.isEmpty()) {
                Toast.makeText(this, "Complete correo y contraseña", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            validarLogin(correo, contrasena)
        }
    }

    // Ejecuta la validación de login en segundo plano y reacciona al resultado
    private fun validarLogin(correo: String, contrasena: String) {
        CoroutineScope(Dispatchers.IO).launch {
            EmpleadoService.validarLogin(
                correo = correo,
                contrasena = contrasena,
                onExito = { token, empleado ->
                    CoroutineScope(Dispatchers.Main).launch {
                        if (empleado.getString("cargo") == "Mesero") {
                            val nombre = "${empleado.getString("nombres")} ${empleado.getString("apellidos")}"
                            SesionApp.guardar(this@MainActivity, token, nombre)
                            Toast.makeText(this@MainActivity, "Bienvenido, $nombre", Toast.LENGTH_SHORT).show()
                            startActivity(Intent(this@MainActivity, PedidoActivity::class.java))
                            finish()
                        } else {
                            Toast.makeText(this@MainActivity, "Esta app es exclusiva para Meseros", Toast.LENGTH_SHORT).show()
                        }
                    }
                },
                onError = { mensaje ->
                    CoroutineScope(Dispatchers.Main).launch {
                        Toast.makeText(this@MainActivity, mensaje, Toast.LENGTH_SHORT).show()
                    }
                }
            )
        }
    }
}