import { useMemo } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Briefcase,
  CheckCircle,
  Layers,
  AlertTriangle,
  CalendarDays,
  ArrowRight,
} from "lucide-react";
import TaskBoard from "../components/TaskBoard";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getInitial(name) {
  return String(name || "?")
    .trim()
    .charAt(0)
    .toUpperCase();
}

function hashNameToHue(name) {
  const value = String(name || "");
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    user,
    isLead,
    overview,
    teamPerformance,
    memberWorkload,
    boardTasks,
    handleStatusDrop,
  } = useOutletContext();

  const greeting = useMemo(() => getGreeting(), []);
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  const maxWorkload = 10;

  const kpiCards = [
    {
      key: "active_projects",
      label: "Active Projects",
      value: overview?.active_projects || 0,
      trend: "Steady",
      accent: "kpi-blue",
      icon: <Layers size={20} />,
    },
    {
      key: "overdue_tasks",
      label: "Overdue Tasks",
      value: overview?.overdue_tasks || 0,
      trend: (overview?.overdue_tasks || 0) > 0 ? "Attention" : "On track",
      accent: "kpi-red",
      icon: <AlertTriangle size={20} />,
    },
    {
      key: "completed_tasks",
      label: "Completed Tasks",
      value: overview?.completed_tasks || overview?.task_stats?.complete || 0,
      trend: "+12% this week",
      accent: "kpi-green",
      icon: <CheckCircle size={20} />,
    },
    {
      key: "total_projects",
      label: "Total Projects",
      value: overview?.total_projects || 0,
      trend: "Portfolio view",
      accent: "kpi-purple",
      icon: <Briefcase size={20} />,
    },
  ];

  function onDragOver(event) {
    event.preventDefault();
  }

  async function onDropStatus(event, status) {
    event.preventDefault();
    const taskId = Number(
      event.dataTransfer.getData("taskId") ||
        event.dataTransfer.getData("text/plain"),
    );
    if (!taskId) return;

    await handleStatusDrop(taskId, status);
  }

  return (
    <div className="stack slide-in">
      {isLead ? (
        <>
          <section className="panel lead-modern-hero">
            <div>
              <p className="lead-modern-greeting">
                {greeting}, {user?.name || "Team Lead"} 👋
              </p>
              <h2>Here&apos;s what&apos;s happening with your team today.</h2>
            </div>
            <div className="lead-modern-date">
              <CalendarDays size={16} />
              <span>{todayLabel}</span>
            </div>
          </section>

          <section className="lead-modern-kpi-grid">
            {kpiCards.map((card) => (
              <article
                key={card.key}
                className={`panel lead-kpi-card ${card.accent}`}
              >
                <div className="lead-kpi-head">
                  <span className="lead-kpi-icon">{card.icon}</span>
                </div>
                <strong>{card.value}</strong>
                <p>{card.label}</p>
                <small>{card.trend}</small>
              </article>
            ))}
          </section>

          <section className="lead-modern-two-col">
            <article className="panel lead-perf-panel">
              <div className="lead-panel-head">
                <h3>Team Performance</h3>
              </div>

              <div className="lead-perf-table-wrap">
                <table className="lead-perf-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Role</th>
                      <th>Completed Tasks</th>
                      <th>Avg Time</th>
                      <th>Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamPerformance?.length > 0 ? (
                      teamPerformance.map((member) => {
                        const name =
                          member.member_name || member.name || "Unknown";
                        const hue = hashNameToHue(name);
                        const overdue = Number(member.overdue_tasks || 0);
                        return (
                          <tr key={member.member_id || member.id}>
                            <td>
                              <div className="lead-member-cell">
                                <span
                                  className="lead-member-avatar"
                                  style={{
                                    background: `hsl(${hue} 70% 92%)`,
                                    color: `hsl(${hue} 60% 30%)`,
                                  }}
                                >
                                  {getInitial(name)}
                                </span>
                                <span>{name}</span>
                              </div>
                            </td>
                            <td>Member</td>
                            <td>{member.completed_tasks || 0}</td>
                            <td>
                              {Math.round(member.avg_completion_hours || 0)}h
                            </td>
                            <td>
                              <span
                                className={
                                  overdue > 0
                                    ? "lead-overdue-pill is-high"
                                    : "lead-overdue-pill is-low"
                                }
                              >
                                {overdue}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={5}
                          className="muted"
                          style={{ textAlign: "center" }}
                        >
                          No performance data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="panel lead-workload-panel">
              <div className="lead-panel-head">
                <h3>Member Workload</h3>
              </div>

              <div className="lead-workload-list">
                {memberWorkload?.length > 0 ? (
                  memberWorkload.map((member) => {
                    const activeTasks =
                      Number(member.active_tasks) ||
                      Number(member.open_tasks || 0) +
                        Number(member.in_progress_tasks || 0) +
                        Number(member.review_tasks || 0);
                    const fillPercent = Math.min(
                      100,
                      (activeTasks / maxWorkload) * 100,
                    );
                    const hue = hashNameToHue(member.name);
                    return (
                      <div key={member.id} className="lead-workload-row">
                        <div className="lead-workload-member">
                          <span
                            className="lead-member-avatar"
                            style={{
                              background: `hsl(${hue} 70% 92%)`,
                              color: `hsl(${hue} 60% 30%)`,
                            }}
                          >
                            {getInitial(member.name)}
                          </span>
                          <span>{member.name}</span>
                        </div>
                        <span className="lead-workload-count">
                          Active Tasks: {activeTasks}
                        </span>
                        <div className="lead-workload-track">
                          <span
                            className="lead-workload-fill"
                            style={{ width: `${fillPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="muted">No active assignments.</p>
                )}
              </div>
            </article>
          </section>

          <section className="panel lead-task-cta-panel">
            <div className="lead-panel-head">
              <h3>Task Operations</h3>
            </div>
            <p className="muted">
              Use the Tasks page to manage statuses, dependencies, and assignee
              workflows.
            </p>
            <button
              type="button"
              className="ghost"
              onClick={() => navigate("/tasks")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              Open Tasks <ArrowRight size={14} />
            </button>
          </section>
        </>
      ) : (
        <section className="member-board-shell">
          <section className="board-panel member-board-panel">
            {boardTasks.length === 0 ? (
              <div className="empty-state-card board-empty-state">
                <AlertTriangle size={38} style={{ color: "#cbd5e1" }} />
                <h3>No tasks assigned yet</h3>
                <p className="muted">
                  Once tasks are assigned to you, they will appear here across
                  all projects.
                </p>
              </div>
            ) : (
              <TaskBoard
                tasks={boardTasks}
                onTaskClick={(task) => navigate("/task/" + task.id)}
                onTaskDragStart={(event, task) => {
                  event.dataTransfer.setData("taskId", String(task.id));
                  event.dataTransfer.setData("text/plain", String(task.id));
                }}
                onDropTask={onDropStatus}
                onDragOverTask={onDragOver}
              />
            )}
          </section>
        </section>
      )}
    </div>
  );
}
