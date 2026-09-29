// Configuración de conexión a la base de datos MySQL
const mysql = require('mysql2');

// Crea el pool de conexiones (reutiliza conexiones en vez de abrir una nueva cada vez)
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Andres1072',
  database: 'mariaconchita_db',
  waitForConnections: true,
  connectionLimit: 10
});

// Exporta la versión con promesas, para poder usar async/await
module.exports = pool.promise();
