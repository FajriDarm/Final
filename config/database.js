const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'affiliate_system',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_CONNECTION_LIMIT) || 25,
  queueLimit: 0
});

const promisePool = pool.promise();

module.exports = promisePool;
