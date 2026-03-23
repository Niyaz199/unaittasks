import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/api-auth";
import { canManageRoundsConfig } from "@/lib/rounds/permissions";
import { ensureRoundsQrTokens } from "@/lib/rounds/queries";

const schema = z.object({
  objectId: z.string().uuid().optional(),
  roomIds: z.array(z.string().uuid()).optional(),
  forceRegenerate: z.boolean().optional(),
  missingOnly: z.boolean().optional(),
});

function revalidateRoundsPaths() {
  revalidatePath("/rounds");
  revalidatePath("/rounds/config");
  revalidatePath("/rounds/qr");
}

export async function POST(request: Request) {
  try {
    const { supabase, profile } = await getApiSession();
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canManageRoundsConfig(profile.role)) {
      return NextResponse.json({ error: "Недостаточно прав для генерации QR" }, { status: 403 });
    }

    const payload = schema.parse(await request.json());
    const updatedRoomIds = await ensureRoundsQrTokens(supabase, profile, payload);

    revalidateRoundsPaths();
    return NextResponse.json({ ok: true, updatedRoomIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
