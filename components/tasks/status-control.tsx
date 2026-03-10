"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { getAllowedTaskTransitions } from "@/lib/task-permissions";
import { taskStatusMeta } from "@/lib/task-presentation";
import type { TaskStatus } from "@/lib/types";
import { enqueueAction } from "@/lib/offline/queue";

type Props = {
  taskId: string;
  currentStatus: TaskStatus;
  canEdit: boolean;
  canArchive?: boolean;
};

export function StatusControl({ taskId, currentStatus, canEdit, canArchive = false }: Props) {
  const [status, setStatus] = useState<TaskStatus>(currentStatus);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [pauseResumeAt, setPauseResumeAt] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const allowedTransitions = getAllowedTaskTransitions(status);

  async function submit(nextStatus: TaskStatus) {
    setMessage(null);
    if (!canEdit) return;
    if (nextStatus === "paused") {
      setPauseOpen(true);
      return;
    }

    if (!navigator.onLine) {
      await enqueueAction({
        id: crypto.randomUUID(),
        type: "update_status",
        taskId,
        status: nextStatus,
        createdAt: new Date().toISOString()
      });
      setStatus(nextStatus);
      setMessage("Изменение сохранено в очередь и будет синхронизировано при появлении сети.");
      return;
    }

    const response = await fetch(`/api/tasks/${taskId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    if (!response.ok) {
      setMessage("Не удалось изменить статус");
      return;
    }

    setStatus(nextStatus);
    router.refresh();
  }

  async function submitPause() {
    setMessage(null);
    if (!canEdit) return;

    const reason = pauseReason.trim();
    if (reason.length < 5) {
      setMessage("Укажите причину паузы (минимум 5 символов).");
      return;
    }

    const resumeDate = new Date(pauseResumeAt);
    if (!pauseResumeAt || Number.isNaN(resumeDate.getTime()) || resumeDate.getTime() <= Date.now()) {
      setMessage("Укажите корректную дату восстановления в будущем.");
      return;
    }

    if (!navigator.onLine) {
      setMessage("Для постановки на паузу требуется сеть.");
      return;
    }

    const response = await fetch(`/api/tasks/${taskId}/pause`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, resumeAt: resumeDate.toISOString() })
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setMessage(payload.error ?? "Не удалось поставить задачу на паузу");
      return;
    }

    setStatus("paused");
    setPauseOpen(false);
    setPauseReason("");
    setPauseResumeAt("");
    router.refresh();
  }

  async function submitArchive() {
    setMessage(null);
    if (!canArchive) return;
    if (!window.confirm("Перенести задачу в архив? Это действие нельзя отменить.")) return;
    if (!navigator.onLine) {
      setMessage("Для архивации нужна сеть.");
      return;
    }
    const response = await fetch(`/api/tasks/${taskId}/archive`, { method: "POST" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setMessage(payload.error ?? "Не удалось архивировать задачу");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <div className="grid sc-grid">
        <div className="status-switch">
          {(["new", "accepted", "in_progress", "paused", "done"] as TaskStatus[]).map((option) => {
            const isActive = status === option;
            const isAllowed = allowedTransitions.includes(option);
            return (
              <button
                key={option}
                className={`status-switch-btn${isActive ? " active" : ""}${!isActive && !isAllowed ? " sc-btn--unavailable" : ""}`}
                type="button"
                disabled={!canEdit || pending || isActive || !isAllowed}
                onClick={() => {
                  if (option !== "paused") setStatus(option);
                  startTransition(() => void submit(option));
                }}
                title={isActive ? "Текущий статус" : undefined}
              >
                {taskStatusMeta[option].label}
              </button>
            );
          })}
        </div>
        {canArchive ? (
          <div className="sc-archive-row">
            <button
              className="sc-archive-btn"
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => void submitArchive())}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="21 8 21 21 3 21 3 8"/>
                <rect x="1" y="3" width="22" height="5"/>
                <line x1="10" y1="12" x2="14" y2="12"/>
              </svg>
              В архив
            </button>
          </div>
        ) : null}
        {message ? <div className="text-soft sc-message">{message}</div> : null}
      </div>
      <Modal open={pauseOpen} title="Поставить задачу на паузу" onClose={() => setPauseOpen(false)}>
        <div className="grid">
          <textarea
            className="input"
            rows={4}
            value={pauseReason}
            onChange={(event) => setPauseReason(event.target.value)}
            placeholder="Причина паузы (обязательно)"
          />
          <input
            className="input"
            type="datetime-local"
            value={pauseResumeAt}
            onChange={(event) => setPauseResumeAt(event.target.value)}
          />
          <div className="row">
            <button className="btn btn-ghost" type="button" onClick={() => setPauseOpen(false)}>
              Отмена
            </button>
            <button className="btn btn-accent" type="button" onClick={() => startTransition(() => void submitPause())}>
              Поставить на паузу
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
