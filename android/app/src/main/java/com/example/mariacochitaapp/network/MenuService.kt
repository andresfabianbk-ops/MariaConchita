package com.example.mariacochitaapp.network

import android.util.Log
import com.example.mariacochitaapp.BuildConfig
import com.example.mariacochitaapp.models.CategoriaMenu
import com.example.mariacochitaapp.models.ProductoMenu
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import com.example.mariacochitaapp.models.Ingrediente

// Carga el menú público (categorías con productos disponibles) desde el backend
object MenuService {

    private val URL_MENU = "${BuildConfig.API_URL}/menu"
    private val client = OkHttpClient()

    // Llamar desde Dispatchers.IO. El precio llega como texto ("18900.00") y se convierte a entero.
    fun obtenerMenu(onExito: (List<CategoriaMenu>) -> Unit, onError: (String) -> Unit) {
        try {
            val request = Request.Builder().url(URL_MENU).get().build()
            client.newCall(request).execute().use { respuesta ->
                val cuerpo = respuesta.body?.string() ?: ""
                if (!respuesta.isSuccessful) {
                    onError("No se pudo cargar el menú (${respuesta.code})")
                    return
                }

                val categorias = mutableListOf<CategoriaMenu>()
                val jsonCategorias = JSONArray(cuerpo)
                for (i in 0 until jsonCategorias.length()) {
                    val jsonCategoria = jsonCategorias.getJSONObject(i)
                    val nombreCategoria = jsonCategoria.getString("categoria")
                    val jsonProductos = jsonCategoria.getJSONArray("productos")
                    if (jsonProductos.length() == 0) continue // categoría vacía: no se muestra

                    val productos = mutableListOf<ProductoMenu>()
                    for (j in 0 until jsonProductos.length()) {
                        val p = jsonProductos.getJSONObject(j)
                        val jsonIngredientes = p.getJSONArray("ingredientes")
                        val ingredientes = mutableListOf<Ingrediente>()
                        for (k in 0 until jsonIngredientes.length()) {
                            val ing = jsonIngredientes.getJSONObject(k)
                            ingredientes.add(
                                Ingrediente(
                                    ing.getInt("id_insumo"),
                                    ing.getString("nombre"),
                                    ing.optBoolean("es_excluible", false)
                                )
                            )
                        }
                        productos.add(
                            ProductoMenu(
                                p.getInt("id"),
                                p.getString("nombre"),
                                p.getString("precio").toDouble().toInt(),
                                nombreCategoria,
                                ingredientes
                            )
                        )
                    }
                    categorias.add(CategoriaMenu(nombreCategoria, productos))
                }
                onExito(categorias)
            }
        } catch (e: Exception) {
            Log.e("MenuService", "Fallo al cargar el menú", e)
            onError("Error de conexión con el servidor")
        }
    }
}