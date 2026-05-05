import { Sun, Moon, LogOut, Menu, Filter, History } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getServerUrl } from "../api";
import NotificationBell from "./NotificationBell";

export default function Navbar({
  theme,
  setTheme,
  setProfileOpen,
  clearSession,
  isLead,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  user,
  projects = [],
  selectedProjectId = "",
  setSelectedProjectId = () => {},
}) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const showProjectFilter =
    location.pathname === "/tasks" || (!isLead && location.pathname === "/");

  return (
    <header className="topbar">
      <div className="topbar-left">
        {/* Only Leads have a sidebar to toggle */}
        {isLead && (
          <button
            type="button"
            className="ghost icon-btn"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            aria-label="Toggle Sidebar"
          >
            <Menu size={20} />
          </button>
        )}
        <h1>Unified Dashboard</h1>

        <div className="live-indicator">
          <div className="dot"></div>
          Live
        </div>
      </div>

      <div className="top-actions">
        {showProjectFilter && (
          <div className="topbar-filter">
            <button
              type="button"
              className="ghost icon-btn topbar-filter-trigger"
              onClick={() => setIsFilterOpen((prev) => !prev)}
              aria-label="Project selector"
            >
              <Filter size={18} />
              <span>Project</span>
            </button>

            {isFilterOpen && (
              <div className="topbar-filter-popover">
                <button
                  type="button"
                  className={`topbar-filter-option ${selectedProjectId ? "" : "is-active"}`}
                  onClick={() => {
                    setSelectedProjectId("");
                    setIsFilterOpen(false);
                  }}
                >
                  All Projects
                </button>
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className={`topbar-filter-option ${String(selectedProjectId) === String(project.id) ? "is-active" : ""}`}
                    onClick={() => {
                      setSelectedProjectId(String(project.id));
                      setIsFilterOpen(false);
                    }}
                  >
                    {project.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!isLead && (
          <button
            type="button"
            className={`ghost icon-btn topbar-history-btn ${location.pathname === "/time-logs" ? "is-active" : ""}`}
            onClick={() => navigate("/time-logs")}
            aria-label="Open time logs"
          >
            <History size={18} />
            <span>My Time Logs</span>
          </button>
        )}

        {user && (
          <div className="user-profile">
            <span>Welcome back, {user.name}</span>
            {user.profile_picture ? (
              <img
                src={
                  user.profile_picture.startsWith("http")
                    ? user.profile_picture
                    : `${getServerUrl()}${user.profile_picture}`
                }
                alt={user.name}
                className="avatar"
                style={{
                  width: 36,
                  height: 36,
                  cursor: "pointer",
                  objectFit: "cover",
                }}
                onClick={() => setProfileOpen(true)}
                crossOrigin="anonymous"
              />
            ) : (
              <div
                className="avatar"
                style={{ width: 36, height: 36, cursor: "pointer" }}
                onClick={() => setProfileOpen(true)}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}

        <NotificationBell />

        <button
          type="button"
          className="ghost icon-btn"
          onClick={() =>
            setTheme((prev) => (prev === "light" ? "dark" : "light"))
          }
          aria-label="Toggle Theme"
        >
          {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
        </button>
        <button
          type="button"
          className="danger ghost icon-btn"
          onClick={clearSession}
          aria-label="Logout"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}
