const ProjectModel = require("../models/Project");
const SprintModel = require("../models/Sprint");
const { successResponse } = require("../utils/response");
const {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} = require("../utils/errors");

async function createSprint(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    const { name, goal, start_date, end_date } = req.body;

    const project = await ProjectModel.findById(projectId);
    if (!project || !project.is_active) {
      throw new NotFoundError("Project not found");
    }

    const isAdmin = req.user.role === "admin";
    if (!isAdmin && project.lead_reviewed_by !== req.user.id) {
      throw new ForbiddenError(
        "Only project owner can create sprints for this project",
      );
    }

    if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
      throw new ValidationError("Invalid sprint date range", [
        {
          field: "end_date",
          message: "end_date must be on or after start_date",
        },
      ]);
    }

    const existing = await SprintModel.findByProjectAndName(projectId, name);
    if (existing) {
      throw new ConflictError("Sprint name already exists in this project");
    }

    const sprintId = await SprintModel.createSprint({
      project_id: projectId,
      name,
      goal,
      start_date,
      end_date,
      created_by: req.user.id,
    });

    const sprint = await SprintModel.findById(sprintId);
    return successResponse(res, "Sprint created successfully", sprint, 201);
  } catch (error) {
    return next(error);
  }
}

async function getProjectSprints(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);

    const project = await ProjectModel.findById(projectId);
    if (!project || !project.is_active) {
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

    const sprints = await SprintModel.listProjectSprints(projectId);
    return successResponse(
      res,
      "Project sprints retrieved successfully",
      sprints,
    );
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createSprint,
  getProjectSprints,
};
