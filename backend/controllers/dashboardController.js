const { pool } = require("../config/database");
const { successResponse, paginationResponse } = require("../utils/response");

async function getOverview(req, res, next) {
  try {
    const leadId = req.user.id;
    const isAdmin = req.user.role === "admin";
    const projectScope = isAdmin ? "" : "WHERE lead_reviewed_by = ?";
    const taskScope = isAdmin
      ? "WHERE t.is_active = TRUE"
      : "WHERE p.lead_reviewed_by = ? AND t.is_active = TRUE";
    const memberScope = isAdmin ? "" : "WHERE p.lead_reviewed_by = ?";
    const overdueScope = isAdmin
      ? "WHERE t.is_active = TRUE"
      : "WHERE p.lead_reviewed_by = ? AND t.is_active = TRUE";

    const [[projectsStats]] = await pool.execute(
      `SELECT
        COUNT(*) AS total_projects,
        SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) AS active_projects
       FROM projects
       ${projectScope}`,
      isAdmin ? [] : [leadId],
    );

    const [[tasksStats]] = await pool.execute(
      `SELECT
        COUNT(*) AS total_tasks,
        SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END) AS open_count,
        SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_count,
        SUM(CASE WHEN t.status = 'review' THEN 1 ELSE 0 END) AS review_count,
        SUM(CASE WHEN t.status = 'complete' THEN 1 ELSE 0 END) AS complete_count,
        SUM(CASE WHEN t.status = 'dependence' THEN 1 ELSE 0 END) AS dependence_count
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       ${taskScope}`,
      isAdmin ? [] : [leadId],
    );

    const [[membersStats]] = await pool.execute(
      `SELECT COUNT(DISTINCT assigned_to) AS team_members
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       ${memberScope}`,
      isAdmin ? [] : [leadId],
    );

    const [[overdueStats]] = await pool.execute(
      `SELECT COUNT(*) AS overdue_tasks
       FROM (
         SELECT t.id
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
         LEFT JOIN time_entries te ON te.task_id = t.id
         ${overdueScope}
         GROUP BY t.id, t.estimated_time
         HAVING COALESCE(SUM(te.time_logged), 0) > t.estimated_time
       ) overdue`,
      isAdmin ? [] : [leadId],
    );

    return successResponse(res, "Dashboard overview retrieved successfully", {
      total_projects: Number(projectsStats.total_projects || 0),
      active_projects: Number(projectsStats.active_projects || 0),
      total_tasks: Number(tasksStats.total_tasks || 0),
      task_stats: {
        open: Number(tasksStats.open_count || 0),
        in_progress: Number(tasksStats.in_progress_count || 0),
        review: Number(tasksStats.review_count || 0),
        complete: Number(tasksStats.complete_count || 0),
        dependence: Number(tasksStats.dependence_count || 0),
      },
      overdue_tasks: Number(overdueStats.overdue_tasks || 0),
      team_members: Number(membersStats.team_members || 0),
    });
  } catch (error) {
    return next(error);
  }
}

async function getTeamPerformance(req, res, next) {
  try {
    const leadId = req.user.id;
    const isAdmin = req.user.role === "admin";
    const projectId = Number(req.query.project_id || 0);

    const params = [];
    const filters = ["u.role = 'member'"];
    if (!isAdmin) {
      filters.push("p.lead_reviewed_by = ?");
      params.push(leadId);
    }
    if (projectId) {
      filters.push("p.id = ?");
      params.push(projectId);
    }

    const [rows] = await pool.execute(
      `SELECT
        u.id AS member_id,
        u.name AS member_name,
        COUNT(t.id) AS total_tasks,
        SUM(CASE WHEN t.status = 'complete' THEN 1 ELSE 0 END) AS completed_tasks,
        SUM(CASE WHEN t.status IN ('open', 'in_progress', 'review', 'dependence') THEN 1 ELSE 0 END) AS pending_tasks,
        COALESCE(SUM(te.time_logged), 0) AS total_time_logged,
        SUM(
          CASE WHEN COALESCE(te_sum.total_logged, 0) > t.estimated_time THEN 1 ELSE 0 END
        ) AS overdue_tasks
       FROM users u
       LEFT JOIN tasks t ON t.assigned_to = u.id AND t.is_active = TRUE
       LEFT JOIN projects p ON p.id = t.project_id
       LEFT JOIN time_entries te ON te.task_id = t.id
       LEFT JOIN (
         SELECT task_id, COALESCE(SUM(time_logged), 0) AS total_logged
         FROM time_entries
         GROUP BY task_id
       ) te_sum ON te_sum.task_id = t.id
       WHERE ${filters.join(" AND ")}
       GROUP BY u.id, u.name
       ORDER BY completed_tasks DESC`,
      params,
    );

    const result = rows.map((row) => ({
      ...row,
      completion_rate: row.total_tasks
        ? Number(((row.completed_tasks / row.total_tasks) * 100).toFixed(2))
        : 0,
    }));

    return successResponse(
      res,
      "Team performance retrieved successfully",
      result,
    );
  } catch (error) {
    return next(error);
  }
}

async function getMemberWorkload(req, res, next) {
  try {
    const leadId = req.user.id;
    const isAdmin = req.user.role === "admin";
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 10);

    const params = [];
    const filters = ["u.role = 'member'"];
    if (!isAdmin) {
      filters.push("p.lead_reviewed_by = ?");
      params.push(leadId);
    }
    const whereSql = `WHERE ${filters.join(" AND ")}`;

    const [[countRow]] = await pool.execute(
      `SELECT COUNT(DISTINCT u.id) AS total
       FROM users u
       JOIN tasks t ON t.assigned_to = u.id AND t.is_active = TRUE
       JOIN projects p ON p.id = t.project_id
       ${whereSql}`,
      params,
    );

    const safePageSize = Math.max(1, Number(pageSize) || 10);
    const safeOffset = Math.max(0, (Number(page) - 1) * safePageSize);
    const [rows] = await pool.execute(
      `SELECT
        u.id,
        u.name,
        u.email,
        COUNT(t.id) AS total_tasks,
        SUM(CASE WHEN t.status = 'complete' THEN 1 ELSE 0 END) AS completed_tasks,
        SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_tasks,
        SUM(CASE WHEN t.status = 'review' THEN 1 ELSE 0 END) AS review_tasks,
        SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END) AS open_tasks,
        SUM(CASE WHEN COALESCE(te_sum.total_logged, 0) > t.estimated_time THEN 1 ELSE 0 END) AS overdue_tasks
       FROM users u
       JOIN tasks t ON t.assigned_to = u.id AND t.is_active = TRUE
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN (
         SELECT task_id, COALESCE(SUM(time_logged), 0) AS total_logged
         FROM time_entries
         GROUP BY task_id
       ) te_sum ON te_sum.task_id = t.id
       ${whereSql}
       GROUP BY u.id, u.name, u.email
       ORDER BY total_tasks DESC
       LIMIT ${safePageSize} OFFSET ${safeOffset}`,
      params,
    );

    return paginationResponse(
      res,
      "Member workload retrieved successfully",
      rows,
      {
        page,
        pageSize,
        totalItems: Number(countRow.total || 0),
        totalPages: Math.ceil(Number(countRow.total || 0) / pageSize),
      },
    );
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getOverview,
  getTeamPerformance,
  getMemberWorkload,
};
