import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

export default function AssigneeTypeahead({
  members = [],
  selectedIds = [],
  onChange = () => {},
  placeholder = "Search team member...",
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedMembers = useMemo(() => {
    const selectedSet = new Set((selectedIds || []).map((id) => String(id)));
    return members.filter((member) => selectedSet.has(String(member.id)));
  }, [members, selectedIds]);

  const suggestions = useMemo(() => {
    const selectedSet = new Set((selectedIds || []).map((id) => String(id)));
    const normalizedQuery = query.trim().toLowerCase();

    return members
      .filter((member) => !selectedSet.has(String(member.id)))
      .filter((member) => {
        if (!normalizedQuery) return true;
        return String(member.name || "")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .slice(0, 8);
  }, [members, selectedIds, query]);

  function addMember(memberId) {
    const next = [
      ...new Set([...(selectedIds || []).map(String), String(memberId)]),
    ];
    onChange(next);
    setQuery("");
    setIsOpen(true);
  }

  function removeMember(memberId) {
    const next = (selectedIds || [])
      .map(String)
      .filter((id) => String(id) !== String(memberId));
    onChange(next);
  }

  return (
    <div className="assignee-picker">
      <div className="assignee-picker__badges">
        {selectedMembers.length > 0 ? (
          selectedMembers.map((member) => (
            <span key={member.id} className="assignee-badge">
              {member.name}
              <button
                type="button"
                className="assignee-badge__remove"
                onClick={() => removeMember(member.id)}
                aria-label={`Remove ${member.name}`}
              >
                <X size={12} />
              </button>
            </span>
          ))
        ) : (
          <span className="assignee-picker__empty">
            No members selected yet.
          </span>
        )}
      </div>

      <div className="assignee-picker__input-wrap">
        <Search size={14} />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 120);
          }}
          placeholder={placeholder}
          className="assignee-picker__input"
          onKeyDown={(event) => {
            if (event.key === "Enter" && suggestions.length > 0) {
              event.preventDefault();
              addMember(suggestions[0].id);
            }
          }}
        />
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="assignee-picker__suggestions">
          {suggestions.map((member) => (
            <button
              key={member.id}
              type="button"
              className="assignee-picker__option"
              onMouseDown={(event) => {
                event.preventDefault();
                addMember(member.id);
              }}
            >
              {member.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
