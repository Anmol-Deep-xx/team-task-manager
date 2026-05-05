import { NavLink } from "react-router-dom";
import { LayoutDashboard, FolderKanban, Columns, Users } from "lucide-react";

export default function Sidebar({ isLead, isCollapsed }) {
  return (
    <aside className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
      <h2>{isLead ? "Team Lead" : "Member"}</h2>

      <nav className="nav-menu stack">
        <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
          <LayoutDashboard size={20} />
          <span className="nav-label">Dashboard</span>
        </NavLink>
        
        {isLead && (
          <>
            <NavLink to="/projects" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <FolderKanban size={20} />
              <span className="nav-label">Projects</span>
            </NavLink>
            
            <NavLink to="/tasks" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <Columns size={20} />
              <span className="nav-label">Task Board</span>
            </NavLink>
          </>
        )}

        {isLead && (
          <NavLink to="/teams" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <Users size={20} />
            <span className="nav-label">Employees</span>
          </NavLink>
        )}
      </nav>
    </aside>
  );
}
