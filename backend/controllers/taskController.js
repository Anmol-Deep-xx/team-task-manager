const TaskModel = require("../models/Task");
const ProjectModel = require("../models/Project");
const UserModel = require("../models/User");
const SprintModel = require("../models/Sprint");
const { sendNotification } = require("../services/notificationService");
const { STATUS_TRANSITIONS } = require("../config/constants");
const { successResponse, paginationResponse } = require("../utils/response");
const {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} = require("../utils/errors");

function parsePagination(query) {
  const page = Number(query.page || 1);
  const pageSize = Number(query.pageSize || 10);
  return { page, pageSize };
}

async function createTask(req, res, next) {
  try {
    const {
      project_id,
      sprint_id,
      task_name,
      description,
      assigned_to,
      assigned_to_ids,
      estimated_time,
      due_date,
      priority,
    } = req.body;

    const candidateAssignees = Array.isArray(assigned_to_ids)
      ? assigned_to_ids.map((id) => Number(id))
      : [Number(assigned_to)];
    const normalizedAssignees = Array.from(
      new Set(
        candidateAssignees.filter((id) => Number.isInteger(id) && id > 0),
      ),
    );

    if (normalizedAssignees.length === 0) {
      throw new ValidationError("At least one assignee is required", [
        { field: "assigned_to", message: "Choose at least one member" },
      ]);
    }

    const project = await ProjectModel.findById(project_id);
    if (!project || !project.is_active) {
      throw new NotFoundError("Project not found");
    }
    const isAdmin = req.user.role === "admin";
    if (!isAdmin && project.lead_reviewed_by !== req.user.id) {
      throw new ForbiddenError(
        "You can only create tasks in your own projects",
      );
    }

    for (const memberId of normalizedAssignees) {
      const assignee = await UserModel.findById(memberId);
      if (!assignee || assignee.role !== "member" || !assignee.is_active) {
        throw new ValidationError("Each assignee must be an active member", [
          {
            field: "assigned_to",
            message: `Invalid member assignment: ${memberId}`,
          },
        ]);
      }

      const isSelectedProjectMember = await ProjectModel.isProjectMember(
        project_id,
        memberId,
      );
      if (!isSelectedProjectMember) {
        throw new ValidationError(
          "Each assignee must belong to selected project members",
          [
            {
              field: "assigned_to",
              message: `Member ${memberId} is not part of selected project members`,
            },
          ],
        );
      }
    }

    let normalizedSprintId = null;
    if (sprint_id !== undefined && sprint_id !== null && sprint_id !== "") {
      normalizedSprintId = Number(sprint_id);
      const sprint = await SprintModel.findByProjectAndId(
        project_id,
        normalizedSprintId,
      );
      if (!sprint || !sprint.is_active) {
        throw new ValidationError("Invalid sprint for selected project", [
          {
            field: "sprint_id",
            message: "Sprint does not belong to selected project",
          },
        ]);
      }
    }

    const taskId = await TaskModel.createTask({
      project_id,
      task_name,
      description,
      assigned_to: normalizedAssignees[0],
      estimated_time,
      sprint_id: normalizedSprintId,
      due_date,
      priority,
      created_by: req.user.id,
    });

    await TaskModel.setTaskAssignees(taskId, normalizedAssignees, req.user.id);

    await sendNotification({
      recipientUserIds: normalizedAssignees,
      type: "task_assigned",
      title: "New Task Assigned",
      body: `You have been assigned to: ${task_name}`,
      reference_id: taskId,
      reference_type: "task",
    });

    const created = await TaskModel.getTaskDetails(taskId);
    return successResponse(res, "Task created successfully", created, 201);
  } catch (error) {
    return next(error);
  }
}

async function getMyTasks(req, res, next) {
  try {
    const { page, pageSize } = parsePagination(req.query);

    const { rows, totalItems } = await TaskModel.listMemberTasks(req.user.id, {
      page,
      pageSize,
      status: req.query.status,
      priority: req.query.priority,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
      project_id: req.query.project_id,
      sprint_id: req.query.sprint_id,
    });

    return paginationResponse(res, "Tasks retrieved successfully", rows, {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    });
  } catch (error) {
    return next(error);
  }
}

