"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import type { TaskStatus } from "@/lib/types";
import { enqueueAction } from "@/lib/offline/queue";

type Props = {
  taskId: string;
  currentStatus: TaskStatus;
  canEdit: boolean;
};

export function StatusControl({ taskId, currentStatus, canEdit }: Props) {
  const [status, setStatus] = useState<TaskStatus>(currentStatus);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [pauseResumeAt, setPauseResumeAt] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

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

  return (
    <>
      <div className="grid">
        <div className="status-switch">
          {[
            { value: "new", label: "Новая" },
            { value: "in_progress", label: "В работе" },
            { value: "paused", label: "Пауза" },
            { value: "done", label: "Выполнена" }
          ].map((option) => (
            <button
              key={option.value}
              className={`status-switch-btn${status === option.value ? " active" : ""}`}
              type="button"
              disabled={!canEdit || pending || status === option.value}
              onClick={() => {
                const nextStatus = option.value as TaskStatus;
                if (nextStatus !== "paused") {
                  setStatus(nextStatus);
                }
                startTransition(() => void submit(nextStatus));
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        {message ? <div className="text-soft">{message}</div> : null}
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
