import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/api-auth";
import { canManageRoundsConfig } from "@/lib/rounds/permissions";
import {
  ensureRoundsQrTokens,
  getRoundsScannerConfigForProfile,
  listRoundsManageableObjectsForProfile,
  saveRoundsRoomSelection,
} from "@/lib/rounds/queries";

const saveSchema = z.object({
  objectId: z.string().uuid(),
  enabledRoomIds: z.array(z.string().uuid()).default([]),
});

function revalidateRoundsPaths() {
  revalidatePath("/rounds");
  revalidatePath("/rounds/config");
  revalidatePath("/rounds/today");
  revalidatePath("/rounds/archive");
  revalidatePath("/rounds/qr");
}

export async function GET() {
  try {
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [scanner, manageableObjects] = await Promise.all([
      getRoundsScannerConfigForProfile(supabase, profile),
      canManageRoundsConfig(profile.role) ? listRoundsManageableObjectsForProfile(supabase, profile) : Promise.resolve([]),
    ]);

    return NextResponse.json({
      ok: true,
      projectTimeZone: scanner.projectTimeZone,
      role: profile.role,
      scannerObjects: scanner.objects,
      scannerRooms: scanner.rooms,
      manageableObjects,
      canManageConfig: canManageRoundsConfig(profile.role),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canManageRoundsConfig(profile.role)) {
      return NextResponse.json({ error: "Недостаточно прав для настройки обходов" }, { status: 403 });
    }

    const payload = saveSchema.parse(await request.json());
    await saveRoundsRoomSelection(supabase, profile, payload.objectId, payload.enabledRoomIds);
    await ensureRoundsQrTokens(supabase, profile, {
      objectId: payload.objectId,
      roomIds: payload.enabledRoomIds,
      missingOnly: true,
    });

    revalidateRoundsPaths();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
