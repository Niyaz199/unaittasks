"use client";

import { useMemo, useState, useTransition, useOptimistic } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { PhotoPicker, type PickedFile } from "@/components/tasks/photo-picker";
import { useToast } from "@/components/ui/toast";
import { AssigneeCombobox, type AssigneeOption } from "@/components/ui/assignee-combobox";
import { formatOperationalDateLabel } from "@/lib/daily-checklists/scheduler";
import type {
  DailyChecklistDayData,
  DailyChecklistItemRun,
  DailyChecklistItemStatus,
  ObjectItem,
  Role,
} from "@/lib/types";

type TaskCandidate = {
  id: string;
  full_name: string;
  role: Role;
  object_ids: string[];
  is_global_scope: boolean;
  email?: string | null;
};

type Props = {
  dayData: DailyChecklistDayData;
  objects: ObjectItem[];
  assignees: TaskCandidate[];
  readOnly?: boolean;
};

function statusTone(status: DailyChecklistItemStatus) {
  if (status === "done") return "success" as const;
  if (status === "problem") return "danger" as const;
  return "warning" as const;
}

function statusLabel(status: DailyChecklistItemStatus) {
  if (status === "done") return "Выполнено";
  if (status === "problem") return "Проблема";
  return "Ожидает";
}

function ChecklistTaskModal({
  item,
  objects,
  assignees,
  open,
  onClose,
}: {
  item: DailyChecklistItemRun;
  objects: ObjectItem[];
  assignees: TaskCandidate[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.comment ?? item.description ?? "");
  const [objectId, setObjectId] = useState(item.linked_object_id ?? "");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("high");
  const [dueAt, setDueAt] = useState("");

  const filteredAssignees = useMemo(
    () =>
      assignees.filter((candidate) => {
        if (!objectId) return true;
        return candidate.is_global_scope || candidate.object_ids.includes(objectId);
      }),
    [assignees, objectId]
  );

  function submit() {
    startTransition(async () => {
      const response = await fetch(`/api/checklists/items/${item.id}/task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          objectId,
          priority,
          dueAt,
          assignedTo: assigneeId,
          teamMemberIds: [],
        }),
      });
      const payload = (await response.json()) as { error?: string; taskId?: string };
      if (!response.ok) {
        addToast(payload.error ?? "Не удалось создать задачу", "error");
        return;
      }
      addToast("Задача создана из пункта чек-листа", "success");
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal open={open} title="Создать задачу из пункта" onClose={onClose}>
      <div className="grid" style={{ gap: "1rem", padding: "1rem 0" }}>
        <label className="grid" style={{ gap: "0.35rem" }}>
          <span className="text-soft">Название</span>
          <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>

        <label className="grid" style={{ gap: "0.35rem" }}>
          <span className="text-soft">Описание</span>
          <textarea
            className="input"
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <div className="grid" style={{ gap: "1rem", gridTemplateColumns: "1fr 1fr" }}>
          <label className="grid" style={{ gap: "0.35rem" }}>
            <span className="text-soft">Объект</span>
            <AssigneeCombobox
              name="object_id"
              placeholder="Выберите объект"
              defaultValue={objectId}
              selectionHint="Выберите объект из списка"
              options={objects.map<AssigneeOption>((object) => ({
                id: object.id,
                label: object.name,
              }))}
              onSelectedIdChange={(id) => setObjectId(id)}
            />
          </label>

          <label className="grid" style={{ gap: "0.35rem" }}>
            <span className="text-soft">Исполнитель</span>
            <AssigneeCombobox
              key={`assignee-${objectId || "any"}`}
              name="assignee_id"
              placeholder="Выберите исполнителя"
              defaultValue={assigneeId}
              selectionHint="Выберите исполнителя из списка"
              options={filteredAssignees.map<AssigneeOption>((candidate) => ({
                id: candidate.id,
                label: candidate.full_name,
                subtitle: candidate.email ?? null,
              }))}
              onSelectedIdChange={(id) => setAssigneeId(id)}
            />
          </label>
        </div>

        <div className="grid" style={{ gap: "1rem", gridTemplateColumns: "1fr 1fr" }}>
          <label className="grid" style={{ gap: "0.35rem" }}>
            <span className="text-soft">Приоритет</span>
            <select
              className="select"
              value={priority}
              onChange={(event) => setPriority(event.target.value as typeof priority)}
            >
              <option value="low">Низкий</option>
              <option value="medium">Средний</option>
              <option value="high">Высокий</option>
              <option value="critical">Критический</option>
            </select>
          </label>

          <label className="grid" style={{ gap: "0.35rem" }}>
            <span className="text-soft">Срок</span>
            <input className="input" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          </label>
        </div>

        <div className="row" style={{ justifyContent: "flex-end", gap: "0.75rem" }}>
          <button className="btn btn-ghost" type="button" onClick={onClose} disabled={pending}>
            Отмена
          </button>
          <button
            className="btn btn-accent"
            type="button"
            onClick={submit}
            disabled={pending || !title.trim() || !objectId || !assigneeId}
          >
            {pending ? "Создаём..." : "Создать задачу"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ChecklistItemCard({
  item,
  objects,
  assignees,
  readOnly,
  onOptimisticUpdate,
}: {
  item: DailyChecklistItemRun;
  objects: ObjectItem[];
  assignees: TaskCandidate[];
  readOnly?: boolean;
  onOptimisticUpdate?: (itemId: string, status: DailyChecklistItemStatus) => void;
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState(item.comment ?? "");
  const [photoFiles, setPhotoFiles] = useState<PickedFile[]>([]);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  function save(status: DailyChecklistItemStatus) {
    startTransition(async () => {
      onOptimisticUpdate?.(item.id, status);
      const response = await fetch(`/api/checklists/items/${item.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, comment }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        addToast(payload.error ?? "Не удалось обновить пункт", "error");
        return;
      }
      router.refresh();
    });
  }

  function uploadAttachments() {
    startTransition(async () => {
      if (!photoFiles.length) {
        addToast("Сначала выберите файлы", "info");
        return;
      }
      const formData = new FormData();
      photoFiles.forEach((file) => formData.append("files", file.file));
      const response = await fetch(`/api/checklists/items/${item.id}/attachments`, {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { error?: string; errors?: string[] };
      if (!response.ok) {
        addToast(payload.error ?? "Не удалось загрузить фото", "error");
        return;
      }
      if (payload.errors?.length) {
        addToast(`Часть файлов не загружена: ${payload.errors.join("; ")}`, "error");
      } else {
        addToast("Фото загружены", "success");
      }
      setPhotoFiles([]);
      router.refresh();
    });
  }

  const isDone = item.status === "done";
  const isProblem = item.status === "problem";
  const hasDetails = !!item.comment || !!item.attachments?.length || !!item.linked_task_id;
  const showDetails = readOnly ? hasDetails : detailsOpen;

  return (
    <>
      <article className={`section-card grid ${isDone && !readOnly ? "clv-item-done" : ""}`} style={{ gap: "0", padding: 0, overflow: "hidden" }}>
        <div 
          className="grid" 
          style={{ gap: "0.75rem", padding: "1rem", cursor: "pointer" }}
          onClick={() => setDetailsOpen(!detailsOpen)}
        >
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
            <div className="grid" style={{ gap: "0.25rem" }}>
              <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ fontSize: "1.05rem" }}>
                  {item.title}
                  {item.is_required && <span style={{ color: "var(--danger)", marginLeft: "0.25rem" }}>*</span>}
                </strong>
              </div>
              <div className="text-soft" style={{ fontSize: "0.85rem" }}>
                {item.schedule_label}
                {item.operational_date ? ` • ${formatOperationalDateLabel(item.operational_date)}` : ""}
              </div>
              {item.description ? <div className="text-soft" style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>{item.description}</div> : null}
            </div>

            <div className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
              {readOnly && (
                <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
              )}
              {item.linked_task_id ? (
                <a className="btn btn-ghost" style={{ padding: "0.25rem 0.5rem", fontSize: "0.85rem" }} href={`/tasks/${item.linked_task_id}`} onClick={(e) => e.stopPropagation()}>
                  К задаче
                </a>
              ) : null}
              <span className="text-soft" style={{ transform: detailsOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
            </div>
          </div>

          {!readOnly && (
            <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
              <button 
                className={`btn ${isDone ? "btn-accent" : "btn-ghost"}`} 
                style={{ flex: 1, minHeight: "44px", justifyContent: "center", background: isDone ? "var(--accent)" : "color-mix(in srgb, var(--accent) 10%, transparent)", color: isDone ? "#fff" : "var(--accent)", border: "none" }}
                type="button" 
                onClick={(e) => { e.stopPropagation(); save("done"); }} 
                disabled={pending}
              >
                ✓ Выполнено
              </button>
              <button 
                className={`btn ${isProblem ? "btn-danger" : "btn-ghost"}`} 
                style={{ flex: 1, minHeight: "44px", justifyContent: "center", background: isProblem ? "var(--danger)" : "color-mix(in srgb, var(--danger) 10%, transparent)", color: isProblem ? "#fff" : "var(--danger)", border: "none" }}
                type="button" 
                onClick={(e) => { e.stopPropagation(); save("problem"); }} 
                disabled={pending}
              >
                ⚠️ Проблема
              </button>
            </div>
          )}
        </div>

        {showDetails && (
          <div className="grid" style={{ gap: "1rem", padding: "1rem", background: "color-mix(in srgb, var(--panel-soft) 30%, transparent)", borderTop: "1px solid color-mix(in srgb, var(--line) 50%, transparent)" }}>
            {readOnly ? (
              <>
                {item.comment && (
                  <div className="grid" style={{ gap: "0.35rem" }}>
                    <span className="text-soft" style={{ fontSize: "0.85rem" }}>Комментарий</span>
                    <div style={{ whiteSpace: "pre-wrap" }}>{item.comment}</div>
                  </div>
                )}
              </>
            ) : (
              <label className="grid" style={{ gap: "0.35rem" }}>
                <span className="text-soft" style={{ fontSize: "0.85rem" }}>Комментарий</span>
                <textarea
                  className="input"
                  rows={2}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Что выполнено, что мешает, что нужно проконтролировать..."
                />
              </label>
            )}

            {item.attachments?.length ? (
              <div className="grid" style={{ gap: "0.35rem" }}>
                <span className="text-soft" style={{ fontSize: "0.85rem" }}>Вложения</span>
                <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                  {item.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      className="btn btn-ghost"
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.85rem" }}
                      href={attachment.url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {attachment.file_name}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {!readOnly && (
              <div className="grid" style={{ gap: "0.75rem" }}>
                <PhotoPicker files={photoFiles} onChange={setPhotoFiles} disabled={pending} label="Добавить фото" />
                <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                  {photoFiles.length > 0 && (
                    <button className="btn btn-ghost" type="button" onClick={uploadAttachments} disabled={pending}>
                      Загрузить фото
                    </button>
                  )}
                  <button className="btn btn-ghost" type="button" onClick={() => save(item.status)} disabled={pending || comment === (item.comment ?? "")}>
                    Сохранить комментарий
                  </button>
                  {item.status !== "pending" ? (
                    <button className="btn btn-ghost" type="button" onClick={() => save("pending")} disabled={pending}>
                      Сбросить статус
                    </button>
                  ) : null}
                  {item.allow_task_escalation ? (
                    <button className="btn btn-ghost" type="button" onClick={() => setTaskModalOpen(true)} disabled={pending}>
                      Создать задачу
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </article>

      {!readOnly && (
        <ChecklistTaskModal
          item={item}
          objects={objects}
          assignees={assignees}
          open={taskModalOpen}
          onClose={() => setTaskModalOpen(false)}
        />
      )}
    </>
  );
}

function ChecklistGroup({
  title,
  items,
  objects,
  assignees,
  emptyMessage,
  readOnly,
  defaultOpen = true,
  onOptimisticUpdate,
}: {
  title: string;
  items: DailyChecklistItemRun[];
  objects: ObjectItem[];
  assignees: TaskCandidate[];
  emptyMessage: string;
  readOnly?: boolean;
  defaultOpen?: boolean;
  onOptimisticUpdate?: (itemId: string, status: DailyChecklistItemStatus) => void;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="grid" style={{ gap: "1rem" }}>
      <button 
        className="row" 
        style={{ justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.25rem", background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <div className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600 }}>{title}</h2>
          <Badge tone="neutral">{items.length}</Badge>
        </div>
        <span className="text-soft" style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
      </button>
      
      {isOpen && (
        items.length ? (
          <div className="grid" style={{ gap: "0.75rem" }}>
            {items.map((item) => (
              <ChecklistItemCard key={item.id} item={item} objects={objects} assignees={assignees} readOnly={readOnly} onOptimisticUpdate={onOptimisticUpdate} />
            ))}
          </div>
        ) : (
          <div className="section-card text-soft" style={{ padding: "1rem", textAlign: "center", background: "transparent", border: "1px dashed color-mix(in srgb, var(--line) 50%, transparent)" }}>
            {emptyMessage}
          </div>
        )
      )}
    </section>
  );
}

export function ChecklistDayView({ dayData, objects, assignees, readOnly }: Props) {
  const [optimisticDayData, addOptimisticUpdate] = useOptimistic(
    dayData,
    (state, update: { itemId: string; newStatus: DailyChecklistItemStatus }) => {
      if (!state.run) return state;

      const newItems = (state.run.items ?? []).map((item) =>
        item.id === update.itemId ? { ...item, status: update.newStatus } : item
      );

      const newOverdue = state.overdueItems.map((item) =>
        item.id === update.itemId ? { ...item, status: update.newStatus } : item
      );

      const completed = newItems.filter((i) => i.status === "done").length;
      const problems = newItems.filter((i) => i.status === "problem").length;
      const requiredResolved = newItems.filter((i) => i.is_required && i.status !== "pending").length;
      const percentBase = state.completion.requiredTotal || newItems.length;
      const percent = percentBase ? Math.round((requiredResolved / percentBase) * 100) : 100;

      return {
        ...state,
        run: { ...state.run, items: newItems },
        overdueItems: newOverdue,
        completion: {
          ...state.completion,
          completed,
          problems,
          requiredResolved,
          percent,
        },
      };
    }
  );

  if (!optimisticDayData.run) {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto", width: "100%" }}>
        <EmptyState
          message="Для вашей роли ещё не настроен чек-лист."
          hint="После публикации шаблона здесь появятся пункты на текущий день."
        />
      </div>
    );
  }

  const currentItems = optimisticDayData.run.items ?? [];
  const pendingItems = currentItems.filter((item) => item.status === "pending");
  const resolvedItems = currentItems.filter((item) => item.status !== "pending");

  return (
    <div className="grid" style={{ gap: "1.5rem", maxWidth: "800px", margin: "0 auto", width: "100%", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <section className="section-card grid" style={{ gap: "0.75rem", padding: "1rem", position: "sticky", top: "1rem", zIndex: 10, background: "var(--panel)", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div className="grid" style={{ gap: "0.2rem" }}>
            <strong style={{ fontSize: "1.05rem" }}>{optimisticDayData.run.template_name}</strong>
            <span className="text-soft" style={{ fontSize: "0.85rem" }}>
              {formatOperationalDateLabel(optimisticDayData.run.operational_date)}
            </span>
          </div>
        </div>

        <div className="grid" style={{ gap: "0.35rem" }}>
          <div className="row" style={{ justifyContent: "space-between", fontSize: "0.85rem" }}>
            <span>Выполнено {optimisticDayData.completion.requiredResolved} из {optimisticDayData.completion.requiredTotal} обязательных</span>
            {optimisticDayData.completion.problems > 0 && <span style={{ color: "var(--danger)", fontWeight: 500 }}>{optimisticDayData.completion.problems} проблем</span>}
          </div>
          <div style={{ height: "6px", background: "color-mix(in srgb, var(--line) 50%, transparent)", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${optimisticDayData.completion.percent}%`, background: "var(--accent)", transition: "width 0.3s ease" }} />
          </div>
        </div>
      </section>

      <ChecklistGroup
        title="Сегодня"
        items={pendingItems}
        objects={objects}
        assignees={assignees}
        emptyMessage="Все сегодняшние пункты уже обработаны."
        readOnly={readOnly}
        defaultOpen={true}
        onOptimisticUpdate={(itemId, newStatus) => addOptimisticUpdate({ itemId, newStatus })}
      />

      <ChecklistGroup
        title="Просрочено"
        items={optimisticDayData.overdueItems}
        objects={objects}
        assignees={assignees}
        emptyMessage="Просроченных обязательных пунктов нет."
        readOnly={readOnly}
        defaultOpen={optimisticDayData.overdueItems.length > 0}
        onOptimisticUpdate={(itemId, newStatus) => addOptimisticUpdate({ itemId, newStatus })}
      />

      <ChecklistGroup
        title="Отмеченные пункты"
        items={resolvedItems}
        objects={objects}
        assignees={assignees}
        emptyMessage="Пока нет отмеченных пунктов."
        readOnly={readOnly}
        defaultOpen={false}
        onOptimisticUpdate={(itemId, newStatus) => addOptimisticUpdate({ itemId, newStatus })}
      />
    </div>
  );
}
