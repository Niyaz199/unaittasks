"use client";

import { useEffect, useMemo, useState } from "react";
import { PlusCircle, Trash2 } from "lucide-react";
import { PprFormGroup, PprFormSection } from "@/components/ppr/ui/ppr-modal";
import { useToast } from "@/components/ui/toast";
import { procurementMethodMeta, stockItemKindMeta } from "@/lib/warehouse/presentation";
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox";
import { EmptyStateAction } from "@/components/ui/empty-state-action";
import { AssigneeCombobox, type AssigneeOption } from "@/components/ui/assignee-combobox";

type ObjectOption = { id: string; name: string };
type LocationOption = { id: string; object_id: string; name: string; is_active?: boolean };
type SystemGroupOption = { id: string; name: string; code: string; is_active?: boolean };
type PprTemplateOption = { id: string; name: string; object_id: string; system_id: string; system_group_id: string };
type EquipmentOption = { id: string; name: string; dispatch_name?: string | null; inventory_no?: string | null; object_id: string };

type PprLinkRow = { template_id: string; required_qty: string };
type EquipmentLinkRow = { equipment_id: string; quantity: string; reserve_qty: string; is_critical: boolean; note: string };

type StockItemFormValues = {
  object_id: string;
  name: string;
  kind: "zip" | "component";
  is_spare_part: boolean;
  procurement_method: "engineer" | "procurement";
  unit: string;
  sku: string;
  manufacturer: string;
  model: string;
  description: string;
  min_qty: string;
  storage_location_id: string;
  system_group_ids: string[];
  ppr_template_links: PprLinkRow[];
  equipment_links: EquipmentLinkRow[];
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
  equipment?: EquipmentOption[];
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
  manufacturer: "",
  model: "",
  description: "",
  min_qty: "0",
  storage_location_id: "",
  system_group_ids: [],
  ppr_template_links: [],
  equipment_links: [],
  initial_qty: "",
  comment: "",
  is_active: true,
};

const kindDescriptions: Record<string, string> = {
  zip: "Расходники и запчасти — то, что заменяется при ремонте или заканчивается",
  component: "Оборудование и детали — то, что используется длительное время",
};

const procurementHints: Record<string, string> = {
  engineer: "Инженер сам закупает и привозит на объект",
  procurement: "Заявка уходит в отдел закупок — они организуют доставку",
};

