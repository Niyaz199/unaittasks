"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTaskActionSafe } from "@/app/actions/task-actions";
import type { ObjectItem, Profile, Role } from "@/lib/types";
import { AssigneeCombobox, type AssigneeOption } from "@/components/ui/assignee-combobox";
import { TeamMembersPicker } from "@/components/tasks/team-members-picker";
import { PhotoPicker, type PickedFile } from "@/components/tasks/photo-picker";

type FieldErrors = {
  title?: string;
  object_id?: string;
  assigned_to?: string;
};

type TaskCandidate = Pick<Profile, "id" | "full_name"> & {
  email?: string | null;
  role: Role;
  object_ids: string[];
  is_global_scope: boolean;
};

export function CreateTaskForm({
  objects,
  assignees,
  teamCandidates
}: {
  objects: ObjectItem[];
  assignees: TaskCandidate[];
  teamCandidates: TaskCandidate[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const objectRef = useRef<HTMLDivElement>(null);
  const assigneeRef = useRef<HTMLDivElement>(null);

  const [selectedObjectId, setSelectedObjectId] = useState("");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<PickedFile[]>([]);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const objectOptions: AssigneeOption[] = objects.map((o) => ({ id: o.id, label: o.name }));
  const filteredAssignees = useMemo(
    () =>
      assignees.filter((candidate) => {
        if (!selectedObjectId) return true;
        return candidate.is_global_scope || candidate.object_ids.includes(selectedObjectId);
      }),
    [assignees, selectedObjectId]
  );
  const filteredTeamCandidates = useMemo(
    () =>
      teamCandidates.filter((candidate) => {
        if (!selectedObjectId) return true;
        return candidate.is_global_scope || candidate.object_ids.includes(selectedObjectId);
      }),
    [teamCandidates, selectedObjectId]
  );
  const assigneeOptions: AssigneeOption[] = filteredAssignees.map((a) => ({ id: a.id, label: a.full_name, subtitle: a.email ?? null }));
  const teamOptions: AssigneeOption[] = filteredTeamCandidates.map((m) => ({ id: m.id, label: m.full_name, subtitle: m.email ?? null }));

  useEffect(() => {
    if (selectedAssigneeId && !filteredAssignees.some((candidate) => candidate.id === selectedAssigneeId)) {
      setSelectedAssigneeId("");
    }
    setSelectedTeamIds((prev) => prev.filter((memberId) => filteredTeamCandidates.some((candidate) => candidate.id === memberId)));
  }, [filteredAssignees, filteredTeamCandidates, selectedAssigneeId]);

  function validate(titleValue: string): FieldErrors {
    const errors: FieldErrors = {};
    if (!titleValue.trim()) errors.title = "Введите название задачи";
    if (!selectedObjectId) errors.object_id = "Выберите объект из списка";
    if (!selectedAssigneeId) errors.assigned_to = "Выберите исполнителя из списка";
    return errors;
  }

  function focusFirstError(errors: FieldErrors) {
    if (errors.title) {
      titleRef.current?.focus();
      titleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (errors.object_id) {
      objectRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (errors.assigned_to) {
      assigneeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGlobalError(null);
    setSuccessMsg(null);

    const formData = new FormData(event.currentTarget);
    const titleValue = String(formData.get("title") ?? "");
    const errors = validate(titleValue);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      focusFirstError(errors);
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      const result = await createTaskActionSafe(formData);
      if (!result.ok) {
        setGlobalError(result.error);
        return;
      }

      // Загружаем фото после успешного создания задачи
      if (photoFiles.length > 0) {
        const fd = new FormData();
        photoFiles.forEach((pf) => fd.append("files", pf.file));
        try {
          const uploadRes = await fetch(`/api/tasks/${result.taskId}/attachments`, {
            method: "POST",
            body: fd
          });
          if (uploadRes.ok) {
            const uploadJson = await uploadRes.json();
            if (uploadJson.errors?.length) {
              setSuccessMsg(`Задача создана. Часть фото не загрузилась: ${uploadJson.errors.join("; ")}`);
            } else {
              setSuccessMsg("Задача создана");
            }
          } else {
            setSuccessMsg("Задача создана, но фото не удалось загрузить.");
          }
        } catch {
          setSuccessMsg("Задача создана, но фото не удалось загрузить.");
        }
      } else {
        setSuccessMsg("Задача создана");
      }

      setTimeout(() => {
        router.push(`/tasks/${result.taskId}`);
      }, 800);
    });
  }

  return (
    <form
      ref={formRef}
      className="ctf-form"
      onSubmit={handleSubmit}
      noValidate
    >
      {globalError ? (
        <div className="ctf-alert ctf-alert--error" role="alert">
          <span className="ctf-alert-icon" aria-hidden="true">✕</span>
          <span>{globalError}</span>
        </div>
      ) : null}

      {successMsg ? (
        <div className="ctf-alert ctf-alert--success" role="status">
          <span className="ctf-alert-icon" aria-hidden="true">✓</span>
          <span>{successMsg}</span>
        </div>
      ) : null}

      {/* ── Блок 1: Основное ── */}
      <section className="ctf-section">
        <h3 className="ctf-section-title">Основное</h3>
        <div className="ctf-field">
          <label className="ctf-label" htmlFor="ctf-title">
            Название <span className="ctf-required" aria-hidden="true">*</span>
          </label>
          <input
            id="ctf-title"
            ref={titleRef}
            className={`input ctf-title-input${fieldErrors.title ? " ctf-input--error" : ""}`}
            name="title"
            placeholder="Что нужно сделать?"
            autoComplete="off"
            onChange={() => { if (fieldErrors.title) setFieldErrors((p) => ({ ...p, title: undefined })); }}
          />
          {fieldErrors.title ? <span className="ctf-field-error">{fieldErrors.title}</span> : null}
        </div>
        <div className="ctf-field">
          <label className="ctf-label" htmlFor="ctf-description">
            Описание <span className="ctf-optional">необязательно</span>
          </label>
          <textarea id="ctf-description" className="input" name="description" rows={3} placeholder="Подробности, ссылки, контекст…" />
        </div>
      </section>

      {/* ── Блок 2: Назначение ── */}
      <section className="ctf-section">
        <h3 className="ctf-section-title">Назначение</h3>
        <div className="ctf-assign-grid">
          <div className="ctf-field" ref={objectRef}>
            <label className="ctf-label">
              Объект <span className="ctf-required" aria-hidden="true">*</span>
            </label>
            <div className={fieldErrors.object_id ? "ctf-combobox--error" : ""}>
              <AssigneeCombobox
                name="object_id"
                options={objectOptions}
                placeholder="Выберите объект"
                required
                onSelectedIdChange={(id) => {
                  setSelectedObjectId(id);
                  if (id) setFieldErrors((p) => ({ ...p, object_id: undefined }));
                }}
              />
            </div>
            {fieldErrors.object_id ? <span className="ctf-field-error">{fieldErrors.object_id}</span> : null}
          </div>

          <div className="ctf-field">
            <label className="ctf-label" htmlFor="ctf-priority">Приоритет</label>
            <select id="ctf-priority" className="select" name="priority" defaultValue="medium">
              <option value="low">Низкий</option>
              <option value="medium">Средний</option>
              <option value="high">Высокий</option>
              <option value="critical">Критический</option>
            </select>
          </div>

          <div className="ctf-field" ref={assigneeRef}>
            <label className="ctf-label">
              Исполнитель <span className="ctf-required" aria-hidden="true">*</span>
            </label>
            <div className={fieldErrors.assigned_to ? "ctf-combobox--error" : ""}>
              <AssigneeCombobox
                key={`assignee-${selectedObjectId || "any"}`}
                name="assigned_to"
                options={assigneeOptions}
                required
                onSelectedIdChange={(id) => {
                  setSelectedAssigneeId(id);
                  if (id) {
                    setSelectedTeamIds((prev) => prev.filter((memberId) => memberId !== id));
                    setFieldErrors((p) => ({ ...p, assigned_to: undefined }));
                  }
                }}
              />
            </div>
            {fieldErrors.assigned_to ? <span className="ctf-field-error">{fieldErrors.assigned_to}</span> : null}
          </div>

          <div className="ctf-field">
            <label className="ctf-label" htmlFor="ctf-due">Срок выполнения</label>
            <input id="ctf-due" className="input" type="datetime-local" name="due_at" />
          </div>
        </div>
      </section>

      {/* ── Блок 3: Дополнительно ── */}
      <section className="ctf-section ctf-secondary">
        <h3 className="ctf-section-title">Дополнительно</h3>
        <div className="ctf-field">
          <label className="ctf-label">
            Команда задачи <span className="ctf-optional">необязательно</span>
          </label>
          {selectedTeamIds.map((memberId) => (
            <input key={memberId} type="hidden" name="team_member_ids" value={memberId} />
          ))}
          <TeamMembersPicker
            options={teamOptions}
            selectedIds={selectedTeamIds}
            excludedIds={selectedAssigneeId ? [selectedAssigneeId] : []}
            onAdd={(id) => {
              if (selectedTeamIds.includes(id)) return;
              setSelectedTeamIds((prev) => [...prev, id]);
            }}
            onRemove={(id) => {
              setSelectedTeamIds((prev) => prev.filter((value) => value !== id));
            }}
            placeholder="Добавить участника в команду"
          />
        </div>
        <div className="ctf-field">
          <label className="ctf-label">
            Фото <span className="ctf-optional">необязательно · JPEG/PNG/WebP, до 5 MB, макс. 5 шт.</span>
          </label>
          <PhotoPicker
            files={photoFiles}
            onChange={setPhotoFiles}
            disabled={pending || !!successMsg}
          />
        </div>
      </section>

      {/* ── CTA ── */}
      <div className="ctf-actions">
        {Object.keys(fieldErrors).length > 0 ? (
          <div className="ctf-alert ctf-alert--error" role="alert">
            <span className="ctf-alert-icon" aria-hidden="true">✕</span>
            <span>Заполните обязательные поля</span>
          </div>
        ) : null}
        <button className="btn btn-accent ctf-submit-btn" type="submit" disabled={pending || !!successMsg}>
          {pending ? (
            <>
              <span className="ctf-spinner" aria-hidden="true" />
              Создаём…
            </>
          ) : "Создать задачу"}
        </button>
      </div>
    </form>
  );
}
