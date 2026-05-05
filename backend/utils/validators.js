const { body, param, query } = require("express-validator");
const { ROLES, PRIORITY, TASK_STATUS } = require("../config/constants");

const emailRule = body("email")
  .isEmail()
  .withMessage("Invalid email format")
  .normalizeEmail();
const passwordRule = body("password")
  .isLength({ min: 8 })
  .withMessage("Password must be at least 8 characters")
  .matches(/[A-Z]/)
  .withMessage("Password must include an uppercase letter")
  .matches(/[a-z]/)
  .withMessage("Password must include a lowercase letter")
  .matches(/[0-9]/)
  .withMessage("Password must include a number");

const paginationRules = [
  query("page").optional().isInt({ min: 1 }).withMessage("page must be >= 1"),
  query("pageSize")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("pageSize must be between 1 and 100"),
];

const registerRules = [
  body("name")
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage("Name must be 3-100 characters"),
  emailRule,
  passwordRule,
  body("contact_number")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Contact number too long"),
  body("profile_picture")
    .optional()
    .trim()
    .isString()
    .withMessage("Profile picture must be a string")
    .isLength({ max: 500 })
    .withMessage("Profile picture URL too long"),
  body("role")
    .optional()
    .isIn([ROLES.ADMIN, ROLES.TEAM_LEAD, ROLES.MEMBER])
    .withMessage("Role must be admin, team_lead or member"),
];

const loginRules = [
  emailRule,
  body("password").notEmpty().withMessage("Password is required"),
];

const userUpdateRules = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage("Name must be 3-100 characters"),
  body("contact_number")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Contact number too long"),
  body("profile_picture")
    .optional()
    .trim()
    .isString()
    .withMessage("Profile picture must be a string")
    .isLength({ max: 500 })
    .withMessage("Profile picture URL too long"),
  body("is_active")
    .optional()
    .isBoolean()
    .withMessage("is_active must be boolean"),
  param("userId").isInt({ min: 1 }).withMessage("Invalid userId"),
];

const projectRules = [
  body("name")
    .trim()
    .isLength({ min: 1, max: 150 })
    .withMessage("Project name must be 1-150 characters"),
  body("client_name")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Client name must be 1-100 characters"),
  body("project_source")
    .trim()
    .notEmpty()
    .withMessage("project_source is required"),
  body("internal_notes")
    .optional()
    .isLength({ max: 5000 })
    .withMessage("internal_notes too long"),
  body("team_member_count")
    .optional()
    .isInt({ min: 0 })
    .withMessage("team_member_count must be >= 0"),
  body("member_ids")
    .optional()
    .isArray()
    .withMessage("member_ids must be an array of member ids"),
  body("member_ids.*")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Each member id must be a positive integer"),
  body("team_member_count")
    .optional()
    .custom((value, { req }) => {
      if (
        req.body.member_ids !== undefined &&
        Number(value) !== req.body.member_ids.length
      ) {
        throw new Error(
          "team_member_count must match selected member_ids length",
        );
      }
      return true;
    }),
];

const projectUpdateRules = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 150 })
    .withMessage("Project name must be 1-150 characters"),
  body("client_name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Client name must be 1-100 characters"),
  body("project_source")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("project_source cannot be empty"),
  body("internal_notes")
    .optional()
    .isLength({ max: 5000 })
    .withMessage("internal_notes too long"),
  body("is_active")
    .optional()
    .isBoolean()
    .withMessage("is_active must be boolean"),
  body("team_member_count")
    .optional()
    .isInt({ min: 0 })
    .withMessage("team_member_count must be >= 0"),
  body("member_ids")
    .optional()
    .isArray()
    .withMessage("member_ids must be an array of member ids"),
  body("member_ids.*")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Each member id must be a positive integer"),
  body("team_member_count")
    .optional()
    .custom((value, { req }) => {
      if (
        req.body.member_ids !== undefined &&
        Number(value) !== req.body.member_ids.length
      ) {
        throw new Error(
          "team_member_count must match selected member_ids length",
        );
      }
      return true;
    }),
];

const taskCreateRules = [
  body("project_id").isInt({ min: 1 }).withMessage("project_id is required"),
  body("sprint_id")
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage("sprint_id must be a positive integer"),
  body("task_name")
    .trim()
    .isLength({ min: 5, max: 150 })
    .withMessage("Task name must be 5-150 characters"),
  body("description")
    .optional()
    .isLength({ max: 2000 })
    .withMessage("Description too long"),
  body("assigned_to")
    .optional()
    .isInt({ min: 1 })
    .withMessage("assigned_to must be a positive integer"),
  body("assigned_to_ids")
    .optional()
    .isArray({ min: 1 })
    .withMessage("assigned_to_ids must be a non-empty array"),
  body("assigned_to_ids.*")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Each assigned_to_ids value must be a positive integer"),
  body().custom((value) => {
    const hasSingle =
      value.assigned_to !== undefined &&
      value.assigned_to !== null &&
      value.assigned_to !== "";
    const hasMany =
      Array.isArray(value.assigned_to_ids) && value.assigned_to_ids.length > 0;
    if (!hasSingle && !hasMany) {
      throw new Error("assigned_to or assigned_to_ids is required");
    }
    return true;
  }),
  body("estimated_time")
    .isFloat({ gt: 0, lte: 500 })
    .withMessage("estimated_time must be > 0 and <= 500"),
  body("due_date")
    .exists({ checkFalsy: true })
    .withMessage("due_date is required")
    .bail()
    .isISO8601()
    .withMessage("due_date must be a valid date")
    .bail()
    .custom((value) => {
      const inputDate = new Date(value);
      inputDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (inputDate < today) {
        throw new Error("due_date cannot be in the past");
      }
      return true;
    }),
  body("priority")
    .optional()
    .isIn(Object.values(PRIORITY))
    .withMessage("Invalid priority"),
];

