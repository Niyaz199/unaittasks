import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import {
  canReadObjectRooms,
  getObjectRoomByIdForProfile,
  getObjectRoomQrCodeByTokenForProfile,
} from "@/lib/object-rooms";
import { canUseRoundsScanner } from "@/lib/rounds/permissions";
import { resolveRoundsQrTokenForProfile } from "@/lib/rounds/queries";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const normalizedToken = token.trim();
    const { supabase, profile } = await getApiSession();

    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canUseRoundsScanner(profile.role)) {
      return NextResponse.json({ error: "Недостаточно прав для сканера обходов" }, { status: 403 });
    }

    const activeRoom = await resolveRoundsQrTokenForProfile(supabase, profile, normalizedToken);
    if (activeRoom) {
      return NextResponse.json({
        ok: true,
        state: "enabled",
        room: activeRoom,
      });
    }

    if (canReadObjectRooms(profile.role)) {
      const qrCode = await getObjectRoomQrCodeByTokenForProfile(supabase, profile, normalizedToken);
      if (qrCode) {
        const details = await getObjectRoomByIdForProfile(supabase, profile, qrCode.room_id);
        if (details) {
          const room = {
            room_id: details.room.id,
            object_id: details.room.object_id,
            object_name: Array.isArray(details.room.object) ? details.room.object[0]?.name ?? "—" : details.room.object?.name ?? "—",
            room_name: details.room.name,
            floor_name: Array.isArray(details.room.floor_ref)
              ? details.room.floor_ref[0]?.name ?? details.room.floor ?? "—"
              : details.room.floor_ref?.name ?? details.room.floor ?? "—",
            qr_token: qrCode.qr_token,
          };

          if (!details.room.is_active) {
            return NextResponse.json({
              ok: false,
              state: "inactive",
              room,
              error: "QR помещения найден, но помещение сейчас неактивно.",
            });
          }

          if (!details.room.rounds_enabled) {
            return NextResponse.json({
              ok: false,
              state: "disabled",
              room,
              error: "QR помещения найден, но помещение сейчас не включено в обходы.",
            });
          }

          return NextResponse.json({
            ok: false,
            state: "configured",
            room,
            error: "QR помещения найден и помещение помечено в обходах, но сканер не получил его в рабочую конфигурацию.",
          });
        }
      }
    }

    return NextResponse.json({
      ok: false,
      state: "invalid",
      error: "QR-токен помещения не найден в конфигурации обходов.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = /недостаточно прав|недоступ/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
