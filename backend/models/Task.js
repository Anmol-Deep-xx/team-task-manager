const { pool } = require("../config/database");

let taskAssigneesTableReadyPromise = null;
let taskAssigneeStatusColumnReadyPromise = null;

function isMissingDueDateColumnError(error) {
  return (
    error &&
    error.code === "ER_BAD_FIELD_ERROR" &&
    String(error.message || "").includes("due_date")
  );
}

function isMissingTaskAssigneesTableError(error) {
  return (
    error &&
    error.code === "ER_NO_SUCH_TABLE" &&
    String(error.message || "").includes("task_assignees")
  );
}

async function ensureTaskAssigneesTable() {
  if (!taskAssigneesTableReadyPromise) {
    taskAssigneesTableReadyPromise = pool.execute(`
      CREATE TABLE IF NOT EXISTS task_assignees (
        id INT PRIMARY KEY AUTO_INCREMENT,
        task_id INT NOT NULL,
        member_id INT NOT NULL,
        assignee_status ENUM('active', 'dependence', 'released') DEFAULT 'active',
        added_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_task_member (task_id, member_id),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_task_assignees_task (task_id),
        INDEX idx_task_assignees_member (member_id)
      )
    `);
  }

  await taskAssigneesTableReadyPromise;
}

async function ensureTaskAssigneeStatusColumn() {
  await ensureTaskAssigneesTable();

  if (!taskAssigneeStatusColumnReadyPromise) {
    taskAssigneeStatusColumnReadyPromise = pool
      .execute(
        `ALTER TABLE task_assignees
         ADD COLUMN assignee_status ENUM('active', 'dependence', 'released') DEFAULT 'active'`,
      )
      .catch((error) => {
        if (error && error.code === "ER_DUP_FIELDNAME") {
          return;
        }
        throw error;
      });
  }

  await taskAssigneeStatusColumnReadyPromise;
}

async function createTask({
  project_id,
  sprint_id,
  task_name,
  description,
  assigned_to,
  estimated_time,
  due_date,
  priority,
  created_by,
}) {
  let result;
  try {
    [result] = await pool.execute(
      `INSERT INTO tasks (project_id, sprint_id, task_name, description, assigned_to, estimated_time, due_date, priority, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project_id,
        sprint_id || null,
        task_name,
        description || null,
        assigned_to,
        estimated_time,
        due_date,
        priority || "medium",
        created_by,
      ],
    );
  } catch (error) {
    if (!isMissingDueDateColumnError(error)) {
      throw error;
    }

    [result] = await pool.execute(
      `INSERT INTO tasks (project_id, sprint_id, task_name, description, assigned_to, estimated_time, priority, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project_id,
        sprint_id || null,
        task_name,
        description || null,
        assigned_to,
        estimated_time,
        priority || "medium",
        created_by,
      ],
    );
  }

  return result.insertId;
}

async function findById(taskId) {
  const [rows] = await pool.execute(
    "SELECT * FROM tasks WHERE id = ? LIMIT 1",
    [taskId],
  );
  return rows[0] || null;
}

