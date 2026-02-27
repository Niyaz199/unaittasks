"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTaskActionSafe } from "@/app/actions/task-actions";
import type { ObjectItem, Profile } from "@/lib/types";
import { AssigneeCombobox, type AssigneeOption } from "@/components/ui/assignee-combobox";
import { TeamMembersPicker } from "@/components/tasks/team-members-picker";

type FieldErrors = {
  title?: string;
  object_id?: string;
  assigned_to?: string;
};

export function CreateTaskForm({
  objects,
  assignees,
  teamCandidates
}: {
  objects: ObjectItem[];
  assignees: Array<Pick<Profile, "id" | "full_name"> & { email?: string | null }>;
  teamCandidates: Array<Pick<Profile, "id" | "full_name"> & { email?: string | null }>;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const objectRef = useRef<HTMLDivElement>(null);
  const assigneeRef = useRef<HTMLDivElement>(null);

  const [selectedObjectId, setSelectedObjectId] = useState("");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const assigneeOptions: AssigneeOption[] = assignees.map((a) => ({ id: a.id, label: a.full_name, subtitle: a.email ?? null }));
  const objectOptions: AssigneeOption[] = objects.map((o) => ({ id: o.id, label: o.name }));
  const teamOptions: AssigneeOption[] = teamCandidates.map((m) => ({ id: m.id, label: m.full_name, subtitle: m.email ?? null }));

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
      setSuccessMsg("Задача создана");
      // Редирект в карточку задачи через ~800ms, чтобы toast успел отобразиться
      setTimeout(() => {
        router.push(`/tasks/${result.taskId}`);
      }, 800);
    });
  }

  return (
    <form
      ref={formRef}
      className="section-card grid"
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

      <section className="form-section">
        <h3 className="form-section-title">Основная информация</h3>
        <p className="form-section-description">Кратко опишите, что нужно сделать и зачем.</p>
        <div className="field-grid">
          <div className="ctf-field">
            <label className="ctf-label" htmlFor="ctf-title">
              Название задачи <span className="ctf-required" aria-hidden="true">*</span>
            </label>
            <input
              id="ctf-title"
              ref={titleRef}
              className={`input${fieldErrors.title ? " ctf-input--error" : ""}`}
              name="title"
              placeholder="Название задачи"
              autoComplete="off"
              onChange={() => { if (fieldErrors.title) setFieldErrors((p) => ({ ...p, title: undefined })); }}
            />
            {fieldErrors.title ? <span className="ctf-field-error">{fieldErrors.title}</span> : null}
          </div>
          <div className="ctf-field">
            <label className="ctf-label" htmlFor="ctf-description">Описание</label>
            <textarea id="ctf-description" className="input" name="description" rows={4} placeholder="Описание (опционально)" />
          </div>
        </div>
      </section>

      <section className="form-section">
        <h3 className="form-section-title">Параметры задачи</h3>
        <p className="form-section-description">Выберите объект и уровень приоритета.</p>
        <div className="field-row">
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
        </div>
      </section>

      <section className="form-section">
        <h3 className="form-section-title">Назначение и срок</h3>
        <p className="form-section-description">Укажите исполнителя и дедлайн.</p>
        <div className="field-row">
          <div className="ctf-field">
            <label className="ctf-label" htmlFor="ctf-due">Срок выполнения</label>
            <input id="ctf-due" className="input" type="datetime-local" name="due_at" />
          </div>
          <div className="ctf-field" ref={assigneeRef}>
            <label className="ctf-label">
              Исполнитель <span className="ctf-required" aria-hidden="true">*</span>
            </label>
            <div className={fieldErrors.assigned_to ? "ctf-combobox--error" : ""}>
              <AssigneeCombobox
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
        </div>
      </section>

      <section className="form-section">
        <h3 className="form-section-title">Команда задачи</h3>
        <p className="form-section-description">Дополнительные участники, которые смогут менять статус и работать с задачей.</p>
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
      </section>

      {Object.keys(fieldErrors).length > 0 ? (
        <div className="ctf-alert ctf-alert--error" role="alert">
          <span className="ctf-alert-icon" aria-hidden="true">✕</span>
          <span>Заполните обязательные поля</span>
        </div>
      ) : null}

      <div className="row">
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
