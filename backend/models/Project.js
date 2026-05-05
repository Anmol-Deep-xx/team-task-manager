const { pool } = require("../config/database");

async function createProject({
  name,
  client_name,
  project_source,
  internal_notes,
  lead_reviewed_by,
  member_ids = [],
}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `INSERT INTO projects (name, client_name, project_source, internal_notes, lead_reviewed_by)
       VALUES (?, ?, ?, ?, ?)`,
      [
        name,
        client_name,
        project_source,
        internal_notes || null,
        lead_reviewed_by,
      ],
    );

    const projectId = result.insertId;
    await replaceProjectMembers(
      projectId,
      member_ids,
      lead_reviewed_by,
      connection,
    );

    await connection.commit();
    return projectId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function findById(projectId) {
  const [rows] = await pool.execute(
    "SELECT * FROM projects WHERE id = ? LIMIT 1",
    [projectId],
  );
  return rows[0] || null;
}

async function findByName(name) {
  const [rows] = await pool.execute(
    "SELECT id FROM projects WHERE name = ? LIMIT 1",
    [name],
  );
  return rows[0] || null;
}

async function listProjects({
  page,
  pageSize,
  search,
  isActive,
  userId,
  role,
}) {
  const where = [];
  const params = [];

  if (role === "admin") {
    // Admin can access all projects.
  } else if (role === "team_lead") {
    where.push("p.lead_reviewed_by = ?");
    params.push(userId);
  } else {
    where.push(
      "EXISTS (SELECT 1 FROM project_members pmx WHERE pmx.project_id = p.id AND pmx.member_id = ?)",
    );
    params.push(userId);
  }

  if (search) {
    where.push("(p.name LIKE ? OR p.client_name LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (typeof isActive === "boolean") {
    where.push("p.is_active = ?");
    params.push(isActive);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM projects p
     ${whereSql}`,
    params,
  );

  const safePageSize = Math.max(1, Number(pageSize) || 10);
  const safeOffset = Math.max(0, (Number(page) - 1) * safePageSize);
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
     LIMIT ${safePageSize} OFFSET ${safeOffset}`,
    params,
  );

  return { rows, totalItems: countRows[0].total };
}

async function getProjectWithTasks(projectId) {
  const [projectRows] = await pool.execute(
    "SELECT * FROM projects WHERE id = ? LIMIT 1",
    [projectId],
  );
  const project = projectRows[0] || null;
  if (!project) {
    return null;
  }

  const [tasks] = await pool.execute(
    `SELECT t.*, u.name AS assignee_name
     FROM tasks t
     JOIN users u ON u.id = t.assigned_to
     WHERE t.project_id = ?
     ORDER BY t.created_at DESC`,
    [projectId],
  );

  const members = await getProjectMembers(projectId);

  return { ...project, tasks, members };
}

async function replaceProjectMembers(
  projectId,
  memberIds,
  addedBy,
  connection = pool,
) {
  await connection.execute("DELETE FROM project_members WHERE project_id = ?", [
    projectId,
  ]);

  const normalizedIds = [...new Set((memberIds || []).map(Number))].filter(
    (id) => Number.isInteger(id) && id > 0,
  );

  if (!normalizedIds.length) {
    return;
  }

  const placeholders = normalizedIds.map(() => "(?, ?, ?)").join(", ");
  const params = normalizedIds.flatMap((memberId) => [
    projectId,
    memberId,
    addedBy,
  ]);

  await connection.execute(
    `INSERT INTO project_members (project_id, member_id, added_by)
     VALUES ${placeholders}`,
    params,
  );
}

async function hasProjectAccess(projectId, userId, role) {
  if (role === "admin") {
    const [rows] = await pool.execute(
      "SELECT id FROM projects WHERE id = ? LIMIT 1",
      [projectId],
    );
    return Boolean(rows[0]);
  }

  if (role === "team_lead") {
    const [rows] = await pool.execute(
      "SELECT id FROM projects WHERE id = ? AND lead_reviewed_by = ? LIMIT 1",
      [projectId, userId],
    );
    return Boolean(rows[0]);
  }

  const [rows] = await pool.execute(
    `SELECT pm.id
     FROM project_members pm
     JOIN projects p ON p.id = pm.project_id
     WHERE pm.project_id = ? AND pm.member_id = ? AND p.is_active = TRUE
     LIMIT 1`,
    [projectId, userId],
  );
  return Boolean(rows[0]);
}

async function isProjectMember(projectId, memberId) {
  const [rows] = await pool.execute(
    "SELECT id FROM project_members WHERE project_id = ? AND member_id = ? LIMIT 1",
    [projectId, memberId],
  );
  return Boolean(rows[0]);
}

async function updateProject(projectId, payload) {
  const fields = [];
  const params = [];

  Object.entries(payload).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    params.push(value);
  });

  if (!fields.length) {
    return;
  }

  params.push(projectId);
  await pool.execute(
    `UPDATE projects SET ${fields.join(", ")} WHERE id = ?`,
    params,
  );
}

async function deactivateProject(projectId) {
  await pool.execute("UPDATE projects SET is_active = FALSE WHERE id = ?", [
    projectId,
  ]);
}

async function getProjectMembers(projectId) {
  const [rows] = await pool.execute(
    `SELECT u.id, u.name, u.email, u.contact_number, u.profile_picture
     FROM project_members pm
     JOIN users u ON u.id = pm.member_id
     WHERE pm.project_id = ? AND u.is_active = TRUE
     ORDER BY u.name ASC`,
    [projectId],
  );
  return rows;
}

module.exports = {
  createProject,
  findById,
  findByName,
  listProjects,
  getProjectWithTasks,
  updateProject,
  deactivateProject,
  getProjectMembers,
  replaceProjectMembers,
  hasProjectAccess,
  isProjectMember,
};
