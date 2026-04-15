"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { StockLocationQrBlock } from "@/components/warehouse/stock-location-qr-block";
import { StockMovementForm } from "@/components/warehouse/stock-movement-form";
import { stockItemKindMeta, stockMovementTypeMeta } from "@/lib/warehouse/presentation";

type NamedRelation = { name: string } | Array<{ name: string }> | null | undefined;

type LocationDetails = {
  id: string;
  object_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  object: NamedRelation;
};

type ActiveQrCode = {
  qr_token: string;
  generated_at: string;
  is_active: boolean;
} | null;

type BalanceRow = {
  id: string;
  qty: number;
  item:
    | {
        id: string;
        name: string;
        kind: "material" | "spare_part" | "consumable" | "component";
        unit: string;
        min_qty: number;
        current_qty: number;
        is_active: boolean;
      }
    | Array<{
        id: string;
        name: string;
        kind: "material" | "spare_part" | "consumable" | "component";
        unit: string;
        min_qty: number;
        current_qty: number;
        is_active: boolean;
      }>
    | null;
};

type MovementRow = {
  id: string;
  movement_type: keyof typeof stockMovementTypeMeta;
  quantity: number;
  note: string | null;
  created_at: string;
  actor: { full_name: string } | Array<{ full_name: string }> | null;
  item: { name: string; unit: string } | Array<{ name: string; unit: string }> | null;
};

type MovementItemOption = {
  id: string;
  name: string;
  unit: string;
  kindLabel: string;
  locationQty: number;
  totalQty: number;
  minQty: number;
  isActive: boolean;
};

function resolveName(raw: NamedRelation) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}

