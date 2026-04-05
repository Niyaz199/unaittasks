import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ppr/ui/status-badge";
import { ObjectRoomQrBlock } from "@/components/ppr/rooms/object-room-qr-block";

type NamedRelation = { name: string } | Array<{ name: string }> | null | undefined;

type RoomDetails = {
  id: string;
  object_id: string;
  name: string;
  floor: string | null;
  description: string | null;
  is_active: boolean;
  rounds_enabled: boolean;
  created_at: string;
  object: NamedRelation;
  floor_ref:
    | { id: string; name: string; sort_order: number; is_active: boolean }
    | Array<{ id: string; name: string; sort_order: number; is_active: boolean }>
    | null;
  room_type: { id: string; name: string; is_active: boolean } | Array<{ id: string; name: string; is_active: boolean }> | null;
};

type ActiveQrCode = {
  qr_token: string;
  generated_at: string;
  is_active: boolean;
} | null;

function resolveName(raw: NamedRelation) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}

function resolveFloor(raw: RoomDetails["floor_ref"], fallback: string | null) {
  if (Array.isArray(raw)) return raw[0]?.name ?? fallback ?? "—";
  return raw?.name ?? fallback ?? "—";
}

function resolveRoomType(raw: RoomDetails["room_type"]) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}

export function ObjectRoomDetails({
  room,
  qrCode,
  canRegenerateQr,
}: {
  room: RoomDetails;
  qrCode: ActiveQrCode;
  canRegenerateQr: boolean;
}) {
  const objectName = resolveName(room.object);
  const floorName = resolveFloor(room.floor_ref, room.floor);
  const roomTypeName = resolveRoomType(room.room_type);

  return (
    <div className="td-page">
      <div className="section-card" style={{ padding: "1.5rem", marginBottom: "1rem", background: "color-mix(in srgb, var(--panel-soft) 30%, transparent)" }}>
        <div className="td-hero" style={{ gap: "1rem" }}>
          <div className="td-hero-top" style={{ alignItems: "flex-start" }}>
            <div>
              <div className="text-soft" style={{ fontSize: "0.85rem", marginBottom: "0.4rem", fontFamily: "monospace", letterSpacing: "0.05em" }}>
                {objectName} • {floorName} • {roomTypeName}
              </div>
              <h2 className="task-details-title" style={{ margin: 0, fontSize: "1.6rem" }}>{room.name}</h2>
            </div>
            <div className="td-hero-badges">
              <StatusBadge isActive={room.is_active} />
              <Badge tone={room.rounds_enabled ? "info" : "neutral"} style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}>
                {room.rounds_enabled ? "Участвует в обходах" : "Не участвует в обходах"}
              </Badge>
            </div>
          </div>

          <div className="td-meta-grid" style={{ marginTop: "0.5rem", borderTop: "1px solid color-mix(in srgb, var(--line) 40%, transparent)", paddingTop: "1rem" }}>
            <div className="td-meta-item">
              <span className="td-meta-label">Объект</span>
              <span className="td-meta-value" style={{ fontWeight: 500 }}>{objectName}</span>
            </div>
            <div className="td-meta-item">
              <span className="td-meta-label">Этаж</span>
              <span className="td-meta-value">{floorName}</span>
            </div>
            <div className="td-meta-item">
              <span className="td-meta-label">Тип помещения</span>
              <span className="td-meta-value">{roomTypeName}</span>
            </div>
            <div className="td-meta-item">
              <span className="td-meta-label">Дата создания</span>
              <span className="td-meta-value">{new Date(room.created_at).toLocaleString("ru-RU")}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md-grid-2" style={{ gap: "1.5rem", alignItems: "start" }}>
        <div className="flex flex-col" style={{ gap: "1.5rem" }}>
          <div className="section-card" style={{ padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 1.25rem 0", fontSize: "1.1rem", fontWeight: 600, color: "var(--text)" }}>
              Описание помещения
            </h3>
            <div style={{ lineHeight: 1.6, fontSize: "0.95rem" }}>
              {room.description?.trim() ? room.description : <span className="text-soft">Описание помещения пока не заполнено.</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="section-card" style={{ padding: "1.5rem", background: "color-mix(in srgb, var(--panel-soft) 20%, transparent)" }}>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem", fontWeight: 600 }}>QR помещения</h3>
            <div className="text-soft" style={{ fontSize: "0.85rem", lineHeight: 1.4, marginBottom: "1.25rem" }}>
              Общий QR помещения создается автоматически и может использоваться не только в обходах, но и в других модулях.
            </div>
            <ObjectRoomQrBlock
              roomId={room.id}
              objectName={objectName}
              floorName={floorName}
              roomName={room.name}
              qrCode={qrCode}
              canRegenerate={canRegenerateQr}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
