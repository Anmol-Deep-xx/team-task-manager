import { useOutletContext } from "react-router-dom";
import { AlertTriangle, Filter, X } from "lucide-react";
import { useMemo, useState } from "react";
import TaskBoard from "../components/TaskBoard";
import AssigneeTypeahead from "../components/AssigneeTypeahead";

export default function Tasks() {
  const {
    isLead,
    selectedProjectId,
    selectedSprintId,
    setSelectedSprintId,
    sprints,
    boardTasks,
    projectMembers,
    handleCreateTask,
    sprintForm,
    setSprintForm,
    handleCreateSprint,
    handleStatusDrop,
    taskForm,
    setTaskForm,
    openTaskModal,
    setGlobalMessage,
  } = useOutletContext();
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isCreateSprintOpen, setIsCreateSprintOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    taskName: "",
    priority: "all",
    memberId: "all",
    execMin: "",
    execMax: "",
  });

  const filterMembers = useMemo(() => {
    if (projectMembers.length > 0) return projectMembers;

    const map = new Map();
    (boardTasks || []).forEach((task) => {
      if (Array.isArray(task.assignees) && task.assignees.length > 0) {
        task.assignees.forEach((assignee) => {
          if (!assignee?.id) return;
          map.set(String(assignee.id), {
            id: String(assignee.id),
            name: assignee.name || `Member ${assignee.id}`,
          });
        });
      } else if (task.assigned_to) {
        map.set(String(task.assigned_to), {
          id: String(task.assigned_to),
          name:
            task.assigned_user_name ||
            task.assignee_name ||
            `Member ${task.assigned_to}`,
        });
      }
    });

    return Array.from(map.values());
  }, [projectMembers, boardTasks]);

  const filteredTasks = useMemo(() => {
    const query = filters.taskName.trim().toLowerCase();
    const minHours =
      filters.execMin === "" ? null : Math.max(0, Number(filters.execMin));
    const maxHours =
      filters.execMax === "" ? null : Math.max(0, Number(filters.execMax));

    return (boardTasks || []).filter((task) => {
      const name = String(task.task_name || "").toLowerCase();
      if (query && !name.includes(query)) return false;

      if (
        filters.priority !== "all" &&
        String(task.priority) !== filters.priority
      ) {
        return false;
      }

      if (filters.memberId !== "all") {
        const selectedMemberId = String(filters.memberId);
        const memberMatches =
          (Array.isArray(task.assignees) &&
            task.assignees.some(
              (assignee) => String(assignee.id) === selectedMemberId,
            )) ||
          String(task.assigned_to || "") === selectedMemberId;

        if (!memberMatches) return false;
      }

      const estimatedTime = Number(task.estimated_time || 0);
      if (minHours !== null && estimatedTime < minHours) return false;
      if (maxHours !== null && estimatedTime > maxHours) return false;

      return true;
    });
  }, [boardTasks, filters]);

  function requireProjectThen(action, itemLabel) {
    if (selectedProjectId) {
      action();
      return;
    }

    setGlobalMessage(
      `Select a project from filter before creating ${itemLabel}.`,
    );
  }

  return (
    <div
      className="stack slide-in"
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <section className="task-toolbar-row" style={{ flexShrink: 0 }}>
        <div className="task-toolbar-left">
          <select
            className="task-toolbar-sprint-select"
            value={selectedSprintId}
            onChange={(event) => setSelectedSprintId(event.target.value)}
            disabled={!selectedProjectId}
          >
            <option value="none">No Sprint</option>
            {sprints.map((sprint) => (
              <option key={sprint.id} value={String(sprint.id)}>
                {sprint.name}
              </option>
            ))}
          </select>
        </div>

        {isLead && (
          <div className="task-toolbar-right">
            <button
              type="button"
              className="ghost"
              onClick={() =>
                requireProjectThen(
                  () => setIsCreateSprintOpen(true),
                  "a sprint",
                )
              }
              title={
                !selectedProjectId ? "Select a project from navbar filter" : ""
              }
            >
              Create Sprint
            </button>
            <button
              type="button"
              onClick={() =>
                requireProjectThen(() => setIsCreateTaskOpen(true), "a task")
              }
              title={
                !selectedProjectId ? "Select a project from navbar filter" : ""
              }
            >
              Create Task
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => setShowFilters((prev) => !prev)}
            >
              {showFilters ? <X size={16} /> : <Filter size={16} />} Filter
            </button>
          </div>
        )}
      </section>

      {isLead && showFilters && (
        <div className="task-filter-panel">
          <div className="task-filter-grid">
            <label>
              Task Name
              <input
                value={filters.taskName}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    taskName: e.target.value,
                  }))
                }
                placeholder="Search task title"
              />
            </label>

            <label>
              Priority
              <select
                value={filters.priority}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    priority: e.target.value,
                  }))
                }
              >
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>

            <label>
              Assigned Member
              <select
                value={filters.memberId}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    memberId: e.target.value,
                  }))
                }
              >
                <option value="all">All Members</option>
                {filterMembers.map((member) => (
                  <option key={member.id} value={String(member.id)}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Execution Time Min (h)
              <input
                type="number"
                min="0"
                step="0.5"
                value={filters.execMin}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, execMin: e.target.value }))
                }
                placeholder="0"
              />
            </label>

            <label>
              Execution Time Max (h)
              <input
                type="number"
                min="0"
                step="0.5"
                value={filters.execMax}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, execMax: e.target.value }))
                }
                placeholder="24"
              />
            </label>
          </div>

          <div className="row wrap" style={{ justifyContent: "space-between" }}>
            <p className="muted" style={{ margin: 0 }}>
              Showing {filteredTasks.length} of {boardTasks.length} tasks.
            </p>
            <button
              type="button"
              className="ghost"
              onClick={() =>
                setFilters({
                  taskName: "",
                  priority: "all",
                  memberId: "all",
                  execMin: "",
                  execMax: "",
                })
              }
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {isLead && isCreateSprintOpen && (
        <div
          className="modal-shell"
          onClick={() => setIsCreateSprintOpen(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create Sprint</h3>
            <form className="stack" onSubmit={handleCreateSprint}>
              <input
                placeholder="Sprint name"
                value={sprintForm.name || ""}
                onChange={(e) =>
                  setSprintForm((prev) => ({ ...prev, name: e.target.value }))
                }
                required
              />
              <input
                placeholder="Sprint goal"
                value={sprintForm.goal || ""}
                onChange={(e) =>
                  setSprintForm((prev) => ({ ...prev, goal: e.target.value }))
                }
              />
              <div className="row wrap">
                <label style={{ flex: 1 }}>
                  Sprint Start Date
                  <input
                    type="date"
                    value={sprintForm.start_date || ""}
                    onChange={(e) =>
                      setSprintForm((prev) => ({
                        ...prev,
                        start_date: e.target.value,
                      }))
                    }
                  />
                </label>
                <label style={{ flex: 1 }}>
                  Sprint End Date
                  <input
                    type="date"
                    value={sprintForm.end_date || ""}
                    onChange={(e) =>
                      setSprintForm((prev) => ({
                        ...prev,
                        end_date: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="row wrap" style={{ justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setIsCreateSprintOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit">Create Sprint</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLead && isCreateTaskOpen && (
        <div className="modal-shell" onClick={() => setIsCreateTaskOpen(false)}>
          <div
            className="modal task-create-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="task-create-header">
              <h3>Create Task</h3>
              <p className="muted">
                Add details once and assign one or more members from your
                project team.
              </p>
            </div>

            <form
              className="stack task-create-form"
              onSubmit={handleCreateTask}
            >
              <div className="task-create-grid">
                <label>
                  Task Title
                  <input
                    placeholder="Design API response mapping"
                    value={taskForm.task_name || ""}
                    onChange={(e) =>
                      setTaskForm((prev) => ({
                        ...prev,
                        task_name: e.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <label>
                  Sprint
                  <select
                    value={taskForm.sprint_id || "none"}
                    onChange={(e) =>
                      setTaskForm((prev) => ({
                        ...prev,
                        sprint_id: e.target.value,
                      }))
                    }
                  >
                    <option value="none">No Sprint</option>
                    {sprints.map((sprint) => (
                      <option key={sprint.id} value={String(sprint.id)}>
                        {sprint.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Description
                <textarea
                  placeholder="Clear task scope, acceptance criteria, and dependencies"
                  value={taskForm.description || ""}
                  onChange={(e) =>
                    setTaskForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  rows="3"
                />
              </label>

              <label>
                Assign Team Members
                <AssigneeTypeahead
                  members={projectMembers}
                  selectedIds={taskForm.assigned_to_ids || []}
                  onChange={(values) =>
                    setTaskForm((prev) => ({
                      ...prev,
                      assigned_to_ids: values,
                      assigned_to: values[0] || "",
                    }))
                  }
                  placeholder="Type member name and select..."
                />
                <span className="task-member-hint">
                  Type a name and select suggestions to add member badges.
                </span>
              </label>

              <div className="task-create-grid task-create-grid--compact">
                <label>
                  Priority
                  <select
                    value={taskForm.priority || "medium"}
                    onChange={(e) =>
                      setTaskForm((prev) => ({
                        ...prev,
                        priority: e.target.value,
                      }))
                    }
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </label>

                <label>
                  Estimated Hours
                  <input
                    type="number"
                    placeholder="8"
                    value={taskForm.estimated_time || ""}
                    onChange={(e) =>
                      setTaskForm((prev) => ({
                        ...prev,
                        estimated_time: e.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Due Date
                  <input
                    type="date"
                    value={taskForm.due_date || ""}
                    onChange={(e) =>
                      setTaskForm((prev) => ({
                        ...prev,
                        due_date: e.target.value,
                      }))
                    }
                    required
                  />
                </label>
              </div>

              <div className="row wrap" style={{ justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setIsCreateTaskOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit">Create Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <section className="board-panel" style={{ flex: 1, minHeight: 0 }}>
        {filteredTasks.length === 0 ? (
          <div className="empty-state-card board-empty-state">
            <AlertTriangle size={36} style={{ color: "var(--border)" }} />
            <h3>No tasks found</h3>
            <p className="muted">
              Try changing filters, switching project from navbar, or create a
              new task.
            </p>
          </div>
        ) : (
          <TaskBoard
            tasks={filteredTasks}
            fitColumns={isLead}
            onTaskClick={openTaskModal}
            onTaskDragStart={(event, task) => {
              event.dataTransfer.setData("taskId", String(task.id));
              event.dataTransfer.setData("text/plain", String(task.id));
            }}
            onDropTask={(event, status) => {
              const taskId = Number(
                event.dataTransfer.getData("taskId") ||
                  event.dataTransfer.getData("text/plain"),
              );
              if (!taskId) return;
              handleStatusDrop(taskId, status);
            }}
            onDragOverTask={(event) => event.preventDefault()}
          />
        )}
      </section>
    </div>
  );
}
