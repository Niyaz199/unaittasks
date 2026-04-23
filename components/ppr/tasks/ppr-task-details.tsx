"use client";

import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { PprTaskStatusStrip } from "@/components/ppr/tasks/ppr-task-status-strip";
import type {
  PprTaskAttachmentWithUrl,
  PprTaskAssigneeCandidateRow,
  PprTaskCommentRow,
  PprTaskSummaryRow,
  PprTaskWorkItemRow,
} from "@/lib/ppr/queries";
import { pprTaskStatusMeta } from "@/lib/ppr/presentation";

const PprTaskLifecycleControls = dynamic(
  () => import("@/components/ppr/tasks/ppr-task-lifecycle-controls").then((module) => module.PprTaskLifecycleControls),
  {
    loading: () => <div className="section-card text-soft">Загрузка...</div>,
  }
);

const PprTaskCommentForm = dynamic(
  () => import("@/components/ppr/tasks/ppr-task-comment-form").then((module) => module.PprTaskCommentForm),
  {
    loading: () => <div className="section-card text-soft">Загрузка...</div>,
  }
);

const PprTaskAttachmentsGallery = dynamic(
  () => import("@/components/ppr/tasks/ppr-task-attachments-gallery").then((module) => module.PprTaskAttachmentsGallery),
  {
    loading: () => <div className="text-soft">Загружаем вложения...</div>,
  }
);

function unwrapRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("ru-RU");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("ru-RU");
}

