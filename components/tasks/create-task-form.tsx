"use client";

import { useState } from "react";
import { createTaskAction } from "@/app/actions/task-actions";
import type { ObjectItem, Profile } from "@/lib/types";
import { AssigneeCombobox, type AssigneeOption } from "@/components/ui/assignee-combobox";
import { TeamMembersPicker } from "@/components/tasks/team-members-picker";

export function CreateTaskForm({
  objects,
  assignees,
  teamCandidates
}: {
  objects: ObjectItem[];
  assignees: Array<Pick<Profile, "id" | "full_name"> & { email?: string | null }>;
  teamCandidates: Array<Pick<Profile, "id" | "full_name"> & { email?: string | null }>;
}) {
  const [selectedObjectId, setSelectedObjectId] = useState("");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [objectValidationError, setObjectValidationError] = useState<string | null>(null);
  const [assigneeValidationError, setAssigneeValidationError] = useState<string | null>(null);
  const assigneeOptions: AssigneeOption[] = assignees.map((assignee) => ({
    id: assignee.id,
    label: assignee.full_name,
    subtitle: assignee.email ?? null
  }));
  const objectOptions: AssigneeOption[] = objects.map((objectItem) => ({
    id: objectItem.id,
    label: objectItem.name
  }));
  const teamOptions: AssigneeOption[] = teamCandidates.map((member) => ({
    id: member.id,
    label: member.full_name,
    subtitle: member.email ?? null
  }));

  return (
    <form
      className="section-card grid"
      action={createTaskAction}
      onSubmit={(event) => {
        if (!selectedObjectId) {
          event.preventDefault();
          setObjectValidationError("Выберите объект из списка.");
          return;
        }
        if (!selectedAssigneeId) {
          event.preventDefault();
          setAssigneeValidationError("Выберите исполнителя из списка.");
          return;
        }
        setObjectValidationError(null);
        setAssigneeValidationError(null);
      }}
    >
      <section className="form-section">
        <h3 className="form-section-title">Основная информация</h3>
        <p className="form-section-description">Кратко опишите, что нужно сделать и зачем.</p>
        <div className="field-grid">
          <input className="input" name="title" placeholder="Название задачи" required />
          <textarea className="input" name="description" rows={4} placeholder="Описание (опционально)" />
        </div>
      </section>

      <section className="form-section">
        <h3 className="form-section-title">Параметры задачи</h3>
        <p className="form-section-description">Выберите объект и уровень приоритета.</p>
        <div className="field-row">
          <AssigneeCombobox
            name="object_id"
            options={objectOptions}
            placeholder="Выберите объект"
            required
            onSelectedIdChange={(id) => {
              setSelectedObjectId(id);
              if (id) setObjectValidationError(null);
            }}
          />
          <select className="select" name="priority" defaultValue="medium">
            <option value="low">Низкий</option>
            <option value="medium">Средний</option>
            <option value="high">Высокий</option>
            <option value="critical">Критический</option>
          </select>
        </div>
        {objectValidationError ? <div className="text-soft">{objectValidationError}</div> : null}
      </section>

      <section className="form-section">
        <h3 className="form-section-title">Назначение и срок</h3>
        <p className="form-section-description">Укажите исполнителя и дедлайн.</p>
        <div className="field-row">
          <input className="input" type="datetime-local" name="due_at" />
          <AssigneeCombobox
            name="assigned_to"
            options={assigneeOptions}
            required
            onSelectedIdChange={(id) => {
              setSelectedAssigneeId(id);
              if (id) {
                setSelectedTeamIds((prev) => prev.filter((memberId) => memberId !== id));
              }
              if (id) setAssigneeValidationError(null);
            }}
          />
        </div>
        {assigneeValidationError ? <div className="text-soft">{assigneeValidationError}</div> : null}
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

      <div className="row">
        <button className="btn btn-accent" type="submit">
          Создать задачу
        </button>
      </div>
    </form>
  );
}
