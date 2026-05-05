const { pool } = require("./config/database");

async function test() {
  try {
    const userId = 1;
    let page = 1;
    let pageSize = 100;
    
    const where = ["p.lead_reviewed_by = ?"];
    const params = [userId];

    const whereSql = `WHERE ${where.join(" ")}`;
    
    const offset = (page - 1) * pageSize;
    console.log("params:", [...params, pageSize, offset]);
    
    const [rows] = await pool.execute(
      `SELECT p.*,
          COUNT(DISTINCT t.id) AS task_count,
          COUNT(DISTINCT pm.member_id) AS assigned_members
       FROM projects p
       LEFT JOIN tasks t ON t.project_id = p.id AND t.is_active = TRUE
        LEFT JOIN project_members pm ON pm.project_id = p.id
       ${whereSql}
       GROUP BY p.id
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );
    console.log("Success");
  } catch (err) {
    console.error("SQL_ERROR:", err.message);
  } finally {
    process.exit(0);
  }
}
test();