async function listProjectTasks(projectId, filters) {
  const allowedSortBy = [
    "created_at",
    "estimated_time",
    "priority",
    "due_date",
  ];
  const sortBy = allowedSortBy.includes(filters.sortBy)
    ? filters.sortBy
    : "created_at";
  const sortOrder = filters.sortOrder === "asc" ? "ASC" : "DESC";

  const where = ["t.project_id = ?", "t.is_active = TRUE"];
  const params = [projectId];

  if (filters.status) {
    where.push("t.status = ?");
    params.push(filters.status);
  }
  if (filters.priority) {
    where.push("t.priority = ?");
    params.push(filters.priority);
  }
  if (filters.assigned_to) {
    where.push("t.assigned_to = ?");
    params.push(Number(filters.assigned_to));
  }
  if (filters.sprint_id === "none") {
    where.push("t.sprint_id IS NULL");
  } else if (filters.sprint_id) {
    where.push("t.sprint_id = ?");
    params.push(Number(filters.sprint_id));
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM tasks t ${whereSql}`,
    params,
  );

  const safePageSize = Math.max(1, Number(filters.pageSize) || 10);
  const safeOffset = Math.max(0, (Number(filters.page) - 1) * safePageSize);
  let rows;
  try {
    [rows] = await pool.execute(
      `SELECT t.*, u.name AS assigned_user_name, u.profile_picture AS assigned_user_profile_picture, p.name AS project_name, s.name AS sprint_name,
        CASE
          WHEN t.due_date IS NOT NULL AND CURDATE() > t.due_date AND t.status <> 'complete'
          THEN TRUE
          ELSE FALSE
        END AS is_due_date_overdue
       FROM tasks t
       JOIN users u ON u.id = t.assigned_to
       JOIN projects p ON p.id = t.project_id
      LEFT JOIN sprints s ON s.id = t.sprint_id
       ${whereSql}
       ORDER BY t.${sortBy} ${sortOrder}
       LIMIT ${safePageSize} OFFSET ${safeOffset}`,
      params,
    );
  } catch (error) {
    if (!isMissingDueDateColumnError(error)) {
      throw error;
    }

    const safeSortBy = sortBy === "due_date" ? "created_at" : sortBy;
    [rows] = await pool.execute(
      `SELECT t.*, u.name AS assigned_user_name, u.profile_picture AS assigned_user_profile_picture, p.name AS project_name, s.name AS sprint_name,
        FALSE AS is_due_date_overdue
       FROM tasks t
       JOIN users u ON u.id = t.assigned_to
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN sprints s ON s.id = t.sprint_id
       ${whereSql}
       ORDER BY t.${safeSortBy} ${sortOrder}
       LIMIT ${safePageSize} OFFSET ${safeOffset}`,
      params,
    );
  }

  return { rows, totalItems: countRows[0].total };
}

async function listMemberTasks(memberId, filters) {
  return listProjectTasksForMember(memberId, filters);
}

async function listProjectTasksForMember(memberId, filters) {
  const allowedSortBy = [
    "created_at",
    "estimated_time",
    "priority",
    "due_date",
  ];
  const sortBy = allowedSortBy.includes(filters.sortBy)
    ? filters.sortBy
    : "created_at";
  const sortOrder = filters.sortOrder === "asc" ? "ASC" : "DESC";

  let supportsTaskAssignees = true;
  try {
    await pool.execute("SELECT 1 FROM task_assignees LIMIT 1");
    await ensureTaskAssigneeStatusColumn();
  } catch (error) {
    if (isMissingTaskAssigneesTableError(error)) {
      supportsTaskAssignees = false;
    } else {
      throw error;
    }
  }

  const where = supportsTaskAssignees
    ? [
        "(t.assigned_to = ? OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.member_id = ?))",
        "t.is_active = TRUE",
      ]
    : ["t.assigned_to = ?", "t.is_active = TRUE"];
  const params = supportsTaskAssignees ? [memberId, memberId] : [memberId];

  if (filters.status) {
    where.push("t.status = ?");
    params.push(filters.status);
  }
  if (filters.priority) {
    where.push("t.priority = ?");
    params.push(filters.priority);
  }
  if (filters.project_id) {
    where.push("t.project_id = ?");
    params.push(Number(filters.project_id));
  }
  if (filters.sprint_id === "none") {
    where.push("t.sprint_id IS NULL");
  } else if (filters.sprint_id) {
    where.push("t.sprint_id = ?");
    params.push(Number(filters.sprint_id));
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM tasks t ${whereSql}`,
    params,
  );

  const safePageSize = Math.max(1, Number(filters.pageSize) || 10);
  const safeOffset = Math.max(0, (Number(filters.page) - 1) * safePageSize);
  let rows;
  try {
    [rows] = await pool.execute(
      `SELECT t.*, p.name AS project_name, s.name AS sprint_name,
        (
          SELECT ta_self.assignee_status
          FROM task_assignees ta_self
          WHERE ta_self.task_id = t.id AND ta_self.member_id = ?
          LIMIT 1
        ) AS member_assignee_status,
        CASE
          WHEN t.due_date IS NOT NULL AND CURDATE() > t.due_date AND t.status <> 'complete'
          THEN TRUE
          ELSE FALSE
        END AS is_due_date_overdue
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
      LEFT JOIN sprints s ON s.id = t.sprint_id
       ${whereSql}
       ORDER BY t.${sortBy} ${sortOrder}
       LIMIT ${safePageSize} OFFSET ${safeOffset}`,
      [memberId, ...params],
    );
  } catch (error) {
    if (!isMissingDueDateColumnError(error)) {
      throw error;
    }

    const safeSortBy = sortBy === "due_date" ? "created_at" : sortBy;
    [rows] = await pool.execute(
      `SELECT t.*, p.name AS project_name, s.name AS sprint_name,
        (
          SELECT ta_self.assignee_status
          FROM task_assignees ta_self
          WHERE ta_self.task_id = t.id AND ta_self.member_id = ?
          LIMIT 1
        ) AS member_assignee_status,
        FALSE AS is_due_date_overdue
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN sprints s ON s.id = t.sprint_id
       ${whereSql}
       ORDER BY t.${safeSortBy} ${sortOrder}
       LIMIT ${safePageSize} OFFSET ${safeOffset}`,
      [memberId, ...params],
    );
  }

  if (supportsTaskAssignees) {
    rows = rows.map((row) => {
      const memberStatus = row.member_assignee_status || "active";
      let effectiveStatus = row.status;

      if (memberStatus === "dependence") {
        effectiveStatus = "dependence";
      } else if (row.status === "dependence") {
        effectiveStatus = "open";
      }

      return {
        ...row,
        status: effectiveStatus,
      };
    });
  }

  return { rows, totalItems: countRows[0].total };
}

