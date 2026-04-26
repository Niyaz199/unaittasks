"use client";

import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { PprTaskStatusStrip } from "@/components/ppr/tasks/ppr-task-status-strip";
import { PprTaskPurchaseSection } from "@/components/ppr/tasks/ppr-task-purchase-section";
import type {
  PprTaskAttachmentWithUrl,
  PprTaskAssigneeCandidateRow,
  PprTaskCommentRow,
  PprTaskSummaryRow,
  PprTaskWorkItemRow,
} from "@/lib/ppr/queries";
import { pprTaskStatusMeta } from "@/lib/ppr/presentation";
import type { Profile } from "@/lib/types";

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
  viewerRole,
  equipmentComponents,
  linkedPurchaseRequests,
  holdPurchaseRequest: holdPurchaseRequestProp = null,
  canCreatePurchaseRequest,
  canViewPurchaseRequests,
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
    canPause: boolean;
    canResume: boolean;
    canComment: boolean;
    canUpload: boolean;
  };
  viewerRole: Profile["role"];
  equipmentComponents: React.ComponentProps<typeof PprTaskPurchaseSection>["components"];
  linkedPurchaseRequests: React.ComponentProps<typeof PprTaskPurchaseSection>["linkedRequests"];
  holdPurchaseRequest?: { id: string; status: "new" | "in_progress" | "fulfilled" | "cancelled" } | null;
  canCreatePurchaseRequest: boolean;
  canViewPurchaseRequests: boolean;
}) {
  const meta = pprTaskStatusMeta[task.status];
  const object = unwrapRelation(task.object);
  const system = unwrapRelation(task.system);
  const equipment = unwrapRelation(task.equipment);
  const responsible = unwrapRelation(task.responsible);
  const assignee = unwrapRelation(task.assignee);

  const hasManagementActions =
    permissions.canAssign || permissions.canCancel || permissions.canReschedule || permissions.canPause;
  const holdPurchaseRequest =
    holdPurchaseRequestProp ??
    (task.hold_purchase_request_id
      ? linkedPurchaseRequests.find((pr) => pr.id === task.hold_purchase_request_id) ?? null
      : null);
  const pauseLinkableRequests = linkedPurchaseRequests
    .filter((pr) => pr.status === "new" || pr.status === "in_progress")
    .map((pr) => ({
      id: pr.id,
      status: pr.status,
      description: pr.description,
      created_at: pr.created_at,
    }));
  const isTech = viewerRole === "tech";
  const isArchived = task.status === "closed" || task.status === "cancelled";
  const isNew = task.status === "new";
  const canReport = permissions.canComment || permissions.canUpload;
  const totalChecklistItems = workItems.reduce((sum, w) => sum + (w.checklist_snapshot?.length ?? 0), 0);

  return (
    <section className="td-page">
      {/* Hero — контекст + meta (дата/исполнитель/ответственный) */}
      <div
        className="section-card"
        style={{ padding: "1rem 1.25rem", marginBottom: "0.75rem" }}
      >
        <div className="grid" style={{ gap: "0.75rem" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <div className="text-soft" style={{ fontSize: "0.78rem", marginBottom: "0.25rem", fontFamily: "monospace", letterSpacing: "0.04em" }}>
                {object?.name ?? "Без объекта"} • {system?.name ?? "Без системы"}
              </div>
              <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <h2 className="task-details-title" style={{ margin: 0, fontSize: "1.3rem", lineHeight: 1.25 }}>
                  {equipment?.name ?? "ППР-заявка"}
                </h2>
                {equipment?.inventory_no ? (
                  <Badge tone="neutral" style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>
                    Инв. {equipment.inventory_no}
                  </Badge>
                ) : null}
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              <Badge tone={meta.tone} style={{ padding: "0.3rem 0.65rem", fontSize: "0.8rem" }}>{meta.label}</Badge>
              {task.is_overdue ? <Badge tone="danger" style={{ padding: "0.3rem 0.65rem", fontSize: "0.8rem" }}>Просрочена</Badge> : null}
            </div>
          </div>

          <div className="td-meta-grid" style={{ borderTop: "1px solid color-mix(in srgb, var(--line) 40%, transparent)", paddingTop: "0.7rem" }}>
            <div className="td-meta-item">
              <span className="td-meta-label">Плановая дата</span>
              <span className="td-meta-value" style={{ fontWeight: 500 }}>{formatDate(task.planned_for)}</span>
            </div>
            <div className="td-meta-item">
              <span className="td-meta-label">Исполнитель</span>
              <span className="td-meta-value">{assignee?.full_name ?? "Не назначен"}</span>
            </div>
            {!isTech ? (
              <div className="td-meta-item">
                <span className="td-meta-label">Ответственный</span>
                <span className="td-meta-value">{responsible?.full_name ?? "Не назначен"}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Баннер переноса */}
      {task.is_rescheduled && !isArchived ? (
        <div
          role="note"
          style={{
            padding: "0.6rem 0.9rem",
            marginBottom: "0.75rem",
            borderRadius: "8px",
            background: "color-mix(in srgb, var(--warning, #f59e0b) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--warning, #f59e0b) 30%, transparent)",
            color: "var(--warning, #f59e0b)",
            fontSize: "0.88rem",
          }}
        >
          Заявка была перенесена. Актуальная плановая дата: {formatDate(task.planned_for)}.
        </div>
      ) : null}

      {task.cancel_reason ? (
        <div
          className="section-card"
          style={{
            padding: "0.75rem 0.9rem",
            marginBottom: "0.75rem",
            background: "color-mix(in srgb, var(--danger) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--danger) 25%, transparent)",
          }}
        >
          <div className="td-meta-label" style={{ color: "var(--danger)", marginBottom: "0.2rem" }}>Причина отмены</div>
          <p style={{ margin: 0, fontSize: "0.92rem", lineHeight: 1.5 }}>{task.cancel_reason}</p>
        </div>
      ) : null}

      {/* 1. Главный CTA — взять в работу / отметить выполненной / закрыть */}
      <PprTaskStatusStrip
        taskId={task.id}
        status={task.status}
        assigneeName={assignee?.full_name ?? null}
        commentsCount={comments.length}
        closedAt={task.closed_at ?? null}
        cancelledAt={task.cancelled_at ?? null}
        heldAt={task.held_at ?? null}
        holdReason={task.hold_reason ?? null}
        holdPurchaseRequest={holdPurchaseRequest ? { id: holdPurchaseRequest.id, status: holdPurchaseRequest.status } : null}
        permissions={{
          canStart: permissions.canStart,
          canComplete: permissions.canComplete,
          canClose: permissions.canClose,
          canResume: permissions.canResume,
        }}
        writeoffComponents={equipmentComponents}
      />

      {/* 2. Управление заявкой — компактный блок с 3 сворачиваемыми секциями */}
      {hasManagementActions && !isArchived ? (
        <div className="section-card grid" style={{ gap: "0.5rem", padding: "0.75rem 1rem", marginBottom: "0.75rem" }}>
          <h3 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 600, color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Управление заявкой
          </h3>
          <PprTaskLifecycleControls
            taskId={task.id}
            currentAssigneeId={task.assignee_id}
            plannedFor={task.planned_for}
            assigneeCandidates={assigneeCandidates}
            canAssign={permissions.canAssign}
            canCancel={permissions.canCancel}
            canReschedule={permissions.canReschedule}
            canPause={permissions.canPause}
            pauseLinkableRequests={pauseLinkableRequests}
          />
        </div>
      ) : null}

      {/* 3. Что нужно сделать */}
      {isArchived ? (
        <details className="section-card" style={{ padding: "1rem 1.5rem", marginBottom: "0.75rem" }}>
          <summary style={{ cursor: "pointer", fontSize: "1rem", fontWeight: 600, listStyle: "none", userSelect: "none" }}>
            Что нужно было сделать
            <span className="text-soft" style={{ fontWeight: 400, fontSize: "0.85rem", marginLeft: "0.5rem" }}>
              — работ: {workItems.length} • пунктов: {totalChecklistItems}
            </span>
          </summary>
          <div style={{ marginTop: "1rem" }}>
            <WorkItemsList workItems={workItems} defaultOpen={false} />
          </div>
        </details>
      ) : (
        <div
          className="section-card grid"
          style={{
            gap: "0.75rem",
            padding: "1rem 1.25rem",
            marginBottom: "0.75rem",
          }}
        >
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Что нужно сделать</h3>
            <span className="text-soft" style={{ fontSize: "0.8rem" }}>
              Работ: <strong>{workItems.length}</strong> • пунктов: <strong>{totalChecklistItems}</strong>
            </span>
          </div>
          <WorkItemsList workItems={workItems} defaultOpen={task.status !== "done"} />
        </div>
      )}

      {/* 4. Заявки в снабжение */}
      {canCreatePurchaseRequest || linkedPurchaseRequests.length ? (
        <PprTaskPurchaseSection
          taskId={task.id}
          components={equipmentComponents}
          linkedRequests={linkedPurchaseRequests}
          canCreate={canCreatePurchaseRequest && !isArchived}
          canLinkToRequests={canViewPurchaseRequests}
        />
      ) : null}

      {/* 5. Отчёт */}
      {isNew ? (
        <details className="section-card" style={{ padding: "1rem 1.5rem", marginBottom: "1rem" }}>
          <summary style={{ cursor: "pointer", fontSize: "1rem", fontWeight: 600, listStyle: "none", userSelect: "none" }}>
            Отчёт по работам
            <span className="text-soft" style={{ fontWeight: 400, fontSize: "0.85rem", marginLeft: "0.5rem" }}>
              — станет активным после перевода в работу
            </span>
          </summary>
          <div className="text-soft" style={{ marginTop: "0.75rem", fontSize: "0.9rem" }}>
            Комментарии и фото можно будет добавить, когда заявка перейдёт в статус «В работе».
          </div>
        </details>
      ) : (
        <div className="section-card grid" style={{ gap: "1rem", padding: "1.5rem", marginBottom: "1rem" }}>
          <div className="grid" style={{ gap: "0.35rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>Отчёт по работам</h3>
            <p className="text-soft" style={{ margin: 0, fontSize: "0.85rem" }}>
              Для завершения заявки обязателен минимум один комментарий. Фото — по желанию.
            </p>
          </div>

          {canReport ? (
            <PprTaskCommentForm taskId={task.id} />
          ) : !isArchived ? (
            <div className="text-soft">Добавление комментариев и фото для текущей роли недоступно.</div>
          ) : null}

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
      )}

      {/* 6. Подробнее о заявке — общий комментарий + история дат */}
      {task.general_comment || task.created_at ? (
        <details className="section-card" style={{ padding: "0.85rem 1.25rem", marginBottom: "0.75rem" }}>
          <summary style={{ cursor: "pointer", fontSize: "0.92rem", fontWeight: 500, color: "var(--text-soft)", listStyle: "none", userSelect: "none" }}>
            Подробнее о заявке ▾
          </summary>
          <div className="grid" style={{ gap: "0.75rem", marginTop: "0.75rem" }}>
            {task.general_comment ? (
              <div className="grid" style={{ gap: "0.25rem" }}>
                <span className="td-meta-label">Комментарий к заявке</span>
                <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5 }}>{task.general_comment}</p>
              </div>
            ) : null}
            <div className="row" style={{ gap: "1rem", flexWrap: "wrap", color: "var(--text-soft)", fontSize: "0.82rem" }}>
              <span>Создана: {formatDateTime(task.created_at)}</span>
              {task.completed_at ? <span>Выполнена: {formatDateTime(task.completed_at)}</span> : null}
              {task.closed_at ? <span>Закрыта: {formatDateTime(task.closed_at)}</span> : null}
              {task.cancelled_at ? <span>Отменена: {formatDateTime(task.cancelled_at)}</span> : null}
            </div>
          </div>
        </details>
      ) : null}
    </section>
  );
}

function WorkItemsList({ workItems, defaultOpen = true }: { workItems: PprTaskWorkItemRow[]; defaultOpen?: boolean }) {
  if (!workItems.length) {
    return (
      <div className="text-soft" style={{ padding: "1.5rem", textAlign: "center", border: "1px dashed color-mix(in srgb, var(--line-strong) 60%, transparent)", borderRadius: "8px" }}>
        Перечень работ по этой заявке не задан.
      </div>
    );
  }
  const singleWork = workItems.length === 1;
  return (
    <div className="grid" style={{ gap: "0.75rem" }}>
      {workItems.map((item, idx) => {
        const open = defaultOpen && (singleWork || idx === 0 || workItems.length <= 3);
        return (
          <details
            key={item.id}
            open={open}
            style={{
              background: "color-mix(in srgb, var(--panel-soft) 30%, transparent)",
              borderRadius: "10px",
              border: "1px solid color-mix(in srgb, var(--line-strong) 40%, transparent)",
              overflow: "hidden",
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                listStyle: "none",
                padding: "0.85rem 1.1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
                flexWrap: "wrap",
                userSelect: "none",
              }}
            >
              <div className="row" style={{ gap: "0.6rem", alignItems: "center", flex: "1 1 220px", minWidth: 0 }}>
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "26px",
                    height: "26px",
                    borderRadius: "50%",
                    background: "color-mix(in srgb, var(--accent, #6366f1) 15%, transparent)",
                    color: "var(--accent, #6366f1)",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </span>
                <strong style={{ fontSize: "1rem", lineHeight: 1.3 }}>{item.title_snapshot}</strong>
              </div>
              <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                {item.checklist_snapshot.length ? (
                  <Badge tone="neutral" style={{ fontSize: "0.75rem" }}>
                    {item.checklist_snapshot.length} пункт.
                  </Badge>
                ) : null}
                {item.norm_hours_snapshot !== null ? <Badge tone="violet" style={{ fontSize: "0.75rem" }}>{item.norm_hours_snapshot} ч</Badge> : null}
              </div>
            </summary>

            <div className="grid" style={{ gap: "0.75rem", padding: "0 1.1rem 1.1rem" }}>
              {item.description_snapshot ? <p style={{ margin: 0, lineHeight: 1.5 }}>{item.description_snapshot}</p> : null}

              {item.methodology_snapshot ? (
                <div className="grid" style={{ gap: "0.25rem" }}>
                  <span className="text-soft text-sm" style={{ fontWeight: 600 }}>Методика</span>
                  <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.5 }}>{item.methodology_snapshot}</p>
                </div>
              ) : null}

              <div className="grid" style={{ gap: "0.35rem" }}>
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
          </details>
        );
      })}
    </div>
  );
}
