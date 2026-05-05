require("dotenv").config();
const mysql = require("mysql2/promise");

async function alterTable() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "task_scheduler",
      port: Number(process.env.DB_PORT || 3306),
    });

    console.log("Adding profile_picture column to users table...");
    // Ignoring error if column already exists
    try {
      await connection.query(
        "ALTER TABLE users ADD COLUMN profile_picture VARCHAR(500);",
      );
      console.log("✅ Column added successfully!");
    } catch (e) {
      if (e.code === "ER_DUP_FIELDNAME") {
        console.log("Column already exists.");
      } else {
        throw e;
      }
    }

    console.log("Ensuring project_members table exists...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS project_members (
        id INT PRIMARY KEY AUTO_INCREMENT,
        project_id INT NOT NULL,
        member_id INT NOT NULL,
        added_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_project_member (project_id, member_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_project_members_project (project_id),
        INDEX idx_project_members_member (member_id)
      );
    `);
    console.log("✅ project_members table is ready.");

    console.log("Ensuring admin role is allowed in users.role enum...");
    await connection.query(
      "ALTER TABLE users MODIFY COLUMN role ENUM('admin','team_lead','member') DEFAULT 'member';",
    );
    console.log("✅ users.role enum updated.");

    console.log("Ensuring due_date column exists in tasks table...");
    try {
      await connection.query(
        "ALTER TABLE tasks ADD COLUMN due_date DATE NULL AFTER estimated_time;",
      );
      console.log("✅ due_date column added to tasks.");
    } catch (e) {
      if (e.code === "ER_DUP_FIELDNAME") {
        console.log("due_date column already exists.");
      } else {
        throw e;
      }
    }

    console.log("Ensuring sprints table exists...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sprints (
        id INT PRIMARY KEY AUTO_INCREMENT,
        project_id INT NOT NULL,
        name VARCHAR(120) NOT NULL,
        goal TEXT,
        start_date DATE NULL,
        end_date DATE NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_sprints_project_name (project_id, name),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id),
        INDEX idx_sprints_project (project_id)
      );
    `);
    console.log("✅ sprints table is ready.");

    console.log("Ensuring sprint_id column exists in tasks table...");
    try {
      await connection.query(
        "ALTER TABLE tasks ADD COLUMN sprint_id INT NULL AFTER project_id;",
      );
      console.log("✅ sprint_id column added to tasks.");
    } catch (e) {
      if (e.code === "ER_DUP_FIELDNAME") {
        console.log("sprint_id column already exists.");
      } else {
        throw e;
      }
    }

    console.log("Ensuring sprint_id foreign key exists...");
    try {
      await connection.query(
        "ALTER TABLE tasks ADD CONSTRAINT fk_tasks_sprint FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL;",
      );
      console.log("✅ fk_tasks_sprint foreign key added.");
    } catch (e) {
      if (e.code === "ER_DUP_KEYNAME") {
        console.log("fk_tasks_sprint foreign key already exists.");
      } else {
        console.log("Skipping foreign key add:", e.message);
      }
    }

    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Alter failed:", error.message);
    process.exit(1);
  }
}

alterTable();
