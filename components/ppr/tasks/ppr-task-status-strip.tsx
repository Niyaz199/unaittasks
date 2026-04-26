"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PprTaskCloseWriteoffDialog } from "@/components/ppr/tasks/ppr-task-close-writeoff-dialog";
import { resumePprTaskAction } from "@/app/actions/ppr-task-actions";

type Status = "new" | "in_progress" | "on_hold" | "done" | "closed" | "cancelled";

type StockItemBrief = {
  id: string;
  name: string;
  unit: string;
  kind: "zip" | "component";
  current_qty: number;
};

type WriteoffComponent = {
  id: string;
  stock_item_id: string;
  quantity: number;
  is_critical: boolean;
  stock_item: StockItemBrief | StockItemBrief[] | null;
};

type Props = {
  taskId: string;
  status: Status;
  assigneeName: string | null;
  commentsCount: number;
  closedAt: string | null;
  cancelledAt: string | null;
  heldAt?: string | null;
  holdReason?: string | null;
  holdPurchaseRequest?: { id: string; status: "new" | "in_progress" | "fulfilled" | "cancelled" } | null;
  permissions: {
    canStart: boolean;
    canComplete: boolean;
    canClose: boolean;
    canResume: boolean;
  };
  writeoffComponents?: WriteoffComponent[];
};

type ToneKey = "info" | "warning" | "success" | "neutral" | "danger";

const toneColor: Record<ToneKey, { fg: string; accent: string }> = {
  info: { fg: "var(--info, #3b82f6)", accent: "var(--info, #3b82f6)" },
  warning: { fg: "var(--warning, #f59e0b)", accent: "var(--warning, #f59e0b)" },
  success: { fg: "var(--success, #10b981)", accent: "var(--success, #10b981)" },
  neutral: { fg: "var(--text-soft, #94a3b8)", accent: "var(--text-soft, #94a3b8)" },
  danger: { fg: "var(--danger, #ef4444)", accent: "var(--danger, #ef4444)" },
};

function PlayIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="6 4 20 12 6 20 6 4" fill="currentColor" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 12 10 18 20 6" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </svg>
  );
}
function WrenchIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6a2 2 0 1 0 2.8 2.8l6-6a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.8-2.8 2.4-2.4Z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" />
      <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" />
    </svg>
  );
}
function CrossIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

function formatDate(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU");
}

