package com.example.mariacochitaapp.utils

import android.text.InputType
import android.widget.EditText
import android.widget.ImageView

// Alterna la visibilidad de un campo de contraseña, reutilizable en cualquier pantalla
object PasswordToggleHelper {

    fun activar(inputContrasena: EditText, botonOjo: ImageView) {
        var visible = false

        botonOjo.setOnClickListener {
            visible = !visible
            if (visible) {
                inputContrasena.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
                botonOjo.setImageResource(android.R.drawable.ic_menu_close_clear_cancel)
            } else {
                inputContrasena.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
                botonOjo.setImageResource(android.R.drawable.ic_menu_view)
            }
            inputContrasena.setSelection(inputContrasena.text.length)
        }
    }
}