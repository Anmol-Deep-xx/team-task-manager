const DEFAULT_API_BASE = "http://localhost:5001/api";

const STORAGE_KEYS = {
  token: "ts_ext_token",
  user: "ts_ext_user",
  baseUrl: "ts_ext_base_url",
  activeTimer: "ts_ext_active_timer",
};

const els = {
  statusBox: document.getElementById("statusBox"),
  loginView: document.getElementById("loginView"),
  mainView: document.getElementById("mainView"),
  logoutBtn: document.getElementById("logoutBtn"),
  baseUrlInput: document.getElementById("baseUrlInput"),
  emailInput: document.getElementById("emailInput"),
  passwordInput: document.getElementById("passwordInput"),
  loginBtn: document.getElementById("loginBtn"),
  projectSelect: document.getElementById("projectSelect"),
  refreshBtn: document.getElementById("refreshBtn"),
  taskList: document.getElementById("taskList"),
  emptyTasks: document.getElementById("emptyTasks"),
  activeTaskName: document.getElementById("activeTaskName"),
  elapsedLabel: document.getElementById("elapsedLabel"),
  stopTimerBtn: document.getElementById("stopTimerBtn"),
};

let state = {
  token: "",
  user: null,
  baseUrl: DEFAULT_API_BASE,
  projects: [],
  selectedProjectId: null,
  tasksForToday: [],
  activeTimer: null,
  tickHandle: null,
};

function setStatus(message, isError = false) {
  els.statusBox.textContent = message;
  els.statusBox.style.color = isError ? "#c64040" : "#6a7381";
}

function normalizeBaseUrl(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return DEFAULT_API_BASE;
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function toDateString(input) {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

function nowDateString() {
  return new Date().toISOString().split("T")[0];
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function getHoursFromMs(ms) {
  const raw = ms / (1000 * 60 * 60);
  const rounded = Math.round(raw * 10000) / 10000;
  return Math.max(0.0001, rounded);
}

function safeJsonParse(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_e) {
    return fallback;
  }
}

async function getStorage(keys) {
  return chrome.storage.local.get(keys);
}

async function setStorage(payload) {
  return chrome.storage.local.set(payload);
}

async function removeStorage(keys) {
  return chrome.storage.local.remove(keys);
}

async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(`${state.baseUrl}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || `Request failed (${response.status})`);
  }
  return payload;
}

async function restoreSession() {
  const storage = await getStorage([
    STORAGE_KEYS.token,
    STORAGE_KEYS.user,
    STORAGE_KEYS.baseUrl,
    STORAGE_KEYS.activeTimer,
  ]);

  state.baseUrl = normalizeBaseUrl(storage[STORAGE_KEYS.baseUrl] || DEFAULT_API_BASE);
  state.token = storage[STORAGE_KEYS.token] || "";
  state.user = safeJsonParse(storage[STORAGE_KEYS.user]);
  state.activeTimer = safeJsonParse(storage[STORAGE_KEYS.activeTimer]);

  els.baseUrlInput.value = state.baseUrl;
}

function renderView() {
  const loggedIn = Boolean(state.token);
  els.loginView.classList.toggle("hidden", loggedIn);
  els.mainView.classList.toggle("hidden", !loggedIn);
  els.logoutBtn.classList.toggle("hidden", !loggedIn);
}

async function login() {
  const baseUrl = normalizeBaseUrl(els.baseUrlInput.value);
  const email = els.emailInput.value.trim();
  const password = els.passwordInput.value;

  if (!email || !password) {
    setStatus("Email and password are required", true);
    return;
  }

  setStatus("Logging in...");
  state.baseUrl = baseUrl;

  try {
    const data = await fetch(`${state.baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).then(async (res) => {
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.message || "Login failed");
      }
      return payload;
    });

    const token = data?.data?.token;
    const user = data?.data?.user;
    if (!token || !user) {
      throw new Error("Unexpected login response");
    }

    state.token = token;
    state.user = user;

    await setStorage({
      [STORAGE_KEYS.baseUrl]: state.baseUrl,
      [STORAGE_KEYS.token]: token,
      [STORAGE_KEYS.user]: JSON.stringify(user),
    });

    renderView();
    setStatus(`Welcome ${user.name}`);
    await loadProjects();
  } catch (error) {
    setStatus(error.message || "Login failed", true);
  }
}

async function logout() {
  state.token = "";
  state.user = null;
  state.projects = [];
  state.tasksForToday = [];
  state.selectedProjectId = null;
  state.activeTimer = null;

  stopTicking();

  await removeStorage([
    STORAGE_KEYS.token,
    STORAGE_KEYS.user,
    STORAGE_KEYS.activeTimer,
  ]);

  renderView();
  renderProjects();
  renderTasks();
  renderTimer();
  setStatus("Logged out");
}

function stopTicking() {
  if (state.tickHandle) {
    clearInterval(state.tickHandle);
    state.tickHandle = null;
  }
}

function startTicking() {
  stopTicking();
  state.tickHandle = setInterval(() => {
    renderTimer();
  }, 1000);
}

function renderTimer() {
  const timer = state.activeTimer;
  if (!timer) {
    els.activeTaskName.textContent = "No active timer";
    els.elapsedLabel.textContent = "00:00:00";
    els.stopTimerBtn.disabled = true;
    return;
  }

  const elapsedMs = Date.now() - Number(timer.startTime);
  els.activeTaskName.textContent = timer.taskName;
  els.elapsedLabel.textContent = formatDuration(elapsedMs);
  els.stopTimerBtn.disabled = false;
}

