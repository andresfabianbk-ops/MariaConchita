// Servidor principal del sistema Mariaconchita
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pedidoRoutes = require('./routes/pedidoRoutes');
const pagoRoutes = require('./routes/pagoRoutes');
const empleadoRoutes = require('./routes/empleadoRoutes');
const menuRoutes = require('./routes/menuRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');

const app = express();
const PUERTO = 3000;

app.use(cors());
app.use(express.json());
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/pagos', pagoRoutes);
app.use('/api/empleados', empleadoRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/categorias', categoriaRoutes);

app.listen(PUERTO, '0.0.0.0', () => {
  console.log(`Servidor Mariaconchita corriendo en puerto ${PUERTO}`);
});