const express = require("express");
const taskController = require("../controllers/taskController");
const commentController = require("../controllers/commentController");
const messageController = require("../controllers/messageController");
const timeEntryController = require("../controllers/timeEntryController");
const taskNoteController = require("../controllers/taskNoteController");
const { authenticate, authorizeRoles } = require("../middleware/auth");
const { validateRequest } = require("../middleware/validation");
const {
  taskCreateRules,
  taskUpdateRules,
  statusUpdateRules,
  assigneeStatusUpdateRules,
  reassignRules,
  paginationRules,
  commentRules,
  messageRules,
  noteCreateRules,
  noteUpdateRules,
} = require("../utils/validators");

const router = express.Router();

router.use(authenticate);

router.post(
  "/",
  authorizeRoles("team_lead", "admin"),
  taskCreateRules,
  validateRequest,
  taskController.createTask,
);
router.get(
  "/my-tasks",
  authorizeRoles("member"),
  paginationRules,
  validateRequest,
  taskController.getMyTasks,
);
router.get("/:taskId", taskController.getTaskById);
router.patch(
  "/:taskId/status",
  statusUpdateRules,
  validateRequest,
  taskController.updateTaskStatus,
);
router.patch(
  "/:taskId/assignee-status",
  assigneeStatusUpdateRules,
  validateRequest,
  taskController.updateAssigneeStatus,
);
router.put(
  "/:taskId",
  authorizeRoles("team_lead", "admin"),
  taskUpdateRules,
  validateRequest,
  taskController.updateTask,
);
router.post(
  "/:taskId/reassign",
  authorizeRoles("team_lead", "member", "admin"),
  reassignRules,
  validateRequest,
  taskController.reassignTask,
);
router.get("/:taskId/reassignments", taskController.getTaskReassignments);
router.delete(
  "/:taskId",
  authorizeRoles("team_lead", "admin"),
  taskController.deleteTask,
);
router.get("/:taskId/overdue-status", taskController.getOverdueStatus);

router.post(
  "/:taskId/comments",
  commentRules,
  validateRequest,
  commentController.addComment,
);
router.get("/:taskId/comments", commentController.getTaskComments);
router.post(
  "/:taskId/messages",
  messageRules,
  validateRequest,
  messageController.addMessage,
);
router.get("/:taskId/messages", messageController.getTaskMessages);
router.get("/:taskId/time-entries", timeEntryController.getTaskTimeEntries);

router.post(
  "/:taskId/notes",
  authorizeRoles("team_lead", "admin"),
  noteCreateRules,
  validateRequest,
  taskNoteController.createTaskNote,
);
router.get(
  "/:taskId/notes",
  authorizeRoles("team_lead", "member", "admin"),
  taskNoteController.getTaskNotes,
);
router.put(
  "/:taskId/notes/:noteId",
  authorizeRoles("team_lead", "admin"),
  noteUpdateRules,
  validateRequest,
  taskNoteController.updateTaskNote,
);
router.delete(
  "/:taskId/notes/:noteId",
  authorizeRoles("team_lead", "admin"),
  taskNoteController.deleteTaskNote,
);

module.exports = router;
