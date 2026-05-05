const DEFAULT_BASE_URL = 
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";

const AUTH_STORAGE_KEYS = ["token", "authToken", "accessToken", "user"];

function clearStoredSession() {
  AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}

function handleUnauthorizedResponse() {
  clearStoredSession();

  try {
    window.dispatchEvent(new CustomEvent("app:unauthorized"));
  } catch (_error) {
    // Ignore custom event issues and continue redirect.
  }

  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

function resolveAuthToken(token) {
  const candidate =
    token ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    "";
  const normalized = String(candidate).replace(/^"|"$/g, "");
  const trimmed = normalized.trim();

  if (!trimmed) return "";
  return trimmed.startsWith("Bearer ") ? trimmed.slice(7) : trimmed;
}

function parseError(payload, fallbackMessage = "Request failed") {
  if (!payload) return fallbackMessage;

  if (Array.isArray(payload.details) && payload.details.length > 0) {
    return `${payload.message}: ${payload.details[0].message}`;
  }
  if (Array.isArray(payload.errors) && payload.errors[0]?.message) {
    return `${payload.message}: ${payload.errors[0].message}`;
  }

  if (payload.message) return payload.message;
  return fallbackMessage;
}

async function request(path, options = {}) {
  const {
    baseUrl = DEFAULT_BASE_URL,
    token,
    method = "GET",
    body,
    headers = {},
    skipAuthRedirect = false,
  } = options;

  const mergedHeaders = { ...headers };
  const authToken = resolveAuthToken(token);

  if (!(body instanceof FormData)) {
    mergedHeaders["Content-Type"] =
      mergedHeaders["Content-Type"] || "application/json";
  }
  if (authToken) {
    mergedHeaders.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: mergedHeaders,
    body:
      body === undefined || body instanceof FormData || typeof body === "string"
        ? body
        : JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && !skipAuthRedirect) {
      handleUnauthorizedResponse();
    }
    throw new Error(parseError(payload, `Request failed (${response.status})`));
  }

  return payload;
}

const getServerUrl = () => {
  const base = localStorage.getItem("baseUrl") || DEFAULT_BASE_URL;
  return base.replace(/\/api\/?$/, "");
};

export { DEFAULT_BASE_URL, request, parseError, getServerUrl };