async function getTaskById(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    const task = await TaskModel.getTaskDetails(taskId);

    if (!task) {
      throw new NotFoundError("Task not found");
    }

    const isAdmin = req.user.role === "admin";

    if (
      !isAdmin &&
      req.user.role === "team_lead" &&
      task.lead_reviewed_by !== req.user.id
    ) {
      throw new ForbiddenError(
        "You can only view tasks from your own projects",
      );
    }
    if (
      !isAdmin &&
      req.user.role === "member" &&
      !task.assignees?.some((assignee) => assignee.id === req.user.id)
    ) {
      const isProjectMember = await ProjectModel.isProjectMember(
        task.project_id,
        req.user.id,
      );
      if (!isProjectMember) {
        throw new ForbiddenError("You can only view tasks from your projects");
      }
    }

    const privateNotes = Array.isArray(task.comments)
      ? task.comments.filter((comment) => comment.commented_by === req.user.id)
      : [];

    return successResponse(res, "Task details retrieved successfully", {
      ...task,
      comments: privateNotes,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateTaskStatus(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    const { status } = req.body;

    const task = await TaskModel.findById(taskId);
    if (!task || !task.is_active) {
      throw new NotFoundError("Task not found");
    }

    const project = await ProjectModel.findById(task.project_id);
    if (!project) {
      throw new NotFoundError("Project not found");
    }

    const isAdmin = req.user.role === "admin";
    const isLead =
      req.user.role === "team_lead" && project.lead_reviewed_by === req.user.id;
    const taskAssignees = await TaskModel.getTaskAssignees(taskId);
    const isAssignee =
      task.assigned_to === req.user.id ||
      taskAssignees.some((assignee) => assignee.id === req.user.id);

    const assigneeRow = taskAssignees.find(
      (assignee) => Number(assignee.id) === Number(req.user.id),
    );

    if (!isAdmin && !isLead && !isAssignee) {
      throw new ForbiddenError("Not authorized to update status for this task");
    }

    if (
      req.user.role === "member" &&
      assigneeRow?.assignee_status === "dependence" &&
      status !== "dependence"
    ) {
      throw new ForbiddenError(
        "You cannot move this task while your assignee status is dependence",
      );
    }

    const allowedTransitions = STATUS_TRANSITIONS[task.status] || [];
    if (!allowedTransitions.includes(status) && status !== "dependence") {
      throw new ValidationError("Invalid task status transition", [
        {
          field: "status",
          message: `Cannot transition from ${task.status} to ${status}`,
        },
      ]);
    }

    if (status === "dependence" && isAssignee) {
      const assigneeCount = taskAssignees.length;

      if (assigneeCount <= 1) {
        await TaskModel.updateTask(taskId, { status: "dependence" });
        await TaskModel.createStatusHistory({
          task_id: taskId,
          previous_status: task.status,
          new_status: "dependence",
          changed_by: req.user.id,
        });
      } else {
        await TaskModel.updateAssigneeStatus(taskId, req.user.id, "dependence");
        const syncedStatus = await TaskModel.syncGlobalDependenceStatus(taskId);

        if (syncedStatus === "dependence" && task.status !== "dependence") {
          await TaskModel.createStatusHistory({
            task_id: taskId,
            previous_status: task.status,
            new_status: "dependence",
            changed_by: req.user.id,
          });
        }
      }
    } else {
      await TaskModel.updateTask(taskId, { status });
      await TaskModel.createStatusHistory({
        task_id: taskId,
        previous_status: task.status,
        new_status: status,
        changed_by: req.user.id,
      });
    }

    const actor = await UserModel.findById(req.user.id);
    const recipientUserIds = Array.from(
      new Set([
        Number(project.lead_reviewed_by),
        ...taskAssignees.map((assignee) => Number(assignee.id)),
      ]),
    ).filter((id) => Number.isInteger(id) && id > 0);

    await sendNotification({
      recipientUserIds,
      type: "task_status_changed",
      title: "Task Status Updated",
      body: `${task.task_name} status changed to ${status} by ${actor?.name || "a user"}`,
      reference_id: taskId,
      reference_type: "task",
    });

    const updated = await TaskModel.getTaskDetails(taskId);
    return successResponse(res, "Task status updated successfully", updated);
  } catch (error) {
    return next(error);
  }
}

async function updateTask(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    const task = await TaskModel.findById(taskId);
    if (!task || !task.is_active) {
      throw new NotFoundError("Task not found");
    }

    const project = await ProjectModel.findById(task.project_id);
    if (!project) {
      throw new NotFoundError("Project not found");
    }
    const isAdmin = req.user.role === "admin";
    if (!isAdmin && project.lead_reviewed_by !== req.user.id) {
      throw new ForbiddenError("Only project owner can update task");
    }

    const payload = {};
    [
      "task_name",
      "description",
      "estimated_time",
      "due_date",
      "priority",
      "sprint_id",
    ].forEach((field) => {
      if (req.body[field] !== undefined) payload[field] = req.body[field];
    });

    const candidateAssignees = Array.isArray(req.body.assigned_to_ids)
      ? req.body.assigned_to_ids.map((id) => Number(id))
      : req.body.assigned_to !== undefined
        ? [Number(req.body.assigned_to)]
        : [];

    const normalizedAssignees = Array.from(
      new Set(
        candidateAssignees.filter((id) => Number.isInteger(id) && id > 0),
      ),
    );

    if (candidateAssignees.length > 0 && normalizedAssignees.length === 0) {
      throw new ValidationError("At least one valid assignee is required", [
        {
          field: "assigned_to_ids",
          message: "Provide at least one valid member id",
        },
      ]);
    }

    if (normalizedAssignees.length > 0) {
      for (const memberId of normalizedAssignees) {
        const assignee = await UserModel.findById(memberId);
        if (!assignee || assignee.role !== "member" || !assignee.is_active) {
          throw new ValidationError("Each assignee must be an active member", [
            {
              field: "assigned_to_ids",
              message: `Invalid member assignment: ${memberId}`,
            },
          ]);
        }

        const isSelectedProjectMember = await ProjectModel.isProjectMember(
          task.project_id,
          memberId,
        );
        if (!isSelectedProjectMember) {
          throw new ValidationError(
            "Each assignee must belong to selected project members",
            [
              {
                field: "assigned_to_ids",
                message: `Member ${memberId} is not part of selected project members`,
              },
            ],
          );
        }
      }

      payload.assigned_to = normalizedAssignees[0];
    }

    if (payload.sprint_id !== undefined) {
      if (payload.sprint_id === null || payload.sprint_id === "") {
        payload.sprint_id = null;
      } else {
        const sprintId = Number(payload.sprint_id);
        const sprint = await SprintModel.findByProjectAndId(
          task.project_id,
          sprintId,
        );
        if (!sprint || !sprint.is_active) {
          throw new ValidationError("Invalid sprint for this task project", [
            {
              field: "sprint_id",
              message: "Sprint does not belong to task's project",
            },
          ]);
        }
        payload.sprint_id = sprintId;
      }
    }

    const previousAssignees = await TaskModel.getTaskAssignees(taskId);

    await TaskModel.updateTask(taskId, payload);

    if (normalizedAssignees.length > 0) {
      await TaskModel.setTaskAssignees(
        taskId,
        normalizedAssignees,
        req.user.id,
      );

      const previousAssigneeIds = new Set(
        previousAssignees.map((assignee) => Number(assignee.id)),
      );
      const newAssigneeIds = normalizedAssignees.filter(
        (assigneeId) => !previousAssigneeIds.has(assigneeId),
      );

      if (newAssigneeIds.length > 0) {
        await sendNotification({
          recipientUserIds: newAssigneeIds,
          type: "task_assigned",
          title: "New Task Assigned",
          body: `You have been assigned to: ${task.task_name}`,
          reference_id: taskId,
          reference_type: "task",
        });
      }
    }

    const updated = await TaskModel.getTaskDetails(taskId);
    return successResponse(res, "Task updated successfully", updated);
  } catch (error) {
    return next(error);
  }
}

async function updateAssigneeStatus(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    const { status } = req.body;

    const task = await TaskModel.findById(taskId);
    if (!task || !task.is_active) {
      throw new NotFoundError("Task not found");
    }

    const project = await ProjectModel.findById(task.project_id);
    if (!project) {
      throw new NotFoundError("Project not found");
    }

    const taskAssignees = await TaskModel.getTaskAssignees(taskId);
    const isAssignee =
      task.assigned_to === req.user.id ||
      taskAssignees.some((assignee) => assignee.id === req.user.id);

    if (!isAssignee) {
      throw new ForbiddenError(
        "Only task assignees can update assignee status",
      );
    }

    const updated = await TaskModel.updateAssigneeStatus(
      taskId,
      req.user.id,
      status,
    );
    if (!updated) {
      throw new ForbiddenError("Assignee status row not found for this user");
    }

    await TaskModel.syncGlobalDependenceStatus(taskId);

    const actor = await UserModel.findById(req.user.id);
    const recipientUserIds = Array.from(
      new Set([
        Number(project.lead_reviewed_by),
        ...taskAssignees.map((assignee) => Number(assignee.id)),
      ]),
    ).filter((id) => Number.isInteger(id) && id > 0);

    await sendNotification({
      recipientUserIds,
      type: "task_status_changed",
      title: "Task Status Updated",
      body: `${task.task_name} status changed to dependence by ${actor?.name || "a user"}`,
      reference_id: taskId,
      reference_type: "task",
    });

    const details = await TaskModel.getTaskDetails(taskId);
    return successResponse(res, "Assignee status updated", details);
  } catch (error) {
    return next(error);
  }
}

