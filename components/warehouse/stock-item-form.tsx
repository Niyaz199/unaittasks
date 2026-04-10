"use client";

import { useEffect, useMemo, useState } from "react";
import { PprFormGroup, PprFormSection } from "@/components/ppr/ui/ppr-modal";
import { useToast } from "@/components/ui/toast";
import { stockItemKindMeta } from "@/lib/warehouse/presentation";
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox";

type ObjectOption = { id: string; name: string };
type LocationOption = { id: string; object_id: string; name: string; is_active?: boolean };
type SystemGroupOption = { id: string; name: string; code: string; is_active?: boolean };

type StockItemFormValues = {
  object_id: string;
  name: string;
  kind: "material" | "spare_part" | "consumable" | "component";
  unit: string;
  sku: string;
  min_qty: string;
  storage_location_id: string;
  system_group_ids: string[];
  initial_qty: string;
  comment: string;
  is_active: boolean;
};

type Props = {
  action: (formData: FormData) => void | Promise<void> | { id?: string } | Promise<{ id?: string }>;
  objects: ObjectOption[];
  locations: LocationOption[];
  systemGroups: SystemGroupOption[];
  initialValues?: Partial<StockItemFormValues>;
  itemId?: string;
  fixedObjectId?: string;
  fixedObjectName?: string;
  onSubmitted?: (result?: { id?: string } | void) => void;
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
  storage_location_id: "",
  system_group_ids: [],
  initial_qty: "",
  comment: "",
  is_active: true,
};

export function StockItemForm({
  action,
  objects,
  locations,
  systemGroups,
  initialValues,
  itemId,
  fixedObjectId,
  fixedObjectName,
  onSubmitted,
  onChange,
  submitLabel,
}: Props) {
  const values = { ...defaultValues, ...initialValues };
  const initialObjectId = fixedObjectId ?? values.object_id;
  const [selectedObjectId, setSelectedObjectId] = useState(initialObjectId);
  const [selectedLocationId, setSelectedLocationId] = useState(values.storage_location_id);
  const [selectedSystemGroupIds, setSelectedSystemGroupIds] = useState(values.system_group_ids);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();

  const filteredLocations = useMemo(
    () => locations.filter((item) => item.object_id === selectedObjectId),
    [locations, selectedObjectId]
  );

  useEffect(() => {
    if (fixedObjectId && selectedObjectId !== fixedObjectId) {
      setSelectedObjectId(fixedObjectId);
    }
  }, [fixedObjectId, selectedObjectId]);

  useEffect(() => {
    if (filteredLocations.some((item) => item.id === selectedLocationId)) return;
    setSelectedLocationId(filteredLocations[0]?.id ?? "");
  }, [filteredLocations, selectedLocationId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await action(new FormData(event.currentTarget));
      addToast(itemId ? "ТМЦ обновлена" : "ТМЦ создана", "success");
      onSubmitted?.(result && typeof result === "object" ? result : undefined);
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

        <PprFormSection title="Основная информация" desc="Базовые данные о карточке ТМЦ">
          <PprFormGroup label="Объект">
            {fixedObjectId ? (
              <>
                <input type="hidden" name="object_id" value={fixedObjectId} />
                <div className="input" style={{ display: "flex", alignItems: "center" }}>
                  {fixedObjectName ?? objects.find((item) => item.id === fixedObjectId)?.name ?? "Выбранный объект"}
                </div>
              </>
            ) : (
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
            )}
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

            <PprFormGroup label="Артикул / SKU">
              <input className="input" name="sku" defaultValue={values.sku} placeholder="Необязательно" />
            </PprFormGroup>
          </div>
        </PprFormSection>

        <PprFormSection title="Учет и хранение" desc="Где находится ТМЦ и как учитывается">
          <PprFormGroup label="Где хранится ТМЦ">
            <select
              className="select"
              name="storage_location_id"
              required
              value={selectedLocationId}
              onChange={(event) => setSelectedLocationId(event.target.value)}
              disabled={!filteredLocations.length}
            >
              <option value="" disabled>
                {selectedObjectId ? "Выберите место хранения" : "Сначала выберите объект"}
              </option>
              {filteredLocations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.is_active === false ? " (неактивно)" : ""}
                </option>
              ))}
            </select>
          </PprFormGroup>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <PprFormGroup label="Ед. изм.">
              <input className="input" name="unit" defaultValue={values.unit} placeholder="шт / м / упак." required />
            </PprFormGroup>

            <PprFormGroup label="Мин. остаток">
              <input className="input" name="min_qty" type="number" min="0" step="0.001" defaultValue={values.min_qty} required />
            </PprFormGroup>
          </div>

          {!itemId ? (
            <PprFormGroup label="Стартовый остаток" description="необязательно">
              <input className="input" name="initial_qty" type="number" min="0" step="0.001" defaultValue={values.initial_qty} placeholder="Если известно количество на складе" />
            </PprFormGroup>
          ) : null}
        </PprFormSection>

        <PprFormSection title="Дополнительно" desc="Связи с системами и настройки">
          <PprFormGroup label="Привязка к группе систем" description="необязательно">
            <MultiSelectCombobox
              name="system_group_ids"
              options={systemGroups.map(g => ({
                id: g.id,
                label: g.name,
                subtitle: g.code,
                is_active: g.is_active
              }))}
              defaultValues={values.system_group_ids}
              placeholder="Выберите группы систем"
            />
          </PprFormGroup>

          <PprFormGroup label="Комментарий">
            <textarea className="input" name="comment" rows={3} defaultValue={values.comment} placeholder="Примечание по хранению или применению" />
          </PprFormGroup>

          <label className="row" style={{ gap: "0.8rem", alignItems: "center", marginTop: "0.5rem" }}>
            <label className="toggle-switch">
              <input type="checkbox" name="is_active" defaultChecked={values.is_active} />
              <span className="toggle-slider"></span>
            </label>
            <span style={{ fontWeight: 500 }}>Активная карточка</span>
          </label>
        </PprFormSection>
      </div>

      <div className="ppr-modal-footer">
        <button className="btn btn-accent" type="submit" disabled={isSubmitting || !selectedObjectId || !selectedLocationId}>
          {isSubmitting ? "Сохранение..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
