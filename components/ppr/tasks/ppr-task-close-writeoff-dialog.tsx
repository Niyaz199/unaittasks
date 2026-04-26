"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  closePprTaskWithWriteoffAction,
  type PprTaskCloseWriteoffResult,
  type PprTaskCloseWriteoffShortage,
} from "@/app/actions/ppr-task-actions";

type StockItemBrief = {
  id: string;
  name: string;
  unit: string;
  kind: "zip" | "component";
  current_qty: number;
};

type EquipmentComponentBrief = {
  id: string;
  stock_item_id: string;
  quantity: number;
  is_critical: boolean;
  stock_item: StockItemBrief | StockItemBrief[] | null;
};

type Props = {
  taskId: string;
  open: boolean;
  onClose: () => void;
  components: EquipmentComponentBrief[];
};

type Row = {
  stockItemId: string;
  name: string;
  unit: string;
  available: number;
  isCritical: boolean;
  checked: boolean;
  qty: string;
};

function resolveStockItem(component: EquipmentComponentBrief): StockItemBrief | null {
  const si = component.stock_item;
  if (!si) return null;
  if (Array.isArray(si)) return si[0] ?? null;
  return si;
}

export function PprTaskCloseWriteoffDialog({ taskId, open, onClose, components }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [skip, setSkip] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shortages, setShortages] = useState<PprTaskCloseWriteoffShortage[] | null>(null);

  const initialRows: Row[] = useMemo(() => {
    const byId = new Map<string, Row>();
    for (const c of components) {
      const si = resolveStockItem(c);
      if (!si) continue;
      if (byId.has(si.id)) continue;
      byId.set(si.id, {
        stockItemId: si.id,
        name: si.name,
        unit: si.unit,
        available: Number(si.current_qty) || 0,
        isCritical: c.is_critical,
        checked: false,
        qty: String(c.quantity ?? 1),
      });
    }
    return Array.from(byId.values());
  }, [components]);

  const [rows, setRows] = useState<Row[]>(initialRows);

  if (!open) return null;

  function updateRow(stockItemId: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.stockItemId === stockItemId ? { ...r, ...patch } : r)));
  }

  function handleClose() {
    if (pending) return;
    setErrorMessage(null);
    setShortages(null);
    onClose();
  }

  async function submit() {
    setErrorMessage(null);
    setShortages(null);

    const items = skip
      ? []
      : rows
          .filter((r) => r.checked)
          .map((r) => ({ stockItemId: r.stockItemId, quantity: Number(r.qty) }))
          .filter((i) => Number.isFinite(i.quantity) && i.quantity > 0);

    if (!skip && items.length === 0) {
      setErrorMessage(
        "Отметьте хотя бы одну позицию к списанию или включите «Ничего не расходовалось»."
      );
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("task_id", taskId);
        formData.set("skip", skip ? "1" : "0");
        formData.set("items", JSON.stringify(items));
        const result: PprTaskCloseWriteoffResult = await closePprTaskWithWriteoffAction(formData);

        if (result.shortages.length > 0) {
          setShortages(result.shortages);
        }

        router.refresh();

        if (result.shortages.length === 0) {
          onClose();
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Не удалось закрыть заявку");
      }
    });
  }

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1rem",
    zIndex: 50,
  };

  const modalStyle: React.CSSProperties = {
    background: "var(--panel)",
    borderRadius: "12px",
    maxWidth: "640px",
    width: "100%",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    border: "1px solid var(--line)",
  };

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="close-writeoff-title">
      <div style={modalStyle}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--line)" }}>
          <h2 id="close-writeoff-title" style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600 }}>
            Закрытие ППР-заявки
          </h2>
          <p className="text-soft" style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
            Отметьте ТМЦ, которые были израсходованы, или подтвердите, что расхода не было.
          </p>
        </div>

        <div style={{ padding: "1rem 1.25rem", overflow: "auto", display: "grid", gap: "0.75rem" }}>
          <label className="row" style={{ gap: "0.5rem", alignItems: "center", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={skip}
              onChange={(e) => setSkip(e.target.checked)}
              disabled={pending}
            />
            <span>Ничего не расходовалось</span>
          </label>

          {!skip ? (
            rows.length === 0 ? (
              <div className="text-soft" style={{ fontSize: "0.88rem" }}>
                У оборудования нет привязанных ТМЦ. Если что-то расходовалось — используйте ручное списание на складе.
              </div>
            ) : (
              <div className="grid" style={{ gap: "0.5rem" }}>
                {rows.map((row) => {
                  const qtyNum = Number(row.qty);
                  const qtyValid = Number.isFinite(qtyNum) && qtyNum > 0;
                  const overAvailable = qtyValid && qtyNum > row.available;
                  return (
                    <div
                      key={row.stockItemId}
                      className="row"
                      style={{
                        gap: "0.6rem",
                        alignItems: "flex-start",
                        padding: "0.55rem 0.6rem",
                        borderRadius: "8px",
                        border: "1px solid color-mix(in srgb, var(--line) 60%, transparent)",
                        background: row.checked
                          ? "color-mix(in srgb, var(--accent) 5%, transparent)"
                          : "transparent",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={row.checked}
                        onChange={(e) => updateRow(row.stockItemId, { checked: e.target.checked })}
                        disabled={pending}
                        style={{ marginTop: "0.35rem" }}
                      />
                      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                        <div style={{ fontSize: "0.92rem", fontWeight: 500 }}>
                          {row.name}
                          {row.isCritical ? (
                            <span
                              style={{
                                marginLeft: "0.5rem",
                                fontSize: "0.7rem",
                                color: "var(--danger)",
                                fontWeight: 500,
                              }}
                            >
                              критичный
                            </span>
                          ) : null}
                        </div>
                        <div className="text-soft" style={{ fontSize: "0.78rem", marginTop: "0.1rem" }}>
                          Остаток: {row.available} {row.unit}
                        </div>
                        {overAvailable ? (
                          <div
                            style={{
                              fontSize: "0.78rem",
                              color: "var(--warning, #f59e0b)",
                              marginTop: "0.15rem",
                            }}
                          >
                            Запрошено больше остатка — будет списано столько, сколько есть.
                          </div>
                        ) : null}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.001"
                          value={row.qty}
                          onChange={(e) => updateRow(row.stockItemId, { qty: e.target.value })}
                          disabled={pending || !row.checked}
                          style={{ width: "90px" }}
                        />
                        <span className="text-soft" style={{ fontSize: "0.82rem" }}>{row.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : null}

          {shortages && shortages.length > 0 ? (
            <div
              style={{
                padding: "0.6rem 0.75rem",
                borderRadius: "8px",
                background: "color-mix(in srgb, var(--warning, #f59e0b) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--warning, #f59e0b) 30%, transparent)",
                display: "grid",
                gap: "0.35rem",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                Заявка закрыта. Списание прошло частично:
              </div>
              <ul style={{ margin: 0, paddingLeft: "1.15rem", fontSize: "0.82rem" }}>
                {shortages.map((s) => (
                  <li key={s.stockItemId}>
                    {s.name}: запрошено {s.requested}, доступно {s.available} — {s.reason}.
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {errorMessage ? (
            <div
              style={{
                padding: "0.55rem 0.75rem",
                borderRadius: "6px",
                background: "color-mix(in srgb, var(--danger) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
                color: "var(--danger)",
                fontSize: "0.85rem",
              }}
            >
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div
          className="row"
          style={{
            padding: "0.75rem 1.25rem",
            borderTop: "1px solid var(--line)",
            justifyContent: "flex-end",
            gap: "0.5rem",
          }}
        >
          <button type="button" className="btn" onClick={handleClose} disabled={pending}>
            {shortages && shortages.length > 0 ? "Готово" : "Отмена"}
          </button>
          {!(shortages && shortages.length > 0) ? (
            <button
              type="button"
              className="btn btn-accent"
              onClick={submit}
              disabled={pending}
            >
              {pending ? "Закрываем..." : "Закрыть заявку"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
