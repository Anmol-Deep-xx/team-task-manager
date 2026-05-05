const cron = require("node-cron");
const { pool } = require("../config/database");
const { sendNotification } = require("./notificationService");
const logger = require("../utils/logger");

let started = false;

async function fetchOverdueTasks() {
  const [rows] = await pool.execute(
    `SELECT t.id, t.task_name, t.due_date, t.project_id, p.lead_reviewed_by
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     WHERE t.is_active = TRUE
       AND t.due_date IS NOT NULL
       AND t.due_date < CURDATE()
       AND t.status <> 'complete'`,
  );

  return rows;
}

async function wasOverdueAlertSentToday(taskId) {
  const [rows] = await pool.execute(
    `SELECT id
     FROM notifications
     WHERE type = 'overdue_alert'
       AND reference_type = 'task'
       AND reference_id = ?
       AND DATE(created_at) = CURDATE()
     LIMIT 1`,
    [taskId],
  );

  return Boolean(rows[0]);
}

async function getTaskRecipientIds(taskId, leadId) {
  const [assignees] = await pool.execute(
    `SELECT member_id
     FROM task_assignees
     WHERE task_id = ?`,
    [taskId],
  );

  return Array.from(
    new Set(
      [...assignees.map((row) => Number(row.member_id)), Number(leadId)].filter(
        (id) => Number.isInteger(id) && id > 0,
      ),
    ),
  );
}

async function runOverdueNotificationSweep() {
  const tasks = await fetchOverdueTasks();

  for (const task of tasks) {
    const alreadySent = await wasOverdueAlertSentToday(task.id);
    if (alreadySent) {
      continue;
    }

    const recipientUserIds = await getTaskRecipientIds(
      task.id,
      task.lead_reviewed_by,
    );

    if (recipientUserIds.length === 0) {
      continue;
    }

    await sendNotification({
      recipientUserIds,
      type: "overdue_alert",
      title: "Task Overdue",
      body: `${task.task_name} is overdue. Due: ${String(task.due_date).slice(0, 10)}`,
      reference_id: task.id,
      reference_type: "task",
    });
  }
}

function startOverdueNotificationJob() {
  if (started) {
    return;
  }

  started = true;

  cron.schedule("0 * * * *", async () => {
    try {
      await runOverdueNotificationSweep();
    } catch (error) {
      logger.error(`Overdue notification job failed: ${error.message}`);
    }
  });
}

module.exports = {
  startOverdueNotificationJob,
  runOverdueNotificationSweep,
};
