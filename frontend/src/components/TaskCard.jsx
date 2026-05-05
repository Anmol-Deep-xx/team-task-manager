import { Clock, MessageSquare } from "lucide-react";
import { getServerUrl } from "../api";

const STATUS_THEME = {
  open: {
    surface: "#EFF6FF",
    accent: "#3B82F6",
    border: "rgba(59, 130, 246, 0.18)",
    tagBackground: "#DBEAFE",
    tagColor: "#1E3A8A",
  },
  in_progress: {
    surface: "#ECFDF3",
    accent: "#10B981",
    border: "rgba(16, 185, 129, 0.18)",
    tagBackground: "#D1FAE5",
    tagColor: "#065F46",
  },
  review: {
    surface: "#FCE7F3",
    accent: "#EC4899",
    border: "rgba(236, 72, 153, 0.18)",
    tagBackground: "#FBCFE8",
    tagColor: "#9D174D",
  },
  dependence: {
    surface: "#FFF7ED",
    accent: "#F59E0B",
    border: "rgba(245, 158, 11, 0.18)",
    tagBackground: "#FED7AA",
    tagColor: "#9A3412",
  },
  complete: {
    surface: "#F3E8FF",
    accent: "#8B5CF6",
    border: "rgba(139, 92, 246, 0.18)",
    tagBackground: "#DDD6FE",
    tagColor: "#4C1D95",
  },
};

const PROGRESS_BY_STATUS = {
  open: 20,
  in_progress: 50,
  review: 75,
  dependence: 35,
  complete: 100,
};

function formatDueDate(dueDate) {
  if (!dueDate) return "No due date";
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString();
}

function isOverdue(task) {
  if (!task?.due_date || task?.status === "complete") return false;
  const due = new Date(task.due_date);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function getPriorityTone(priority) {
  const value = String(priority || "medium").toLowerCase();
  if (value.includes("high")) {
    return { color: "#EF4444", label: "High" };
  }
  if (value.includes("low")) {
    return { color: "#3B82F6", label: "Low" };
  }
  return { color: "#F59E0B", label: "Medium" };
}

function getProgressValue(task) {
  const explicit = Number(
    task?.progress ?? task?.progress_percent ?? task?.completion_percentage,
  );
  if (Number.isFinite(explicit)) {
    return Math.max(0, Math.min(100, explicit));
  }

  const fallback = PROGRESS_BY_STATUS[task?.status];
  if (Number.isFinite(fallback)) return fallback;
  return 20;
}

function getAssignee(task) {
  const name = task?.assigned_user_name || task?.assignee_name || "Unassigned";
  const avatar = task?.assigned_user_profile_picture || task?.avatar_url || "";

  if (!task?.assigned_user_name && !task?.assignee_name) {
    return {
      name,
      avatar: "",
      initial: "?",
      title: "Unassigned",
      background: "#E5E7EB",
      color: "#6B7280",
    };
  }

  return {
    name,
    avatar,
    initial: name.charAt(0).toUpperCase(),
    title: name,
    background: "#FFFFFF",
    color: "#111827",
  };
}

function getCommentCount(task) {
  if (typeof task?.comment_count === "number") return task.comment_count;
  if (Array.isArray(task?.comments)) return task.comments.length;
  return 0;
}

export default function TaskCard({ task, onClick, onDragStart }) {
  const theme = STATUS_THEME[task?.status] || STATUS_THEME.open;
  const priorityTone = getPriorityTone(task?.priority);
  const assignee = getAssignee(task);
  const overdue = isOverdue(task);
  const progress = getProgressValue(task);
  const commentCount = getCommentCount(task);
  const category = task?.project_source || task?.project_name || "Website";
  const description = task?.description || "No task description provided yet.";
  const progressDots = Array.from({ length: 10 }, (_, index) => index);
  const activeDots = Math.max(1, Math.round(progress / 10));

  return (
    <article
      className={`kanban-card kanban-card--${task?.status || "open"}`}
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      style={{
        "--kanban-card-surface": theme.surface,
        "--kanban-card-accent": theme.accent,
        "--kanban-card-border": theme.border,
        "--kanban-card-tag-bg": theme.tagBackground,
        "--kanban-card-tag-color": theme.tagColor,
      }}
    >
      <div className="kanban-card__top">
        <span className="kanban-card__tag">{category}</span>
        <span
          className="kanban-card__priority"
          title={`${priorityTone.label} priority`}
        >
          <span
            className="kanban-card__priority-dot"
            style={{ backgroundColor: priorityTone.color }}
          />
        </span>
      </div>

      {overdue && (
        <div className="kanban-card__alert">
          <span className="kanban-card__alert-icon">!</span>
          <span>Lead alert: task deadline passed</span>
        </div>
      )}

      <h5 className="kanban-card__title">{task?.task_name}</h5>
      <p className="kanban-card__description">{description}</p>

      <div className="kanban-card__progress">
        <div className="kanban-card__progress-head">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div
          className="kanban-card__progress-dots"
          aria-label={`Progress ${progress}%`}
        >
          {progressDots.map((dotIndex) => (
            <span
              key={dotIndex}
              className={`kanban-card__progress-dot ${dotIndex < activeDots ? "is-active" : ""}`}
            />
          ))}
        </div>
      </div>

      <div className="kanban-card__footer">
        <div className={`kanban-card__due ${overdue ? "is-overdue" : ""}`}>
          <Clock size={14} />
          <span>{formatDueDate(task?.due_date)}</span>
        </div>

        <div className="kanban-card__meta">
          <span
            className="kanban-card__comments"
            title={`${commentCount} comments`}
          >
            <MessageSquare size={14} />
            <span>{commentCount}</span>
          </span>

          <div className="kanban-card__avatar" title={assignee.title}>
            {assignee.avatar ? (
              <img
                src={
                  assignee.avatar.startsWith("http")
                    ? assignee.avatar
                    : `${getServerUrl()}${assignee.avatar}`
                }
                alt={assignee.name}
                crossOrigin="anonymous"
              />
            ) : (
              <span
                className="kanban-card__avatar-fallback"
                style={{
                  background: assignee.background,
                  color: assignee.color,
                }}
              >
                {assignee.initial}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