async function updateTask(taskId, payload) {
  const fields = [];
  const params = [];

  Object.entries(payload).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    params.push(value);
  });

  if (!fields.length) {
    return;
  }

  params.push(taskId);
  try {
    await pool.execute(
      `UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`,
      params,
    );
  } catch (error) {
    if (!isMissingDueDateColumnError(error) || payload.due_date === undefined) {
      throw error;
    }

    const retryPayload = { ...payload };
    delete retryPayload.due_date;
    const retryFields = [];
    const retryParams = [];

    Object.entries(retryPayload).forEach(([key, value]) => {
      retryFields.push(`${key} = ?`);
      retryParams.push(value);
    });

    if (!retryFields.length) {
      return;
    }

    retryParams.push(taskId);
    await pool.execute(
      `UPDATE tasks SET ${retryFields.join(", ")} WHERE id = ?`,
      retryParams,
    );
  }
}

async function createStatusHistory({
  task_id,
  previous_status,
  new_status,
  changed_by,
}) {
  await pool.execute(
    `INSERT INTO task_status_history (task_id, previous_status, new_status, changed_by)
     VALUES (?, ?, ?, ?)`,
    [task_id, previous_status, new_status, changed_by],
  );
}

async function getTaskDetails(taskId) {
  let taskRows;
  try {
    [taskRows] = await pool.execute(
      `SELECT t.*, p.name AS project_name, p.lead_reviewed_by, s.name AS sprint_name, u.name AS assigned_user_name, u.profile_picture AS assigned_user_profile_picture, cb.name AS created_by_name,
        CASE
          WHEN t.due_date IS NOT NULL AND CURDATE() > t.due_date AND t.status <> 'complete'
          THEN TRUE
          ELSE FALSE
        END AS is_due_date_overdue
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
      LEFT JOIN sprints s ON s.id = t.sprint_id
       JOIN users u ON u.id = t.assigned_to
       JOIN users cb ON cb.id = t.created_by
       WHERE t.id = ? LIMIT 1`,
      [taskId],
    );
  } catch (error) {
    if (!isMissingDueDateColumnError(error)) {
      throw error;
    }

    [taskRows] = await pool.execute(
      `SELECT t.*, p.name AS project_name, p.lead_reviewed_by, s.name AS sprint_name, u.name AS assigned_user_name, u.profile_picture AS assigned_user_profile_picture, cb.name AS created_by_name,
        FALSE AS is_due_date_overdue
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN sprints s ON s.id = t.sprint_id
       JOIN users u ON u.id = t.assigned_to
       JOIN users cb ON cb.id = t.created_by
       WHERE t.id = ? LIMIT 1`,
      [taskId],
    );
  }

  const task = taskRows[0] || null;
  if (!task) {
    return null;
  }

  const [comments] = await pool.execute(
    `SELECT c.*, u.name AS author_name
     FROM task_comments c
     JOIN users u ON u.id = c.commented_by
     WHERE c.task_id = ?
     ORDER BY c.created_at DESC`,
    [taskId],
  );

  const [timeEntries] = await pool.execute(
    `SELECT te.*, u.name AS logged_by_name
     FROM time_entries te
     JOIN users u ON u.id = te.logged_by
     WHERE te.task_id = ?
     ORDER BY te.date_logged DESC`,
    [taskId],
  );

  const [statusHistory] = await pool.execute(
    `SELECT tsh.*, u.name AS changed_by_name
     FROM task_status_history tsh
     JOIN users u ON u.id = tsh.changed_by
     WHERE tsh.task_id = ?
     ORDER BY tsh.changed_at DESC`,
    [taskId],
  );

  const [reassignments] = await pool.execute(
    `SELECT tr.*, uf.name AS assigned_from_name, ut.name AS assigned_to_name, rb.name AS reassigned_by_name
     FROM task_reassignments tr
     JOIN users uf ON uf.id = tr.assigned_from
     JOIN users ut ON ut.id = tr.assigned_to
     JOIN users rb ON rb.id = tr.reassigned_by
     WHERE tr.task_id = ?
     ORDER BY tr.reassigned_at DESC`,
    [taskId],
  );

  const [totals] = await pool.execute(
    `SELECT COALESCE(SUM(time_logged), 0) AS total_time_logged
     FROM time_entries
     WHERE task_id = ?`,
    [taskId],
  );

  const total_time_logged = Number(totals[0].total_time_logged || 0);
  const overflow_hours = Math.max(
    0,
    total_time_logged - Number(task.estimated_time),
  );
  const assignees = await getTaskAssignees(taskId);

  return {
    ...task,
    comments,
    time_entries: timeEntries,
    status_history: statusHistory,
    reassignments,
    total_time_logged,
    is_overdue: total_time_logged > Number(task.estimated_time),
    overflow_hours,
    assignees,
  };
}

