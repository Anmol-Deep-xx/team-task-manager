const ProjectModel = require("../models/Project");
const TaskModel = require("../models/Task");
const UserModel = require("../models/User");
const { successResponse, paginationResponse } = require("../utils/response");
const {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  ValidationError,
} = require("../utils/errors");

function parsePagination(query) {
  const page = Number(query.page || 1);
  const pageSize = Number(query.pageSize || query.limit || 10);
  return { page, pageSize };
}

async function createProject(req, res, next) {
  try {
    const {
      name,
      client_name,
      project_source,
      internal_notes,
      member_ids = [],
    } = req.body;

    const existing = await ProjectModel.findByName(name);
    if (existing) {
      throw new ConflictError("Project name already exists");
    }

    const normalizedMemberIds = [
      ...new Set((member_ids || []).map(Number)),
    ].filter((id) => Number.isInteger(id) && id > 0);

    if (normalizedMemberIds.length) {
      const validMembers =
        await UserModel.findActiveMembersByIds(normalizedMemberIds);
      const validMemberIdSet = new Set(validMembers.map((row) => row.id));
      const invalidIds = normalizedMemberIds.filter(
        (id) => !validMemberIdSet.has(id),
      );

      if (invalidIds.length) {
        throw new ValidationError("Invalid member selection", [
          {
            field: "member_ids",
            message: `These members are invalid/inactive: ${invalidIds.join(", ")}`,
          },
        ]);
      }
    }

    const projectId = await ProjectModel.createProject({
      name,
      client_name,
      project_source,
      internal_notes,
      lead_reviewed_by: req.user.id,
      member_ids: normalizedMemberIds,
    });

    const created = await ProjectModel.getProjectWithTasks(projectId);
    return successResponse(res, "Project created successfully", created, 201);
  } catch (error) {
    return next(error);
  }
}

async function getProjects(req, res, next) {
  try {
    const { page, pageSize } = parsePagination(req.query);
    let isActive;
    if (req.query.isActive !== undefined) {
      isActive = req.query.isActive === "true";
    } else if (req.query.status === "active") {
      isActive = true;
    } else if (req.query.status === "inactive") {
      isActive = false;
    }

    const { rows, totalItems } = await ProjectModel.listProjects({
      page,
      pageSize,
      search: req.query.search,
      isActive,
      userId: req.user.id,
      role: req.user.role,
    });

    return paginationResponse(res, "Projects retrieved successfully", rows, {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    });
  } catch (error) {
    return next(error);
  }
}

async function getProjectById(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    const project = await ProjectModel.getProjectWithTasks(projectId);

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    const hasAccess = await ProjectModel.hasProjectAccess(
      projectId,
      req.user.id,
      req.user.role,
    );
    if (!hasAccess) {
      throw new ForbiddenError("You do not have access to this project");
    }

    return successResponse(res, "Project retrieved successfully", project);
  } catch (error) {
    return next(error);
  }
}

async function updateProject(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    const project = await ProjectModel.findById(projectId);

    if (!project) {
      throw new NotFoundError("Project not found");
    }
    const isAdmin = req.user.role === "admin";
    if (!isAdmin && project.lead_reviewed_by !== req.user.id) {
      throw new ForbiddenError("Only project owner can update this project");
    }

    const payload = {};
    [
      "name",
      "client_name",
      "project_source",
      "internal_notes",
      "is_active",
    ].forEach((field) => {
      if (req.body[field] !== undefined) payload[field] = req.body[field];
    });

    if (payload.name && payload.name !== project.name) {
      const existing = await ProjectModel.findByName(payload.name);
      if (existing) {
        throw new ConflictError("Project name already exists");
      }
    }

    await ProjectModel.updateProject(projectId, payload);

    if (req.body.member_ids !== undefined) {
      const normalizedMemberIds = [
        ...new Set((req.body.member_ids || []).map(Number)),
      ].filter((id) => Number.isInteger(id) && id > 0);

      if (normalizedMemberIds.length) {
        const validMembers =
          await UserModel.findActiveMembersByIds(normalizedMemberIds);
        const validMemberIdSet = new Set(validMembers.map((row) => row.id));
        const invalidIds = normalizedMemberIds.filter(
          (id) => !validMemberIdSet.has(id),
        );

        if (invalidIds.length) {
          throw new ValidationError("Invalid member selection", [
            {
              field: "member_ids",
              message: `These members are invalid/inactive: ${invalidIds.join(", ")}`,
            },
          ]);
        }
      }

      await ProjectModel.replaceProjectMembers(
        projectId,
        normalizedMemberIds,
        req.user.id,
      );
    }

    const updated = await ProjectModel.getProjectWithTasks(projectId);
    return successResponse(res, "Project updated successfully", updated);
  } catch (error) {
    return next(error);
  }
}

async function getProjectMembers(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    const project = await ProjectModel.findById(projectId);
    if (!project) {
      throw new NotFoundError("Project not found");
    }
    const hasAccess = await ProjectModel.hasProjectAccess(
      projectId,
      req.user.id,
      req.user.role,
    );
    if (!hasAccess) {
      throw new ForbiddenError("You do not have access to this project");
    }

    const members = await ProjectModel.getProjectMembers(projectId);
    return successResponse(
      res,
      "Project members retrieved successfully",
      members,
    );
  } catch (error) {
    return next(error);
  }
}

async function deleteProject(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    const project = await ProjectModel.findById(projectId);
    if (!project) {
      throw new NotFoundError("Project not found");
    }
    const isAdmin = req.user.role === "admin";
    if (!isAdmin && project.lead_reviewed_by !== req.user.id) {
      throw new ForbiddenError(
        "Only project owner can deactivate this project",
      );
    }

    await ProjectModel.deactivateProject(projectId);
    return successResponse(res, "Project deactivated successfully", null, 200);
  } catch (error) {
    return next(error);
  }
}

async function getProjectTasks(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    const project = await ProjectModel.findById(projectId);
    if (!project) {
      throw new NotFoundError("Project not found");
    }
    const hasAccess = await ProjectModel.hasProjectAccess(
      projectId,
      req.user.id,
      req.user.role,
    );
    if (!hasAccess) {
      throw new ForbiddenError("You do not have access to this project");
    }

    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 10);

    let rows;
    let totalItems;
    if (req.user.role === "member") {
      ({ rows, totalItems } = await TaskModel.listMemberTasks(req.user.id, {
        page,
        pageSize,
        status: req.query.status,
        priority: req.query.priority,
        project_id: projectId,
        sprint_id: req.query.sprint_id,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder,
      }));
    } else {
      ({ rows, totalItems } = await TaskModel.listProjectTasks(projectId, {
        page,
        pageSize,
        status: req.query.status,
        priority: req.query.priority,
        assigned_to: req.query.assigned_to,
        sprint_id: req.query.sprint_id,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder,
      }));
    }

    return paginationResponse(
      res,
      "Project tasks retrieved successfully",
      rows,
      {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    );
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  getProjectMembers,
  deleteProject,
  getProjectTasks,
};
