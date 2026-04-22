"use client";

import { useEffect, useMemo, useState } from "react";
import { PlusCircle, Trash2 } from "lucide-react";
import { PprFormGroup, PprFormSection } from "@/components/ppr/ui/ppr-modal";
import { useToast } from "@/components/ui/toast";
import { procurementMethodMeta, stockItemKindMeta } from "@/lib/warehouse/presentation";
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox";

type ObjectOption = { id: string; name: string };
type LocationOption = { id: string; object_id: string; name: string; is_active?: boolean };
type SystemGroupOption = { id: string; name: string; code: string; is_active?: boolean };
type PprTemplateOption = { id: string; name: string; object_id: string; system_id: string; system_group_id: string };

type PprLinkRow = { template_id: string; required_qty: string };

type StockItemFormValues = {
  object_id: string;
  name: string;
  kind: "zip" | "component";
  is_spare_part: boolean;
  procurement_method: "engineer" | "procurement";
  unit: string;
  sku: string;
  min_qty: string;
  storage_location_id: string;
  system_group_ids: string[];
  ppr_template_links: PprLinkRow[];
  initial_qty: string;
  comment: string;
  is_active: boolean;
};

type Props = {
  action: (formData: FormData) => void | Promise<void> | { id?: string } | Promise<{ id?: string }>;
  objects: ObjectOption[];
  locations: LocationOption[];
  systemGroups: SystemGroupOption[];
  pprTemplates?: PprTemplateOption[];
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
  kind: "zip",
  is_spare_part: false,
  procurement_method: "engineer",
  unit: "шт",
  sku: "",
  min_qty: "0",
  storage_location_id: "",
  system_group_ids: [],
  ppr_template_links: [],
  initial_qty: "",
  comment: "",
  is_active: true,
};

