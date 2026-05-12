"use client";

import { useMemo, useState } from "react";
import { PprFormGroup, PprFormSection } from "@/components/ppr/ui/ppr-modal";
import { useToast } from "@/components/ui/toast";
import { AssigneeCombobox, type AssigneeOption } from "@/components/ui/assignee-combobox";

type ObjectOption = { id: string; name: string };
type StockItemOption = { id: string; object_id: string; name: string; unit: string; is_active: boolean };

type PurchaseRequestFormValues = {
  object_id: string;
  stock_item_id: string;
  title: string;
  unit: string;
  quantity_requested: string;
  note: string;
  description: string;
};

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  objects: ObjectOption[];
  stockItems: StockItemOption[];
  onSubmitted?: () => void;
  onChange?: () => void;
  submitLabel: string;
  initialValues?: Partial<PurchaseRequestFormValues>;
};

const defaultValues: PurchaseRequestFormValues = {
  object_id: "",
  stock_item_id: "",
  title: "",
  unit: "шт",
  quantity_requested: "1",
  note: "",
  description: "",
};

export function PurchaseRequestForm({
  action,
  objects,
  stockItems,
  onSubmitted,
  onChange,
  submitLabel,
  initialValues,
}: Props) {
  const values = { ...defaultValues, ...initialValues };
  const [selectedObjectId, setSelectedObjectId] = useState(values.object_id);
  const [selectedStockItemId, setSelectedStockItemId] = useState(values.stock_item_id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();

  const filteredItems = useMemo(
    () => stockItems.filter((item) => !selectedObjectId || item.object_id === selectedObjectId),
    [selectedObjectId, stockItems]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await action(new FormData(event.currentTarget));
      addToast("Заявка на закупку создана", "success");
      onSubmitted?.();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Не удалось создать заявку", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} onChange={onChange} className="ppr-modal-content">
      <div className="ppr-modal-body grid">
        <PprFormSection title="Новая заявка на закупку" desc="Любой сотрудник может оставить потребность инженеру объекта">
          <PprFormGroup label="Объект">
            <AssigneeCombobox
              name="object_id"
              placeholder="Выберите объект"
              required
              defaultValue={selectedObjectId}
              selectionHint="Выберите объект из списка"
              options={objects.map<AssigneeOption>((item) => ({
                id: item.id,
                label: item.name,
              }))}
              onSelectedIdChange={(id) => {
                setSelectedObjectId(id);
                if (selectedStockItemId && !filteredItems.some((item) => item.id === selectedStockItemId)) {
                  setSelectedStockItemId("");
                }
              }}
            />
          </PprFormGroup>

          <PprFormGroup label="ТМЦ из каталога" description="необязательно">
            <AssigneeCombobox
              key={`stock-${selectedObjectId || "any"}`}
              name="stock_item_id"
              placeholder="Без привязки к карточке ТМЦ"
              defaultValue={selectedStockItemId}
              selectionHint="Выберите ТМЦ из списка"
              options={filteredItems.map<AssigneeOption>((item) => ({
                id: item.id,
                label: [item.name, item.is_active ? null : "(неактивна)"].filter(Boolean).join(" • "),
              }))}
              onSelectedIdChange={(id) => setSelectedStockItemId(id)}
            />
          </PprFormGroup>

          <div className="grid" style={{ gridTemplateColumns: "1.6fr 0.6fr 0.8fr", gap: "1rem" }}>
            <PprFormGroup label="Что нужно купить">
              <input className="input" name="title" defaultValue={values.title} placeholder="Например: Кабель ВВГнг 3х2.5 / Лампа Е27" required />
            </PprFormGroup>

            <PprFormGroup label="Ед. изм.">
              <input className="input" name="unit" defaultValue={values.unit} placeholder="шт" required />
            </PprFormGroup>

            <PprFormGroup label="Количество">
              <input className="input" name="quantity_requested" type="number" min="0.001" step="0.001" defaultValue={values.quantity_requested} required />
            </PprFormGroup>
          </div>

          <PprFormGroup label="Комментарий к позиции">
            <textarea className="input" name="note" rows={2} defaultValue={values.note} placeholder="Например: для срочной замены на объекте" />
          </PprFormGroup>

          <PprFormGroup label="Общий комментарий">
            <textarea className="input" name="description" rows={3} defaultValue={values.description} placeholder="Дополнительная информация для инженера объекта" />
          </PprFormGroup>
        </PprFormSection>
      </div>

      <div className="ppr-modal-footer">
        <button className="btn btn-accent" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Создание..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
