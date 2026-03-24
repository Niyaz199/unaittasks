import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiSession } from "@/lib/api-auth";
import { canManageRoundsConfig } from "@/lib/rounds/permissions";
import {
  getRoundsScannerConfigForProfile,
  listRoundsManageableObjectsForProfile,
  saveRoundsRoomSelectionBatch,
  saveRoundsRoomSelection,
} from "@/lib/rounds/queries";

const saveSchema = z.object({
  objectId: z.string().uuid(),
  enabledRoomIds: z.array(z.string().uuid()).default([]),
});

const batchSaveSchema = z.object({
  operations: z.array(saveSchema).min(1),
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

    const body = await request.json();
    const batchPayload = batchSaveSchema.safeParse(body);

    if (batchPayload.success) {
      const result = await saveRoundsRoomSelectionBatch(supabase, profile, batchPayload.data.operations);
      revalidateRoundsPaths();

      if (result.failed.length && result.saved.length) {
        return NextResponse.json(
          {
            ok: false,
            partial: true,
            message: "Конфигурация сохранена частично. Часть объектов не обновилась.",
            result,
          },
          { status: 207 }
        );
      }

      if (result.failed.length) {
        return NextResponse.json(
          {
            error: "Не удалось сохранить конфигурацию обходов ни для одного объекта.",
            result,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({ ok: true, result });
    }

    const payload = saveSchema.parse(body);
    const result = await saveRoundsRoomSelection(supabase, profile, payload.objectId, payload.enabledRoomIds);

    revalidateRoundsPaths();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
