"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PprTaskAssigneeCandidateRow } from "@/lib/ppr/queries";
import { pausePprTaskAction } from "@/app/actions/ppr-task-actions";

type PurchaseRequestOption = {
  id: string;
  status: "new" | "in_progress" | "fulfilled" | "cancelled";
  description: string | null;
  created_at: string;
};

type Props = {
  taskId: string;
  currentAssigneeId: string | null;
  plannedFor: string;
  canAssign: boolean;
  canCancel: boolean;
  canReschedule: boolean;
  canPause?: boolean;
  assigneeCandidates: PprTaskAssigneeCandidateRow[];
  pauseLinkableRequests?: PurchaseRequestOption[];
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
  canPause = false,
  assigneeCandidates,
  pauseLinkableRequests = [],
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState(currentAssigneeId ?? "");
  const [rescheduleDate, setRescheduleDate] = useState(plannedFor);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [pauseReason, setPauseReason] = useState("");
  const [pausePurchaseRequestId, setPausePurchaseRequestId] = useState("");

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

  if (!canAssign && !canCancel && !canReschedule && !canPause) {
    return <div className="text-soft">Служебные действия по этой ППР-заявке для текущей роли недоступны.</div>;
  }

  const needsAssignee = !currentAssigneeId;

  const summaryStyle: React.CSSProperties = {
    cursor: "pointer",
    listStyle: "none",
    userSelect: "none",
    padding: "0.5rem 0.7rem",
    fontSize: "0.88rem",
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
  };
  const blockStyle: React.CSSProperties = {
    borderRadius: "8px",
    border: "1px solid color-mix(in srgb, var(--line) 40%, transparent)",
    background: "color-mix(in srgb, var(--panel-soft) 30%, transparent)",
    overflow: "hidden",
  };

  return (
    <div className="grid" style={{ gap: "0.5rem" }}>
      {canAssign ? (
        <details open={needsAssignee} style={blockStyle}>
          <summary style={summaryStyle}>
            <span>Исполнитель</span>
            <span className="text-soft" style={{ fontWeight: 400, fontSize: "0.82rem" }}>▾</span>
          </summary>
          <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap", padding: "0 0.7rem 0.7rem" }}>
            <select className="select" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} style={{ flex: "1 1 220px" }}>
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
              Сохранить
            </button>
          </div>
        </details>
      ) : null}

      {canReschedule ? (
        <details style={blockStyle}>
          <summary style={summaryStyle}>
            <span>Перенос плановой даты</span>
            <span className="text-soft" style={{ fontWeight: 400, fontSize: "0.82rem" }}>▾</span>
          </summary>
          <div className="grid" style={{ gap: "0.5rem", padding: "0 0.7rem 0.7rem" }}>
            <div className="text-soft" style={{ fontSize: "0.82rem" }}>
              Перенос допускается только внутри текущего месяца.
            </div>
            <input
              className="input"
              type="date"
              value={rescheduleDate}
              onChange={(event) => setRescheduleDate(event.target.value)}
            />
            <textarea
              className="input"
              rows={2}
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
        </details>
      ) : null}

      {canPause ? (
        <details style={{ ...blockStyle, borderColor: "color-mix(in srgb, var(--warning, #f59e0b) 30%, transparent)" }}>
          <summary style={{ ...summaryStyle, color: "var(--warning, #f59e0b)" }}>
            <span>Поставить на паузу</span>
            <span className="text-soft" style={{ fontWeight: 400, fontSize: "0.82rem" }}>▾</span>
          </summary>
          <div className="grid" style={{ gap: "0.5rem", padding: "0 0.7rem 0.7rem" }}>
            <p className="text-soft" style={{ margin: 0, fontSize: "0.82rem" }}>
              Заявка приостановится. Возобновить можно будет в любой момент с той же карточки.
            </p>
            <textarea
              className="input"
              rows={2}
              value={pauseReason}
              onChange={(event) => setPauseReason(event.target.value)}
              placeholder="Причина паузы (обязательно)"
            />
            {pauseLinkableRequests.length > 0 ? (
              <label className="grid" style={{ gap: "0.25rem" }}>
                <span className="text-soft" style={{ fontSize: "0.82rem" }}>
                  Связать с заявкой на закупку (необязательно)
                </span>
                <select
                  className="select"
                  value={pausePurchaseRequestId}
                  onChange={(event) => setPausePurchaseRequestId(event.target.value)}
                >
                  <option value="">Не связывать</option>
                  {pauseLinkableRequests.map((pr) => {
                    const label = pr.description
                      ? pr.description.slice(0, 60)
                      : `Заявка от ${new Date(pr.created_at).toLocaleDateString("ru-RU")}`;
                    return (
                      <option key={pr.id} value={pr.id}>
                        {label} — {pr.status === "fulfilled" ? "выполнена" : pr.status === "cancelled" ? "отменена" : pr.status === "in_progress" ? "в работе" : "новая"}
                      </option>
                    );
                  })}
                </select>
              </label>
            ) : null}
            <div className="row">
              <button
                className="btn"
                type="button"
                disabled={pending || !pauseReason.trim()}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      setMessage(null);
                      const formData = new FormData();
                      formData.set("task_id", taskId);
                      formData.set("reason", pauseReason);
                      if (pausePurchaseRequestId) {
                        formData.set("purchase_request_id", pausePurchaseRequestId);
                      }
                      await pausePprTaskAction(formData);
                      setPauseReason("");
                      setPausePurchaseRequestId("");
                      setMessage("ППР-заявка поставлена на паузу.");
                      router.refresh();
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : "Не удалось поставить на паузу");
                    }
                  });
                }}
              >
                Поставить на паузу
              </button>
            </div>
          </div>
        </details>
      ) : null}

      {canCancel ? (
        <details style={{ ...blockStyle, borderColor: "color-mix(in srgb, var(--danger) 25%, transparent)" }}>
          <summary style={{ ...summaryStyle, color: "var(--danger)" }}>
            <span>Отменить заявку</span>
            <span className="text-soft" style={{ fontWeight: 400, fontSize: "0.82rem" }}>▾</span>
          </summary>
          <div className="grid" style={{ gap: "0.5rem", padding: "0 0.7rem 0.7rem" }}>
            <p className="text-soft" style={{ margin: 0, fontSize: "0.82rem" }}>
              Действие необратимо. Заявка будет переведена в статус «Отменена».
            </p>
            <textarea
              className="input"
              rows={2}
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
        </details>
      ) : null}

      {message ? (
        <div
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: "6px",
            fontSize: "0.85rem",
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
