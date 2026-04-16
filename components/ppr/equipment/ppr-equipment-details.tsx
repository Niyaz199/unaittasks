import { Badge } from "@/components/ui/badge";
import { pprEquipmentStatusMeta } from "@/lib/ppr/presentation";
import { PprEquipmentQrBlock } from "@/components/ppr/equipment/ppr-equipment-qr-block";
import { PprEquipmentComponentsManager } from "@/components/ppr/equipment/ppr-equipment-components-manager";

type EquipmentDetails = {
  id: string;
  object_id: string;
  inventory_no: string;
  name: string;
  dispatch_name: string;
  service_start_date: string;
  status: "active" | "repair" | "out_of_service" | "archived";
  serial_no: string | null;
  manufacturer: string | null;
  model: string | null;
  description: string | null;
  comment: string | null;
  created_at: string;
  object: { name: string } | Array<{ name: string }> | null;
  system: { name: string } | Array<{ name: string }> | null;
  room: { name: string } | Array<{ name: string }> | null;
};

type ActiveQrCode = {
  qr_token: string;
  generated_at: string;
  is_active: boolean;
} | null;

type EquipmentComponentItem = {
  id: string;
  name: string;
  kind: "zip" | "component";
  unit: string;
  min_qty: number;
  current_qty: number;
};

type LocationOption = {
  id: string;
  object_id: string;
  name: string;
  is_active?: boolean;
};

type SystemGroupOption = {
  id: string;
  name: string;
  code: string;
  is_active?: boolean;
};

type EquipmentComponentRow = {
  id: string;
  stock_item_id: string;
  quantity: number;
  reserve_qty: number;
  is_critical: boolean;
  note: string | null;
  stock_item: EquipmentComponentItem | EquipmentComponentItem[] | null;
};

