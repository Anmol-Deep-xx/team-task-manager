const { pool } = require("../config/database");

async function createSprint({
  project_id,
  name,
  goal,
  start_date,
  end_date,
  created_by,
}) {
  const [result] = await pool.execute(
    `INSERT INTO sprints (project_id, name, goal, start_date, end_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      project_id,
      name,
      goal || null,
      start_date || null,
      end_date || null,
      created_by,
    ],
  );
  return result.insertId;
}

async function listProjectSprints(projectId) {
  const [rows] = await pool.execute(
    `SELECT s.*, u.name AS created_by_name
     FROM sprints s
     JOIN users u ON u.id = s.created_by
     WHERE s.project_id = ?
     ORDER BY s.is_active DESC, s.start_date DESC, s.created_at DESC`,
    [projectId],
  );
  return rows;
}

async function findById(sprintId) {
  const [rows] = await pool.execute(
    "SELECT * FROM sprints WHERE id = ? LIMIT 1",
    [sprintId],
  );
  return rows[0] || null;
}

async function findByProjectAndId(projectId, sprintId) {
  const [rows] = await pool.execute(
    "SELECT * FROM sprints WHERE id = ? AND project_id = ? LIMIT 1",
    [sprintId, projectId],
  );
  return rows[0] || null;
}

async function findByProjectAndName(projectId, name) {
  const [rows] = await pool.execute(
    "SELECT id FROM sprints WHERE project_id = ? AND name = ? LIMIT 1",
    [projectId, name],
  );
  return rows[0] || null;
}

module.exports = {
  createSprint,
  listProjectSprints,
  findById,
  findByProjectAndId,
  findByProjectAndName,
};