const taskUpdateRules = [
  body("task_name")
    .optional()
    .trim()
    .isLength({ min: 5, max: 150 })
    .withMessage("Task name must be 5-150 characters"),
  body("description")
    .optional()
    .isLength({ max: 2000 })
    .withMessage("Description too long"),
  body("estimated_time")
    .optional()
    .isFloat({ gt: 0, lte: 500 })
    .withMessage("estimated_time must be > 0 and <= 500"),
  body("due_date")
    .optional()
    .isISO8601()
    .withMessage("due_date must be a valid date"),
  body("priority")
    .optional()
    .isIn(Object.values(PRIORITY))
    .withMessage("Invalid priority"),
  body("sprint_id")
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === "") return true;
      if (!Number.isInteger(Number(value)) || Number(value) < 1) {
        throw new Error("sprint_id must be a positive integer or null");
      }
      return true;
    }),
  body("assigned_to")
    .optional()
    .isInt({ min: 1 })
    .withMessage("assigned_to must be a positive integer"),
  body("assigned_to_ids")
    .optional()
    .isArray({ min: 1 })
    .withMessage("assigned_to_ids must be a non-empty array"),
  body("assigned_to_ids.*")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Each assigned_to_ids value must be a positive integer"),
  param("taskId").isInt({ min: 1 }).withMessage("Invalid taskId"),
];

const sprintCreateRules = [
  param("projectId").isInt({ min: 1 }).withMessage("Invalid projectId"),
  body("name")
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("Sprint name must be 2-120 characters"),
  body("goal").optional().isLength({ max: 1000 }).withMessage("goal too long"),
  body("start_date")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("start_date must be a valid date"),
  body("end_date")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("end_date must be a valid date"),
];

const statusUpdateRules = [
  param("taskId").isInt({ min: 1 }).withMessage("Invalid taskId"),
  body("status")
    .exists({ checkFalsy: true })
    .withMessage("status is required")
    .bail()
    .isString()
    .withMessage("status must be a string")
    .bail()
    .trim()
    .toLowerCase()
    .isIn(Object.values(TASK_STATUS))
    .withMessage(
      `Invalid status. Allowed values: ${Object.values(TASK_STATUS).join(", ")}`,
    ),
];

const assigneeStatusUpdateRules = [
  param("taskId").isInt({ min: 1 }).withMessage("Invalid taskId"),
  body("status")
    .exists({ checkFalsy: true })
    .withMessage("status is required")
    .bail()
    .isIn(["dependence", "active"])
    .withMessage("status must be dependence or active"),
];

const noteCreateRules = [
  body("note_text")
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage("note_text must be 1-5000 characters"),
  body("assignee_ids")
    .optional()
    .isArray()
    .withMessage("assignee_ids must be an array"),
  body("assignee_ids.*")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Each assignee id must be a positive integer"),
];

const noteUpdateRules = [
  param("noteId").isInt({ min: 1 }).withMessage("Invalid noteId"),
  ...noteCreateRules,
];

const reassignRules = [
  param("taskId").isInt({ min: 1 }).withMessage("Invalid taskId"),
  body("assign_to").isInt({ min: 1 }).withMessage("assign_to is required"),
  body("reason")
    .optional()
    .isLength({ max: 2000 })
    .withMessage("reason too long"),
];

const timeEntryRules = [
  body("task_id").isInt({ min: 1 }).withMessage("task_id is required"),
  body("time_logged")
    .isFloat({ gt: 0, lte: 24 })
    .withMessage("time_logged must be > 0 and <= 24"),
  body("date_logged")
    .isISO8601()
    .withMessage("date_logged must be a valid date")
    .custom((date) => {
      const inputDate = new Date(date);
      const now = new Date();
      if (inputDate > now) {
        throw new Error("date_logged cannot be in future");
      }
      return true;
    }),
];

const timeEntryUpdateRules = [
  param("timeEntryId").isInt({ min: 1 }).withMessage("Invalid timeEntryId"),
  body("time_logged")
    .optional()
    .isFloat({ gt: 0, lte: 24 })
    .withMessage("time_logged must be > 0 and <= 24"),
  body("date_logged")
    .optional()
    .isISO8601()
    .withMessage("date_logged must be a valid date"),
];

const commentRules = [
  body("comment_text")
    .trim()
    .isLength({ min: 3, max: 1000 })
    .withMessage("comment_text must be 3-1000 characters"),
];

const messageRules = [
  body("message_text")
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage("message_text must be 1-2000 characters"),
];

module.exports = {
  paginationRules,
  registerRules,
  loginRules,
  userUpdateRules,
  projectRules,
  projectUpdateRules,
  taskCreateRules,
  taskUpdateRules,
  sprintCreateRules,
  statusUpdateRules,
  assigneeStatusUpdateRules,
  noteCreateRules,
  noteUpdateRules,
  reassignRules,
  timeEntryRules,
  timeEntryUpdateRules,
  commentRules,
  messageRules,
};
