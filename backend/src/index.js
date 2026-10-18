// Servidor principal del sistema Mariaconchita
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pedidoRoutes = require('./routes/pedidoRoutes');
const pagoRoutes = require('./routes/pagoRoutes');
const empleadoRoutes = require('./routes/empleadoRoutes');
const turnoRoutes = require('./routes/turnoRoutes');
const menuRoutes = require('./routes/menuRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');

const app = express();
const PUERTO = process.env.PORT || 3000; // configurable desde .env; 3000 por defecto

app.use(cors());
app.use(express.json());
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/pagos', pagoRoutes);
app.use('/api/empleados', empleadoRoutes);
app.use('/api/turnos', turnoRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/categorias', categoriaRoutes);
// Sirve el frontend desde la misma dirección y puerto que la API (misma origen, sin IP fija)
app.use(express.static(path.join(__dirname, '../../frontend')));

app.listen(PUERTO, '0.0.0.0', () => {
  console.log(`Servidor Mariaconchita corriendo en puerto ${PUERTO}`);
});