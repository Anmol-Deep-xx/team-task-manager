import { Bell, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { request, DEFAULT_BASE_URL } from "../api";

function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const baseUrl = useMemo(
    () => localStorage.getItem("baseUrl") || DEFAULT_BASE_URL,
    [],
  );
  const token = useMemo(
    () =>
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("accessToken") ||
      "",
    [],
  );

  async function loadNotifications() {
    if (!token) return;

    try {
      const response = await request("/notifications?limit=20&page=1", {
        baseUrl,
        token,
      });

      const items = response.data?.items || [];
      setNotifications(items);
      setUnreadCount(Number(response.data?.unread_count || 0));
    } catch (_error) {
      // Quiet failure to avoid interrupting user workflows.
    }
  }

  async function markOneRead(id) {
    try {
      await request(`/notifications/${id}/read`, {
        baseUrl,
        token,
        method: "PATCH",
      });

      setNotifications((prev) =>
        prev.map((item) =>
          Number(item.id) === Number(id) ? { ...item, is_read: true } : item,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (_error) {
      // Ignore and keep UI responsive.
    }
  }

  async function markAllRead() {
    try {
      await request("/notifications/read-all", {
        baseUrl,
        token,
        method: "PATCH",
      });
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, is_read: true })),
      );
      setUnreadCount(0);
    } catch (_error) {
      // Ignore and keep UI responsive.
    }
  }

  async function deleteOne(id) {
    try {
      await request(`/notifications/${id}`, {
        baseUrl,
        token,
        method: "DELETE",
      });

      setNotifications((prev) => {
        const deleted = prev.find((item) => Number(item.id) === Number(id));
        if (deleted && !deleted.is_read) {
          setUnreadCount((count) => Math.max(0, count - 1));
        }
        return prev.filter((item) => Number(item.id) !== Number(id));
      });
      seenNotificationIdsRef.current.delete(Number(id));
    } catch (_error) {
      // Keep UI resilient on delete failures.
    }
  }

  async function clearAll() {
    try {
      await request("/notifications/clear-all", {
        baseUrl,
        token,
        method: "DELETE",
      });
      setNotifications([]);
      setUnreadCount(0);
      seenNotificationIdsRef.current.clear();
    } catch (_error) {
      // Keep UI resilient on delete failures.
    }
  }

  async function handleNotificationClick(notification) {
    if (!notification.is_read) {
      await markOneRead(notification.id);
    }

    if (notification.reference_type === "task") {
      navigate(`/task/${notification.reference_id}`);
    } else if (notification.reference_type === "project") {
      navigate("/projects");
    }

    setOpen(false);
  }

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 10000);

    function handleFocus() {
      loadNotifications();
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="notification-bell" ref={panelRef}>
      <button
        type="button"
        className="ghost icon-btn notification-bell__trigger"
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) {
            loadNotifications();
          }
        }}
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notification-bell__badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-panel">
          <div className="notification-panel__header">
            <strong>Notifications</strong>
            <div className="row" style={{ gap: "8px" }}>
              <button
                type="button"
                className="ghost"
                onClick={markAllRead}
                disabled={unreadCount === 0}
              >
                Mark all as read
              </button>
              <button
                type="button"
                className="ghost danger"
                onClick={clearAll}
                disabled={notifications.length === 0}
              >
                Clear all
              </button>
            </div>
          </div>

          <div className="notification-panel__list">
            {notifications.length === 0 ? (
              <p className="muted">No notifications yet.</p>
            ) : (
              notifications.map((notification) => (
                <div key={notification.id} className="notification-item-wrap">
                  <button
                    type="button"
                    className="notification-item"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <span
                      className={`notification-item__dot ${notification.is_read ? "is-read" : "is-unread"}`}
                    />
                    <div className="notification-item__content">
                      <strong>{notification.title}</strong>
                      <p>{notification.body}</p>
                      <small>
                        {formatRelativeTime(notification.created_at)}
                      </small>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="ghost icon-btn notification-item__delete"
                    onClick={() => deleteOne(notification.id)}
                    aria-label="Delete notification"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
