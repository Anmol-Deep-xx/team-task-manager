require('dotenv').config();
const { pool } = require("./config/database");

async function check() {
  try {
    const [rows] = await pool.query("SHOW TABLES");
    console.log("TABLES:", rows);
  } catch (err) {
    console.error("ERROR:", err.message);
  } finally {
    process.exit(0);
  }
}
check();
