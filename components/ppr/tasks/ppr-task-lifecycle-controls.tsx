"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PprTaskAssigneeCandidateRow } from "@/lib/ppr/queries";

type Props = {
  taskId: string;
  currentAssigneeId: string | null;
  plannedFor: string;
  canAssign: boolean;
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
  currentAssigneeId,
  plannedFor,
  canAssign,
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

  if (!canAssign && !canCancel && !canReschedule) {
    return <div className="text-soft">Служебные действия по этой ППР-заявке для текущей роли недоступны.</div>;
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
        <div className="grid" style={{ gap: "0.5rem", borderTop: "1px solid color-mix(in srgb, var(--danger) 20%, transparent)", paddingTop: "1rem", marginTop: "0.5rem" }}>
          <div className="grid" style={{ gap: "0.25rem" }}>
            <strong style={{ color: "var(--danger)" }}>Отмена заявки</strong>
            <p className="text-soft" style={{ margin: 0, fontSize: "0.85rem" }}>
              Это действие необратимо. Заявка будет переведена в статус «Отменена».
            </p>
          </div>
          <textarea
            className="input"
            rows={3}
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Укажите причину отмены (обязательно)"
          />
          <div className="row">
            <button
              className="btn btn-danger"
              type="button"
              disabled={pending || !cancelReason.trim()}
              onClick={() => {
                if (!window.confirm("Вы уверены, что хотите отменить эту ППР-заявку? Действие необратимо.")) return;
                startTransition(async () => {
                  try {
                    setMessage(null);
                    await postJson(`/api/ppr/tasks/${taskId}/cancel`, { reason: cancelReason });
                    setMessage("ППР-заявка отменена.");
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Не удалось отменить заявку");
                  }
                });
              }}
            >
              Отменить заявку
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <div
          style={{
            padding: "0.65rem 1rem",
            borderRadius: "8px",
            fontSize: "0.9rem",
            background: message.includes("не удалось") || message.includes("Не удалось")
              ? "color-mix(in srgb, var(--danger) 12%, transparent)"
              : "color-mix(in srgb, var(--success) 12%, transparent)",
            border: `1px solid ${message.includes("не удалось") || message.includes("Не удалось")
              ? "color-mix(in srgb, var(--danger) 30%, transparent)"
              : "color-mix(in srgb, var(--success) 30%, transparent)"}`,
            color: message.includes("не удалось") || message.includes("Не удалось")
              ? "var(--danger)"
              : "var(--success)",
          }}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}