async function setTaskAssignees(taskId, memberIds, addedBy) {
  await ensureTaskAssigneeStatusColumn();

  const normalizedIds = Array.from(
    new Set(
      (memberIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );

  if (normalizedIds.length === 0) {
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("DELETE FROM task_assignees WHERE task_id = ?", [
      taskId,
    ]);

    for (const memberId of normalizedIds) {
      await connection.execute(
        `INSERT INTO task_assignees (task_id, member_id, added_by, assignee_status)
         VALUES (?, ?, ?, 'active')`,
        [taskId, memberId, addedBy],
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

async function getTaskAssignees(taskId) {
  await ensureTaskAssigneeStatusColumn();

  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.profile_picture, u.role, ta.assignee_status
       FROM task_assignees ta
       JOIN users u ON u.id = ta.member_id
       WHERE ta.task_id = ?
       ORDER BY ta.created_at ASC`,
      [taskId],
    );

    return rows;
  } catch (error) {
    if (isMissingTaskAssigneesTableError(error)) {
      return [];
    }
    throw error;
  }
}

async function reassignTask({
  taskId,
  assigned_from,
  assigned_to,
  reassigned_by,
  reason,
}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [taskRows] = await connection.execute(
      "SELECT * FROM tasks WHERE id = ? LIMIT 1 FOR UPDATE",
      [taskId],
    );
    const task = taskRows[0];

    await connection.execute(
      `INSERT INTO task_reassignments (task_id, assigned_from, assigned_to, reassigned_by, reassignment_reason)
       VALUES (?, ?, ?, ?, ?)`,
      [taskId, assigned_from, assigned_to, reassigned_by, reason || null],
    );

    await connection.execute(
      `INSERT INTO task_status_history (task_id, previous_status, new_status, changed_by)
       VALUES (?, ?, ?, ?)`,
      [taskId, task.status, "dependence", reassigned_by],
    );

    // Keep the same task/thread and mark status as dependence.
    await connection.execute(
      "UPDATE tasks SET status = 'dependence' WHERE id = ?",
      [taskId],
    );

    await connection.execute(
      `CREATE TABLE IF NOT EXISTS task_assignees (
        id INT PRIMARY KEY AUTO_INCREMENT,
        task_id INT NOT NULL,
        member_id INT NOT NULL,
        assignee_status ENUM('active', 'dependence', 'released') DEFAULT 'active',
        added_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_task_member (task_id, member_id),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_task_assignees_task (task_id),
        INDEX idx_task_assignees_member (member_id)
      )`,
    );

    await connection.execute(
      `INSERT INTO task_assignees (task_id, member_id, added_by, assignee_status)
       VALUES (?, ?, ?, 'dependence')
       ON DUPLICATE KEY UPDATE assignee_status = 'dependence', added_by = VALUES(added_by)`,
      [taskId, assigned_from, reassigned_by],
    );

    await connection.execute(
      `INSERT INTO task_assignees (task_id, member_id, added_by, assignee_status)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE added_by = VALUES(added_by), assignee_status = 'active'`,
      [taskId, assigned_to, reassigned_by],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getAssigneeStatus(taskId, memberId) {
  await ensureTaskAssigneeStatusColumn();

  const [rows] = await pool.execute(
    `SELECT assignee_status
     FROM task_assignees
     WHERE task_id = ? AND member_id = ?
     LIMIT 1`,
    [taskId, memberId],
  );

  return rows[0]?.assignee_status || null;
}

async function updateAssigneeStatus(taskId, memberId, status) {
  await ensureTaskAssigneeStatusColumn();

  const [result] = await pool.execute(
    `UPDATE task_assignees
     SET assignee_status = ?
     WHERE task_id = ? AND member_id = ?`,
    [status, taskId, memberId],
  );

  return result.affectedRows > 0;
}

async function getAssigneeStatusSummary(taskId) {
  await ensureTaskAssigneeStatusColumn();

  const [[summary]] = await pool.execute(
    `SELECT
       COUNT(*) AS total_assignees,
       SUM(CASE WHEN assignee_status = 'dependence' THEN 1 ELSE 0 END) AS dependence_assignees
     FROM task_assignees
     WHERE task_id = ?`,
    [taskId],
  );

  return {
    total_assignees: Number(summary.total_assignees || 0),
    dependence_assignees: Number(summary.dependence_assignees || 0),
  };
}

async function syncGlobalDependenceStatus(taskId) {
  const task = await findById(taskId);
  if (!task) {
    return null;
  }

  const summary = await getAssigneeStatusSummary(taskId);
  if (
    summary.total_assignees > 0 &&
    summary.total_assignees === summary.dependence_assignees
  ) {
    if (task.status !== "dependence") {
      await updateTask(taskId, { status: "dependence" });
    }
    return "dependence";
  }

  if (task.status === "dependence") {
    await updateTask(taskId, { status: "open" });
    return "open";
  }

  return task.status;
}

async function getReassignmentHistory(taskId) {
  const [rows] = await pool.execute(
    `SELECT tr.*, uf.name AS assigned_from_name, ut.name AS assigned_to_name, rb.name AS reassigned_by_name
     FROM task_reassignments tr
     JOIN users uf ON uf.id = tr.assigned_from
     JOIN users ut ON ut.id = tr.assigned_to
     JOIN users rb ON rb.id = tr.reassigned_by
     WHERE tr.task_id = ?
     ORDER BY tr.reassigned_at DESC`,
    [taskId],
  );
  return rows;
}

async function deleteTask(taskId) {
  await pool.execute("UPDATE tasks SET is_active = FALSE WHERE id = ?", [
    taskId,
  ]);
}

async function getOverdueStatus(taskId) {
  let taskRows;
  let hasDueDate = true;
  try {
    [taskRows] = await pool.execute(
      "SELECT estimated_time, due_date, status FROM tasks WHERE id = ? LIMIT 1",
      [taskId],
    );
  } catch (error) {
    if (!isMissingDueDateColumnError(error)) {
      throw error;
    }

    hasDueDate = false;
    [taskRows] = await pool.execute(
      "SELECT estimated_time, status FROM tasks WHERE id = ? LIMIT 1",
      [taskId],
    );
  }
  const task = taskRows[0] || null;
  if (!task) {
    return null;
  }

  const [sumRows] = await pool.execute(
    `SELECT COALESCE(SUM(time_logged), 0) AS total_time_logged
     FROM time_entries
     WHERE task_id = ?`,
    [taskId],
  );

  const total = Number(sumRows[0].total_time_logged || 0);
  const estimated = Number(task.estimated_time);
  const todayDate = new Date().toISOString().split("T")[0];
  const dueDateOverdue =
    hasDueDate &&
    task.due_date !== null &&
    String(task.due_date) < todayDate &&
    task.status !== "complete";
  return {
    is_overdue: total > estimated || dueDateOverdue,
    is_due_date_overdue: dueDateOverdue,
    due_date: task.due_date,
    total_time_logged: total,
    estimated_time: estimated,
    overflow_hours: Math.max(0, total - estimated),
  };
}

module.exports = {
  createTask,
  findById,
  listProjectTasks,
  listMemberTasks,
  updateTask,
  createStatusHistory,
  getTaskDetails,
  setTaskAssignees,
  getTaskAssignees,
  getAssigneeStatus,
  updateAssigneeStatus,
  getAssigneeStatusSummary,
  syncGlobalDependenceStatus,
  reassignTask,
  getReassignmentHistory,
  deleteTask,
  getOverdueStatus,
};
