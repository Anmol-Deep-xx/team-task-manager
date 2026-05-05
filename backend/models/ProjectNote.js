const { pool } = require("../config/database");

let projectNoteSchemaReadyPromise = null;

async function ensureProjectNoteSchema() {
  if (!projectNoteSchemaReadyPromise) {
    projectNoteSchemaReadyPromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS project_notes (
          id INT PRIMARY KEY AUTO_INCREMENT,
          project_id INT NOT NULL,
          note_text TEXT NOT NULL,
          created_by INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_project_notes_project (project_id),
          INDEX idx_project_notes_created_by (created_by)
        )
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS project_note_assignees (
          id INT PRIMARY KEY AUTO_INCREMENT,
          project_note_id INT NOT NULL,
          user_id INT NOT NULL,
          UNIQUE KEY uq_project_note_user (project_note_id, user_id),
          FOREIGN KEY (project_note_id) REFERENCES project_notes(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_project_note_assignees_note (project_note_id),
          INDEX idx_project_note_assignees_user (user_id)
        )
      `);
    })();
  }

  await projectNoteSchemaReadyPromise;
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

async function createNote({ projectId, noteText, createdBy, assigneeIds }) {
  await ensureProjectNoteSchema();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [noteResult] = await connection.execute(
      `INSERT INTO project_notes (project_id, note_text, created_by)
       VALUES (?, ?, ?)`,
      [projectId, noteText, createdBy],
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
        `INSERT INTO project_note_assignees (project_note_id, user_id)
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
  await ensureProjectNoteSchema();

  const [rows] = await pool.execute(
    `SELECT pn.*, u.name AS created_by_name
     FROM project_notes pn
     JOIN users u ON u.id = pn.created_by
     WHERE pn.id = ?
     LIMIT 1`,
    [noteId],
  );
  return rows[0] || null;
}

async function getNotesByProject(projectId, viewerId, role) {
  await ensureProjectNoteSchema();

  const params = [projectId];
  let accessClause = "";

  if (role === "member") {
    accessClause = `
      AND EXISTS (
        SELECT 1
        FROM project_note_assignees pna_filter
        WHERE pna_filter.project_note_id = pn.id
          AND pna_filter.user_id = ?
      )
    `;
    params.push(viewerId);
  }

  const [rows] = await pool.execute(
    `SELECT
      pn.id,
      pn.project_id,
      pn.note_text,
      pn.created_by,
      u.name AS created_by_name,
      pn.created_at,
      pn.updated_at,
      pna.user_id AS assignee_id,
      au.name AS assignee_name
     FROM project_notes pn
     JOIN users u ON u.id = pn.created_by
     LEFT JOIN project_note_assignees pna ON pna.project_note_id = pn.id
     LEFT JOIN users au ON au.id = pna.user_id
     WHERE pn.project_id = ? ${accessClause}
     ORDER BY pn.created_at DESC, pn.id DESC`,
    params,
  );

  const noteMap = new Map();
  for (const row of rows) {
    if (!noteMap.has(row.id)) {
      noteMap.set(row.id, {
        id: row.id,
        project_id: row.project_id,
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
  await ensureProjectNoteSchema();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE project_notes
       SET note_text = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [noteText, noteId],
    );

    await connection.execute(
      "DELETE FROM project_note_assignees WHERE project_note_id = ?",
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
        `INSERT INTO project_note_assignees (project_note_id, user_id)
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
  await ensureProjectNoteSchema();

  await pool.execute("DELETE FROM project_notes WHERE id = ?", [noteId]);
}

module.exports = {
  createNote,
  getNoteById,
  getNotesByProject,
  updateNote,
  deleteNote,
};
