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
      <div className="td-hero" style={{ gap: "0.75rem" }}>
        <div className="td-hero-top" style={{ alignItems: "center" }}>
          <h2 className="task-details-title" style={{ margin: 0 }}>{room.name}</h2>
          <div className="td-hero-badges">
            <StatusBadge isActive={room.is_active} />
            <Badge tone={room.rounds_enabled ? "info" : "neutral"}>
              {room.rounds_enabled ? "Участвует в обходах" : "Не участвует в обходах"}
            </Badge>
          </div>
        </div>

        <div className="text-soft" style={{ fontSize: "0.9rem", marginBottom: "0.25rem", opacity: 0.8 }}>
          {objectName} • {floorName} • {roomTypeName}
        </div>

        <div className="td-meta-grid">
          <div className="td-meta-item">
            <span className="td-meta-label">Объект</span>
            <span className="td-meta-value">{objectName}</span>
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

      <div className="grid md-grid-2" style={{ gap: "2rem" }}>
        <div className="flex flex-col" style={{ gap: "2rem" }}>
          <div className="flex flex-col" style={{ gap: "0.75rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600, borderBottom: "1px solid color-mix(in srgb, var(--line-strong) 40%, transparent)", paddingBottom: "0.5rem" }}>
              Описание помещения
            </h3>
            <div style={{ lineHeight: 1.6 }}>
              {room.description?.trim() ? room.description : <span className="text-soft">Описание помещения пока не заполнено.</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="flex flex-col" style={{ gap: "0.75rem", background: "color-mix(in srgb, var(--panel-soft) 30%, transparent)", padding: "1.5rem", borderRadius: "12px", border: "1px solid color-mix(in srgb, var(--line-strong) 40%, transparent)" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>QR помещения</h3>
            <div className="text-soft text-sm" style={{ lineHeight: 1.4 }}>
              Общий QR помещения создается автоматически и может использоваться не только в обходах, но и в других модулях.
            </div>
            <div style={{ marginTop: "0.5rem" }}>
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
    </div>
  );
}