export function StockItemForm({
  action,
  objects,
  locations,
  systemGroups,
  pprTemplates = [],
  equipment = [],
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
  const [selectedProcurement, setSelectedProcurement] = useState<StockItemFormValues["procurement_method"]>(values.procurement_method);
  const [isActive, setIsActive] = useState(values.is_active);
  const [selectedSystemGroupIds, setSelectedSystemGroupIds] = useState<string[]>(values.system_group_ids);
  const [isPprItem, setIsPprItem] = useState(values.ppr_template_links.length > 0);
  const [pprLinks, setPprLinks] = useState<PprLinkRow[]>(
    values.ppr_template_links.length > 0 ? values.ppr_template_links : [{ template_id: "", required_qty: "1" }]
  );
  const [isEquipmentComponent, setIsEquipmentComponent] = useState(values.equipment_links.length > 0);
  const [equipmentLinks, setEquipmentLinks] = useState<EquipmentLinkRow[]>(
    values.equipment_links.length > 0
      ? values.equipment_links
      : [{ equipment_id: "", quantity: "1", reserve_qty: "0", is_critical: false, note: "" }]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();
  const needsStorage = selectedKind === "zip" || (selectedKind === "component" && isSparePart);

  const filteredLocations = useMemo(
    () => locations.filter((item) => item.object_id === selectedObjectId),
    [locations, selectedObjectId]
  );

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

  useEffect(() => {
    if (!isPprItem) return;
    const availableIds = new Set(availablePprTemplates.map((t) => t.id));
    setPprLinks((prev) => {
      const filtered = prev.filter((link) => !link.template_id || availableIds.has(link.template_id));
      if (filtered.length === prev.length) return prev;
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

  const availableEquipment = useMemo(
    () => equipment.filter((item) => !selectedObjectId || item.object_id === selectedObjectId),
    [equipment, selectedObjectId]
  );

  const usedEquipmentIds = new Set(equipmentLinks.map((l) => l.equipment_id).filter(Boolean));

  function addEquipmentLink() {
    setEquipmentLinks((prev) => [...prev, { equipment_id: "", quantity: "1", reserve_qty: "0", is_critical: false, note: "" }]);
    onChange?.();
  }

  function removeEquipmentLink(index: number) {
    setEquipmentLinks((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0
        ? next
        : [{ equipment_id: "", quantity: "1", reserve_qty: "0", is_critical: false, note: "" }];
    });
    onChange?.();
  }

  function updateEquipmentLink<K extends keyof EquipmentLinkRow>(index: number, field: K, value: EquipmentLinkRow[K]) {
    setEquipmentLinks((prev) => prev.map((link, i) => (i === index ? { ...link, [field]: value } : link)));
    onChange?.();
  }

  useEffect(() => {
    if (!isEquipmentComponent) return;
    // При смене объекта чистим выбранные оборудования, которые больше не относятся к этому объекту.
    const availableIds = new Set(availableEquipment.map((e) => e.id));
    setEquipmentLinks((prev) => {
      const filtered = prev.map((link) =>
        link.equipment_id && !availableIds.has(link.equipment_id) ? { ...link, equipment_id: "" } : link
      );
      return filtered;
    });
  }, [availableEquipment, isEquipmentComponent]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData(event.currentTarget);
      if (isPprItem) {
        for (const link of pprLinks) {
          if (link.template_id && link.required_qty) {
            formData.append("ppr_link_template_id", link.template_id);
            formData.append("ppr_link_required_qty", link.required_qty);
          }
        }
      }
      if (isEquipmentComponent) {
        for (const link of equipmentLinks) {
          if (link.equipment_id && link.quantity) {
            formData.append("equipment_link_id", link.equipment_id);
            formData.append("equipment_link_qty", link.quantity);
            formData.append("equipment_link_reserve", link.reserve_qty || "0");
            formData.append("equipment_link_critical", link.is_critical ? "on" : "");
            formData.append("equipment_link_note", link.note || "");
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

        {/* ─── 1. Основная информация ─── */}
        <PprFormSection title="Основная информация" desc="Как называется этот товар и что он из себя представляет">

          {/* Объект */}
          <PprFormGroup label="Объект" hint="К какому объекту относится эта позиция">
            {fixedObjectId ? (
              <>
                <input type="hidden" name="object_id" value={fixedObjectId} />
                <div className="input" style={{ display: "flex", alignItems: "center" }}>
                  {fixedObjectName ?? objects.find((item) => item.id === fixedObjectId)?.name ?? "Выбранный объект"}
                </div>
              </>
            ) : (
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
                onSelectedIdChange={(id) => setSelectedObjectId(id)}
              />
            )}
          </PprFormGroup>

          {/* Название */}
          <PprFormGroup
            label="Название"
            hint="Конкретное наименование: производитель, модель, размер. Пример: «Фильтр воздушный Samsung DA-97» лучше, чем «Фильтр»"
          >
            <input
              className="input ctf-title-input"
              name="name"
              defaultValue={values.name}
              placeholder="Например: Блок питания ATX 500W"
              required
            />
          </PprFormGroup>

          {/* Тип — визуальные карточки вместо выпадающего списка */}
          <div className="ctf-field">
            <span className="ctf-label">Тип товара</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
              {(Object.entries(stockItemKindMeta) as [StockItemFormValues["kind"], { label: string }][]).map(([key, meta]) => {
                const active = selectedKind === key;
                return (
                  <label
                    key={key}
                    style={{
                      cursor: "pointer",
                      display: "grid",
                      gap: "0.3rem",
                      padding: "0.75rem 1rem",
                      borderRadius: "var(--radius)",
                      background: active
                        ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                        : "color-mix(in srgb, var(--panel-soft) 40%, transparent)",
                      boxShadow: active
                        ? "inset 0 0 0 2px var(--accent)"
                        : "inset 0 0 0 1px color-mix(in srgb, #8ea8d0 18%, transparent)",
                      transition: "box-shadow 0.15s, background 0.15s",
                    }}
                  >
                    <input
                      type="radio"
                      name="kind"
                      value={key}
                      checked={active}
                      onChange={() => setSelectedKind(key)}
                      style={{ display: "none" }}
                    />
                    <span style={{ fontWeight: 600, fontSize: "0.9rem", color: active ? "var(--accent)" : "var(--text)" }}>
                      {meta.label}
                    </span>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-soft)", lineHeight: 1.4 }}>
                      {kindDescriptions[key]}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Компонент также является ЗИП */}
          {selectedKind === "component" && (
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.65rem",
                cursor: "pointer",
                padding: "0.65rem 0.9rem",
                borderRadius: "var(--radius)",
                background: isSparePart
                  ? "color-mix(in srgb, var(--accent) 8%, transparent)"
                  : "color-mix(in srgb, var(--panel-soft) 30%, transparent)",
                boxShadow: isSparePart
                  ? "inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 50%, transparent)"
                  : "inset 0 0 0 1px color-mix(in srgb, #8ea8d0 14%, transparent)",
                transition: "background 0.15s, box-shadow 0.15s",
              }}
            >
              <input
                type="checkbox"
                name="is_spare_part"
                checked={isSparePart}
                onChange={(e) => setIsSparePart(e.target.checked)}
                style={{ marginTop: "0.1rem", flexShrink: 0 }}
              />
              <span style={{ display: "grid", gap: "0.15rem" }}>
                <span style={{ fontWeight: 500, fontSize: "0.875rem" }}>Этот компонент также относится к ЗИП</span>
                <span style={{ fontSize: "0.72rem", color: "var(--text-soft)", lineHeight: 1.4 }}>
                  Отметьте, если эта деталь заменяется как расходная часть
                </span>
              </span>
            </label>
          )}

          {/* Производитель и модель в 2 колонки */}
          <div className="ctf-assign-grid">
            <PprFormGroup label="Производитель" description="необязательно" hint="Например: Schneider Electric, Honeywell">
              <input className="input" name="manufacturer" defaultValue={values.manufacturer} placeholder="Напр.: Schneider Electric" />
            </PprFormGroup>

            <PprFormGroup label="Модель" description="необязательно" hint="Модель или обозначение по каталогу">
              <input className="input" name="model" defaultValue={values.model} placeholder="Напр.: ATV320U15N4C" />
            </PprFormGroup>
          </div>

          {/* Артикул и Ед. изм. в 2 колонки */}
          <div className="ctf-assign-grid">
            <PprFormGroup label="Артикул / SKU" description="необязательно" hint="Код из каталога поставщика или внутренний номер">
              <input className="input" name="sku" defaultValue={values.sku} placeholder="Напр.: ATX-500W-BE" />
            </PprFormGroup>

            <PprFormGroup label="Ед. изм." hint="В чём измеряется: шт, м, кг, л, упак.">
              <input className="input" name="unit" defaultValue={values.unit} placeholder="шт / м / упак." required />
            </PprFormGroup>
          </div>

          <PprFormGroup label="Описание" description="необязательно" hint="Характеристики, особенности установки, предостережения">
            <textarea
              className="input"
              name="description"
              defaultValue={values.description}
              rows={3}
              placeholder="Например: 3-фазный преобразователь частоты, 1.5 кВт, IP20"
            />
          </PprFormGroup>

          {/* Метод закупки */}
          <PprFormGroup label="Метод закупки" hint={procurementHints[selectedProcurement]}>
            <select
              className="select"
              name="procurement_method"
              value={selectedProcurement}
              onChange={(e) => setSelectedProcurement(e.target.value as StockItemFormValues["procurement_method"])}
            >
              {(Object.entries(procurementMethodMeta) as [string, { label: string }][]).map(([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              ))}
            </select>
          </PprFormGroup>
        </PprFormSection>

        {/* ─── 2. Учёт и хранение ─── */}
        {needsStorage ? (
          <PprFormSection title="Учёт и хранение" desc="Где находится товар и в каком количестве">
            {selectedObjectId && filteredLocations.length === 0 ? (
              <EmptyStateAction
                tone="warning"
                title="У этого объекта ещё нет мест хранения"
                description="Чтобы выбрать, где будет лежать ТМЦ, сначала создайте склад, шкаф или зону хранения."
                primary={{
                  label: "Создать место хранения",
                  href: `/warehouse/locations?objectId=${selectedObjectId}&new=1`,
                }}
              />
            ) : null}
            <PprFormGroup
              label="Место хранения"
              hint={
                !selectedObjectId
                  ? "Сначала выберите объект выше"
                  : filteredLocations.length === 0
                  ? "Откройте «Создать место хранения» выше — после создания вернитесь сюда."
                  : "Выберите полку, шкаф или зону, где хранится товар"
              }
            >
              <AssigneeCombobox
                key={`location-${selectedObjectId || "any"}`}
                name="storage_location_id"
                placeholder={selectedObjectId ? "Выберите место хранения" : "Сначала выберите объект"}
                required
                defaultValue={selectedLocationId}
                selectionHint="Выберите ячейку хранения из списка"
                options={filteredLocations.map<AssigneeOption>((item) => ({
                  id: item.id,
                  label: [item.name, item.is_active === false ? "(неактивно)" : null]
                    .filter(Boolean)
                    .join(" • "),
                }))}
                onSelectedIdChange={(id) => setSelectedLocationId(id)}
              />
            </PprFormGroup>

            <div className="ctf-assign-grid">
              <PprFormGroup label="Мин. остаток" hint="При снижении ниже этого значения появится предупреждение">
                <input className="input" name="min_qty" type="number" min="0" step="0.001" defaultValue={values.min_qty} required />
              </PprFormGroup>

              {!itemId && (
                <PprFormGroup label="Стартовый остаток" description="необязательно" hint="Введите, сколько уже есть на складе прямо сейчас">
                  <input className="input" name="initial_qty" type="number" min="0" step="0.001" defaultValue={values.initial_qty} placeholder="0" />
                </PprFormGroup>
              )}
            </div>
          </PprFormSection>
        ) : (
          <input type="hidden" name="min_qty" value="0" />
        )}

        {/* ─── 3. Дополнительно ─── */}
        <PprFormSection title="Дополнительно" desc="Необязательные связи и настройки">
          <PprFormGroup
            label="Группа инженерных систем"
            description="необязательно"
            hint="К какой системе объекта относится товар: вентиляция, электрика, сантехника и т.д."
          >
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

          {/* ── Привязка к оборудованию (составляющая) ── */}
          {equipment.length > 0 && (
            <>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.65rem",
                  cursor: "pointer",
                  padding: "0.65rem 0.9rem",
                  borderRadius: "var(--radius)",
                  background: isEquipmentComponent
                    ? "color-mix(in srgb, var(--accent) 8%, transparent)"
                    : "color-mix(in srgb, var(--panel-soft) 30%, transparent)",
                  boxShadow: isEquipmentComponent
                    ? "inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 45%, transparent)"
                    : "inset 0 0 0 1px color-mix(in srgb, #8ea8d0 14%, transparent)",
                  transition: "background 0.15s, box-shadow 0.15s",
                }}
              >
                <input
                  type="checkbox"
                  checked={isEquipmentComponent}
                  onChange={(event) => {
                    setIsEquipmentComponent(event.target.checked);
                    if (!event.target.checked) {
                      setEquipmentLinks([{ equipment_id: "", quantity: "1", reserve_qty: "0", is_critical: false, note: "" }]);
                    }
                    onChange?.();
                  }}
                  style={{ marginTop: "0.1rem", flexShrink: 0 }}
                />
                <span style={{ display: "grid", gap: "0.15rem" }}>
                  <span style={{ fontWeight: 500, fontSize: "0.875rem" }}>Является составляющей оборудования</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-soft)", lineHeight: 1.4 }}>
                    ТМЦ будет добавлена в состав выбранного оборудования сразу при создании.
                  </span>
                </span>
              </label>

              {isEquipmentComponent && (
                <div className="grid" style={{ gap: "0.75rem" }}>
                  {!selectedObjectId && (
                    <p className="text-soft" style={{ fontSize: "0.85rem", margin: 0, color: "var(--warning)" }}>
                      Сначала выберите объект выше, чтобы стали доступны его единицы оборудования.
                    </p>
                  )}
                  {selectedObjectId && availableEquipment.length === 0 && (
                    <p className="text-soft" style={{ fontSize: "0.85rem", margin: 0, color: "var(--warning)" }}>
                      У выбранного объекта пока нет оборудования.
                    </p>
                  )}
                  {selectedObjectId && availableEquipment.length > 0 && (
                    <>
                      <p className="text-soft" style={{ fontSize: "0.85rem", margin: 0 }}>
                        Укажите оборудование, штатное количество, резерв на складе и пометьте критичные компоненты.
                      </p>
                      {equipmentLinks.map((link, index) => {
                        const optionsForRow = availableEquipment.filter(
                          (e) => !usedEquipmentIds.has(e.id) || e.id === link.equipment_id
                        );
                        return (
                          <div
                            key={index}
                            className="section-card"
                            style={{ padding: "0.65rem 0.8rem", display: "grid", gap: "0.5rem" }}
                          >
                            <div className="row" style={{ gap: "0.6rem", alignItems: "flex-start" }}>
                              <div style={{ flex: "1 1 0", minWidth: 0 }}>
                                <AssigneeCombobox
                                  key={`equip-link-${index}-${selectedObjectId}-${optionsForRow.length}`}
                                  name={`__equipment_${index}`}
                                  placeholder="Выберите оборудование"
                                  required={isEquipmentComponent}
                                  defaultValue={link.equipment_id}
                                  selectionHint="Выберите оборудование из списка"
                                  options={optionsForRow.map<AssigneeOption>((e) => ({
                                    id: e.id,
                                    label: [e.dispatch_name || e.name, e.inventory_no ? `(${e.inventory_no})` : null]
                                      .filter(Boolean)
                                      .join(" "),
                                    subtitle: e.dispatch_name ? e.name : null,
                                  }))}
                                  onSelectedIdChange={(id) => updateEquipmentLink(index, "equipment_id", id)}
                                />
                              </div>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ padding: "0.45rem", flexShrink: 0 }}
                                onClick={() => removeEquipmentLink(index)}
                                title="Удалить строку"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                            <div
                              className="row"
                              style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}
                            >
                              <div style={{ width: "120px", display: "grid", gap: "0.2rem" }}>
                                <label className="text-soft" style={{ fontSize: "0.72rem" }}>Кол-во</label>
                                <input
                                  className="input"
                                  type="number"
                                  min="0.001"
                                  step="0.001"
                                  value={link.quantity}
                                  onChange={(e) => updateEquipmentLink(index, "quantity", e.target.value)}
                                  required={isEquipmentComponent && Boolean(link.equipment_id)}
                                />
                              </div>
                              <div style={{ width: "120px", display: "grid", gap: "0.2rem" }}>
                                <label className="text-soft" style={{ fontSize: "0.72rem" }}>Резерв на складе</label>
                                <input
                                  className="input"
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  value={link.reserve_qty}
                                  onChange={(e) => updateEquipmentLink(index, "reserve_qty", e.target.value)}
                                />
                              </div>
                              <label
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.4rem",
                                  cursor: "pointer",
                                  padding: "0.25rem 0.6rem",
                                  fontSize: "0.8rem",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={link.is_critical}
                                  onChange={(e) => updateEquipmentLink(index, "is_critical", e.target.checked)}
                                />
                                <span>Критичный</span>
                              </label>
                              <div style={{ flex: "1 1 200px", display: "grid", gap: "0.2rem" }}>
                                <label className="text-soft" style={{ fontSize: "0.72rem" }}>Комментарий</label>
                                <input
                                  className="input"
                                  type="text"
                                  value={link.note}
                                  onChange={(e) => updateEquipmentLink(index, "note", e.target.value)}
                                  placeholder="Напр.: заменяется раз в год"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ justifyContent: "flex-start", gap: "0.5rem", padding: "0.3rem 0" }}
                        onClick={addEquipmentLink}
                        disabled={equipmentLinks.length >= availableEquipment.length}
                      >
                        <PlusCircle size={15} />
                        Добавить ещё оборудование
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Участвует в ППР ── */}
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.65rem",
              cursor: "pointer",
              padding: "0.65rem 0.9rem",
              borderRadius: "var(--radius)",
              background: isPprItem
                ? "color-mix(in srgb, var(--accent) 8%, transparent)"
                : "color-mix(in srgb, var(--panel-soft) 30%, transparent)",
              boxShadow: isPprItem
                ? "inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 45%, transparent)"
                : "inset 0 0 0 1px color-mix(in srgb, #8ea8d0 14%, transparent)",
              transition: "background 0.15s, box-shadow 0.15s",
            }}
          >
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
              style={{ marginTop: "0.1rem", flexShrink: 0 }}
            />
            <span style={{ display: "grid", gap: "0.15rem" }}>
              <span style={{ fontWeight: 500, fontSize: "0.875rem" }}>Участвует в ППР</span>
              <span style={{ fontSize: "0.72rem", color: "var(--text-soft)", lineHeight: 1.4 }}>
                Отметьте, если этот товар нужен для планово-предупредительного ремонта
              </span>
            </span>
          </label>

          {isPprItem && (
            <div className="grid" style={{ gap: "0.75rem" }}>
              <p className="text-soft" style={{ fontSize: "0.85rem", margin: 0 }}>
                Укажите шаблоны ППР и количество на одно выполнение.
                {selectedSystemGroupIds.length === 0 && availablePprTemplates.length === 0 && pprTemplates.length > 0 && (
                  <span style={{ color: "var(--warning)", marginLeft: "0.4rem" }}>
                    Выберите группу систем выше, чтобы видеть подходящие шаблоны.
                  </span>
                )}
              </p>

              {pprLinks.map((link, index) => {
                const optionsForRow = availablePprTemplates.filter(
                  (t) => !usedTemplateIds.has(t.id) || t.id === link.template_id
                );
                return (
                  <div key={index} className="row" style={{ gap: "0.6rem", alignItems: "flex-start" }}>
                    <div style={{ flex: "1 1 0", minWidth: 0 }}>
                      <AssigneeCombobox
                        key={`ppr-link-${index}-${optionsForRow.length}`}
                        name={`__ppr_template_${index}`}
                        placeholder={availablePprTemplates.length > 0 ? "Выберите шаблон ППР" : "Нет доступных шаблонов"}
                        required={isPprItem}
                        defaultValue={link.template_id}
                        selectionHint="Выберите шаблон ППР из списка"
                        options={optionsForRow.map<AssigneeOption>((t) => ({
                          id: t.id,
                          label: t.name,
                        }))}
                        onSelectedIdChange={(id) => updatePprLink(index, "template_id", id)}
                      />
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
          )}

          <PprFormGroup
            label="Комментарий"
            description="необязательно"
            hint="Особенности хранения, применения или закупки"
          >
            <textarea
              className="input"
              name="comment"
              rows={3}
              defaultValue={values.comment}
              placeholder="Например: хранить в сухом месте, закупать только у проверенного поставщика"
            />
          </PprFormGroup>

          {/* Активная карточка */}
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.65rem",
              cursor: "pointer",
              padding: "0.65rem 0.9rem",
              borderRadius: "var(--radius)",
              background: isActive
                ? "color-mix(in srgb, var(--accent) 8%, transparent)"
                : "color-mix(in srgb, var(--panel-soft) 30%, transparent)",
              boxShadow: isActive
                ? "inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 45%, transparent)"
                : "inset 0 0 0 1px color-mix(in srgb, #8ea8d0 14%, transparent)",
              transition: "background 0.15s, box-shadow 0.15s",
            }}
          >
            <input
              type="checkbox"
              name="is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={{ marginTop: "0.1rem", flexShrink: 0 }}
            />
            <span style={{ display: "grid", gap: "0.15rem" }}>
              <span style={{ fontWeight: 500, fontSize: "0.875rem" }}>Активная карточка</span>
              <span style={{ fontSize: "0.72rem", color: "var(--text-soft)", lineHeight: 1.4 }}>
                {isActive
                  ? "Карточка видна в списках и доступна для движения товара"
                  : "Карточка скрыта из списков — товар нельзя выдать или принять"}
              </span>
            </span>
          </label>
        </PprFormSection>
      </div>

      <div className="ppr-modal-footer">
        <button
          className="btn btn-accent ctf-submit-btn"
          type="submit"
          disabled={isSubmitting || !selectedObjectId || (needsStorage && !selectedLocationId)}
        >
          {isSubmitting && <span className="ctf-spinner" />}
          {isSubmitting ? "Сохранение..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