export function PprTaskStatusStrip({
  taskId,
  status,
  assigneeName,
  commentsCount,
  closedAt,
  cancelledAt,
  heldAt,
  holdReason,
  holdPurchaseRequest,
  permissions,
  writeoffComponents = [],
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [writeoffOpen, setWriteoffOpen] = useState(false);

  // Determine current state
  let tone: ToneKey = "neutral";
  let icon = <ClockIcon />;
  let title = "";
  let hint = "";
  let cta: { label: string; onClick: () => void; disabled?: boolean; disabledHint?: string } | null = null;

  async function postStatus(nextStatus: "in_progress" | "done") {
    setError(null);
    const response = await fetch(`/api/ppr/tasks/${taskId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(result.error ?? "Не удалось выполнить действие");
    }
    router.refresh();
  }

  if (status === "new") {
    tone = "info";
    icon = <PlayIcon />;
    title = "Следующий шаг";
    if (permissions.canStart) {
      hint = "Начните выполнение работ и отметьте заявку в работе.";
      cta = {
        label: "В работу",
        onClick: () =>
          startTransition(async () => {
            try {
              await postStatus("in_progress");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Не удалось перевести в работу");
            }
          }),
      };
    } else {
      hint = assigneeName
        ? `Ожидает запуска исполнителем: ${assigneeName}.`
        : "Назначьте исполнителя — он переведёт заявку в работу.";
    }
  } else if (status === "in_progress") {
    tone = "warning";
    icon = <WrenchIcon />;
    title = "Заявка в работе";
    if (permissions.canComplete) {
      const hasComment = commentsCount > 0;
      hint = hasComment
        ? "Проверьте отчёт и отметьте заявку выполненной."
        : "Добавьте хотя бы один комментарий, затем отметьте выполненной.";
      cta = {
        label: "Отметить выполненной",
        disabled: !hasComment,
        disabledHint: "Сначала добавьте комментарий в разделе «Отчёт»",
        onClick: () =>
          startTransition(async () => {
            try {
              await postStatus("done");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Не удалось завершить заявку");
            }
          }),
      };
    } else {
      hint = assigneeName
        ? `Выполняет: ${assigneeName}.`
        : "Заявка выполняется.";
    }
  } else if (status === "on_hold") {
    tone = "warning";
    icon = <PauseIcon />;
    title = "Заявка на паузе";
    const since = heldAt ? `с ${formatDate(heldAt)}` : "";
    const reasonPart = holdReason ? `Причина: ${holdReason}` : "Причина не указана";
    const prHint =
      holdPurchaseRequest && (holdPurchaseRequest.status === "fulfilled" || holdPurchaseRequest.status === "cancelled")
        ? holdPurchaseRequest.status === "fulfilled"
          ? " Связанная заявка на закупку выполнена — можно возобновлять."
          : " Связанная заявка на закупку отменена — проверьте и возобновите или отмените ППР."
        : holdPurchaseRequest
          ? " Ожидает заявку на закупку."
          : "";
    hint = `${reasonPart}. ${since}${since ? ". " : ""}${prHint}`.trim();
    if (permissions.canResume) {
      cta = {
        label: "Возобновить",
        onClick: () =>
          startTransition(async () => {
            try {
              setError(null);
              const formData = new FormData();
              formData.set("task_id", taskId);
              await resumePprTaskAction(formData);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Не удалось возобновить заявку");
            }
          }),
      };
    }
  } else if (status === "done") {
    tone = "success";
    icon = <CheckIcon />;
    if (permissions.canClose) {
      title = "Работы выполнены";
      hint = "Проверьте отчёт и закройте заявку.";
      cta = {
        label: "Закрыть заявку",
        onClick: () => {
          setError(null);
          setWriteoffOpen(true);
        },
      };
    } else {
      title = "Работы выполнены";
      hint = "Заявка ожидает закрытия ответственным.";
    }
  } else if (status === "closed") {
    tone = "neutral";
    icon = <LockIcon />;
    title = "Заявка закрыта";
    hint = closedAt ? `Закрыта ${formatDate(closedAt)}.` : "Заявка закрыта.";
  } else if (status === "cancelled") {
    tone = "danger";
    icon = <CrossIcon />;
    title = "Заявка отменена";
    hint = cancelledAt ? `Отменена ${formatDate(cancelledAt)}.` : "Заявка отменена.";
  }

  const c = toneColor[tone];

  return (
    <div
      className="section-card"
      style={{
        padding: "1.25rem 1.5rem",
        marginBottom: "1rem",
        borderLeft: `4px solid ${c.accent}`,
        background: `color-mix(in srgb, ${c.accent} 8%, var(--panel, transparent))`,
        display: "grid",
        gap: "0.85rem",
      }}
      role="status"
      aria-live="polite"
    >
      <div
        className="row"
        style={{
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            background: `color-mix(in srgb, ${c.accent} 18%, transparent)`,
            color: c.fg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          {icon}
        </div>

        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <div
            className="text-soft"
            style={{
              fontSize: "0.7rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: "0.15rem",
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 500, lineHeight: 1.4 }}>{hint}</div>
        </div>

        {cta ? (
          <button
            type="button"
            className="btn btn-accent"
            onClick={cta.onClick}
            disabled={pending || cta.disabled}
            title={cta.disabled ? cta.disabledHint : undefined}
            style={{
              padding: "0.75rem 1.4rem",
              fontSize: "0.95rem",
              fontWeight: 600,
              minHeight: "44px",
            }}
          >
            {pending ? "..." : cta.label}
          </button>
        ) : null}
      </div>

      {error ? (
        <div
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: "6px",
            background: "color-mix(in srgb, var(--danger) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
            color: "var(--danger)",
            fontSize: "0.85rem",
          }}
        >
          {error}
        </div>
      ) : null}

      <PprTaskCloseWriteoffDialog
        taskId={taskId}
        open={writeoffOpen}
        onClose={() => setWriteoffOpen(false)}
        components={writeoffComponents}
      />
    </div>
  );
}
