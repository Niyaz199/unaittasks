"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import type { Route } from "next";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { canChangeStatus } from "@/lib/task-permissions";
import type { Role, TaskItem, TaskStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { taskPriorityMeta, taskStatusMeta } from "@/lib/task-presentation";
import { sortTasks, isOverdue, isDueToday, type SortMode } from "@/lib/task-sort";
import { enqueueAction } from "@/lib/offline/queue";
import type { TaskActionMenuProps } from "@/components/tasks/task-action-menu";

// Меню действий + Modal грузятся лениво: они нужны только при взаимодействии
const TaskActionMenu = dynamic<TaskActionMenuProps>(
  () => import("@/components/tasks/task-action-menu").then((m) => m.TaskActionMenu),
  { ssr: false }
);

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function resolveAssignee(task: TaskItem): string {
  const raw = task.assignee as { full_name: string } | Array<{ full_name: string }> | null | undefined;
  if (Array.isArray(raw)) return raw[0]?.full_name ?? "Не назначен";
  return raw?.full_name ?? "Не назначен";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function urgencyLabel(task: TaskItem): { text: string; level: "overdue" | "today" | null } {
  if (task.status === "done") return { text: "", level: null };
  if (isOverdue(task)) {
    const diff = Date.now() - new Date(task.due_at!).getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    const text = days > 0 ? `Просрочено на ${days}д` : `Просрочено на ${hours}ч`;
    return { text, level: "overdue" };
  }
  if (isDueToday(task)) {
    return { text: `Сегодня до ${formatTime(task.due_at!)}`, level: "today" };
  }
  return { text: "", level: null };
}

type GroupBy = "none" | "object" | "status";

function groupTasks(tasks: TaskItem[], groupBy: GroupBy): Array<{ key: string; label: string; tasks: TaskItem[] }> {
  if (groupBy === "none") return [{ key: "all", label: "", tasks }];

  const groups = new Map<string, { label: string; tasks: TaskItem[] }>();

  if (groupBy === "object") {
    for (const task of tasks) {
      const key = task.object_id;
      const label = task.objects?.name ?? "Без объекта";
      if (!groups.has(key)) groups.set(key, { label, tasks: [] });
      groups.get(key)!.tasks.push(task);
    }
  } else if (groupBy === "status") {
    const statusOrder: TaskStatus[] = ["in_progress", "new", "paused", "done"];
    const statusLabels: Record<TaskStatus, string> = {
      in_progress: "В работе",
      new: "Новые",
      paused: "На паузе",
      done: "Выполненные"
    };
    for (const status of statusOrder) {
      const matching = tasks.filter((t) => t.status === status);
      if (matching.length) groups.set(status, { label: statusLabels[status], tasks: matching });
    }
  }

  return Array.from(groups.entries()).map(([key, val]) => ({ key, label: val.label, tasks: val.tasks }));
}

function TaskCard({
  task,
  showTakeButton,
  currentUser
}: {
  task: TaskItem;
  showTakeButton?: boolean;
  currentUser?: { id: string; role: Role };
}) {
  const assigneeName = resolveAssignee(task);
  const urgency = urgencyLabel(task);
  const status = taskStatusMeta[task.status];
  const priority = taskPriorityMeta[task.priority];
  const isDone = task.status === "done";
  const teamMemberIds = (task.team_members ?? []).map((m) => m.user_id);

  const canTakeInWork = (() => {
    if (!showTakeButton || !currentUser || task.status !== "new") return false;
    return canChangeStatus(task, currentUser, { teamMemberIds });
  })();

  return (
    <div className={`tl-card${urgency.level === "overdue" ? " tl-card--overdue" : ""}${urgency.level === "today" ? " tl-card--today" : ""}${isDone ? " tl-card--done" : ""}`}>
      {urgency.level === "overdue" ? <div className="tl-card-urgency-bar" aria-hidden="true" /> : null}

      <Link className="tl-card-inner" href={`/tasks/${task.id}` as Route} prefetch={false}>
        <div className="tl-card-main">
          <div className="tl-card-header">
            <span className={`tl-card-title${isDone ? " tl-card-title--done" : ""}`}>{task.title}</span>
            {urgency.level ? (
              <span className={`tl-urgency-badge tl-urgency-badge--${urgency.level}`}>{urgency.text}</span>
            ) : null}
          </div>

          <div className="tl-card-sub">
            <span className="tl-card-object">{task.objects?.name ?? "Без объекта"}</span>
            <span className="tl-card-dot" aria-hidden="true">•</span>
            <span className="tl-card-assignee">
              <span className="tl-assignee-avatar" aria-hidden="true">{getInitials(assigneeName)}</span>
              <span>{assigneeName}</span>
            </span>
          </div>

          <div className="tl-card-footer">
            <Badge tone={status.tone}>{status.label}</Badge>
            <Badge tone={priority.tone}>{priority.label}</Badge>
            {task.due_at ? (
              <span className="tl-due-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {new Date(task.due_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
              </span>
            ) : (
              <span className="tl-due-label tl-due-label--none">Без срока</span>
            )}
            {task.status === "paused" && task.resume_at ? (
              <span className="tl-paused-label">
                Пауза до {new Date(task.resume_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
              </span>
            ) : null}
          </div>
        </div>

        <div className="tl-card-aside" onClick={(e) => e.preventDefault()}>
          {currentUser ? <TaskActionMenu task={task} currentUser={currentUser} /> : null}
        </div>
      </Link>

      {canTakeInWork ? (
        <div className="tl-card-take-row">
          <TakeInWorkButton taskId={task.id} />
        </div>
      ) : null}
    </div>
  );
}

function TakeInWorkButton({ taskId }: { taskId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function handle() {
    if (!navigator.onLine) {
      await enqueueAction({
        id: crypto.randomUUID(),
        type: "update_status",
        taskId,
        status: "in_progress",
        createdAt: new Date().toISOString()
      });
      router.refresh();
      return;
    }
    const res = await fetch(`/api/tasks/${taskId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_progress" })
    });
    if (res.ok) router.refresh();
  }

  return (
    <button
      className="btn btn-accent tl-take-btn"
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void handle())}
    >
      В работу
    </button>
  );
}

function GroupSection({ groupKey, label, tasks, showTakeButton, currentUser, defaultOpen }: {
  groupKey: string;
  label: string;
  tasks: TaskItem[];
  showTakeButton?: boolean;
  currentUser?: { id: string; role: Role };
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  if (!label) {
    return (
      <>
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} showTakeButton={showTakeButton} currentUser={currentUser} />
        ))}
      </>
    );
  }
  return (
    <div className="tl-group">
      <button
        className="tl-group-header"
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="tl-group-label">{label}</span>
        <span className="tl-group-count">{tasks.length}</span>
        <span className={`tl-group-chevron${open ? " tl-group-chevron--open" : ""}`} aria-hidden="true">›</span>
      </button>
      {open ? (
        <div className="tl-group-body">
          {tasks.map((task) => (
            <TaskCard key={`${groupKey}-${task.id}`} task={task} showTakeButton={showTakeButton} currentUser={currentUser} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TaskList({
  tasks,
  showTakeButton,
  currentUser,
  clientSort = "smart",
  groupBy = "none"
}: {
  tasks: TaskItem[];
  showTakeButton?: boolean;
  currentUser?: { id: string; role: Role };
  clientSort?: SortMode;
  groupBy?: GroupBy;
}) {
  const sorted = useMemo(() => sortTasks(tasks, clientSort), [tasks, clientSort]);
  const groups = useMemo(() => groupTasks(sorted, groupBy), [sorted, groupBy]);

  if (!tasks.length) {
    return (
      <EmptyState
        message="Задачи не найдены"
        hint="Измените фильтры или создайте новую задачу, если это разрешено вашей ролью."
      />
    );
  }

  return (
    <div className="tl-list">
      {groups.map((group) => (
        <GroupSection
          key={group.key}
          groupKey={group.key}
          label={group.label}
          tasks={group.tasks}
          showTakeButton={showTakeButton}
          currentUser={currentUser}
          defaultOpen={true}
        />
      ))}
    </div>
  );
}