async function reassignTask(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    const assignTo = Number(req.body.assign_to);

    const task = await TaskModel.findById(taskId);
    if (!task || !task.is_active) {
      throw new NotFoundError("Task not found");
    }

    const project = await ProjectModel.findById(task.project_id);
    if (!project) {
      throw new NotFoundError("Project not found");
    }

    const isAdmin = req.user.role === "admin";
    const isLeadProjectOwner =
      req.user.role === "team_lead" && project.lead_reviewed_by === req.user.id;
    const taskAssignees = await TaskModel.getTaskAssignees(taskId);
    const isCurrentAssignee =
      req.user.role === "member" &&
      (task.assigned_to === req.user.id ||
        taskAssignees.some((assignee) => assignee.id === req.user.id));

    if (!isAdmin && !isLeadProjectOwner && !isCurrentAssignee) {
      throw new ForbiddenError(
        "Only project owner or current assignee can reassign task",
      );
    }

    const newAssignee = await UserModel.findById(assignTo);
    if (
      !newAssignee ||
      newAssignee.role !== "member" ||
      !newAssignee.is_active
    ) {
      throw new ValidationError("assign_to must be an active member", [
        { field: "assign_to", message: "Invalid member assignment" },
      ]);
    }

    if (task.assigned_to === assignTo) {
      throw new ValidationError("Task is already assigned to this user", [
        { field: "assign_to", message: "Cannot reassign to the same member" },
      ]);
    }

    if (taskAssignees.some((assignee) => Number(assignee.id) === assignTo)) {
      throw new ValidationError("Task is already assigned to this user", [
        {
          field: "assign_to",
          message: "Selected member is already in task assignees",
        },
      ]);
    }

    const isSelectedProjectMember = await ProjectModel.isProjectMember(
      task.project_id,
      assignTo,
    );
    if (!isSelectedProjectMember) {
      throw new ValidationError(
        "assign_to must be selected as a member of this project",
        [
          {
            field: "assign_to",
            message: "Assignee is not part of selected project members",
          },
        ],
      );
    }

    const assignedFrom =
      req.user.role === "member"
        ? Number(req.user.id)
        : Number(task.assigned_to);

    await TaskModel.reassignTask({
      taskId,
      assigned_from: assignedFrom,
      assigned_to: assignTo,
      reassigned_by: req.user.id,
      reason: req.body.reason,
    });

    await sendNotification({
      recipientUserIds: [assignTo],
      type: "task_assigned",
      title: "Task Reassigned",
      body: `You have been assigned to: ${task.task_name}`,
      reference_id: taskId,
      reference_type: "task",
    });

    const updated = await TaskModel.getTaskDetails(taskId);
    return successResponse(res, "Task reassigned successfully", updated);
  } catch (error) {
    return next(error);
  }
}

