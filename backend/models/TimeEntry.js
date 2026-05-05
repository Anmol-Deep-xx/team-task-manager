const { pool } = require("../config/database");

let timeEntriesSchemaReadyPromise = null;

async function ensureTimeEntriesSchema() {
  if (!timeEntriesSchemaReadyPromise) {
    timeEntriesSchemaReadyPromise = (async () => {
      try {
        await pool.execute(
          "ALTER TABLE time_entries MODIFY COLUMN time_logged DECIMAL(10, 4) NOT NULL COMMENT 'in hours'",
        );
      } catch (_error) {
        // Continue even if ALTER TABLE is not permitted; app logic still works with existing schema.
      }
    })();
  }

  await timeEntriesSchemaReadyPromise;
}

function normalizeDateForSql(dateInput) {
  if (!dateInput) return new Date().toISOString().split("T")[0];
  return new Date(dateInput).toISOString().split("T")[0];
}

async function createTimeEntry({
  task_id,
  logged_by,
  time_logged,
  date_logged,
}) {
  await ensureTimeEntriesSchema();

  const normalizedDate = normalizeDateForSql(date_logged);
  const [existingRows] = await pool.execute(
    `SELECT id, time_logged
     FROM time_entries
     WHERE task_id = ? AND logged_by = ? AND date_logged = ?
     ORDER BY id ASC
     LIMIT 1`,
    [task_id, logged_by, normalizedDate],
  );

  if (existingRows.length > 0) {
    const existing = existingRows[0];
    const mergedHours =
      Number(existing.time_logged || 0) + Number(time_logged || 0);
    await pool.execute(
      `UPDATE time_entries
       SET time_logged = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [mergedHours, existing.id],
    );
    return existing.id;
  }

  const [result] = await pool.execute(
    `INSERT INTO time_entries (task_id, logged_by, time_logged, date_logged)
     VALUES (?, ?, ?, ?)`,
    [task_id, logged_by, Number(time_logged || 0), normalizedDate],
  );
  return Number(result.insertId);
}

async function findById(timeEntryId) {
  const [rows] = await pool.execute(
    "SELECT * FROM time_entries WHERE id = ? LIMIT 1",
    [timeEntryId],
  );
  return rows[0] || null;
}

async function getByTask(taskId, sortBy = "date_logged", sortOrder = "desc") {
  await ensureTimeEntriesSchema();

  const allowedSortBy = ["date_logged", "created_at", "time_logged"];
  const orderBy = allowedSortBy.includes(sortBy) ? sortBy : "date_logged";
  const order = sortOrder === "asc" ? "ASC" : "DESC";

  const [rows] = await pool.execute(
    `SELECT
      MIN(te.id) AS id,
      te.task_id,
      te.logged_by,
      te.date_logged,
      MIN(te.created_at) AS created_at,
      MAX(te.updated_at) AS updated_at,
      ROUND(SUM(te.time_logged), 4) AS time_logged,
      u.name AS logged_by_name
     FROM time_entries te
     JOIN users u ON u.id = te.logged_by
     WHERE te.task_id = ?
     GROUP BY te.task_id, te.logged_by, te.date_logged, u.name
     ORDER BY ${orderBy === "created_at" ? "created_at" : orderBy} ${order}`,
    [taskId],
  );

  const [sumRows] = await pool.execute(
    `SELECT COALESCE(SUM(time_logged), 0) AS total_time_logged
     FROM time_entries
     WHERE task_id = ?`,
    [taskId],
  );

  return {
    entries: rows,
    total_time_logged: Number(sumRows[0].total_time_logged || 0),
  };
}

async function getTaskLoggedTotal(taskId, excludeEntryId = null) {
  await ensureTimeEntriesSchema();

  const where = ["task_id = ?"];
  const params = [taskId];

  if (excludeEntryId) {
    where.push("id <> ?");
    params.push(excludeEntryId);
  }

  const [rows] = await pool.execute(
    `SELECT COALESCE(SUM(time_logged), 0) AS total_time_logged
     FROM time_entries
     WHERE ${where.join(" AND ")}`,
    params,
  );

  return Number(rows[0]?.total_time_logged || 0);
}

async function updateTimeEntry(timeEntryId, payload) {
  await ensureTimeEntriesSchema();

  const fields = [];
  const params = [];

  Object.entries(payload).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    params.push(value);
  });

  if (!fields.length) {
    return;
  }

  params.push(timeEntryId);
  await pool.execute(
    `UPDATE time_entries SET ${fields.join(", ")} WHERE id = ?`,
    params,
  );
}

async function deleteTimeEntry(timeEntryId) {
  await ensureTimeEntriesSchema();
  await pool.execute("DELETE FROM time_entries WHERE id = ?", [timeEntryId]);
}

async function getByUserHistory(
  userId,
  { page = 1, pageSize = 100, projectId = null } = {},
) {
  await ensureTimeEntriesSchema();

  const where = ["te.logged_by = ?"];
  const params = [userId];

  if (projectId) {
    where.push("t.project_id = ?");
    params.push(Number(projectId));
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const safePageSize = Math.max(1, Number(pageSize) || 100);
  const safeOffset = Math.max(0, (Number(page) - 1) * safePageSize);

  const [rows] = await pool.execute(
    `SELECT
      MIN(te.id) AS id,
      te.task_id,
      te.logged_by,
      te.date_logged,
      MIN(te.created_at) AS created_at,
      MAX(te.updated_at) AS updated_at,
      ROUND(SUM(te.time_logged), 4) AS time_logged,
      t.task_name,
      t.project_id,
      p.name AS project_name,
      NULL AS notes
     FROM time_entries te
     JOIN tasks t ON t.id = te.task_id
     JOIN projects p ON p.id = t.project_id
     ${whereSql}
     GROUP BY te.task_id, te.logged_by, te.date_logged, t.task_name, t.project_id, p.name
     ORDER BY te.date_logged DESC, created_at DESC
     LIMIT ${safePageSize} OFFSET ${safeOffset}`,
    params,
  );

  const [sumRows] = await pool.execute(
    `SELECT COALESCE(SUM(te.time_logged), 0) AS total_time_logged
     FROM time_entries te
     JOIN tasks t ON t.id = te.task_id
     ${whereSql}`,
    params,
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total_items
     FROM (
       SELECT te.task_id, te.logged_by, te.date_logged
       FROM time_entries te
       JOIN tasks t ON t.id = te.task_id
       ${whereSql}
       GROUP BY te.task_id, te.logged_by, te.date_logged
     ) grouped_entries`,
    params,
  );

  return {
    items: rows,
    totalItems: Number(countRows[0]?.total_items || 0),
    totalLogged: Number(sumRows[0]?.total_time_logged || 0),
  };
}

module.exports = {
  createTimeEntry,
  findById,
  getByTask,
  getByUserHistory,
  getTaskLoggedTotal,
  updateTimeEntry,
  deleteTimeEntry,
};