async function loadProjects() {
  if (!state.token) return;

  try {
    setStatus("Loading projects...");
    const payload = await apiRequest("/projects?page=1&pageSize=100");
    state.projects = payload?.data?.items || [];

    if (state.projects.length === 0) {
      state.selectedProjectId = null;
      renderProjects();
      renderTasks();
      setStatus("No projects available");
      return;
    }

    if (!state.selectedProjectId) {
      state.selectedProjectId = state.projects[0].id;
    }

    renderProjects();
    await loadTasksForSelectedProject();
  } catch (error) {
    setStatus(error.message || "Could not load projects", true);
  }
}

function renderProjects() {
  els.projectSelect.innerHTML = "";

  if (!state.projects.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No projects";
    els.projectSelect.appendChild(option);
    return;
  }

  state.projects.forEach((project) => {
    const option = document.createElement("option");
    option.value = String(project.id);
    option.textContent = project.name;
    if (Number(project.id) === Number(state.selectedProjectId)) {
      option.selected = true;
    }
    els.projectSelect.appendChild(option);
  });
}

function isTaskAssignedToCurrentUser(task) {
  if (!state.user) return false;

  if (Number(task.assigned_to) === Number(state.user.id)) {
    return true;
  }

  if (Array.isArray(task.assignees)) {
    return task.assignees.some((assignee) => Number(assignee.id) === Number(state.user.id));
  }

  return false;
}

function isDueToday(task) {
  return toDateString(task.due_date) === nowDateString();
}

async function loadTasksForSelectedProject() {
  if (!state.selectedProjectId) {
    state.tasksForToday = [];
    renderTasks();
    return;
  }

  setStatus("Loading tasks...");

  try {
    const payload = await apiRequest(
      `/projects/${state.selectedProjectId}/tasks?page=1&pageSize=100&sortBy=due_date&sortOrder=asc`,
    );
    const tasks = payload?.data?.items || [];

    state.tasksForToday = tasks
      .filter((task) => isTaskAssignedToCurrentUser(task))
      .filter((task) => isDueToday(task));

    renderTasks();
    setStatus(`Loaded ${state.tasksForToday.length} task(s) for today`);
  } catch (error) {
    setStatus(error.message || "Could not load tasks", true);
  }
}

function canStartTimer(taskId) {
  if (!state.activeTimer) return true;
  return Number(state.activeTimer.taskId) === Number(taskId);
}

async function startTaskTimer(task) {
  if (!canStartTimer(task.id)) {
    setStatus("Stop current timer before starting another task", true);
    return;
  }

  if (!state.activeTimer) {
    state.activeTimer = {
      taskId: task.id,
      taskName: task.task_name,
      projectId: task.project_id,
      startTime: Date.now(),
    };
    await setStorage({
      [STORAGE_KEYS.activeTimer]: JSON.stringify(state.activeTimer),
    });
  }

  renderTasks();
  renderTimer();
  startTicking();
  setStatus(`Timer started for ${task.task_name}`);
}

async function stopTaskTimer() {
  if (!state.activeTimer) {
    return;
  }

  const timer = state.activeTimer;
  const elapsedMs = Date.now() - Number(timer.startTime);
  const hours = getHoursFromMs(elapsedMs);

  if (hours > 24) {
    setStatus("Timer exceeded 24h. Please log manually in app.", true);
    return;
  }

  try {
    setStatus("Saving time entry...");
    await apiRequest("/time-entries", {
      method: "POST",
      body: {
        task_id: timer.taskId,
        time_logged: hours,
        date_logged: new Date().toISOString(),
      },
    });

    state.activeTimer = null;
    await removeStorage([STORAGE_KEYS.activeTimer]);

    stopTicking();
    renderTasks();
    renderTimer();
    setStatus(`Logged ${hours.toFixed(4)}h for ${timer.taskName}`);
  } catch (error) {
    setStatus(error.message || "Failed to save time entry", true);
  }
}

function renderTasks() {
  els.taskList.innerHTML = "";

  if (!state.tasksForToday.length) {
    els.emptyTasks.classList.remove("hidden");
    return;
  }

  els.emptyTasks.classList.add("hidden");

  state.tasksForToday.forEach((task) => {
    const item = document.createElement("li");
    item.className = "task-item";

    const name = document.createElement("p");
    name.className = "task-name";
    name.textContent = task.task_name;

    const meta = document.createElement("p");
    meta.className = "task-meta";
    meta.textContent = `Due: ${toDateString(task.due_date)} | Status: ${task.status}`;

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const button = document.createElement("button");
    button.className = "primary";
    button.type = "button";

    const isThisActive =
      state.activeTimer && Number(state.activeTimer.taskId) === Number(task.id);
    button.textContent = isThisActive ? "Timer running" : "Start timer";
    button.disabled = Boolean(state.activeTimer && !isThisActive);
    button.addEventListener("click", () => startTaskTimer(task));

    actions.appendChild(button);
    item.appendChild(name);
    item.appendChild(meta);
    item.appendChild(actions);

    els.taskList.appendChild(item);
  });
}

function bindEvents() {
  els.loginBtn.addEventListener("click", login);
  els.logoutBtn.addEventListener("click", logout);
  els.refreshBtn.addEventListener("click", async () => {
    await loadProjects();
  });
  els.projectSelect.addEventListener("change", async () => {
    state.selectedProjectId = Number(els.projectSelect.value);
    await loadTasksForSelectedProject();
  });
  els.stopTimerBtn.addEventListener("click", stopTaskTimer);
}

async function bootstrap() {
  bindEvents();
  await restoreSession();
  renderView();
  renderTimer();

  if (state.activeTimer) {
    startTicking();
  }

  if (state.token) {
    setStatus("Restored session");
    await loadProjects();
    return;
  }

  setStatus("Please login");
}

bootstrap();