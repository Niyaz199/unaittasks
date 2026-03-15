"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closePprTaskAction } from "@/app/actions/ppr-task-actions";
import type { PprTaskAssigneeCandidateRow } from "@/lib/ppr/queries";

type Props = {
  taskId: string;
  currentStatus: "new" | "in_progress" | "done" | "closed" | "cancelled";
  currentAssigneeId: string | null;
  plannedFor: string;
  canAssign: boolean;
  canStart: boolean;
  canComplete: boolean;
  canClose: boolean;
  canCancel: boolean;
  canReschedule: boolean;
  assigneeCandidates: PprTaskAssigneeCandidateRow[];
};

function roleLabel(role: PprTaskAssigneeCandidateRow["role"]) {
  if (role === "object_engineer") return "объектовый инженер";
  if (role === "engineer") return "инженер";
  return "техник";
}

export function PprTaskLifecycleControls({
  taskId,
  currentStatus,
  currentAssigneeId,
  plannedFor,
  canAssign,
  canStart,
  canComplete,
  canClose,
  canCancel,
  canReschedule,
  assigneeCandidates,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState(currentAssigneeId ?? "");
  const [rescheduleDate, setRescheduleDate] = useState(plannedFor);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  async function postJson(url: string, payload: Record<string, unknown>) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(result.error ?? "Не удалось выполнить действие");
    }

    router.refresh();
  }

  if (!canAssign && !canStart && !canComplete && !canClose && !canCancel && !canReschedule) {
    return <div className="text-soft">Для текущей роли lifecycle-действия по этой ППР-заявке недоступны.</div>;
  }

  return (
    <div className="grid" style={{ gap: "1rem" }}>
      {canAssign ? (
        <div className="grid" style={{ gap: "0.5rem" }}>
          <strong>Исполнитель</strong>
          <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            <select className="select" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
              <option value="">Без исполнителя</option>
              {assigneeCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.full_name} ({roleLabel(candidate.role)})
                </option>
              ))}
            </select>
            <button
              className="btn btn-accent"
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    setMessage(null);
                    await postJson(`/api/ppr/tasks/${taskId}/assign`, { assigneeId: assigneeId || null });
                    setMessage("Исполнитель обновлен.");
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Не удалось назначить исполнителя");
                  }
                })
              }
            >
              Сохранить исполнителя
            </button>
          </div>
        </div>
      ) : null}

      {(canStart || canComplete || canClose) ? (
        <div className="grid" style={{ gap: "0.5rem" }}>
          <strong>Статус</strong>
          <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            {canStart ? (
              <button
                className="btn btn-accent"
                type="button"
                disabled={pending || currentStatus !== "new"}
                onClick={() =>
                  startTransition(async () => {
                    try {
                      setMessage(null);
                      await postJson(`/api/ppr/tasks/${taskId}/status`, { status: "in_progress" });
                      setMessage("ППР-заявка переведена в работу.");
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : "Не удалось перевести заявку в работу");
                    }
                  })
                }
              >
                В работу
              </button>
            ) : null}

            {canComplete ? (
              <button
                className="btn btn-accent"
                type="button"
                disabled={pending || currentStatus !== "in_progress"}
                onClick={() =>
                  startTransition(async () => {
                    try {
                      setMessage(null);
                      await postJson(`/api/ppr/tasks/${taskId}/status`, { status: "done" });
                      setMessage("ППР-заявка отмечена как выполненная.");
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : "Не удалось завершить заявку");
                    }
                  })
                }
              >
                Отметить выполненной
              </button>
            ) : null}

            {canClose ? (
              <button
                className="btn"
                type="button"
                disabled={pending || currentStatus !== "done"}
                onClick={() =>
                  startTransition(async () => {
                    try {
                      setMessage(null);
                      const formData = new FormData();
                      formData.set("task_id", taskId);
                      await closePprTaskAction(formData);
                      router.refresh();
                      setMessage("ППР-заявка закрыта.");
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : "Не удалось закрыть заявку");
                    }
                  })
                }
              >
                Закрыть
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {canReschedule ? (
        <div className="grid" style={{ gap: "0.5rem" }}>
          <strong>Перенос</strong>
          <div className="text-soft" style={{ fontSize: "0.85rem" }}>
            Перенос ППР-заявки допускается только внутри текущего месяца.
          </div>
          <input
            className="input"
            type="date"
            value={rescheduleDate}
            onChange={(event) => setRescheduleDate(event.target.value)}
          />
          <textarea
            className="input"
            rows={3}
            value={rescheduleReason}
            onChange={(event) => setRescheduleReason(event.target.value)}
            placeholder="Причина переноса"
          />
          <div className="row">
            <button
              className="btn"
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    setMessage(null);
                    await postJson(`/api/ppr/tasks/${taskId}/reschedule`, {
                      plannedFor: rescheduleDate,
                      reason: rescheduleReason,
                    });
                    setMessage("Плановая дата ППР-заявки изменена.");
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Не удалось перенести заявку");
                  }
                })
              }
            >
              Перенести
            </button>
          </div>
        </div>
      ) : null}

      {canCancel ? (
        <div className="grid" style={{ gap: "0.5rem" }}>
          <strong>Отмена</strong>
          <textarea
            className="input"
            rows={3}
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Причина отмены"
          />
          <div className="row">
            <button
              className="btn"
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    setMessage(null);
                    await postJson(`/api/ppr/tasks/${taskId}/cancel`, { reason: cancelReason });
                    setMessage("ППР-заявка отменена.");
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Не удалось отменить заявку");
                  }
                })
              }
            >
              Отменить заявку
            </button>
          </div>
        </div>
      ) : null}

      {message ? <div className="text-soft">{message}</div> : null}
    </div>
  );
}
