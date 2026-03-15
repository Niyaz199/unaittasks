"use client";

import { useEffect, useMemo, useState } from "react";
import { PprFormGroup, PprFormSection } from "@/components/ppr/ui/ppr-modal";

type ObjectOption = { id: string; name: string };
type SystemOption = { id: string; object_id: string; name: string };

type ChecklistItemFormValue = {
  title: string;
  description: string;
};

type TemplateFormValues = {
  object_id: string;
  system_id: string;
  name: string;
  description: string;
  period_months: number;
  base_start_date: string;
  norm_hours: string;
  methodology: string;
  is_active: boolean;
  checklist_items: ChecklistItemFormValue[];
};

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  objects: ObjectOption[];
  systems: SystemOption[];
  initialValues?: Partial<TemplateFormValues>;
  templateId?: string;
  submitLabel: string;
  onSubmitted?: () => void;
  onChange?: () => void;
  inModal?: boolean;
};

const defaultValues: TemplateFormValues = {
  object_id: "",
  system_id: "",
  name: "",
  description: "",
  period_months: 12,
  base_start_date: "",
  norm_hours: "",
  methodology: "",
  is_active: true,
  checklist_items: [{ title: "", description: "" }],
};

export function PprTemplateEditor({
  action,
  objects,
  systems,
  initialValues,
  templateId,
  submitLabel,
  onSubmitted,
  onChange,
  inModal = false,
}: Props) {
  const values = { ...defaultValues, ...initialValues };
  const [selectedObjectId, setSelectedObjectId] = useState(values.object_id);
  const [selectedSystemId, setSelectedSystemId] = useState(values.system_id);
  const [checklistItems, setChecklistItems] = useState<ChecklistItemFormValue[]>(
    values.checklist_items.length ? values.checklist_items : defaultValues.checklist_items
  );

  const filteredSystems = useMemo(
    () => systems.filter((item) => !selectedObjectId || item.object_id === selectedObjectId),
    [selectedObjectId, systems]
  );

  useEffect(() => {
    if (selectedSystemId && !filteredSystems.some((item) => item.id === selectedSystemId)) {
      setSelectedSystemId("");
    }
  }, [filteredSystems, selectedSystemId]);

  function updateChecklistItem(index: number, patch: Partial<ChecklistItemFormValue>) {
    setChecklistItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addChecklistItem() {
    setChecklistItems((current) => [...current, { title: "", description: "" }]);
  }

  function removeChecklistItem(index: number) {
    setChecklistItems((current) => {
      if (current.length === 1) return [{ title: "", description: "" }];
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  return (
    <form action={action} className={inModal ? "ppr-modal-content" : "grid"} onSubmit={onSubmitted} onChange={onChange}>
      <div className={inModal ? "ppr-modal-body grid" : "grid"} style={{ gap: "2rem", padding: inModal ? 0 : "1rem" }}>
        {templateId ? <input type="hidden" name="template_id" value={templateId} /> : null}

        <PprFormSection title="Привязка">
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <PprFormGroup label="Объект">
              <select
                className="select"
                name="object_id"
                required
                value={selectedObjectId}
                onChange={(event) => setSelectedObjectId(event.target.value)}
              >
                <option value="" disabled>Выберите объект</option>
                {objects.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </PprFormGroup>

            <PprFormGroup label="Система">
              <select
                className="select"
                name="system_id"
                required
                value={selectedSystemId}
                onChange={(event) => setSelectedSystemId(event.target.value)}
              >
                <option value="" disabled>Выберите систему</option>
                {filteredSystems.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </PprFormGroup>
          </div>
        </PprFormSection>

        <PprFormSection title="Основная информация">
          <PprFormGroup label="Название шаблона">
            <input className="input" name="name" defaultValue={values.name} placeholder="Полное наименование шаблона" required />
          </PprFormGroup>

          <PprFormGroup label="Описание">
            <textarea className="input" name="description" rows={3} defaultValue={values.description} placeholder="Цель шаблона, рекомендации..." />
          </PprFormGroup>
          
          <label className="row" style={{ alignItems: "center", gap: "0.5rem" }}>
            <input type="checkbox" name="is_active" defaultChecked={values.is_active} />
            Активен
          </label>
        </PprFormSection>

        <PprFormSection title="Параметры выполнения">
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
            <PprFormGroup label="Периодичность (мес.)">
              <input className="input" type="number" name="period_months" min={1} defaultValue={values.period_months} required />
            </PprFormGroup>

            <PprFormGroup label="Базовая дата отсчёта">
              <input className="input" type="date" name="base_start_date" defaultValue={values.base_start_date} required />
            </PprFormGroup>

            <PprFormGroup label="Нормо-часы">
              <input className="input" type="number" step="0.01" min={0} name="norm_hours" defaultValue={values.norm_hours} placeholder="Оценка времени" />
            </PprFormGroup>
          </div>

          <PprFormGroup label="Методика выполнения">
            <textarea className="input" name="methodology" rows={4} defaultValue={values.methodology} placeholder="Специфика выполнения работ по данному шаблону" />
          </PprFormGroup>
        </PprFormSection>

        <PprFormSection title="Чек-лист" desc="Задачи, подлежащие обязательному выполнению во время ремонта.">
          <div className="grid" style={{ gap: "0.75rem" }}>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" type="button" onClick={addChecklistItem}>
                + Добавить пункт
              </button>
            </div>

          {checklistItems.map((item, index) => (
            <div key={index} className="section-card">
              <div className="grid" style={{ gap: "0.6rem" }}>
                <input type="hidden" name="checklist_sort_order" value={index + 1} />
                <input
                  className="input"
                  name="checklist_title"
                  value={item.title}
                  onChange={(event) => updateChecklistItem(index, { title: event.target.value })}
                  placeholder={`Пункт ${index + 1} (кратко)`}
                  required
                />
                <textarea
                  className="input"
                  name="checklist_description"
                  rows={2}
                  value={item.description}
                  onChange={(event) => updateChecklistItem(index, { description: event.target.value })}
                  placeholder="Подробное описание работы..."
                />
                <div className="row">
                  <button className="btn btn-ghost" type="button" onClick={() => removeChecklistItem(index)}>
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          ))}
          </div>
        </PprFormSection>
      </div>

      <div className={inModal ? "ppr-modal-footer" : ""} style={inModal ? {} : { padding: "1rem", borderTop: "1px solid color-mix(in srgb, var(--line-strong) 40%, transparent)", background: "color-mix(in srgb, var(--panel) 30%, transparent)", display: "flex", justifyContent: "flex-end", borderRadius: "0 0 12px 12px" }}>
        <button className="btn btn-accent" type="submit" style={inModal ? {} : { padding: "0.6rem 1.5rem", fontSize: "1rem" }}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
