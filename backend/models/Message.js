const { pool } = require("../config/database");

let messagesTableReadyPromise = null;

async function ensureMessagesTable() {
  if (!messagesTableReadyPromise) {
    messagesTableReadyPromise = pool.execute(`
      CREATE TABLE IF NOT EXISTS task_messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        task_id INT NOT NULL,
        sender_id INT NOT NULL,
        message_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_messages_task (task_id),
        INDEX idx_messages_sender (sender_id)
      )
    `);
  }

  await messagesTableReadyPromise;
}

async function createMessage({ task_id, sender_id, message_text }) {
  await ensureMessagesTable();
  const [result] = await pool.execute(
    `INSERT INTO task_messages (task_id, sender_id, message_text)
     VALUES (?, ?, ?)`,
    [task_id, sender_id, message_text],
  );

  return result.insertId;
}

async function getMessagesByTask(taskId) {
  await ensureMessagesTable();
  const [rows] = await pool.execute(
    `SELECT m.*, u.name AS sender_name, u.profile_picture AS sender_profile_picture, u.role AS sender_role
     FROM task_messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.task_id = ?
     ORDER BY m.created_at ASC`,
    [taskId],
  );

  return rows;
}

module.exports = {
  createMessage,
  getMessagesByTask,
};
