import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
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
    loading: () => <div className="section-card text-soft">Подготавливаем lifecycle-действия...</div>,
  }
);

const PprTaskCommentForm = dynamic(
  () => import("@/components/ppr/tasks/ppr-task-comment-form").then((module) => module.PprTaskCommentForm),
  {
    loading: () => <div className="section-card text-soft">Подготавливаем форму комментария...</div>,
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

  return (
    <section className="td-page">
      {/* Header and key meta */}
      <div className="td-hero" style={{ gap: "0.75rem" }}>
        <div className="td-hero-top" style={{ alignItems: "center" }}>
          <h2 className="task-details-title" style={{ margin: 0 }}>{equipment?.name ?? "ППР-заявка"}</h2>
          <div className="td-hero-badges">
            <Badge tone={meta.tone}>{meta.label}</Badge>
            {task.is_overdue ? <Badge tone="danger">Просрочена</Badge> : null}
            {task.is_rescheduled ? <Badge tone="warning">Перенесена</Badge> : null}
          </div>
        </div>

        <div className="text-soft" style={{ fontSize: "0.9rem", marginBottom: "0.25rem", opacity: 0.8 }}>
          {object?.name ?? "Без объекта"} • {system?.name ?? "Без системы"}
        </div>

        <div className="td-meta-grid">
          <div className="td-meta-item">
            <span className="td-meta-label">Плановая дата</span>
            <span className="td-meta-value">{formatDate(task.planned_for)}</span>
          </div>
          <div className="td-meta-item">
            <span className="td-meta-label">Инв. №</span>
            <span className="td-meta-value">{equipment?.inventory_no ?? "—"}</span>
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

        <div className="row" style={{ gap: "1.2rem", flexWrap: "wrap", fontSize: "0.78rem", opacity: 0.7 }}>
          <span>Создана: {formatDateTime(task.created_at)}</span>
          {task.completed_at && <span>Выполнена: {formatDateTime(task.completed_at)}</span>}
          {task.closed_at && <span>Закрыта: {formatDateTime(task.closed_at)}</span>}
          {task.cancelled_at && <span>Отменена: {formatDateTime(task.cancelled_at)}</span>}
        </div>

        {task.general_comment ? (
          <div className="grid" style={{ gap: "0.25rem", padding: "0.75rem", background: "color-mix(in srgb, var(--panel-soft) 40%, transparent)", borderRadius: "8px", border: "1px solid var(--line)" }}>
            <span className="td-meta-label">Комментарий к заявке</span>
            <p style={{ margin: 0, fontSize: "0.9rem" }}>{task.general_comment}</p>
          </div>
        ) : null}

        {task.cancel_reason ? (
          <div className="grid" style={{ gap: "0.25rem", padding: "0.75rem", background: "color-mix(in srgb, var(--danger) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--danger) 20%, transparent)", borderRadius: "8px" }}>
            <span className="td-meta-label" style={{ color: "var(--danger)" }}>Причина отмены</span>
            <p style={{ margin: 0, fontSize: "0.9rem" }}>{task.cancel_reason}</p>
          </div>
        ) : null}
      </div>

      <div className="grid md-grid-2" style={{ gap: "2.5rem" }}>
        {/* Left Column */}
        <div className="flex flex-col" style={{ gap: "2.5rem" }}>
          
          <div className="grid" style={{ gap: "1rem" }}>
            <div className="grid" style={{ gap: "0.35rem", borderBottom: "1px solid color-mix(in srgb, var(--line-strong) 40%, transparent)", paddingBottom: "0.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600 }}>Управление заявкой</h3>
              <p className="text-soft text-sm" style={{ margin: 0 }}>
                Назначение исполнителя, перевод в `in_progress` и `done`, закрытие, перенос и отмена.
              </p>
            </div>
            <PprTaskLifecycleControls
              taskId={task.id}
              currentStatus={task.status}
              currentAssigneeId={task.assignee_id}
              plannedFor={task.planned_for}
              assigneeCandidates={assigneeCandidates}
              canAssign={permissions.canAssign}
              canStart={permissions.canStart}
              canComplete={permissions.canComplete}
              canClose={permissions.canClose}
              canCancel={permissions.canCancel}
              canReschedule={permissions.canReschedule}
            />
          </div>

      <div className="section-card grid" style={{ gap: "1rem" }}>
        <div className="grid" style={{ gap: "0.35rem" }}>
          <h3 style={{ margin: 0 }}>Комментарии и фото</h3>
          <p className="text-soft" style={{ margin: 0 }}>
            Для перевода ППР-заявки в `done` сервер проверяет наличие хотя бы одного комментария и одного фото.
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

      <div className="section-card grid" style={{ gap: "1rem" }}>
        <div className="grid" style={{ gap: "0.35rem" }}>
          <h3 style={{ margin: 0 }}>Работы по snapshot-данным</h3>
          <p className="text-soft" style={{ margin: 0 }}>
            Карточка читает сохраненные snapshots из `ppr_task_work_items`, а не текущую версию шаблона.
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
                        <ol style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.95rem", lineHeight: 1.5 }}>
                          {item.checklist_snapshot.map((check) => (
                            <li key={`${item.id}-${check.sort_order}`}>
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
              <div className="text-soft" style={{ padding: "1.5rem", textAlign: "center", border: "1px dashed color-mix(in srgb, var(--line-strong) 60%, transparent)", borderRadius: "8px" }}>Work items для этой ППР-заявки пока отсутствуют.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
