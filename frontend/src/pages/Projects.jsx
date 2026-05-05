import { useOutletContext } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import {
  Search,
  FolderKanban,
  Trash2,
  Eye,
  Pencil,
  Power,
  UserPlus,
} from "lucide-react";
import { DEFAULT_BASE_URL, getServerUrl, request } from "../api";

export default function Projects() {
  const {
    isLead,
    selectedProjectId,
    setSelectedProjectId,
    projectForm,
    setProjectForm,
    allMembers,
    setGlobalMessage,
  } = useOutletContext();

  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [projectFilter, setProjectFilter] = useState("active");
  const [projectsRows, setProjectsRows] = useState([]);
  const [projectsTotalItems, setProjectsTotalItems] = useState(0);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectNotes, setProjectNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteAssigneeIds, setNewNoteAssigneeIds] = useState([]);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [editingNoteAssigneeIds, setEditingNoteAssigneeIds] = useState([]);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const baseUrl = localStorage.getItem("baseUrl") || DEFAULT_BASE_URL;
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken");

  const filteredMembers = useMemo(() => {
    if (!searchQuery) return allMembers;
    const lowerQuery = searchQuery.toLowerCase();
    return allMembers.filter(
      (m) =>
        m.name.toLowerCase().includes(lowerQuery) ||
        m.email.toLowerCase().includes(lowerQuery),
    );
  }, [allMembers, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(projectsTotalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedProjects = useMemo(() => projectsRows, [projectsRows]);

  async function loadProjectsPage(targetPage = safePage) {
    setProjectsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(pageSize),
      });
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }
      if (projectFilter === "active") {
        params.set("isActive", "true");
      } else if (projectFilter === "inactive") {
        params.set("isActive", "false");
      }

      const response = await request(`/projects?${params.toString()}`, {
        baseUrl,
        token,
      });
      const items = response.data?.items || [];
      const totalItems = Number(response.data?.pagination?.totalItems || 0);

      setProjectsRows(items);
      setProjectsTotalItems(totalItems);

      const lastPage = Math.max(1, Math.ceil(totalItems / pageSize));
      if (targetPage > lastPage) {
        setPage(lastPage);
      }
    } catch (error) {
      setProjectsRows([]);
      setProjectsTotalItems(0);
      setGlobalMessage(error.message || "Failed to load projects");
    } finally {
      setProjectsLoading(false);
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

  async function openCreateModal() {
    setSelectedProjectId("");
    setEditingProjectId(null);
    setProjectForm({
      name: "",
      client_name: "",
      project_source: "",
      internal_notes: "",
      member_ids: [],
    });
    setProjectNotes([]);
    setNotesError("");
    setNewNoteText("");
    setNewNoteAssigneeIds([]);
    setEditingNoteId(null);
    setIsModalOpen(true);
  }

  async function loadProjectNotes(projectId) {
    setNotesLoading(true);
    setNotesError("");
    try {
      const payload = await request(`/projects/${projectId}/notes`, {
        baseUrl,
        token,
      });
      setProjectNotes(payload.data || []);
    } catch (error) {
      setProjectNotes([]);
      setNotesError(error.message || "Failed to load project notes");
    } finally {
      setNotesLoading(false);
    }
  }

  async function openEditModal(project) {
    setSelectedProjectId(String(project.id));
    setEditingProjectId(project.id);

    setProjectForm({
      name: project.name || "",
      client_name: project.client_name || "",
      project_source: project.project_source || "",
      internal_notes: project.internal_notes || "",
      member_ids: [],
    });
    setIsModalOpen(true);

    try {
      const data = await request(`/projects/${project.id}/members`, {
        baseUrl,
        token,
      });
      setProjectForm((prev) => ({
        ...prev,
        member_ids: (data.data || []).map((m) => m.id),
      }));
    } catch (e) {
      setGlobalMessage(e.message || "Failed to load members");
    }

    await loadProjectNotes(project.id);
  }

  async function createProjectNote() {
    if (!editingProjectId || !newNoteText.trim()) return;

    setNoteSubmitting(true);
    setNotesError("");
    try {
      await request(`/projects/${editingProjectId}/notes`, {
        baseUrl,
        token,
        method: "POST",
        body: JSON.stringify({
          note_text: newNoteText.trim(),
          assignee_ids: newNoteAssigneeIds.map((id) => Number(id)),
        }),
      });

      setNewNoteText("");
      setNewNoteAssigneeIds([]);
      await loadProjectNotes(editingProjectId);
    } catch (e) {
      setNotesError(e.message || "Failed to create project note");
    } finally {
      setNoteSubmitting(false);
    }
  }

  async function saveEditedProjectNote(noteId) {
    if (!editingProjectId || !editingNoteText.trim()) return;

    setNoteSubmitting(true);
    setNotesError("");
    try {
      await request(`/projects/${editingProjectId}/notes/${noteId}`, {
        baseUrl,
        token,
        method: "PUT",
        body: JSON.stringify({
          note_text: editingNoteText.trim(),
          assignee_ids: editingNoteAssigneeIds.map((id) => Number(id)),
        }),
      });

      setEditingNoteId(null);
      setEditingNoteText("");
      setEditingNoteAssigneeIds([]);
      await loadProjectNotes(editingProjectId);
    } catch (e) {
      setNotesError(e.message || "Failed to update project note");
    } finally {
      setNoteSubmitting(false);
    }
  }

  async function deleteProjectNote(noteId) {
    if (!editingProjectId) return;
    if (!window.confirm("Delete this project note?")) return;

    setNoteSubmitting(true);
    setNotesError("");
    try {
      await request(`/projects/${editingProjectId}/notes/${noteId}`, {
        baseUrl,
        token,
        method: "DELETE",
      });

      await loadProjectNotes(editingProjectId);
    } catch (e) {
      setNotesError(e.message || "Failed to delete project note");
    } finally {
      setNoteSubmitting(false);
    }
  }

  async function submitProjectForm(event) {
    event.preventDefault();
    if (!editingProjectId) {
      try {
        await request("/projects", {
          baseUrl,
          token,
          method: "POST",
          body: JSON.stringify({
            ...projectForm,
            team_member_count: (projectForm.member_ids || []).length,
          }),
        });
        setGlobalMessage("Project created.");
        await loadProjectsPage(1);
        setIsModalOpen(false);
      } catch (error) {
        setGlobalMessage(error.message || "Failed to create project");
      }
      return;
    }

    try {
      await request(`/projects/${editingProjectId}`, {
        baseUrl,
        token,
        method: "PUT",
        body: JSON.stringify(projectForm),
      });
      await loadProjectsPage(safePage);
      setIsModalOpen(false);
    } catch (e) {
      setGlobalMessage(e.message || "Failed to update project");
    }
  }

  async function deleteProject(id) {
    if (!window.confirm("Are you sure you want to deactivate this project?")) {
      return;
    }
    try {
      await request(`/projects/${id}`, {
        baseUrl,
        token,
        method: "DELETE",
      });
      setIsModalOpen(false);
      await loadProjectsPage(safePage);
    } catch (e) {
      setGlobalMessage(e.message || "Failed to deactivate project");
    }
  }

  async function reactivateProject(id) {
    try {
      await request(`/projects/${id}`, {
        baseUrl,
        token,
        method: "PUT",
        body: JSON.stringify({ is_active: true }),
      });
      setGlobalMessage("Project reactivated.");
      await loadProjectsPage(safePage);
    } catch (e) {
      setGlobalMessage(e.message || "Failed to reactivate project");
    }
  }

  useEffect(() => {
    loadProjectsPage(page);
  }, [page, searchQuery, projectFilter]);

  function handleViewProject(project) {
    setSelectedProjectId(String(project.id));
    setGlobalMessage(`Selected project: ${project.name}`);
  }

  return (
    <div className="stack slide-in">
      <section className="panel project-hub-panel" style={{ padding: "24px" }}>
        <div className="row wrap project-hub-header">
          <div className="project-hub-copy">
            <h2 style={{ margin: 0 }}>Projects</h2>
            <p className="muted" style={{ margin: 0, marginTop: "4px" }}>
              Manage projects, members, and status at scale.
            </p>
          </div>

          {isLead && (
            <button
              type="button"
              onClick={openCreateModal}
              style={{ display: "flex", gap: "8px", alignItems: "center" }}
            >
              <FolderKanban size={16} /> Create Project
            </button>
          )}
        </div>

        <div className="project-table-toolbar">
          <div className="search-bar project-table-search">
            <Search size={18} color="var(--muted)" />
            <input
              placeholder="Search projects by name"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            value={projectFilter}
            onChange={(e) => {
              setProjectFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="project-table-wrap">
          <table className="project-table">
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Client</th>
                <th>Source</th>
                <th>Members</th>
                <th>Status</th>
                <th>Created Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projectsLoading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="muted"
                    style={{ textAlign: "center" }}
                  >
                    Loading projects...
                  </td>
                </tr>
              ) : paginatedProjects.length > 0 ? (
                paginatedProjects.map((project) => {
                  const isProjectActive = Boolean(project.is_active);
                  return (
                    <tr key={project.id}>
                      <td>{project.name}</td>
                      <td>{project.client_name || "Internal"}</td>
                      <td>{project.project_source || "N/A"}</td>
                      <td>{project.assigned_members || 0}</td>
                      <td>
                        <span
                          className={`project-hub-status ${isProjectActive ? "is-active" : "is-inactive"}`}
                        >
                          {isProjectActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        {project.created_at
                          ? new Intl.DateTimeFormat("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }).format(new Date(project.created_at))
                          : "-"}
                      </td>
                      <td>
                        <div className="row wrap" style={{ gap: "6px" }}>
                          <button
                            type="button"
                            className="ghost icon-btn"
                            onClick={() => handleViewProject(project)}
                            aria-label="View"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            className="ghost icon-btn"
                            onClick={() => openEditModal(project)}
                            aria-label="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="ghost icon-btn"
                            onClick={() => openEditModal(project)}
                            aria-label="Assign members"
                          >
                            <UserPlus size={14} />
                          </button>
                          {isProjectActive ? (
                            <button
                              type="button"
                              className="ghost icon-btn"
                              onClick={() => deleteProject(project.id)}
                              aria-label="Deactivate"
                            >
                              <Power size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="ghost icon-btn"
                              onClick={() => reactivateProject(project.id)}
                              aria-label="Reactivate"
                            >
                              <Power size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="muted"
                    style={{ textAlign: "center" }}
                  >
                    No projects found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="project-table-pagination">
          <p className="muted" style={{ margin: 0 }}>
            Showing{" "}
            {projectsTotalItems === 0 ? 0 : (safePage - 1) * pageSize + 1}-
            {projectsTotalItems === 0
              ? 0
              : Math.min(safePage * pageSize, projectsTotalItems)}{" "}
            of {projectsTotalItems}
          </p>
          <div className="row wrap" style={{ gap: "8px" }}>
            <button
              type="button"
              className="ghost"
              disabled={safePage === 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </button>
            <span className="pill">
              Page {safePage} / {totalPages}
            </span>
            <button
              type="button"
              className="ghost"
              disabled={safePage === totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {isLead && isModalOpen && (
        <div className="modal-shell" onClick={() => setIsModalOpen(false)}>
          <div
            className="modal project-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "760px" }}
          >
            <div className="project-modal-header">
              <h3 style={{ margin: 0 }}>
                {editingProjectId ? "Update Project" : "Create Foundation"}
              </h3>
              {editingProjectId && (
                <button
                  type="button"
                  className="ghost danger"
                  onClick={() => deleteProject(editingProjectId)}
                  style={{ display: "flex", gap: "4px", alignItems: "center" }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>

            <form className="stack project-form" onSubmit={submitProjectForm}>
              <div className="row project-grid">
                <div className="stack project-field">
                  <label>Project Name</label>
                  <input
                    value={projectForm.name || ""}
                    onChange={(e) =>
                      setProjectForm({ ...projectForm, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="stack project-field">
                  <label>Client Name</label>
                  <input
                    value={projectForm.client_name || ""}
                    onChange={(e) =>
                      setProjectForm({
                        ...projectForm,
                        client_name: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div className="stack project-field">
                <label>Project Source</label>
                <input
                  value={projectForm.project_source || ""}
                  onChange={(e) =>
                    setProjectForm({
                      ...projectForm,
                      project_source: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="stack project-field">
                <label>Internal Outline</label>
                <textarea
                  rows="2"
                  value={projectForm.internal_notes || ""}
                  onChange={(e) =>
                    setProjectForm({
                      ...projectForm,
                      internal_notes: e.target.value,
                    })
                  }
                />
              </div>

              <div
                className="section project-people-section"
                style={{ marginTop: "10px", paddingTop: 0, border: "none" }}
              >
                <label style={{ marginBottom: "8px", display: "block" }}>
                  Assign Members
                </label>

                <div className="search-bar">
                  <Search size={18} color="var(--muted)" />
                  <input
                    placeholder="Search personnel profiles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="scroll-box" style={{ maxHeight: "180px" }}>
                  {filteredMembers.map((member) => (
                    <label key={member.id} className="list-item">
                      <input
                        type="checkbox"
                        checked={(projectForm.member_ids || []).includes(
                          member.id,
                        )}
                        onChange={() => toggleMemberSelection(member.id)}
                        style={{
                          margin: 0,
                          width: "18px",
                          height: "18px",
                          cursor: "pointer",
                        }}
                      />
                      {member.profile_picture ? (
                        <img
                          src={
                            member.profile_picture.startsWith("http")
                              ? member.profile_picture
                              : `${getServerUrl()}${member.profile_picture}`
                          }
                          alt={member.name}
                          className="avatar"
                          style={{ width: 32, height: 32, objectFit: "cover" }}
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <div
                          className="avatar"
                          style={{ width: 32, height: 32, fontSize: "0.8rem" }}
                        >
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600, color: "var(--text)" }}>
                          {member.name}
                        </span>
                        <span
                          style={{ fontSize: "0.8rem", color: "var(--muted)" }}
                        >
                          {member.email}
                        </span>
                      </div>
                    </label>
                  ))}
                  {filteredMembers.length === 0 && (
                    <div
                      style={{
                        padding: "12px",
                        textAlign: "center",
                        color: "var(--muted)",
                      }}
                    >
                      No valid personnel found.
                    </div>
                  )}
                </div>
              </div>

              <div
                className="row wrap project-actions"
                style={{ marginTop: "16px" }}
              >
                <button type="submit" style={{ flex: 1 }}>
                  {editingProjectId ? "Update Parameters" : "Launch Project"}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>

            {editingProjectId && (
              <section className="section" style={{ marginTop: "16px" }}>
                <h4 style={{ marginTop: 0 }}>Internal Notes</h4>
                {notesError && (
                  <p className="muted" style={{ color: "#ef4444" }}>
                    {notesError}
                  </p>
                )}
                <div className="row wrap" style={{ alignItems: "flex-end" }}>
                  <label style={{ flex: 2 }}>
                    Note
                    <input
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          createProjectNote();
                        }
                      }}
                      placeholder="Add internal note"
                    />
                  </label>
                  <label style={{ flex: 1 }}>
                    Assigned To
                    <select
                      multiple
                      value={newNoteAssigneeIds}
                      onChange={(e) =>
                        setNewNoteAssigneeIds(
                          Array.from(e.target.selectedOptions).map((opt) =>
                            String(opt.value),
                          ),
                        )
                      }
                    >
                      {projectForm.member_ids.map((id) => {
                        const member = allMembers.find(
                          (row) => Number(row.id) === Number(id),
                        );
                        if (!member) return null;
                        return (
                          <option key={member.id} value={String(member.id)}>
                            {member.name}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={createProjectNote}
                    disabled={noteSubmitting}
                  >
                    Send
                  </button>
                </div>

                <table style={{ width: "100%", marginTop: "12px" }}>
                  <thead>
                    <tr>
                      <th align="left">Note</th>
                      <th align="left">Assigned To</th>
                      <th align="left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notesLoading ? (
                      <tr>
                        <td colSpan={3} className="muted">
                          Loading notes...
                        </td>
                      </tr>
                    ) : (
                      projectNotes.map((note) => {
                        const isEditing =
                          Number(editingNoteId) === Number(note.id);
                        const noteAssigneeNames = (note.assignees || [])
                          .map((assignee) => assignee.name)
                          .join(", ");

                        return (
                          <tr key={note.id}>
                            <td>
                              {isEditing ? (
                                <input
                                  value={editingNoteText}
                                  onChange={(e) =>
                                    setEditingNoteText(e.target.value)
                                  }
                                />
                              ) : (
                                note.note_text
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <select
                                  multiple
                                  value={editingNoteAssigneeIds}
                                  onChange={(e) =>
                                    setEditingNoteAssigneeIds(
                                      Array.from(e.target.selectedOptions).map(
                                        (opt) => String(opt.value),
                                      ),
                                    )
                                  }
                                >
                                  {projectForm.member_ids.map((id) => {
                                    const member = allMembers.find(
                                      (row) => Number(row.id) === Number(id),
                                    );
                                    if (!member) return null;
                                    return (
                                      <option
                                        key={member.id}
                                        value={String(member.id)}
                                      >
                                        {member.name}
                                      </option>
                                    );
                                  })}
                                </select>
                              ) : (
                                noteAssigneeNames || "-"
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <div className="row wrap">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      saveEditedProjectNote(note.id)
                                    }
                                    disabled={noteSubmitting}
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    className="ghost"
                                    onClick={() => {
                                      setEditingNoteId(null);
                                      setEditingNoteText("");
                                      setEditingNoteAssigneeIds([]);
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="row wrap">
                                  <button
                                    type="button"
                                    className="ghost"
                                    onClick={() => {
                                      setEditingNoteId(note.id);
                                      setEditingNoteText(note.note_text || "");
                                      setEditingNoteAssigneeIds(
                                        (note.assignees || []).map((assignee) =>
                                          String(assignee.id),
                                        ),
                                      );
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="ghost danger"
                                    onClick={() => deleteProjectNote(note.id)}
                                    disabled={noteSubmitting}
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                    {!notesLoading && projectNotes.length === 0 && (
                      <tr>
                        <td colSpan={3} className="muted">
                          No notes yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
