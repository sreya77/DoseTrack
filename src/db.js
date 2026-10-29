const mysql = require('mysql2/promise');

const poolConfig = (process.env.DATABASE_URL || process.env.MYSQL_URL)
  ? {
      uri: process.env.DATABASE_URL || process.env.MYSQL_URL,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true
    }
  : {
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'dosetrack',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true
    };

module.exports = mysql.createPool(poolConfig);