function resolveName(raw: { name: string } | Array<{ name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}
export function PprEquipmentDetails({
  equipment,
  qrCode,
  components,
  stockItems,
  storageLocations,
  systemGroups,
  canManageComponents,
}: {
  equipment: EquipmentDetails;
  qrCode: ActiveQrCode;
  components: EquipmentComponentRow[];
  stockItems: EquipmentComponentItem[];
  storageLocations: LocationOption[];
  systemGroups: SystemGroupOption[];
  canManageComponents: boolean;
}) {
  const statusMeta = pprEquipmentStatusMeta[equipment.status];

  return (
    <div className="td-page">
      {/* Header and key meta */}
      <div className="section-card" style={{ padding: "1.5rem", marginBottom: "1rem", background: "color-mix(in srgb, var(--panel-soft) 30%, transparent)" }}>
        <div className="td-hero" style={{ gap: "1rem" }}>
          <div className="td-hero-top" style={{ alignItems: "flex-start" }}>
            <div>
              <div className="text-soft" style={{ fontSize: "0.85rem", marginBottom: "0.4rem", fontFamily: "monospace", letterSpacing: "0.05em" }}>
                ИНВ. {equipment.inventory_no} • {equipment.dispatch_name}
              </div>
              <h2 className="task-details-title" style={{ margin: 0, fontSize: "1.6rem" }}>{equipment.name}</h2>
            </div>
            <div className="td-hero-badges">
              <Badge tone={statusMeta.tone} style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}>{statusMeta.label}</Badge>
            </div>
          </div>

          <div className="td-meta-grid" style={{ marginTop: "0.5rem", borderTop: "1px solid color-mix(in srgb, var(--line) 40%, transparent)", paddingTop: "1rem" }}>
            <div className="td-meta-item">
              <span className="td-meta-label">Объект</span>
              <span className="td-meta-value" style={{ fontWeight: 500 }}>{resolveName(equipment.object)}</span>
            </div>
            <div className="td-meta-item">
              <span className="td-meta-label">Система</span>
              <span className="td-meta-value">{resolveName(equipment.system)}</span>
            </div>
            <div className="td-meta-item">
              <span className="td-meta-label">Помещение</span>
              <span className="td-meta-value">{resolveName(equipment.room)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md-grid-2" style={{ gap: "1.5rem", alignItems: "start" }}>
        {/* Left Column */}
        <div className="flex flex-col" style={{ gap: "1.5rem" }}>
          <div className="section-card" style={{ padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 1.25rem 0", fontSize: "1.1rem", fontWeight: 600, color: "var(--text)" }}>Технические характеристики</h3>
            
            <div style={{ display: "grid", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <div className="text-soft" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>Производитель</div>
                  <div style={{ fontSize: "0.95rem" }}>{equipment.manufacturer || "—"}</div>
                </div>
                <div>
                  <div className="text-soft" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>Модель</div>
                  <div style={{ fontSize: "0.95rem" }}>{equipment.model || "—"}</div>
                </div>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <div className="text-soft" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>Серийный номер</div>
                  <div style={{ fontSize: "0.95rem", fontFamily: "monospace" }}>{equipment.serial_no || "—"}</div>
                </div>
                <div>
                  <div className="text-soft" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>Ввод в эксплуатацию</div>
                  <div style={{ fontSize: "0.95rem" }}>{new Date(equipment.service_start_date).toLocaleDateString("ru-RU")}</div>
                </div>
              </div>

              {equipment.description?.trim() && (
                <div style={{ marginTop: "0.5rem", paddingTop: "1rem", borderTop: "1px solid color-mix(in srgb, var(--line) 40%, transparent)" }}>
                  <div className="text-soft" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>Описание</div>
                  <div style={{ fontSize: "0.95rem", lineHeight: 1.5 }}>{equipment.description}</div>
                </div>
              )}

              {equipment.comment?.trim() && (
                <div style={{ marginTop: "0.5rem", padding: "0.75rem", background: "color-mix(in srgb, var(--panel-soft) 40%, transparent)", borderRadius: "8px", border: "1px solid color-mix(in srgb, var(--line) 30%, transparent)" }}>
                  <div className="text-soft" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>Внутренний комментарий</div>
                  <div style={{ fontSize: "0.9rem" }}>{equipment.comment}</div>
                </div>
              )}
            </div>
          </div>

          <div className="section-card" style={{ padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", fontWeight: 600 }}>Составляющие</h3>
            <div className="text-soft" style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
              Здесь указывается, из каких ТМЦ состоит оборудование и какие элементы должны постоянно быть в резерве на складе.
            </div>
            <PprEquipmentComponentsManager
              equipmentId={equipment.id}
              objectId={equipment.object_id}
              objectName={resolveName(equipment.object)}
              components={components}
              stockItems={stockItems}
              storageLocations={storageLocations}
              systemGroups={systemGroups}
              canManage={canManageComponents}
            />
          </div>

          <div className="section-card" style={{ padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", fontWeight: 600 }}>История ремонтов</h3>
            <div className="text-soft" style={{ padding: "2rem 1rem", textAlign: "center", background: "color-mix(in srgb, var(--panel-soft) 20%, transparent)", border: "1px dashed color-mix(in srgb, var(--line-strong) 40%, transparent)", borderRadius: "8px" }}>
              Модуль истории ремонтов находится в разработке (Batch 2).
            </div>
          </div>
        </div>

        {/* Right Column (Sidebar) */}
        <div className="flex flex-col">
          <div className="section-card" style={{ padding: "1.5rem", background: "color-mix(in srgb, var(--panel-soft) 20%, transparent)" }}>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem", fontWeight: 600 }}>ППР QR</h3>
            <div className="text-soft" style={{ fontSize: "0.85rem", lineHeight: 1.4, marginBottom: "1.25rem" }}>
              Код содержит токен идентификации для быстрого доступа с мобильного устройства.
            </div>
            <PprEquipmentQrBlock qrCode={qrCode} />
          </div>
        </div>
      </div>
    </div>
  );
}
