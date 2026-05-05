import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ArrowLeft, Clock3, Filter, Pencil, Trash2 } from "lucide-react";
import { request } from "../api";

function formatHoursToHuman(hoursValue) {
  const totalMinutes = Math.max(0, Math.round(Number(hoursValue || 0) * 60));
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export default function MyTimeLogs() {
  const navigate = useNavigate();
  const { user, setGlobalMessage } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [totalLogged, setTotalLogged] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const baseUrl =
    localStorage.getItem("baseUrl") || "http://localhost:5001/api";
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken");

  async function loadHistory() {
    setLoading(true);
    try {
      const payload = await request(
        "/time-entries/my-history?page=1&pageSize=200",
        {
          baseUrl,
          token,
        },
      );
      setHistory(payload.data?.items || []);
      setTotalLogged(Number(payload.data?.totalLogged || 0));
    } catch (error) {
      setGlobalMessage(error.message || "Failed to load time logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, startDate, endDate]);

  const filteredHistory = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const startDateMs = startDate
      ? new Date(`${startDate}T00:00:00`).getTime()
      : null;
    const endDateMs = endDate
      ? new Date(`${endDate}T23:59:59`).getTime()
      : null;

    return history.filter((item) => {
      const dateMs = new Date(item.date_logged).getTime();
      const taskName = String(item.task_name || "").toLowerCase();
      const projectName = String(item.project_name || "").toLowerCase();

      if (normalizedSearch) {
        const matchesText =
          taskName.includes(normalizedSearch) ||
          projectName.includes(normalizedSearch);
        if (!matchesText) return false;
      }

      if (startDateMs && dateMs < startDateMs) return false;
      if (endDateMs && dateMs > endDateMs) return false;

      return true;
    });
  }, [history, searchQuery, startDate, endDate]);

  const filteredTotalLogged = useMemo(
    () =>
      filteredHistory.reduce(
        (total, entry) => total + Number(entry.time_logged || 0),
        0,
      ),
    [filteredHistory],
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count += 1;
    if (startDate) count += 1;
    if (endDate) count += 1;
    return count;
  }, [searchQuery, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const offset = (safePage - 1) * pageSize;
    return filteredHistory.slice(offset, offset + pageSize);
  }, [filteredHistory, safePage]);

  function clearFilters() {
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
  }

  async function editEntry(entry) {
    const nextHours = window.prompt(
      "Edit hours logged:",
      String(entry.time_logged || ""),
    );
    if (nextHours === null) return;

    const nextDate = window.prompt(
      "Edit date (YYYY-MM-DD):",
      String(entry.date_logged || "").slice(0, 10),
    );
    if (nextDate === null) return;

    try {
      await request(`/time-entries/${entry.id}`, {
        baseUrl,
        token,
        method: "PUT",
        body: {
          time_logged: Number(nextHours),
          date_logged: nextDate,
        },
      });

      setGlobalMessage("Time entry updated.");
      await loadHistory();
    } catch (error) {
      setGlobalMessage(error.message || "Failed to update time entry");
    }
  }

  async function deleteEntry(entryId) {
    if (!window.confirm("Delete this time entry?")) return;

    try {
      await request(`/time-entries/${entryId}`, {
        baseUrl,
        token,
        method: "DELETE",
      });
      setGlobalMessage("Time entry deleted.");
      await loadHistory();
    } catch (error) {
      setGlobalMessage(error.message || "Failed to delete time entry");
    }
  }

  return (
    <div className="stack slide-in time-history-page">
      <button
        type="button"
        className="ghost time-history-back-btn"
        onClick={() => navigate("/")}
      >
        <ArrowLeft size={16} /> Back
      </button>

      <section className="panel time-history-hero">
        <div>
          <p className="time-history-kicker">My Time Logs</p>
          <h2>{user?.name || "Member"}</h2>
          <p className="muted">
            Keep track of all logged hours across tasks and projects.
          </p>
        </div>
        <div className="time-history-total">
          <Clock3 size={18} />
          <span>Filtered Total Logged</span>
          <strong>
            {formatHoursToHuman(filteredTotalLogged || totalLogged)}
          </strong>
        </div>
      </section>

      <section className="panel time-history-table-panel">
        <div className="time-history-table-header">
          <div
            className="row wrap"
            style={{ gap: "10px", alignItems: "center" }}
          >
            <h3 style={{ margin: 0 }}>Time Entries</h3>
            {activeFilterCount > 0 && (
              <button
                type="button"
                className="ghost time-filter-chip"
                onClick={clearFilters}
              >
                {activeFilterCount} active filters
              </button>
            )}
          </div>

          <button
            type="button"
            className="ghost"
            onClick={() => setShowFilters((prev) => !prev)}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
          >
            <Filter size={16} /> Filter
          </button>
        </div>

        <div
          className={`time-history-filter-collapse ${showFilters ? "is-open" : ""}`}
        >
          <div className="time-history-filter-grid">
            <label>
              Search Task / Project
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type task or project name"
              />
            </label>

            <label>
              Start Date
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>

            <label>
              End Date
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </div>
        </div>

        {loading ? (
          <p className="muted">Loading time history...</p>
        ) : filteredHistory.length === 0 ? (
          <div className="empty-state-card" style={{ minHeight: 240 }}>
            <Clock3 size={36} style={{ color: "var(--border)" }} />
            <h3>No time entries logged yet</h3>
            <p className="muted">
              Start the clock or log manual hours from task details.
            </p>
          </div>
        ) : (
          <>
            <div className="time-history-table-wrap">
              <table className="time-history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Task Name</th>
                    <th>Project</th>
                    <th>Hours Logged</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        {new Intl.DateTimeFormat("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }).format(new Date(entry.date_logged))}
                      </td>
                      <td>{entry.task_name}</td>
                      <td>{entry.project_name}</td>
                      <td>{formatHoursToHuman(entry.time_logged)}</td>
                      <td>{entry.notes || "-"}</td>
                      <td>
                        <div className="row wrap" style={{ gap: "8px" }}>
                          <button
                            type="button"
                            className="ghost icon-btn"
                            onClick={() => editEntry(entry)}
                            aria-label="Edit entry"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="ghost icon-btn"
                            onClick={() => deleteEntry(entry.id)}
                            aria-label="Delete entry"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="time-history-pagination">
              {(() => {
                const rangeStart =
                  filteredHistory.length === 0
                    ? 0
                    : (safePage - 1) * pageSize + 1;
                const rangeEnd =
                  filteredHistory.length === 0
                    ? 0
                    : Math.min(safePage * pageSize, filteredHistory.length);

                return (
                  <p className="muted" style={{ margin: 0 }}>
                    Showing {rangeStart}-{rangeEnd} of {filteredHistory.length}
                  </p>
                );
              })()}
              <div className="row wrap" style={{ gap: "8px" }}>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={safePage === 1}
                >
                  Previous
                </button>
                <span className="pill">
                  Page {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  className="ghost"
                  onClick={() =>
                    setPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={safePage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
