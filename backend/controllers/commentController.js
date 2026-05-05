const CommentModel = require("../models/Comment");
const TaskModel = require("../models/Task");
const UserModel = require("../models/User");
const { sendNotification } = require("../services/notificationService");
const { successResponse } = require("../utils/response");
const { NotFoundError, ForbiddenError } = require("../utils/errors");

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

async function addComment(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    const task = await TaskModel.getTaskDetails(taskId);
    if (!task) {
      throw new NotFoundError("Task not found");
    }
    if (!canAccessTask(req.user, task)) {
      throw new ForbiddenError("Not authorized to comment on this task");
    }

    const commentId = await CommentModel.createComment({
      task_id: taskId,
      commented_by: req.user.id,
      comment_text: req.body.comment_text,
    });

    const recipientUserIds = Array.from(
      new Set([
        ...(task.assignees || []).map((assignee) => Number(assignee.id)),
        Number(task.lead_reviewed_by),
      ]),
    ).filter((userId) => userId && userId !== Number(req.user.id));

    await sendNotification({
      recipientUserIds,
      type: "comment_added",
      title: "New Comment on Task",
      body: `${(await UserModel.findById(req.user.id))?.name || "A user"} commented on ${task.task_name}`,
      reference_id: taskId,
      reference_type: "task",
    });

    const created = await CommentModel.findCommentById(commentId);
    return successResponse(res, "Comment added successfully", created, 201);
  } catch (error) {
    return next(error);
  }
}

async function getTaskComments(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    const task = await TaskModel.getTaskDetails(taskId);
    if (!task) {
      throw new NotFoundError("Task not found");
    }
    if (!canAccessTask(req.user, task)) {
      throw new ForbiddenError("Not authorized to view comments for this task");
    }

    const comments = await CommentModel.getCommentsByTask(
      taskId,
      req.query.sortBy,
      req.query.sortOrder,
      req.user.id,
    );

    const commentsWithHistory = await Promise.all(
      comments.map(async (comment) => {
        const history = await CommentModel.getCommentEditHistory(comment.id);
        return { ...comment, edit_history: history };
      }),
    );

    return successResponse(
      res,
      "Task comments retrieved successfully",
      commentsWithHistory,
    );
  } catch (error) {
    return next(error);
  }
}

async function updateComment(req, res, next) {
  try {
    const commentId = Number(req.params.commentId);
    const comment = await CommentModel.findCommentById(commentId);
    if (!comment) {
      throw new NotFoundError("Comment not found");
    }

    const task = await TaskModel.getTaskDetails(comment.task_id);
    if (!task) {
      throw new NotFoundError("Task not found");
    }

    const isOwner = comment.commented_by === req.user.id;
    const isAdmin = req.user.role === "admin";
    const isLead =
      req.user.role === "team_lead" && task.lead_reviewed_by === req.user.id;

    if (!isOwner && !isLead && !isAdmin) {
      throw new ForbiddenError("Not authorized to update this comment");
    }

    await CommentModel.createCommentEditHistory({
      comment_id: commentId,
      edited_by: req.user.id,
      previous_text: comment.comment_text,
      new_text: req.body.comment_text,
    });

    await CommentModel.updateComment(commentId, req.body.comment_text);
    const updated = await CommentModel.findCommentById(commentId);
    const history = await CommentModel.getCommentEditHistory(commentId);

    return successResponse(res, "Comment updated successfully", {
      ...updated,
      edit_history: history,
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteComment(req, res, next) {
  try {
    const commentId = Number(req.params.commentId);
    const comment = await CommentModel.findCommentById(commentId);
    if (!comment) {
      throw new NotFoundError("Comment not found");
    }

    const task = await TaskModel.getTaskDetails(comment.task_id);
    if (!task) {
      throw new NotFoundError("Task not found");
    }

    const isOwner = comment.commented_by === req.user.id;
    const isAdmin = req.user.role === "admin";
    const isLead =
      req.user.role === "team_lead" && task.lead_reviewed_by === req.user.id;

    if (!isOwner && !isLead && !isAdmin) {
      throw new ForbiddenError("Not authorized to delete this comment");
    }

    await CommentModel.deleteComment(commentId);
    return successResponse(res, "Comment deleted successfully", null, 200);
  } catch (error) {
    return next(error);
  }
}

async function getCommentHistory(req, res, next) {
  try {
    const commentId = Number(req.params.commentId);
    const comment = await CommentModel.findCommentById(commentId);
    if (!comment) {
      throw new NotFoundError("Comment not found");
    }

    const task = await TaskModel.getTaskDetails(comment.task_id);
    if (!task) {
      throw new NotFoundError("Task not found");
    }
    if (!canAccessTask(req.user, task)) {
      throw new ForbiddenError("Not authorized to view comment history");
    }

    const history = await CommentModel.getCommentEditHistory(commentId);
    return successResponse(
      res,
      "Comment edit history retrieved successfully",
      history,
    );
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  addComment,
  getTaskComments,
  updateComment,
  deleteComment,
  getCommentHistory,
};