export function PprTaskDetails({
  task,
  workItems,
  assigneeCandidates,
  comments,
  taskAttachments,
  commentAttachmentsById,
  permissions,
}: {
  task: PprTaskSummaryRow;
  workItems: PprTaskWorkItemRow[];
  assigneeCandidates: PprTaskAssigneeCandidateRow[];
  comments: PprTaskCommentRow[];
  taskAttachments: PprTaskAttachmentWithUrl[];
  commentAttachmentsById: Record<string, PprTaskAttachmentWithUrl[]>;
  permissions: {
    canAssign: boolean;
    canStart: boolean;
    canComplete: boolean;
    canClose: boolean;
    canCancel: boolean;
    canReschedule: boolean;
    canComment: boolean;
    canUpload: boolean;
  };
}) {
  const meta = pprTaskStatusMeta[task.status];
  const object = unwrapRelation(task.object);
  const system = unwrapRelation(task.system);
  const equipment = unwrapRelation(task.equipment);
  const responsible = unwrapRelation(task.responsible);
  const assignee = unwrapRelation(task.assignee);

  const hasManagementActions = permissions.canAssign || permissions.canCancel || permissions.canReschedule;

  return (
    <section className="td-page">
      {/* Hero */}
      <div className="section-card" style={{ padding: "1.5rem", marginBottom: "1rem", background: "color-mix(in srgb, var(--panel-soft) 30%, transparent)" }}>
        <div className="td-hero" style={{ gap: "1rem" }}>
          <div className="td-hero-top" style={{ alignItems: "flex-start" }}>
            <div>
              <div className="text-soft" style={{ fontSize: "0.85rem", marginBottom: "0.4rem", fontFamily: "monospace", letterSpacing: "0.05em" }}>
                {object?.name ?? "Без объекта"} • {system?.name ?? "Без системы"}
              </div>
              <h2 className="task-details-title" style={{ margin: 0, fontSize: "1.6rem" }}>{equipment?.name ?? "ППР-заявка"}</h2>
            </div>
            <div className="td-hero-badges">
              <Badge tone={meta.tone} style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}>{meta.label}</Badge>
              {task.is_overdue ? <Badge tone="danger" style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}>Просрочена</Badge> : null}
              {task.is_rescheduled ? <Badge tone="warning" style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}>Перенесена</Badge> : null}
            </div>
          </div>

          <div className="td-meta-grid" style={{ marginTop: "0.5rem", borderTop: "1px solid color-mix(in srgb, var(--line) 40%, transparent)", paddingTop: "1rem" }}>
            <div className="td-meta-item">
              <span className="td-meta-label">Плановая дата</span>
              <span className="td-meta-value" style={{ fontWeight: 500 }}>{formatDate(task.planned_for)}</span>
            </div>
            <div className="td-meta-item">
              <span className="td-meta-label">Инв. №</span>
              <span className="td-meta-value" style={{ fontFamily: "monospace" }}>{equipment?.inventory_no ?? "—"}</span>
            </div>
            <div className="td-meta-item">
              <span className="td-meta-label">Ответственный</span>
              <span className="td-meta-value">{responsible?.full_name ?? "Не назначен"}</span>
            </div>
            <div className="td-meta-item">
              <span className="td-meta-label">Исполнитель</span>
              <span className="td-meta-value">{assignee?.full_name ?? "Не назначен"}</span>
            </div>
          </div>

          <div className="row" style={{ gap: "1.2rem", flexWrap: "wrap", fontSize: "0.78rem", color: "var(--text-soft)", marginTop: "0.5rem" }}>
            <span>Создана: {formatDateTime(task.created_at)}</span>
            {task.completed_at && <span>Выполнена: {formatDateTime(task.completed_at)}</span>}
            {task.closed_at && <span>Закрыта: {formatDateTime(task.closed_at)}</span>}
            {task.cancelled_at && <span>Отменена: {formatDateTime(task.cancelled_at)}</span>}
          </div>

          {task.general_comment ? (
            <div className="grid" style={{ marginTop: "1rem", gap: "0.25rem", padding: "1rem", background: "color-mix(in srgb, var(--panel-soft) 40%, transparent)", borderRadius: "8px", border: "1px solid color-mix(in srgb, var(--line) 30%, transparent)" }}>
              <span className="td-meta-label">Комментарий к заявке</span>
              <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.5 }}>{task.general_comment}</p>
            </div>
          ) : null}

          {task.cancel_reason ? (
            <div className="grid" style={{ marginTop: "1rem", gap: "0.25rem", padding: "1rem", background: "color-mix(in srgb, var(--danger) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--danger) 20%, transparent)", borderRadius: "8px" }}>
              <span className="td-meta-label" style={{ color: "var(--danger)" }}>Причина отмены</span>
              <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.5 }}>{task.cancel_reason}</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Status strip — следующий шаг + главный CTA */}
      <PprTaskStatusStrip
        taskId={task.id}
        status={task.status}
        assigneeName={assignee?.full_name ?? null}
        commentsCount={comments.length}
        closedAt={task.closed_at ?? null}
        cancelledAt={task.cancelled_at ?? null}
        permissions={{
          canStart: permissions.canStart,
          canComplete: permissions.canComplete,
          canClose: permissions.canClose,
        }}
      />

      {/* 1. Что нужно сделать */}
      <div className="section-card grid" style={{ gap: "1rem", padding: "1.5rem", marginBottom: "1rem" }}>
        <div className="grid" style={{ gap: "0.35rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>Что нужно сделать</h3>
          <p className="text-soft" style={{ margin: 0, fontSize: "0.85rem" }}>
            Перечень работ и методики зафиксированы на момент создания заявки.
          </p>
        </div>

        {workItems.length ? (
          <div className="grid" style={{ gap: "1rem" }}>
            {workItems.map((item) => (
              <div key={item.id} style={{ display: "grid", gap: "0.75rem", background: "color-mix(in srgb, var(--panel-soft) 30%, transparent)", padding: "1.25rem", borderRadius: "10px", border: "1px solid color-mix(in srgb, var(--line-strong) 40%, transparent)" }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap", borderBottom: "1px solid color-mix(in srgb, var(--line-strong) 40%, transparent)", paddingBottom: "0.5rem" }}>
                  <strong style={{ fontSize: "1.05rem" }}>{item.title_snapshot}</strong>
                  {item.norm_hours_snapshot !== null ? <Badge tone="violet">Норма: {item.norm_hours_snapshot} ч</Badge> : null}
                </div>

                {item.description_snapshot ? <p style={{ margin: 0, lineHeight: 1.5 }}>{item.description_snapshot}</p> : null}

                {item.methodology_snapshot ? (
                  <div className="grid" style={{ gap: "0.25rem", marginTop: "0.5rem" }}>
                    <span className="text-soft text-sm" style={{ fontWeight: 600 }}>Методика</span>
                    <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.5 }}>{item.methodology_snapshot}</p>
                  </div>
                ) : null}

                <div className="grid" style={{ gap: "0.35rem", marginTop: "0.5rem" }}>
                  <span className="text-soft text-sm" style={{ fontWeight: 600 }}>Чек-лист</span>
                  {item.checklist_snapshot.length ? (
                    <ol style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.95rem", lineHeight: 1.6 }}>
                      {item.checklist_snapshot.map((check) => (
                        <li key={`${item.id}-${check.sort_order}`} style={{ marginBottom: "0.25rem" }}>
                          <span style={{ fontWeight: 500 }}>{check.title}</span>
                          {check.description ? <span className="text-soft"> — {check.description}</span> : null}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <span className="text-soft text-sm">Чек-лист не заполнен.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-soft" style={{ padding: "1.5rem", textAlign: "center", border: "1px dashed color-mix(in srgb, var(--line-strong) 60%, transparent)", borderRadius: "8px" }}>Перечень работ по этой заявке не задан.</div>
        )}
      </div>

      {/* 2. Отчёт: комментарии + фото */}
      <div className="section-card grid" style={{ gap: "1rem", padding: "1.5rem", marginBottom: "1rem" }}>
        <div className="grid" style={{ gap: "0.35rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>Отчёт по работам</h3>
          <p className="text-soft" style={{ margin: 0, fontSize: "0.85rem" }}>
            Для завершения заявки обязателен минимум один комментарий. Фото — по желанию.
          </p>
        </div>

        {permissions.canComment || permissions.canUpload ? (
          <PprTaskCommentForm taskId={task.id} />
        ) : (
          <div className="text-soft">Добавление комментариев и фото для текущей роли недоступно.</div>
        )}

        {taskAttachments.length ? <PprTaskAttachmentsGallery attachments={taskAttachments} /> : null}

        <div className="comment-feed">
          {comments.map((comment) => {
            const author = Array.isArray(comment.author) ? comment.author[0] : comment.author;
            const commentAttachments = commentAttachmentsById[comment.id] ?? [];
            return (
              <div key={comment.id} className="comment-item">
                <div className="comment-item-head">
                  <span className="comment-author">{author?.full_name ?? "Пользователь"}</span>
                  <span className="text-soft">{new Date(comment.created_at).toLocaleString("ru-RU")}</span>
                </div>
                <div className="comment-body">{comment.body}</div>
                {commentAttachments.length ? <PprTaskAttachmentsGallery attachments={commentAttachments} /> : null}
              </div>
            );
          })}
          {!comments.length ? <div className="text-soft td-feed-empty">Комментариев по ППР-заявке пока нет.</div> : null}
        </div>
      </div>

      {/* 3. Служебные действия — свёрнуто по умолчанию */}
      {hasManagementActions ? (
        <details
          className="section-card"
          style={{ padding: "1rem 1.5rem", marginBottom: "1rem" }}
        >
          <summary
            style={{
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: 600,
              padding: "0.25rem 0",
              listStyle: "none",
              userSelect: "none",
            }}
          >
            Управление заявкой
            <span className="text-soft" style={{ fontWeight: 400, fontSize: "0.85rem", marginLeft: "0.5rem" }}>
              — назначение исполнителя, перенос, отмена
            </span>
          </summary>
          <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid color-mix(in srgb, var(--line) 40%, transparent)" }}>
            <PprTaskLifecycleControls
              taskId={task.id}
              currentAssigneeId={task.assignee_id}
              plannedFor={task.planned_for}
              assigneeCandidates={assigneeCandidates}
              canAssign={permissions.canAssign}
              canCancel={permissions.canCancel}
              canReschedule={permissions.canReschedule}
            />
          </div>
        </details>
      ) : null}
    </section>
  );
}
