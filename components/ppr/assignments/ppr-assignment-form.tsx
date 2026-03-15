"use client";

import { useEffect, useMemo, useState } from "react";
import { PprFormGroup, PprFormSection } from "@/components/ppr/ui/ppr-modal";

type ObjectOption = { id: string; name: string };
type EquipmentOption = { id: string; object_id: string; system_id: string; name: string; inventory_no: string };
type TemplateOption = { id: string; object_id: string; system_id: string; name: string; period_months: number; base_start_date: string; is_active: boolean };

type AssignmentFormValues = {
  object_id: string;
  equipment_id: string;
  template_id: string;
  start_date: string;
  period_months: number;
  is_active: boolean;
};

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  objects: ObjectOption[];
  equipmentOptions: EquipmentOption[];
  templateOptions: TemplateOption[];
  initialValues?: Partial<AssignmentFormValues>;
  assignmentId?: string;
  submitLabel: string;
  onSubmitted?: () => void;
  onChange?: () => void;
};

const defaultValues: AssignmentFormValues = {
  object_id: "",
  equipment_id: "",
  template_id: "",
  start_date: "",
  period_months: 1,
  is_active: true,
};

export function PprAssignmentForm({
  action,
  objects,
  equipmentOptions,
  templateOptions,
  initialValues,
  assignmentId,
  submitLabel,
  onSubmitted,
  onChange,
}: Props) {
  const values = { ...defaultValues, ...initialValues };
  const [selectedObjectId, setSelectedObjectId] = useState(values.object_id);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(values.equipment_id);
  const [selectedTemplateId, setSelectedTemplateId] = useState(values.template_id);
  const [startDate, setStartDate] = useState(values.start_date);
  const [periodMonths, setPeriodMonths] = useState(String(values.period_months));

  const filteredEquipment = useMemo(
    () => equipmentOptions.filter((item) => !selectedObjectId || item.object_id === selectedObjectId),
    [equipmentOptions, selectedObjectId]
  );
  const selectedEquipment = filteredEquipment.find((item) => item.id === selectedEquipmentId) ?? null;

  const filteredTemplates = useMemo(
    () =>
      templateOptions.filter(
        (item) =>
          (!selectedObjectId || item.object_id === selectedObjectId) &&
          (!selectedEquipment || item.system_id === selectedEquipment.system_id)
      ),
    [templateOptions, selectedObjectId, selectedEquipment]
  );
  const selectedTemplate = filteredTemplates.find((item) => item.id === selectedTemplateId) ?? null;

  useEffect(() => {
    if (selectedEquipmentId && !filteredEquipment.some((item) => item.id === selectedEquipmentId)) {
      setSelectedEquipmentId("");
    }
  }, [filteredEquipment, selectedEquipmentId]);

  useEffect(() => {
    if (selectedTemplateId && !filteredTemplates.some((item) => item.id === selectedTemplateId)) {
      setSelectedTemplateId("");
    }
  }, [filteredTemplates, selectedTemplateId]);

  useEffect(() => {
    if (!assignmentId && selectedTemplate) {
      setStartDate(selectedTemplate.base_start_date);
      setPeriodMonths(String(selectedTemplate.period_months));
    }
  }, [assignmentId, selectedTemplate]);

  return (
    <form action={action} className="ppr-modal-content" onSubmit={onSubmitted} onChange={onChange}>
      <div className="ppr-modal-body grid">
        {assignmentId ? <input type="hidden" name="assignment_id" value={assignmentId} /> : null}

        <PprFormSection title="Оборудование">
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

          <PprFormGroup label="Оборудование">
            <select
              className="select"
              name="equipment_id"
              required
              value={selectedEquipmentId}
              onChange={(event) => setSelectedEquipmentId(event.target.value)}
            >
              <option value="" disabled>Выберите оборудование</option>
              {filteredEquipment.map((item) => (
                <option key={item.id} value={item.id}>{item.name} ({item.inventory_no})</option>
              ))}
            </select>
          </PprFormGroup>
        </PprFormSection>

        <PprFormSection title="Назначение шаблона">
          <PprFormGroup label="Шаблон ППР" description="Совместимость проверяется по объекту и системе.">
            <select
              className="select"
              name="template_id"
              required
              value={selectedTemplateId}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
            >
              <option value="" disabled>Выберите шаблон</option>
              {filteredTemplates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} {!item.is_active ? " (отключен)" : ""}
                </option>
              ))}
            </select>
          </PprFormGroup>
        </PprFormSection>

        <PprFormSection title="График выполнения">
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <PprFormGroup label="Дата первого цикла">
              <input className="input" type="date" name="start_date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </PprFormGroup>

            <PprFormGroup label="Периодичность (мес.)">
              <input
                className="input"
                type="number"
                name="period_months"
                min={1}
                required
                value={periodMonths}
                onChange={(event) => setPeriodMonths(event.target.value)}
              />
            </PprFormGroup>
          </div>

          <label className="row" style={{ alignItems: "center", gap: "0.5rem" }}>
            <input type="checkbox" name="is_active" defaultChecked={values.is_active} />
            Активно
          </label>
        </PprFormSection>
      </div>

      <div className="ppr-modal-footer">
        <button className="btn btn-accent" type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
