const ROLES = {
  ADMIN: "admin",
  TEAM_LEAD: "team_lead",
  MEMBER: "member",
};

const TASK_STATUS = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  REVIEW: "review",
  COMPLETE: "complete",
  DEPENDENCE: "dependence",
};

const PRIORITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};

const STATUS_TRANSITIONS = {
  open: ["in_progress", "review", "complete"],
  in_progress: ["open", "review", "complete"],
  review: ["open", "in_progress", "complete"],
  complete: ["open", "in_progress", "review"],
  dependence: ["open", "in_progress", "review", "complete"],
};

module.exports = {
  ROLES,
  TASK_STATUS,
  PRIORITY,
  STATUS_TRANSITIONS,
};
