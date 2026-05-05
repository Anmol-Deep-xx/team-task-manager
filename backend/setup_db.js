require("dotenv").config();
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

async function setup() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "task_scheduler",
      port: Number(process.env.DB_PORT || 3306),
      multipleStatements: true,
    });

    const schema = fs.readFileSync(path.join(__dirname, "sql", "schema.sql"), "utf-8");
    await connection.query(schema);
    console.log("Schema applied successfully.");
    
    await connection.end();
  } catch (error) {
    console.error("Schema error:", error);
  } finally {
    process.exit(0);
  }
}

setup();
