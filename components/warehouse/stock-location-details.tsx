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

  return (
    <div className="td-page">
      <div className="section-card" style={{ padding: "1.5rem", marginBottom: "1rem", background: "color-mix(in srgb, var(--panel-soft) 30%, transparent)" }}>
        <div className="td-hero" style={{ gap: "1rem" }}>
          <div className="td-hero-top" style={{ alignItems: "flex-start" }}>
            <div>
              <div className="text-soft" style={{ fontSize: "0.85rem", marginBottom: "0.4rem", fontFamily: "monospace", letterSpacing: "0.05em" }}>
                Склад • {objectName}
              </div>
              <h2 className="task-details-title" style={{ margin: 0, fontSize: "1.6rem" }}>
                {location.name}
              </h2>
            </div>
            <div className="td-hero-badges">
              <Badge tone={location.is_active ? "success" : "neutral"}>{location.is_active ? "Активно" : "Неактивно"}</Badge>
            </div>
          </div>

          <div className="td-meta-grid" style={{ marginTop: "0.5rem", borderTop: "1px solid color-mix(in srgb, var(--line) 40%, transparent)", paddingTop: "1rem" }}>
            <div className="td-meta-item">
              <span className="td-meta-label">Объект</span>
              <span className="td-meta-value">{objectName}</span>
            </div>
            <div className="td-meta-item">
              <span className="td-meta-label">Создано</span>
              <span className="td-meta-value">{new Date(location.created_at).toLocaleString("ru-RU")}</span>
            </div>
            <div className="td-meta-item">
              <span className="td-meta-label">Позиций на месте</span>
              <span className="td-meta-value">{balances.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md-grid-2" style={{ gap: "1.5rem", alignItems: "start" }}>
        <div className="flex flex-col" style={{ gap: "1.5rem" }}>
          <div className="section-card" style={{ padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", fontWeight: 600 }}>Описание</h3>
            <div style={{ fontSize: "0.95rem", lineHeight: 1.55 }}>
              {location.description?.trim() ? location.description : <span className="text-soft">Описание места хранения пока не заполнено.</span>}
            </div>
          </div>

          <div className="section-card" style={{ padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", fontWeight: 600 }}>Текущее наполнение</h3>
            {balances.length ? (
              <div className="grid" style={{ gap: "0.8rem" }}>
                {balances.map((balance) => {
                  const item = Array.isArray(balance.item) ? balance.item[0] ?? null : balance.item;
                  if (!item) return null;
                  const isLowStock = item.current_qty <= item.min_qty;
                  return (
                    <div key={balance.id} className="section-card" style={{ padding: "1rem", background: "color-mix(in srgb, var(--panel-soft) 20%, transparent)" }}>
                      <div className="row" style={{ justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                        <div className="grid" style={{ gap: "0.25rem" }}>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          <div className="text-soft">
                            {stockItemKindMeta[item.kind].label} • {formatQty(balance.qty, item.unit)} на этом месте
                          </div>
                          <div className="text-soft">Общий остаток: {formatQty(item.current_qty, item.unit)}</div>
                        </div>
                        <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                          <Badge tone={item.is_active ? "success" : "neutral"}>{item.is_active ? "Активна" : "Неактивна"}</Badge>
                          {isLowStock ? <Badge tone="danger">Ниже минимума</Badge> : <Badge tone="info">Остаток в норме</Badge>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-soft">На этом месте хранения пока нет остатков.</div>
            )}
          </div>

          <div className="section-card" style={{ padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", fontWeight: 600 }}>Журнал движений</h3>
            {movements.length ? (
              <div className="grid" style={{ gap: "0.85rem" }}>
                {movements.map((movement) => {
                  const item = resolveItem(movement.item);
                  return (
                    <div key={movement.id} className="section-card" style={{ padding: "1rem", background: "color-mix(in srgb, var(--panel-soft) 20%, transparent)" }}>
                      <div className="row" style={{ justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                        <div className="grid" style={{ gap: "0.2rem" }}>
                          <div style={{ fontWeight: 600 }}>
                            {item?.name ?? "ТМЦ"} • {formatQty(movement.quantity, item?.unit ?? "шт")}
                          </div>
                          <div className="text-soft">{resolveActor(movement.actor)} • {new Date(movement.created_at).toLocaleString("ru-RU")}</div>
                          {movement.note?.trim() ? <div className="text-soft">{movement.note}</div> : null}
                        </div>
                        <Badge tone={stockMovementTypeMeta[movement.movement_type].tone}>{stockMovementTypeMeta[movement.movement_type].label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-soft">Движений по этому месту хранения пока не было.</div>
            )}
          </div>
        </div>

        <div className="flex flex-col" style={{ gap: "1.5rem" }}>
          <div className="section-card" style={{ padding: "1.5rem", background: "color-mix(in srgb, var(--panel-soft) 20%, transparent)" }}>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem", fontWeight: 600 }}>QR места хранения</h3>
            <div className="text-soft" style={{ fontSize: "0.85rem", lineHeight: 1.4, marginBottom: "1.25rem" }}>
              Сотрудник сканирует QR и сразу попадает в карточку места хранения для фиксации выдачи или прихода.
            </div>
            <StockLocationQrBlock
              locationId={location.id}
              objectName={objectName}
              locationName={location.name}
              qrCode={qrCode}
              canRegenerate={canRegenerateQr}
            />
          </div>

          <div className="section-card" style={{ padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 0.8rem 0", fontSize: "1.1rem", fontWeight: 600 }}>Зафиксировать движение</h3>
            {canRecordMovement ? (
              movementItems.length ? (
                <StockMovementForm objectId={location.object_id} locationId={location.id} items={movementItems} action={recordMovementAction} />
              ) : (
                <div className="text-soft">Сначала создайте карточки ТМЦ, чтобы фиксировать движения.</div>
              )
            ) : (
              <div className="text-soft">У вас нет прав на фиксацию движений по складу.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
