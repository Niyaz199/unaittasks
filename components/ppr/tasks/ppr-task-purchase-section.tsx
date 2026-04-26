"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PprModal } from "@/components/ppr/ui/ppr-modal";
import { useToast } from "@/components/ui/toast";
import { createPurchaseRequestFromPprTaskAction } from "@/app/actions/purchase-request-actions";

type ComponentItem = {
  id: string;
  name: string;
  kind: "zip" | "component";
  unit: string;
  min_qty: number;
  current_qty: number;
};

type ComponentRow = {
  id: string;
  stock_item_id: string;
  quantity: number;
  reserve_qty: number;
  is_critical: boolean;
  note: string | null;
  stock_item: ComponentItem | ComponentItem[] | null;
};

type LinkedRequestRow = {
  id: string;
  status: "new" | "in_progress" | "fulfilled" | "cancelled";
  description: string | null;
  created_at: string;
  items_count: number;
};

const statusMeta: Record<
  LinkedRequestRow["status"],
  { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }
> = {
  new: { label: "Новая", tone: "info" },
  in_progress: { label: "В работе", tone: "warning" },
  fulfilled: { label: "Выполнена", tone: "success" },
  cancelled: { label: "Отменена", tone: "neutral" },
};

function resolveItem(raw: ComponentItem | ComponentItem[] | null): ComponentItem | null {
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

function formatQty(value: number, unit: string) {
  return `${Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 3 })} ${unit}`;
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("ru-RU");
}

type DraftRow = {
  stockItemId: string;
  checked: boolean;
  quantity: string;
  note: string;
};

type Props = {
  taskId: string;
  components: ComponentRow[];
  linkedRequests: LinkedRequestRow[];
  canCreate: boolean;
  canLinkToRequests: boolean;
};

export function PprTaskPurchaseSection({ taskId, components, linkedRequests, canCreate, canLinkToRequests }: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [description, setDescription] = useState("");

  const initialDrafts = useMemo<DraftRow[]>(() => {
    return components
      .map((row) => {
        const item = resolveItem(row.stock_item);
        if (!item) return null;
        const needed = Math.max(0, item.min_qty - item.current_qty);
        const isLow = item.current_qty < item.min_qty;
        return {
          stockItemId: item.id,
          checked: isLow,
          quantity: (needed > 0 ? needed : row.quantity || 1).toString(),
          note: "",
        } satisfies DraftRow;
      })
      .filter((row): row is DraftRow => row !== null);
  }, [components]);

  const [drafts, setDrafts] = useState<DraftRow[]>(initialDrafts);

  function reset() {
    setDrafts(initialDrafts);
    setDescription("");
    setIsDirty(false);
  }

  function openDialog() {
    reset();
    setIsOpen(true);
  }

  function closeDialog() {
    setIsOpen(false);
    reset();
  }

  function updateDraft(index: number, patch: Partial<DraftRow>) {
    setIsDirty(true);
    setDrafts((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = drafts
      .filter((row) => row.checked)
      .map((row) => ({
        stockItemId: row.stockItemId,
        quantityRequested: Number(row.quantity),
        note: row.note.trim() || null,
      }));

    if (!payload.length) {
      addToast("Отметьте хотя бы одну позицию", "error");
      return;
    }
    if (payload.some((row) => !Number.isFinite(row.quantityRequested) || row.quantityRequested <= 0)) {
      addToast("Укажите положительное количество для всех отмеченных позиций", "error");
      return;
    }

    const formData = new FormData();
    formData.set("task_id", taskId);
    formData.set("description", description.trim());
    formData.set("items", JSON.stringify(payload));

    setIsSubmitting(true);
    try {
      await createPurchaseRequestFromPprTaskAction(formData);
      addToast("Заявка в снабжение создана", "success");
      setIsOpen(false);
      reset();
      router.refresh();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Не удалось создать заявку", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasComponents = components.length > 0;

  return (
    <>
      <div className="section-card grid" style={{ gap: "0.85rem", padding: "1.25rem 1.5rem", marginBottom: "1rem" }}>
        <div className="row" style={{ justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "flex-start" }}>
          <div className="grid" style={{ gap: "0.25rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600 }}>Заявки в снабжение</h3>
            <p className="text-soft" style={{ margin: 0, fontSize: "0.85rem" }}>
              Заказать недостающее ТМЦ под эту ППР-задачу.
            </p>
          </div>
          {canCreate ? (
            <button
              type="button"
              className="btn btn-accent"
              onClick={openDialog}
              disabled={!hasComponents}
              style={{ minHeight: 44, cursor: hasComponents ? "pointer" : "not-allowed" }}
            >
              Заказать ТМЦ
            </button>
          ) : null}
        </div>

        {linkedRequests.length ? (
          <div className="grid" style={{ gap: "0.5rem" }}>
            {linkedRequests.map((request) => {
              const meta = statusMeta[request.status];
              const body = (
                <div
                  className="row"
                  style={{
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    padding: "0.65rem 0.85rem",
                    border: "1px solid color-mix(in srgb, var(--line) 35%, transparent)",
                    borderRadius: "8px",
                    background: "color-mix(in srgb, var(--panel-soft) 25%, transparent)",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div className="grid" style={{ gap: "0.15rem", minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: "0.92rem" }}>
                      {request.description ?? "Заявка по ППР-задаче"}
                    </div>
                    <div className="text-soft" style={{ fontSize: "0.8rem" }}>
                      {formatDateTime(request.created_at)} · позиций: {request.items_count}
                    </div>
                  </div>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </div>
              );
              return canLinkToRequests ? (
                <Link
                  key={request.id}
                  href={`/purchase-requests/${request.id}` as Route}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  {body}
                </Link>
              ) : (
                <div key={request.id}>{body}</div>
              );
            })}
          </div>
        ) : (
          <div className="text-soft" style={{ fontSize: "0.88rem" }}>
            По задаче ещё не было заявок в снабжение.
          </div>
        )}

        {!hasComponents && canCreate ? (
          <div className="text-soft" style={{ fontSize: "0.85rem" }}>
            У оборудования пока не заполнен состав ТМЦ. Сначала добавьте составляющие на карточке оборудования.
          </div>
        ) : null}
      </div>

      <PprModal open={isOpen} onClose={closeDialog} title="Заявка в снабжение по задаче" isDirty={isDirty}>
        <form onSubmit={handleSubmit} className="ppr-modal-content">
          <div className="ppr-modal-body grid" style={{ gap: "0.75rem" }}>
            <label className="grid" style={{ gap: "0.35rem" }}>
              <span className="text-soft">Комментарий к заявке (необязательно)</span>
              <textarea
                className="input"
                rows={2}
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  setIsDirty(true);
                }}
                placeholder="Например: на ближайший визит"
              />
            </label>

            <div className="grid" style={{ gap: "0.5rem" }}>
              <div className="text-soft" style={{ fontSize: "0.85rem" }}>
                Отметьте нужные позиции и уточните количество. По умолчанию отмечены позиции с остатком ниже нормы.
              </div>
              {drafts.map((draft, index) => {
                const row = components.find((component) => {
                  const item = resolveItem(component.stock_item);
                  return item?.id === draft.stockItemId;
                });
                const item = row ? resolveItem(row.stock_item) : null;
                if (!item) return null;
                const isLow = item.current_qty < item.min_qty;
                return (
                  <label
                    key={draft.stockItemId}
                    className="row"
                    style={{
                      gap: "0.75rem",
                      alignItems: "flex-start",
                      padding: "0.6rem 0.8rem",
                      border: "1px solid color-mix(in srgb, var(--line) 35%, transparent)",
                      borderRadius: "8px",
                      background: draft.checked ? "color-mix(in srgb, var(--accent) 6%, transparent)" : "transparent",
                      cursor: "pointer",
                      minHeight: 56,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={draft.checked}
                      onChange={(event) => updateDraft(index, { checked: event.target.checked })}
                      style={{ marginTop: "0.25rem" }}
                    />
                    <div className="grid" style={{ gap: "0.3rem", flex: 1, minWidth: 0 }}>
                      <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontWeight: 500 }}>{item.name}</span>
                        {row?.is_critical ? <Badge tone="danger">Критичный</Badge> : null}
                        {isLow ? <Badge tone="warning">Запас под контролем</Badge> : null}
                      </div>
                      <div className="text-soft" style={{ fontSize: "0.82rem" }}>
                        На складе: {formatQty(item.current_qty, item.unit)} · минимум {formatQty(item.min_qty, item.unit)}
                      </div>
                      {draft.checked ? (
                        <div className="row" style={{ gap: "0.6rem", flexWrap: "wrap", alignItems: "center", marginTop: "0.15rem" }}>
                          <label className="row" style={{ gap: "0.35rem", alignItems: "center" }}>
                            <span className="text-soft" style={{ fontSize: "0.82rem" }}>К заказу:</span>
                            <input
                              className="input"
                              type="number"
                              min="0.001"
                              step="0.001"
                              value={draft.quantity}
                              onChange={(event) => updateDraft(index, { quantity: event.target.value })}
                              onClick={(event) => event.preventDefault()}
                              style={{ width: 110, minHeight: 36 }}
                            />
                            <span className="text-soft" style={{ fontSize: "0.82rem" }}>{item.unit}</span>
                          </label>
                          <input
                            className="input"
                            type="text"
                            placeholder="Комментарий к позиции"
                            value={draft.note}
                            onChange={(event) => updateDraft(index, { note: event.target.value })}
                            onClick={(event) => event.preventDefault()}
                            style={{ flex: 1, minWidth: 180, minHeight: 36 }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </label>
                );
              })}
              {!drafts.length ? (
                <div className="text-soft">Нет доступных позиций. Сначала добавьте составляющие на карточке оборудования.</div>
              ) : null}
            </div>
          </div>

          <div className="ppr-modal-footer">
            <button type="button" className="btn btn-ghost" onClick={closeDialog} disabled={isSubmitting}>
              Отмена
            </button>
            <button type="submit" className="btn btn-accent" disabled={isSubmitting || !drafts.some((row) => row.checked)}>
              {isSubmitting ? "Отправляем..." : "Создать заявку"}
            </button>
          </div>
        </form>
      </PprModal>
    </>
  );
}
