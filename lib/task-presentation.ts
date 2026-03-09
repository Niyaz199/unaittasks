import type { TaskPriority, TaskStatus } from "@/lib/types";

type Tone = "neutral" | "info" | "warning" | "success" | "danger" | "violet";

export const taskStatusMeta: Record<TaskStatus, { label: string; tone: Tone }> = {
  new: { label: "Новая", tone: "info" },
  in_progress: { label: "В работе", tone: "warning" },
  paused: { label: "Пауза", tone: "neutral" },
  done: { label: "Выполнена", tone: "success" }
};

/** Переводит raw-статус задачи в читаемый русский текст. Безопасно для неизвестных значений из audit_log. */
export function humanStatus(raw: string): string {
  return (taskStatusMeta as Record<string, { label: string }>)[raw]?.label ?? raw;
}

export const taskPriorityMeta: Record<TaskPriority, { label: string; tone: Tone }> = {
  low: { label: "Низкий", tone: "neutral" },
  medium: { label: "Средний", tone: "info" },
  high: { label: "Высокий", tone: "warning" },
  critical: { label: "Критический", tone: "danger" }
};