function resolveActor(raw: { full_name: string } | Array<{ full_name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.full_name ?? "—";
  return raw?.full_name ?? "—";
}

function resolveItem(raw: { name: string; unit: string } | Array<{ name: string; unit: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

function formatQty(value: number, unit: string) {
  return `${Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 3 })} ${unit}`;
}

export function StockLocationDetails({
  location,
  qrCode,
  balances,
  movements,
  movementItems,
  canRegenerateQr,
  canRecordMovement,
  recordMovementAction,
}: {
  location: LocationDetails;
  qrCode: ActiveQrCode;
  balances: BalanceRow[];
  movements: MovementRow[];
  movementItems: MovementItemOption[];
  canRegenerateQr: boolean;
  canRecordMovement: boolean;
  recordMovementAction: (formData: FormData) => void | Promise<void>;
}) {
  const objectName = resolveName(location.object);
  const [activeView, setActiveView] = useState<"state" | "movement" | "history" | "qr">("state");
  const totals = useMemo(() => {
    const locationQty = balances.reduce((sum, balance) => sum + balance.qty, 0);
    const lowStockCount = balances.reduce((sum, balance) => {
      const item = Array.isArray(balance.item) ? balance.item[0] ?? null : balance.item;
      if (!item) return sum;
      return item.current_qty <= item.min_qty ? sum + 1 : sum;
    }, 0);
    return {
      positions: balances.length,
      locationQty,
      lowStockCount,
    };
  }, [balances]);
  const historyCaption =
    movements.length === 20
      ? "Показаны последние 20 операций по этому месту хранения."
      : movements.length > 0
        ? "Все доступные операции по этому месту хранения отображены ниже."
        : "Движений по этому месту хранения пока не было.";
  const hasDescription = Boolean(location.description?.trim());

  return (
    <div className="warehouse-location-page">
      <div className="section-card warehouse-location-hero">
        <div className="warehouse-location-hero-head">
          <div className="warehouse-location-hero-copy">
            <div className="warehouse-location-eyebrow">Объект</div>
            <div className="warehouse-location-context">{objectName}</div>
            {hasDescription ? (
              <div className="text-soft warehouse-location-description">{location.description?.trim()}</div>
            ) : null}
          </div>
          <Badge tone={location.is_active ? "success" : "neutral"}>{location.is_active ? "Активно" : "Неактивно"}</Badge>
        </div>

        <div className="warehouse-location-metrics">
          <div className="warehouse-location-metric">
            <span className="warehouse-location-metric-label">Позиции</span>
            <strong>{totals.positions}</strong>
          </div>
          <div className="warehouse-location-metric">
            <span className="warehouse-location-metric-label">На месте</span>
            <strong className="tabular-nums">{Number(totals.locationQty).toLocaleString("ru-RU", { maximumFractionDigits: 3 })}</strong>
          </div>
          <div className="warehouse-location-metric">
            <span className="warehouse-location-metric-label">Ниже минимума</span>
            <strong className={totals.lowStockCount > 0 ? "warehouse-danger-text" : ""}>{totals.lowStockCount}</strong>
          </div>
        </div>
      </div>

      <div className="warehouse-location-stack">
        <div className="warehouse-view-switch" role="tablist" aria-label="Раздел карточки склада">
          <button
            type="button"
            className={`warehouse-view-tab ${activeView === "state" ? "is-active" : ""}`}
            onClick={() => setActiveView("state")}
          >
            Состояние
          </button>
          <button
            type="button"
            className={`warehouse-view-tab ${activeView === "movement" ? "is-active" : ""}`}
            onClick={() => setActiveView("movement")}
          >
            Движение
          </button>
          <button
            type="button"
            className={`warehouse-view-tab ${activeView === "history" ? "is-active" : ""}`}
            onClick={() => setActiveView("history")}
          >
            История
            <span className="warehouse-view-tab-count">{movements.length}</span>
          </button>
          <button
            type="button"
            className={`warehouse-view-tab ${activeView === "qr" ? "is-active" : ""}`}
            onClick={() => setActiveView("qr")}
          >
            QR
          </button>
        </div>

        <div className="section-card warehouse-location-section warehouse-location-tab-panel">
          {activeView === "state" ? (
            <>
              <div className="warehouse-section-head">
                <div className="grid" style={{ gap: "0.2rem" }}>
                  <h3 className="warehouse-section-title">Состояние</h3>
                </div>
                {totals.lowStockCount > 0 ? <Badge tone="danger">Ниже минимума: {totals.lowStockCount}</Badge> : null}
              </div>

              {balances.length ? (
                <div className="table-wrap">
                  <table className="data-table table-dense warehouse-stock-table">
                    <thead>
                      <tr>
                        <th>ТМЦ</th>
                        <th className="text-right">На месте</th>
                        <th className="text-right">Общий</th>
                        <th className="text-right">Минимум</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balances.map((balance) => {
                        const item = Array.isArray(balance.item) ? balance.item[0] ?? null : balance.item;
                        if (!item) return null;
                        const isLowStock = item.current_qty <= item.min_qty;
                        return (
                          <tr key={balance.id} className={isLowStock ? "warehouse-row-alert" : undefined}>
                            <td>
                              <div className="warehouse-item-main">{item.name}</div>
                              <div className="text-soft" style={{ fontSize: "0.82rem" }}>
                                {stockItemKindMeta[item.kind].label}
                              </div>
                            </td>
                            <td className="text-right tabular-nums">{formatQty(balance.qty, item.unit)}</td>
                            <td className={`text-right tabular-nums ${isLowStock ? "warehouse-danger-text" : ""}`}>
                              {formatQty(item.current_qty, item.unit)}
                            </td>
                            <td className="text-right tabular-nums">{formatQty(item.min_qty, item.unit)}</td>
                            <td>
                              {!item.is_active ? (
                                <Badge tone="neutral">Неактивна</Badge>
                              ) : isLowStock ? (
                                <Badge tone="danger">Ниже минимума</Badge>
                              ) : (
                                <span className="text-soft">В норме</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-soft">На этом месте хранения пока нет остатков.</div>
              )}
            </>
          ) : null}

          {activeView === "movement" ? (
            <>
              <div className="warehouse-section-head">
                <div className="grid" style={{ gap: "0.2rem" }}>
                  <h3 className="warehouse-section-title">Движение</h3>
                </div>
              </div>
              {canRecordMovement ? (
                movementItems.length ? (
                  <StockMovementForm objectId={location.object_id} locationId={location.id} items={movementItems} action={recordMovementAction} />
                ) : (
                  <div className="text-soft">Сначала создайте карточки ТМЦ, чтобы фиксировать движения.</div>
                )
              ) : (
                <div className="text-soft">У вас нет прав на фиксацию движений по складу.</div>
              )}
            </>
          ) : null}

          {activeView === "history" ? (
            <>
              <div className="warehouse-section-head">
                <div className="grid" style={{ gap: "0.2rem" }}>
                  <h3 className="warehouse-section-title">История</h3>
                  <div className="text-soft">{historyCaption}</div>
                </div>
                {movements.length === 20 ? <Badge tone="warning">Последние 20</Badge> : null}
              </div>

              {movements.length ? (
                <div className="warehouse-history-list">
                  {movements.map((movement) => {
                    const item = resolveItem(movement.item);
                    return (
                      <div key={movement.id} className="warehouse-history-row">
                        <div className="warehouse-history-main">
                          <div className="warehouse-history-title">
                            {item?.name ?? "ТМЦ"} • {formatQty(movement.quantity, item?.unit ?? "шт")}
                          </div>
                          <div className="text-soft warehouse-history-meta">
                            {resolveActor(movement.actor)} • {new Date(movement.created_at).toLocaleString("ru-RU")}
                          </div>
                          {movement.note?.trim() ? <div className="text-soft warehouse-history-note">{movement.note}</div> : null}
                        </div>
                        <Badge tone={stockMovementTypeMeta[movement.movement_type].tone}>
                          {stockMovementTypeMeta[movement.movement_type].label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-soft">Движений по этому месту хранения пока не было.</div>
              )}
            </>
          ) : null}

          {activeView === "qr" ? (
            <>
              <div className="warehouse-section-head">
                <div className="grid" style={{ gap: "0.2rem" }}>
                  <h3 className="warehouse-section-title">QR</h3>
                </div>
              </div>
              <StockLocationQrBlock
                locationId={location.id}
                objectName={objectName}
                locationName={location.name}
                qrCode={qrCode}
                canRegenerate={canRegenerateQr}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
