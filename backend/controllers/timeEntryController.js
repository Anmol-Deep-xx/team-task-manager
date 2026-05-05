const TimeEntryModel = require("../models/TimeEntry");
const TaskModel = require("../models/Task");
const { successResponse } = require("../utils/response");
const {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} = require("../utils/errors");

function canAccessTask(user, task) {
  if (user.role === "admin") {
    return true;
  }
  if (user.role === "team_lead") {
    return task.lead_reviewed_by === user.id;
  }
  if (Array.isArray(task.assignees) && task.assignees.length > 0) {
    return task.assignees.some((assignee) => assignee.id === user.id);
  }
  return task.assigned_to === user.id;
}

async function createTimeEntry(req, res, next) {
  try {
    const { task_id, time_logged, date_logged } = req.body;
    const task = await TaskModel.getTaskDetails(task_id);
    if (!task) {
      throw new NotFoundError("Task not found");
    }

    const memberAssigned =
      task.assigned_to === req.user.id ||
      (Array.isArray(task.assignees) &&
        task.assignees.some((assignee) => assignee.id === req.user.id));

    if (req.user.role === "member" && !memberAssigned) {
      throw new ForbiddenError("Members can log time only on assigned tasks");
    }

    const estimatedHours = Number(task.estimated_time || 0);
    const currentTotal = await TimeEntryModel.getTaskLoggedTotal(task_id);
    const remainingHours = Math.max(0, estimatedHours - currentTotal);
    const requestedHours = Number(time_logged || 0);

    if (requestedHours > remainingHours) {
      throw new ValidationError("Time log exceeds remaining estimate", [
        {
          field: "time_logged",
          message: `Remaining allowed time is ${remainingHours.toFixed(2)} hours`,
        },
      ]);
    }

    const timeEntryId = await TimeEntryModel.createTimeEntry({
      task_id,
      logged_by: req.user.id,
      time_logged,
      date_logged,
    });

    const entry = await TimeEntryModel.findById(timeEntryId);
    return successResponse(res, "Time entry created successfully", entry, 201);
  } catch (error) {
    return next(error);
  }
}

async function getTaskTimeEntries(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    const task = await TaskModel.getTaskDetails(taskId);
    if (!task) {
      throw new NotFoundError("Task not found");
    }
    if (!canAccessTask(req.user, task)) {
      throw new ForbiddenError("Not authorized to view time entries");
    }

    const result = await TimeEntryModel.getByTask(
      taskId,
      req.query.sortBy,
      req.query.sortOrder,
    );
    return successResponse(
      res,
      "Task time entries retrieved successfully",
      result,
    );
  } catch (error) {
    return next(error);
  }
}

async function updateTimeEntry(req, res, next) {
  try {
    const timeEntryId = Number(req.params.timeEntryId);
    const entry = await TimeEntryModel.findById(timeEntryId);
    if (!entry) {
      throw new NotFoundError("Time entry not found");
    }

    const task = await TaskModel.getTaskDetails(entry.task_id);
    if (!task) {
      throw new NotFoundError("Task not found");
    }

    const isOwner = entry.logged_by === req.user.id;
    const isAdmin = req.user.role === "admin";
    const isLead =
      req.user.role === "team_lead" && task.lead_reviewed_by === req.user.id;

    if (!isOwner && !isLead && !isAdmin) {
      throw new ForbiddenError("Not authorized to update this time entry");
    }

    const estimatedHours = Number(task.estimated_time || 0);
    const otherEntriesTotal = await TimeEntryModel.getTaskLoggedTotal(
      entry.task_id,
      timeEntryId,
    );
    const newTimeLogged = Number(
      req.body.time_logged !== undefined
        ? req.body.time_logged
        : entry.time_logged,
    );
    const remainingHours = Math.max(0, estimatedHours - otherEntriesTotal);

    if (newTimeLogged > remainingHours) {
      throw new ValidationError("Updated time log exceeds remaining estimate", [
        {
          field: "time_logged",
          message: `Maximum allowed for this entry is ${remainingHours.toFixed(2)} hours`,
        },
      ]);
    }

    const payload = {};
    if (req.body.time_logged !== undefined)
      payload.time_logged = req.body.time_logged;
    if (req.body.date_logged !== undefined)
      payload.date_logged = req.body.date_logged;

    await TimeEntryModel.updateTimeEntry(timeEntryId, payload);
    const updated = await TimeEntryModel.findById(timeEntryId);

    return successResponse(res, "Time entry updated successfully", updated);
  } catch (error) {
    return next(error);
  }
}

async function deleteTimeEntry(req, res, next) {
  try {
    const timeEntryId = Number(req.params.timeEntryId);
    const entry = await TimeEntryModel.findById(timeEntryId);
    if (!entry) {
      throw new NotFoundError("Time entry not found");
    }

    const task = await TaskModel.getTaskDetails(entry.task_id);
    if (!task) {
      throw new NotFoundError("Task not found");
    }

    const isOwner = entry.logged_by === req.user.id;
    const isAdmin = req.user.role === "admin";
    const isLead =
      req.user.role === "team_lead" && task.lead_reviewed_by === req.user.id;

    if (!isOwner && !isLead && !isAdmin) {
      throw new ForbiddenError("Not authorized to delete this time entry");
    }

    await TimeEntryModel.deleteTimeEntry(timeEntryId);
    return successResponse(res, "Time entry deleted successfully", null, 200);
  } catch (error) {
    return next(error);
  }
}

async function getMyTimeHistory(req, res, next) {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 100);
    const projectId = req.query.project_id
      ? Number(req.query.project_id)
      : null;

    const history = await TimeEntryModel.getByUserHistory(req.user.id, {
      page,
      pageSize,
      projectId,
    });

    return successResponse(res, "Time history retrieved successfully", {
      items: history.items,
      totalItems: history.totalItems,
      totalLogged: history.totalLogged,
      page,
      pageSize,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createTimeEntry,
  getTaskTimeEntries,
  getMyTimeHistory,
  updateTimeEntry,
  deleteTimeEntry,
};
