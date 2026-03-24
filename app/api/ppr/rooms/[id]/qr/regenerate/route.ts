import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { canManageObjectRooms, regenerateObjectRoomQrCodeForProfile } from "@/lib/object-rooms";

function revalidateRoomQrPaths(roomId: string) {
  revalidatePath("/ppr/rooms");
  revalidatePath(`/ppr/rooms/${roomId}`);
  revalidatePath("/rounds/config");
  revalidatePath("/rounds/qr");
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canManageObjectRooms(profile.role)) {
      return NextResponse.json({ error: "Недостаточно прав для пересоздания QR помещения" }, { status: 403 });
    }

    const qrCode = await regenerateObjectRoomQrCodeForProfile(supabase, profile, id);
    revalidateRoomQrPaths(id);
    return NextResponse.json({ ok: true, qrCode });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
