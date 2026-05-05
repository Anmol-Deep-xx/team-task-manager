require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

async function migrate() {
  const dbName = process.env.DB_NAME || process.env.MYSQLDATABASE;

  if (!dbName) {
    console.error("Missing DB_NAME or MYSQLDATABASE");
    process.exit(1);
  }

  try {
    console.log("Connecting to MySQL database:", dbName);

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || process.env.MYSQLHOST || "localhost",
      user: process.env.DB_USER || process.env.MYSQLUSER || "root",
      password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || "",
      database: dbName,
      port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
      multipleStatements: true,
    });

    const schemaPath = path.join(__dirname, "sql", "schema.sql");
    let sql = fs.readFileSync(schemaPath, "utf8");

    sql = sql
      .replace(/CREATE DATABASE IF NOT EXISTS task_scheduler;\s*/i, "")
      .replace(/USE task_scheduler;\s*/i, "");

    console.log("Running SQL schema migration...");
    await connection.query(sql);

    console.log("Migration successful. Tables created.");
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exit(1);
  }
}

migrate();