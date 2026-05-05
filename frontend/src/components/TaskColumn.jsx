import { Play } from "lucide-react";
import TaskCard from "./TaskCard";

export default function TaskColumn({
  column,
  tasks = [],
  onTaskClick = () => {},
  onTaskDragStart = () => {},
  onDrop = () => {},
  onDragOver = () => {},
}) {
  return (
    <section
      className="kanban-column"
      onDrop={(event) => onDrop(event, column.key)}
      onDragOver={onDragOver}
    >
      <header className="kanban-column__header">
        <div className="kanban-column__title">
          <Play size={12} fill="currentColor" strokeWidth={1.75} />
          <h4>{column.label}</h4>
        </div>
        <span className="kanban-column__count">{tasks.length}</span>
      </header>

      <div className="kanban-column__body">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={() => onTaskClick(task)}
            onDragStart={(event) => onTaskDragStart(event, task)}
          />
        ))}
      </div>
    </section>
  );
}
