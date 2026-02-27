import type { TaskItem } from "@/lib/types";

export type SortMode = "smart" | "due_asc" | "due_desc" | "created_desc";

function priorityWeight(priority: TaskItem["priority"]): number {
  switch (priority) {
    case "critical": return 0;
    case "high": return 1;
    case "medium": return 2;
    case "low": return 3;
    default: return 4;
  }
}

function isOverdue(task: TaskItem): boolean {
  if (!task.due_at || task.status === "done") return false;
  return new Date(task.due_at) < new Date();
}

function isDueToday(task: TaskItem): boolean {
  if (!task.due_at || task.status === "done") return false;
  const now = new Date();
  const due = new Date(task.due_at);
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate() &&
    due >= now
  );
}

function smartGroup(task: TaskItem): number {
  if (task.status === "done") return 6;
  if (isOverdue(task)) return 0;
  if (isDueToday(task)) return 1;
  if (task.priority === "critical") return 2;
  if (task.priority === "high") return 3;
  if (task.priority === "medium") return 4;
  return 5;
}

export function smartSortTasks(tasks: TaskItem[]): TaskItem[] {
  return [...tasks].sort((a, b) => {
    const ga = smartGroup(a);
    const gb = smartGroup(b);
    if (ga !== gb) return ga - gb;

    // Within overdue: critical/high first, then by how overdue
    if (ga === 0) {
      const pa = priorityWeight(a.priority);
      const pb = priorityWeight(b.priority);
      if (pa !== pb) return pa - pb;
      return new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime();
    }
    // Within today: by deadline time
    if (ga === 1) {
      return new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime();
    }
    // Within critical/high/medium/low: by due_at then created_at
    if (a.due_at && b.due_at) {
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    }
    if (a.due_at) return -1;
    if (b.due_at) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function sortTasks(tasks: TaskItem[], mode: SortMode): TaskItem[] {
  if (mode === "smart") return smartSortTasks(tasks);
  if (mode === "due_asc") {
    return [...tasks].sort((a, b) => {
      if (!a.due_at && !b.due_at) return 0;
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    });
  }
  if (mode === "due_desc") {
    return [...tasks].sort((a, b) => {
      if (!a.due_at && !b.due_at) return 0;
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(b.due_at).getTime() - new Date(a.due_at).getTime();
    });
  }
  if (mode === "created_desc") {
    return [...tasks].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  return tasks;
}

export { isOverdue, isDueToday };
