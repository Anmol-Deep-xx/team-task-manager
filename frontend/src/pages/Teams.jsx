import { useOutletContext } from "react-router-dom";
import { useState, useMemo } from "react";
import { getServerUrl } from "../api";
export default function Teams() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [memberFilter, setMemberFilter] = useState("all");
  const [selectedMember, setSelectedMember] = useState(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [memberEditForm, setMemberEditForm] = useState({
    name: "",
    contact_number: "",
    profile_picture: null,
    is_active: true,
  });
  const {
    employeeForm,
    setEmployeeForm,
    handleCreateEmployee,
    allUsers,
    handleToggleUserActive,
    handleUpdateUser,
    loadUsers,
  } = useOutletContext();

  const members = allUsers.filter((entry) => entry.role === "member");
  const filteredMembers = members.filter((entry) => {
    if (memberFilter === "active") return Boolean(entry.is_active);
    if (memberFilter === "inactive") return !entry.is_active;
    return true;
  });

  function openMemberModal(member) {
    setSelectedMember(member);
    setMemberEditForm({
      name: member.name || "",
      contact_number: member.contact_number || "",
      profile_picture: null,
      is_active: Boolean(member.is_active),
    });
    setIsMemberModalOpen(true);
  }

  async function saveMemberChanges(event) {
    event.preventDefault();
    if (!selectedMember) return;

    await handleUpdateUser(selectedMember.id, {
      name: memberEditForm.name,
      contact_number: memberEditForm.contact_number,
      profile_picture: memberEditForm.profile_picture,
      is_active: memberEditForm.is_active,
    });
    setIsMemberModalOpen(false);
  }

  const memberEmptyMessage = useMemo(() => {
    if (memberFilter === "active") return "No active members found.";
    if (memberFilter === "inactive") return "No deactivated members found.";
    return "No members found.";
  }, [memberFilter]);

  return (
    <div className="stack slide-in">
      <section className="panel glass">
        <div className="panel-head">
          <h3>Employees Dashboard</h3>
          <div className="row wrap">
            <button type="button" className="ghost" onClick={loadUsers}>
              Refresh
            </button>
            <button type="button" onClick={() => setIsModalOpen(true)}>
              + Add Employee
            </button>
          </div>
        </div>
      </section>

      {isModalOpen && (
        <div className="modal-shell" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Employee</h3>
            <p className="muted" style={{ marginBottom: "20px" }}>
              Create a new member account for the team.
            </p>
            <form
              className="stack"
              onSubmit={(e) => {
                handleCreateEmployee(e);
                setTimeout(() => setIsModalOpen(false), 200);
              }}
            >
              <div className="row">
                <input
                  placeholder="Name"
                  value={employeeForm.name}
                  onChange={(event) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  required
                />
                <input
                  placeholder="Email"
                  type="email"
                  value={employeeForm.email}
                  onChange={(event) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                  required
                />
                <input
                  placeholder="Password"
                  type="password"
                  value={employeeForm.password}
                  onChange={(event) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="row">
                <input
                  placeholder="Contact Number"
                  value={employeeForm.contact_number}
                  onChange={(event) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      contact_number: event.target.value,
                    }))
                  }
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      profile_picture: event.target.files?.[0] || null,
                    }))
                  }
                />
              </div>
              <div className="row wrap" style={{ marginTop: "16px" }}>
                <button type="submit">Create Employee</button>
                <button
                  type="button"
                  className="ghost danger"
                  onClick={() => setIsModalOpen(false)}
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <section className="panel glass">
        <h3>Employees</h3>
        <div className="row wrap" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className={memberFilter === "all" ? "" : "ghost"}
            onClick={() => setMemberFilter("all")}
          >
            All Members
          </button>
          <button
            type="button"
            className={memberFilter === "active" ? "" : "ghost"}
            onClick={() => setMemberFilter("active")}
          >
            Active
          </button>
          <button
            type="button"
            className={memberFilter === "inactive" ? "" : "ghost"}
            onClick={() => setMemberFilter("inactive")}
          >
            Deactivated
          </button>
        </div>
        {filteredMembers.length === 0 ? (
          <div className="empty-state-card">
            <h3>{memberEmptyMessage}</h3>
            <p className="muted">Try a different member filter.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Email</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        {entry.profile_picture ? (
                          <img
                            src={
                              entry.profile_picture.startsWith("http")
                                ? entry.profile_picture
                                : `${getServerUrl()}${entry.profile_picture}`
                            }
                            alt={entry.name}
                            className="avatar"
                            style={{
                              width: 36,
                              height: 36,
                              objectFit: "cover",
                            }}
                            crossOrigin="anonymous"
                          />
                        ) : (
                          <div
                            className="avatar"
                            style={{ width: 36, height: 36 }}
                          >
                            {entry.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <strong>{entry.name}</strong>
                      </div>
                    </td>
                    <td>{entry.email}</td>
                    <td>{entry.contact_number || "-"}</td>
                    <td>
                      <span
                        className={
                          entry.is_active
                            ? "status-pill active"
                            : "status-pill inactive"
                        }
                      >
                        {entry.is_active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => openMemberModal(entry)}
                      >
                        View / Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isMemberModalOpen && selectedMember && (
        <div
          className="modal-shell"
          onClick={() => setIsMemberModalOpen(false)}
        >
          <div
            className="modal member-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="project-modal-header">
              <h3 style={{ margin: 0 }}>Member Detail</h3>
              <button
                type="button"
                className={memberEditForm.is_active ? "danger" : "ghost"}
                onClick={() =>
                  setMemberEditForm((prev) => ({
                    ...prev,
                    is_active: !prev.is_active,
                  }))
                }
              >
                {memberEditForm.is_active ? "Deactivate" : "Activate"}
              </button>
            </div>

            <form className="stack" onSubmit={saveMemberChanges}>
              <div className="member-detail-head">
                {selectedMember.profile_picture ? (
                  <img
                    src={
                      selectedMember.profile_picture.startsWith("http")
                        ? selectedMember.profile_picture
                        : `${getServerUrl()}${selectedMember.profile_picture}`
                    }
                    alt={selectedMember.name}
                    className="profile-preview"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="profile-preview profile-initial">
                    {selectedMember.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h4 style={{ margin: 0 }}>{selectedMember.name}</h4>
                  <p className="muted">{selectedMember.email}</p>
                </div>
              </div>

              <div className="project-grid">
                <label>
                  Full Name
                  <input
                    value={memberEditForm.name}
                    onChange={(e) =>
                      setMemberEditForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Contact Number
                  <input
                    value={memberEditForm.contact_number}
                    onChange={(e) =>
                      setMemberEditForm((prev) => ({
                        ...prev,
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
                    setMemberEditForm((prev) => ({
                      ...prev,
                      profile_picture: e.target.files?.[0] || null,
                    }))
                  }
                />
              </label>

              <div className="row wrap" style={{ justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setIsMemberModalOpen(false)}
                >
                  Close
                </button>
                <button type="submit">Save Member</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
