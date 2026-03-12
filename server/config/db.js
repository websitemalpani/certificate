const mysql = require("mysql2/promise");
const env = require("./env");
const logger = require("../utils/logger");

const pool = mysql.createPool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  port: env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const verifyConnection = async () => {
  try {
    const connection = await pool.getConnection();
    connection.release();
    logger.info("MySQL connected", {
      host: env.DB_HOST,
      database: env.DB_NAME,
      port: env.DB_PORT,
    });
  } catch (error) {
    logger.error("MySQL connection failed", { message: error.message });
    process.exit(1);
  }
};

verifyConnection();

module.exports = pool;
