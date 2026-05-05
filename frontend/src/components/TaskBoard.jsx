import TaskColumn from "./TaskColumn";

export const KANBAN_COLUMNS = [
  { key: "open", label: "TO DO" },
  { key: "in_progress", label: "IN PROGRESS" },
  { key: "review", label: "IN REVIEW" },
  { key: "dependence", label: "DEPENDENCE" },
  { key: "complete", label: "COMPLETED" },
];

export default function TaskBoard({
  tasks = [],
  onTaskClick = () => {},
  onTaskDragStart = () => {},
  onDropTask = () => {},
  onDragOverTask = () => {},
  fitColumns = false,
}) {
  const boardClass = fitColumns
    ? "kanban-board kanban-board--fit"
    : "kanban-board";

  return (
    <div className={boardClass}>
      {KANBAN_COLUMNS.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.key);

        return (
          <TaskColumn
            key={column.key}
            column={column}
            tasks={columnTasks}
            onTaskClick={onTaskClick}
            onTaskDragStart={onTaskDragStart}
            onDrop={onDropTask}
            onDragOver={onDragOverTask}
          />
        );
      })}
    </div>
  );
}
