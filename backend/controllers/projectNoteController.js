const ProjectModel = require("../models/Project");
const ProjectNoteModel = require("../models/ProjectNote");
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

async function ensureProjectExistsAndAccess(projectId, user) {
  const project = await ProjectModel.findById(projectId);
  if (!project) {
    throw new NotFoundError("Project not found");
  }

  const hasAccess = await ProjectModel.hasProjectAccess(
    projectId,
    user.id,
    user.role,
  );
  if (!hasAccess) {
    throw new ForbiddenError("You do not have access to this project");
  }

  return project;
}

async function validateProjectAssignees(projectId, assigneeIds) {
  const ids = normalizeIds(assigneeIds);
  if (ids.length === 0) {
    return [];
  }

  const members = await ProjectModel.getProjectMembers(projectId);
  const memberIds = new Set(members.map((member) => Number(member.id)));
  const invalidIds = ids.filter((id) => !memberIds.has(id));

  if (invalidIds.length > 0) {
    throw new ValidationError("Invalid note assignees", [
      {
        field: "assignee_ids",
        message: `These users are not project members: ${invalidIds.join(", ")}`,
      },
    ]);
  }

  return ids;
}

async function createProjectNote(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    await ensureProjectExistsAndAccess(projectId, req.user);

    const assigneeIds = await validateProjectAssignees(
      projectId,
      req.body.assignee_ids,
    );

    const noteId = await ProjectNoteModel.createNote({
      projectId,
      noteText: req.body.note_text,
      createdBy: req.user.id,
      assigneeIds,
    });

    const created = await ProjectNoteModel.getNoteById(noteId);
    return successResponse(res, "Project note created", created, 201);
  } catch (error) {
    return next(error);
  }
}

async function getProjectNotes(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    await ensureProjectExistsAndAccess(projectId, req.user);

    const notes = await ProjectNoteModel.getNotesByProject(
      projectId,
      req.user.id,
      req.user.role,
    );

    return successResponse(res, "Project notes retrieved", notes);
  } catch (error) {
    return next(error);
  }
}

async function updateProjectNote(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    const noteId = Number(req.params.noteId);
    await ensureProjectExistsAndAccess(projectId, req.user);

    const note = await ProjectNoteModel.getNoteById(noteId);
    if (!note || Number(note.project_id) !== projectId) {
      throw new NotFoundError("Project note not found");
    }

    const assigneeIds = await validateProjectAssignees(
      projectId,
      req.body.assignee_ids,
    );

    await ProjectNoteModel.updateNote({
      noteId,
      noteText: req.body.note_text,
      assigneeIds,
    });

    const notes = await ProjectNoteModel.getNotesByProject(
      projectId,
      req.user.id,
      req.user.role,
    );
    const updated = notes.find((entry) => Number(entry.id) === noteId) || null;

    return successResponse(res, "Project note updated", updated);
  } catch (error) {
    return next(error);
  }
}

async function deleteProjectNote(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    const noteId = Number(req.params.noteId);
    await ensureProjectExistsAndAccess(projectId, req.user);

    const note = await ProjectNoteModel.getNoteById(noteId);
    if (!note || Number(note.project_id) !== projectId) {
      throw new NotFoundError("Project note not found");
    }

    await ProjectNoteModel.deleteNote(noteId);
    return successResponse(res, "Project note deleted", null, 200);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createProjectNote,
  getProjectNotes,
  updateProjectNote,
  deleteProjectNote,
};
