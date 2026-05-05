import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Tasks from "./pages/Tasks";
import Teams from "./pages/Teams";
import TaskDetail from "./pages/TaskDetail";
import MyTimeLogs from "./pages/MyTimeLogs";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_BASE_URL, request } from "./api";
import AssigneeTypeahead from "./components/AssigneeTypeahead";
import "./App.css";

const STATUS_COLUMNS = [
  "open",
  "in_progress",
  "review",
  "complete",
  "dependence",
];

const STATUS_LABEL = {
  open: "Open",
  in_progress: "In Progress",
  review: "Review",
  complete: "Complete",
  dependence: "Dependence",
};

const PRIORITY_OPTIONS = ["low", "medium", "high"];

function toDateInputValue(dateLike) {
  const date = new Date(dateLike || Date.now());
  return date.toISOString().split("T")[0];
}

function dateInputAfterDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function groupTasksByStatus(tasks) {
  const grouped = {
    open: [],
    in_progress: [],
    review: [],
    complete: [],
    dependence: [],
  };

  (tasks || []).forEach((task) => {
    const status = grouped[task.status] ? task.status : "open";
    grouped[status].push(task);
  });

  return grouped;
}

function formatHoursToHuman(hoursValue) {
  const totalMinutes = Math.max(0, Math.round(Number(hoursValue || 0) * 60));
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function App() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light",
  );
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);

  const [token, setToken] = useState(
    () =>
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("accessToken") ||
      "",
  );
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  const [authMode, setAuthMode] = useState("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({
    name: "",
    email: "",
    password: "",
    contact_number: "",
    role: "member",
    profile_picture: null,
  });

  const [globalMessage, setGlobalMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedSprintId, setSelectedSprintId] = useState("none");
  const [sprints, setSprints] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [boardTasks, setBoardTasks] = useState([]);

  const [overview, setOverview] = useState(null);
  const [teamPerformance, setTeamPerformance] = useState([]);
  const [memberWorkload, setMemberWorkload] = useState([]);

  const [activeModal, setActiveModal] = useState(null);

  const [projectForm, setProjectForm] = useState({
    name: "",
    client_name: "",
    project_source: "",
    internal_notes: "",
    member_ids: [],
  });

  const [taskForm, setTaskForm] = useState({
    task_name: "",
    description: "",
    assigned_to: "",
    assigned_to_ids: [],
    sprint_id: "none",
    estimated_time: "8",
    due_date: dateInputAfterDays(3),
    priority: "medium",
  });

  const [sprintForm, setSprintForm] = useState({
    name: "",
    goal: "",
    start_date: "",
    end_date: "",
  });

  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    email: "",
    password: "",
    contact_number: "",
    profile_picture: null,
  });

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    contact_number: "",
    profile_picture: null,
  });
  const [dependenceAssignModal, setDependenceAssignModal] = useState({
    open: false,
    taskId: null,
    taskName: "",
    members: [],
    selectedMemberId: "",
    submitting: false,
  });

  const [taskModal, setTaskModal] = useState({
    open: false,
    loading: false,
    task: null,
    editMode: false,
    editForm: {
      task_name: "",
      description: "",
      estimated_time: "",
      due_date: "",
      priority: "medium",
      sprint_id: "none",
      assigned_to_ids: [],
    },
    comments: [],
    messages: [],
    activeTab: "details",
    chatText: "",
    members: [],
    timeEntries: [],
    reassignments: [],
    overdue: null,
    commentText: "",
    commentAssigneeIds: [],
    editCommentId: null,
    editCommentText: "",
    editCommentAssigneeIds: [],
    timeEntryForm: {
      time_logged: "1",
      date_logged: toDateInputValue(),
    },
    editingTimeEntryId: null,
    reassignTo: "",
    reassignReason: "",
    timerRunning: false,
    timerStartedAt: null,
    timerAccumulatedSeconds: 0,
  });
  const [timerNow, setTimerNow] = useState(Date.now());

  const isLoggedIn = Boolean(token && user);
  const isLead = ["team_lead", "admin"].includes(user?.role);

  const groupedTasks = useMemo(
    () => groupTasksByStatus(boardTasks),
    [boardTasks],
  );

  function setSession(nextToken, nextUser) {
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem("token", nextToken);
    localStorage.setItem("authToken", nextToken);
    localStorage.setItem("accessToken", nextToken);
    localStorage.setItem("user", JSON.stringify(nextUser));
  }

  function clearSession() {
    setToken("");
    setUser(null);
    setProjects([]);
    setSprints([]);
    setProjectMembers([]);
    setBoardTasks([]);
    setSelectedSprintId("none");
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
  }

  async function api(path, options = {}) {
    return request(path, {
      baseUrl,
      token,
      ...options,
    });
  }

  async function verifySession() {
    if (!token) {
      setSessionChecked(true);
      return;
    }

    try {
      const response = await request("/auth/verify", { baseUrl, token });
      const verifiedUser = response.data;
      setUser(verifiedUser);
      localStorage.setItem("user", JSON.stringify(verifiedUser));
    } catch (_error) {
      clearSession();
    } finally {
      setSessionChecked(true);
    }
  }

  async function loadProjects() {
    const response = await api("/projects?page=1&pageSize=100");
    const items = response.data?.items || [];
    setProjects(items);
    return items;
  }

  async function loadProjectMembers(projectId) {
    if (!projectId) {
      setProjectMembers([]);
      return [];
    }

    const response = await api(`/projects/${projectId}/members`);
    const members = response.data || [];
    setProjectMembers(members);
    return members;
  }

  async function loadSprints(projectId) {
    if (!projectId) {
      setSprints([]);
      return [];
    }

    const response = await api(`/projects/${projectId}/sprints`);
    const items = response.data || [];
    setSprints(items);
    return items;
  }

  async function loadBoardTasks(projectId, sprintId = selectedSprintId) {
    const params = new URLSearchParams({ page: "1", pageSize: "100" });

    if (sprintId && sprintId !== "none") {
      params.append("sprint_id", sprintId);
    }

    if (isLead) {
      if (!projectId) {
        const leadProjects =
          projects.length > 0
            ? projects
            : (await api("/projects?page=1&pageSize=100")).data?.items || [];

        if (leadProjects.length === 0) {
          setBoardTasks([]);
          return [];
        }

        const taskResults = await Promise.allSettled(
          leadProjects.map((project) =>
            api(`/projects/${project.id}/tasks?${params.toString()}`).then(
              (response) => response.data?.items || [],
            ),
          ),
        );

        const merged = taskResults
          .filter((result) => result.status === "fulfilled")
          .flatMap((result) => result.value || []);

        const deduped = Array.from(
          new Map(merged.map((task) => [Number(task.id), task])).values(),
        );

        setBoardTasks(deduped);
        return deduped;
      }

      const response = await api(
        `/projects/${projectId}/tasks?${params.toString()}`,
      );
      const items = response.data?.items || [];
      setBoardTasks(items);
      return items;
    }

    if (projectId) {
      params.append("project_id", String(projectId));
    }

    const response = await api(`/my-tasks?${params.toString()}`);
    const items = response.data?.items || [];
    setBoardTasks(items);
    return items;
  }

  async function loadLeadAnalytics(projectId) {
    if (!isLead) return;

    const [overviewRes, performanceRes, workloadRes] = await Promise.allSettled(
      [
        api("/dashboard/overview"),
        api(
          `/dashboard/team-performance${projectId ? `?project_id=${projectId}` : ""}`,
        ),
        api("/dashboard/member-workload?page=1&pageSize=100"),
      ],
    );

    if (overviewRes.status === "fulfilled") {
      setOverview(overviewRes.value.data || null);
    }
    if (performanceRes.status === "fulfilled") {
      setTeamPerformance(performanceRes.value.data || []);
    }
    if (workloadRes.status === "fulfilled") {
      setMemberWorkload(workloadRes.value.data?.items || []);
    }
  }

  async function loadUsers() {
    if (!isLead) return;

    const response = await api("/users?page=1&pageSize=100");
    const users = response.data?.items || [];
    setAllUsers(users);
    setAllMembers(users.filter((u) => u.role === "member"));
  }

  async function handleToggleUserActive(userId, isActive) {
    try {
      await api(`/users/${userId}`, {
        method: "PUT",
        body: { is_active: !isActive },
      });
      setGlobalMessage(
        !isActive
          ? "Employee activated successfully."
          : "Employee deactivated successfully.",
      );
      await loadUsers();
    } catch (error) {
      setGlobalMessage(error.message);
    }
  }

  async function handleUpdateUser(userId, payload) {
    try {
      let body;
      let isFormData = false;

      if (payload.profile_picture) {
        body = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (value === undefined || value === null || value === "") return;
          body.append(key, value);
        });
        isFormData = true;
      } else {
        body = payload;
      }

      const response = await api(`/users/${userId}`, {
        method: "PUT",
        body,
        ...(isFormData
          ? {}
          : { headers: { "Content-Type": "application/json" } }),
      });

      if (user?.id === userId) {
        setUser(response.data);
        localStorage.setItem("user", JSON.stringify(response.data));
      }

      setGlobalMessage("Member updated successfully.");
      await loadUsers();
      return response.data;
    } catch (error) {
      setGlobalMessage(error.message);
      throw error;
    }
  }

  async function bootstrapDashboard(targetProjectId = selectedProjectId) {
    setLoading(true);
    setGlobalMessage("");
    try {
      await loadProjects();
      const projectId = isLead ? targetProjectId || "" : targetProjectId || "";
      if (projectId) {
        await Promise.all([
          loadProjectMembers(projectId),
          loadSprints(projectId),
        ]);
      } else {
        setProjectMembers([]);
        setSprints([]);
      }
      await Promise.all([
        loadBoardTasks(projectId, selectedSprintId),
        isLead ? loadUsers() : Promise.resolve(),
        isLead ? loadLeadAnalytics(projectId) : Promise.resolve(),
      ]);
    } catch (error) {
      setGlobalMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    try {
      const response = await request("/auth/login", {
        baseUrl,
        method: "POST",
        body: loginForm,
      });
      setSession(response.data.token, response.data.user);
      setLoginForm({ email: "", password: "" });
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignup(event) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    try {
      const formData = new FormData();
      Object.entries(signupForm).forEach(([key, value]) => {
        if (value !== null && value !== "") {
          formData.append(key, value);
        }
      });

      await request("/auth/register", {
        baseUrl,
        method: "POST",
        body: formData,
      });
      setAuthMode("login");
      setSignupForm({
        name: "",
        email: "",
        password: "",
        contact_number: "",
        role: "member",
        profile_picture: null,
      });
      setAuthError("Signup successful. Please login.");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleCreateEmployee(event) {
    event.preventDefault();
    setGlobalMessage("");

    try {
      const formData = new FormData();
      formData.append("name", employeeForm.name);
      formData.append("email", employeeForm.email);
      formData.append("password", employeeForm.password);
      formData.append("contact_number", employeeForm.contact_number);
      formData.append("role", "member");
      if (employeeForm.profile_picture) {
        formData.append("profile_picture", employeeForm.profile_picture);
      }

      await request("/auth/register", {
        baseUrl,
        method: "POST",
        body: formData,
      });

      setEmployeeForm({
        name: "",
        email: "",
        password: "",
        contact_number: "",
        profile_picture: null,
      });
      setGlobalMessage("Employee created successfully.");
      await loadUsers();
    } catch (error) {
      setGlobalMessage(error.message);
    }
  }

  async function handleCreateProject(event) {
    event.preventDefault();
    setGlobalMessage("");
    try {
      const payload = {
        ...projectForm,
        team_member_count: projectForm.member_ids.length,
      };
      await api("/projects", { method: "POST", body: payload });

      setProjectForm({
        name: "",
        client_name: "",
        project_source: "",
        internal_notes: "",
        member_ids: [],
      });
      setGlobalMessage("Project created.");
      await bootstrapDashboard();
    } catch (error) {
      setGlobalMessage(error.message);
    }
  }

  async function handleUpdateProjectMembers() {
    if (!selectedProjectId) return;
    setGlobalMessage("");

    try {
      await api(`/projects/${selectedProjectId}`, {
        method: "PUT",
        body: {
          member_ids: projectForm.member_ids,
          team_member_count: projectForm.member_ids.length,
        },
      });
      setGlobalMessage("Project members updated.");
      await loadProjectMembers(selectedProjectId);
      await loadProjects();
    } catch (error) {
      setGlobalMessage(error.message);
    }
  }

  async function handleCreateTask(event) {
    event.preventDefault();
    if (!selectedProjectId) {
      setGlobalMessage("Select a project first.");
      return;
    }

    setGlobalMessage("");
    try {
      await api("/tasks", {
        method: "POST",
        body: {
          project_id: Number(selectedProjectId),
          task_name: taskForm.task_name,
          description: taskForm.description,
          assigned_to: Number(taskForm.assigned_to),
          assigned_to_ids:
            taskForm.assigned_to_ids?.length > 0
              ? taskForm.assigned_to_ids.map((id) => Number(id))
              : [Number(taskForm.assigned_to)],
          sprint_id:
            taskForm.sprint_id && taskForm.sprint_id !== "none"
              ? Number(taskForm.sprint_id)
              : null,
          estimated_time: Number(taskForm.estimated_time),
          due_date: taskForm.due_date,
          priority: taskForm.priority,
        },
      });

      setTaskForm({
        task_name: "",
        description: "",
        assigned_to: projectMembers[0]?.id ? String(projectMembers[0].id) : "",
        assigned_to_ids: projectMembers[0]?.id
          ? [String(projectMembers[0].id)]
          : [],
        sprint_id: "none",
        estimated_time: "8",
        due_date: dateInputAfterDays(3),
        priority: "medium",
      });
      setGlobalMessage("Task created.");
      await loadBoardTasks(selectedProjectId, selectedSprintId);
      await loadProjects();
    } catch (error) {
      setGlobalMessage(error.message);
    }
  }

  async function handleDeactivateUser(userId) {
    try {
      await api(`/users/${userId}`, { method: "DELETE" });
      setGlobalMessage("Employee deactivated.");
      await loadUsers();
    } catch (error) {
      setGlobalMessage(error.message);
    }
  }

  async function handleStatusDrop(taskId, targetStatus) {
    const previous = [...boardTasks];
    const currentTask = boardTasks.find(
      (task) => Number(task.id) === Number(taskId),
    );

    if (
      user?.role === "member" &&
      currentTask?.status === "dependence" &&
      targetStatus !== "dependence"
    ) {
      setGlobalMessage(
        "This task is in dependence for you and cannot be moved.",
      );
      return;
    }

    if (targetStatus === "dependence") {
      if (user?.role === "member") {
        try {
          if (!currentTask?.project_id) {
            throw new Error("Unable to resolve task project for reassignment.");
          }

          const memberRes = await api(
            `/projects/${currentTask.project_id}/members`,
          );
          const members = memberRes.data || [];

          const existingAssigneeIds = new Set(
            Array.isArray(currentTask.assignees)
              ? currentTask.assignees.map((assignee) => Number(assignee.id))
              : [Number(currentTask.assigned_to)],
          );

          const eligibleMembers = members.filter((member) => {
            const memberId = Number(member.id);
            if (memberId === Number(user?.id)) return false;
            return !existingAssigneeIds.has(memberId);
          });

          if (eligibleMembers.length === 0) {
            setGlobalMessage(
              "No eligible member available for reassignment in this project.",
            );
            return;
          }

          setDependenceAssignModal({
            open: true,
            taskId,
            taskName: currentTask?.task_name || "Task",
            members: eligibleMembers,
            selectedMemberId: String(eligibleMembers[0].id),
            submitting: false,
          });
        } catch (error) {
          setBoardTasks(previous);
          setGlobalMessage(error.message);
        }

        return;
      }

      try {
        await api(`/tasks/${taskId}/assignee-status`, {
          method: "PATCH",
          body: { status: "dependence" },
        });
        await loadBoardTasks(selectedProjectId, selectedSprintId);
      } catch (error) {
        setBoardTasks(previous);
        setGlobalMessage(error.message);
      }

      return;
    }

    setBoardTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, status: targetStatus } : task,
      ),
    );

    try {
      await api(`/tasks/${taskId}/status`, {
        method: "PATCH",
        body: { status: targetStatus },
      });
      await loadBoardTasks(selectedProjectId, selectedSprintId);
    } catch (error) {
      setBoardTasks(previous);
      setGlobalMessage(error.message);
    }
  }

  async function submitDependenceReassign() {
    if (
      !dependenceAssignModal.taskId ||
      !dependenceAssignModal.selectedMemberId
    ) {
      return;
    }

    setDependenceAssignModal((prev) => ({ ...prev, submitting: true }));
    try {
      const assignTo = Number(dependenceAssignModal.selectedMemberId);
      const selectedMember = dependenceAssignModal.members.find(
        (member) => Number(member.id) === assignTo,
      );

      await api(`/tasks/${dependenceAssignModal.taskId}/reassign`, {
        method: "POST",
        body: {
          assign_to: assignTo,
          reason: "Reassigned from dependence by member",
        },
      });

      setDependenceAssignModal({
        open: false,
        taskId: null,
        taskName: "",
        members: [],
        selectedMemberId: "",
        submitting: false,
      });

      setGlobalMessage(
        `Task reassigned to ${selectedMember?.name || "selected member"}.`,
      );
      await loadBoardTasks(selectedProjectId, selectedSprintId);
    } catch (error) {
      setDependenceAssignModal((prev) => ({ ...prev, submitting: false }));
      setGlobalMessage(error.message);
    }
  }

  async function openTaskModal(task) {
    setTaskModal((prev) => ({ ...prev, open: true, loading: true, task }));
    try {
      const [
        taskRes,
        commentsRes,
        messagesRes,
        timeRes,
        reassignRes,
        overdueRes,
      ] = await Promise.allSettled([
        api(`/tasks/${task.id}`),
        api(`/tasks/${task.id}/notes`),
        api(`/tasks/${task.id}/messages`),
        api(`/tasks/${task.id}/time-entries`),
        api(`/tasks/${task.id}/reassignments`),
        api(`/tasks/${task.id}/overdue-status`),
      ]);

      const details =
        taskRes.status === "fulfilled" ? taskRes.value.data : task;
      const comments =
        commentsRes.status === "fulfilled"
          ? commentsRes.value.data
          : details.comments || [];
      const messages =
        messagesRes.status === "fulfilled" ? messagesRes.value.data || [] : [];
      const timeEntries =
        timeRes.status === "fulfilled"
          ? timeRes.value.data?.entries || timeRes.value.data || []
          : details.time_entries || [];
      const reassignments =
        reassignRes.status === "fulfilled"
          ? reassignRes.value.data
          : details.reassignments || [];
      const overdue =
        overdueRes.status === "fulfilled" ? overdueRes.value.data : null;

      let modalMembers = projectMembers || [];
      if (details?.project_id) {
        try {
          const membersRes = await api(
            `/projects/${details.project_id}/members`,
          );
          modalMembers = membersRes.data || [];
        } catch (_error) {
          modalMembers = projectMembers || [];
        }
      }

      setTaskModal((prev) => ({
        ...prev,
        loading: false,
        task: details,
        editMode: false,
        editForm: {
          task_name: details.task_name || "",
          description: details.description || "",
          estimated_time: String(details.estimated_time || ""),
          due_date: details.due_date ? toDateInputValue(details.due_date) : "",
          priority: details.priority || "medium",
          sprint_id:
            details.sprint_id === null || details.sprint_id === undefined
              ? "none"
              : String(details.sprint_id),
          assigned_to_ids:
            Array.isArray(details.assignees) && details.assignees.length > 0
              ? details.assignees.map((assignee) => String(assignee.id))
              : details.assigned_to
                ? [String(details.assigned_to)]
                : [],
        },
        comments,
        messages,
        activeTab: "details",
        chatText: "",
        members: modalMembers,
        timeEntries,
        reassignments,
        overdue,
        reassignTo: modalMembers[0]?.id ? String(modalMembers[0].id) : "",
        commentAssigneeIds: [],
        editCommentAssigneeIds: [],
        timerRunning: false,
        timerStartedAt: null,
        timerAccumulatedSeconds: 0,
      }));
    } catch (error) {
      setTaskModal((prev) => ({ ...prev, loading: false }));
      setGlobalMessage(error.message);
    }
  }

  function closeTaskModal() {
    setTaskModal({
      open: false,
      loading: false,
      task: null,
      editMode: false,
      editForm: {
        task_name: "",
        description: "",
        estimated_time: "",
        due_date: "",
        priority: "medium",
        sprint_id: "none",
        assigned_to_ids: [],
      },
      comments: [],
      messages: [],
      activeTab: "details",
      chatText: "",
      members: [],
      timeEntries: [],
      reassignments: [],
      overdue: null,
      commentText: "",
      commentAssigneeIds: [],
      editCommentId: null,
      editCommentText: "",
      editCommentAssigneeIds: [],
      timeEntryForm: {
        time_logged: "1",
        date_logged: toDateInputValue(),
      },
      editingTimeEntryId: null,
      reassignTo: "",
      reassignReason: "",
      timerRunning: false,
      timerStartedAt: null,
      timerAccumulatedSeconds: 0,
    });
  }

  async function refreshTaskModal() {
    if (!taskModal.task?.id) return;
    await openTaskModal(taskModal.task);
  }

  async function addComment() {
    if (!taskModal.commentText.trim()) return;
    try {
      await api(`/tasks/${taskModal.task.id}/notes`, {
        method: "POST",
        body: {
          note_text: taskModal.commentText.trim(),
          assignee_ids: (taskModal.commentAssigneeIds || []).map((id) =>
            Number(id),
          ),
        },
      });
      setTaskModal((prev) => ({
        ...prev,
        commentText: "",
        commentAssigneeIds: [],
      }));
      await refreshTaskModal();
    } catch (error) {
      setGlobalMessage(error.message);
    }
  }

  async function sendTaskModalMessage() {
    const messageText = String(taskModal.chatText || "").trim();
    if (!taskModal.task?.id || !messageText) return;

    try {
      await api(`/tasks/${taskModal.task.id}/messages`, {
        method: "POST",
        body: { message_text: messageText },
      });

      const messageRes = await api(`/tasks/${taskModal.task.id}/messages`);
      setTaskModal((prev) => ({
        ...prev,
        chatText: "",
        messages: messageRes.data || [],
      }));
    } catch (error) {
      setGlobalMessage(error.message);
    }
  }

  async function saveEditedComment(commentId) {
    if (!taskModal.editCommentText.trim()) return;
    try {
      await api(`/tasks/${taskModal.task.id}/notes/${commentId}`, {
        method: "PUT",
        body: {
          note_text: taskModal.editCommentText.trim(),
          assignee_ids: (taskModal.editCommentAssigneeIds || []).map((id) =>
            Number(id),
          ),
        },
      });
      setTaskModal((prev) => ({
        ...prev,
        editCommentId: null,
        editCommentText: "",
        editCommentAssigneeIds: [],
      }));
      await refreshTaskModal();
    } catch (error) {
      setGlobalMessage(error.message);
    }
  }

  async function removeComment(commentId) {
    try {
      await api(`/tasks/${taskModal.task.id}/notes/${commentId}`, {
        method: "DELETE",
      });
      await refreshTaskModal();
    } catch (error) {
      setGlobalMessage(error.message);
    }
  }

  async function addTimeEntry() {
    try {
      await api("/time-entries", {
        method: "POST",
        body: {
          task_id: taskModal.task.id,
          time_logged: Number(taskModal.timeEntryForm.time_logged),
          date_logged: taskModal.timeEntryForm.date_logged,
        },
      });
      setTaskModal((prev) => ({
        ...prev,
        timeEntryForm: { time_logged: "1", date_logged: toDateInputValue() },
      }));
      await refreshTaskModal();
    } catch (error) {
      setGlobalMessage(error.message);
    }
  }

  function getRemainingHoursForTask() {
    const estimated = Number(taskModal.task?.estimated_time || 0);
    const total = Number(taskModal.overdue?.total_time_logged || 0);
    return Math.max(0, estimated - total);
  }

  function getLiveTimerSeconds() {
    if (!taskModal.timerRunning || !taskModal.timerStartedAt) {
      return taskModal.timerAccumulatedSeconds;
    }

    const runningSeconds = Math.floor(
      (timerNow - taskModal.timerStartedAt) / 1000,
    );
    return taskModal.timerAccumulatedSeconds + Math.max(0, runningSeconds);
  }

  function startTaskTimer() {
    if (user?.role !== "member") {
      setGlobalMessage("Clock timer is available for members only.");
      return;
    }

    const remainingSeconds = Math.floor(getRemainingHoursForTask() * 3600);
    if (remainingSeconds <= 0) {
      setGlobalMessage("No remaining time available for this task.");
      return;
    }

    setTaskModal((prev) => ({
      ...prev,
      timerRunning: true,
      timerStartedAt: Date.now(),
    }));
  }

  async function stopTaskTimerAndLog() {
    if (user?.role !== "member") {
      setGlobalMessage("Clock timer is available for members only.");
      return;
    }

    const remainingSeconds = Math.floor(getRemainingHoursForTask() * 3600);
    const elapsedSeconds = Math.min(getLiveTimerSeconds(), remainingSeconds);

    setTaskModal((prev) => ({
      ...prev,
      timerRunning: false,
      timerStartedAt: null,
      timerAccumulatedSeconds: 0,
    }));

    if (elapsedSeconds <= 0) {
      setGlobalMessage("Timer stopped. No time was logged.");
      return;
    }

    const loggedMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    const loggedHours = Number((loggedMinutes / 60).toFixed(4));

    try {
      await api("/time-entries", {
        method: "POST",
        body: {
          task_id: taskModal.task.id,
          time_logged: loggedHours,
          date_logged: toDateInputValue(),
        },
      });
      setGlobalMessage(`Logged ${loggedHours} hours from timer.`);
      await refreshTaskModal();
    } catch (error) {
      setGlobalMessage(error.message);
    }
  }

  async function updateTimeEntry(entryId) {
    try {
      await api(`/time-entries/${entryId}`, {
        method: "PUT",
        body: {
          time_logged: Number(taskModal.timeEntryForm.time_logged),
          date_logged: taskModal.timeEntryForm.date_logged,
        },
      });
      setTaskModal((prev) => ({
        ...prev,
        editingTimeEntryId: null,
        timeEntryForm: { time_logged: "1", date_logged: toDateInputValue() },
      }));
      await refreshTaskModal();
    } catch (error) {
      setGlobalMessage(error.message);
    }
  }

  async function deleteTimeEntry(entryId) {
    try {
      await api(`/time-entries/${entryId}`, { method: "DELETE" });
      await refreshTaskModal();
    } catch (error) {
      setGlobalMessage(error.message);
    }
  }

  async function reassignTaskFromModal() {
    if (!taskModal.reassignTo) return;
    try {
      await api(`/tasks/${taskModal.task.id}/reassign`, {
        method: "POST",
        body: {
          assign_to: Number(taskModal.reassignTo),
          reason: taskModal.reassignReason,
        },
      });
      setTaskModal((prev) => ({ ...prev, reassignReason: "" }));
      await Promise.all([
        refreshTaskModal(),
        loadBoardTasks(selectedProjectId, selectedSprintId),
      ]);
    } catch (error) {
      setGlobalMessage(error.message);
    }
  }

  async function updateTaskFromModal() {
    if (!taskModal.task?.id) return;

    try {
      await api(`/tasks/${taskModal.task.id}`, {
        method: "PUT",
        body: {
          task_name: taskModal.editForm.task_name,
          description: taskModal.editForm.description,
          estimated_time: Number(taskModal.editForm.estimated_time),
          sprint_id:
            taskModal.editForm.sprint_id &&
            taskModal.editForm.sprint_id !== "none"
              ? Number(taskModal.editForm.sprint_id)
              : null,
          assigned_to_ids:
            taskModal.editForm.assigned_to_ids?.length > 0
              ? taskModal.editForm.assigned_to_ids.map((id) => Number(id))
              : undefined,
          ...(taskModal.editForm.due_date
            ? { due_date: taskModal.editForm.due_date }
            : {}),
          priority: taskModal.editForm.priority,
        },
      });
      setGlobalMessage("Task updated.");
      await Promise.all([
        refreshTaskModal(),
        loadBoardTasks(selectedProjectId, selectedSprintId),
      ]);
    } catch (error) {
      setGlobalMessage(error.message);
    }
  }

  async function deleteTaskFromModal() {
    if (!taskModal.task?.id) return;
    const confirmed = window.confirm(
      "Delete this task? This will deactivate it.",
    );
    if (!confirmed) return;

    try {
      await api(`/tasks/${taskModal.task.id}`, { method: "DELETE" });
      setGlobalMessage("Task deleted.");
      closeTaskModal();
      await Promise.all([
        loadBoardTasks(selectedProjectId, selectedSprintId),
        loadProjects(),
      ]);
    } catch (error) {
      setGlobalMessage(error.message);
    }
  }

  async function saveProfile() {
    if (!user) return;
    try {
      const formData = new FormData();
      if (profileForm.name) formData.append("name", profileForm.name);
      if (profileForm.contact_number) {
        formData.append("contact_number", profileForm.contact_number);
      }
      if (profileForm.profile_picture) {
        formData.append("profile_picture", profileForm.profile_picture);
      }

      const response = await api(`/users/${user.id}`, {
        method: "PUT",
        body: formData,
      });
      setUser(response.data);
      localStorage.setItem("user", JSON.stringify(response.data));
      setGlobalMessage("Profile updated.");
      setProfileOpen(false);
    } catch (error) {
      setGlobalMessage(error.message);
    }
  }

  function toggleMemberSelection(memberId) {
    setProjectForm((prev) => {
      const id = Number(memberId);
      const has = prev.member_ids.includes(id);
      return {
        ...prev,
        member_ids: has
          ? prev.member_ids.filter((value) => value !== id)
          : [...prev.member_ids, id],
      };
    });
  }

  async function handleCreateSprint(event) {
    event.preventDefault();
    if (!selectedProjectId) {
      setGlobalMessage("Select a project first.");
      return;
    }

    try {
      await api(`/projects/${selectedProjectId}/sprints`, {
        method: "POST",
        body: {
          name: sprintForm.name,
          goal: sprintForm.goal,
          start_date: sprintForm.start_date || null,
          end_date: sprintForm.end_date || null,
        },
      });
      setSprintForm({ name: "", goal: "", start_date: "", end_date: "" });
      setGlobalMessage("Sprint created.");
      await loadSprints(selectedProjectId);
    } catch (error) {
      setGlobalMessage(error.message);
    }
  }

  function dragStart(event, taskId) {
    event.dataTransfer.setData("text/plain", String(taskId));
  }

  async function onDropStatus(event, status) {
    event.preventDefault();
    const taskId = Number(event.dataTransfer.getData("text/plain"));
    if (!taskId) return;

    const current = boardTasks.find((task) => task.id === taskId);
    if (!current || current.status === status) return;
    await handleStatusDrop(taskId, status);
  }

  function onDragOver(event) {
    event.preventDefault();
  }

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("baseUrl", baseUrl);
  }, [baseUrl]);

  useEffect(() => {
    verifySession();
  }, []);

  useEffect(() => {
    function handleUnauthorized() {
      clearSession();
      setGlobalMessage("Session expired. Please login again.");
    }

    window.addEventListener("app:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("app:unauthorized", handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    async function initFallbackWebPush() {
      if (!isLoggedIn || !sessionChecked) return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      if (!("Notification" in window)) return;

      const isLocalhost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      if (!window.isSecureContext && !isLocalhost) return;

      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map((registration) => {
            const scriptUrl = String(
              registration.active?.scriptURL ||
                registration.waiting?.scriptURL ||
                registration.installing?.scriptURL ||
                "",
            );

            if (
              scriptUrl.includes("OneSignalSDK") ||
              scriptUrl.includes("onesignal/")
            ) {
              return registration.unregister();
            }

            return Promise.resolve(false);
          }),
        );

        const permission =
          Notification.permission === "granted"
            ? "granted"
            : await Notification.requestPermission();

        if (permission !== "granted") return;

        const registration =
          await navigator.serviceWorker.register("/push-sw.js");
        const keyResponse = await api("/notifications/web-push-public-key");
        const publicKey = String(keyResponse?.data?.publicKey || "").trim();
        if (!publicKey) return;

        const lastKey = localStorage.getItem("webPushVapidPublicKey") || "";
        let subscription = await registration.pushManager.getSubscription();

        if (subscription && lastKey && lastKey !== publicKey) {
          await subscription.unsubscribe();
          subscription = null;
        }

        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }

        await api("/notifications/subscribe", {
          method: "POST",
          body: { subscription },
        });

        localStorage.setItem("webPushVapidPublicKey", publicKey);
      } catch (_error) {
        // Fallback registration failures should never block app flow.
      }
    }

    initFallbackWebPush();
  }, [isLoggedIn, sessionChecked]);

  useEffect(() => {
    if (!isLoggedIn || !sessionChecked) return;
    bootstrapDashboard();
  }, [isLoggedIn, sessionChecked]);

  useEffect(() => {
    if (!isLoggedIn) return;

    if (!selectedProjectId) {
      setSelectedSprintId("none");
      setProjectMembers([]);
      setSprints([]);
      loadBoardTasks("", "none");
      if (isLead) {
        loadLeadAnalytics("");
      }
      return;
    }

    setSelectedSprintId("none");
    loadProjectMembers(selectedProjectId);
    loadSprints(selectedProjectId);
    loadBoardTasks(selectedProjectId, "none");
    if (isLead) {
      loadLeadAnalytics(selectedProjectId);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (!isLoggedIn || !selectedProjectId || !isLead) return;
    loadBoardTasks(selectedProjectId, selectedSprintId);
  }, [selectedSprintId]);

  const toastTone = useMemo(() => {
    const message = String(globalMessage || "").toLowerCase();
    if (
      message.includes("failed") ||
      message.includes("error") ||
      message.includes("invalid") ||
      message.includes("forbidden") ||
      message.includes("cannot") ||
      message.includes("not ")
    ) {
      return "error";
    }
    if (
      message.includes("created") ||
      message.includes("updated") ||
      message.includes("completed") ||
      message.includes("reactivated") ||
      message.includes("success")
    ) {
      return "success";
    }
    return "info";
  }, [globalMessage]);

  useEffect(() => {
    if (!globalMessage) return;
    const timer = setTimeout(() => setGlobalMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [globalMessage]);

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      name: user.name || "",
      contact_number: user.contact_number || "",
      profile_picture: null,
    });
  }, [user]);

  useEffect(() => {
    if (!taskModal.timerRunning) return;

    const intervalId = setInterval(() => {
      setTimerNow(Date.now());
    }, 1000);

    return () => clearInterval(intervalId);
  }, [taskModal.timerRunning]);

  if (!isLoggedIn) {
    return (
      <Login
        authMode={authMode}
        setAuthMode={setAuthMode}
        loginForm={loginForm}
        setLoginForm={setLoginForm}
        signupForm={signupForm}
        setSignupForm={setSignupForm}
        handleLogin={handleLogin}
        handleSignup={handleSignup}
        authLoading={authLoading}
        authError={authError}
        theme={theme}
        setTheme={setTheme}
      />
    );
  }

  const contextProps = {
    isLead,
    theme,
    setTheme,
    setProfileOpen,
    clearSession,
    globalMessage,
    setGlobalMessage,
    overview,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    selectedSprintId,
    setSelectedSprintId,
    sprints,
    projectMembers,
    boardTasks,
    allMembers,
    teamPerformance,
    memberWorkload,
    projectForm,
    setProjectForm,
    handleCreateProject,
    handleUpdateProjectMembers,
    taskForm,
    setTaskForm,
    handleCreateTask,
    sprintForm,
    setSprintForm,
    handleCreateSprint,
    handleStatusDrop,
    openTaskModal,
    employeeForm,
    setEmployeeForm,
    handleCreateEmployee,
    allUsers,
    handleDeactivateUser,
    handleToggleUserActive,
    handleUpdateUser,
    loadUsers,
    groupedTasks,
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout user={user} {...contextProps} />}>
          <Route index element={<Dashboard />} />
          <Route path="tasks" element={<Tasks />} />
          {isLead && (
            <>
              <Route path="projects" element={<Projects />} />
              <Route path="teams" element={<Teams />} />
            </>
          )}
          <Route path="task/:id" element={<TaskDetail />} />
          <Route path="time-logs" element={<MyTimeLogs />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>

      {/* Profile Modal */}
      {profileOpen && (
        <div className="modal-shell" onClick={() => setProfileOpen(false)}>
          <div
            className="modal profile-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="profile-modal-header">
              <div>
                <h3>Profile Settings</h3>
                <p className="muted">
                  Update your personal details and avatar.
                </p>
              </div>
              {user?.profile_picture ? (
                <img
                  src={
                    user.profile_picture.startsWith("http")
                      ? user.profile_picture
                      : `${baseUrl.replace(/\/api\/?$/, "")}${user.profile_picture}`
                  }
                  alt={user.name}
                  className="profile-preview"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="profile-preview profile-initial">
                  {String(user?.name || "U")
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}
            </div>

            <div className="profile-grid">
              <label>
                Name
                <input
                  value={profileForm.name}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, name: e.target.value }))
                  }
                />
              </label>
              <label>
                Contact Number
                <input
                  value={profileForm.contact_number}
                  onChange={(e) =>
                    setProfileForm((p) => ({
                      ...p,
                      contact_number: e.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <label>
              Profile Picture
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setProfileForm((p) => ({
                    ...p,
                    profile_picture: e.target.files?.[0] || null,
                  }))
                }
              />
            </label>

            <div className="row profile-actions">
              <button type="button" onClick={saveProfile}>
                Save Changes
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => setProfileOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {dependenceAssignModal.open && (
        <div
          className="modal-shell"
          onClick={() =>
            setDependenceAssignModal({
              open: false,
              taskId: null,
              taskName: "",
              members: [],
              selectedMemberId: "",
              submitting: false,
            })
          }
        >
          <div
            className="modal"
            style={{ maxWidth: 520 }}
            onClick={(event) => event.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Reassign Task</h3>
            <p className="muted" style={{ marginBottom: 12 }}>
              Choose a member for: {dependenceAssignModal.taskName}
            </p>

            <label>
              Project Members
              <select
                value={dependenceAssignModal.selectedMemberId}
                onChange={(event) =>
                  setDependenceAssignModal((prev) => ({
                    ...prev,
                    selectedMemberId: event.target.value,
                  }))
                }
              >
                {dependenceAssignModal.members.map((member) => (
                  <option key={member.id} value={String(member.id)}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>

            <div
              className="row"
              style={{ justifyContent: "flex-end", marginTop: 16 }}
            >
              <button
                type="button"
                className="ghost"
                onClick={() =>
                  setDependenceAssignModal({
                    open: false,
                    taskId: null,
                    taskName: "",
                    members: [],
                    selectedMemberId: "",
                    submitting: false,
                  })
                }
                disabled={dependenceAssignModal.submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitDependenceReassign}
                disabled={dependenceAssignModal.submitting}
              >
                Reassign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Modal (Simplified for refactor) */}
      {taskModal.open && (
        <div className="modal-shell" onClick={closeTaskModal}>
          <div
            className="modal task-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {taskModal.loading ? (
              <div className="loading">Loading task...</div>
            ) : (
              <>
                <h3>{taskModal.task?.task_name}</h3>
                <p>{taskModal.task?.description || "No description"}</p>
                <div className="row wrap">
                  <span className="pill">Status: {taskModal.task?.status}</span>
                  <span className="pill">
                    Priority: {taskModal.task?.priority}
                  </span>
                  <span className="pill">
                    Due:{" "}
                    {taskModal.task?.due_date
                      ? toDateInputValue(taskModal.task.due_date)
                      : "Not set"}
                  </span>
                  <span className="pill">
                    Assignees:{" "}
                    {Array.isArray(taskModal.task?.assignees) &&
                    taskModal.task.assignees.length > 0
                      ? taskModal.task.assignees
                          .map((assignee) => assignee.name)
                          .join(", ")
                      : taskModal.task?.assigned_user_name ||
                        taskModal.task?.assigned_to}
                  </span>
                  {isLead &&
                    Array.isArray(taskModal.task?.assignees) &&
                    taskModal.task.assignees.length > 0 && (
                      <span className="pill">
                        Assignee Statuses:{" "}
                        {taskModal.task.assignees
                          .map(
                            (assignee) =>
                              `${assignee.name}: ${assignee.assignee_status || "active"}`,
                          )
                          .join(" | ")}
                      </span>
                    )}
                </div>

                {isLead && (
                  <div className="section" style={{ marginTop: 16 }}>
                    <div
                      className="row wrap"
                      style={{
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <h4 style={{ margin: 0 }}>Edit Task</h4>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() =>
                          setTaskModal((prev) => ({
                            ...prev,
                            editMode: !prev.editMode,
                          }))
                        }
                      >
                        {taskModal.editMode ? "Cancel Edit" : "Edit Details"}
                      </button>
                    </div>

                    {taskModal.editMode && (
                      <div
                        className="stack task-edit-form"
                        style={{ marginTop: 12 }}
                      >
                        <input
                          value={taskModal.editForm.task_name}
                          onChange={(e) =>
                            setTaskModal((prev) => ({
                              ...prev,
                              editForm: {
                                ...prev.editForm,
                                task_name: e.target.value,
                              },
                            }))
                          }
                          placeholder="Task title"
                        />
                        <textarea
                          rows="3"
                          value={taskModal.editForm.description}
                          onChange={(e) =>
                            setTaskModal((prev) => ({
                              ...prev,
                              editForm: {
                                ...prev.editForm,
                                description: e.target.value,
                              },
                            }))
                          }
                          placeholder="Task description"
                        />
                        <div className="row wrap">
                          <label style={{ flex: 1, minWidth: 220 }}>
                            Assigned Members
                            <AssigneeTypeahead
                              members={taskModal.members || []}
                              selectedIds={
                                taskModal.editForm.assigned_to_ids || []
                              }
                              onChange={(values) =>
                                setTaskModal((prev) => ({
                                  ...prev,
                                  editForm: {
                                    ...prev.editForm,
                                    assigned_to_ids: values,
                                  },
                                }))
                              }
                              placeholder="Type member name and select..."
                            />
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={taskModal.editForm.estimated_time}
                            onChange={(e) =>
                              setTaskModal((prev) => ({
                                ...prev,
                                editForm: {
                                  ...prev.editForm,
                                  estimated_time: e.target.value,
                                },
                              }))
                            }
                            placeholder="Estimated hours"
                          />
                          <input
                            type="date"
                            value={taskModal.editForm.due_date || ""}
                            onChange={(e) =>
                              setTaskModal((prev) => ({
                                ...prev,
                                editForm: {
                                  ...prev.editForm,
                                  due_date: e.target.value,
                                },
                              }))
                            }
                          />
                          <select
                            value={taskModal.editForm.priority}
                            onChange={(e) =>
                              setTaskModal((prev) => ({
                                ...prev,
                                editForm: {
                                  ...prev.editForm,
                                  priority: e.target.value,
                                },
                              }))
                            }
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                          <select
                            value={taskModal.editForm.sprint_id || "none"}
                            onChange={(e) =>
                              setTaskModal((prev) => ({
                                ...prev,
                                editForm: {
                                  ...prev.editForm,
                                  sprint_id: e.target.value,
                                },
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
                        </div>
                        <div className="row wrap">
                          <button type="button" onClick={updateTaskFromModal}>
                            Save Task
                          </button>
                          <button
                            type="button"
                            className="ghost danger"
                            onClick={deleteTaskFromModal}
                          >
                            Delete Task
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {taskModal.task && (
                  <div className="section">
                    <h4>Time Logging</h4>
                    <p className="muted" style={{ marginBottom: 10 }}>
                      Logged{" "}
                      {formatHoursToHuman(
                        taskModal.overdue?.total_time_logged || 0,
                      )}{" "}
                      / Estimated{" "}
                      {formatHoursToHuman(taskModal.task.estimated_time || 0)}
                    </p>
                    <p className="muted" style={{ marginBottom: 14 }}>
                      Remaining:{" "}
                      {formatHoursToHuman(getRemainingHoursForTask())}
                    </p>

                    {user?.role === "member" &&
                    Number(taskModal.task?.assigned_to) !== Number(user?.id) ? (
                      <p className="muted">
                        Only the assigned member can log time for this task.
                      </p>
                    ) : (
                      <>
                        <div className="time-log-grid">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            max={Math.max(
                              0.01,
                              getRemainingHoursForTask(),
                            ).toFixed(2)}
                            value={taskModal.timeEntryForm.time_logged}
                            onChange={(e) =>
                              setTaskModal((prev) => ({
                                ...prev,
                                timeEntryForm: {
                                  ...prev.timeEntryForm,
                                  time_logged: e.target.value,
                                },
                              }))
                            }
                            placeholder="Hours"
                          />
                          <input
                            type="date"
                            value={taskModal.timeEntryForm.date_logged}
                            onChange={(e) =>
                              setTaskModal((prev) => ({
                                ...prev,
                                timeEntryForm: {
                                  ...prev.timeEntryForm,
                                  date_logged: e.target.value,
                                },
                              }))
                            }
                          />
                          <button type="button" onClick={addTimeEntry}>
                            Log Time Manually
                          </button>
                        </div>

                        {user?.role === "member" && (
                          <div
                            className="row wrap"
                            style={{ marginTop: 10, alignItems: "center" }}
                          >
                            <span className="pill">
                              Timer:{" "}
                              {Math.floor(getLiveTimerSeconds() / 3600)
                                .toString()
                                .padStart(2, "0")}
                              :
                              {Math.floor((getLiveTimerSeconds() % 3600) / 60)
                                .toString()
                                .padStart(2, "0")}
                              :
                              {(getLiveTimerSeconds() % 60)
                                .toString()
                                .padStart(2, "0")}
                            </span>
                            {!taskModal.timerRunning ? (
                              <button type="button" onClick={startTaskTimer}>
                                Start Clock
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="ghost"
                                onClick={stopTaskTimerAndLog}
                              >
                                Stop And Log
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    <div style={{ marginTop: 14 }}>
                      <h5 style={{ margin: "0 0 8px 0" }}>Recent Logs</h5>
                      {taskModal.timeEntries?.length ? (
                        <div className="time-entry-list">
                          {taskModal.timeEntries.slice(0, 6).map((entry) => (
                            <div key={entry.id} className="time-entry-item">
                              <span>{entry.logged_by_name || "User"}</span>
                              <span>
                                {formatHoursToHuman(entry.time_logged)}
                              </span>
                              <span>{toDateInputValue(entry.date_logged)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="muted">No time entries yet.</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="section">
                  <h4>Reassign Task</h4>
                  <div className="row wrap">
                    <select
                      value={taskModal.reassignTo || ""}
                      onChange={(e) =>
                        setTaskModal((prev) => ({
                          ...prev,
                          reassignTo: e.target.value,
                        }))
                      }
                      style={{ flex: 1 }}
                    >
                      <option value="">Select Member</option>
                      {(taskModal.members || []).map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={reassignTaskFromModal}>
                      Reassign
                    </button>
                  </div>
                </div>

                <div className="section">
                  <div className="discussion-tabs" style={{ marginBottom: 12 }}>
                    <button
                      type="button"
                      className={
                        taskModal.activeTab === "details"
                          ? "discussion-tab is-active"
                          : "discussion-tab"
                      }
                      onClick={() =>
                        setTaskModal((prev) => ({
                          ...prev,
                          activeTab: "details",
                        }))
                      }
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      className={
                        taskModal.activeTab === "notes"
                          ? "discussion-tab is-active"
                          : "discussion-tab"
                      }
                      onClick={() =>
                        setTaskModal((prev) => ({
                          ...prev,
                          activeTab: "notes",
                        }))
                      }
                    >
                      Notes
                    </button>
                    <button
                      type="button"
                      className={
                        taskModal.activeTab === "chat"
                          ? "discussion-tab is-active"
                          : "discussion-tab"
                      }
                      onClick={() =>
                        setTaskModal((prev) => ({ ...prev, activeTab: "chat" }))
                      }
                    >
                      Chat
                    </button>
                  </div>

                  {taskModal.activeTab === "notes" && (
                    <>
                      {isLead ? (
                        <div className="stack" style={{ gap: 10 }}>
                          <div
                            className="row wrap"
                            style={{ alignItems: "flex-end" }}
                          >
                            <label style={{ flex: 2 }}>
                              Note
                              <input
                                value={taskModal.commentText}
                                onChange={(e) =>
                                  setTaskModal((prev) => ({
                                    ...prev,
                                    commentText: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addComment();
                                  }
                                }}
                                placeholder="Type note and press Enter"
                              />
                            </label>
                            <label style={{ flex: 1 }}>
                              Assigned To
                              <select
                                multiple
                                value={taskModal.commentAssigneeIds || []}
                                onChange={(e) =>
                                  setTaskModal((prev) => ({
                                    ...prev,
                                    commentAssigneeIds: Array.from(
                                      e.target.selectedOptions,
                                    ).map((opt) => String(opt.value)),
                                  }))
                                }
                              >
                                {(taskModal.members || []).map((member) => (
                                  <option
                                    key={member.id}
                                    value={String(member.id)}
                                  >
                                    {member.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button type="button" onClick={addComment}>
                              Send
                            </button>
                          </div>

                          {(taskModal.comments || []).length ? (
                            taskModal.comments.map((note) => {
                              const isEditing =
                                Number(taskModal.editCommentId) ===
                                Number(note.id);
                              const assigneeNames = (note.assignees || [])
                                .map((assignee) => assignee.name)
                                .join(", ");

                              return (
                                <div
                                  key={note.id}
                                  className="panel"
                                  style={{ padding: 10 }}
                                >
                                  {isEditing ? (
                                    <div
                                      className="row wrap"
                                      style={{ gap: 8 }}
                                    >
                                      <input
                                        value={taskModal.editCommentText}
                                        onChange={(e) =>
                                          setTaskModal((prev) => ({
                                            ...prev,
                                            editCommentText: e.target.value,
                                          }))
                                        }
                                        style={{ flex: 2 }}
                                      />
                                      <select
                                        multiple
                                        value={
                                          taskModal.editCommentAssigneeIds || []
                                        }
                                        onChange={(e) =>
                                          setTaskModal((prev) => ({
                                            ...prev,
                                            editCommentAssigneeIds: Array.from(
                                              e.target.selectedOptions,
                                            ).map((opt) => String(opt.value)),
                                          }))
                                        }
                                        style={{ flex: 1 }}
                                      >
                                        {(taskModal.members || []).map(
                                          (member) => (
                                            <option
                                              key={member.id}
                                              value={String(member.id)}
                                            >
                                              {member.name}
                                            </option>
                                          ),
                                        )}
                                      </select>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          saveEditedComment(note.id)
                                        }
                                      >
                                        Save
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <p style={{ margin: 0 }}>
                                        {note.note_text}
                                      </p>
                                      <small className="muted">
                                        Assigned: {assigneeNames || "-"}
                                      </small>
                                      <div
                                        className="row wrap"
                                        style={{ marginTop: 8 }}
                                      >
                                        <button
                                          type="button"
                                          className="ghost"
                                          onClick={() =>
                                            setTaskModal((prev) => ({
                                              ...prev,
                                              editCommentId: note.id,
                                              editCommentText:
                                                note.note_text || "",
                                              editCommentAssigneeIds: (
                                                note.assignees || []
                                              ).map((assignee) =>
                                                String(assignee.id),
                                              ),
                                            }))
                                          }
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          className="ghost"
                                          onClick={() => removeComment(note.id)}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <p className="muted">No notes yet.</p>
                          )}
                        </div>
                      ) : (
                        <div className="stack" style={{ gap: 8 }}>
                          <h4 style={{ margin: 0 }}>Notes for You</h4>
                          {(taskModal.comments || []).length ? (
                            taskModal.comments.map((note) => (
                              <div
                                key={note.id}
                                className="panel"
                                style={{ padding: 10 }}
                              >
                                <strong>{note.created_by_name}</strong>
                                <p style={{ marginBottom: 0 }}>
                                  {note.note_text}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="muted">No notes assigned to you.</p>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {taskModal.activeTab === "chat" && (
                    <>
                      <div className="task-chat-thread task-chat-thread--modal">
                        {taskModal.messages?.length ? (
                          taskModal.messages.map((message) => {
                            const isOwnMessage =
                              Number(message.sender_id) === Number(user?.id);
                            const senderRole =
                              message.sender_role === "team_lead"
                                ? "role-lead"
                                : message.sender_role === "admin"
                                  ? "role-lead"
                                  : "role-member";

                            return (
                              <div
                                key={message.id}
                                className={
                                  isOwnMessage
                                    ? "task-chat-row is-own"
                                    : "task-chat-row is-other"
                                }
                              >
                                <div
                                  className={`task-chat-bubble ${isOwnMessage ? "is-own" : "is-other"} ${senderRole === "role-lead" ? "is-lead" : "is-member"}`}
                                >
                                  <div className="task-chat-meta">
                                    <strong>{message.sender_name}</strong>
                                    <span
                                      className={`chat-role-badge ${senderRole}`}
                                    >
                                      {senderRole === "role-lead"
                                        ? "Lead"
                                        : "Member"}
                                    </span>
                                  </div>
                                  <p>{message.message_text}</p>
                                  <small>
                                    {new Intl.DateTimeFormat("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      hour: "numeric",
                                      minute: "2-digit",
                                    }).format(new Date(message.created_at))}
                                  </small>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="muted">No chat messages yet.</p>
                        )}
                      </div>

                      <div className="task-chat-composer task-chat-composer--modal">
                        <input
                          value={taskModal.chatText}
                          onChange={(e) =>
                            setTaskModal((prev) => ({
                              ...prev,
                              chatText: e.target.value,
                            }))
                          }
                          placeholder="Type your message..."
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              sendTaskModalMessage();
                            }
                          }}
                        />
                        <button type="button" onClick={sendTaskModalMessage}>
                          Send
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  className="ghost"
                  onClick={closeTaskModal}
                >
                  Close Task
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {globalMessage && (
        <div className={`toast-notice toast-notice--${toastTone}`}>
          <span className="toast-notice__marker" />
          <span className="toast-notice__text">{globalMessage}</span>
        </div>
      )}
    </BrowserRouter>
  );
}

export default App;
