const TaskModel = require("../models/Task");
const TaskNoteModel = require("../models/TaskNote");
const { successResponse } = require("../utils/response");
const {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} = require("../utils/errors");

function normalizeIds(ids = []) {
  return Array.from(
    new Set(
      (ids || [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );
}

async function ensureTaskExistsAndAccess(taskId, user) {
  const task = await TaskModel.getTaskDetails(taskId);
  if (!task) {
    throw new NotFoundError("Task not found");
  }

  if (user.role === "admin") {
    return task;
  }

  if (user.role === "team_lead") {
    if (Number(task.lead_reviewed_by) !== Number(user.id)) {
      throw new ForbiddenError("You do not have access to this task");
    }
    return task;
  }

  const hasDirectAssignment = Array.isArray(task.assignees)
    ? task.assignees.some((assignee) => Number(assignee.id) === Number(user.id))
    : false;

  if (!hasDirectAssignment && Number(task.assigned_to) !== Number(user.id)) {
    throw new ForbiddenError("You do not have access to this task");
  }

  return task;
}

async function validateTaskAssignees(taskId, assigneeIds) {
  const ids = normalizeIds(assigneeIds);
  if (ids.length === 0) {
    return [];
  }

  const taskAssignees = await TaskModel.getTaskAssignees(taskId);
  const assigneeIdSet = new Set(taskAssignees.map((row) => Number(row.id)));
  const invalidIds = ids.filter((id) => !assigneeIdSet.has(id));

  if (invalidIds.length > 0) {
    throw new ValidationError("Invalid note assignees", [
      {
        field: "assignee_ids",
        message: `These users are not task assignees: ${invalidIds.join(", ")}`,
      },
    ]);
  }

  return ids;
}

async function createTaskNote(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    await ensureTaskExistsAndAccess(taskId, req.user);

    const assigneeIds = await validateTaskAssignees(
      taskId,
      req.body.assignee_ids,
    );

    const noteId = await TaskNoteModel.createNote({
      taskId,
      noteText: req.body.note_text,
      createdBy: req.user.id,
      assigneeIds,
    });

    const created = await TaskNoteModel.getNoteById(noteId);
    return successResponse(res, "Task note created", created, 201);
  } catch (error) {
    return next(error);
  }
}

async function getTaskNotes(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    await ensureTaskExistsAndAccess(taskId, req.user);

    const notes = await TaskNoteModel.getNotesByTask(
      taskId,
      req.user.id,
      req.user.role,
    );

    return successResponse(res, "Task notes retrieved", notes);
  } catch (error) {
    return next(error);
  }
}

async function updateTaskNote(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    const noteId = Number(req.params.noteId);
    await ensureTaskExistsAndAccess(taskId, req.user);

    const note = await TaskNoteModel.getNoteById(noteId);
    if (!note || Number(note.task_id) !== taskId) {
      throw new NotFoundError("Task note not found");
    }

    const assigneeIds = await validateTaskAssignees(
      taskId,
      req.body.assignee_ids,
    );

    await TaskNoteModel.updateNote({
      noteId,
      noteText: req.body.note_text,
      assigneeIds,
    });

    const notes = await TaskNoteModel.getNotesByTask(
      taskId,
      req.user.id,
      req.user.role,
    );
    const updated = notes.find((entry) => Number(entry.id) === noteId) || null;

    return successResponse(res, "Task note updated", updated);
  } catch (error) {
    return next(error);
  }
}

async function deleteTaskNote(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    const noteId = Number(req.params.noteId);
    await ensureTaskExistsAndAccess(taskId, req.user);

    const note = await TaskNoteModel.getNoteById(noteId);
    if (!note || Number(note.task_id) !== taskId) {
      throw new NotFoundError("Task note not found");
    }

    await TaskNoteModel.deleteNote(noteId);
    return successResponse(res, "Task note deleted", null, 200);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createTaskNote,
  getTaskNotes,
  updateTaskNote,
  deleteTaskNote,
};
