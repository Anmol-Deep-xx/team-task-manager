const { pool } = require("../config/database");

let taskNoteSchemaReadyPromise = null;

async function ensureTaskNoteSchema() {
  if (!taskNoteSchemaReadyPromise) {
    taskNoteSchemaReadyPromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS task_notes (
          id INT PRIMARY KEY AUTO_INCREMENT,
          task_id INT NOT NULL,
          note_text TEXT NOT NULL,
          created_by INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_task_notes_task (task_id),
          INDEX idx_task_notes_created_by (created_by)
        )
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS task_note_assignees (
          id INT PRIMARY KEY AUTO_INCREMENT,
          task_note_id INT NOT NULL,
          user_id INT NOT NULL,
          UNIQUE KEY uq_task_note_user (task_note_id, user_id),
          FOREIGN KEY (task_note_id) REFERENCES task_notes(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_task_note_assignees_note (task_note_id),
          INDEX idx_task_note_assignees_user (user_id)
        )
      `);
    })();
  }

  await taskNoteSchemaReadyPromise;
}

function normalizeIds(ids = []) {
  return Array.from(
    new Set(
      (ids || [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );
}

async function createNote({ taskId, noteText, createdBy, assigneeIds }) {
  await ensureTaskNoteSchema();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [noteResult] = await connection.execute(
      `INSERT INTO task_notes (task_id, note_text, created_by)
       VALUES (?, ?, ?)`,
      [taskId, noteText, createdBy],
    );

    const noteId = noteResult.insertId;
    const normalizedAssigneeIds = normalizeIds(assigneeIds);

    if (normalizedAssigneeIds.length > 0) {
      const values = normalizedAssigneeIds.map(() => "(?, ?)").join(", ");
      const params = normalizedAssigneeIds.flatMap((userId) => [
        noteId,
        userId,
      ]);
      await connection.execute(
        `INSERT INTO task_note_assignees (task_note_id, user_id)
         VALUES ${values}`,
        params,
      );
    }

    await connection.commit();
    return noteId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getNoteById(noteId) {
  await ensureTaskNoteSchema();

  const [rows] = await pool.execute(
    `SELECT tn.*, u.name AS created_by_name
     FROM task_notes tn
     JOIN users u ON u.id = tn.created_by
     WHERE tn.id = ?
     LIMIT 1`,
    [noteId],
  );
  return rows[0] || null;
}

async function getNotesByTask(taskId, viewerId, role) {
  await ensureTaskNoteSchema();

  const params = [taskId];
  let accessClause = "";

  if (role === "member") {
    accessClause = `
      AND EXISTS (
        SELECT 1
        FROM task_note_assignees tna_filter
        WHERE tna_filter.task_note_id = tn.id
          AND tna_filter.user_id = ?
      )
    `;
    params.push(viewerId);
  }

  const [rows] = await pool.execute(
    `SELECT
      tn.id,
      tn.task_id,
      tn.note_text,
      tn.created_by,
      u.name AS created_by_name,
      tn.created_at,
      tn.updated_at,
      tna.user_id AS assignee_id,
      au.name AS assignee_name
     FROM task_notes tn
     JOIN users u ON u.id = tn.created_by
     LEFT JOIN task_note_assignees tna ON tna.task_note_id = tn.id
     LEFT JOIN users au ON au.id = tna.user_id
     WHERE tn.task_id = ? ${accessClause}
     ORDER BY tn.created_at DESC, tn.id DESC`,
    params,
  );

  const noteMap = new Map();
  for (const row of rows) {
    if (!noteMap.has(row.id)) {
      noteMap.set(row.id, {
        id: row.id,
        task_id: row.task_id,
        note_text: row.note_text,
        created_by: row.created_by,
        created_by_name: row.created_by_name,
        created_at: row.created_at,
        updated_at: row.updated_at,
        assignees: [],
      });
    }

    if (row.assignee_id) {
      noteMap.get(row.id).assignees.push({
        id: row.assignee_id,
        name: row.assignee_name,
      });
    }
  }

  return Array.from(noteMap.values());
}

async function updateNote({ noteId, noteText, assigneeIds }) {
  await ensureTaskNoteSchema();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE task_notes
       SET note_text = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [noteText, noteId],
    );

    await connection.execute(
      "DELETE FROM task_note_assignees WHERE task_note_id = ?",
      [noteId],
    );

    const normalizedAssigneeIds = normalizeIds(assigneeIds);
    if (normalizedAssigneeIds.length > 0) {
      const values = normalizedAssigneeIds.map(() => "(?, ?)").join(", ");
      const params = normalizedAssigneeIds.flatMap((userId) => [
        noteId,
        userId,
      ]);
      await connection.execute(
        `INSERT INTO task_note_assignees (task_note_id, user_id)
         VALUES ${values}`,
        params,
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteNote(noteId) {
  await ensureTaskNoteSchema();

  await pool.execute("DELETE FROM task_notes WHERE id = ?", [noteId]);
}

module.exports = {
  createNote,
  getNoteById,
  getNotesByTask,
  updateNote,
  deleteNote,
};