export function StockItemForm({
  action,
  objects,
  locations,
  systemGroups,
  pprTemplates = [],
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
  const [selectedKind, setSelectedKind] = useState<StockItemFormValues["kind"]>(values.kind);
  const [isSparePart, setIsSparePart] = useState(values.is_spare_part);
  const [selectedSystemGroupIds, setSelectedSystemGroupIds] = useState<string[]>(values.system_group_ids);
  const [isPprItem, setIsPprItem] = useState(values.ppr_template_links.length > 0);
  const [pprLinks, setPprLinks] = useState<PprLinkRow[]>(
    values.ppr_template_links.length > 0 ? values.ppr_template_links : [{ template_id: "", required_qty: "1" }]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();
  const needsStorage = selectedKind === "zip" || (selectedKind === "component" && isSparePart);

  const filteredLocations = useMemo(
    () => locations.filter((item) => item.object_id === selectedObjectId),
    [locations, selectedObjectId]
  );

  // PPR templates filtered by selected object and system groups
  const availablePprTemplates = useMemo(() => {
    return pprTemplates.filter((t) => {
      if (selectedObjectId && t.object_id !== selectedObjectId) return false;
      if (selectedSystemGroupIds.length === 0) return true;
      return selectedSystemGroupIds.includes(t.system_group_id);
    });
  }, [pprTemplates, selectedObjectId, selectedSystemGroupIds]);

  useEffect(() => {
    if (fixedObjectId && selectedObjectId !== fixedObjectId) {
      setSelectedObjectId(fixedObjectId);
    }
  }, [fixedObjectId, selectedObjectId]);

  useEffect(() => {
    if (filteredLocations.some((item) => item.id === selectedLocationId)) return;
    setSelectedLocationId(needsStorage ? (filteredLocations[0]?.id ?? "") : "");
  }, [filteredLocations, needsStorage, selectedLocationId]);

  useEffect(() => {
    if (needsStorage) {
      if (!selectedLocationId && filteredLocations[0]?.id) {
        setSelectedLocationId(filteredLocations[0].id);
      }
      return;
    }
    if (selectedLocationId) {
      setSelectedLocationId("");
    }
  }, [filteredLocations, needsStorage, selectedLocationId]);

  // When system groups or object changes, clear PPR links that reference now-unavailable templates
  useEffect(() => {
    if (!isPprItem) return;
    const availableIds = new Set(availablePprTemplates.map((t) => t.id));
    setPprLinks((prev) => {
      const filtered = prev.filter((link) => !link.template_id || availableIds.has(link.template_id));
      return filtered.length > 0 ? filtered : [{ template_id: "", required_qty: "1" }];
    });
  }, [availablePprTemplates, isPprItem]);

  function addPprLink() {
    setPprLinks((prev) => [...prev, { template_id: "", required_qty: "1" }]);
    onChange?.();
  }

  function removePprLink(index: number) {
    setPprLinks((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [{ template_id: "", required_qty: "1" }];
    });
    onChange?.();
  }

  function updatePprLink(index: number, field: keyof PprLinkRow, value: string) {
    setPprLinks((prev) => prev.map((link, i) => (i === index ? { ...link, [field]: value } : link)));
    onChange?.();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData(event.currentTarget);

      // Inject PPR links into FormData (parallel arrays, handled by the action)
      if (isPprItem) {
        for (const link of pprLinks) {
          if (link.template_id && link.required_qty) {
            formData.append("ppr_link_template_id", link.template_id);
            formData.append("ppr_link_required_qty", link.required_qty);
          }
        }
      }

      const result = await action(formData);
      addToast(itemId ? "ТМЦ обновлена" : "ТМЦ создана", "success");
      onSubmitted?.(result && typeof result === "object" ? result : undefined);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Не удалось сохранить ТМЦ", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const usedTemplateIds = new Set(pprLinks.map((l) => l.template_id).filter(Boolean));

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
              <select
                className="select"
                name="kind"
                value={selectedKind}
                onChange={(event) => setSelectedKind(event.target.value as StockItemFormValues["kind"])}
              >
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

          {selectedKind === "component" ? (
            <label className="row" style={{ gap: "0.8rem", alignItems: "center" }}>
              <input type="checkbox" name="is_spare_part" checked={isSparePart} onChange={(event) => setIsSparePart(event.target.checked)} />
              <span>Этот компонент также относится к ЗИП</span>
            </label>
          ) : null}

          <PprFormGroup label="Метод закупки">
            <select className="select" name="procurement_method" defaultValue={values.procurement_method}>
              {Object.entries(procurementMethodMeta).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </PprFormGroup>

          <PprFormGroup label="Ед. изм.">
            <input className="input" name="unit" defaultValue={values.unit} placeholder="шт / м / упак." required />
          </PprFormGroup>
        </PprFormSection>

        {needsStorage ? (
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
        ) : (
          <input type="hidden" name="min_qty" value="0" />
        )}

        <PprFormSection title="Дополнительно" desc="Связи с системами и настройки">
          <PprFormGroup label="Привязка к группе систем" description="необязательно">
            <MultiSelectCombobox
              name="system_group_ids"
              options={systemGroups.map((g) => ({
                id: g.id,
                label: g.name,
                subtitle: g.code,
                is_active: g.is_active,
              }))}
              defaultValues={values.system_group_ids}
              placeholder="Выберите группы систем"
              onChange={setSelectedSystemGroupIds}
            />
          </PprFormGroup>

          {/* ── Участвует в ППР ── */}
          <label className="row" style={{ gap: "0.8rem", alignItems: "center", marginTop: "0.25rem" }}>
            <input
              type="checkbox"
              checked={isPprItem}
              onChange={(event) => {
                setIsPprItem(event.target.checked);
                if (!event.target.checked) {
                  setPprLinks([{ template_id: "", required_qty: "1" }]);
                }
                onChange?.();
              }}
            />
            <span>Участвует в ППР</span>
          </label>

          {isPprItem ? (
            <div className="grid" style={{ gap: "0.75rem", marginTop: "0.5rem" }}>
              <div className="text-soft" style={{ fontSize: "0.85rem" }}>
                Укажите шаблоны ППР, для выполнения которых нужна эта ТМЦ, и количество на одно выполнение.
                {selectedSystemGroupIds.length === 0 && availablePprTemplates.length === 0 && pprTemplates.length > 0 && (
                  <span style={{ color: "var(--warning)", marginLeft: "0.4rem" }}>
                    Выберите группу систем выше, чтобы видеть подходящие шаблоны.
                  </span>
                )}
              </div>

              {pprLinks.map((link, index) => {
                const optionsForRow = availablePprTemplates.filter(
                  (t) => !usedTemplateIds.has(t.id) || t.id === link.template_id
                );
                return (
                  <div key={index} className="row" style={{ gap: "0.6rem", alignItems: "flex-start" }}>
                    <div style={{ flex: "1 1 0", minWidth: 0 }}>
                      <select
                        className="select"
                        value={link.template_id}
                        onChange={(event) => updatePprLink(index, "template_id", event.target.value)}
                        required={isPprItem}
                      >
                        <option value="" disabled>
                          {availablePprTemplates.length > 0 ? "Выберите шаблон ППР" : "Нет доступных шаблонов"}
                        </option>
                        {optionsForRow.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ width: "110px", flexShrink: 0 }}>
                      <input
                        className="input"
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={link.required_qty}
                        onChange={(event) => updatePprLink(index, "required_qty", event.target.value)}
                        placeholder="Кол-во"
                        required={isPprItem && Boolean(link.template_id)}
                        title="Кол-во на одно выполнение"
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: "0.45rem", flexShrink: 0 }}
                      onClick={() => removePprLink(index)}
                      title="Удалить строку"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}

              <button
                type="button"
                className="btn btn-ghost"
                style={{ justifyContent: "flex-start", gap: "0.5rem", padding: "0.3rem 0" }}
                onClick={addPprLink}
                disabled={availablePprTemplates.length === 0 || pprLinks.length >= availablePprTemplates.length}
              >
                <PlusCircle size={15} />
                Добавить шаблон
              </button>
            </div>
          ) : null}

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
        <button className="btn btn-accent" type="submit" disabled={isSubmitting || !selectedObjectId || (needsStorage && !selectedLocationId)}>
          {isSubmitting ? "Сохранение..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
