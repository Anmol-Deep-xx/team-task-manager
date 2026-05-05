const express = require("express");
const projectController = require("../controllers/projectController");
const sprintController = require("../controllers/sprintController");
const projectNoteController = require("../controllers/projectNoteController");
const { authenticate, authorizeRoles } = require("../middleware/auth");
const { validateRequest } = require("../middleware/validation");
const {
  paginationRules,
  projectRules,
  projectUpdateRules,
  sprintCreateRules,
  noteCreateRules,
  noteUpdateRules,
} = require("../utils/validators");

const router = express.Router();

router.use(authenticate);

router.post(
  "/",
  authorizeRoles("team_lead", "admin"),
  projectRules,
  validateRequest,
  projectController.createProject,
);
router.get(
  "/",
  authorizeRoles("team_lead", "member", "admin"),
  paginationRules,
  validateRequest,
  projectController.getProjects,
);
router.get(
  "/:projectId",
  authorizeRoles("team_lead", "member", "admin"),
  projectController.getProjectById,
);
router.put(
  "/:projectId",
  authorizeRoles("team_lead", "admin"),
  projectUpdateRules,
  validateRequest,
  projectController.updateProject,
);
router.get(
  "/:projectId/members",
  authorizeRoles("team_lead", "member", "admin"),
  projectController.getProjectMembers,
);
router.delete(
  "/:projectId",
  authorizeRoles("team_lead", "admin"),
  projectController.deleteProject,
);
router.get(
  "/:projectId/tasks",
  authorizeRoles("team_lead", "member", "admin"),
  paginationRules,
  validateRequest,
  projectController.getProjectTasks,
);
router.get(
  "/:projectId/sprints",
  authorizeRoles("team_lead", "member", "admin"),
  sprintController.getProjectSprints,
);
router.post(
  "/:projectId/sprints",
  authorizeRoles("team_lead", "admin"),
  sprintCreateRules,
  validateRequest,
  sprintController.createSprint,
);

router.post(
  "/:projectId/notes",
  authorizeRoles("team_lead", "admin"),
  noteCreateRules,
  validateRequest,
  projectNoteController.createProjectNote,
);
router.get(
  "/:projectId/notes",
  authorizeRoles("team_lead", "member", "admin"),
  projectNoteController.getProjectNotes,
);
router.put(
  "/:projectId/notes/:noteId",
  authorizeRoles("team_lead", "admin"),
  noteUpdateRules,
  validateRequest,
  projectNoteController.updateProjectNote,
);
router.delete(
  "/:projectId/notes/:noteId",
  authorizeRoles("team_lead", "admin"),
  projectNoteController.deleteProjectNote,
);

module.exports = router;
