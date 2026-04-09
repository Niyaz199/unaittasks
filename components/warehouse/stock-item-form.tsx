"use client";

import { useState } from "react";
import { PprFormGroup, PprFormSection } from "@/components/ppr/ui/ppr-modal";
import { useToast } from "@/components/ui/toast";
import { stockItemKindMeta } from "@/lib/warehouse/presentation";

type ObjectOption = { id: string; name: string };

type StockItemFormValues = {
  object_id: string;
  name: string;
  kind: "material" | "spare_part" | "consumable" | "component";
  unit: string;
  sku: string;
  min_qty: string;
  comment: string;
  is_active: boolean;
};

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  objects: ObjectOption[];
  initialValues?: Partial<StockItemFormValues>;
  itemId?: string;
  onSubmitted?: () => void;
  onChange?: () => void;
  submitLabel: string;
};

const defaultValues: StockItemFormValues = {
  object_id: "",
  name: "",
  kind: "material",
  unit: "шт",
  sku: "",
  min_qty: "0",
  comment: "",
  is_active: true,
};

export function StockItemForm({
  action,
  objects,
  initialValues,
  itemId,
  onSubmitted,
  onChange,
  submitLabel,
}: Props) {
  const values = { ...defaultValues, ...initialValues };
  const [selectedObjectId, setSelectedObjectId] = useState(values.object_id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await action(new FormData(event.currentTarget));
      addToast(itemId ? "ТМЦ обновлена" : "ТМЦ создана", "success");
      onSubmitted?.();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Не удалось сохранить ТМЦ", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} onChange={onChange} className="ppr-modal-content">
      <div className="ppr-modal-body grid">
        {itemId ? <input type="hidden" name="item_id" value={itemId} /> : null}

        <PprFormSection title="Карточка ТМЦ" desc="Материал, расходник или запасная часть объекта">
          <PprFormGroup label="Объект">
            <select
              className="select"
              name="object_id"
              required
              value={selectedObjectId}
              onChange={(event) => setSelectedObjectId(event.target.value)}
            >
              <option value="" disabled>
                Выберите объект
              </option>
              {objects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </PprFormGroup>

          <PprFormGroup label="Название">
            <input className="input" name="name" defaultValue={values.name} placeholder="Например: Блок питания ATX 500W" required />
          </PprFormGroup>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <PprFormGroup label="Тип">
              <select className="select" name="kind" defaultValue={values.kind}>
                {Object.entries(stockItemKindMeta).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </PprFormGroup>

            <PprFormGroup label="Ед. изм.">
              <input className="input" name="unit" defaultValue={values.unit} placeholder="шт / м / упак." required />
            </PprFormGroup>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <PprFormGroup label="Артикул / SKU">
              <input className="input" name="sku" defaultValue={values.sku} placeholder="Необязательно" />
            </PprFormGroup>

            <PprFormGroup label="Мин. остаток">
              <input className="input" name="min_qty" type="number" min="0" step="0.001" defaultValue={values.min_qty} required />
            </PprFormGroup>
          </div>

          <PprFormGroup label="Комментарий">
            <textarea className="input" name="comment" rows={3} defaultValue={values.comment} placeholder="Примечание по хранению или применению" />
          </PprFormGroup>

          <label className="row" style={{ gap: "0.6rem", alignItems: "center" }}>
            <input type="checkbox" name="is_active" defaultChecked={values.is_active} />
            <span>Активная карточка</span>
          </label>
        </PprFormSection>
      </div>

      <div className="ppr-modal-footer">
        <button className="btn btn-accent" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Сохранение..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
