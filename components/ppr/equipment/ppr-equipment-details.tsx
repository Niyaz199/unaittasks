import { Badge } from "@/components/ui/badge";
import { pprEquipmentStatusMeta } from "@/lib/ppr/presentation";
import { PprEquipmentQrBlock } from "@/components/ppr/equipment/ppr-equipment-qr-block";

type EquipmentDetails = {
  id: string;
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
  subsystem: { name: string } | Array<{ name: string }> | null;
  room: { name: string } | Array<{ name: string }> | null;
};

type ActiveQrCode = {
  qr_token: string;
  generated_at: string;
  is_active: boolean;
} | null;

function resolveName(raw: { name: string } | Array<{ name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}



export function PprEquipmentDetails({ equipment, qrCode }: { equipment: EquipmentDetails; qrCode: ActiveQrCode }) {
  const statusMeta = pprEquipmentStatusMeta[equipment.status];

  return (
    <div className="td-page">
      {/* Header and key meta */}
      <div className="td-hero" style={{ gap: "0.75rem" }}>
        <div className="td-hero-top" style={{ alignItems: "center" }}>
          <h2 className="task-details-title" style={{ margin: 0 }}>{equipment.name}</h2>
          <div className="td-hero-badges">
            <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
          </div>
        </div>

        <div className="text-soft" style={{ fontSize: "0.9rem", marginBottom: "0.25rem", opacity: 0.8 }}>
          {equipment.dispatch_name} • инв. {equipment.inventory_no}
        </div>

        <div className="td-meta-grid">
          <div className="td-meta-item">
            <span className="td-meta-label">Объект</span>
            <span className="td-meta-value">{resolveName(equipment.object)}</span>
          </div>
          <div className="td-meta-item">
            <span className="td-meta-label">Система</span>
            <span className="td-meta-value">{resolveName(equipment.system)}</span>
          </div>
          <div className="td-meta-item">
            <span className="td-meta-label">Подсистема</span>
            <span className="td-meta-value">{resolveName(equipment.subsystem)}</span>
          </div>
          <div className="td-meta-item">
            <span className="td-meta-label">Помещение</span>
            <span className="td-meta-value">{resolveName(equipment.room)}</span>
          </div>
          <div className="td-meta-item">
            <span className="td-meta-label">Ввод в эксплуатацию</span>
            <span className="td-meta-value">{new Date(equipment.service_start_date).toLocaleDateString("ru-RU")}</span>
          </div>
          <div className="td-meta-item">
            <span className="td-meta-label">Серийный номер</span>
            <span className="td-meta-value">{equipment.serial_no ?? "—"}</span>
          </div>
          <div className="td-meta-item">
            <span className="td-meta-label">Производитель</span>
            <span className="td-meta-value">{equipment.manufacturer ?? "—"}</span>
          </div>
          <div className="td-meta-item">
            <span className="td-meta-label">Модель</span>
            <span className="td-meta-value">{equipment.model ?? "—"}</span>
          </div>
        </div>
      </div>

      <div className="grid md-grid-2" style={{ gap: "2rem" }}>
        {/* Left Column */}
        <div className="flex flex-col" style={{ gap: "2rem" }}>
          <div className="flex flex-col" style={{ gap: "0.75rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600, borderBottom: "1px solid color-mix(in srgb, var(--line-strong) 40%, transparent)", paddingBottom: "0.5rem" }}>Техническое описание</h3>
            <div style={{ lineHeight: 1.6 }}>{equipment.description?.trim() ? equipment.description : <span className="text-soft">Описание пока не заполнено.</span>}</div>
            {equipment.comment?.trim() && (
              <div className="text-soft" style={{ fontSize: "0.9rem", padding: "0.75rem", background: "color-mix(in srgb, var(--panel-soft) 40%, transparent)", borderRadius: "6px" }}>
                <strong>Комментарий:</strong> {equipment.comment}
              </div>
            )}
          </div>

          <div className="flex flex-col" style={{ gap: "0.75rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600, borderBottom: "1px solid color-mix(in srgb, var(--line-strong) 40%, transparent)", paddingBottom: "0.5rem" }}>История ремонтов</h3>
            <div className="text-soft" style={{ padding: "1.5rem", textAlign: "center", border: "1px dashed color-mix(in srgb, var(--line-strong) 60%, transparent)", borderRadius: "8px" }}>
              Модуль истории ремонтов находится в разработке (Batch 2).
            </div>
          </div>
        </div>

        {/* Right Column (Sidebar) */}
        <div className="flex flex-col">
          <div className="flex flex-col" style={{ gap: "0.75rem", background: "color-mix(in srgb, var(--panel-soft) 30%, transparent)", padding: "1.5rem", borderRadius: "12px", border: "1px solid color-mix(in srgb, var(--line-strong) 40%, transparent)" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>ППР QR</h3>
            <div className="text-soft text-sm" style={{ lineHeight: 1.4 }}>
              Код содержит токен идентификации для быстрого доступа с мобильного устройства (сканирование переведет в заявку или карточку).
            </div>
            <div style={{ marginTop: "0.5rem" }}>
              <PprEquipmentQrBlock qrCode={qrCode} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
