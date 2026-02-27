"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { canChangeStatus } from "@/lib/task-permissions";
import type { Role, TaskItem, TaskStatus } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { enqueueAction } from "@/lib/offline/queue";

export type TaskActionMenuProps = {
  task: TaskItem;
  currentUser: { id: string; role: Role };
};

export function TaskActionMenu({ task, currentUser }: TaskActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [pauseResumeAt, setPauseResumeAt] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const teamMemberIds = (task.team_members ?? []).map((m) => m.user_id);
  const canEdit = canChangeStatus(task, currentUser, { teamMemberIds });

  const allowedActions = useMemo(() => {
    if (!canEdit) return [];
    const actions: Array<{ status: TaskStatus; label: string }> = [];
    if (task.status !== "in_progress") actions.push({ status: "in_progress", label: "В работу" });
    if (task.status === "in_progress") actions.push({ status: "paused", label: "Пауза" });
    if (task.status !== "done") actions.push({ status: "done", label: "Выполнить" });
    return actions;
  }, [canEdit, task.status]);

  if (!allowedActions.length) return null;

  async function changeStatus(nextStatus: TaskStatus) {
    setMessage(null);
    if (nextStatus === "paused") {
      setOpen(false);
      setPauseOpen(true);
      return;
    }
    if (!navigator.onLine) {
      await enqueueAction({
        id: crypto.randomUUID(),
        type: "update_status",
        taskId: task.id,
        status: nextStatus,
        createdAt: new Date().toISOString()
      });
      setOpen(false);
      setMessage("Сохранено в очередь офлайн.");
      router.refresh();
      return;
    }
    const res = await fetch(`/api/tasks/${task.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    setOpen(false);
    if (!res.ok) {
      setMessage("Не удалось изменить статус");
      return;
    }
    router.refresh();
  }

  async function submitPause() {
    setMessage(null);
    const reason = pauseReason.trim();
    if (reason.length < 5) { setMessage("Причина паузы минимум 5 символов"); return; }
    const resumeDate = new Date(pauseResumeAt);
    if (!pauseResumeAt || Number.isNaN(resumeDate.getTime()) || resumeDate.getTime() <= Date.now()) {
      setMessage("Укажите дату восстановления в будущем");
      return;
    }
    if (!navigator.onLine) { setMessage("Для паузы нужна сеть"); return; }
    const res = await fetch(`/api/tasks/${task.id}/pause`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, resumeAt: resumeDate.toISOString() })
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setMessage(data.error ?? "Не удалось поставить на паузу");
      return;
    }
    setPauseOpen(false);
    setPauseReason("");
    setPauseResumeAt("");
    router.refresh();
  }

  return (
    <>
      <div className="tl-action-menu-wrap">
        <button
          className="tl-action-btn"
          type="button"
          aria-label="Действия"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        >
          ⋯
        </button>
        {open ? (
          <>
            <div className="tl-action-backdrop" onClick={() => setOpen(false)} />
            <div className="tl-action-dropdown">
              {allowedActions.map((action) => (
                <button
                  key={action.status}
                  className="tl-action-item"
                  type="button"
                  disabled={pending}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); startTransition(() => void changeStatus(action.status)); }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
      {message ? <div className="tl-action-msg">{message}</div> : null}

      <Modal open={pauseOpen} title="Поставить задачу на паузу" onClose={() => setPauseOpen(false)}>
        <div className="grid">
          <textarea
            className="input"
            rows={3}
            value={pauseReason}
            onChange={(e) => setPauseReason(e.target.value)}
            placeholder="Причина паузы (обязательно)"
          />
          <input
            className="input"
            type="datetime-local"
            value={pauseResumeAt}
            onChange={(e) => setPauseResumeAt(e.target.value)}
          />
          {message ? <div className="text-soft">{message}</div> : null}
          <div className="row">
            <button className="btn btn-ghost" type="button" onClick={() => setPauseOpen(false)}>Отмена</button>
            <button className="btn btn-accent" type="button" onClick={() => startTransition(() => void submitPause())}>
              На паузу
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
