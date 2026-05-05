const { pool } = require("../config/database");

async function createComment({ task_id, commented_by, comment_text }) {
  const [result] = await pool.execute(
    `INSERT INTO task_comments (task_id, commented_by, comment_text)
     VALUES (?, ?, ?)`,
    [task_id, commented_by, comment_text],
  );
  return result.insertId;
}

async function findCommentById(commentId) {
  const [rows] = await pool.execute(
    "SELECT * FROM task_comments WHERE id = ? LIMIT 1",
    [commentId],
  );
  return rows[0] || null;
}

async function getCommentsByTask(
  taskId,
  sortBy = "created_at",
  sortOrder = "desc",
  currentUserId,
) {
  const allowedSortBy = ["created_at", "updated_at"];
  const orderBy = allowedSortBy.includes(sortBy) ? sortBy : "created_at";
  const order = sortOrder === "asc" ? "ASC" : "DESC";

  const [rows] = await pool.execute(
    `SELECT c.*, u.name AS author_name
     FROM task_comments c
     JOIN users u ON u.id = c.commented_by
     WHERE c.task_id = ? AND c.commented_by = ?
     ORDER BY c.${orderBy} ${order}`,
    [taskId, currentUserId],
  );

  return rows;
}

async function updateComment(commentId, newText) {
  await pool.execute("UPDATE task_comments SET comment_text = ? WHERE id = ?", [
    newText,
    commentId,
  ]);
}

async function createCommentEditHistory({
  comment_id,
  edited_by,
  previous_text,
  new_text,
}) {
  await pool.execute(
    `INSERT INTO comment_edit_history (comment_id, edited_by, previous_text, new_text)
     VALUES (?, ?, ?, ?)`,
    [comment_id, edited_by, previous_text, new_text],
  );
}

async function deleteComment(commentId) {
  await pool.execute("DELETE FROM task_comments WHERE id = ?", [commentId]);
}

async function getCommentEditHistory(commentId) {
  const [rows] = await pool.execute(
    `SELECT h.*, u.name AS edited_by_name
     FROM comment_edit_history h
     JOIN users u ON u.id = h.edited_by
     WHERE h.comment_id = ?
     ORDER BY h.edited_at DESC`,
    [commentId],
  );
  return rows;
}

module.exports = {
  createComment,
  findCommentById,
  getCommentsByTask,
  updateComment,
  createCommentEditHistory,
  deleteComment,
  getCommentEditHistory,
};
