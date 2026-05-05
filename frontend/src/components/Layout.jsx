import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

export default function Layout({
  user,
  isLead,
  theme,
  setTheme,
  setProfileOpen,
  clearSession,
  globalMessage,
  ...contextProps
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { projects, selectedProjectId, setSelectedProjectId } = contextProps;

  return (
    <div
      className="dashboard-shell layout-shell"
      style={{ gridTemplateColumns: isLead ? "auto 1fr" : "1fr" }}
    >
      {isLead && <Sidebar isLead={isLead} isCollapsed={isSidebarCollapsed} />}
      <main className="main-content">
        <Navbar
          theme={theme}
          setTheme={setTheme}
          setProfileOpen={setProfileOpen}
          clearSession={clearSession}
          isLead={isLead}
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          user={user}
          projects={projects}
          selectedProjectId={selectedProjectId}
          setSelectedProjectId={setSelectedProjectId}
        />

        <div className="page-content">
          <Outlet context={{ user, isLead, ...contextProps }} />
        </div>
      </main>
    </div>
  );
}
