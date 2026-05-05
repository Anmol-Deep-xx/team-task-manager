import { useState, useEffect } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { ArrowLeft, Clock, AlertCircle, SendHorizontal } from "lucide-react";
import { DEFAULT_BASE_URL, request } from "../api";
// Removed date-fns import to avoid missing dependency error

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { handleStatusDrop, user } = useOutletContext();
  const [taskDetails, setTaskDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [chatText, setChatText] = useState("");
  const [internalNotes, setInternalNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [notesSubmitting, setNotesSubmitting] = useState(false);
  const [noteAssigneeIds, setNoteAssigneeIds] = useState([]);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [editingNoteAssigneeIds, setEditingNoteAssigneeIds] = useState([]);
  const [taskMessages, setTaskMessages] = useState([]);
  const [activeDiscussionTab, setActiveDiscussionTab] = useState("notes");
  const [timeForm, setTimeForm] = useState({
    time_logged: "1",
    date_logged: new Date().toISOString().split("T")[0],
  });
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStartMs, setTimerStartMs] = useState(null);
  const [timerNow, setTimerNow] = useState(Date.now());
  const baseUrl = localStorage.getItem("baseUrl") || DEFAULT_BASE_URL;
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken");

  const isAssignedMember =
    user?.role === "member" &&
    (Number(taskDetails?.assigned_to) === Number(user?.id) ||
      taskDetails?.assignees?.some(
        (assignee) => Number(assignee.id) === Number(user?.id),
      ));
  const isLead = user?.role === "team_lead" || user?.role === "admin";

  const totalLogged = Number(taskDetails?.total_time_logged || 0);
  const estimated = Number(taskDetails?.estimated_time || 0);
  const remaining = Math.max(0, estimated - totalLogged);

  function formatHoursToHuman(hoursValue) {
    const totalMinutes = Math.max(0, Math.round(Number(hoursValue || 0) * 60));
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  }

  function getLiveTimerSeconds() {
    if (!timerRunning || !timerStartMs) return 0;
    return Math.max(0, Math.floor((timerNow - timerStartMs) / 1000));
  }

  async function fetchTask() {
    try {
      const data = await request(`/tasks/${id}`, { baseUrl, token });
      setTaskDetails(data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTaskInternalNotes() {
    setNotesLoading(true);
    setNotesError("");
    try {
      const data = await request(`/tasks/${id}/notes`, { baseUrl, token });
      setInternalNotes(data.data || []);
    } catch (error) {
      setInternalNotes([]);
      setNotesError(error.message || "Failed to load internal notes");
    } finally {
      setNotesLoading(false);
    }
  }

  async function fetchTaskMessages() {
    try {
      const res = await fetch(`${baseUrl}/tasks/${id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load task messages");
      const data = await res.json();
      setTaskMessages(data.data || []);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    fetchTask();
    fetchTaskInternalNotes();
    fetchTaskMessages();
  }, [id]);

  async function updateStatus(e) {
    const newStatus = e.target.value;
    await handleStatusDrop(taskDetails.id, newStatus);
    setTaskDetails((prev) => ({ ...prev, status: newStatus }));
  }

  async function handleAddComment() {
    if (!commentText.trim() || !isLead) return;
    setNotesSubmitting(true);
    setNotesError("");
    try {
      await request(`/tasks/${id}/notes`, {
        baseUrl,
        token,
        method: "POST",
        body: {
          note_text: commentText.trim(),
          assignee_ids: noteAssigneeIds.map((assigneeId) => Number(assigneeId)),
        },
      });

      setCommentText("");
      setNoteAssigneeIds([]);
      fetchTaskInternalNotes();
    } catch (e) {
      setNotesError(e.message || "Failed to create note");
    } finally {
      setNotesSubmitting(false);
    }
  }

  async function saveEditedNote(noteId) {
    if (!editingNoteText.trim() || !isLead) return;

    setNotesSubmitting(true);
    setNotesError("");
    try {
      await request(`/tasks/${id}/notes/${noteId}`, {
        baseUrl,
        token,
        method: "PUT",
        body: {
          note_text: editingNoteText.trim(),
          assignee_ids: editingNoteAssigneeIds.map((assigneeId) =>
            Number(assigneeId),
          ),
        },
      });

      setEditingNoteId(null);
      setEditingNoteText("");
      setEditingNoteAssigneeIds([]);
      fetchTaskInternalNotes();
    } catch (error) {
      setNotesError(error.message || "Failed to update note");
    } finally {
      setNotesSubmitting(false);
    }
  }

  async function deleteNote(noteId) {
    if (!isLead) return;
    if (!window.confirm("Delete this internal note?")) return;

    setNotesSubmitting(true);
    setNotesError("");
    try {
      await request(`/tasks/${id}/notes/${noteId}`, {
        baseUrl,
        token,
        method: "DELETE",
      });

      fetchTaskInternalNotes();
    } catch (error) {
      setNotesError(error.message || "Failed to delete note");
    } finally {
      setNotesSubmitting(false);
    }
  }

  async function handleSendChatMessage() {
    if (!chatText.trim()) return;
    try {
      const res = await fetch(`${baseUrl}/tasks/${id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message_text: chatText.trim() }),
      });
      if (!res.ok) throw new Error("Failed to send message");

      setChatText("");
      fetchTaskMessages();
    } catch (error) {
      console.error(error);
    }
  }

  async function handleAddManualTime() {
    if (!taskDetails) return;
    try {
      const res = await fetch(`${baseUrl}/time-entries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          task_id: Number(taskDetails.id),
          time_logged: Number(timeForm.time_logged),
          date_logged: timeForm.date_logged,
        }),
      });
      if (!res.ok) throw new Error("Failed to log time");
      setTimeForm({
        time_logged: "1",
        date_logged: new Date().toISOString().split("T")[0],
      });
      fetchTask();
    } catch (error) {
      console.error(error);
    }
  }

  function startClock() {
    if (!isAssignedMember) return;
    if (remaining <= 0) return;
    setTimerRunning(true);
    setTimerStartMs(Date.now());
  }

  async function stopClockAndLog() {
    if (!timerRunning || !taskDetails) return;

    const elapsedSeconds = getLiveTimerSeconds();
    setTimerRunning(false);
    setTimerStartMs(null);

    if (elapsedSeconds <= 0) return;

    const maxSeconds = Math.floor(remaining * 3600);
    const effectiveSeconds = Math.min(elapsedSeconds, maxSeconds);
    const loggedMinutes = Math.max(1, Math.round(effectiveSeconds / 60));
    const hours = Number((loggedMinutes / 60).toFixed(4));

    try {
      const res = await fetch(`${baseUrl}/time-entries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          task_id: Number(taskDetails.id),
          time_logged: hours,
          date_logged: new Date().toISOString().split("T")[0],
        }),
      });
      if (!res.ok) throw new Error("Failed to log timer time");
      fetchTask();
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    if (!timerRunning) return;
    const timer = setInterval(() => setTimerNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [timerRunning]);

  if (loading || !taskDetails) {
    return (
      <div
        className="stack slide-in"
        style={{ maxWidth: 800, margin: "0 auto", width: "100%" }}
      >
        {/* Skeleton Loader */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 100,
              height: 24,
              background: "var(--border)",
              borderRadius: 12,
              animation: "pulse 1.5s infinite",
            }}
          />
        </div>
        <div
          className="panel"
          style={{
            height: 300,
            animation: "pulse 1.5s infinite",
            background: "var(--border)",
          }}
        ></div>
      </div>
    );
  }

  return (
    <div
      className="stack slide-in"
      style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}
    >
      <button
        type="button"
        className="ghost"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          alignSelf: "flex-start",
          width: "fit-content",
        }}
        onClick={() => navigate("/")}
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <section className="panel" style={{ marginTop: "16px" }}>
        <header
          style={{
            borderBottom: "1px solid var(--border)",
            paddingBottom: "16px",
            marginBottom: "20px",
          }}
        >
          <div
            className="row wrap"
            style={{
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <h1 style={{ fontSize: "2rem", marginBottom: "8px" }}>
                {taskDetails.task_name}
              </h1>
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                  color: "var(--muted)",
                }}
              >
                <Clock size={16} />
                <span>Estimated: {taskDetails.estimated_time} hours</span>
                {taskDetails.is_overdue && (
                  <span
                    style={{
                      color: "#EF4444",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <AlertCircle size={16} /> Overdue by{" "}
                    {taskDetails.overflow_hours}h
                  </span>
                )}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                minWidth: "150px",
              }}
            >
              <div
                className={`priority-tag priority-${taskDetails.priority}`}
                style={{ textAlign: "center", padding: "6px" }}
              >
                {String(taskDetails.priority).toUpperCase()} PRIORITY
              </div>
            </div>
          </div>
        </header>

        <article
          style={{
            minHeight: "120px",
            lineHeight: "1.6",
            fontSize: "1.05rem",
            color: "var(--text)",
          }}
        >
          {taskDetails.description || (
            <p className="muted" style={{ fontStyle: "italic" }}>
              No detailed description provided.
            </p>
          )}
        </article>

        <div
          style={{
            marginTop: "24px",
            paddingTop: "20px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <h3 style={{ marginBottom: "12px" }}>Time Logging</h3>
          <p className="muted" style={{ marginBottom: "8px" }}>
            Logged {formatHoursToHuman(totalLogged)} / Estimated{" "}
            {formatHoursToHuman(estimated)}
          </p>
          <p className="muted" style={{ marginBottom: "16px" }}>
            Remaining {formatHoursToHuman(remaining)}
          </p>

          <div className="time-log-grid" style={{ marginBottom: "10px" }}>
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={Math.max(0.01, remaining).toFixed(2)}
              value={timeForm.time_logged}
              onChange={(e) =>
                setTimeForm((prev) => ({
                  ...prev,
                  time_logged: e.target.value,
                }))
              }
              placeholder="Hours"
            />
            <input
              type="date"
              value={timeForm.date_logged}
              onChange={(e) =>
                setTimeForm((prev) => ({
                  ...prev,
                  date_logged: e.target.value,
                }))
              }
            />
            <button type="button" onClick={handleAddManualTime}>
              Log Time Manually
            </button>
          </div>

          {isAssignedMember && (
            <div className="task-timer-panel">
              <div className="task-timer-display-wrap">
                <span className="task-timer-label">Timer</span>
                <span className="task-timer-display" aria-live="polite">
                  {Math.floor(getLiveTimerSeconds() / 3600)
                    .toString()
                    .padStart(2, "0")}
                  :
                  {Math.floor((getLiveTimerSeconds() % 3600) / 60)
                    .toString()
                    .padStart(2, "0")}
                  :{(getLiveTimerSeconds() % 60).toString().padStart(2, "0")}
                </span>
              </div>

              <div className="task-timer-actions">
                {!timerRunning ? (
                  <button type="button" onClick={startClock}>
                    Start Clock
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ghost"
                    onClick={stopClockAndLog}
                  >
                    Stop And Log
                  </button>
                )}
              </div>
            </div>
          )}

          {user?.role !== "member" && (
            <p className="muted" style={{ marginTop: "8px" }}>
              Team lead/admin can use manual logging only.
            </p>
          )}
        </div>

        <div
          style={{
            marginTop: "32px",
            paddingTop: "20px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <div className="discussion-tabs">
            <button
              type="button"
              className={
                activeDiscussionTab === "notes"
                  ? "discussion-tab is-active"
                  : "discussion-tab"
              }
              onClick={() => setActiveDiscussionTab("notes")}
            >
              Internal Notes
            </button>
            <button
              type="button"
              className={
                activeDiscussionTab === "chat"
                  ? "discussion-tab is-active"
                  : "discussion-tab"
              }
              onClick={() => setActiveDiscussionTab("chat")}
            >
              Team Chat
            </button>
          </div>

          {activeDiscussionTab === "notes" ? (
            <>
              {notesError && (
                <p className="muted" style={{ color: "#ef4444" }}>
                  {notesError}
                </p>
              )}
              <div
                className="stack"
                style={{ gap: "16px", marginBottom: "24px" }}
              >
                {isLead ? (
                  <>
                    <div
                      className="row wrap"
                      style={{ alignItems: "flex-end" }}
                    >
                      <label style={{ flex: 2 }}>
                        Note
                        <input
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddComment();
                            }
                          }}
                          placeholder="Type a note and press Enter"
                        />
                      </label>
                      <label style={{ flex: 1 }}>
                        Assigned To
                        <select
                          multiple
                          value={noteAssigneeIds}
                          onChange={(e) =>
                            setNoteAssigneeIds(
                              Array.from(e.target.selectedOptions).map((opt) =>
                                String(opt.value),
                              ),
                            )
                          }
                        >
                          {(taskDetails.assignees || []).map((assignee) => (
                            <option
                              key={assignee.id}
                              value={String(assignee.id)}
                            >
                              {assignee.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={handleAddComment}
                        disabled={notesSubmitting}
                      >
                        Send
                      </button>
                    </div>

                    <table style={{ width: "100%" }}>
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
                          internalNotes.map((note) => {
                            const isEditing =
                              Number(editingNoteId) === Number(note.id);
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
                                          Array.from(
                                            e.target.selectedOptions,
                                          ).map((opt) => String(opt.value)),
                                        )
                                      }
                                    >
                                      {(taskDetails.assignees || []).map(
                                        (assignee) => (
                                          <option
                                            key={assignee.id}
                                            value={String(assignee.id)}
                                          >
                                            {assignee.name}
                                          </option>
                                        ),
                                      )}
                                    </select>
                                  ) : (
                                    (note.assignees || [])
                                      .map((a) => a.name)
                                      .join(", ") || "-"
                                  )}
                                </td>
                                <td>
                                  {isEditing ? (
                                    <div className="row wrap">
                                      <button
                                        type="button"
                                        onClick={() => saveEditedNote(note.id)}
                                        disabled={notesSubmitting}
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
                                          setEditingNoteText(
                                            note.note_text || "",
                                          );
                                          setEditingNoteAssigneeIds(
                                            (note.assignees || []).map((a) =>
                                              String(a.id),
                                            ),
                                          );
                                        }}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        className="ghost"
                                        onClick={() => deleteNote(note.id)}
                                        disabled={notesSubmitting}
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
                        {!notesLoading && internalNotes.length === 0 && (
                          <tr>
                            <td colSpan={3} className="muted">
                              No notes yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <>
                    <h4 style={{ margin: 0 }}>Notes for You</h4>
                    {internalNotes.length > 0 ? (
                      internalNotes.map((note) => (
                        <div
                          key={note.id}
                          style={{
                            background: "var(--bg)",
                            padding: "12px",
                            borderRadius: "10px",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <strong>{note.created_by_name}</strong>
                          <p style={{ margin: "8px 0 0 0" }}>
                            {note.note_text}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="muted">No notes assigned to you.</p>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="task-chat-thread">
                {taskMessages.length > 0 ? (
                  taskMessages.map((message) => {
                    const isOwnMessage =
                      Number(message.sender_id) === Number(user?.id);
                    const senderRole =
                      message.sender_role === "team_lead" ||
                      message.sender_role === "admin"
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
                            <span className={`chat-role-badge ${senderRole}`}>
                              {senderRole === "role-lead" ? "Lead" : "Member"}
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
                  <p className="muted">
                    No team messages yet. Start the conversation.
                  </p>
                )}
              </div>

              <div className="task-chat-composer">
                <input
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="Type your message..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSendChatMessage();
                    }
                  }}
                />
                <button type="button" onClick={handleSendChatMessage}>
                  <SendHorizontal size={16} /> Send
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
