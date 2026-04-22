"use client";

import { useState } from "react";
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

type TabId = "specs" | "components" | "history" | "qr";

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
  const [activeTab, setActiveTab] = useState<TabId>("specs");
  const statusMeta = pprEquipmentStatusMeta[equipment.status];

  return (
    <div className="warehouse-location-page">
      {/* Hero */}
      <div className="section-card warehouse-location-hero">
        <div className="warehouse-location-hero-head">
          <div className="warehouse-location-hero-copy">
            <div className="warehouse-location-eyebrow">Объект</div>
            <div className="warehouse-location-context">{resolveName(equipment.object)}</div>
            <div className="text-soft warehouse-location-description" style={{ fontFamily: "monospace", fontSize: "0.82rem", letterSpacing: "0.04em" }}>
              ИНВ. {equipment.inventory_no} • {equipment.dispatch_name}
            </div>
            <div className="text-soft warehouse-location-description">
              {resolveName(equipment.system)} • {resolveName(equipment.room)}
            </div>
          </div>
          <Badge tone={statusMeta.tone} style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}>
            {statusMeta.label}
          </Badge>
        </div>

        <div className="warehouse-location-metrics">
          <div className="warehouse-location-metric">
            <span className="warehouse-location-metric-label">Составляющие</span>
            <strong>{components.length}</strong>
          </div>
          <div className="warehouse-location-metric">
            <span className="warehouse-location-metric-label">Критичных</span>
            <strong className={components.filter((c) => c.is_critical).length > 0 ? "warehouse-danger-text" : ""}>
              {components.filter((c) => c.is_critical).length}
            </strong>
          </div>
          <div className="warehouse-location-metric">
            <span className="warehouse-location-metric-label">Ввод в экспл.</span>
            <strong>{new Date(equipment.service_start_date).toLocaleDateString("ru-RU")}</strong>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="warehouse-location-stack">
        <div className="warehouse-view-switch" role="tablist" aria-label="Разделы карточки оборудования">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "specs"}
            className={`warehouse-view-tab ${activeTab === "specs" ? "is-active" : ""}`}
            onClick={() => setActiveTab("specs")}
          >
            Характеристики
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "components"}
            className={`warehouse-view-tab ${activeTab === "components" ? "is-active" : ""}`}
            onClick={() => setActiveTab("components")}
          >
            Составляющие
            {components.length > 0 && (
              <span className="warehouse-view-tab-count">{components.length}</span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "history"}
            className={`warehouse-view-tab ${activeTab === "history" ? "is-active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            История
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "qr"}
            className={`warehouse-view-tab ${activeTab === "qr" ? "is-active" : ""}`}
            onClick={() => setActiveTab("qr")}
          >
            QR
          </button>
        </div>

        <div className="section-card warehouse-location-section warehouse-location-tab-panel">
          {/* Характеристики */}
          {activeTab === "specs" && (
            <>
              <div className="warehouse-section-head">
                <div className="grid" style={{ gap: "0.2rem" }}>
                  <h3 className="warehouse-section-title">Технические характеристики</h3>
                </div>
              </div>

              <div style={{ display: "grid", gap: "1.25rem" }}>
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
                  <div style={{ paddingTop: "1rem", borderTop: "1px solid color-mix(in srgb, var(--line) 40%, transparent)" }}>
                    <div className="text-soft" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>Описание</div>
                    <div style={{ fontSize: "0.95rem", lineHeight: 1.5 }}>{equipment.description}</div>
                  </div>
                )}

                {equipment.comment?.trim() && (
                  <div style={{ padding: "0.75rem", background: "color-mix(in srgb, var(--panel-soft) 40%, transparent)", borderRadius: "8px", border: "1px solid color-mix(in srgb, var(--line) 30%, transparent)" }}>
                    <div className="text-soft" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>Внутренний комментарий</div>
                    <div style={{ fontSize: "0.9rem" }}>{equipment.comment}</div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Составляющие */}
          {activeTab === "components" && (
            <>
              <div className="warehouse-section-head">
                <div className="grid" style={{ gap: "0.2rem" }}>
                  <h3 className="warehouse-section-title">Составляющие</h3>
                  <div className="text-soft">Из каких ТМЦ состоит оборудование и какие элементы должны быть в резерве на складе.</div>
                </div>
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
            </>
          )}

          {/* История */}
          {activeTab === "history" && (
            <>
              <div className="warehouse-section-head">
                <div className="grid" style={{ gap: "0.2rem" }}>
                  <h3 className="warehouse-section-title">История ремонтов</h3>
                </div>
              </div>
              <div className="text-soft" style={{ padding: "2rem 1rem", textAlign: "center", background: "color-mix(in srgb, var(--panel-soft) 20%, transparent)", border: "1px dashed color-mix(in srgb, var(--line-strong) 40%, transparent)", borderRadius: "8px" }}>
                Модуль истории ремонтов находится в разработке (Batch 2).
              </div>
            </>
          )}

          {/* QR */}
          {activeTab === "qr" && (
            <>
              <div className="warehouse-section-head">
                <div className="grid" style={{ gap: "0.2rem" }}>
                  <h3 className="warehouse-section-title">ППР QR</h3>
                  <div className="text-soft">Код содержит токен идентификации для быстрого доступа с мобильного устройства.</div>
                </div>
              </div>
              <PprEquipmentQrBlock qrCode={qrCode} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
