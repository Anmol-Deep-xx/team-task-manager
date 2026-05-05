const MessageModel = require("../models/Message");
const TaskModel = require("../models/Task");
const ProjectModel = require("../models/Project");
const UserModel = require("../models/User");
const { sendNotification } = require("../services/notificationService");
const { successResponse } = require("../utils/response");
const { NotFoundError, ForbiddenError } = require("../utils/errors");

async function hasTaskAccess(user, task) {
  if (user.role === "admin") return true;
  if (user.role === "team_lead") return task.lead_reviewed_by === user.id;

  if (Array.isArray(task.assignees) && task.assignees.length > 0) {
    if (task.assignees.some((assignee) => assignee.id === user.id)) {
      return true;
    }
  }

  if (task.assigned_to === user.id) return true;

  return ProjectModel.isProjectMember(task.project_id, user.id);
}

async function addMessage(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    const task = await TaskModel.getTaskDetails(taskId);
    if (!task) {
      throw new NotFoundError("Task not found");
    }

    if (!(await hasTaskAccess(req.user, task))) {
      throw new ForbiddenError("Not authorized to send messages in this task");
    }

    const messageId = await MessageModel.createMessage({
      task_id: taskId,
      sender_id: req.user.id,
      message_text: req.body.message_text,
    });

    const recipientUserIds = Array.from(
      new Set([
        ...(task.assignees || []).map((assignee) => Number(assignee.id)),
        Number(task.lead_reviewed_by),
      ]),
    ).filter((userId) => userId && userId !== Number(req.user.id));

    await sendNotification({
      recipientUserIds,
      type: "new_chat_message",
      title: "New Message on Task",
      body: `${(await UserModel.findById(req.user.id))?.name || "A user"}: ${String(req.body.message_text || "").slice(0, 60)}`,
      reference_id: taskId,
      reference_type: "task",
    });

    const allMessages = await MessageModel.getMessagesByTask(taskId);
    const created =
      allMessages.find((message) => message.id === messageId) || null;

    return successResponse(res, "Message sent successfully", created, 201);
  } catch (error) {
    return next(error);
  }
}

async function getTaskMessages(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    const task = await TaskModel.getTaskDetails(taskId);
    if (!task) {
      throw new NotFoundError("Task not found");
    }

    if (!(await hasTaskAccess(req.user, task))) {
      throw new ForbiddenError("Not authorized to view messages in this task");
    }

    const messages = await MessageModel.getMessagesByTask(taskId);
    return successResponse(
      res,
      "Task messages retrieved successfully",
      messages,
    );
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  addMessage,
  getTaskMessages,
};
