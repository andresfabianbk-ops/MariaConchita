// Configuración de conexión a la base de datos MySQL
const mysql = require('mysql2');

// Crea el pool de conexiones (reutiliza conexiones en vez de abrir una nueva cada vez).
// Las credenciales se leen del archivo backend/.env (ignorado por Git), nunca del código.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'mariaconchita_db',
  waitForConnections: true,
  connectionLimit: 10
});

// Exporta la versión con promesas, para poder usar async/await
module.exports = pool.promise();