async function getTaskReassignments(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    const task = await TaskModel.getTaskDetails(taskId);
    if (!task) {
      throw new NotFoundError("Task not found");
    }

    const isAdmin = req.user.role === "admin";
    const isLead =
      req.user.role === "team_lead" && task.lead_reviewed_by === req.user.id;
    const isOriginalAssignee = req.user.id === task.assigned_to;

    if (!isAdmin && !isLead && !isOriginalAssignee) {
      throw new ForbiddenError("Not authorized to view reassignment history");
    }

    const history = await TaskModel.getReassignmentHistory(taskId);
    return successResponse(
      res,
      "Task reassignment history retrieved successfully",
      history,
    );
  } catch (error) {
    return next(error);
  }
}

async function deleteTask(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    const task = await TaskModel.findById(taskId);
    if (!task || !task.is_active) {
      throw new NotFoundError("Task not found");
    }

    const project = await ProjectModel.findById(task.project_id);
    const isAdmin = req.user.role === "admin";
    if (!project || (!isAdmin && project.lead_reviewed_by !== req.user.id)) {
      throw new ForbiddenError("Only project owner can delete task");
    }

    await TaskModel.deleteTask(taskId);
    return successResponse(res, "Task deleted successfully", null, 200);
  } catch (error) {
    return next(error);
  }
}

async function getOverdueStatus(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    const task = await TaskModel.getTaskDetails(taskId);
    if (!task) {
      throw new NotFoundError("Task not found");
    }

    const isAdmin = req.user.role === "admin";
    const isLead =
      req.user.role === "team_lead" && task.lead_reviewed_by === req.user.id;
    const isAssignee =
      req.user.role === "member" && task.assigned_to === req.user.id;

    if (!isAdmin && !isLead && !isAssignee) {
      throw new ForbiddenError("Not authorized to view overdue status");
    }

    const data = await TaskModel.getOverdueStatus(taskId);
    return successResponse(
      res,
      "Task overdue status retrieved successfully",
      data,
    );
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createTask,
  getMyTasks,
  getTaskById,
  updateTaskStatus,
  updateTask,
  updateAssigneeStatus,
  reassignTask,
  getTaskReassignments,
  deleteTask,
  getOverdueStatus,
};
